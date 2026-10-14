import { View } from '@nativescript/core'
import {
  arrivalOf,
  setArrival,
  stopView,
  ViewAnimation,
  type Animation,
  type Plan,
} from './engine.js'
import { getPreset, type PresetName } from './presets.js'
import { isProperty, type Property } from './properties.js'
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
  Keyframes,
  KeyframeValue,
  Stagger,
  Target,
} from './types.js'

interface Options {
  base: Transition
  overrides: Partial<Record<keyof Keyframes, Transition>>
  stagger: number | Stagger | undefined
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
  const { keyframes, base, overrides, stagger } = prepare(animation, options)

  if (!isList(target)) {
    return new ViewAnimation(toView(target), plan(keyframes, base, overrides, 0))
  }

  const views = target.map(toView)
  return group(
    views.map(
      (view, index) =>
        new ViewAnimation(
          view,
          plan(keyframes, base, overrides, staggerDelay(stagger, index, views.length)),
        ),
    ),
  )
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
  }
}

function normalize(options: AnimateOptions | SpringName | undefined): Options {
  if (options === undefined) return { base: {}, overrides: {}, stagger: undefined }
  if (typeof options === 'string')
    return { base: spring(options), overrides: {}, stagger: undefined }

  const base: Record<string, unknown> = {}
  const overrides: Options['overrides'] = {}
  let stagger: Options['stagger']
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined) continue
    if (key === 'stagger') stagger = value as Options['stagger']
    else if (key === 'scale' || isProperty(key)) {
      overrides[key] = typeof value === 'string' ? spring(value as SpringName) : value
    } else base[key] = value
  }
  return { base, overrides, stagger }
}

function plan(
  keyframes: Keyframes,
  base: Transition,
  overrides: Options['overrides'],
  offset: number,
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
    return { property, keyframes: frames, transition }
  })
}

/** Each property the animation touches, with the value it starts from when it sets one. */
export function startingValues(animation: Keyframes | PresetName) {
  const keyframes =
    typeof animation === 'string' ? getPreset(animation).keyframes : animation
  if (!keyframes) throw new Error(`Unknown preset "${animation}".`)
  return new Map(expand(keyframes).map(([property, [first]]) => [property, first!]))
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
