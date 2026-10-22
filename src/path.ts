import { parsePath, type MotionPath } from './svg-path.js'
import { reducedMotion, timeScale } from './config.js'
import { createTrack, instantTrack, type Track } from './track.js'
import {
  fitTransition,
  mergeTransitions,
  resolveTransition,
  type Transition,
  type ResolvedTransition,
} from './transition.js'
import type { Keyframes, KeyframeProperty } from './types.js'

export type PathProperty = 'x' | 'y' | 'rotate'
export interface PreparedPath {
  readonly properties: readonly PathProperty[]
  readonly starts: ReadonlyMap<PathProperty, number>
  readonly transition: ResolvedTransition
  track(property: PathProperty, offset: number, delay: number): Track
}

export function preparePath(
  keyframes: Keyframes,
  base: Transition,
  overrides: Partial<Record<KeyframeProperty | 'path', Transition>>,
): PreparedPath | undefined {
  if (keyframes.orient !== undefined && typeof keyframes.orient !== 'boolean')
    throw new TypeError('Path orient must be a boolean.')
  if (keyframes.path === undefined) {
    if (keyframes.orient !== undefined) throw new TypeError('orient requires a path.')
    return undefined
  }
  if (keyframes.x !== undefined || keyframes.y !== undefined)
    throw new TypeError('A path owns x and y; omit explicit x/y keyframes.')
  if (keyframes.orient && keyframes.rotate !== undefined)
    throw new TypeError('An oriented path owns rotate; omit explicit rotate keyframes.')
  if (overrides.x || overrides.y || (keyframes.orient && overrides.rotate))
    throw new TypeError('Use the path transition to time its coordinates together.')
  const geometry = parsePath(keyframes.path)
  const orient = keyframes.orient === true
  const transition = resolveTransition(
    fitTransition(overrides.path ? mergeTransitions(base, overrides.path) : base, 2),
    'opacity',
    2,
  )
  if (
    !Number.isFinite(transition.curve.type === 'tween' ? transition.curve.duration : 0) ||
    !Number.isFinite(transition.delay)
  )
    throw new RangeError('Path duration and delay must be finite.')
  const properties: readonly PathProperty[] = orient ? ['x', 'y', 'rotate'] : ['x', 'y']
  const first = geometry.at(0)
  let motion: ReturnType<typeof sample> | undefined
  return {
    properties,
    starts: new Map(properties.map((property) => [property, first[property]])),
    transition,
    track(property, offset, requested) {
      motion ??= sample(geometry, transition, orient)
      const { progress, times, frames } = motion
      const to = geometry.at(progress.to)[property] + offset
      if (reducedMotion()) return instantTrack(property, to)
      const delay = requested / timeScale()
      const shift = delay - progress.delay
      const pose = (time: number) =>
        geometry.at(progress.valueAt(time - shift))[property] + offset
      return {
        ...progress,
        property,
        delay,
        end: progress.end + shift,
        arrival: progress.arrival + shift,
        times,
        values: offset
          ? frames[property].map((value) => value + offset)
          : frames[property],
        to,
        valueAt: pose,
        velocityAt(time) {
          if (time <= delay || time >= progress.end + shift) return 0
          const position = progress.valueAt(time - shift)
          if (position < 0 || position > 1) return 0
          const epsilon = Math.min(1e-5, 0.01 / Math.max(1, geometry.length))
          const a = Math.max(0, position - epsilon),
            b = Math.min(1, position + epsilon)
          return (
            ((geometry.at(b)[property] - geometry.at(a)[property]) / (b - a)) *
            progress.velocityAt(time - shift)
          )
        },
      }
    },
  }
}

/** Sample scalar timing once, then project all coordinates through the same path. */
function sample(geometry: MotionPath, transition: ResolvedTransition, orient: boolean) {
  const progress = createTrack('opacity', [0, 1], transition, 0)
  const count = Math.max(
    1,
    Math.min(
      6000,
      Math.max(
        Math.ceil((progress.duration / 1000) * 60),
        Math.ceil(geometry.length / 2),
      ),
    ),
  )
  const times = Array.from({ length: count + 1 }, (_, i) => i / count)
  const frames: Record<PathProperty, number[]> = { x: [], y: [], rotate: [] }
  for (const time of times) {
    const position =
      time === 0
        ? 0
        : time === 1
          ? 1
          : progress.valueAt(progress.delay + time * progress.duration)
    if (!Number.isFinite(position))
      throw new RangeError('Path easing must return finite progress.')
    const pose = geometry.at(position)
    frames.x.push(pose.x)
    frames.y.push(pose.y)
    if (orient) frames.rotate.push(pose.rotate)
  }
  return { progress, times, frames }
}
