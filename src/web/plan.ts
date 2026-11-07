import { parsePath, type MotionPath } from '../core/svg-path.js'
import { resolveHaptic } from '../core/haptic.js'
import {
  fitTransition,
  hasCurve,
  mergeTransitions,
  resolveTransition,
  springs,
  type ResolvedTransition,
} from '../core/transition.js'
import {
  properties,
  type AnimateOptions,
  type Keyframes,
  type Preset,
  type Property,
  type SpringName,
  type Stagger,
  type Transition,
} from './types.js'
import {
  coreProperty,
  expand,
  isTransform,
  keyframeProperties,
  type KeyframeProperty,
  type Scalar,
} from './properties.js'

export interface Plan {
  /** Internal rig constraint; applied to every sample before WAAPI compilation. */
  range?: readonly [number, number]
  property: Property
  path?: MotionPath
  frames: (Scalar | null)[]
  source: KeyframeProperty
  transition: ResolvedTransition
  relative: boolean
  layer?: string
}
const allowed = new Set<string>(keyframeProperties)
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
  'acceleration',
  'restitution',
  'delay',
  'repeat',
  'repeatType',
  'repeatDelay',
])

function spring(name: string): Transition {
  if (!Object.hasOwn(springs, name)) throw new TypeError(`Unknown spring "${name}".`)
  return { ...springs[name as SpringName] }
}
function normalize(options?: AnimateOptions | SpringName) {
  const base: Record<string, unknown> = {}
  const overrides: Partial<Record<string, Transition>> = {}
  if (typeof options === 'string')
    return {
      base: spring(options),
      overrides,
      relative: undefined,
      stagger: undefined,
      layer: undefined,
    }
  if (options != null && (typeof options !== 'object' || Array.isArray(options)))
    throw new TypeError('Animation options must be an object or spring name.')
  for (const [key, value] of Object.entries(options ?? {})) {
    if (value === undefined) continue
    if (allowed.has(key) || key === 'path') {
      if (
        typeof value !== 'string' &&
        (value === null || typeof value !== 'object' || Array.isArray(value))
      )
        throw new TypeError(`Invalid transition for ${key}.`)
      overrides[key] = typeof value === 'string' ? spring(value) : (value as Transition)
    } else if (timing.has(key)) base[key] = value
    else if (!['relative', 'stagger', 'layer', 'haptic'].includes(key))
      throw new TypeError(`Unsupported Web option "${key}".`)
  }
  if (options?.relative !== undefined && typeof options.relative !== 'boolean')
    throw new TypeError('relative must be boolean.')
  if (
    options?.layer !== undefined &&
    (typeof options.layer !== 'string' || !options.layer)
  )
    throw new TypeError('A layer needs a nonempty name.')
  if (options?.layer?.startsWith('jolt:press:'))
    throw new TypeError('The jolt:press: layer namespace is reserved for press feedback.')
  return {
    base: base as Transition,
    overrides,
    relative: options?.relative,
    stagger: options?.stagger,
    layer: options?.layer,
  }
}

function staggerDelay(
  stagger: number | Stagger | undefined,
  index: number,
  count: number,
) {
  if (stagger === undefined) return 0
  const { each, from = 'first' } =
    typeof stagger === 'number' ? { each: stagger } : stagger
  const origin =
    from === 'first'
      ? 0
      : from === 'last'
        ? count - 1
        : from === 'center'
          ? (count - 1) / 2
          : from
  if (
    !Number.isFinite(each) ||
    each < 0 ||
    !Number.isFinite(origin) ||
    typeof origin !== 'number'
  )
    throw new RangeError('Stagger requires finite nonnegative each and a valid origin.')
  return each * Math.abs(index - origin)
}

export function prepare(
  animation: Keyframes | string,
  options: AnimateOptions | SpringName | undefined,
  presets: ReadonlyMap<string, Preset>,
  count: number,
): Plan[][] {
  const preset = typeof animation === 'string' ? presets.get(animation) : undefined
  if (typeof animation === 'string' && !preset)
    throw new TypeError(`Unknown or unsupported Web preset "${animation}".`)
  const keyframes = preset?.keyframes ?? animation
  if (keyframes === null || typeof keyframes !== 'object' || Array.isArray(keyframes))
    throw new TypeError('Expected numeric keyframes.')
  const own = normalize(preset?.transition),
    user = normalize(options)
  resolveHaptic(typeof options === 'object' ? options.haptic : undefined)
  resolveHaptic(preset?.transition?.haptic)
  const base = mergeTransitions(own.base, user.base)
  const overrides = hasCurve(user.base)
    ? user.overrides
    : { ...own.overrides, ...user.overrides }
  if (keyframes.orient !== undefined && typeof keyframes.orient !== 'boolean')
    throw new TypeError('Path orient must be a boolean.')
  if (keyframes.orient !== undefined && keyframes.path === undefined)
    throw new TypeError('orient requires a path.')
  const geometry = keyframes.path === undefined ? undefined : parsePath(keyframes.path)
  if (geometry) {
    if (
      keyframes.x !== undefined ||
      keyframes.y !== undefined ||
      (keyframes.orient && keyframes.rotate !== undefined)
    )
      throw new TypeError('A path owns x/y and an oriented path also owns rotate.')
    if (overrides.x || overrides.y || (keyframes.orient && overrides.rotate))
      throw new TypeError('Use the path transition to time its coordinates together.')
    if ((user.layer ?? own.layer) !== undefined)
      throw new TypeError('Paths own base coordinates and cannot use a named layer.')
  }
  const pathProperties: Property[] = geometry
    ? keyframes.orient
      ? ['x', 'y', 'rotate']
      : ['x', 'y']
    : []
  const expanded: [Property, (Scalar | null)[], KeyframeProperty][] = []
  if (geometry)
    for (const property of pathProperties) {
      const axis = property as 'x' | 'y' | 'rotate'
      expanded.push([property, [geometry.at(0)[axis], geometry.at(1)[axis]], property])
    }
  for (const [key, value] of Object.entries(keyframes)) {
    if (key === 'path' || key === 'orient') continue
    if (value === undefined) continue
    if (!allowed.has(key)) throw new TypeError(`Unsupported Web property "${key}".`)
    if (typeof value !== 'number' && typeof value !== 'string' && !Array.isArray(value))
      throw new TypeError(`Invalid keyframes for ${key}.`)
    const frames = !Array.isArray(value)
      ? [null, value as Scalar]
      : ([...value] as (Scalar | null)[])
    if (frames.length === 1) frames.unshift(null)
    if (
      !frames.length ||
      frames.some(
        (v) =>
          v !== null &&
          (typeof v === 'number'
            ? !Number.isFinite(v)
            : typeof v !== 'string' || !v.trim()),
      )
    )
      throw new TypeError(`Invalid keyframes for ${key}.`)
    for (const property of expand(key as KeyframeProperty)) {
      if (key !== property && (keyframes as Keyframes)[property] !== undefined) continue
      if (
        key === 'borderRadius' &&
        keyframes[property.slice(0, -1) as KeyframeProperty] !== undefined
      )
        continue
      if (isTransform(property) && frames.some((v) => typeof v === 'string'))
        throw new TypeError(`${property} requires numeric keyframes.`)
      expanded.push([property, frames, key as KeyframeProperty])
    }
  }
  const seed = Math.random()
  return Array.from({ length: count }, (_, index) =>
    expanded.map(([property, frames, source]) => {
      const path = pathProperties.includes(property) ? geometry : undefined
      const override = path ? overrides.path : (overrides[property] ?? overrides[source])
      const config = fitTransition(
        override ? mergeTransitions(base, override) : base,
        frames.length,
      )
      const input = config as Record<string, unknown>
      if (Object.keys(input).some((key) => !timing.has(key)))
        throw new TypeError('Unsupported Web transition option.')
      const transition = resolveTransition(
        config,
        path ? 'opacity' : coreProperty(property),
        frames.length,
      )
      if ((user.layer ?? own.layer) !== undefined && !isTransform(property))
        throw new TypeError(
          'Named layers compose transforms and opacity; paint properties have independent base ownership.',
        )
      transition.delay += staggerDelay(user.stagger ?? own.stagger, index, count)
      if (
        !Number.isFinite(transition.delay) ||
        !Number.isSafeInteger(transition.repeat) ||
        transition.repeat < 0 ||
        transition.repeat > 1000
      )
        throw new RangeError(
          'Web playback requires a finite delay and 0–1000 integer repeats.',
        )
      if (
        transition.curve.type === 'tween' &&
        !Number.isFinite(transition.curve.duration)
      )
        throw new RangeError('Web playback requires a finite duration.')
      if (transition.seed !== undefined) transition.seed = seed
      return {
        property,
        path,
        source,
        frames: [...frames],
        transition,
        relative: user.relative ?? own.relative ?? false,
        layer: user.layer ?? own.layer,
      }
    }),
  )
}
