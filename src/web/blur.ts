import {
  EffectAnimation,
  EffectStyles,
  effectOptions,
  effectOwnership,
  effectTarget,
  type EffectHost,
  type EffectTransition,
} from './effect.js'
import { valuePlan, valueTrack } from './value-playback.js'
import type { Track } from '../core/track.js'
import type { WebAnimation } from './public.js'
import { bounded } from './surface-effect.js'

export interface WebBlurOptions {
  amount?: number
  radius?: number
  /** Kept for shared options. Web blur does not emulate iOS material tint. */
  style?: 'system' | 'light' | 'dark'
  mode?: 'content' | 'backdrop'
}
export interface WebBlur {
  readonly disposed: boolean
  readonly suspended: boolean
  animate(amount: number, transition?: EffectTransition): WebAnimation
  set(amount: number): void
  stop(): void
  suspend(): void
  resume(): void
  snapshot(): {
    amount: number
    appliedAmount: number
    backend: 'css-filter' | 'css-backdrop-filter' | 'none'
    attached: boolean
  }
  dispose(): void
}
export function createBlur(
  target: HTMLElement,
  options: WebBlurOptions,
  host: EffectHost,
): WebBlur {
  const view = effectTarget(target, host)
  effectOptions(options, ['amount', 'radius', 'style', 'mode'])
  let amount = bounded(options.amount ?? 0, 'amount', 0, 1)
  const radius = bounded(options.radius ?? 24, 'radius', 1, 64)
  const mode = options.mode ?? 'content'
  if (
    !['content', 'backdrop'].includes(mode) ||
    !['system', 'light', 'dark'].includes(options.style ?? 'system')
  )
    throw new TypeError('Invalid blur mode or style.')
  const property =
    mode === 'content'
      ? 'filter'
      : view.CSS.supports('backdrop-filter', 'blur(1px)')
        ? 'backdrop-filter'
        : '-webkit-backdrop-filter'
  const supported = view.CSS.supports(property, 'blur(1px)')
  const styles = new EffectStyles(target)
  let ended = false,
    held = false,
    restart = false,
    base = ''
  let active: { animation: EffectAnimation; track: Track } | undefined
  const off: (() => void)[] = []
  const sample = () =>
    active
      ? bounded(
          Math.max(0, Math.min(1, active.track.valueAt(active.animation.time()))),
          'amount',
          0,
          1,
        )
      : amount
  const paint = () => {
    if (ended) return
    if (!styles.owns()) {
      dispose()
      return
    }
    if (supported) styles.set(property, `${base} blur(${sample() * radius}px)`.trim())
  }
  const stop = () => {
    active?.animation.stop()
    active = undefined
  }
  const dispose = () => {
    if (ended) return
    ended = true
    stop()
    styles.restore()
    for (const release of off.splice(0).reverse()) release()
  }
  const valid = () =>
    target.isConnected && target.ownerDocument === host.document && styles.owns()
  const assert = () => {
    if (ended || !valid()) {
      dispose()
      throw new Error('Blur is disposed or its target changed.')
    }
  }
  const handle: WebBlur = {
    get disposed() {
      return ended
    },
    get suspended() {
      return held
    },
    animate(destination, transition = {}) {
      assert()
      bounded(destination, 'amount', 0, 1)
      const plan = valuePlan(transition)
      if (plan.layer !== undefined)
        throw new TypeError('Blur owns its intensity channel.')
      const from = sample(),
        velocity = active?.track.velocityAt(active.animation.time()) ?? 0
      const track = valueTrack(destination, plan, from, velocity, host.settings())
      if (!Number.isFinite(track.end))
        throw new RangeError('Blur playback must be finite.')
      stop()
      amount = from
      const animation = new EffectAnimation(
        host,
        track.end,
        [],
        (time) => {
          amount = Math.max(0, Math.min(1, track.valueAt(time)))
          paint()
        },
        (completed, time) => {
          amount = Math.max(0, Math.min(1, track.valueAt(completed ? track.end : time)))
          active = undefined
          paint()
        },
      )
      active = { animation, track }
      if (held) {
        animation.pause()
        restart = true
      }
      return animation
    },
    set(value) {
      assert()
      bounded(value, 'amount', 0, 1)
      stop()
      amount = value
      paint()
    },
    stop,
    suspend() {
      if (ended || held) return
      held = true
      restart = !!active && !active.animation.paused
      active?.animation.pause()
    },
    resume() {
      if (ended || !held) return
      held = false
      if (restart) active?.animation.play()
      restart = false
    },
    snapshot: () => ({
      amount: sample(),
      appliedAmount: supported && !ended ? sample() : 0,
      backend: !supported
        ? 'none'
        : mode === 'content'
          ? 'css-filter'
          : 'css-backdrop-filter',
      attached: !ended && target.isConnected,
    }),
    dispose,
  }
  try {
    off.push(effectOwnership(target, property, host, dispose))
    const css = view.getComputedStyle(target).getPropertyValue(property)
    base = css === 'none' ? '' : css
    paint()
    off.push(
      host.register(
        target,
        {
          get disposed() {
            return ended
          },
          get paused() {
            return held
          },
          pause: handle.suspend,
          play: handle.resume,
          cancel: stop,
          dispose,
        },
        () => {
          if (!valid()) dispose()
        },
      ),
    )
    return handle
  } catch (error) {
    dispose()
    throw error
  }
}
