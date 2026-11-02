import { constrain } from '../core/gesture-math.js'
import type { WebGestures, WebGestureEvent } from './gestures.js'
import {
  cleanupResources,
  inputBlocked,
  inputEvents,
  ownAttribute,
  ownStyle,
  type InteractionHost,
  type WebInteraction,
} from './interaction.js'
import type { WebBinding } from './value.js'
import type { FrameTask } from './scheduler.js'

export interface WebZoomState {
  x: number
  y: number
  scale: number
  progress: number
  pending: boolean
}
export interface WebPhotoDismissal {
  readonly state: Readonly<WebZoomState>
  readonly velocity: number
  cancel(): boolean
  complete(): boolean
}
export interface WebZoomableOptions {
  viewport?: HTMLElement
  scale?: readonly [number, number]
  doubleTap?: number
  dismiss?: 'vertical' | false
  backdrop?: HTMLElement
  chrome?: HTMLElement
  onDismiss?: (intent: WebPhotoDismissal) => void
  onSettled?: (state: Readonly<WebZoomState>) => void
  onError?: (error: Error) => void
}
export interface WebZoomable extends WebInteraction {
  readonly ready: boolean
  readonly error: Error | undefined
  readonly state: Readonly<WebZoomState>
  /** Viewport-local CSS coordinates. Browser page zoom remains browser-owned. */
  zoomTo(scale: number, focus?: { x: number; y: number }, animated?: boolean): void
  reset(animated?: boolean): void
  requestDismiss(): void
  cancelDismiss(): void
  remeasure(): void
}
export function createZoomable(
  image: HTMLImageElement,
  options: WebZoomableOptions,
  host: InteractionHost,
): WebZoomable {
  const document = image.ownerDocument,
    view = document.defaultView! as Window & typeof globalThis
  if (!(image instanceof view.HTMLImageElement))
    throw new TypeError('zoomable requires an HTML image.')
  if (!options || typeof options !== 'object')
    throw new TypeError('Expected zoom options.')
  const viewport = options.viewport ?? image.parentElement
  if (!viewport || image.parentElement !== viewport)
    throw new TypeError('The zoom viewport must be the image’s direct parent.')
  const [min, max] = options.scale ?? [1, 5],
    doubleTap = options.doubleTap ?? 2.5
  if (
    ![min, max, doubleTap].every(Number.isFinite) ||
    min < 1 ||
    max < min ||
    doubleTap < 1
  )
    throw new RangeError('Invalid zoom scale range.')
  if (
    options.dismiss !== undefined &&
    options.dismiss !== false &&
    options.dismiss !== 'vertical'
  )
    throw new TypeError('Dismiss must be vertical or false.')
  for (const callback of [options.onDismiss, options.onSettled, options.onError])
    if (callback !== undefined && typeof callback !== 'function')
      throw new TypeError('Zoom callbacks must be functions.')
  for (const target of [options.backdrop, options.chrome])
    if (
      target &&
      (target === image || target === viewport || target.ownerDocument !== document)
    )
      throw new TypeError(
        'Dismissal surfaces must be separate elements in the same document.',
      )
  const events = inputEvents(viewport),
    restores: (() => void)[] = [],
    bindings: WebBinding[] = []
  let disposed = false,
    paused = false,
    ready = false,
    error: Error | undefined,
    pending = false,
    generation = 0
  let width = 0,
    height = 0,
    contentWidth = 0,
    contentHeight = 0
  const opacity = host.motionValue(1),
    layer = host.layer('zoom')
  let gesture: WebGestures | undefined
  const state = (): WebZoomState => {
    const p = gesture?.position ?? { x: 0, y: 0, scale: min }
    return { x: p.x, y: p.y, scale: p.scale, progress: 1 - opacity.get(), pending }
  }
  const notify = () => {
    try {
      options.onSettled?.(state())
    } catch (reason) {
      host.error(reason)
    }
  }
  const panBounds = (scale: number, dismiss = false) => {
    const x = Math.max(0, (contentWidth * scale - width) / 2),
      y = Math.max(0, (contentHeight * scale - height) / 2)
    return {
      left: -x,
      right: x,
      top: dismiss ? -height : -y,
      bottom: dismiss ? height : y,
    }
  }
  const canDismiss = () =>
    options.dismiss !== false && (gesture?.position.scale ?? min) <= min + 0.001
  const updateOpacity = () => {
    opacity.set(
      pending
        ? 0
        : canDismiss()
          ? 1 -
            constrain(
              Math.abs(gesture?.position.y ?? 0) / Math.max(1, height * 0.6),
              0,
              1,
            )
          : 1,
    )
  }
  const fail = (reason: unknown) => {
    if (disposed) return
    error = reason instanceof Error ? reason : new Error(String(reason))
    handle.dispose()
    if (options.onError) {
      try {
        options.onError(error)
      } catch (callback) {
        host.error(callback)
      }
    } else host.error(error)
  }
  const requestDismiss = (velocity = 0) => {
    if (disposed || !ready || pending) return
    pending = true
    const version = ++generation
    gesture!.cancel()
    gesture!.pause()
    opacity.set(0)
    const valid = () => !disposed && pending && version === generation
    const intent: WebPhotoDismissal = {
      state: state(),
      velocity,
      cancel() {
        if (!valid()) return false
        handle.cancelDismiss()
        return true
      },
      complete() {
        if (!valid()) return false
        handle.dispose()
        return true
      },
    }
    try {
      if (options.onDismiss) options.onDismiss(intent)
      else intent.cancel()
    } catch (reason) {
      intent.cancel()
      host.error(reason)
    }
  }
  const released = (event: WebGestureEvent) => {
    if (
      canDismiss() &&
      (Math.abs(event.y) > height * 0.22 ||
        (Math.abs(event.velocityY) > 900 && Math.abs(event.y) > 20))
    ) {
      requestDismiss(event.velocityY)
      return
    }
    const b = panBounds(event.scale)
    gesture!.settleTo({
      x: constrain(event.x, b.left, b.right),
      y: constrain(event.y, b.top, b.bottom),
    })
  }
  const measure = () => {
    if (disposed) return
    if (
      !image.isConnected ||
      !viewport.isConnected ||
      image.ownerDocument !== document ||
      image.parentElement !== viewport
    ) {
      handle.dispose()
      return
    }
    if (!image.complete || !image.naturalWidth || !image.naturalHeight) {
      ready = false
      gesture?.pause()
      return
    }
    const before = [width, height, contentWidth, contentHeight]
    width = viewport.clientWidth
    height = viewport.clientHeight
    if (!width || !height) {
      ready = false
      gesture?.pause()
      return
    }
    const css = view.getComputedStyle(image),
      boxWidth = image.clientWidth,
      boxHeight = image.clientHeight
    // The CSS image box may fill the viewport while its actual pixels are contained within it.
    const fit = css.objectFit,
      contain = Math.min(boxWidth / image.naturalWidth, boxHeight / image.naturalHeight)
    const factor =
      fit === 'cover'
        ? Math.max(boxWidth / image.naturalWidth, boxHeight / image.naturalHeight)
        : fit === 'none'
          ? 1
          : fit === 'scale-down'
            ? Math.min(1, contain)
            : contain
    contentWidth = fit === 'fill' ? boxWidth : image.naturalWidth * factor
    contentHeight = fit === 'fill' ? boxHeight : image.naturalHeight * factor
    if (
      gesture &&
      before.some(
        (value, index) => value !== [width, height, contentWidth, contentHeight][index],
      )
    )
      gesture.cancel()
    if (!gesture) {
      gesture = host.gestures(viewport, {
        pan: {
          bounds: (p) =>
            panBounds(p.scale, options.dismiss !== false && p.scale <= min + 0.001),
        },
        pinch: { min, max },
        initial: { scale: min },
        onContactStart() {
          generation++
          pending = false
          opacity.set(1)
        },
        onMove() {
          updateOpacity()
        },
        onEnd: released,
        onDoubleTap(event) {
          const rect = viewport.getBoundingClientRect()
          handle.zoomTo(
            gesture!.position.scale > min + 0.01 ? min : constrain(doubleTap, min, max),
            { x: event.clientX - rect.left, y: event.clientY - rect.top },
          )
        },
        onSettled() {
          updateOpacity()
          notify()
        },
      })
      bindings.push(
        host.bindLayer(
          image,
          { x: gesture.x, y: gesture.y, scale: gesture.scale },
          layer,
        ),
      )
    }
    ready = true
    host.refresh(image)
    const p = gesture.position,
      b = panBounds(p.scale, canDismiss())
    gesture.updateBounds(b)
    if (!paused && !pending) gesture.play()
    updateOpacity()
  }
  const measureTask: FrameTask = {
    read() {
      try {
        measure()
      } catch (reason) {
        fail(reason)
      }
    },
  }
  const resize = new view.ResizeObserver(() => host.scheduler.add(measureTask))
  const mutations = new view.MutationObserver(() => {
    generation++
    pending = false
    ready = false
    gesture?.cancel()
    gesture?.jumpTo({ x: 0, y: 0, scale: min })
    gesture?.pause()
    opacity.set(1)
    host.scheduler.add(measureTask)
  })
  let unregister = () => {},
    unregisterImage = () => {}
  const handle: WebZoomable = {
    get ready() {
      return ready && !disposed
    },
    get error() {
      return error
    },
    get state() {
      return state()
    },
    get disposed() {
      return disposed
    },
    get paused() {
      return paused
    },
    zoomTo(scale, focus, animated = true) {
      if (
        !Number.isFinite(scale) ||
        scale < min ||
        scale > max ||
        (focus && (!Number.isFinite(focus.x) || !Number.isFinite(focus.y)))
      )
        throw new RangeError('Zoom and focus must be finite and in range.')
      if (!ready || disposed) return
      generation++
      pending = false
      gesture!.play()
      const p = gesture!.position,
        point = focus ?? { x: width / 2, y: height / 2 },
        ratio = scale / p.scale,
        b = panBounds(scale)
      const x = constrain(
        point.x - width / 2 - (point.x - width / 2 - p.x) * ratio,
        b.left,
        b.right,
      )
      const y = constrain(
        point.y - height / 2 - (point.y - height / 2 - p.y) * ratio,
        b.top,
        b.bottom,
      )
      gesture!.updateBounds(
        panBounds(scale, scale <= min + 0.001 && options.dismiss !== false),
      )
      if (animated) gesture!.settleTo({ scale, x, y })
      else {
        gesture!.jumpTo({ scale, x, y })
        notify()
      }
      if (paused) gesture!.pause()
      updateOpacity()
    },
    reset(animated = true) {
      handle.zoomTo(min, { x: width / 2, y: height / 2 }, animated)
    },
    requestDismiss: () => requestDismiss(),
    cancelDismiss() {
      if (disposed) return
      generation++
      pending = false
      gesture?.play()
      handle.reset()
    },
    remeasure: () => host.scheduler.add(measureTask),
    cancel() {
      generation++
      pending = false
      gesture?.cancel()
      updateOpacity()
    },
    pause() {
      if (disposed || paused) return
      paused = true
      gesture?.pause()
    },
    play() {
      if (disposed || !paused) return
      paused = false
      if (ready && !pending) gesture?.play()
    },
    dispose() {
      if (disposed) return
      disposed = true
      ready = false
      generation++
      pending = false
      host.scheduler.remove(measureTask)
      resize.disconnect()
      mutations.disconnect()
      events.dispose()
      cleanupResources([
        () => gesture?.dispose(),
        ...bindings.reverse().map((binding) => () => binding.dispose()),
        () => opacity.dispose(),
        ...restores.reverse(),
        unregister,
        unregisterImage,
      ])
    },
  }
  try {
    restores.push(
      ownStyle(viewport, 'overflow', 'hidden'),
      ownAttribute(image, 'draggable', 'false'),
    )
    if (!viewport.hasAttribute('tabindex'))
      restores.push(ownAttribute(viewport, 'tabindex', '0'))
    for (const target of new Set([options.backdrop, options.chrome]))
      if (target) bindings.push(host.bindLayer(target, { opacity }, layer))
    resize.observe(viewport)
    resize.observe(image)
    mutations.observe(image, {
      attributes: true,
      attributeFilter: ['src', 'srcset', 'sizes'],
    })
    events.on(image, 'load', () => host.scheduler.add(measureTask))
    events.on(image, 'error', () => fail(new Error('The zoom image could not load.')))
    events.on(
      viewport,
      'wheel',
      (e: WheelEvent) => {
        if (
          paused ||
          !ready ||
          pending ||
          e.ctrlKey ||
          e.metaKey ||
          inputBlocked(viewport)
        )
          return
        e.preventDefault()
        const rect = viewport.getBoundingClientRect(),
          delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? height : 1)
        handle.zoomTo(
          constrain(gesture!.position.scale * Math.exp(-delta * 0.002), min, max),
          { x: e.clientX - rect.left, y: e.clientY - rect.top },
          false,
        )
      },
      false,
    )
    events.on(
      viewport,
      'keydown',
      (e: KeyboardEvent) => {
        if (
          e.target !== viewport ||
          paused ||
          !ready ||
          pending ||
          e.ctrlKey ||
          e.metaKey ||
          e.altKey
        )
          return
        const p = gesture!.position,
          b = panBounds(p.scale)
        if (e.key === '+' || e.key === '=') {
          e.preventDefault()
          handle.zoomTo(Math.min(max, p.scale * 1.25))
        } else if (e.key === '-') {
          e.preventDefault()
          handle.zoomTo(Math.max(min, p.scale / 1.25))
        } else if (e.key === '0' || e.key === 'Home') {
          e.preventDefault()
          handle.reset()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          if (p.scale > min + 0.01) handle.reset()
          else requestDismiss()
        } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
          e.preventDefault()
          gesture!.settleTo({
            x: constrain(
              p.x + (e.key === 'ArrowLeft' ? 40 : e.key === 'ArrowRight' ? -40 : 0),
              b.left,
              b.right,
            ),
            y: constrain(
              p.y + (e.key === 'ArrowUp' ? 40 : e.key === 'ArrowDown' ? -40 : 0),
              b.top,
              b.bottom,
            ),
          })
        }
      },
      false,
    )
    const refresh = () => {
      if (
        !image.isConnected ||
        !viewport.isConnected ||
        image.ownerDocument !== document ||
        image.parentElement !== viewport
      )
        handle.dispose()
      else if (inputBlocked(viewport)) handle.cancel()
    }
    unregister = host.register(viewport, handle, refresh)
    unregisterImage = host.register(image, handle, refresh)
    measure()
  } catch (reason) {
    handle.dispose()
    throw reason
  }
  return handle
}
