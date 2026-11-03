import { createBlur, type WebBlur } from './blur.js'
import {
  effectOptions,
  effectOwnership,
  effectTarget,
  EffectStyles,
  type EffectHost,
} from './effect.js'
import { bounded } from './surface-effect.js'
import { parseColor } from './style.js'

export interface WebGlassOptions {
  amount?: number
  radius?: number
  tint?: string
  fallbackColor?: string
}
export interface WebGlass extends Omit<WebBlur, 'snapshot'> {
  snapshot(): {
    amount: number
    appliedAmount: number
    backend: 'css-backdrop-filter' | 'solid'
    reason?: 'unsupported' | 'reduced-transparency' | 'forced-colors'
    attached: boolean
  }
}
/** Browser backdrop filtering with a solid accessibility fallback; no Liquid Glass claim. */
export function createGlass(
  target: HTMLElement,
  options: WebGlassOptions,
  host: EffectHost,
): WebGlass {
  const view = effectTarget(target, host)
  effectOptions(options, ['amount', 'radius', 'tint', 'fallbackColor'])
  const tint = options.tint ?? 'rgba(30, 38, 58, 0.35)',
    fallback = options.fallbackColor ?? '#202638'
  for (const color of [tint, fallback])
    if (typeof color !== 'string' || !view.CSS.supports('color', color))
      throw new TypeError('Glass colors must be valid CSS colors.')
  if (parseColor(host.document, fallback) >>> 24 !== 255)
    throw new TypeError('Glass fallbackColor must be an opaque, resolved CSS color.')
  bounded(options.amount ?? 1, 'amount', 0, 1)
  bounded(options.radius ?? 24, 'radius', 1, 64)
  const transparency = view.matchMedia('(prefers-reduced-transparency: reduce)'),
    contrast = view.matchMedia('(forced-colors: active)')
  const styles = new EffectStyles(target),
    off: (() => void)[] = []
  let ended = false,
    fallbackActive = false,
    blur: WebBlur | undefined,
    amount = options.amount ?? 1
  const reason = () =>
    contrast.matches
      ? ('forced-colors' as const)
      : transparency.matches
        ? ('reduced-transparency' as const)
        : blur?.snapshot().backend === 'none'
          ? ('unsupported' as const)
          : undefined
  const paint = () => {
    if (ended) return
    if (!styles.owns() || blur?.disposed) {
      dispose()
      return
    }
    styles.set(
      'background-color',
      contrast.matches ? 'Canvas' : reason() ? fallback : tint,
    )
    if (reason()) {
      if (!fallbackActive) amount = blur?.snapshot().amount ?? amount
      blur?.set(0)
    } else blur?.set(amount)
    fallbackActive = !!reason()
  }
  const dispose = () => {
    if (ended) return
    ended = true
    blur?.dispose()
    styles.restore()
    off
      .splice(0)
      .reverse()
      .forEach((fn) => fn())
  }
  const handle: WebGlass = {
    get disposed() {
      return ended
    },
    get suspended() {
      return blur?.suspended ?? false
    },
    set(value) {
      if (ended) throw new Error('Glass is disposed.')
      bounded(value, 'amount', 0, 1)
      amount = value
      blur!.set(reason() ? 0 : value)
    },
    animate(value, transition) {
      if (ended) throw new Error('Glass is disposed.')
      bounded(value, 'amount', 0, 1)
      amount = value
      return blur!.animate(reason() ? 0 : value, transition)
    },
    stop: () => blur?.stop(),
    suspend: () => blur?.suspend(),
    resume: () => blur?.resume(),
    snapshot: () => ({
      amount: reason() ? amount : (blur?.snapshot().amount ?? amount),
      appliedAmount: ended || reason() ? 0 : blur!.snapshot().appliedAmount,
      backend: reason() ? 'solid' : 'css-backdrop-filter',
      reason: reason(),
      attached: !ended && target.isConnected,
    }),
    dispose,
  }
  try {
    off.push(effectOwnership(target, 'glass', host, dispose))
    blur = createBlur(target, { amount, radius: options.radius, mode: 'backdrop' }, host)
    paint()
    transparency.addEventListener('change', paint)
    contrast.addEventListener('change', paint)
    off.push(
      () => transparency.removeEventListener('change', paint),
      () => contrast.removeEventListener('change', paint),
    )
    off.push(
      host.register(
        target,
        {
          get disposed() {
            return ended
          },
          get paused() {
            return handle.suspended
          },
          pause: handle.suspend,
          play: handle.resume,
          cancel: handle.stop,
          dispose,
        },
        () => {
          if (!target.isConnected || !styles.owns() || blur?.disposed) dispose()
        },
      ),
    )
    return handle
  } catch (e) {
    dispose()
    throw e
  }
}
