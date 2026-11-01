import { sampleCurve } from '../core/sampling.js'
import { sampled, type Point } from './curve.js'
import { identity, multiplicative, properties, type Property } from './types.js'

export type Pose = Record<Property, number>
export interface Contribution {
  property: Property
  points: readonly Point[]
  time: number
  paused: boolean
}
export interface Rest {
  property: Property
  value: number
}
const tolerance: Pose = {
  x: 0.05,
  y: 0.05,
  rotate: 0.02,
  scaleX: 0.0002,
  scaleY: 0.0002,
  opacity: 0.0002,
}
const clamp = (v: number) => Math.min(1, Math.max(0, v))

export function poseAt(
  entries: readonly Contribution[],
  rest: readonly Rest[],
  future = 0,
  side: 'left' | 'right' = 'right',
): Pose {
  const pose: Pose = { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1, opacity: 1 }
  const add = (property: Property, value: number) => {
    if (multiplicative(property)) pose[property] *= value
    else pose[property] += value
  }
  for (const held of rest) add(held.property, held.value)
  for (const entry of entries)
    add(
      entry.property,
      sampled(
        entry.points,
        entry.time + (entry.paused ? 0 : future),
        entry.paused ? 'right' : side,
      ),
    )
  pose.opacity = clamp(pose.opacity)
  if (Object.values(pose).some((v) => !Number.isFinite(v)))
    throw new RangeError('Composed motion overflowed.')
  return pose
}

export function compose(
  entries: readonly Contribution[],
  rest: readonly Rest[],
  baseline: string,
  maxKeyframes: number,
) {
  const duration = Math.max(
    0,
    ...entries.filter((e) => !e.paused).map((e) => e.points.at(-1)!.time - e.time),
  )
  const transform = (p: Pose) =>
    `${baseline} translate(${p.x}px, ${p.y}px) rotate(${p.rotate}deg) scale(${p.scaleX}, ${p.scaleY})`
  const frame = (t: number, side: 'left' | 'right'): Keyframe => {
    const p = poseAt(entries, rest, t, side)
    return {
      offset: duration ? t / duration : 0,
      transform: transform(p),
      opacity: p.opacity,
    }
  }
  const final = poseAt(entries, rest, duration)
  if (!duration)
    return {
      duration,
      frames: [] as Keyframe[],
      transform: transform(final),
      opacity: String(final.opacity),
    }
  const knots = [
    ...new Set([
      0,
      duration,
      ...entries.flatMap((e) =>
        e.paused
          ? []
          : e.points.map((p) => p.time - e.time).filter((t) => t > 0 && t < duration),
      ),
    ]),
  ].sort((a, b) => a - b)
  if (knots.length > maxKeyframes)
    throw new RangeError('Composition keyframe budget exceeded.')
  const frames: Keyframe[] = [frame(0, 'right')]
  for (let i = 1; i < knots.length; i++) {
    const start = knots[i - 1]!,
      end = knots[i]!,
      length = end - start
    const offsets = new Set([1])
    // Between compiler knots each contribution is linear. Bound the second
    // derivative of their product, then reuse the core adaptive sampler.
    for (const property of properties.filter(multiplicative)) {
      const factors = entries
        .filter((e) => e.property === property)
        .map(
          (e) =>
            [
              sampled(e.points, e.time + (e.paused ? 0 : start)),
              sampled(
                e.points,
                e.time + (e.paused ? 0 : end),
                e.paused ? 'right' : 'left',
              ),
            ] as const,
        )
      const held = rest
        .filter((r) => r.property === property)
        .reduce((v, r) => v * r.value, identity(property))
      const product = (t: number) =>
        factors.reduce((v, [a, b]) => v * (a + ((b - a) * t) / length), held)
      if (factors.filter(([a, b]) => a !== b).length <= 1) {
        // Linear contributions need only endpoints and exact opacity clamp crossings.
        if (property === 'opacity') {
          const a = product(0),
            b = product(length)
          for (const edge of [0, 1]) {
            const offset = (edge - a) / (b - a)
            if (offset > 0 && offset < 1) offsets.add(offset)
          }
        }
        continue
      }
      const bound = (a: number, b: number) => {
        const ranges = factors.map(([from, to]) => ({
          slope: Math.abs(to - from) / length,
          max: Math.max(
            Math.abs(from + ((to - from) * a) / length),
            Math.abs(from + ((to - from) * b) / length),
          ),
        }))
        let second = 0
        for (let j = 0; j < ranges.length; j++)
          for (let k = j + 1; k < ranges.length; k++) {
            let term = 2 * Math.abs(held) * ranges[j]!.slope * ranges[k]!.slope
            for (let l = 0; l < ranges.length; l++)
              if (l !== j && l !== k) term *= ranges[l]!.max
            second += term
          }
        return (second * (b - a) ** 2) / 8
      }
      const result = sampleCurve({
        duration: length,
        position: product,
        errorBound: bound,
        tolerance: tolerance[property],
        ...(property === 'opacity' && { projection: { apply: clamp, breaks: [0, 1] } }),
      })
      if (result.sampling.method !== 'adaptive')
        throw new RangeError('Composition sampling budget exceeded.')
      for (const offset of result.times) if (offset > 0) offsets.add(offset)
    }
    for (const offset of [...offsets].sort((a, b) => a - b))
      frames.push(frame(start + length * offset, offset === 1 ? 'left' : 'right'))
    const right = frame(end, 'right'),
      left = frames.at(-1)!
    if (right.transform !== left.transform || right.opacity !== left.opacity)
      frames.push(right)
    if (frames.length > maxKeyframes)
      throw new RangeError('Composition keyframe budget exceeded.')
  }
  return { duration, frames, transform: transform(final), opacity: String(final.opacity) }
}
