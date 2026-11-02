import { consumeScroll } from '../core/gesture-math.js'
import { solveDecay, DEFAULT_FRICTION } from '../core/decay.js'
import type { FrameTask } from './scheduler.js'
import type { InteractionHost } from './interaction.js'

export interface WebGestureScrollOptions {
  /** Declared descendant scroll container. Its eligible nested containers join automatically. */
  element: HTMLElement
  axis?: 'x' | 'y'
  friction?: number
}
export function createGestureScroll(
  surface: HTMLElement,
  options: WebGestureScrollOptions,
  host: InteractionHost,
) {
  const element = options.element,
    axis = options.axis ?? 'y'
  const view = surface.ownerDocument.defaultView! as Window & typeof globalThis
  const friction = options.friction ?? DEFAULT_FRICTION
  if (
    !(element instanceof view.HTMLElement) ||
    !surface.contains(element) ||
    !['x', 'y'].includes(axis)
  )
    throw new TypeError(
      'Gesture scroll requires a descendant container and a valid axis.',
    )
  if (!Number.isFinite(friction) || friction <= 0 || friction >= 1)
    throw new RangeError('Scroll friction must be between zero and one.')
  let chain: HTMLElement[] = [element],
    animation: FrameTask | undefined
  // Some engines expose integer scroll offsets. Preserve subpixel input instead
  // of rounding every pointer delta, and discard it when an external scroll wins.
  let fractions = new WeakMap<
    HTMLElement,
    { requested: number; actual: number; max: number }
  >()
  const metric = (node: HTMLElement) => {
    const max = Math.max(
      0,
      axis === 'y'
        ? node.scrollHeight - node.clientHeight
        : node.scrollWidth - node.clientWidth,
    )
    const rtl = axis === 'x' && view.getComputedStyle(node).direction === 'rtl'
    const actual =
      axis === 'y' ? node.scrollTop : rtl ? max + node.scrollLeft : node.scrollLeft
    const previous = fractions.get(node)
    return {
      position:
        previous && previous.actual === actual && previous.max === max
          ? previous.requested
          : actual,
      max,
      rtl,
    }
  }
  const stop = () => {
    if (animation) host.scheduler.remove(animation)
    animation = undefined
  }
  const consume = (delta: number, panel: number, bounds: readonly [number, number]) => {
    chain = chain.filter((node) => node.isConnected && surface.contains(node))
    const metrics = chain.map(metric),
      next = consumeScroll(delta, panel, bounds, metrics)
    chain.forEach((node, i) => {
      if (axis === 'y') node.scrollTop = next.scroll[i]!
      else node.scrollLeft = next.scroll[i]! - (metrics[i]!.rtl ? metrics[i]!.max : 0)
      fractions.set(node, {
        requested: next.scroll[i]!,
        actual:
          axis === 'y'
            ? node.scrollTop
            : node.scrollLeft + (metrics[i]!.rtl ? metrics[i]!.max : 0),
        max: metrics[i]!.max,
      })
    })
    return next
  }
  return {
    axis,
    stop,
    begin(event: PointerEvent) {
      stop()
      fractions = new WeakMap()
      chain = []
      for (const node of event.composedPath()) {
        if (node instanceof view.HTMLElement && element.contains(node)) {
          const css = view.getComputedStyle(node),
            overflow = axis === 'y' ? css.overflowY : css.overflowX
          if (node === element || /auto|scroll/.test(overflow)) chain.push(node)
        }
        if (node === element) break
      }
      if (!chain.includes(element)) chain = [element]
    },
    consume,
    release(
      velocity: number,
      panel: () => number,
      bounds: () => readonly [number, number],
      write: (position: number) => void,
    ) {
      stop()
      if (host.reduced() || Math.abs(velocity) < 1) return
      const curve = solveDecay(0, velocity, friction, 0.25),
        start = host.scheduler.now()
      let last = 0
      animation = {
        update(time) {
          const elapsed = time - start,
            value = curve.position(elapsed),
            delta = value - last
          last = value
          const next = consume(delta, panel(), bounds())
          write(next.panel)
          if (elapsed < curve.duration && Math.abs(next.remaining) < Math.abs(delta))
            return true
          animation = undefined
        },
      }
      host.scheduler.add(animation)
    },
    get active() {
      return animation !== undefined
    },
  }
}
