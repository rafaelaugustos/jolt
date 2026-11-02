import type { FrameScheduler, FrameTask } from './scheduler.js'
import { finite } from './value.js'
import type { PlaybackAnimation } from './types.js'
import type { SpringParams } from '../core/spring.js'
import { renderedAncestors, identityTransform } from './geometry.js'

export interface WebDragOptions {
  axis?: 'x' | 'y' | 'both'
  /** Bounds constrain direct dragging and snap destinations; springs may overshoot. */
  bounds?: { left?: number; right?: number; top?: number; bottom?: number }
  /** Per-axis snap positions; omitted axes return to the position at attachment. */
  snap?: { x?: readonly number[]; y?: readonly number[] }
  spring?: SpringParams
  disabled?: boolean
}
export interface WebDrag {
  readonly dragging: boolean
  readonly animation?: PlaybackAnimation & { readonly ready: Promise<void> }
  update(state: { disabled: boolean }): void
  /** Freeze owned translation at the current input, with no snap. */
  cancel(): void
  dispose(): void
}
export type DragPoint = { x: number; y: number }
export interface DragHost {
  scheduler: FrameScheduler
  read(): DragPoint
  begin(): void
  owns(): boolean
  write(point: DragPoint): void
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
    if (!['axis', 'bounds', 'snap', 'spring', 'disabled'].includes(key))
      throw new TypeError(`Unsupported drag option: ${key}.`)
  const axis = options.axis ?? 'both'
  if (!['x', 'y', 'both'].includes(axis)) throw new TypeError('Invalid drag axis.')
  if (options.disabled !== undefined && typeof options.disabled !== 'boolean')
    throw new TypeError('disabled must be boolean.')
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
  const snap: WebDragOptions['snap'] = {}
  for (const [key, points] of Object.entries(options.snap ?? {})) {
    if (!['x', 'y'].includes(key) || !Array.isArray(points) || !points.length)
      throw new TypeError('Snap needs nonempty x/y arrays.')
    if (axis !== 'both' && key !== axis)
      throw new TypeError('Snap positions must match the drag axis.')
    snap[key as 'x' | 'y'] = points.map((n) => finite(n, 'snap position'))
  }
  return { ...options, axis, bounds, snap, spring: { ...options.spring } }
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
    disposed = false
  let start: DragPoint = { x: 0, y: 0 },
    origin = start,
    latest = start
  let moved = false,
    suppressUntil = 0
  let samples: { x: number; y: number; time: number }[] = []
  let animation: WebDrag['animation']
  const initial = host.read()
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
  const blocked = () => {
    if (
      disabled ||
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
  const position = () => ({
    x:
      options.axis === 'y'
        ? origin.x
        : clamp(origin.x + latest.x - start.x, options.bounds.left, options.bounds.right),
    y:
      options.axis === 'x'
        ? origin.y
        : clamp(origin.y + latest.y - start.y, options.bounds.top, options.bounds.bottom),
  })
  const flush = () => {
    if (blocked() || !host.owns()) {
      cancel()
      return
    }
    host.write(position())
  }
  const releaseCapture = (id: number) => {
    if (target.hasPointerCapture(id)) target.releasePointerCapture(id)
  }
  const cancel = () => {
    if (pointer === undefined) return
    const id = pointer
    pointer = undefined
    host.scheduler.remove(task)
    try {
      host.cancel()
    } finally {
      releaseCapture(id)
      samples = []
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
    start = latest = { x: event.clientX, y: event.clientY }
    host.begin()
    pointer = event.pointerId
    moved = false
    suppressUntil = 0
    samples = []
    capture(event)
    try {
      target.setPointerCapture(pointer)
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
        animation = host.release(destination(p, speed), speed)
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
      if (pointer !== undefined && (blocked() || !host.owns())) cancel()
    },
    detach: () => dispose(false),
  }
}
