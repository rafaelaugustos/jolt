import { createTrack } from '../track.js'
import { resolveTransition, springs, type Spring, type Tween } from '../transition.js'
import type { SharedLayoutTransition } from './index.js'
import type { Flight } from './native.js'

export function timing(input: SharedLayoutTransition | undefined): Spring | Tween {
  const result = typeof input === 'string' ? springs[input] : (input ?? springs.smooth)
  if (!result || typeof result !== 'object')
    throw new TypeError('Unknown shared layout transition.')
  const allowed = new Set([
    'type',
    'duration',
    'ease',
    'times',
    'easeTrack',
    'stiffness',
    'damping',
    'mass',
    'bounce',
    'velocity',
    'delay',
  ])
  for (const [key, value] of Object.entries(result)) {
    if (!allowed.has(key))
      throw new TypeError(`Unsupported shared layout transition option: ${key}.`)
    if (typeof value === 'number' && !Number.isFinite(value))
      throw new RangeError(`${key} must be finite.`)
  }
  if (result.type !== undefined && result.type !== 'spring' && result.type !== 'tween')
    throw new TypeError('Unknown shared layout transition type.')
  const spring = result as Spring
  for (const key of ['stiffness', 'mass'] as const)
    if (spring[key] !== undefined && spring[key]! <= 0)
      throw new RangeError(`${key} must be positive.`)
  if (spring.damping !== undefined && spring.damping < 0)
    throw new RangeError('damping must be nonnegative.')
  // Validate before touching the visible tree.
  const resolved = resolveTransition(result, 'x', 2)
  if (
    resolved.curve.type === 'spring' &&
    result.duration !== undefined &&
    result.duration <= 0
  )
    throw new RangeError('Spring duration must be positive.')
  if ((result.duration ?? 0) > 30_000 || (result.delay ?? 0) > 30_000)
    throw new RangeError('Shared layout playback must finish within 30 seconds.')
  return { ...result }
}
export function tracks(
  flight: Flight,
  destination: number[],
  transition: Spring | Tween,
  initialVelocity?: Readonly<{ x: number; y: number }>,
): string {
  const state = JSON.parse(flight.state()) as { pose: number[]; velocity: number[] }
  const geometry = destination.map((to, index) => {
    const property = index === 4 ? 'borderRadius' : 'x'
    return createTrack(
      property,
      [state.pose[index >= 5 ? index + 1 : index]!, to],
      resolveTransition(transition, property, 2),
      (index === 0 ? initialVelocity?.x : index === 1 ? initialVelocity?.y : undefined) ??
        state.velocity[index >= 5 ? index + 1 : index] ??
        0,
    )
  })
  const duration = Math.max(...geometry.map((track) => track.end))
  if (!Number.isFinite(duration) || duration > 30_000)
    throw new RangeError('Shared layout playback must finish within 30 seconds.')
  const blend = createTrack(
    'opacity',
    [0, 1],
    resolveTransition({ duration: 180, ease: 'linear' }, 'opacity', 2),
    0,
  )
  return JSON.stringify({
    tracks: [...geometry.slice(0, 5), blend, ...geometry.slice(5)].map((track) => {
      const times = track.times.map((time) => track.delay + time * track.duration)
      const values = [...track.values]
      if (track.delay > 0) {
        times.unshift(0)
        values.unshift(values[0]!)
      }
      return { times, values }
    }),
  })
}
