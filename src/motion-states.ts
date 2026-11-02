import { endingValues, prepareAnimation, set, toView } from './animate.js'
import { isColorProperty, type ColorValue } from './color.js'
import { isProperty } from './properties.js'
import type { Animation } from './engine.js'
import type { PlaybackAnimation } from './playback.js'
import type { KeyframeProperty, Keyframes, Target, Values } from './types.js'
import type { View } from '@nativescript/core'
import type { MotionScope } from './motion-scope.js'

/** Absolute endpoints only; keyframe arrays, paths and relative offsets are not states. */
export type MotionValues = {
  [K in KeyframeProperty]?: K extends 'color' | 'backgroundColor' | 'borderColor'
    ? ColorValue
    : number
}
export type MotionState<K extends PropertyKey = string> = Partial<Record<K, MotionValues>>
/** Preserve inference while rejecting unknown target/property keys. */
export type MotionDefinitions<T, S> = S & {
  [N in keyof S]: Record<Exclude<keyof S[N], keyof T>, never> & {
    [K in keyof S[N]]: Record<Exclude<keyof S[N][K], KeyframeProperty>, never>
  }
}
import {
  curveKeys,
  normalize,
  timingFor,
  type Timing,
  type StateTransition,
} from './core/state-transition.js'
export type { StateTransition } from './core/state-transition.js'
export interface MotionStatesOptions<T extends string = string> {
  transition?: StateTransition<T>
  scope?: MotionScope
}
export interface MotionStates<S extends string = string, T extends string = string> {
  /** Latest requested state, not a claim that playback has finished. */
  readonly current: S | undefined
  readonly settled: S | undefined
  readonly disposed: boolean
  readonly paused: boolean
  to(state: S, transition?: StateTransition<T>): Animation
  /**
   * Point a target at a new view, or at none with `null`. The new view takes the current
   * state at once, or joins the transition in progress from where it is.
   */
  attach(target: T, view: Target | null): void
  /** A stable callback for a template ref: attaches the element and detaches it on unmount. */
  ref(target: T): (view: Target | null) => void
  pause(): void
  play(): void
  stop(): void
  dispose(): void
}

/** Coordinated named targets. Omitted properties freeze when leaving their previous state. */
export function motionStates<
  T extends Record<string, Target | null>,
  const S extends Record<string, MotionState<keyof T>>,
>(
  targets: T,
  definitions: MotionDefinitions<T, S>,
  options: MotionStatesOptions<Extract<keyof T, string>> = {},
): MotionStates<Extract<keyof S, string>, Extract<keyof T, string>> {
  type Name = Extract<keyof S, string>
  type Slot = Extract<keyof T, string>
  const views = new Map<string, View | null>(
    Object.entries(targets).map(([name, target]) => [
      name,
      target === null ? null : toView(target),
    ]),
  )
  const assigned = [...views.values()].filter(Boolean)
  if (new Set(assigned).size !== assigned.length)
    throw new TypeError('Motion state targets must refer to distinct views.')
  for (const name of views.keys())
    if (curveKeys.has(name))
      throw new TypeError(
        `A motion target can't be named "${name}", like a transition option.`,
      )
  const states = new Map<string, [string, Keyframes][]>()
  const defaults = normalize(options.transition, views)
  for (const [name, state] of Object.entries(definitions)) {
    if (!state || typeof state !== 'object' || Array.isArray(state))
      throw new TypeError(`Invalid motion state "${name}".`)
    const rows: [string, Keyframes][] = []
    for (const [target, values] of Object.entries(state)) {
      if (!views.has(target)) throw new TypeError(`Unknown motion target "${target}".`)
      const view = views.get(target)
      if (!values || typeof values !== 'object' || Array.isArray(values))
        throw new TypeError(`Invalid motion values for "${target}".`)
      const frames: Keyframes = {}
      for (const [property, value] of Object.entries(values)) {
        if (value === undefined) continue
        if (property !== 'scale' && !isProperty(property))
          throw new TypeError(`Invalid motion state property "${property}".`)
        if (
          !isColorProperty(property) &&
          (typeof value !== 'number' || !Number.isFinite(value))
        )
          throw new TypeError(`Motion state "${property}" requires a finite endpoint.`)
        if (Array.isArray(value) || value === null)
          throw new TypeError(`Motion state "${property}" requires a single endpoint.`)
        Object.assign(frames, { [property]: value })
      }
      // Validate every definition up front without claiming any native property.
      if (view) prepareAnimation(view, frames, timingFor(defaults, target))
      else endingValues(frames, timingFor(defaults, target))
      rows.push([target, frames])
    }
    states.set(name, rows)
  }
  let current: Name | undefined
  let settled: Name | undefined
  let disposed = false
  let paused = false
  interface Run {
    handle: Animation
    children: Map<string, PlaybackAnimation>
    timing: Timing
    completed: boolean
    done: boolean
    finish(result: boolean): void
  }
  let active: Run | undefined
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
  const join = (run: Run, slot: string, child: PlaybackAnimation) => {
    run.children.set(slot, child)
    if (paused) child.pause()
    const finish = (result: boolean) => {
      if (run.done || run.children.get(slot) !== child) return
      run.children.delete(slot)
      run.completed &&= result
      check(run)
    }
    void child.finished.then(finish, () => finish(false))
  }
  const refs = new Map<string, (view: Target | null) => void>()
  const framesFor = (state: Name | undefined, target: string) =>
    state === undefined
      ? undefined
      : states.get(state)!.find(([slot]) => slot === target)?.[1]
  const controller: MotionStates<Name, Slot> = {
    get current() {
      return current
    },
    get settled() {
      return settled
    },
    get disposed() {
      return disposed
    },
    get paused() {
      return paused
    },
    to(name, transition) {
      if (disposed) throw new Error('Motion states controller is disposed.')
      const rows = states.get(name)
      if (!rows) throw new TypeError(`Unknown motion state "${name}".`)
      const timing = normalize(transition, views, defaults)
      const prepared = rows.flatMap(([target, frames]) => {
        const view = views.get(target)
        return view
          ? [{ target, start: prepareAnimation(view, frames, timingFor(timing, target)) }]
          : []
      })
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
      // Start replacements first: the engine transfers visible position and velocity.
      try {
        for (const { target, start } of prepared) join(run, target, start())
      } catch (error) {
        run.handle.stop()
        previous?.handle.stop()
        throw error
      }
      active = run
      current = name
      previous?.handle.stop()
      void Promise.resolve().then(() => check(run))
      return run.handle
    },
    attach(target, next) {
      if (disposed) throw new Error('Motion states controller is disposed.')
      if (!views.has(target)) throw new TypeError(`Unknown motion target "${target}".`)
      const view = next === null ? null : toView(next)
      if (views.get(target) === view) return
      if (view)
        for (const [other, assignedView] of views)
          if (other !== target && assignedView === view)
            throw new TypeError('Motion state targets must refer to distinct views.')
      if (view)
        for (const [, rows] of states)
          for (const [slot, frames] of rows)
            if (slot === target)
              prepareAnimation(view, frames, timingFor(defaults, target))
      const frames = view ? framesFor(current, target) : undefined
      const run = active
      // Validate/start before retiring the previous participant, so a failed
      // replacement cannot corrupt the current transition or its completion.
      const child =
        view && frames && run
          ? prepareAnimation(view, frames, timingFor(run.timing, target))()
          : undefined
      const old = run?.children.get(target)
      run?.children.delete(target)
      views.set(target, view)
      if (run && child) join(run, target, child)
      old?.stop()
      if (view && frames && !run) set(view, frames as Values)
      if (run) void Promise.resolve().then(() => check(run))
    },
    ref(target) {
      let callback = refs.get(target)
      if (!callback) {
        callback = (view) => {
          if (!disposed) controller.attach(target, view)
        }
        refs.set(target, callback)
      }
      return callback
    },
    pause() {
      if (disposed || paused) return
      paused = true
      active?.children.forEach((child) => child.pause())
    },
    play() {
      if (disposed || !paused) return
      paused = false
      active?.children.forEach((child) => child.play())
    },
    stop() {
      active?.handle.stop()
      active = undefined
    },
    dispose() {
      if (disposed) return
      disposed = true
      controller.stop()
      refs.clear()
      views.clear()
    },
  }
  return options.scope ? options.scope.add(controller) : controller
}
