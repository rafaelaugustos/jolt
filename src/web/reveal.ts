import { createTrack } from '../core/track.js'
import { resolveTransition } from '../core/transition.js'
import { flatten, sampled } from './curve.js'
import { borderBox } from './style.js'
import {
  EffectAnimation,
  EffectStyles,
  effectOptions,
  effectTarget,
  finiteOption,
  type EffectHost,
} from './effect.js'

export interface WebRevealOptions {
  from?: { x: number; y: number }
  duration?: number
}
export interface WebConcealOptions {
  to?: { x: number; y: number }
  duration?: number
}
type Circle = { x: number; y: number; radius: number }
type Active = { host: EffectHost; circle(): Circle; stop(): void }
const active = new WeakMap<HTMLElement, Active>()

export function createReveal(
  target: HTMLElement,
  opening: boolean,
  options: WebRevealOptions | WebConcealOptions,
  host: EffectHost,
) {
  const view = effectTarget(target, host)
  effectOptions(options, [opening ? 'from' : 'to', 'duration'])
  const duration = finiteOption(options.duration ?? 400, 'Reveal duration')
  const point = opening
    ? (options as WebRevealOptions).from
    : (options as WebConcealOptions).to
  if (point !== undefined) {
    effectOptions(point, ['x', 'y'])
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
      throw new TypeError('Reveal origin requires finite x/y coordinates.')
  }
  const before = active.get(target)
  if (before && before.host.identity !== host.identity)
    throw new Error('The reveal belongs to another motion context.')
  const bounds = borderBox(target),
    x = point?.x ?? bounds.width / 2,
    y = point?.y ?? bounds.height / 2
  const radius = Math.max(
    Math.hypot(x, y),
    Math.hypot(bounds.width - x, y),
    Math.hypot(x, bounds.height - y),
    Math.hypot(bounds.width - x, bounds.height - y),
  )
  const initial = before?.circle() ?? { x, y, radius: opening ? 0 : radius }
  const destination = { x, y, radius: opening ? radius : 0 }
  const track = createTrack(
    'x',
    [0, 1],
    resolveTransition({ duration, ease: 'easeInOut' }, 'x', 2),
    0,
    host.settings(),
  )
  const points = flatten(track, host.maxKeyframes)
  before?.stop()
  const styles = new EffectStyles(target),
    css = view.getComputedStyle(target)
  // A separate mask intersects existing authored clipping instead of replacing it.
  const useMask = css.clipPath !== 'none'
  const originalMask = css.maskImage
  const originalVisibility = target.style.visibility
  const from = (time: number): Circle => {
    const p = sampled(points, time)
    return {
      x: initial.x + (destination.x - initial.x) * p,
      y: initial.y + (destination.y - initial.y) * p,
      radius: Math.max(0, initial.radius + (destination.radius - initial.radius) * p),
    }
  }
  const circleCSS = (circle: Circle) =>
    `circle(${circle.radius}px at ${circle.x}px ${circle.y}px)`
  let animation: EffectAnimation | undefined
  const off: (() => void)[] = []
  const entry: Active = {
    host,
    circle: () => {
      if (!useMask) {
        const shown = view
          .getComputedStyle(target)
          .clipPath.match(/^circle\(([\d.e+-]+)px at ([\d.e+-]+)px ([\d.e+-]+)px\)$/)
        if (shown)
          return { radius: Number(shown[1]), x: Number(shown[2]), y: Number(shown[3]) }
      }
      return from(animation?.time() ?? 0)
    },
    stop: () => animation?.stop(),
  }
  const mask = (time: number) => {
    const c = from(time)
    const image =
      c.radius <= 0.001
        ? 'linear-gradient(transparent,transparent)'
        : `radial-gradient(circle at ${c.x}px ${c.y}px,#000 ${c.radius}px,transparent ${c.radius + 0.1}px)`
    styles.set('mask-image', originalMask === 'none' ? image : `${image},${originalMask}`)
  }
  try {
    styles.set('visibility', 'visible')
    if (useMask) {
      for (const [name, value] of [
        ['mask-composite', 'intersect'],
        ['mask-mode', 'alpha'],
        ['mask-size', 'auto'],
        ['mask-repeat', 'no-repeat'],
        ['mask-position', '0% 0%'],
      ] as const)
        styles.set(name, `${value},${css.getPropertyValue(name)}`)
      mask(0)
    } else styles.set('clip-path', circleCSS(initial))
    animation = new EffectAnimation(
      host,
      track.end,
      useMask || !track.end
        ? []
        : [
            {
              target,
              frames: points.map((p) => ({
                offset: p.time / track.end,
                clipPath: circleCSS(from(p.time)),
              })),
            },
          ],
      useMask ? mask : undefined,
      (completed) => {
        for (const cleanup of off.splice(0).reverse()) cleanup()
        const ownVisibility =
          target.style.visibility === 'visible' &&
          !target.style.getPropertyPriority('visibility')
        styles.restore()
        if (completed && ownVisibility)
          target.style.visibility = opening
            ? originalVisibility === 'hidden'
              ? 'visible'
              : originalVisibility
            : 'hidden'
        if (active.get(target) === entry) active.delete(target)
      },
    )
    active.set(target, entry)
    const refresh = () => {
      if (
        !target.isConnected ||
        target.ownerDocument !== host.document ||
        !styles.owns()
      ) {
        animation?.stop()
        return
      }
      const size = borderBox(target)
      // Reusing old coordinates after layout changes could leave content masked.
      if (
        Math.abs(size.width - bounds.width) > 0.5 ||
        Math.abs(size.height - bounds.height) > 0.5
      )
        animation?.stop()
    }
    off.push(host.register(target, animation, refresh))
    const resize = new view.ResizeObserver(refresh)
    resize.observe(target)
    off.push(() => resize.disconnect())
    return animation
  } catch (error) {
    animation?.stop()
    for (const cleanup of off.splice(0).reverse()) cleanup()
    styles.restore()
    throw error
  }
}
