import type { Track } from '../core/track.js'
import { mixValue, type Property } from './properties.js'

export interface Point {
  time: number
  value: number
}
/** Expand finite repeats once; duplicate times preserve authored/loop discontinuities. */
export function flatten(track: Track, budget: number): Point[] {
  if (!Number.isFinite(track.end) || track.end < 0)
    throw new RangeError('A Web track must be finite.')
  if (track.end === 0) return [{ time: 0, value: track.to }]
  if (track.times.length * (track.repeat + 1) > budget)
    throw new RangeError('Track keyframe budget exceeded.')
  const points: Point[] = [{ time: 0, value: track.values[0]! }]
  for (let cycle = 0; cycle <= track.repeat; cycle++) {
    const backward = track.reverse && cycle % 2 === 1
    for (let i = 0; i < track.times.length; i++) {
      const index = backward ? track.times.length - 1 - i : i
      const time =
        track.delay +
        track.duration *
          (cycle + (backward ? 1 - track.times[index]! : track.times[index]!))
      const value = track.values[index]!
      const previous = points.at(-1)!
      if (time === previous.time && value === previous.value) continue
      points.push({ time, value })
    }
  }
  return points
}

export function sampled(
  points: readonly Point[],
  time: number,
  side: 'left' | 'right' = 'right',
  property?: Property,
) {
  let lo = 0,
    hi = points.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (points[mid]!.time < time || (side === 'right' && points[mid]!.time === time))
      lo = mid + 1
    else hi = mid
  }
  if (lo === 0) return points[0]!.value
  if (lo === points.length) return points.at(-1)!.value
  const a = points[lo - 1]!,
    b = points[lo]!
  const p = (time - a.time) / (b.time - a.time)
  return property
    ? mixValue(property, a.value, b.value, p)
    : a.value + (b.value - a.value) * p
}
