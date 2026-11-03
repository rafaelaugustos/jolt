import { createClock, registerPlayback, validateProgress } from '../core/playback.js'
import { effectOptions, effectOwnership, effectTarget } from './effect.js'
import { bounded } from './surface-effect.js'
import type { PlatformHost } from './platform-host.js'
import type { WebAnimation } from './public.js'
import type { WebInteraction } from './interaction.js'

export type WebSymbolEffectName =
  'bounce' | 'pulse' | 'scale' | 'variableColor' | { replace: HTMLElement | SVGElement }
export interface WebSymbolEffectOptions {
  speed?: number
  repeat?: boolean
}
export interface WebSymbolEffect extends WebAnimation, WebInteraction {}

/** Animate an application-owned icon wrapper; this API does not load SF Symbols. */
export function createSymbolEffect(
  target: HTMLElement,
  effect: WebSymbolEffectName,
  options: WebSymbolEffectOptions,
  host: PlatformHost,
): WebSymbolEffect {
  const view = effectTarget(target, host)
  effectOptions(options, ['speed', 'repeat'])
  const speed = bounded(options.speed ?? 1, 'speed', 0.01, 100)
  if (options.repeat !== undefined && typeof options.repeat !== 'boolean')
    throw new TypeError('repeat must be boolean.')
  const replacement =
    typeof effect === 'object' && effect !== null ? effect.replace : undefined
  if (replacement) {
    effectOptions(effect as object, ['replace'])
    if (
      !(
        replacement instanceof view.HTMLElement || replacement instanceof view.SVGElement
      ) ||
      replacement.ownerDocument !== host.document ||
      replacement.isConnected ||
      replacement.contains(target)
    )
      throw new TypeError(
        'Replacement must be a detached icon element from the same document.',
      )
    if (
      replacement.matches(
        'button,a,input,select,textarea,[tabindex],[contenteditable],script,iframe,video,audio,canvas',
      ) ||
      replacement.querySelector(
        'button,a,input,select,textarea,[tabindex],[contenteditable],script,iframe,video,audio,canvas',
      )
    )
      throw new TypeError('Replacement icons must be decorative elements.')
  } else if (!['bounce', 'pulse', 'scale', 'variableColor'].includes(effect as string))
    throw new TypeError(
      'Unknown Web symbol effect; use an application-owned element for replacement.',
    )
  if (options.repeat && (replacement || effect === 'scale'))
    throw new TypeError('Replacement and held scale do not repeat.')
  const layers =
    effect === 'variableColor'
      ? [...target.querySelectorAll('[data-jolt-symbol-layer]')]
      : []
  if (effect === 'variableColor' && (!layers.length || layers.length > 32))
    throw new RangeError('variableColor needs 1–32 explicitly marked icon layers.')
  const loop = options.repeat === true,
    heldScale = effect === 'scale',
    cycle = 700 / speed / host.settings().timeScale
  const duration = loop || heldScale ? Infinity : cycle,
    clock = createClock(() => host.scheduler.now())
  const effects: globalThis.Animation[] = [],
    off: (() => void)[] = []
  let ended = false,
    held = false,
    completed = false,
    clearTimer: (() => void) | undefined
  let resolve!: (value: boolean) => void
  const finished = new Promise<boolean>((done) => {
    resolve = done
  })
  let notify = () => {}
  const finish = (result: boolean) => {
    if (ended) return
    ended = true
    completed = result
    clock.cancel()
    clearTimer?.()
    for (const animation of effects) animation.cancel()
    for (const cleanup of off.splice(0).reverse()) cleanup()
    resolve(result)
    notify()
  }
  const refresh = () => {
    if (ended) return
    if (!target.isConnected || target.ownerDocument !== host.document) {
      finish(false)
      return
    }
    if (host.reduced()) {
      finish(!!replacement)
      return
    }
    clearTimer?.()
    clearTimer = undefined
    for (const animation of effects) {
      animation.pause()
      animation.currentTime = heldScale ? Math.min(cycle, clock.time()) : clock.time()
      if (!held && !host.document.hidden && !(heldScale && clock.time() >= cycle))
        animation.play()
    }
    if (!held && Number.isFinite(duration))
      clearTimer = host.after(Math.max(0, duration - clock.time()), () => finish(true))
  }
  const handle: WebSymbolEffect = {
    ready: Promise.resolve(),
    finished,
    duration,
    get disposed() {
      return ended
    },
    get paused() {
      return held
    },
    get progress() {
      return Number.isFinite(duration) ? Math.min(1, clock.time() / duration) : 0
    },
    set progress(value) {
      validateProgress(value, duration)
      if (!ended) {
        clock.seek(value * duration)
        refresh()
        notify()
        if (value === 1) finish(true)
      }
    },
    pause() {
      if (!ended && !held) {
        held = true
        clock.pause()
        refresh()
        notify()
      }
    },
    play() {
      if (!ended && held) {
        held = false
        clock.play()
        refresh()
        notify()
      }
    },
    stop: () => finish(false),
    cancel: () => finish(false),
    dispose: () => finish(false),
    then: (fulfilled, rejected) => finished.then(fulfilled, rejected),
  }
  notify = registerPlayback(handle, () => ({
    time: clock.time(),
    duration,
    paused: held,
    ready: true,
    settled: ended,
    completed,
  }))
  try {
    off.push(effectOwnership(target, 'symbol', host, () => finish(false)))
    // The application's icon node is retained after replacement, including cancellation.
    if (replacement) target.replaceChildren(replacement)
    const add = (element: Element, frames: Keyframe[], delay = 0) => {
      const animation = element.animate(frames, {
        duration: cycle,
        iterations: loop ? Infinity : 1,
        fill: 'both',
        easing: 'ease-in-out',
        delay,
      })
      animation.pause()
      animation.currentTime = 0
      effects.push(animation)
    }
    if (!host.reduced()) {
      if (effect === 'variableColor')
        layers.forEach((layer, i) => {
          const opacity = Number(view.getComputedStyle(layer).opacity)
          add(
            layer,
            Array.from({ length: 9 }, (_, step) => ({
              offset: step / 8,
              opacity:
                opacity *
                (0.3 +
                  (0.7 * (1 - Math.cos((step / 8 - i / layers.length) * Math.PI * 2))) /
                    2),
            })),
          )
        })
      else if (effect === 'bounce')
        add(target, [
          { translate: '0 0' },
          { translate: '0 -25%', offset: 0.35 },
          { translate: '0 0', offset: 0.7 },
          { translate: '0 -8%', offset: 0.85 },
          { translate: '0 0' },
        ])
      else if (effect === 'pulse')
        add(target, [{ opacity: 1 }, { opacity: 0.3 }, { opacity: 1 }])
      else if (effect === 'scale') add(target, [{ scale: '1' }, { scale: '1.2' }])
      else
        add(target, [
          { opacity: 0, scale: '.65' },
          { opacity: 1, scale: '1' },
        ])
    }
    off.push(
      host.register(target, handle, refresh),
      host.onReduced(refresh),
      host.visibility(refresh),
    )
    host.remember(handle)
    queueMicrotask(refresh)
    return handle
  } catch (error) {
    finish(false)
    throw error
  }
}
