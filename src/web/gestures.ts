import { angleDelta, contactGeometry, constrain } from '../core/gesture-math.js'
import type { SpringParams } from '../core/spring.js'
import type { WebAnimation } from './public.js'
import type { WebReadableValue } from './value.js'
import { finite } from './value.js'
import { assertDragSpace } from './drag.js'
import {
  cleanupResources,
  inputBlocked,
  inputChild,
  inputEvents,
  ownStyle,
  releasePointer,
  type InteractionHost,
  type WebInteraction,
} from './interaction.js'
import { createGestureScroll, type WebGestureScrollOptions } from './gesture-scroll.js'
import type { FrameTask } from './scheduler.js'

export interface WebGesturePosition {
  x: number
  y: number
  scale: number
  rotate: number
}
export interface WebGestureBounds {
  left?: number
  right?: number
  top?: number
  bottom?: number
}
export interface WebGestureEvent extends WebGesturePosition {
  velocityX: number
  velocityY: number
  /** Focal point in viewport CSS pixels. */
  clientX: number
  clientY: number
  contacts: number
}
export interface WebGesturesOptions {
  pan?:
    | boolean
    | {
        axis?: 'x' | 'y' | 'both'
        threshold?: number
        failOffset?: number
        bounds?: WebGestureBounds | ((position: WebGesturePosition) => WebGestureBounds)
      }
  pinch?: boolean | { min?: number; max?: number }
  rotate?: boolean
  initial?: Partial<WebGesturePosition>
  spring?: SpringParams
  scroll?: WebGestureScrollOptions
  onContactStart?: (event: WebGestureEvent) => void
  onContactEnd?: (event: WebGestureEvent) => void
  onStart?: (event: WebGestureEvent) => void
  onMove?: (event: WebGestureEvent) => void
  onSettled?: (event: WebGestureEvent) => void
  onEnd?: (event: WebGestureEvent) => void
  onCancel?: (event: WebGestureEvent) => void
  onTap?: (event: WebGestureEvent) => void
  onDoubleTap?: (event: WebGestureEvent) => void
}
export interface WebGestures extends WebInteraction {
  readonly x: WebReadableValue
  readonly y: WebReadableValue
  readonly scale: WebReadableValue
  readonly rotate: WebReadableValue
  readonly position: WebGesturePosition
  readonly active: boolean
  readonly contacts: number
  settleTo(position: Partial<WebGesturePosition>): void
  jumpTo(position: Partial<WebGesturePosition>): void
  updateBounds(bounds: WebGestureBounds): void
}
const keys = ['x', 'y', 'scale', 'rotate'] as const
function readBounds(input: WebGestureBounds = {}) {
  for (const [key, value] of Object.entries(input)) {
    if (!['left', 'right', 'top', 'bottom'].includes(key))
      throw new TypeError('Unknown gesture bound.')
    finite(value, key)
  }
  const result = {
    left: input.left ?? -1e9,
    right: input.right ?? 1e9,
    top: input.top ?? -1e9,
    bottom: input.bottom ?? 1e9,
  }
  if (result.left > result.right || result.top > result.bottom)
    throw new RangeError('Gesture bounds must be ordered.')
  return result
}
export function createGestures(
  target: HTMLElement,
  options: WebGesturesOptions,
  host: InteractionHost,
): WebGestures {
  if (!options || typeof options !== 'object')
    throw new TypeError('Expected gesture options.')
  const callbacks = [
    'onContactStart',
    'onContactEnd',
    'onStart',
    'onMove',
    'onEnd',
    'onCancel',
    'onTap',
    'onDoubleTap',
    'onSettled',
  ] as const
  for (const key of Object.keys(options))
    if (
      !['pan', 'pinch', 'rotate', 'initial', 'spring', 'scroll', ...callbacks].includes(
        key,
      )
    )
      throw new TypeError(`Unknown gesture option: ${key}.`)
  for (const key of callbacks)
    if (options[key] !== undefined && typeof options[key] !== 'function')
      throw new TypeError(`${key} must be a function.`)
  for (const key of ['pan', 'pinch'] as const)
    if (
      options[key] !== undefined &&
      typeof options[key] !== 'boolean' &&
      (!options[key] || typeof options[key] !== 'object')
    )
      throw new TypeError(`Invalid ${key} options.`)
  const pan = typeof options.pan === 'object' ? options.pan : {},
    pinch = typeof options.pinch === 'object' ? options.pinch : {}
  const axis = pan.axis ?? 'both',
    threshold = pan.threshold ?? 8,
    failOffset = pan.failOffset ?? 12
  const min = pinch.min ?? 0.25,
    max = pinch.max ?? 4
  if (
    !['x', 'y', 'both'].includes(axis) ||
    ![threshold, failOffset, min, max].every((v) => Number.isFinite(v) && v > 0) ||
    min > max
  )
    throw new RangeError('Invalid gesture thresholds, axis or scale bounds.')
  let bounds = readBounds(
    typeof pan.bounds === 'function'
      ? pan.bounds({ x: 0, y: 0, scale: 1, rotate: 0, ...options.initial })
      : pan.bounds,
  )
  const initial = { x: 0, y: 0, scale: 1, rotate: 0, ...options.initial }
  for (const key of keys) finite(initial[key], key)
  if (
    initial.x < bounds.left ||
    initial.x > bounds.right ||
    initial.y < bounds.top ||
    initial.y > bounds.bottom ||
    initial.scale < min ||
    initial.scale > max
  )
    throw new RangeError('Initial gesture position must be within bounds.')
  assertDragSpace(target, true)
  if (
    options.scroll &&
    (!options.pan ||
      axis === 'both' ||
      (options.scroll.axis ?? 'y') !== axis ||
      options.pinch ||
      options.rotate ||
      typeof pan.bounds === 'function' ||
      (axis === 'y'
        ? pan.bounds?.top === undefined || pan.bounds.bottom === undefined
        : pan.bounds?.left === undefined || pan.bounds.right === undefined))
  )
    throw new TypeError(
      'Scroll coordination needs a bounded single-axis pan without pinch or rotation.',
    )
  const scroll = options.scroll
    ? createGestureScroll(target, options.scroll, host)
    : undefined
  const values = {
    x: host.motionValue(initial.x),
    y: host.motionValue(initial.y),
    scale: host.motionValue(initial.scale),
    rotate: host.motionValue(initial.rotate),
  }
  const outputs = Object.fromEntries(
    keys.map((key) => [key, values[key].to([0, 1], [0, 1], { clamp: false })]),
  ) as Record<(typeof keys)[number], WebReadableValue>
  const events = inputEvents(target),
    document = target.ownerDocument
  const touch =
    options.pinch || options.rotate || axis === 'both'
      ? 'none'
      : axis === 'x'
        ? 'pan-y'
        : 'pan-x'
  const restoreTouch = ownStyle(target, 'touch-action', touch)
  const restoreSelect = ownStyle(target, 'user-select', 'none')
  const pointers = new Map<number, { x: number; y: number }>()
  const destinations = new Map<(typeof keys)[number], number>()
  const animations = new Map<(typeof keys)[number], WebAnimation>()
  let disposed = false,
    paused = false,
    active = false,
    hadMultiple = false,
    rejected = false,
    suppressUntil = 0
  let base = initial,
    origin = contactGeometry([]),
    previous = origin,
    geometry = origin,
    rotation = 0
  let center = { x: 0, y: 0 },
    speed = { x: 0, y: 0 },
    samples: { x: number; y: number; time: number }[] = []
  let tapped: { event: WebGestureEvent; time: number } | undefined,
    cancelTap: (() => void) | undefined,
    downAt = 0
  const position = (): WebGesturePosition => ({
    x: values.x.get(),
    y: values.y.get(),
    scale: values.scale.get(),
    rotate: values.rotate.get(),
  })
  const event = (): WebGestureEvent => ({
    ...position(),
    velocityX: speed.x,
    velocityY: speed.y,
    clientX: geometry.x,
    clientY: geometry.y,
    contacts: pointers.size,
  })
  const notify = (name: (typeof callbacks)[number], data = event()) => {
    try {
      options[name]?.(data)
    } catch (error) {
      host.error(error)
    }
  }
  const stop = () => {
    for (const animation of animations.values()) animation.stop()
    animations.clear()
    destinations.clear()
    scroll?.stop()
  }
  const write = (next: Partial<WebGesturePosition>) => {
    for (const key of keys) if (next[key] !== undefined) values[key].set(next[key]!)
  }
  const clearTap = () => {
    cancelTap?.()
    cancelTap = undefined
    tapped = undefined
  }
  const allowed = () => !paused && !disposed && !inputBlocked(target, document)
  const refresh = () => {
    if (!target.isConnected || target.ownerDocument !== document) {
      handle.dispose()
      return
    }
    if (inputBlocked(target, document)) handle.cancel()
  }
  const velocity = (time: number) => {
    const first = samples[0],
      last = samples.at(-1)
    if (!first || !last || time - last.time > 80 || last.time - first.time < 8)
      return { x: 0, y: 0 }
    const seconds = (last.time - first.time) / 1000
    return {
      x: constrain((last.x - first.x) / seconds, -5000, 5000),
      y: constrain((last.y - first.y) / seconds, -5000, 5000),
    }
  }
  const sample = (time: number) => {
    const p = position(),
      last = samples.at(-1)
    if (last && time < last.time) return
    if (last?.time === time) samples.pop()
    samples.push({ x: scroll ? geometry.x : p.x, y: scroll ? geometry.y : p.y, time })
    while (samples.length > 2 && samples[1]!.time < time - 80) samples.shift()
    speed = velocity(time)
  }
  const rebase = () => {
    base = position()
    origin = previous = geometry = contactGeometry([...pointers.values()])
    rotation = 0
    const rect = target.getBoundingClientRect()
    center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    samples = []
    speed = { x: 0, y: 0 }
  }
  const flush = () => {
    if (!pointers.size || rejected) return
    if (!allowed()) {
      cancel()
      return
    }
    try {
      assertDragSpace(target, true)
    } catch (error) {
      cancel()
      host.error(error)
      return
    }
    geometry = contactGeometry([...pointers.values()])
    const dx = geometry.x - origin.x,
      dy = geometry.y - origin.y
    if (!active) {
      if (
        pointers.size === 1 &&
        axis !== 'both' &&
        Math.abs(axis === 'x' ? dy : dx) > failOffset &&
        Math.abs(axis === 'x' ? dx : dy) < threshold
      ) {
        rejected = true
        clearTap()
        return
      }
      if (
        (pointers.size > 1 && (options.pinch || options.rotate)) ||
        (options.pan &&
          Math.hypot(axis === 'y' ? 0 : dx, axis === 'x' ? 0 : dy) >= threshold)
      ) {
        active = true
        clearTap()
        notify('onStart')
        if (!allowed() || !pointers.size) return
      } else return
    }
    rotation += angleDelta(geometry.angle, previous.angle)
    const scale =
      options.pinch && pointers.size > 1 && origin.distance > 0.001
        ? constrain((base.scale * geometry.distance) / origin.distance, min, max)
        : base.scale
    const rotate =
      options.rotate && pointers.size > 1 ? base.rotate + rotation : base.rotate
    let x = base.x,
      y = base.y
    if (options.pan) {
      const ratio = scale / base.scale,
        angle = ((rotate - base.rotate) * Math.PI) / 180
      const px = origin.x - center.x - base.x,
        py = origin.y - center.y - base.y
      if (axis !== 'y')
        x = geometry.x - center.x - ratio * (px * Math.cos(angle) - py * Math.sin(angle))
      if (axis !== 'x')
        y = geometry.y - center.y - ratio * (px * Math.sin(angle) + py * Math.cos(angle))
    }
    if (scroll) {
      const axis = scroll.axis,
        delta = geometry[axis] - previous[axis]
      const next = scroll.consume(
        delta,
        values[axis].get(),
        axis === 'x' ? [bounds.left, bounds.right] : [bounds.top, bounds.bottom],
      )
      if (axis === 'x') x = next.panel
      else y = next.panel
    }
    if (typeof pan.bounds === 'function')
      bounds = readBounds(pan.bounds({ x, y, scale, rotate }))
    write({
      x: constrain(x, bounds.left, bounds.right),
      y: constrain(y, bounds.top, bounds.bottom),
      scale,
      rotate,
    })
    previous = geometry
    notify('onMove')
  }
  const task: FrameTask = { update: () => flush() }
  const cancel = () => {
    const contact = pointers.size > 0,
      wasActive = active
    const ids = [...pointers.keys()]
    pointers.clear()
    active = false
    rejected = false
    host.scheduler.remove(task)
    stop()
    clearTap()
    for (const id of ids) releasePointer(target, id)
    if (wasActive) notify('onCancel')
    if (contact) notify('onContactEnd')
    samples = []
    speed = { x: 0, y: 0 }
  }
  events.on(target, 'pointerdown', (e: PointerEvent) => {
    if (
      !allowed() ||
      e.defaultPrevented ||
      e.button !== 0 ||
      inputChild(e, target) ||
      pointers.has(e.pointerId)
    )
      return
    if (pointers.size >= 2) return
    assertDragSpace(target, true)
    if (!pointers.size) {
      stop()
      active = false
      rejected = false
      hadMultiple = false
      downAt = e.timeStamp
      suppressUntil = 0
    } else {
      flush()
      hadMultiple = true
      clearTap()
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    rebase()
    sample(e.timeStamp)
    try {
      target.setPointerCapture(e.pointerId)
    } catch (error) {
      cancel()
      host.error(error)
      return
    }
    if (pointers.size === 1) {
      scroll?.begin(e)
      notify('onContactStart')
    }
  })
  events.on(
    events.view,
    'pointermove',
    (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return
      if (e.pointerType === 'mouse' && !(e.buttons & 1)) {
        cancel()
        return
      }
      for (const point of [...(e.getCoalescedEvents?.() ?? []), e]) {
        pointers.set(e.pointerId, { x: point.clientX, y: point.clientY })
        // Sample input deltas without adding a second render scheduler.
        geometry = contactGeometry([...pointers.values()])
      }
      host.scheduler.add(task)
    },
    true,
    true,
  )
  events.on(
    events.view,
    'pointerup',
    (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      flush()
      if (!pointers.has(e.pointerId)) return
      speed = velocity(e.timeStamp)
      pointers.delete(e.pointerId)
      releasePointer(target, e.pointerId)
      if (pointers.size) {
        rebase()
        return
      }
      host.scheduler.remove(task)
      const wasActive = active
      active = false
      if (wasActive) {
        suppressUntil = events.view.performance.now() + 500
        if (scroll) {
          const axis = scroll.axis
          scroll.release(
            speed[axis],
            () => values[axis].get(),
            () =>
              axis === 'x' ? [bounds.left, bounds.right] : [bounds.top, bounds.bottom],
            (next) => values[axis].set(next),
          )
        }
        notify('onEnd')
      } else if (!hadMultiple && !rejected && e.timeStamp - downAt < 400) {
        const data = event(),
          now = host.scheduler.now()
        if (options.onDoubleTap) {
          if (
            tapped &&
            now - tapped.time < 300 &&
            Math.hypot(
              data.clientX - tapped.event.clientX,
              data.clientY - tapped.event.clientY,
            ) < 24
          ) {
            clearTap()
            notify('onDoubleTap', data)
          } else {
            if (tapped) notify('onTap', tapped.event)
            clearTap()
            tapped = { event: data, time: now }
            cancelTap = host.after(300, () => {
              const pending = tapped
              clearTap()
              if (pending && allowed()) notify('onTap', pending.event)
            })
          }
        } else notify('onTap', data)
      }
      notify('onContactEnd')
      samples = []
    },
    true,
    true,
  )
  // Record the actual input timestamp after each frame's position update.
  let latestTime = 0
  events.on(
    events.view,
    'pointermove',
    (e: PointerEvent) => {
      if (pointers.has(e.pointerId)) latestTime = e.timeStamp
    },
    true,
    true,
  )
  task.update = () => {
    flush()
    if (pointers.size) sample(latestTime)
  }
  for (const type of ['pointercancel', 'lostpointercapture'])
    events.on(
      events.view,
      type,
      (e: PointerEvent) => {
        if (pointers.has(e.pointerId)) cancel()
      },
      true,
      true,
    )
  events.on(events.view, 'blur', cancel)
  events.on(events.view, 'resize', cancel)
  events.on(document, 'visibilitychange', () => {
    if (document.hidden) cancel()
  })
  events.on(target, 'dragstart', (e) => e.preventDefault(), false)
  events.on(
    target,
    'click',
    (e: MouseEvent) => {
      if (e.detail > 0 && events.view.performance.now() < suppressUntil) {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    },
    false,
    true,
  )
  const validatePosition = (input: Partial<WebGesturePosition>) => {
    if (!input || typeof input !== 'object')
      throw new TypeError('Expected a gesture position.')
    for (const [key, value] of Object.entries(input)) {
      if (!keys.includes(key as (typeof keys)[number]))
        throw new TypeError('Unknown gesture channel.')
      finite(value, key)
    }
    const next = { ...position(), ...input }
    if (
      next.x < bounds.left ||
      next.x > bounds.right ||
      next.y < bounds.top ||
      next.y > bounds.bottom ||
      next.scale < min ||
      next.scale > max
    )
      throw new RangeError('Gesture position must be inside bounds.')
    return next
  }
  const handle: WebGestures = {
    ...outputs,
    get position() {
      return position()
    },
    get active() {
      return active
    },
    get contacts() {
      return pointers.size
    },
    get paused() {
      return paused
    },
    get disposed() {
      return disposed
    },
    settleTo(input) {
      if (disposed) return
      const next = validatePosition(input),
        velocity = { ...speed }
      cancel()
      if (host.reduced()) {
        write(next)
        notify('onSettled')
        return
      }
      for (const key of keys)
        if (input[key] !== undefined) {
          const animation = host.animate(values[key], next[key], {
            type: 'spring',
            ...options.spring,
            velocity: key === 'x' ? velocity.x : key === 'y' ? velocity.y : 0,
          })
          destinations.set(key, next[key])
          animations.set(key, animation)
          if (paused) animation.pause()
          void animation.finished.then(() => {
            if (animations.get(key) === animation) {
              animations.delete(key)
              destinations.delete(key)
              if (!animations.size && !disposed) notify('onSettled')
            }
          })
        }
    },
    jumpTo(input) {
      if (disposed) return
      const next = validatePosition(input)
      stop()
      write(next)
      if (pointers.size) rebase()
    },
    updateBounds(input) {
      if (disposed) return
      bounds = readBounds(input)
      const p = position()
      write({
        x: constrain(p.x, bounds.left, bounds.right),
        y: constrain(p.y, bounds.top, bounds.bottom),
      })
      if (pointers.size) rebase()
    },
    cancel,
    pause() {
      if (disposed || paused) return
      if (pointers.size) cancel()
      clearTap()
      scroll?.stop()
      paused = true
      for (const animation of animations.values()) animation.pause()
    },
    play() {
      if (disposed || !paused) return
      paused = false
      for (const animation of animations.values()) animation.play()
    },
    dispose() {
      if (disposed) return
      disposed = true
      cleanupResources([
        cancel,
        () => events.dispose(),
        restoreTouch,
        restoreSelect,
        unregister,
        removePreference,
        ...Object.values(outputs).map((value) => () => value.dispose()),
        ...Object.values(values).map((value) => () => value.dispose()),
      ])
    },
  }
  const removePreference = host.onReduced(() => {
    if (!host.reduced() || disposed) return
    const next = Object.fromEntries(destinations)
    stop()
    write(next)
    if (Object.keys(next).length) notify('onSettled')
  })
  const unregister = host.register(target, handle, refresh)
  return handle
}
