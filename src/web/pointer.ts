import type { WebRuntime } from './public.js'
import type { FrameScheduler, FrameTask } from './scheduler.js'
import type { WebReadableValue } from './value.js'
import type { WebSpringOptions } from './spring-value.js'
import { renderedAncestors } from './geometry.js'

export interface WebPointerOptions {
  axis?: 'x' | 'y' | 'both'
  /** Normalized [-1, 1], or viewport CSS pixels measured from the region center. */
  coordinates?: 'normalized' | 'pixels'
  /** Clamp each output. In normalized mode, map [-1, 1] to this range first. */
  range?: { x?: readonly [number, number]; y?: readonly [number, number] }
  rest?: { x?: number; y?: number }
  spring?: WebSpringOptions | false
  disabled?: boolean
}
export interface WebPointerFollow {
  readonly x: WebReadableValue
  readonly y: WebReadableValue
  readonly active: boolean
  readonly disposed: boolean
  readonly suspended: boolean
  update(state: { disabled: boolean }): void
  refresh(): void
  suspend(): void
  resume(): void
  dispose(): void
}
export interface PointerHost {
  runtime: WebRuntime
  scheduler: FrameScheduler
  reduced(): boolean
  preference(listener: () => void): () => void
  forget(): void
}

export function createPointerFollow(
  region: HTMLElement,
  input: WebPointerOptions,
  host: PointerHost,
): WebPointerFollow {
  if (!input || typeof input !== 'object')
    throw new TypeError('Expected pointer options.')
  const axis = input.axis ?? 'both',
    coordinates = input.coordinates ?? 'normalized'
  if (
    !['x', 'y', 'both'].includes(axis) ||
    !['normalized', 'pixels'].includes(coordinates)
  )
    throw new TypeError('Invalid pointer axis or coordinate mode.')
  if (input.disabled !== undefined && typeof input.disabled !== 'boolean')
    throw new TypeError('disabled must be boolean.')
  const range = {
    x: input.range?.x && [...input.range.x],
    y: input.range?.y && [...input.range.y],
  }
  const rest = { x: input.rest?.x ?? 0, y: input.rest?.y ?? 0 }
  for (const axis of ['x', 'y'] as const) {
    const bounds = range[axis]
    if (
      !Number.isFinite(rest[axis]) ||
      (bounds &&
        (bounds.length !== 2 ||
          !bounds.every(Number.isFinite) ||
          bounds[0]! >= bounds[1]! ||
          rest[axis] < bounds[0]! ||
          rest[axis] > bounds[1]!))
    )
      throw new RangeError('Pointer ranges must be finite, increasing and contain rest.')
  }
  const document = region.ownerDocument,
    view = document.defaultView! as Window & typeof globalThis
  const ancestors = () => {
    const nodes: Element[] = []
    let node: Element | null = region
    while (node) {
      nodes.push(node)
      node = node.parentElement ?? (node.getRootNode() as ShadowRoot).host ?? null
    }
    return nodes
  }
  // Coordinates describe an axis-aligned viewport rectangle. Refuse ambiguous
  // rotated/skewed/perspective input spaces rather than guessing a local point.
  const measure = () => {
    for (const node of renderedAncestors(region)) {
      const css = view.getComputedStyle(node)
      const matrix = new view.DOMMatrixReadOnly(
        css.transform === 'none' ? undefined : css.transform,
      )
      if (
        !matrix.is2D ||
        matrix.b !== 0 ||
        matrix.c !== 0 ||
        matrix.a <= 0 ||
        matrix.d <= 0 ||
        css.perspective !== 'none' ||
        (css.rotate !== 'none' && css.rotate !== '0deg') ||
        (css.scale !== 'none' && css.scale.split(/\s+/).some((n) => Number(n) <= 0))
      )
        throw new TypeError(
          'Pointer regions require positive axis-aligned transforms; use an untransformed input wrapper.',
        )
    }
    return region.getBoundingClientRect()
  }
  let rectangle = measure()
  // Spring validation and allocation are transactional, before listeners attach.
  const resources = host.runtime.scope()
  let raw: {
    x: ReturnType<WebRuntime['motionValue']>
    y: ReturnType<WebRuntime['motionValue']>
  }
  let output: { x: WebReadableValue; y: WebReadableValue }
  try {
    raw = { x: resources.motionValue(rest.x), y: resources.motionValue(rest.y) }
    output =
      input.spring === false
        ? raw
        : {
            x: resources.springValue(raw.x, { ...input.spring, initial: rest.x }),
            y: resources.springValue(raw.y, { ...input.spring, initial: rest.y }),
          }
  } catch (error) {
    resources.dispose()
    throw error
  }
  let disabled = input.disabled ?? false,
    suspended = false,
    disposed = false,
    active = false
  let dirty = false,
    latest: { x: number; y: number; id: number } | undefined
  let abort: AbortController | undefined
  let observer: MutationObserver | undefined
  let resize: ResizeObserver | undefined
  const blocked = () =>
    disabled ||
    suspended ||
    document.hidden ||
    host.reduced() ||
    [...renderedAncestors(region)].some((n) =>
      n.matches(':disabled,[inert],[aria-disabled="true"],[aria-busy="true"]'),
    )
  const reset = (immediate = false) => {
    latest = undefined
    active = false
    host.scheduler.remove(task)
    for (const axis of ['x', 'y'] as const) {
      if (!raw[axis].disposed) raw[axis].set(rest[axis])
      const follower = output[axis]
      if (immediate && !follower.disposed && 'jump' in follower)
        (follower as { jump(): void }).jump()
    }
  }
  const task: FrameTask = {
    read() {
      if (disposed) return
      if (!region.isConnected || region.ownerDocument !== document) {
        controller.dispose()
        return
      }
      if (blocked()) {
        reset(true)
        return
      }
      if (dirty) {
        dirty = false
        try {
          rectangle = measure()
        } catch (error) {
          controller.dispose()
          throw error
        }
      }
    },
    update() {
      if (disposed || !latest || blocked()) return
      if (rectangle.width <= 0 || rectangle.height <= 0) {
        reset()
        return
      }
      const point = {
        x: latest.x - rectangle.left - rectangle.width / 2,
        y: latest.y - rectangle.top - rectangle.height / 2,
      }
      if (
        Math.abs(point.x) > rectangle.width / 2 ||
        Math.abs(point.y) > rectangle.height / 2
      ) {
        reset()
        return
      }
      active = true
      for (const channel of ['x', 'y'] as const) {
        let value = point[channel]
        const bounds = range[channel]
        if (coordinates === 'normalized') {
          value /= (channel === 'x' ? rectangle.width : rectangle.height) / 2
          if (bounds) value = bounds[0]! + ((value + 1) * (bounds[1]! - bounds[0]!)) / 2
        }
        if (bounds) value = Math.max(bounds[0]!, Math.min(bounds[1]!, value))
        raw[channel].set(axis === 'both' || axis === channel ? value : rest[channel])
      }
    },
  }
  const invalidate = () => {
    if (disposed) return
    dirty = true
    host.scheduler.add(task)
  }
  const move = (event: PointerEvent) => {
    if (
      event.pointerType !== 'mouse' &&
      !(event.pointerType === 'pen' && event.buttons === 0)
    ) {
      reset()
      return
    }
    if (blocked()) {
      reset(true)
      return
    }
    latest = { x: event.clientX, y: event.clientY, id: event.pointerId }
    host.scheduler.add(task)
  }
  const leave = (event: PointerEvent) => {
    if (!latest || event.pointerId === latest.id) reset()
  }
  const visibility = () => {
    if (document.hidden) reset(true)
    else invalidate()
  }
  const detach = () => {
    abort?.abort()
    abort = undefined
    observer?.disconnect()
    observer = undefined
    resize?.disconnect()
    resize = undefined
    host.scheduler.remove(task)
  }
  const attach = () => {
    abort = new view.AbortController()
    const options = { signal: abort.signal, passive: true }
    region.addEventListener('pointermove', move, options)
    region.addEventListener('pointerenter', move, options)
    region.addEventListener('pointerleave', leave, options)
    region.addEventListener('pointercancel', leave, options)
    view.addEventListener('blur', () => reset(true), options)
    document.addEventListener('visibilitychange', visibility, options)
    document.addEventListener('scroll', invalidate, { ...options, capture: true })
    view.addEventListener('resize', invalidate, options)
    document.fonts?.addEventListener('loadingdone', invalidate, options)
    resize = new view.ResizeObserver(invalidate)
    resize.observe(region)
    observer = new view.MutationObserver(() => {
      if (!region.isConnected || region.ownerDocument !== document) controller.dispose()
      else if (blocked()) reset(true)
      else invalidate()
    })
    observer.observe(document, { childList: true, subtree: true })
    for (const node of ancestors()) {
      observer.observe(node, {
        attributes: true,
        attributeFilter: [
          'disabled',
          'aria-disabled',
          'aria-busy',
          'inert',
          'class',
          'style',
        ],
      })
      const root = node.getRootNode()
      if (root !== document) observer.observe(root, { childList: true, subtree: true })
    }
    invalidate()
  }
  const unwatch = host.preference(() => {
    if (host.reduced()) reset(true)
  })
  const controller: WebPointerFollow = {
    x: output.x,
    y: output.y,
    get active() {
      return active
    },
    get disposed() {
      return disposed
    },
    get suspended() {
      return suspended
    },
    update(state) {
      if (disposed) throw new Error('Pointer controller is disposed.')
      if (!state || typeof state.disabled !== 'boolean')
        throw new TypeError('disabled must be boolean.')
      disabled = state.disabled
      if (disabled) reset(true)
    },
    refresh: invalidate,
    suspend() {
      if (disposed || suspended) return
      suspended = true
      reset(true)
      detach()
    },
    resume() {
      if (disposed || !suspended) return
      if (!region.isConnected || region.ownerDocument !== document) {
        controller.dispose()
        return
      }
      suspended = false
      attach()
    },
    dispose() {
      if (disposed) return
      disposed = true
      detach()
      unwatch()
      try {
        resources.dispose()
      } finally {
        host.forget()
      }
    },
  }
  try {
    attach()
  } catch (error) {
    controller.dispose()
    throw error
  }
  return controller
}
