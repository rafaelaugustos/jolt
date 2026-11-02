import type { FrameScheduler, FrameTask } from './scheduler.js'
import { finite, type WebMotionValue } from './value.js'
import { DEFAULT_FRICTION } from '../core/decay.js'
import {
  resistDrag,
  resumeDrag,
  dragDestination,
  type DragCurve,
} from '../core/drag-physics.js'
import type { Plan } from './plan.js'
import type { PlaybackAnimation } from './types.js'
import type { SpringParams } from '../core/spring.js'
import { renderedAncestors, identityTransform } from './geometry.js'

export interface WebDragOptions {
  axis?: 'x' | 'y' | 'both'
  /** Bounds constrain direct dragging and snap destinations; springs may overshoot. */
  bounds?: { left?: number; right?: number; top?: number; bottom?: number }
  /** Per-axis snap positions; omitted axes return to the position at attachment. */
  snap?: readonly number[] | { x?: readonly number[]; y?: readonly number[] }
  spring?: SpringParams
  disabled?: boolean
  /** Existing spring-return behavior is retained; decay uses the native drag solver. */
  release?: 'spring' | 'decay'
  friction?: number
  rubberband?: boolean
  /** Drive a borrowed numeric value instead of the input element's translation. */
  value?: WebMotionValue
  onStart?: (event: WebDragEvent) => void
  onMove?: (event: WebDragEvent) => void
  onRelease?: (event: WebDragRelease) => void
  onCancel?: (event: WebDragEvent) => void
  onSettle?: (event: WebDragEvent) => void
}
export interface WebDragEvent {
  x: number
  y: number
  velocity: DragPoint
}
export interface WebDragRelease extends WebDragEvent {
  target: DragPoint
  animation: NonNullable<WebDrag['animation']>
}
export interface WebDrag {
  readonly dragging: boolean
  readonly settling: boolean
  readonly paused: boolean
  readonly disposed: boolean
  readonly position: DragPoint
  readonly animation?: PlaybackAnimation & { readonly ready: Promise<void> }
  update(state: { disabled: boolean }): void
  /** Freeze owned translation at the current input, with no snap. */
  cancel(): void
  pause(): void
  play(): void
  dispose(): void
}
export type DragPoint = { x: number; y: number }
export interface DragHost {
  scheduler: FrameScheduler
  error(error: unknown): void
  read(): DragPoint
  begin(): void
  owns(): boolean
  write(point: DragPoint, velocity: DragPoint): void
  release(point: DragPoint, velocity: DragPoint): NonNullable<WebDrag['animation']>
  cancel(): void
  dispose(): void
  validate(): void
}
const clamp = (n: number, min = -Infinity, max = Infinity) =>
  Math.min(max, Math.max(min, n))

export function dragOptions(options: WebDragOptions) {
  if (!options || typeof options !== 'object')
    throw new TypeError('Expected drag options.')
  for (const key of Object.keys(options))
    if (
      ![
        'axis',
        'bounds',
        'snap',
        'spring',
        'disabled',
        'release',
        'friction',
        'rubberband',
        'value',
        'onStart',
        'onMove',
        'onRelease',
        'onCancel',
        'onSettle',
      ].includes(key)
    )
      throw new TypeError(`Unsupported drag option: ${key}.`)
  const axis = options.axis ?? 'both'
  if (!['x', 'y', 'both'].includes(axis)) throw new TypeError('Invalid drag axis.')
  if (options.disabled !== undefined && typeof options.disabled !== 'boolean')
    throw new TypeError('disabled must be boolean.')
  if (options.release !== undefined && !['spring', 'decay'].includes(options.release))
    throw new TypeError('Invalid drag release mode.')
  const friction = options.friction ?? DEFAULT_FRICTION
  if (!Number.isFinite(friction) || friction <= 0 || friction >= 1)
    throw new RangeError('Drag friction must be between zero and one exclusively.')
  if (options.rubberband !== undefined && typeof options.rubberband !== 'boolean')
    throw new TypeError('rubberband must be boolean.')
  if (options.value && axis === 'both')
    throw new TypeError('A value drag requires one axis.')
  for (const name of ['onStart', 'onMove', 'onRelease', 'onCancel', 'onSettle'] as const)
    if (options[name] !== undefined && typeof options[name] !== 'function')
      throw new TypeError(`${name} must be a function.`)
  const bounds = { ...options.bounds }
  for (const [key, value] of Object.entries(bounds)) {
    if (!['left', 'right', 'top', 'bottom'].includes(key))
      throw new TypeError('Invalid drag bound.')
    finite(value, key)
  }
  if (
    (bounds.left ?? -Infinity) > (bounds.right ?? Infinity) ||
    (bounds.top ?? -Infinity) > (bounds.bottom ?? Infinity)
  )
    throw new RangeError('Drag bounds must be ordered.')
  const snap: { x?: readonly number[]; y?: readonly number[] } = {}
  const inputSnap = Array.isArray(options.snap)
    ? Object.fromEntries(
        (axis === 'both' ? ['x', 'y'] : [axis]).map((a) => [a, options.snap]),
      )
    : options.snap
  for (const [key, points] of Object.entries(inputSnap ?? {})) {
    if (!['x', 'y'].includes(key) || !Array.isArray(points) || !points.length)
      throw new TypeError('Snap needs nonempty x/y arrays.')
    if (axis !== 'both' && key !== axis)
      throw new TypeError('Snap positions must match the drag axis.')
    snap[key as 'x' | 'y'] = points.map((n) => finite(n, 'snap position'))
  }
  for (const key of ['x', 'y'] as const) {
    const min = bounds[key === 'x' ? 'left' : 'top'] ?? -Infinity
    const max = bounds[key === 'x' ? 'right' : 'bottom'] ?? Infinity
    if (snap[key]?.some((n) => n < min || n > max))
      throw new RangeError('Snap positions must be inside drag bounds.')
  }
  return { ...options, axis, bounds, snap, friction, spring: { ...options.spring } }
}

export function dragCurve(
  config: ReturnType<typeof dragOptions>,
  axis: 'x' | 'y',
  velocity: number,
): DragCurve {
  return {
    type: 'drag',
    velocity,
    friction: config.friction,
    bounds: [
      config.bounds[axis === 'x' ? 'left' : 'top'] ?? -Infinity,
      config.bounds[axis === 'x' ? 'right' : 'bottom'] ?? Infinity,
    ],
    snap: config.snap[axis],
    rubberband: config.rubberband ?? false,
  }
}
export function dragPlans(
  config: ReturnType<typeof dragOptions>,
  velocity: DragPoint,
): Plan[] {
  const axes: ('x' | 'y')[] = config.axis === 'both' ? ['x', 'y'] : [config.axis]
  return axes.map((property) => ({
    property,
    source: property,
    frames: [null, null],
    relative: false,
    transition: {
      curve: dragCurve(config, property, velocity[property]),
      delay: 0,
      repeat: 0,
      reverse: false,
    },
  }))
}

/** Validate only ancestors participating in this rendered coordinate space. */
export function assertDragSpace(target: HTMLElement, baselineIdentity: boolean) {
  if (!baselineIdentity)
    throw new TypeError('Drag requires an identity static CSS transform baseline.')
  const view = target.ownerDocument.defaultView!
  for (const node of renderedAncestors(target)) {
    const css = view.getComputedStyle(node)
    if (
      (css.zoom && css.zoom !== '1' && css.zoom !== 'normal') ||
      css.perspective !== 'none' ||
      (node !== target && !identityTransform(node, css))
    )
      throw new TypeError(
        'Drag does not support transformed or zoomed ancestors inside its rendered coordinate root. Use an untransformed drag surface inside a modal dialog/popover, or remove the affecting transform.',
      )
  }
}

export function createDrag(target: HTMLElement, input: WebDragOptions, host: DragHost) {
  const options = dragOptions(input)
  const document = target.ownerDocument
  const view = document.defaultView! as Window & typeof globalThis
  const abort = new view.AbortController()
  const originalTouch = target.style.touchAction
  const touch = options.axis === 'x' ? 'pan-y' : options.axis === 'y' ? 'pan-x' : 'none'
  target.style.touchAction = touch
  let pointer: number | undefined,
    disabled = options.disabled ?? false,
    disposed = false,
    paused = false,
    settling = false
  let start: DragPoint = { x: 0, y: 0 },
    origin = start,
    latest = start
  let moved = false,
    suppressUntil = 0
  let samples: { x: number; y: number; time: number }[] = []
  let animation: WebDrag['animation']
  const initial = host.read()
  let resistance = { x: 200, y: 200 }
  const notify = (
    name: 'onStart' | 'onMove' | 'onCancel' | 'onSettle',
    speed = { x: 0, y: 0 },
  ) => {
    try {
      options[name]?.({ ...host.read(), velocity: speed })
    } catch (error) {
      host.error(error)
    }
  }
  const task: FrameTask = {
    read: () => {
      if (pointer !== undefined) {
        try {
          host.validate()
        } catch (error) {
          cancel()
          throw error
        }
      }
    },
    update: () => {
      if (pointer !== undefined) flush()
    },
  }
  const blocked = (includePaused = true) => {
    if (
      disabled ||
      (includePaused && paused) ||
      disposed ||
      !target.isConnected ||
      target.ownerDocument !== document ||
      target.matches(':disabled')
    )
      return true
    for (const node of renderedAncestors(target)) {
      if (
        node.hasAttribute('inert') ||
        node.getAttribute('aria-disabled') === 'true' ||
        node.getAttribute('aria-busy') === 'true'
      )
        return true
    }
    return false
  }
  const position = (): DragPoint => {
    const axis = (key: 'x' | 'y') => {
      if ((key === 'x' && options.axis === 'y') || (key === 'y' && options.axis === 'x'))
        return origin[key]
      const value = origin[key] + latest[key] - start[key]
      const bounds = dragCurve(options, key, 0).bounds
      return options.rubberband
        ? resistDrag(value, bounds, resistance[key])
        : clamp(value, ...bounds)
    }
    return { x: axis('x'), y: axis('y') }
  }
  const flush = () => {
    if (blocked() || !host.owns()) {
      cancel()
      return
    }
    host.write(position(), velocity(samples.at(-1)?.time ?? 0))
    notify('onMove', velocity(samples.at(-1)?.time ?? 0))
  }
  const releaseCapture = (id: number) => {
    if (target.hasPointerCapture(id)) target.releasePointerCapture(id)
  }
  const stopRelease = () => {
    const current = animation
    animation = undefined
    settling = false
    current?.stop()
  }
  const cancel = () => {
    const wasSettling = settling
    stopRelease()
    if (pointer === undefined) {
      if (wasSettling) notify('onCancel')
      return
    }
    const id = pointer
    pointer = undefined
    host.scheduler.remove(task)
    try {
      host.cancel()
    } finally {
      releaseCapture(id)
      samples = []
      notify('onCancel')
    }
  }
  const capture = (event: PointerEvent) => {
    latest = { x: event.clientX, y: event.clientY }
    moved ||= Math.hypot(latest.x - start.x, latest.y - start.y) > 3
    const p = position(),
      time = event.timeStamp
    const previous = samples.at(-1)
    if (!Number.isFinite(time) || (previous && time < previous.time)) return
    if (previous?.time === time) samples.pop()
    samples.push({ ...p, time })
    while (samples.length > 2 && samples[1]!.time < time - 80) samples.shift()
  }
  const velocity = (at: number) => {
    const first = samples[0],
      last = samples.at(-1)
    if (!first || !last || at - last.time > 80 || last.time - first.time < 8)
      return { x: 0, y: 0 }
    const dt = (last.time - first.time) / 1000
    return {
      x: clamp((last.x - first.x) / dt, -5000, 5000),
      y: clamp((last.y - first.y) / dt, -5000, 5000),
    }
  }
  const destination = (p: DragPoint, speed: DragPoint): DragPoint => {
    if (options.release === 'decay')
      return {
        x: dragDestination(p.x, dragCurve(options, 'x', speed.x)),
        y: dragDestination(p.y, dragCurve(options, 'y', speed.y)),
      }
    const snap = (axis: 'x' | 'y') => {
      const points = options.snap[axis] ?? [initial[axis]]
      const projected = p[axis] + speed[axis] * 0.15
      return points.reduce((best, n) =>
        Math.abs(n - projected) < Math.abs(best - projected) ? n : best,
      )
    }
    return {
      x: clamp(snap('x'), options.bounds.left, options.bounds.right),
      y: clamp(snap('y'), options.bounds.top, options.bounds.bottom),
    }
  }
  const listen = <E extends Event>(
    node: EventTarget,
    type: string,
    action: (event: E) => void,
    passive = true,
    captureEvent = false,
  ) =>
    node.addEventListener(type, action as EventListener, {
      signal: abort.signal,
      passive,
      capture: captureEvent,
    })
  listen(target, 'pointerdown', (event: PointerEvent) => {
    if (
      disposed ||
      pointer !== undefined ||
      blocked() ||
      event.defaultPrevented ||
      !event.isPrimary ||
      event.button !== 0
    )
      return
    for (const node of event.composedPath()) {
      if (node === target) break
      if (
        node instanceof view.Element &&
        node.matches(
          'button, a[href], input, select, textarea, [contenteditable], [role="button"]',
        )
      )
        return
    }
    host.validate()
    origin = host.read()
    stopRelease()
    if (options.rubberband)
      for (const axis of ['x', 'y'] as const) {
        const next = resumeDrag(
          origin[axis],
          dragCurve(options, axis, 0).bounds,
          Math.max(1, target[axis === 'x' ? 'clientWidth' : 'clientHeight']),
        )
        origin[axis] = next.origin
        resistance[axis] = next.length
      }
    start = latest = { x: event.clientX, y: event.clientY }
    host.begin()
    pointer = event.pointerId
    moved = false
    suppressUntil = 0
    samples = []
    capture(event)
    try {
      target.setPointerCapture(pointer)
      notify('onStart')
    } catch (error) {
      cancel()
      throw error
    }
  })
  listen(
    view,
    'pointermove',
    (event: PointerEvent) => {
      if (event.pointerId !== pointer) return
      if (!(event.buttons & 1)) {
        cancel()
        return
      }
      for (const sample of event.getCoalescedEvents?.() ?? []) capture(sample)
      capture(event)
      host.scheduler.add(task)
    },
    true,
    true,
  )
  listen(
    view,
    'pointerup',
    (event: PointerEvent) => {
      if (event.pointerId !== pointer) return
      const speed = velocity(event.timeStamp)
      capture(event)
      flush()
      if (pointer === undefined) return
      const p = position(),
        id = pointer
      pointer = undefined
      host.scheduler.remove(task)
      if (moved) {
        suppressUntil = view.performance.now() + 500
        const to = destination(p, speed)
        try {
          const current = (animation = host.release(to, speed))
          settling = true
          void current.finished.then((result) => {
            if (animation !== current || disposed) return
            settling = false
            notify(result ? 'onSettle' : 'onCancel')
          }, host.error)
          try {
            options.onRelease?.({ ...p, velocity: speed, target: to, animation: current })
          } catch (error) {
            host.error(error)
          }
        } finally {
          releaseCapture(id)
          samples = []
        }
      } else host.cancel()
      releaseCapture(id)
      samples = []
    },
    true,
    true,
  )
  for (const type of ['pointercancel', 'lostpointercapture'])
    listen(
      view,
      type,
      (event: PointerEvent) => {
        if (event.pointerId === pointer) cancel()
      },
      true,
      true,
    )
  listen(view, 'blur', cancel)
  listen(view, 'resize', cancel)
  listen(document, 'visibilitychange', () => {
    if (document.hidden) cancel()
  })
  listen(view, 'scroll', cancel, true, true)
  let scrollRoot: Node | undefined
  const watchRoot = () => {
    const root = target.getRootNode()
    if (root === scrollRoot) return
    scrollRoot?.removeEventListener('scroll', cancel, true)
    scrollRoot = root
    if (root !== document)
      root.addEventListener('scroll', cancel, { capture: true, passive: true })
  }
  watchRoot()
  listen(
    target,
    'dragstart',
    (event) => {
      if (pointer !== undefined) event.preventDefault()
    },
    false,
  )
  listen(
    target,
    'click',
    (event: MouseEvent) => {
      if (event.detail > 0 && view.performance.now() < suppressUntil) {
        event.preventDefault()
        event.stopImmediatePropagation()
        suppressUntil = 0
      }
    },
    false,
    true,
  )
  const dispose = (stopAnimation = true) => {
    if (disposed) return
    if (!stopAnimation) animation = undefined
    cancel()
    disposed = true
    abort.abort()
    host.scheduler.remove(task)
    scrollRoot?.removeEventListener('scroll', cancel, true)
    scrollRoot = undefined
    if (stopAnimation && target.isConnected && target.ownerDocument === document)
      animation?.stop()
    if (target.style.touchAction === touch) target.style.touchAction = originalTouch
    host.dispose()
  }
  return {
    handle: {
      get dragging() {
        return pointer !== undefined
      },
      get settling() {
        return settling
      },
      get paused() {
        return paused
      },
      get disposed() {
        return disposed
      },
      get position() {
        return host.read()
      },
      pause() {
        if (disposed || paused) return
        if (pointer !== undefined) cancel()
        paused = true
        animation?.pause()
      },
      play() {
        if (disposed || !paused) return
        paused = false
        animation?.play()
      },
      get animation() {
        return animation
      },
      update(state: { disabled: boolean }) {
        if (disposed) throw new Error('The drag binding is disposed.')
        if (!state || typeof state.disabled !== 'boolean')
          throw new TypeError('disabled must be boolean.')
        disabled = state.disabled
        if (disabled) cancel()
      },
      cancel,
      dispose: () => dispose(),
    } satisfies WebDrag,
    refresh: () => {
      watchRoot()
      if (!target.isConnected || target.ownerDocument !== document) {
        dispose()
        return
      }
      if ((pointer !== undefined || settling) && blocked(false)) cancel()
      if (pointer !== undefined && !host.owns()) cancel()
    },
    detach: () => dispose(!!options.value),
  }
}
