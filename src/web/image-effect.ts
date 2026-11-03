import { registerPlayback } from '../core/playback.js'
import {
  EffectStyles,
  effectOptions,
  effectOwnership,
  type EffectHost,
} from './effect.js'
import { bounded, SurfaceLoop } from './surface-effect.js'
import {
  DisplacementMap,
  ImageSurface,
  imageFallback,
  imageTarget,
  svgNode,
} from './image-surface.js'
import type { WebAnimation } from './public.js'

export type WebImageEffectName = 'ripple' | 'distortion' | 'dissolve'
export interface WebImageEffectOptions {
  origin?: { x: number; y: number }
  amplitude?: number
  radius?: number
  duration?: number
  seed?: number
  to?: HTMLImageElement
  paused?: boolean
}
export interface WebImageEffect extends WebAnimation {
  readonly disposed: boolean
  cancel(): void
  dispose(): void
  readonly diagnostics: {
    backend: 'svg-filter' | 'none'
    reason?: string
    frames: number
  }
  reverse(): void
  finish(): void
}

function destination(target: HTMLImageElement, to: HTMLImageElement, host: EffectHost) {
  const view = host.document.defaultView!
  const canvas = host.document.createElement('canvas')
  canvas.width = target.clientWidth
  canvas.height = target.clientHeight
  const context = canvas.getContext('2d')
  if (!context) return undefined
  const css = view.getComputedStyle(target)
  const fit = css.objectFit
  const parts = css.objectPosition.split(' ')
  if (parts.length !== 2 || parts.some((part) => !/^-?[\d.]+%$/.test(part)))
    return undefined
  const sx = canvas.width / to.naturalWidth,
    sy = canvas.height / to.naturalHeight
  const scale =
    fit === 'cover'
      ? Math.max(sx, sy)
      : fit === 'none'
        ? 1
        : fit === 'scale-down'
          ? Math.min(1, sx, sy)
          : Math.min(sx, sy)
  const width = fit === 'fill' ? canvas.width : to.naturalWidth * scale,
    height = fit === 'fill' ? canvas.height : to.naturalHeight * scale
  context.drawImage(
    to,
    ((canvas.width - width) * parseFloat(parts[0]!)) / 100,
    ((canvas.height - height) * parseFloat(parts[1]!)) / 100,
    width,
    height,
  )
  return canvas.toDataURL()
}

export function createImageEffect(
  target: HTMLImageElement,
  effect: WebImageEffectName,
  options: WebImageEffectOptions,
  host: EffectHost,
): WebImageEffect {
  const view = imageTarget(target, host)
  if (!['ripple', 'distortion', 'dissolve'].includes(effect))
    throw new TypeError('Unknown image effect.')
  effectOptions(options, [
    'origin',
    'amplitude',
    'radius',
    'duration',
    'seed',
    'to',
    'paused',
  ])
  const amplitude = bounded(options.amplitude ?? 8, 'amplitude', 0, 64),
    radius = bounded(options.radius ?? 96, 'radius', Number.MIN_VALUE, Number.MAX_VALUE)
  const duration = Math.max(
    Number.MIN_VALUE,
    bounded(options.duration ?? 650, 'duration', Number.MIN_VALUE, 2147483647) /
      host.settings().timeScale,
  )
  const seed = bounded(options.seed ?? 1, 'seed', 0, 65535)
  if (!Number.isInteger(seed)) throw new RangeError('seed must be an integer.')
  if (options.paused !== undefined && typeof options.paused !== 'boolean')
    throw new TypeError('paused must be boolean.')
  if (options.origin !== undefined) {
    effectOptions(options.origin, ['x', 'y'])
    bounded(options.origin.x, 'origin.x', -1000000, 1000000)
    bounded(options.origin.y, 'origin.y', -1000000, 1000000)
  }
  if (
    effect === 'dissolve' &&
    (!(options.to instanceof view.HTMLImageElement) ||
      !options.to.complete ||
      !options.to.naturalWidth)
  )
    throw new TypeError('Dissolve needs a loaded destination HTMLImageElement.')
  if (effect !== 'dissolve' && options.to !== undefined)
    throw new TypeError('Only dissolve accepts to.')
  let reason = imageFallback(target, host),
    raster: string | undefined
  if (!reason && effect === 'dissolve') {
    try {
      raster = destination(target, options.to!, host)
      if (!raster) reason = 'unsupported-image-style'
    } catch {
      reason = 'destination-not-origin-clean'
    }
  }
  if (host.reduced()) reason = 'reduced-motion'
  let surface: ImageSurface | undefined, loop: SurfaceLoop | undefined
  let ended = false,
    held = options.paused ?? false,
    completed = false
  let base = 0,
    started = 0,
    direction = 1,
    pointer: number | undefined
  let point = options.origin ?? { x: target.clientWidth / 2, y: target.clientHeight / 2 }
  let delta = { x: 0, y: 0 },
    released = 0,
    frames = 0
  let resolve!: (value: boolean) => void
  const finished = new Promise<boolean>((yes) => {
    resolve = yes
  })
  const off: (() => void)[] = []
  const styles = new EffectStyles(target)
  const width = target.clientWidth,
    height = target.clientHeight
  const toSource = options.to?.currentSrc || options.to?.src
  const progress = () =>
    Math.max(
      0,
      Math.min(1, base + (direction * ((loop?.time() ?? 0) - started)) / duration),
    )
  let notify = () => {}
  const settle = (success: boolean) => {
    if (ended) return
    base = progress()
    started = loop?.time() ?? 0
    ended = true
    completed = success
    frames = surface?.frames ?? 0
    loop?.dispose()
    surface?.dispose()
    styles.restore()
    render = () => {}
    if (pointer !== undefined && target.hasPointerCapture(pointer))
      target.releasePointerCapture(pointer)
    pointer = undefined
    for (const release of off.splice(0).reverse()) release()
    if (success && effect === 'dissolve' && base === 1 && toSource) {
      target.removeAttribute('srcset')
      target.removeAttribute('sizes')
      target.src = toSource
    }
    resolve(success)
    notify()
  }
  let render: () => void = () => {}
  const finite = () => {
    if (effect === 'distortion')
      throw new TypeError(
        'Pointer distortion has no finite progress or reverse playback.',
      )
  }
  const handle: WebImageEffect = {
    ready: Promise.resolve(),
    finished,
    duration: effect === 'distortion' ? Infinity : duration,
    get paused() {
      return held
    },
    get disposed() {
      return ended
    },
    get progress() {
      return progress()
    },
    set progress(value) {
      finite()
      bounded(value, 'progress', 0, 1)
      if (ended) return
      base = value
      started = loop?.time() ?? 0
      render()
      notify()
    },
    get diagnostics() {
      return {
        backend: surface ? ('svg-filter' as const) : ('none' as const),
        reason,
        frames: ended ? frames : (surface?.frames ?? 0),
      }
    },
    pause() {
      if (ended || held) return
      held = true
      loop?.pause()
      notify()
    },
    play() {
      if (ended || !held) return
      held = false
      loop?.play()
      notify()
    },
    reverse() {
      finite()
      if (ended) return
      base = progress()
      started = loop?.time() ?? 0
      direction *= -1
      held = false
      loop?.play()
      notify()
    },
    finish() {
      if (ended) return
      if (effect === 'distortion') {
        settle(false)
        return
      }
      base = direction > 0 ? 1 : 0
      started = loop?.time() ?? 0
      settle(true)
    },
    stop: () => settle(false),
    cancel: () => settle(false),
    dispose: () => settle(false),
    then: (yes, no) => finished.then(yes, no),
  }
  notify = registerPlayback(handle, () => ({
    time: progress() * duration,
    duration: effect === 'distortion' ? Infinity : duration,
    paused: held,
    ready: true,
    settled: ended,
    completed,
  }))
  try {
    if (reason) {
      effectOwnership(target, 'filter', host, () => settle(false))()
      if (effect === 'dissolve') base = 1
      settle(effect === 'dissolve')
      return handle
    }
    surface = new ImageSurface(target, host, () => settle(false))
    let map: DisplacementMap | undefined, alpha: SVGFEFuncAElement | undefined
    if (effect === 'dissolve') {
      const document = host.document
      const image = svgNode(document, 'feImage', {
        href: raster!,
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        preserveAspectRatio: 'none',
        result: 'destination',
      })
      const noise = svgNode(document, 'feTurbulence', {
        type: 'fractalNoise',
        baseFrequency: 90,
        numOctaves: 1,
        seed,
        result: 'noise',
      })
      const matrix = svgNode(document, 'feColorMatrix', {
        in: 'noise',
        type: 'matrix',
        values: '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0',
        result: 'alpha',
      })
      const transfer = svgNode(document, 'feComponentTransfer', {
        in: 'alpha',
        result: 'mask',
      })
      alpha = svgNode(document, 'feFuncA', { type: 'linear', slope: 20, intercept: -20 })
      transfer.append(alpha)
      const incoming = svgNode(document, 'feComposite', {
        in: 'destination',
        in2: 'mask',
        operator: 'in',
        result: 'incoming',
      })
      const outgoing = svgNode(document, 'feComposite', {
        in: 'SourceGraphic',
        in2: 'mask',
        operator: 'out',
        result: 'outgoing',
      })
      const merge = svgNode(document, 'feMerge')
      merge.append(
        svgNode(document, 'feMergeNode', { in: 'outgoing' }),
        svgNode(document, 'feMergeNode', { in: 'incoming' }),
      )
      surface.filter.append(image, noise, matrix, transfer, incoming, outgoing, merge)
    } else map = new DisplacementMap(surface)
    render = () => {
      if (ended) return
      const p = progress()
      if (alpha) {
        alpha.setAttribute('intercept', String(21 * p - 20))
        surface!.apply()
      } else {
        const current = loop?.time() ?? 0
        const strength =
          pointer === undefined ? Math.max(0, 1 - (current - released) / duration) : 1
        map!.paint(
          (x, y) => {
            const dx = x * width - point.x,
              dy = y * height - point.y,
              distance = Math.hypot(dx, dy)
            const edge = Math.sin(Math.PI * x) ** 2 * Math.sin(Math.PI * y) ** 2
            if (effect === 'distortion') {
              const falloff = Math.max(0, 1 - distance / radius) ** 2 * strength * edge
              return [(-delta.x * falloff) / width, (-delta.y * falloff) / height]
            }
            if (!Number.isFinite(distance / radius)) return [0, 0]
            const wave =
              amplitude *
              Math.sin((distance / radius - p * 2) * Math.PI * 4) *
              Math.sin(p * Math.PI) *
              Math.exp(-distance / radius) *
              edge
            return [
              distance ? ((dx / distance) * wave) / width : 0,
              distance ? ((dy / distance) * wave) / height : 0,
            ]
          },
          effect === 'ripple'
            ? amplitude > 0 && p > 0 && p < 1
            : strength > 0 && (delta.x !== 0 || delta.y !== 0),
        )
      }
    }
    loop = new SurfaceLoop(
      target,
      host,
      (_time, reduced) => {
        if (reduced) {
          reason = 'reduced-motion'
          handle.finish()
          return
        }
        render()
        if (
          effect !== 'distortion' &&
          !held &&
          (direction > 0 ? progress() >= 1 : progress() <= 0)
        )
          settle(true)
      },
      () => settle(false),
      () =>
        surface!.valid() &&
        styles.owns() &&
        target.clientWidth === width &&
        target.clientHeight === height,
    )
    const position = (event: PointerEvent) => {
      const rect = target.getBoundingClientRect()
      return {
        x: ((event.clientX - rect.left) * width) / rect.width,
        y: ((event.clientY - rect.top) * height) / rect.height,
      }
    }
    if (effect === 'distortion') {
      styles.set('touch-action', 'none')
      styles.set('user-select', 'none')
      const down = (event: PointerEvent) => {
        if (
          ended ||
          held ||
          pointer !== undefined ||
          !event.isPrimary ||
          event.button !== 0
        )
          return
        pointer = event.pointerId
        point = position(event)
        delta = { x: 0, y: 0 }
        target.setPointerCapture(pointer)
      }
      const move = (event: PointerEvent) => {
        if (held || event.pointerId !== pointer) return
        const next = position(event)
        const dx = next.x - point.x,
          dy = next.y - point.y,
          length = Math.hypot(dx, dy)
        const scale = length ? Math.min(1, amplitude / length) : 0
        delta = { x: dx * scale, y: dy * scale }
      }
      const up = (event: PointerEvent) => {
        if (event.pointerId !== pointer) return
        pointer = undefined
        released = loop!.time()
        if (target.hasPointerCapture(event.pointerId))
          target.releasePointerCapture(event.pointerId)
      }
      for (const [name, listener] of [
        ['pointerdown', down],
        ['pointermove', move],
        ['pointerup', up],
        ['pointercancel', up],
        ['lostpointercapture', up],
      ] as const) {
        target.addEventListener(name, listener)
        off.push(() => target.removeEventListener(name, listener))
      }
      const drag = (event: Event) => event.preventDefault()
      target.addEventListener('dragstart', drag)
      off.push(() => target.removeEventListener('dragstart', drag))
    }
    host.remember(handle)
    if (held) loop.pause()
    else loop.refresh()
    return handle
  } catch (error) {
    settle(false)
    throw error
  }
}
