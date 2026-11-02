import {
  createTrack,
  instantTrack,
  type Track,
  type CompilationSettings,
} from '../core/track.js'
import {
  resolveTransition,
  springs,
  type Transition,
  type SpringName,
} from '../core/transition.js'

export type WebValueAnimationOptions = Transition & { layer?: string }
const timing = new Set([
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
  'repeat',
  'repeatType',
  'repeatDelay',
  'acceleration',
  'restitution',
  'layer',
])
export function valuePlan(options: WebValueAnimationOptions | SpringName = {}) {
  if (typeof options === 'string') {
    if (!Object.hasOwn(springs, options)) throw new TypeError('Unknown spring.')
    options = springs[options]
  }
  if (
    !options ||
    typeof options !== 'object' ||
    Array.isArray(options) ||
    Object.keys(options).some((k) => !timing.has(k))
  )
    throw new TypeError('Motion value options describe one numeric track.')
  if (
    options.layer !== undefined &&
    (typeof options.layer !== 'string' ||
      !options.layer ||
      options.layer.startsWith('jolt:'))
  )
    throw new TypeError('A value layer requires a nonempty, nonreserved name.')
  return { ...options }
}
/** Use the native value's range-relative precision, on the shared trajectory compiler. */
export function valueTrack(
  frames: number | readonly (number | null)[],
  options: WebValueAnimationOptions,
  from: number,
  velocity: number,
  settings: CompilationSettings,
): Track {
  if (typeof frames !== 'number' && !Array.isArray(frames))
    throw new TypeError('Expected numeric keyframes.')
  const values = (typeof frames === 'number' ? [null, frames] : [...frames]).map((v) =>
    v === null ? from : v,
  )
  if (values.length < 2) values.unshift(from)
  if (values.some((v) => typeof v !== 'number' || !Number.isFinite(v)))
    throw new TypeError('Expected finite numeric keyframes.')
  const transition = resolveTransition(options, 'x', values.length)
  if (transition.curve.type === 'gravity')
    return createTrack('x', values, transition, velocity, settings)
  const base = Math.min(...values),
    span = Math.max(...values) - base
  if (!span) return instantTrack('opacity', values.at(-1)!)
  const track = createTrack(
    'opacity',
    values.map((v) => (v - base) / span),
    transition,
    velocity / span,
    settings,
  )
  return {
    ...track,
    values: track.values.map((v) => base + span * v),
    to: base + span * track.to,
    valueAt: (time) => base + span * track.valueAt(time),
    velocityAt: (time) => span * track.velocityAt(time),
  }
}
