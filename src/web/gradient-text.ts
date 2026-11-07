import {
  resolveGradientText,
  type GradientTextDefinition,
} from '../core/gradient-text.js'
import { createTrack } from '../core/track.js'
import { resolveTransition } from '../core/transition.js'
import {
  EffectAnimation,
  EffectStyles,
  effectOptions,
  effectOwnership,
  effectTarget,
  type EffectHost,
} from './effect.js'
import { parseColor } from './style.js'
import { linearGradientCSS } from './gradient-css.js'
import type { Transition } from './types.js'
import type { WebAnimation } from './public.js'

export interface WebGradientTextOptions extends GradientTextDefinition<string> {}
export interface WebGradientText {
  readonly disposed: boolean
  readonly suspended: boolean
  play(transition?: Transition): WebAnimation
  suspend(): void
  resume(): void
  stop(): void
  refresh(): void
  snapshot(): {
    attached: boolean
    playing: boolean
    backend: 'css-text-clip' | 'plain-text'
  }
  dispose(): void
}
const owners = new WeakMap<HTMLElement, WebGradientText>()

/** Uses the original text node: no bitmap, cloned text, or extra accessible content. */
export function createGradientText(
  target: HTMLElement,
  options: WebGradientTextOptions,
  host: EffectHost,
): WebGradientText {
  const view = effectTarget(target, host)
  if (owners.has(target)) throw new Error('This text target already owns gradient text.')
  effectOptions(options, ['colors', 'stops', 'angle', 'sheen'])
  if (options.sheen) effectOptions(options.sheen, ['color', 'width', 'direction'])
  if (
    target.childElementCount ||
    ['INPUT', 'TEXTAREA', 'SELECT', 'IMG', 'CANVAS'].includes(target.tagName)
  )
    throw new TypeError(
      'gradientText requires plain text in an HTMLElement without child elements.',
    )
  const { paint: definition, direction } = resolveGradientText(options, (color) => {
    if (typeof color !== 'string')
      throw new TypeError('Web text colors must be CSS strings.')
    return parseColor(host.document, color)
  })
  const base = linearGradientCSS(
    definition.angle + 90,
    definition.colors,
    definition.stops,
  )
  const forced = view.matchMedia('(forced-colors: active)')
  const canClip =
    view.CSS.supports('background-clip', 'text') ||
    view.CSS.supports('-webkit-background-clip', 'text')
  const styles = new EffectStyles(target)
  const off: (() => void)[] = []
  let ended = false,
    held = false,
    restart = false,
    active: EffectAnimation | undefined
  let band: number | undefined
  const supported = () => canClip && !forced.matches
  const valid = () =>
    target.isConnected &&
    target.ownerDocument === host.document &&
    target.childElementCount === 0
  const paint = () => {
    if (ended) return
    if (!styles.owns()) {
      dispose()
      throw new Error('Application replaced text gradient styles.')
    }
    if (!supported()) {
      styles.restore()
      return
    }
    let image = base
    if (band !== undefined) {
      const center = -definition.width + band * (1 + 2 * definition.width)
      image = `${linearGradientCSS(90, [definition.sheen & 0xffffff, definition.sheen, definition.sheen & 0xffffff], [center - definition.width / 2, center, center + definition.width / 2])},${base}`
    }
    styles.set('background-image', image)
    styles.set('background-clip', 'text')
    styles.set('-webkit-background-clip', 'text')
    styles.set('background-repeat', 'no-repeat')
    styles.set('color', 'transparent')
    styles.set('-webkit-text-fill-color', 'transparent')
  }
  const stop = () => {
    const previous = active
    active = undefined
    previous?.stop()
    restart = false
    band = undefined
    paint()
  }
  function dispose() {
    if (ended) return
    // Mark before stopping: rendering cancellation cannot rewrite external styles.
    ended = true
    active?.stop()
    active = undefined
    for (const release of off.splice(0).reverse()) release()
    styles.restore()
    owners.delete(target)
  }
  const refresh = () => {
    if (ended) return
    if (!valid() || !styles.owns()) {
      dispose()
      return
    }
    if (!supported()) stop()
    paint()
  }
  const handle: WebGradientText = {
    get disposed() {
      return ended
    },
    get suspended() {
      return held
    },
    play(transition = { duration: 1200, ease: 'linear' }) {
      if (ended) throw new Error('Gradient text is disposed.')
      if (!valid() || !styles.owns()) {
        dispose()
        throw new Error('Gradient text target is detached or replaced.')
      }
      const track = createTrack(
        'x',
        direction === 'left' ? [1, 0] : [0, 1],
        resolveTransition(transition, 'x', 2),
        0,
        host.settings(),
      )
      stop()
      const duration = supported() ? track.end : 0
      const terminal = Number.isFinite(duration) ? duration : track.delay + track.duration
      let animation: EffectAnimation | undefined
      animation = new EffectAnimation(
        host,
        duration,
        [],
        (time) => {
          band = track.valueAt(time)
          paint()
        },
        () => {
          band = undefined
          paint()
          if (active === animation) active = undefined
        },
        terminal,
      )
      active = animation
      if (held) {
        animation.pause()
        restart = true
      }
      return animation
    },
    suspend() {
      if (!ended && !held) {
        held = true
        restart = !!active && !active.paused
        active?.pause()
      }
    },
    resume() {
      if (!ended && held) {
        held = false
        if (restart) active?.play()
        restart = false
      }
    },
    stop,
    refresh,
    snapshot: () => ({
      attached: !ended && valid(),
      playing: !!active && !active.paused && !ended,
      backend: supported() ? 'css-text-clip' : 'plain-text',
    }),
    dispose,
  }
  try {
    off.push(effectOwnership(target, 'gradient', host, dispose))
    owners.set(target, handle)
    paint()
    const changed = () => refresh()
    forced.addEventListener('change', changed)
    off.push(() => forced.removeEventListener('change', changed))
    off.push(
      host.onReduced(() => {
        if (host.reduced()) stop()
      }),
    )
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
        refresh,
      ),
    )
    return handle
  } catch (error) {
    dispose()
    throw error
  }
}
