import {
  isDecorationProperty,
  validateDecorationTarget,
  validateDecorationFrames,
} from './decoration.js'
import { playbackGroup } from './playback-group.js'
import type { PlaybackAnimation } from './playback.js'
import { preparePath, type PreparedPath } from './path.js'
import { View } from '@nativescript/core'
import {
  isColorProperty,
  parseColor,
  validateColorTarget,
  type ColorKeyframes,
} from './color.js'
import { DEFAULT_FRICTION, solveDecay } from './decay.js'
import {
  arrivalOf,
  setArrival,
  stopLayer,
  stopView,
  ViewAnimation,
  type Animation,
  type Plan,
} from './engine.js'
import { getPreset, type PresetName } from './presets.js'
import {
  asRoot,
  detachBindings,
  isMotionValue,
  type MotionValue,
  type ValueAnimationOptions,
} from './motion-value.js'
import { resolveHaptic, type Haptic } from './haptics.js'
import { layerable } from './mixer.js'
import { isProperty, precision, type Property } from './properties.js'
import {
  hasCurve,
  fitTransition,
  mergeTransitions,
  resolveTransition,
  springs,
  type SpringName,
  type Transition,
} from './transition.js'
import type {
  AnimateOptions,
  DecayOptions,
  DecayVelocity,
  Keyframes,
  KeyframeValue,
  KeyframeProperty,
  Stagger,
  Target,
  Values,
} from './types.js'

interface Options {
  base: Transition
  overrides: Partial<Record<KeyframeProperty | 'path', Transition>>
  stagger: number | Stagger | undefined
  relative: boolean | undefined
  haptic: Haptic | undefined
  layer?: string
}

/**
 * Animates one view, or several. Takes keyframes or the name of a preset,
 * and a transition or the name of a spring. A motion value animates to a number.
 *
 * ```ts
 * animate(card, 'fadeInUp')
 * animate(card, { scale: 1.1, rotate: [0, 90] }, 'bouncy')
 * animate(rows, 'fadeInUp', { stagger: 40 })
 * animate(progress, 1, 'snappy')
 * ```
 */
export function animate(
  value: MotionValue,
  to: number | readonly (number | null)[],
  transition?: ValueAnimationOptions | SpringName,
): PlaybackAnimation
export function animate(
  target: Target | readonly Target[],
  animation: Keyframes | PresetName,
  options?: AnimateOptions | SpringName,
): PlaybackAnimation
export function animate(
  target: Target | readonly Target[] | MotionValue,
  animation: Keyframes | PresetName | number | readonly (number | null)[],
  options?: AnimateOptions | SpringName,
): PlaybackAnimation | Animation {
  if (isMotionValue(target))
    return asRoot(target).animate(
      animation as number | readonly (number | null)[],
      options as ValueAnimationOptions | SpringName | undefined,
    )
  return prepareAnimation(
    target as Target | readonly Target[],
    animation as Keyframes | PresetName,
    options,
  )()
}

/** Validate and snapshot a complete animation before changing any view ownership. */
export function prepareAnimation(
  target: Target | readonly Target[],
  animation: Keyframes | PresetName,
  options?: AnimateOptions | SpringName,
): () => PlaybackAnimation {
  const { keyframes, base, overrides, stagger, relative, haptic, path, layer } = prepare(
    animation,
    options,
  )
  const feedback = resolveHaptic(haptic)

  if (!isList(target)) {
    const view = toView(target)
    for (const property of Object.keys(keyframes))
      if (isColorProperty(property)) validateColorTarget(view, property)
      else if (isDecorationProperty(property)) validateDecorationTarget(view, property)
    const plans = plan(keyframes, base, overrides, 0, relative, path, layer)
    return () => {
      if (layer === undefined)
        detachBindings(
          view,
          plans.map(({ property }) => property),
        )
      return new ViewAnimation(view, plans, feedback)
    }
  }

  const views = target.map(toView)
  for (const view of views)
    for (const property of Object.keys(keyframes))
      if (isColorProperty(property)) validateColorTarget(view, property)
      else if (isDecorationProperty(property)) validateDecorationTarget(view, property)
  const seed = Math.random()
  const plans = views.map((_, index) =>
    plan(
      keyframes,
      base,
      overrides,
      staggerDelay(stagger, index, views.length),
      relative,
      path,
      layer,
      seed,
    ),
  )
  return () =>
    playbackGroup(
      views.map((view, index) => {
        if (layer === undefined)
          detachBindings(
            view,
            plans[index]!.map(({ property }) => property),
          )
        return new ViewAnimation(view, plans[index]!, feedback, true)
      }),
    )
}

/** Starts at the current translation and slows down from a velocity in DIPs per second. */
export function decay(
  target: Target | readonly Target[],
  velocity: DecayVelocity,
  options: DecayOptions = {},
): PlaybackAnimation {
  const friction = options.friction ?? DEFAULT_FRICTION
  if (!Number.isFinite(friction) || friction <= 0 || friction >= 1) {
    throw new RangeError('Decay friction must be between 0 and 1 exclusively.')
  }

  const stops = (values: readonly number[] | undefined) => {
    if (values === undefined) return undefined
    if (
      !Array.isArray(values) ||
      values.length === 0 ||
      ![...values].every(Number.isFinite)
    ) {
      throw new RangeError('Decay snap needs a nonempty array of finite positions.')
    }
    return [...values]
  }
  const snap = options.snap
  if (
    snap !== undefined &&
    !Array.isArray(snap) &&
    (snap === null ||
      typeof snap !== 'object' ||
      Object.keys(snap).some((key) => key !== 'x' && key !== 'y'))
  ) {
    throw new TypeError('Decay snap must be an array or an object with x and y stops.')
  }
  const shared = Array.isArray(snap)
  const perAxis = snap as { x?: readonly number[]; y?: readonly number[] } | undefined
  const snapped = shared ? stops(snap) : undefined
  const snapX = shared ? snapped : stops(perAxis?.x)
  const snapY = shared ? snapped : stops(perAxis?.y)

  const plans = Object.entries(velocity).flatMap<Plan>(([property, value]) => {
    if (property !== 'x' && property !== 'y') {
      throw new Error(`Can't decay "${property}". Use x or y.`)
    }
    if (value === undefined) return []
    if (!Number.isFinite(value)) {
      throw new RangeError(`Invalid decay velocity for "${property}".`)
    }
    // Validate every axis before handing any plans to the engine.
    solveDecay(0, value, friction, precision[property])
    return [
      {
        property,
        keyframes: [null, null],
        transition: {
          curve: {
            type: 'decay',
            friction,
            velocity: value,
            snap: property === 'x' ? snapX : snapY,
          },
          delay: 0,
          repeat: 0,
          reverse: false,
        },
      },
    ]
  })
  const views = toViews(target)
  if (plans.length === 0) return playbackGroup([])
  return playbackGroup(
    views.map((view) => new ViewAnimation(view, plans, undefined, true)),
  )
}

/**
 * Stops all or selected properties at their current values. `scale` stops both axes.
 * A motion value stops where it is, and so do the views bound to it.
 */
export function stop(value: MotionValue, options?: { layer?: string }): void
export function stop(
  target: Target | readonly Target[],
  properties?: readonly KeyframeProperty[],
  options?: { layer?: string },
): void
export function stop(
  target: Target | readonly Target[] | MotionValue,
  properties?: readonly KeyframeProperty[] | { layer?: string },
  options?: { layer?: string },
) {
  if (isMotionValue(target))
    return asRoot(target).stop((properties as { layer?: string } | undefined)?.layer)
  if (properties && !Array.isArray(properties))
    throw new TypeError('View properties must be an array.')
  const expanded = (
    properties as readonly KeyframeProperty[] | undefined
  )?.flatMap<Property>((property) =>
    property === 'scale' ? ['scaleX', 'scaleY'] : [property],
  )
  for (const view of toViews(target as Target | readonly Target[]))
    if (options?.layer !== undefined) stopLayer(view, options.layer, expanded)
    else stopView(view, expanded)
}

/**
 * Applies values at once, stopping whatever animates those properties.
 * `scale` sets both axes. A view that isn't loaded yet gets them right away.
 *
 * ```ts
 * set(logo, { opacity: 1, scale: 1, y: 0 })
 * ```
 */
export function set(value: MotionValue, to: number): void
export function set(target: Target | readonly Target[], values: Values): void
export function set(
  target: Target | readonly Target[] | MotionValue,
  values: Values | number,
) {
  if (isMotionValue(target)) return asRoot(target).set(values as number)
  if (values === null || typeof values !== 'object' || Array.isArray(values))
    throw new TypeError('set() takes an object of values.')
  const keyframes: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue
    if (key !== 'scale' && !isProperty(key)) throw new Error(`Can't set "${key}".`)
    if (value === null || Array.isArray(value))
      throw new TypeError(
        `set() takes one value per property, got ${String(value)} for "${key}".`,
      )
    keyframes[key] = [value, value]
  }
  animate(target as Target | readonly Target[], keyframes as Keyframes, { duration: 0 })
}

/** Plays several animations as one: finished once they all are, and stopped together. */
export function group(animations: readonly Animation[]): Animation {
  const finished = Promise.all(animations.map((animation) => animation.finished)).then(
    (results) => results.every(Boolean),
  )
  const animation: Animation = {
    finished,
    stop: () => animations.forEach((animation) => animation.stop()),
    then: (onfulfilled, onrejected) => finished.then(onfulfilled, onrejected),
  }
  setArrival(animation, Promise.all(animations.map(arrivalOf)))
  return animation
}

export function toView(target: Target): View {
  if (target instanceof View) return target
  const view =
    (target as { nativeView?: unknown } | null)?.nativeView ??
    (target as { nativeElement?: unknown } | null)?.nativeElement
  if (view instanceof View) return view
  throw new TypeError(`Expected a NativeScript view, got ${String(target)}.`)
}

export function toViews(target: Target | readonly Target[]): View[] {
  return isList(target) ? target.map(toView) : [toView(target)]
}

function isList<T>(target: T | readonly T[]): target is readonly T[] {
  return Array.isArray(target)
}

function prepare(
  animation: Keyframes | PresetName,
  options?: AnimateOptions | SpringName,
) {
  const prepared = resolveAnimation(animation, options)
  return {
    ...prepared,
    path: preparePath(prepared.keyframes, prepared.base, prepared.overrides),
  }
}

function resolveAnimation(
  animation: Keyframes | PresetName,
  options?: AnimateOptions | SpringName,
) {
  const user = normalize(options)
  if (typeof animation !== 'string') return { keyframes: animation, ...user }

  const preset = getPreset(animation)
  const own = normalize(preset.transition)
  return {
    keyframes: preset.keyframes,
    base: mergeTransitions(own.base, user.base),
    overrides: hasCurve(user.base)
      ? user.overrides
      : { ...own.overrides, ...user.overrides },
    stagger: user.stagger ?? own.stagger,
    relative: user.relative ?? own.relative,
    haptic: user.haptic ?? own.haptic,
    layer: user.layer,
  }
}

function normalize(options: AnimateOptions | SpringName | undefined): Options {
  if (options === undefined)
    return {
      base: {},
      overrides: {},
      stagger: undefined,
      relative: undefined,
      haptic: undefined,
    }
  if (typeof options === 'string')
    return {
      base: spring(options),
      overrides: {},
      stagger: undefined,
      relative: undefined,
      haptic: undefined,
    }

  const base: Record<string, unknown> = {}
  const overrides: Options['overrides'] = {}
  let stagger: Options['stagger']
  let relative: Options['relative']
  let haptic: Options['haptic']
  let layer: Options['layer']
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined) continue
    if (key === 'layer') {
      if (typeof value !== 'string' || !value)
        throw new TypeError('A layer is named by a nonempty string.')
      layer = value
    } else if (key === 'stagger') stagger = value as Options['stagger']
    else if (key === 'relative') relative = value as Options['relative']
    else if (key === 'haptic') haptic = value as Options['haptic']
    else if (key === 'path' || key === 'scale' || isProperty(key)) {
      overrides[key] = typeof value === 'string' ? spring(value as SpringName) : value
    } else base[key] = value
  }
  return { base, overrides, stagger, relative, haptic, layer }
}

function plan(
  keyframes: Keyframes,
  base: Transition,
  overrides: Options['overrides'],
  offset: number,
  relative = false,
  path?: PreparedPath,
  layer?: string,
  seed = Math.random(),
): Plan[] {
  if (layer !== undefined && path)
    throw new Error("A path owns x and y; it can't play on a layer.")
  return expand(keyframes, path).map(([property, frames]) => {
    if (layer !== undefined && !layerable(property))
      throw new Error(
        `Layers apply to x, y, scale, rotation and opacity; "${property}" has a single owner.`,
      )
    if (path?.properties.includes(property as 'x' | 'y' | 'rotate')) {
      if (
        !Number.isFinite(path.transition.delay + offset) ||
        path.transition.delay + offset < 0
      )
        throw new RangeError(
          'Path delays, including stagger, must be finite and nonnegative.',
        )
      return {
        property,
        keyframes: frames,
        transition: { ...path.transition, delay: path.transition.delay + offset },
        relative,
        path,
      }
    }
    const override =
      overrides[property] ?? (property.startsWith('scale') ? overrides.scale : undefined)
    const transition = resolveTransition(
      fitTransition(override ? mergeTransitions(base, override) : base, frames.length),
      property,
      frames.length,
    )
    transition.delay += offset
    if (transition.seed !== undefined) transition.seed = seed
    return { property, keyframes: frames, transition, relative, layer }
  })
}

/** Each property the animation touches, with the value it starts from when it sets one. */
export function startingValues(
  animation: Keyframes | PresetName,
  options?: AnimateOptions | SpringName,
) {
  const { keyframes, relative, path, layer } = prepare(animation, options)
  if (!keyframes) throw new Error(`Unknown preset "${animation}".`)
  if (layer !== undefined)
    return new Map(expand(keyframes, path).map(([property]) => [property, null]))
  return new Map(
    expand(keyframes, path).map(([property, [first]]) => [
      property,
      relative && !isColorProperty(property) ? null : first!,
    ]),
  )
}

/** Each property the animation touches, with the value it leaves behind when that is known up front. */
export function endingValues(
  animation: Keyframes | PresetName,
  options?: AnimateOptions | SpringName,
) {
  const { keyframes, base, overrides, relative, path } = prepare(animation, options)
  return new Map(
    plan(keyframes, base, overrides, 0, relative, path).map(
      ({ property, keyframes: frames, transition, path: owned }) => {
        const finite = Number.isFinite(transition.repeat)
        const backwards = transition.reverse && finite && transition.repeat % 2 === 1
        const unknown = owned !== undefined || (relative && !isColorProperty(property))
        const frame = !finite || backwards ? frames[0] : frames.at(-1)
        return [property, unknown ? null : frame!]
      },
    ),
  )
}

function expand(
  keyframes: Keyframes,
  path?: PreparedPath,
): [Property, (number | null)[]][] {
  const expanded: [Property, (number | null)[]][] = []
  for (const [key, value] of Object.entries(keyframes)) {
    if (value === undefined || key === 'path' || key === 'orient') continue
    if (key !== 'scale' && !isProperty(key)) throw new Error(`Can't animate "${key}".`)

    const properties: Property[] = key === 'scale' ? ['scaleX', 'scaleY'] : [key]
    for (const property of properties) {
      if (key === 'scale' && keyframes[property] !== undefined) continue
      expanded.push([
        property,
        toKeyframes(property, value as KeyframeValue | ColorKeyframes),
      ])
    }
  }
  for (const [property, value] of path?.starts ?? [])
    expanded.push([property, [value, value]])
  return expanded
}

function toKeyframes(
  property: Property,
  value: KeyframeValue | ColorKeyframes,
): (number | null)[] {
  if (isColorProperty(property)) {
    const frames = Array.isArray(value) ? [...value] : [null, value]
    if (!frames.length) throw new TypeError(`Empty color keyframes for "${property}".`)
    if (frames.length === 1) frames.unshift(null)
    return frames.map((frame) => (frame === null ? null : parseColor(frame)))
  }
  if (typeof value !== 'number' && !Array.isArray(value))
    throw new TypeError(`Invalid numeric keyframes for "${property}".`)
  const frames = typeof value === 'number' ? [null, value] : [...value]
  if (frames.length === 1) frames.unshift(null)
  if (
    frames.length === 0 ||
    frames.some((frame) => frame !== null && !Number.isFinite(frame))
  ) {
    throw new Error(`Invalid keyframes for "${property}": ${JSON.stringify(value)}.`)
  }
  if (isDecorationProperty(property)) validateDecorationFrames(property, frames)
  return frames
}

function staggerDelay(stagger: Options['stagger'], index: number, count: number) {
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
  return each * Math.abs(index - origin)
}

function spring(name: SpringName): Transition {
  const transition = springs[name]
  if (!transition) throw new Error(`Unknown spring "${name}".`)
  return transition
}
