import type { Animation } from '../core/playback.js'
import { curveKeys, normalize, timingFor, type Timing } from '../core/state-transition.js'
import { keyframeProperties } from './properties.js'
import type {
  Keyframes,
  KeyframeProperty,
  Values,
  Transition,
  SpringName,
  DistributiveOmit,
} from './types.js'
import type { WebAnimation } from './public.js'
import type { WebMotionScope } from './scope.js'

type StateCurve =
  SpringName | DistributiveOmit<Transition, 'repeat' | 'repeatType' | 'repeatDelay'>
export type WebStateTransition<T extends string = string> =
  | StateCurve
  | (Exclude<StateCurve, string> &
      (string extends T ? unknown : { [K in T]?: StateCurve }))
export type WebMotionState<K extends PropertyKey = string> = Partial<Record<K, Values>>
export type WebMotionDefinitions<T, S> = S & {
  [N in keyof S]: Record<Exclude<keyof S[N], keyof T>, never> & {
    [K in keyof S[N]]: Record<Exclude<keyof S[N][K], KeyframeProperty>, never>
  }
}
export interface WebMotionStatesOptions<T extends string = string> {
  transition?: WebStateTransition<T>
  scope?: WebMotionScope
}
export interface WebMotionStates<S extends string = string, T extends string = string> {
  readonly current: S | undefined
  readonly settled: S | undefined
  readonly disposed: boolean
  readonly paused: boolean
  to(state: S, transition?: WebStateTransition<T>): Animation
  attach(target: T, element: HTMLElement | null): void
  ref(target: T): (element: HTMLElement | null) => void
  pause(): void
  play(): void
  stop(): void
  dispose(): void
}
export interface StateHost {
  assert(): void
  validateTarget(target: HTMLElement): void
  /** Validation is performed even for absent targets; no ownership is acquired. */
  prepare(
    target: HTMLElement | null,
    frames: Keyframes,
    transition: StateCurve,
  ): () => WebAnimation
  set(target: HTMLElement, frames: Values): void
  forget(): void
}

/** Named transitions retain only their own handles, including when refs change. */
export function createMotionStates<
  T extends Record<string, HTMLElement | null>,
  const S extends Record<string, WebMotionState<keyof T>>,
>(
  targets: T,
  definitions: WebMotionDefinitions<T, S>,
  options: WebMotionStatesOptions<Extract<keyof T, string>>,
  host: StateHost,
): WebMotionStates<Extract<keyof S, string>, Extract<keyof T, string>> {
  type Name = Extract<keyof S, string>
  type Slot = Extract<keyof T, string>
  if (
    !targets ||
    typeof targets !== 'object' ||
    Array.isArray(targets) ||
    !definitions ||
    typeof definitions !== 'object' ||
    Array.isArray(definitions)
  )
    throw new TypeError('Expected named motion targets and states.')
  if (
    !options ||
    typeof options !== 'object' ||
    Object.keys(options).some((k) => k !== 'transition' && k !== 'scope')
  )
    throw new TypeError('Invalid motionStates options.')
  const views = new Map<string, HTMLElement | null>(Object.entries(targets))
  for (const [key, view] of views) {
    if (curveKeys.has(key))
      throw new TypeError(
        `A motion target cannot be named "${key}", like a transition option.`,
      )
    if (view !== null) host.validateTarget(view)
  }
  const assigned = [...views.values()].filter(Boolean)
  if (new Set(assigned).size !== assigned.length)
    throw new TypeError('Motion state targets must be distinct.')
  const defaults = normalize(options.transition, views)
  const states = new Map<string, Map<string, Values>>()
  for (const [name, state] of Object.entries(definitions)) {
    if (!state || typeof state !== 'object' || Array.isArray(state))
      throw new TypeError(`Invalid motion state "${name}".`)
    const rows = new Map<string, Values>()
    for (const [slot, input] of Object.entries(state)) {
      if (!views.has(slot)) throw new TypeError(`Unknown motion target "${slot}".`)
      if (!input || typeof input !== 'object' || Array.isArray(input))
        throw new TypeError('Motion states require endpoint values.')
      const frames: Values = {}
      for (const [property, value] of Object.entries(input)) {
        if (value === undefined) continue
        if (
          !(keyframeProperties as readonly string[]).includes(property) ||
          (typeof value !== 'string' &&
            (typeof value !== 'number' || !Number.isFinite(value)))
        )
          throw new TypeError(`Invalid motion state endpoint "${property}".`)
        Object.assign(frames, { [property]: value })
      }
      host.prepare(views.get(slot)!, frames, timingFor(defaults, slot) as StateCurve)
      rows.set(slot, frames)
    }
    states.set(name, rows)
  }
  let current: Name | undefined,
    settled: Name | undefined,
    disposed = false,
    paused = false
  interface Run {
    handle: Animation
    children: Map<string, WebAnimation>
    timing: Timing
    completed: boolean
    done: boolean
    finish(result: boolean): void
  }
  let active: Run | undefined
  const refs = new Map<string, (view: HTMLElement | null) => void>()
  const assert = () => {
    host.assert()
    if (disposed) throw new Error('Motion states controller is disposed.')
  }
  const check = (run: Run) => {
    if (run.done || run.children.size) return
    run.done = true
    const success = run.completed && active === run && !disposed
    if (active === run) {
      active = undefined
      if (success) settled = current
    }
    run.finish(success)
  }
  const join = (run: Run, slot: string, child: WebAnimation) => {
    run.children.set(slot, child)
    if (paused) child.pause()
    void child.finished.then(
      (result) => {
        if (run.children.get(slot) !== child || run.done) return
        run.children.delete(slot)
        run.completed &&= result
        check(run)
      },
      () => {
        if (run.children.get(slot) !== child || run.done) return
        run.children.delete(slot)
        run.completed = false
        check(run)
      },
    )
  }
  const controller: WebMotionStates<Name, Slot> = {
    get current() {
      return current
    },
    get settled() {
      return settled
    },
    get paused() {
      return paused
    },
    get disposed() {
      return disposed
    },
    to(name, transition) {
      assert()
      const rows = states.get(name)
      if (!rows) throw new TypeError(`Unknown motion state "${name}".`)
      const timing = normalize(transition, views, defaults)
      // Compile the entire next state before the first ownership change.
      const prepared = [...rows].map(([slot, frames]) => ({
        slot,
        start: host.prepare(
          views.get(slot)!,
          frames,
          timingFor(timing, slot) as StateCurve,
        ),
      }))
      const previous = active
      let finish!: (result: boolean) => void
      const finished = new Promise<boolean>((resolve) => {
        finish = resolve
      })
      const run: Run = {
        children: new Map(),
        timing,
        completed: true,
        done: false,
        finish,
        handle: {
          finished,
          stop() {
            if (run.done) return
            run.done = true
            if (active === run) active = undefined
            for (const child of run.children.values()) child.stop()
            run.children.clear()
            finish(false)
          },
          then: (resolve, reject) => finished.then(resolve, reject),
        },
      }
      try {
        for (const { slot, start } of prepared)
          if (views.get(slot)) join(run, slot, start())
      } catch (error) {
        run.handle.stop()
        previous?.handle.stop()
        throw error
      }
      active = run
      current = name
      previous?.handle.stop()
      queueMicrotask(() => check(run))
      return run.handle
    },
    attach(slot, view) {
      assert()
      if (!views.has(slot)) throw new TypeError(`Unknown motion target "${slot}".`)
      if (views.get(slot) === view) return
      if (view !== null) {
        host.validateTarget(view)
        for (const [other, value] of views)
          if (other !== slot && value === view)
            throw new TypeError('Motion state targets must be distinct.')
        for (const rows of states.values())
          if (rows.has(slot))
            host.prepare(view, rows.get(slot)!, timingFor(defaults, slot) as StateCurve)
      }
      const frames = current === undefined ? undefined : states.get(current)!.get(slot)
      const run = active
      const start =
        view && frames && run
          ? host.prepare(view, frames, timingFor(run.timing, slot) as StateCurve)
          : undefined
      const replacement = start?.()
      if (replacement && paused) replacement.pause()
      const old = run?.children.get(slot)
      run?.children.delete(slot)
      views.set(slot, view)
      if (run && replacement) join(run, slot, replacement)
      old?.stop()
      if (view && frames && !run) host.set(view, frames)
      if (run) queueMicrotask(() => check(run))
    },
    ref(slot) {
      assert()
      if (!views.has(slot)) throw new TypeError(`Unknown motion target "${slot}".`)
      let callback = refs.get(slot)
      if (!callback) {
        callback = (view) => {
          if (!disposed) controller.attach(slot, view)
        }
        refs.set(slot, callback)
      }
      return callback
    },
    pause() {
      if (disposed || paused) return
      paused = true
      for (const child of active?.children.values() ?? []) child.pause()
    },
    play() {
      if (disposed || !paused) return
      paused = false
      for (const child of active?.children.values() ?? []) child.play()
    },
    stop() {
      active?.handle.stop()
    },
    dispose() {
      if (disposed) return
      disposed = true
      controller.stop()
      refs.clear()
      views.clear()
      host.forget()
    },
  }
  if (options.scope) {
    try {
      options.scope.add(controller)
    } catch (error) {
      controller.dispose()
      throw error
    }
  }
  return controller
}
