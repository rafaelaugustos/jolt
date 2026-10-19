import { prepareAnimation, toView } from './animate.js'
import { isColorProperty, type ColorValue } from './color.js'
import { isProperty } from './properties.js'
import type { Animation } from './engine.js'
import type { PlaybackAnimation } from './playback.js'
import type { KeyframeProperty, Keyframes, Target } from './types.js'
import type { Spring, Tween, SpringName } from './transition.js'
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
export type StateTransition =
  | SpringName
  | Omit<Spring, 'repeat' | 'repeatType'>
  | Omit<Tween, 'repeat' | 'repeatType'>
export interface MotionStatesOptions {
  transition?: StateTransition
  scope?: MotionScope
}
export interface MotionStates<S extends string = string> {
  /** Latest requested state, not a claim that playback has finished. */
  readonly current: S | undefined
  readonly settled: S | undefined
  readonly disposed: boolean
  readonly paused: boolean
  to(state: S, transition?: StateTransition): Animation
  pause(): void
  play(): void
  stop(): void
  dispose(): void
}

/** Coordinated named targets. Omitted properties freeze when leaving their previous state. */
export function motionStates<
  T extends Record<string, Target>,
  const S extends Record<string, MotionState<keyof T>>,
>(
  targets: T,
  definitions: MotionDefinitions<T, S>,
  options: MotionStatesOptions = {},
): MotionStates<Extract<keyof S, string>> {
  type Name = Extract<keyof S, string>
  const views = new Map(
    Object.entries(targets).map(([name, target]) => [name, toView(target)]),
  )
  if (new Set(views.values()).size !== views.size)
    throw new TypeError('Motion state targets must refer to distinct views.')
  const states = new Map<string, [Target, Keyframes][]>()
  const defaults = normalize(options.transition)
  for (const [name, state] of Object.entries(definitions)) {
    if (!state || typeof state !== 'object' || Array.isArray(state))
      throw new TypeError(`Invalid motion state "${name}".`)
    const rows: [Target, Keyframes][] = []
    for (const [target, values] of Object.entries(state)) {
      const view = views.get(target)
      if (!view) throw new TypeError(`Unknown motion target "${target}".`)
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
      prepareAnimation(view, frames, defaults)
      rows.push([view, frames])
    }
    states.set(name, rows)
  }
  let current: Name | undefined
  let settled: Name | undefined
  let disposed = false
  let paused = false
  let active: { handle: Animation; children: PlaybackAnimation[] } | undefined
  const controller: MotionStates<Name> = {
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
      const timing = transition === undefined ? defaults : normalize(transition)
      const prepared = rows.map(([view, frames]) =>
        prepareAnimation(view, frames, timing),
      )
      const previous = active
      const children: PlaybackAnimation[] = []
      // Start replacements first: the engine transfers visible position AND velocity.
      try {
        for (const start of prepared) {
          const child = start()
          children.push(child)
          if (paused) child.pause()
        }
      } catch (error) {
        children.forEach((child) => child.stop())
        previous?.handle.stop()
        active = undefined
        throw error
      }
      let cancelled = false
      const finished = Promise.all(children.map((child) => child.finished)).then(
        (results) => {
          const completed =
            !cancelled && !disposed && active?.handle === handle && results.every(Boolean)
          if (active?.handle === handle) {
            active = undefined
            if (completed) settled = name
          }
          return completed
        },
      )
      const handle: Animation = {
        finished,
        stop() {
          cancelled = true
          children.forEach((child) => child.stop())
        },
        then: (resolve, reject) => finished.then(resolve, reject),
      }
      active = { handle, children }
      current = name
      // Also cancels old, omitted properties, without touching the new owners.
      previous?.handle.stop()
      return handle
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
    },
  }
  return options.scope ? options.scope.add(controller) : controller
}

function normalize(transition: StateTransition | undefined): StateTransition {
  if (transition === undefined) return 'snappy'
  if (typeof transition === 'string') {
    if (!['smooth', 'snappy', 'bouncy'].includes(transition))
      throw new TypeError('Unknown state spring.')
    return transition
  }
  if (!transition || typeof transition !== 'object')
    throw new TypeError('Invalid state transition.')
  const allowed = new Set([
    'type',
    'delay',
    'duration',
    'ease',
    'times',
    'stiffness',
    'damping',
    'mass',
    'bounce',
    'velocity',
  ])
  for (const key of Object.keys(transition))
    if (!allowed.has(key))
      throw new TypeError(`State transitions do not support "${key}".`)
  if (
    transition.duration !== undefined &&
    (!Number.isFinite(transition.duration) || transition.duration < 0)
  )
    throw new RangeError('State transition duration must be finite and nonnegative.')
  if (
    transition.delay !== undefined &&
    (!Number.isFinite(transition.delay) || transition.delay < 0)
  )
    throw new RangeError('State transition delay must be finite and nonnegative.')
  return { ...transition }
}
