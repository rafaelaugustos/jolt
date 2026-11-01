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

export interface Plan {
  property: Property
  frames: (number | null)[]
  transition: ResolvedTransition
  relative: boolean
  layer?: string
}
const allowed = new Set<string>([...properties, 'scale'])
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
    if (allowed.has(key)) {
      if (
        typeof value !== 'string' &&
        (value === null || typeof value !== 'object' || Array.isArray(value))
      )
        throw new TypeError(`Invalid transition for ${key}.`)
      overrides[key] = typeof value === 'string' ? spring(value) : (value as Transition)
    } else if (timing.has(key)) base[key] = value
    else if (!['relative', 'stagger', 'layer'].includes(key))
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
  const base = mergeTransitions(own.base, user.base)
  const overrides = hasCurve(user.base)
    ? user.overrides
    : { ...own.overrides, ...user.overrides }
  const expanded: [Property, (number | null)[]][] = []
  for (const [key, value] of Object.entries(keyframes)) {
    if (value === undefined) continue
    if (!allowed.has(key)) throw new TypeError(`Unsupported Web property "${key}".`)
    if (typeof value !== 'number' && !Array.isArray(value))
      throw new TypeError(`Invalid keyframes for ${key}.`)
    const frames =
      typeof value === 'number' ? [null, value] : ([...value] as (number | null)[])
    if (frames.length === 1) frames.unshift(null)
    if (!frames.length || frames.some((v) => v !== null && !Number.isFinite(v)))
      throw new TypeError(`Invalid keyframes for ${key}.`)
    for (const property of key === 'scale'
      ? (['scaleX', 'scaleY'] as const)
      : [key as Property]) {
      if (key === 'scale' && (keyframes as Keyframes)[property] !== undefined) continue
      expanded.push([property, frames])
    }
  }
  const seed = Math.random()
  return Array.from({ length: count }, (_, index) =>
    expanded.map(([property, frames]) => {
      const override =
        overrides[property] ??
        (property.startsWith('scale') ? overrides.scale : undefined)
      const config = fitTransition(
        override ? mergeTransitions(base, override) : base,
        frames.length,
      )
      const input = config as Record<string, unknown>
      if (config.type === 'gravity' || Object.keys(input).some((key) => !timing.has(key)))
        throw new TypeError('Only finite numeric tween/spring transitions are supported.')
      const transition = resolveTransition(config, property, frames.length)
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
        frames: [...frames],
        transition,
        relative: user.relative ?? own.relative ?? false,
        layer: user.layer ?? own.layer,
      }
    }),
  )
}
