import { createTrack as compileTrack, type Track } from './core/track.js'
import { isColorProperty } from './core/color.js'
import type { Property } from './core/properties.js'
import type { ResolvedTransition } from './core/transition.js'
import { reducedMotion, timeScale } from './config.js'

export { instantTrack, type Track } from './core/track.js'

/** Resolve native preferences at the boundary; all curve compilation is portable. */
export function createTrack(
  property: Property,
  keyframes: readonly number[],
  transition: ResolvedTransition,
  velocity: number,
): Track {
  return compileTrack(property, keyframes, transition, velocity, {
    timeScale: timeScale(),
    // Opacity and colors preserve their existing accessibility behavior and do not
    // initialize a native driver just to read a preference they do not use.
    reducedMotion:
      property !== 'opacity' && !isColorProperty(property) && reducedMotion(),
  })
}
