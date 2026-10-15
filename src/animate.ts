import { View } from '@nativescript/core'
import { DEFAULT_FRICTION, solveDecay } from './decay.js'
import {
  arrivalOf,
  setArrival,
  stopView,
  ViewAnimation,
  type Animation,
  type Plan,
} from './engine.js'
import { getPreset, type PresetName } from './presets.js'
import { resolveHaptic, type Haptic } from './haptics.js'
import { isProperty, precision, type Property } from './properties.js'
import {
  hasCurve,
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
  Stagger,
  Target,
} from './types.js'

interface Options {
  base: Transition
  overrides: Partial<Record<keyof Keyframes, Transition>>
  stagger: number | Stagger | undefined
  relative: boolean | undefined
  haptic: Haptic | undefined
}

/**
 * Animates one view, or several. Takes keyframes or the name of a preset,
 * and a transition or the name of a spring.
 *
 * ```ts
 * animate(card, 'fadeInUp')
 * animate(card, { scale: 1.1, rotate: [0, 90] }, 'bouncy')
 * animate(rows, 'fadeInUp', { stagger: 40 })
 * ```
 */
export function animate(
  target: Target | readonly Target[],
  animation: Keyframes | PresetName,
  options?: AnimateOptions | SpringName,
): Animation {
  const { keyframes, base, overrides, stagger, relative, haptic } = prepare(
    animation,
    options,
  )
  const feedback = resolveHaptic(haptic)

  if (!isList(target)) {
    return new ViewAnimation(
      toView(target),
      plan(keyframes, base, overrides, 0, relative),
      feedback,
    )
  }

  const views = target.map(toView)
  return group(
    views.map(
      (view, index) =>
        new ViewAnimation(
          view,
          plan(
            keyframes,
            base,
            overrides,
            staggerDelay(stagger, index, views.length),
            relative,
          ),
          feedback,
        ),
    ),
  )
}

/** Starts at the current translation and slows down from a velocity in DIPs per second. */
export function decay(
  target: Target | readonly Target[],
  velocity: DecayVelocity,
  options: DecayOptions = {},
): Animation {
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
  if (plans.length === 0) return group([])
  return group(views.map((view) => new ViewAnimation(view, plans)))
}

/** Stops all or selected properties at their current values. `scale` stops both axes. */
export function stop(
  target: Target | readonly Target[],
  properties?: readonly (keyof Keyframes)[],
) {
  const expanded = properties?.flatMap<Property>((property) =>
    property === 'scale' ? ['scaleX', 'scaleY'] : [property],
  )
  for (const view of toViews(target)) stopView(view, expanded)
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
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined) continue
    if (key === 'stagger') stagger = value as Options['stagger']
    else if (key === 'relative') relative = value as Options['relative']
    else if (key === 'haptic') haptic = value as Options['haptic']
    else if (key === 'scale' || isProperty(key)) {
      overrides[key] = typeof value === 'string' ? spring(value as SpringName) : value
    } else base[key] = value
  }
  return { base, overrides, stagger, relative, haptic }
}

function plan(
  keyframes: Keyframes,
  base: Transition,
  overrides: Options['overrides'],
  offset: number,
  relative = false,
): Plan[] {
  return expand(keyframes).map(([property, frames]) => {
    const override =
      overrides[property] ?? (property.startsWith('scale') ? overrides.scale : undefined)
    const transition = resolveTransition(
      override ? mergeTransitions(base, override) : base,
      property,
      frames.length,
    )
    transition.delay += offset
    return { property, keyframes: frames, transition, relative }
  })
}

/** Each property the animation touches, with the value it starts from when it sets one. */
export function startingValues(
  animation: Keyframes | PresetName,
  options?: AnimateOptions | SpringName,
) {
  const { keyframes, relative } = prepare(animation, options)
  if (!keyframes) throw new Error(`Unknown preset "${animation}".`)
  return new Map(
    expand(keyframes).map(([property, [first]]) => [property, relative ? null : first!]),
  )
}

function expand(keyframes: Keyframes): [Property, (number | null)[]][] {
  const expanded: [Property, (number | null)[]][] = []
  for (const [key, value] of Object.entries(keyframes) as [
    keyof Keyframes,
    KeyframeValue | undefined,
  ][]) {
    if (value === undefined) continue
    if (key !== 'scale' && !isProperty(key)) throw new Error(`Can't animate "${key}".`)

    const properties: Property[] = key === 'scale' ? ['scaleX', 'scaleY'] : [key]
    for (const property of properties) {
      if (key === 'scale' && keyframes[property] !== undefined) continue
      expanded.push([property, toKeyframes(property, value)])
    }
  }
  return expanded
}

function toKeyframes(property: Property, value: KeyframeValue): (number | null)[] {
  const frames = typeof value === 'number' ? [null, value] : [...value]
  if (frames.length === 1) frames.unshift(null)
  if (
    frames.length === 0 ||
    frames.some((frame) => frame !== null && !Number.isFinite(frame))
  ) {
    throw new Error(`Invalid keyframes for "${property}": ${JSON.stringify(value)}.`)
  }
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
