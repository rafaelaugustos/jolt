import { DEFAULT_FRICTION, solveDecay } from '../core/decay.js'
import { precision } from '../core/properties.js'
import type { Plan } from './plan.js'

export interface WebDecayVelocity {
  x?: number
  y?: number
}
export interface WebDecayOptions {
  friction?: number
  snap?: readonly number[] | { x?: readonly number[]; y?: readonly number[] }
}
export function decayPlans(
  velocity: WebDecayVelocity,
  options: WebDecayOptions = {},
): Plan[] {
  if (
    !velocity ||
    typeof velocity !== 'object' ||
    Array.isArray(velocity) ||
    !options ||
    typeof options !== 'object' ||
    Array.isArray(options)
  )
    throw new TypeError('Decay requires translation velocities and options.')
  if (Object.keys(options).some((k) => k !== 'friction' && k !== 'snap'))
    throw new TypeError('Unknown decay option.')
  const friction = options.friction ?? DEFAULT_FRICTION
  if (!Number.isFinite(friction) || friction <= 0 || friction >= 1)
    throw new RangeError('Decay friction must be between 0 and 1 exclusively.')
  const stops = (values?: readonly number[]) => {
    if (values === undefined) return undefined
    if (!Array.isArray(values) || !values.length || ![...values].every(Number.isFinite))
      throw new RangeError('Decay snap requires nonempty finite positions.')
    return [...values]
  }
  const snap = options.snap
  if (
    snap !== undefined &&
    !Array.isArray(snap) &&
    (!snap ||
      typeof snap !== 'object' ||
      Object.keys(snap).some((k) => k !== 'x' && k !== 'y'))
  )
    throw new TypeError('Decay snap needs an array or x/y stops.')
  const shared = Array.isArray(snap) ? stops(snap) : undefined
  const perAxis = snap as { x?: readonly number[]; y?: readonly number[] } | undefined
  const x = shared ?? stops(perAxis?.x),
    y = shared ?? stops(perAxis?.y)
  return Object.entries(velocity).flatMap(([property, value]) => {
    if (property !== 'x' && property !== 'y')
      throw new TypeError('Decay supports x/y translations.')
    if (value === undefined) return []
    if (!Number.isFinite(value)) throw new RangeError('Decay velocity must be finite.')
    solveDecay(0, value, friction, precision[property])
    return [
      {
        property,
        source: property,
        frames: [null, null],
        relative: false,
        transition: {
          curve: {
            type: 'decay',
            friction,
            velocity: value,
            snap: property === 'x' ? x : y,
          },
          delay: 0,
          repeat: 0,
          reverse: false,
        },
      },
    ]
  })
}
