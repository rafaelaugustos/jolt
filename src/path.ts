import { parsePath } from './svg-path.js'
import { compilePath, type PathProperty } from './core/path-track.js'
export type { PathProperty } from './core/path-track.js'
import { reducedMotion, timeScale } from './config.js'
import type { Track } from './track.js'
import {
  fitTransition,
  mergeTransitions,
  resolveTransition,
  type Transition,
  type ResolvedTransition,
} from './transition.js'
import type { Keyframes, KeyframeProperty } from './types.js'

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
  let project: ReturnType<typeof compilePath> | undefined
  return {
    properties,
    starts: new Map(properties.map((property) => [property, first[property]])),
    transition,
    track(property, offset, requested) {
      project ??= compilePath(geometry, transition, {
        timeScale: timeScale(),
        reducedMotion: false,
      })
      const track = project(property, offset, requested)
      if (reducedMotion())
        return {
          ...track,
          delay: 0,
          duration: 0,
          repeat: 0,
          reverse: false,
          times: [0, 1],
          values: [track.to, track.to],
          end: 0,
          arrival: 0,
          valueAt: () => track.to,
          velocityAt: () => 0,
        }
      return track
    },
  }
}
