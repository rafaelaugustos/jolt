import {
  mergeTransitions,
  springs,
  type Spring,
  type Tween,
  type Gravity,
  type SpringName,
} from './transition.js'

export type StateCurve =
  | SpringName
  | Omit<Spring, 'repeat' | 'repeatType'>
  | Omit<Tween, 'repeat' | 'repeatType'>
  | Omit<Gravity, 'repeat' | 'repeatType'>
/** One transition for every target, or a main one with some targets set apart by name. */
export type StateTransition<T extends string = string> =
  | StateCurve
  | (Exclude<StateCurve, SpringName> &
      (string extends T ? unknown : { [K in T]?: StateCurve }))

export const curveKeys = new Set([
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
  'acceleration',
  'restitution',
])

type Curve = Exclude<StateCurve, SpringName>
export interface Timing {
  readonly main: StateCurve
  readonly targets: ReadonlyMap<string, StateCurve>
}

/** The transition one target plays: its own merged over the main one, or the main one. */
export function timingFor(timing: Timing, target: string): StateCurve {
  const own = timing.targets.get(target)
  if (own === undefined) return timing.main
  const main = typeof timing.main === 'string' ? springs[timing.main] : timing.main
  return mergeTransitions(main, typeof own === 'string' ? springs[own] : own) as Curve
}

const snappy: Timing = { main: 'snappy', targets: new Map() }

/** A transition that only names targets keeps the fallback for everything else. */
export function normalize(
  transition: StateTransition | undefined,
  targets: ReadonlyMap<string, unknown>,
  fallback = snappy,
): Timing {
  if (transition === undefined) return fallback
  if (typeof transition === 'string')
    return { main: curve(transition), targets: new Map() }
  if (!transition || typeof transition !== 'object')
    throw new TypeError('Invalid state transition.')
  const main: Record<string, unknown> = {}
  const own = new Map<string, StateCurve>()
  for (const [key, value] of Object.entries(transition)) {
    if (targets.has(key)) {
      if (value !== undefined) own.set(key, curve(value as StateCurve))
    } else main[key] = value
  }
  if (own.size && !Object.keys(main).length)
    return { main: fallback.main, targets: new Map([...fallback.targets, ...own]) }
  return { main: curve(main as Curve), targets: own }
}

function curve(transition: StateCurve): StateCurve {
  if (typeof transition === 'string') {
    if (!['smooth', 'snappy', 'bouncy'].includes(transition))
      throw new TypeError('Unknown state spring.')
    return transition
  }
  if (!transition || typeof transition !== 'object')
    throw new TypeError('Invalid state transition.')
  for (const key of Object.keys(transition))
    if (!curveKeys.has(key))
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
