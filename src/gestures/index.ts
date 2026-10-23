import { Application, GridLayout, ScrollView, Trace, isAndroid } from '@nativescript/core'
import {
  createGestureDriver,
  type GestureDriver,
  type GestureSettings,
} from '../gesture-native.js'
import {
  motionValue,
  springValue,
  type DerivedValue,
  type SpringValueOptions,
} from '../motion-value.js'

/** A GridLayout that provides native gesture dispatch and nested-scroll consumption. */
export class GestureSurface extends GridLayout {
  override createNativeView() {
    if (isAndroid) {
      if (typeof org.rafaelaugusto.jolt.GestureSurface !== 'function')
        throw new Error('Rebuild the native app to use GestureSurface.')
      return new org.rafaelaugusto.jolt.GestureSurface(this._context)
    }
    return super.createNativeView()
  }
}
export interface GesturePosition {
  x: number
  y: number
  scale: number
  rotate: number
}
export interface GestureEvent extends GesturePosition {
  velocityX: number
  velocityY: number
}
export interface GestureBounds {
  left?: number
  right?: number
  top?: number
  bottom?: number
}
export interface GesturesOptions {
  pan?:
    | boolean
    | {
        axis?: 'x' | 'y' | 'both'
        threshold?: number
        failOffset?: number
        bounds?: GestureBounds
      }
  pinch?: boolean | { min?: number; max?: number }
  rotate?: boolean
  initial?: Partial<GesturePosition>
  spring?: Pick<SpringValueOptions, 'stiffness' | 'damping' | 'mass'>
  /** A descendant, vertical NativeScript ScrollView. Other list plugins are not supported. */
  scrollView?: ScrollView
  /** First contact, before pan recognition; useful when a touch interrupts a spring. */
  onContactStart?: (event: GestureEvent) => void
  /** Last contact released or cancelled, including a touch that never becomes a pan. */
  onContactEnd?: (event: GestureEvent) => void
  onStart?: (event: GestureEvent) => void
  onEnd?: (event: GestureEvent) => void
  onCancel?: (event: GestureEvent) => void
  onTap?: (event: GestureEvent) => void
  onDoubleTap?: (event: GestureEvent) => void
}
export interface Gestures {
  readonly x: DerivedValue
  readonly y: DerivedValue
  readonly scale: DerivedValue
  readonly rotate: DerivedValue
  readonly position: GesturePosition
  readonly active: boolean
  readonly paused: boolean
  readonly disposed: boolean
  /** Spring toward a new position, carrying the last contact's velocity. */
  settleTo(position: Partial<GesturePosition>): void
  jumpTo(position: Partial<GesturePosition>): void
  updateBounds(bounds: GestureBounds): void
  cancel(): void
  pause(): void
  play(): void
  dispose(): void
}
const owners = new WeakMap<GestureSurface, Gestures>()
const LIMIT = 1e9
function bounds(input: GestureBounds = {}) {
  if (!input || typeof input !== 'object')
    throw new TypeError('Gesture bounds must be an object.')
  const result = {
    minX: input.left ?? -LIMIT,
    maxX: input.right ?? LIMIT,
    minY: input.top ?? -LIMIT,
    maxY: input.bottom ?? LIMIT,
  }
  if (
    Object.values(result).some((value) => !Number.isFinite(value)) ||
    result.minX > result.maxX ||
    result.minY > result.maxY
  )
    throw new RangeError('Gesture bounds must be finite and ordered.')
  return result
}
function settings(options: GesturesOptions): GestureSettings {
  for (const key of ['pan', 'pinch'] as const)
    if (
      options[key] !== undefined &&
      typeof options[key] !== 'boolean' &&
      (!options[key] || typeof options[key] !== 'object')
    )
      throw new TypeError(`Gesture ${key} must be boolean or an options object.`)
  if (options.rotate !== undefined && typeof options.rotate !== 'boolean')
    throw new TypeError('Gesture rotate must be boolean.')
  for (const key of [
    'onStart',
    'onEnd',
    'onCancel',
    'onTap',
    'onDoubleTap',
    'onContactStart',
    'onContactEnd',
  ] as const)
    if (options[key] !== undefined && typeof options[key] !== 'function')
      throw new TypeError(`Gesture ${key} must be a function.`)
  const pan = typeof options.pan === 'object' ? options.pan : {}
  const pinch = typeof options.pinch === 'object' ? options.pinch : {}
  const axis = pan.axis ?? 'both'
  if (!['x', 'y', 'both'].includes(axis))
    throw new TypeError('Gesture pan axis must be x, y or both.')
  const result = {
    ...bounds(pan.bounds),
    axis: options.pan ? (axis === 'x' ? 1 : axis === 'y' ? 2 : 3) : 0,
    threshold: pan.threshold ?? 8,
    failOffset: pan.failOffset ?? 12,
    pinch: !!options.pinch,
    rotate: !!options.rotate,
    tap: !!options.onTap,
    doubleTap: !!options.onDoubleTap,
    contactEvents: !!(options.onContactStart || options.onContactEnd),
    minScale: pinch.min ?? 0.25,
    maxScale: pinch.max ?? 4,
  }
  if (
    ![result.threshold, result.failOffset, result.minScale, result.maxScale].every(
      (value) => Number.isFinite(value) && value > 0,
    ) ||
    result.minScale > result.maxScale
  )
    throw new RangeError(
      'Gesture thresholds and scale limits must be positive and ordered.',
    )
  if (
    options.scrollView &&
    (!(options.scrollView instanceof ScrollView) ||
      options.scrollView.orientation !== 'vertical' ||
      result.axis !== 2)
  )
    throw new TypeError('Scroll handoff needs a vertical ScrollView and a y-axis pan.')
  if (
    options.scrollView &&
    (pan.bounds?.top === undefined || pan.bounds?.bottom === undefined)
  )
    throw new TypeError('Scroll handoff needs explicit top and bottom pan bounds.')
  return result
}

/** Compose native pan/pinch/rotation and exclusive single/double taps on one surface. */
export function gestures(
  surface: GestureSurface,
  options: GesturesOptions = {},
): Gestures {
  if (!(surface instanceof GestureSurface))
    throw new TypeError('gestures() requires a GestureSurface.')
  if (!options || typeof options !== 'object')
    throw new TypeError('Gesture options must be an object.')
  let config = settings(options)
  if (options.scrollView) {
    let ancestor = options.scrollView.parent
    while (ancestor && ancestor !== surface) ancestor = ancestor.parent
    if (ancestor !== surface)
      throw new TypeError('The ScrollView must be inside the GestureSurface.')
  }
  const initial = { x: 0, y: 0, scale: 1, rotate: 0, ...options.initial }
  if (Object.values(initial).some((value) => !Number.isFinite(value)))
    throw new RangeError('Initial gesture values must be finite.')
  if (
    initial.x < config.minX ||
    initial.x > config.maxX ||
    initial.y < config.minY ||
    initial.y > config.maxY ||
    initial.scale < config.minScale ||
    initial.scale > config.maxScale
  )
    throw new RangeError('Initial gesture values must be within their bounds.')
  const keys = ['x', 'y', 'scale', 'rotate'] as const
  const values = keys.map((key) => springValue(motionValue(initial[key]), options.spring))
  let driver: GestureDriver | undefined,
    ended = false,
    held = false,
    suspended = false,
    disposing = false
  const position = (): GesturePosition => ({
    x: values[0]!.get(),
    y: values[1]!.get(),
    scale: values[2]!.get(),
    rotate: values[3]!.get(),
  })
  const callback = (state: number, velocityX: number, velocityY: number) => {
    if (ended) return
    const event = { ...position(), velocityX, velocityY }
    const handler = [
      undefined,
      options.onStart,
      options.onEnd,
      options.onCancel,
      options.onTap,
      options.onDoubleTap,
      options.onContactStart,
      options.onContactEnd,
    ][state]
    try {
      handler?.(event)
    } catch (error) {
      Trace.write(
        `Jolt gesture callback failed: ${String(error)}`,
        Trace.categories.Error,
        Trace.messageType.error,
      )
    }
  }
  const detach = () => {
    const previous = driver
    driver = undefined
    previous?.dispose()
  }
  const refreshEnabled = () =>
    driver?.enabled(
      !held &&
        !suspended &&
        surface.isEnabled !== false &&
        surface.isUserInteractionEnabled !== false,
    )
  const attach = () => {
    if (
      ended ||
      driver ||
      !surface.isLoaded ||
      !surface.nativeViewProtected ||
      (options.scrollView && !options.scrollView.nativeViewProtected)
    )
      return
    try {
      driver = createGestureDriver(surface, options.scrollView, values, config, callback)
      refreshEnabled()
    } catch (error) {
      control.dispose()
      throw error
    }
  }
  const suspend = () => {
    suspended = true
    driver?.enabled(false)
  }
  const resume = () => {
    suspended = false
    refreshEnabled()
  }
  const move = (next: Partial<GesturePosition>, animated: boolean) => {
    if (ended) return
    if (
      !next ||
      typeof next !== 'object' ||
      Object.entries(next).some(
        ([key, value]) =>
          !keys.includes(key as (typeof keys)[number]) || !Number.isFinite(value),
      )
    )
      throw new TypeError(
        'Gesture positions must contain finite x, y, scale or rotate values.',
      )
    if (!driver)
      throw new Error('Load the GestureSurface before moving its gesture values.')
    const target = { ...position(), ...next }
    driver.settle(
      keys.map((key) => target[key]),
      animated,
    )
  }
  const control: Gestures = {
    x: values[0]!,
    y: values[1]!,
    scale: values[2]!,
    rotate: values[3]!,
    get position() {
      return position()
    },
    get active() {
      return driver?.active ?? false
    },
    get paused() {
      return held
    },
    get disposed() {
      return ended
    },
    settleTo: (next) => move(next, true),
    jumpTo: (next) => move(next, false),
    updateBounds(next) {
      config = {
        ...config,
        ...bounds({
          left: config.minX,
          right: config.maxX,
          top: config.minY,
          bottom: config.maxY,
          ...next,
        }),
      }
      driver?.bounds(config)
    },
    cancel() {
      driver?.cancel()
    },
    pause() {
      held = true
      driver?.enabled(false)
    },
    play() {
      held = false
      refreshEnabled()
    },
    dispose() {
      if (ended || disposing) return
      disposing = true
      detach()
      ended = true
      surface.off('loaded', attach)
      surface.off('unloaded', detach)
      surface.off('isEnabledChange', refreshEnabled)
      surface.off('isUserInteractionEnabledChange', refreshEnabled)
      options.scrollView?.off('loaded', attach)
      options.scrollView?.off('unloaded', detach)
      Application.off(Application.suspendEvent, suspend)
      Application.off(Application.resumeEvent, resume)
      values.forEach((value) => value.dispose())
      if (owners.get(surface) === control) owners.delete(surface)
    },
  }
  owners.get(surface)?.dispose()
  owners.set(surface, control)
  surface.on('loaded', attach)
  surface.on('unloaded', detach)
  surface.on('isEnabledChange', refreshEnabled)
  surface.on('isUserInteractionEnabledChange', refreshEnabled)
  options.scrollView?.on('loaded', attach)
  options.scrollView?.on('unloaded', detach)
  Application.on(Application.suspendEvent, suspend)
  Application.on(Application.resumeEvent, resume)
  try {
    attach()
  } catch (error) {
    control.dispose()
    throw error
  }
  return control
}
