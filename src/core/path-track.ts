import type { MotionPath } from './svg-path.js'
import {
  createTrack,
  instantTrack,
  type CompilationSettings,
  type Track,
} from './track.js'
import type { ResolvedTransition } from './transition.js'

export type PathProperty = 'x' | 'y' | 'rotate'

/** Compile timing once for all coordinates. Geometry is in the caller's local units. */
export function compilePath(
  geometry: MotionPath,
  transition: ResolvedTransition,
  settings: Readonly<CompilationSettings>,
) {
  const progress = createTrack('opacity', [0, 1], transition, 0, settings)
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
  // Include timing knots as well as geometry samples: short holds and loop seams
  // must survive projection, even when they fall between two uniform samples.
  const times = [
    ...new Set([
      ...progress.times,
      ...Array.from({ length: count + 1 }, (_, i) => i / count),
    ]),
  ].sort((a, b) => a - b)
  const poses = times.map((t) => {
    const position =
      t === 0
        ? progress.values[0]!
        : t === 1
          ? progress.values.at(-1)!
          : progress.valueAt(progress.delay + t * progress.duration)
    if (!Number.isFinite(position))
      throw new RangeError('Path easing must return finite progress.')
    return geometry.at(position)
  })
  return (
    property: PathProperty,
    offset: number,
    requestedDelay = transition.delay,
  ): Track => {
    const to = geometry.at(progress.to)[property] + offset
    if (settings.reducedMotion) return instantTrack(property, to)
    const delay = requestedDelay / settings.timeScale
    const shift = delay - progress.delay
    return {
      ...progress,
      property,
      delay,
      end: progress.end + shift,
      arrival: progress.arrival + shift,
      times,
      values: poses.map((pose) => pose[property] + offset),
      to,
      valueAt: (time) => geometry.at(progress.valueAt(time - shift))[property] + offset,
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
  }
}
