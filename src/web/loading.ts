import {
  decorativeLayer,
  effectOptions,
  effectOwnership,
  effectTarget,
  finiteOption,
  positioned,
  type EffectHost,
} from './effect.js'
import { parseColor } from './style.js'
import type { WebInteraction } from './interaction.js'

export interface WebShimmerOptions {
  duration?: number
}
export interface WebLoaderOptions {
  style?: 'dots' | 'bars' | 'ring'
  color?: string
  size?: number
  duration?: number
}
/** Callable cleanup, with controls so directly adopted scopes can suspend it. */
export interface WebLoadingEffect extends WebInteraction {
  (): void
  readonly suspended: boolean
  suspend(): void
  resume(): void
}

export function createShimmer(
  target: HTMLElement,
  options: WebShimmerOptions,
  host: EffectHost,
) {
  effectTarget(target, host)
  effectOptions(options, ['duration'])
  const duration =
    finiteOption(options.duration ?? 1500, 'Shimmer duration', 0, false) /
    host.settings().timeScale
  return loading(target, 'shimmer', host, (layer) => {
    const beam = host.document.createElement('span')
    beam.style.cssText =
      'display:block;position:absolute;inset:0;background:linear-gradient(100deg,transparent 15%,rgba(255,255,255,.55) 50%,transparent 85%);'
    layer.append(beam)
    return [
      {
        target: beam,
        frames: [{ transform: 'translateX(-100%)' }, { transform: 'translateX(100%)' }],
        timing: { duration },
      },
    ]
  })
}

export function createLoader(
  target: HTMLElement,
  options: WebLoaderOptions,
  host: EffectHost,
) {
  effectTarget(target, host)
  effectOptions(options, ['style', 'color', 'size', 'duration'])
  const style = options.style ?? 'dots',
    color = options.color ?? '#71717a'
  if (!['dots', 'bars', 'ring'].includes(style))
    throw new TypeError('Unknown loader style.')
  if (typeof color !== 'string')
    throw new TypeError('Loader color must be a resolved CSS color.')
  parseColor(host.document, color)
  const size = finiteOption(options.size ?? 48, 'Loader size', 0, false)
  const duration =
    finiteOption(options.duration ?? 1200, 'Loader duration', 0, false) /
    host.settings().timeScale
  return loading(target, 'loader', host, (layer) => {
    layer.style.display = 'grid'
    layer.style.placeItems = 'center'
    const box = host.document.createElement('span')
    box.style.cssText = `display:flex;align-items:center;justify-content:space-around;width:min(${size}px,100%);height:min(${size}px,100%);aspect-ratio:1;`
    layer.append(box)
    if (style === 'ring') {
      const ring = host.document.createElement('span')
      ring.style.cssText = `display:block;width:75%;aspect-ratio:1;box-sizing:border-box;border:3px solid ${color};border-right-color:transparent;border-radius:50%;`
      box.append(ring)
      return [
        {
          target: ring,
          frames: [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
          timing: { duration },
        },
      ]
    }
    return Array.from({ length: style === 'dots' ? 3 : 5 }, (_, i) => {
      const item = host.document.createElement('span')
      item.style.cssText = `display:block;background:${color};width:${style === 'dots' ? 20 : 12}%;height:${style === 'dots' ? 20 : 65}%;border-radius:${style === 'dots' ? '50%' : '3px'};`
      box.append(item)
      return {
        target: item,
        frames: [
          { transform: 'scaleY(.45)', opacity: 0.45 },
          { transform: 'scaleY(1)', opacity: 1 },
          { transform: 'scaleY(.45)', opacity: 0.45 },
        ],
        timing: { duration, delay: (i * duration) / 7, easing: 'ease-in-out' },
      }
    })
  })
}

function loading(
  target: HTMLElement,
  kind: string,
  host: EffectHost,
  build: (
    layer: HTMLElement,
  ) => { target: HTMLElement; frames: Keyframe[]; timing: KeyframeAnimationOptions }[],
): WebLoadingEffect {
  const view = effectTarget(target, host)
  let ended = false,
    held = false
  let effects: globalThis.Animation[] = []
  let layer: HTMLElement | undefined
  const off: (() => void)[] = []
  const stop = () => {
    if (ended) return
    ended = true
    for (const effect of effects) effect.cancel()
    effects = []
    layer?.remove()
    for (const cleanup of off.splice(0).reverse()) cleanup()
  }
  const refresh = () => {
    if (ended) return
    if (!target.isConnected || target.ownerDocument !== host.document) {
      stop()
      return
    }
    const visible =
      target.getClientRects().length > 0 &&
      view.getComputedStyle(target).visibility !== 'hidden'
    const reduced = host.reduced()
    const hidden = kind === 'shimmer' && reduced
    if (layer && layer.hidden !== hidden) layer.hidden = hidden
    for (const effect of effects) {
      if (held || host.document.hidden || reduced || !visible) {
        effect.pause()
        if (reduced) effect.currentTime = 0
      } else if (effect.playState !== 'running') effect.play()
    }
  }
  const handle = Object.defineProperties(
    Object.assign(stop, {
      pause() {
        if (!ended) {
          held = true
          refresh()
        }
      },
      play() {
        if (!ended) {
          held = false
          refresh()
        }
      },
      suspend() {
        handle.pause()
      },
      resume() {
        handle.play()
      },
      cancel: stop,
      dispose: stop,
    }),
    {
      disposed: { get: () => ended },
      paused: { get: () => held },
      suspended: { get: () => held },
    },
  ) as WebLoadingEffect
  try {
    off.push(effectOwnership(target, kind, host, stop))
    off.push(positioned(target))
    layer = decorativeLayer(target, kind)
    const plans = build(layer)
    target.append(layer)
    effects = plans.map(({ target, frames, timing }) =>
      target.animate(frames, { ...timing, iterations: Infinity, fill: 'both' }),
    )
    off.push(
      host.register(target, handle, refresh),
      host.onReduced(refresh),
      host.visibility(refresh),
    )
    const observer = new view.ResizeObserver(refresh)
    observer.observe(target)
    off.push(() => observer.disconnect())
    refresh()
    return handle
  } catch (error) {
    stop()
    throw error
  }
}
