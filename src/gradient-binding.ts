import { parseColor, type ColorValue } from './color.js'
import { reducedMotion } from './config.js'
import {
  isDerived,
  valueSource,
  type DerivedValue,
  type DerivedColor,
} from './motion-value.js'
import type { GradientFrame } from './gradient.js'

export interface GradientBindings {
  colors?: readonly (ColorValue | DerivedColor)[]
  stops?: readonly (number | DerivedValue)[]
  angle?: number | DerivedValue
  center?: { readonly x?: number | DerivedValue; readonly y?: number | DerivedValue }
  radius?: number | DerivedValue
}

export type GradientComponent =
  'angle' | 'x' | 'y' | 'radius' | `color:${number}` | `stop:${number}`
export type GradientSource = ReturnType<typeof valueSource>
export type GradientComponentValue = number | GradientSource
export type GradientPatch = Map<GradientComponent, GradientComponentValue>

export function cloneFrame(frame: GradientFrame): GradientFrame {
  return { ...frame, colors: [...frame.colors], stops: [...frame.stops] }
}

export function put(frame: GradientFrame, key: GradientComponent, value: number) {
  if (key.startsWith('color:')) frame.colors[Number(key.slice(6))] = value
  else if (key.startsWith('stop:')) frame.stops[Number(key.slice(5))] = value
  else frame[key as 'angle' | 'x' | 'y' | 'radius'] = value
}

export function take(frame: GradientFrame, key: GradientComponent) {
  if (key.startsWith('color:')) return frame.colors[Number(key.slice(6))]!
  if (key.startsWith('stop:')) return frame.stops[Number(key.slice(5))]!
  return frame[key as 'angle' | 'x' | 'y' | 'radius']
}

/** Validate structural/static inputs before touching any existing owner. */
export function gradientPatch(values: GradientBindings, count: number): GradientPatch {
  if (!values || typeof values !== 'object' || Array.isArray(values))
    throw new TypeError('Gradient values must be an object.')
  const patch: GradientPatch = new Map()
  const add = (key: GradientComponent, value: unknown, color = false) => {
    if (value === undefined) return
    if (isDerived(value)) patch.set(key, valueSource(value, color))
    else if (color) patch.set(key, parseColor(value as ColorValue))
    else {
      if (typeof value !== 'number' || !Number.isFinite(value))
        throw new RangeError(`Invalid gradient ${key}: ${String(value)}.`)
      if (key === 'radius' && value < 0)
        throw new RangeError('Gradient radius must not be negative.')
      if (key.startsWith('stop:') && (value < 0 || value > 1))
        throw new RangeError('Gradient stops must be from 0 to 1.')
      patch.set(key, value)
    }
  }
  if (values.colors !== undefined) {
    if (
      !Array.isArray(values.colors) ||
      values.colors.length < 2 ||
      values.colors.length > 8
    )
      throw new RangeError('A gradient needs between two and eight colors.')
    count = values.colors.length
    Array.from(values.colors).forEach((value, i) => {
      if (value === undefined) throw new TypeError('Gradient colors cannot be empty.')
      add(`color:${i}`, value, true)
    })
  }
  if (values.stops !== undefined) {
    if (!Array.isArray(values.stops) || values.stops.length !== count)
      throw new RangeError('Gradient stops need one value per color.')
    Array.from(values.stops).forEach((value, i) => {
      if (value === undefined) throw new TypeError('Gradient stops cannot be empty.')
      add(`stop:${i}`, value)
    })
    if (
      values.stops.every((value) => typeof value === 'number') &&
      values.stops.some((value, i) => i > 0 && value < (values.stops![i - 1] as number))
    )
      throw new RangeError('Gradient stops must be ordered without going back.')
  } else if (values.colors !== undefined) {
    // Preserve the concrete API's rule: replacing colors resets unspecified stops.
    values.colors.forEach((_, i) => patch.set(`stop:${i}`, i / (count - 1)))
  }
  add('angle', values.angle)
  if (
    values.center !== undefined &&
    (!values.center || typeof values.center !== 'object')
  )
    throw new TypeError('Gradient center needs x/y components.')
  add('x', values.center?.x)
  add('y', values.center?.y)
  add('radius', values.radius)
  return patch
}

export interface GradientBase {
  at(delta: number): GradientFrame
  remaining: number
  elapsed(): number
}

/** Native windows share a source clock. Only setup/commands/window boundaries enter JS. */
export function gradientProgram(base: GradientBase, bindings: GradientPatch) {
  const roots = new Map<object, ReturnType<GradientSource['snapshot']>>()
  for (const value of bindings.values())
    if (typeof value !== 'number' && !roots.has(value.identity))
      roots.set(value.identity, value.snapshot())
  const moving = [...roots.values()].filter((state) => state.running)
  const remaining = Math.max(
    base.remaining,
    ...moving.map((state) => state.track.end - state.elapsed),
    0,
  )
  const duration = Math.min(4000, remaining)
  const anchor = moving[0]
  const elapsed = anchor
    ? () => Math.max(0, anchor.time() - anchor.elapsed)
    : base.elapsed
  const reduced = reducedMotion()
  const at = (delta: number) => {
    const frame = cloneFrame(base.at(delta))
    for (const [key, source] of bindings) {
      if (typeof source === 'number') {
        put(frame, key, source)
        continue
      }
      const state = roots.get(source.identity)!
      const geometry = key === 'angle' || key === 'x' || key === 'y' || key === 'radius'
      const input =
        reduced && geometry && state.running
          ? state.track.to
          : state.running
            ? state.track.valueAt(state.elapsed + delta)
            : state.value
      const value = source.read(input)
      if (!Number.isFinite(value))
        throw new RangeError(`Nonfinite gradient binding: ${key}.`)
      put(frame, key, value)
    }
    // Project the complete vector without sorting colors. Spring overshoot may
    // merge adjacent stops; their identity and order are retained.
    frame.radius = Math.max(0, frame.radius)
    frame.stops = frame.stops.map((stop) => Math.min(1, Math.max(0, stop)))
    for (let i = 1; i < frame.stops.length; i++)
      frame.stops[i] = Math.max(frame.stops[i - 1]!, frame.stops[i]!)
    return frame
  }
  const current = at(0)
  const steps = Math.max(1, Math.ceil((duration * 60) / 1000))
  const times = Array.from({ length: steps + 1 }, (_, i) => i / steps)
  const frames = times.map((time) => at(time * duration))
  return { current, frames, times, duration, remaining, elapsed, at }
}
