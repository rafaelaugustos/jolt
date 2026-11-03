import { toView } from '../animate.js'
import { motionScope } from '../motion-scope.js'
import { press } from '../press.js'
import type { AnimateOptions, Keyframes, Target } from '../types.js'
import type { PlaybackAnimation } from '../core/playback.js'
import type { PresetName } from '../presets.js'
import type { SpringName } from '../transition.js'
import { isDerived } from '../motion-value.js'

export type AnimateValue =
  | PresetName
  | Keyframes
  | readonly [PresetName | Keyframes, (AnimateOptions | SpringName)?]
export type PressValue = Keyframes | readonly [Keyframes, (AnimateOptions | SpringName)?]
const split = <T>(
  value: T | readonly [T, (AnimateOptions | SpringName)?],
): [T, (AnimateOptions | SpringName)?] =>
  Array.isArray(value)
    ? [value[0] as T, value[1] as AnimateOptions | SpringName]
    : [value as T]

function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (isDerived(a) || isDerived(b)) return false
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const keys = Object.keys(a)
  return (
    keys.length === Object.keys(b).length &&
    keys.every(
      (key) =>
        Object.hasOwn(b, key) &&
        same((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    )
  )
}

/** Shared native ownership; each framework only supplies mount/update/disposal. */
export function animateBinding(target: Target, initial?: AnimateValue) {
  const view = toView(target),
    scope = motionScope()
  let value = initial,
    pending = initial !== undefined,
    destroyed = false
  let current: PlaybackAnimation | undefined
  const play = () => {
    if (destroyed || !view.isLoaded || !pending) return current
    pending = false
    if (value === undefined) {
      scope.reset()
      current = undefined
    } else current = scope.animate(view, ...split<PresetName | Keyframes>(value))
    return current
  }
  const loaded = () => {
    if (!destroyed) {
      scope.resume()
      play()
    }
  }
  const unloaded = () => {
    if (!destroyed) scope.suspend()
  }
  const destroy = () => {
    if (destroyed) return
    destroyed = true
    view.off('loaded', loaded)
    view.off('unloaded', unloaded)
    scope.dispose()
  }
  view.on('loaded', loaded)
  view.on('unloaded', unloaded)
  try {
    if (view.isLoaded) play()
    else scope.suspend()
  } catch (error) {
    destroy()
    throw error
  }
  return {
    get current() {
      return current
    },
    update(next?: AnimateValue, replay = false) {
      if (destroyed) return
      if (!replay && same(value, next)) return current
      value = next
      pending = true
      return play()
    },
    destroy,
  }
}

export function pressBinding(target: Target, initial?: PressValue) {
  const view = toView(target),
    scope = motionScope()
  let destroyed = false,
    release: (() => void) | undefined
  const loaded = () => {
    if (!destroyed) scope.resume()
  }
  const unloaded = () => {
    if (!destroyed) scope.suspend()
  }
  view.on('loaded', loaded)
  view.on('unloaded', unloaded)
  if (!view.isLoaded) scope.suspend()
  let previous: PressValue | undefined
  let attached = false
  const update = (value?: PressValue) => {
    if (destroyed) return
    if (attached && same(previous, value)) return
    release?.()
    release = scope.use(() =>
      value === undefined ? press(view) : press(view, ...split<Keyframes>(value)),
    )
    previous = value
    attached = true
  }
  const destroy = () => {
    if (destroyed) return
    destroyed = true
    view.off('loaded', loaded)
    view.off('unloaded', unloaded)
    scope.dispose()
  }
  try {
    update(initial)
  } catch (error) {
    destroy()
    throw error
  }
  return {
    update,
    destroy,
  }
}
