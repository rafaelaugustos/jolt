import { sampleCurve } from '../core/sampling.js'
import { sampled, type Point } from './curve.js'
import { identity, multiplicative, properties, type Property } from './types.js'
import {
  isColor,
  isRadius,
  isShadow,
  clampPaint,
  shadowProperties,
  isTransform,
  colorCSS,
  cssName,
  radiusProperties,
  type TransformProperty,
} from './properties.js'

export type Pose = Record<TransformProperty, number> & Partial<Record<Property, number>>
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
  rotateX: 0.02,
  rotateY: 0.02,
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
  const pose: Pose = {
    x: 0,
    y: 0,
    rotate: 0,
    rotateX: 0,
    rotateY: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
  }
  const add = (property: Property, value: number) => {
    if (!isTransform(property)) pose[property] = clampPaint(property, value)
    else if (multiplicative(property)) pose[property] *= value
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
        entry.property,
      ),
    )
  pose.opacity = clamp(pose.opacity)
  if (Object.values(pose).some((v) => !Number.isFinite(v)))
    throw new RangeError('Composed motion overflowed.')
  return pose
}

export function formatPose(p: Pose, baseline: string) {
  const paint: Record<string, string> = {}
  for (const [name, value] of Object.entries(p)) {
    const property = name as Property
    if (
      value === undefined ||
      isTransform(property) ||
      isRadius(property) ||
      isShadow(property)
    )
      continue
    paint[cssName(property)] = isColor(property) ? colorCSS(value) : `${value}px`
  }
  if (shadowProperties.some((property) => p[property] !== undefined)) {
    const color = p.shadowColor ?? 0xff000000
    const alpha = ((color >>> 24) / 255) * (p.shadowOpacity ?? 0)
    paint['box-shadow'] =
      `${p.shadowOffsetX ?? 0}px ${p.shadowOffsetY ?? 0}px ${(p.shadowRadius ?? 0) * 2}px 0px rgba(${(color >>> 16) & 255}, ${(color >>> 8) & 255}, ${color & 255}, ${alpha})`
  }
  for (const radius of radiusProperties) {
    const x = p[`${radius}X`],
      y = p[`${radius}Y`]
    if (x !== undefined || y !== undefined)
      paint[cssName(radius)] = `${x ?? 0}px ${y ?? x ?? 0}px`
  }
  return {
    transform: transformPose(p, baseline),
    opacity: String(p.opacity),
    paint,
  }
}

/** Preserve the existing 2D string when both new axes are zero. CSS applies right-to-left. */
function transformPose(p: Pose, baseline: string, force3D = false) {
  const depth =
    force3D || p.rotateX || p.rotateY
      ? ` rotateY(${p.rotateY}deg) rotateX(${p.rotateX}deg)`
      : ''
  return `${baseline} translate(${p.x}px, ${p.y}px) rotate(${p.rotate}deg)${depth} scale(${p.scaleX}, ${p.scaleY})`
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
  // Keep matching transform-function lists throughout a 3D animation, including
  // zero-angle frames. Otherwise browsers interpolate a decomposed matrix.
  const force3D =
    entries.some(
      (entry) => entry.property === 'rotateX' || entry.property === 'rotateY',
    ) ||
    rest.some(
      (entry) =>
        (entry.property === 'rotateX' || entry.property === 'rotateY') &&
        entry.value !== 0,
    )
  const transform = (p: Pose) => transformPose(p, baseline, force3D)
  const frame = (t: number, side: 'left' | 'right'): Keyframe => {
    const p = poseAt(entries, rest, t, side)
    return {
      offset: duration ? t / duration : 0,
      transform: transform(p),
      opacity: p.opacity,
      // WAAPI dictionaries use IDL (camelCase) names, unlike style.setProperty.
      ...Object.fromEntries(
        Object.entries(formatPose(p, baseline).paint).map(([name, value]) => [
          name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()),
          value,
        ]),
      ),
    }
  }
  const final = poseAt(entries, rest, duration)
  if (!duration)
    return {
      duration,
      frames: [] as Keyframe[],
      transform: transform(final),
      opacity: String(final.opacity),
      paint: formatPose(final, baseline).paint,
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
        tolerance: tolerance[property]!,
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
    if (JSON.stringify(right) !== JSON.stringify(left)) frames.push(right)
    if (frames.length > maxKeyframes)
      throw new RangeError('Composition keyframe budget exceeded.')
  }
  return { duration, frames, ...formatPose(final, baseline) }
}
