import { shapePath, compatible, pathString, type ShapePath } from '../core/shape-path.js'
import { createTrack } from '../core/track.js'
import { resolveTransition } from '../core/transition.js'
import {
  decorativeLayer,
  EffectAnimation,
  effectOptions,
  effectOwnership,
  effectTarget,
  positioned,
  type EffectHost,
  type EffectTransition,
} from './effect.js'
import { valuePlan } from './value-playback.js'
import { parseColor } from './style.js'
import { colorCSS } from './properties.js'
import { bounded } from './surface-effect.js'
import type { WebAnimation } from './public.js'

export interface WebShapeValues {
  d?: string
  strokeStart?: number
  strokeEnd?: number
}
export interface WebShapeOptions extends WebShapeValues {
  d: string
  viewBox: readonly [number, number, number, number]
  stroke?: string
  fill?: string
  strokeWidth?: number
  lineCap?: 'butt' | 'round' | 'square'
  lineJoin?: 'miter' | 'round' | 'bevel'
  fillRule?: 'nonzero' | 'evenodd'
  /** Default stop/dispose on DOM removal; pause retains the drawing for reattachment. */
  unload?: 'stop' | 'pause'
}
export interface WebShape {
  readonly disposed: boolean
  readonly suspended: boolean
  animate(values: WebShapeValues, transition?: EffectTransition): WebAnimation
  set(values: WebShapeValues): void
  snapshot(): { d: string; strokeStart: number; strokeEnd: number; attached: boolean }
  stop(): void
  suspend(): void
  resume(): void
  dispose(): void
}
type Frame = { path: ShapePath; start: number; end: number }
function resolve(base: Frame, values: WebShapeValues): Frame {
  effectOptions(values, ['d', 'strokeStart', 'strokeEnd'])
  const path = values.d === undefined ? base.path : shapePath(values.d)
  const start = bounded(values.strokeStart ?? base.start, 'strokeStart', 0, 1),
    end = bounded(values.strokeEnd ?? base.end, 'strokeEnd', 0, 1)
  if (path.contours > 1 && (start !== 0 || end !== 1))
    throw new RangeError('Partial stroke drawing requires one continuous subpath.')
  return { path, start, end }
}
export function createShape(
  target: HTMLElement,
  options: WebShapeOptions,
  host: EffectHost,
): WebShape {
  effectTarget(target, host)
  effectOptions(options, [
    'd',
    'unload',
    'viewBox',
    'stroke',
    'fill',
    'strokeWidth',
    'lineCap',
    'lineJoin',
    'fillRule',
    'strokeStart',
    'strokeEnd',
  ])
  if (
    options.unload !== undefined &&
    options.unload !== 'stop' &&
    options.unload !== 'pause'
  )
    throw new TypeError('Invalid shape unload policy.')
  let frame = resolve(
    { path: shapePath(options.d), start: 0, end: 1 },
    { strokeStart: options.strokeStart, strokeEnd: options.strokeEnd },
  )
  if (!Array.isArray(options.viewBox) || options.viewBox.length !== 4)
    throw new TypeError('viewBox needs four numbers.')
  const box = Array.from(options.viewBox, (n, i) =>
    bounded(n, 'viewBox', i < 2 ? -1000000 : 0.001, 1000000),
  )
  const stroke = colorCSS(parseColor(host.document, options.stroke ?? '#202630')),
    fill = colorCSS(parseColor(host.document, options.fill ?? 'transparent'))
  const width = bounded(options.strokeWidth ?? 2, 'strokeWidth', 0, 1000)
  const cap = options.lineCap ?? 'round',
    join = options.lineJoin ?? 'round',
    rule = options.fillRule ?? 'nonzero'
  if (
    !['butt', 'round', 'square'].includes(cap) ||
    !['miter', 'round', 'bevel'].includes(join) ||
    !['nonzero', 'evenodd'].includes(rule)
  )
    throw new TypeError('Invalid shape cap, join or fill rule.')
  const layer = decorativeLayer(target, 'shape')
  const svg = host.document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', box.join(' '))
  svg.setAttribute('width', '100%')
  svg.setAttribute('height', '100%')
  svg.style.display = 'block'
  const filled = host.document.createElementNS(
    svg.namespaceURI!,
    'path',
  ) as SVGPathElement
  filled.setAttribute('fill', fill)
  filled.setAttribute('fill-rule', rule)
  const line = host.document.createElementNS(svg.namespaceURI!, 'path') as SVGPathElement
  line.setAttribute('fill', 'none')
  line.setAttribute('stroke', stroke)
  line.setAttribute('stroke-width', String(width))
  line.setAttribute('stroke-linecap', cap)
  line.setAttribute('stroke-linejoin', join)
  svg.append(filled, line)
  layer.append(svg)
  let ended = false,
    held = false,
    detached = false,
    restart = false
  let active: EffectAnimation | undefined
  const off: (() => void)[] = []
  const paint = () => {
    if (ended) return
    const d = pathString(frame.path)
    filled.setAttribute('d', d)
    line.setAttribute('d', d)
    const length = line.getTotalLength()
    const visible = Math.max(0, frame.end - frame.start) * length
    line.setAttribute(
      'stroke-dasharray',
      frame.start === 0 && frame.end === 1 ? 'none' : `${visible} ${length + 1}`,
    )
    line.setAttribute('stroke-dashoffset', String(-frame.start * length))
    line.style.visibility = visible === 0 ? 'hidden' : 'visible'
  }
  const stop = () => {
    active?.stop()
    active = undefined
  }
  const dispose = () => {
    if (ended) return
    stop()
    ended = true
    layer.remove()
    for (const release of off.splice(0).reverse()) release()
  }
  const intact = () =>
    target.ownerDocument === host.document &&
    layer.parentNode === target &&
    svg.parentNode === layer
  const valid = () => target.isConnected && intact()
  const hold = () => {
    if (active && !active.paused) {
      restart = true
      active.pause()
    }
  }
  const continuePlayback = () => {
    if (held || detached || ended) return
    if (restart) active?.play()
    restart = false
  }
  const retainDetached = () => {
    if (ended || options.unload !== 'pause' || target.isConnected || !intact())
      return false
    detached = true
    hold()
    return true
  }
  const assert = () => {
    if (ended || !valid()) {
      if (!retainDetached()) dispose()
      throw new Error('Shape is disposed or detached.')
    }
  }
  const handle: WebShape = {
    get disposed() {
      return ended
    },
    get suspended() {
      return held
    },
    animate(values, transition = {}) {
      assert()
      const to = resolve(frame, values)
      compatible(frame.path, to.path)
      const config = valuePlan(transition)
      if (config.layer !== undefined)
        throw new TypeError('Shapes own their geometry channels.')
      const track = createTrack(
        'x',
        [0, 1],
        resolveTransition(config, 'x', 2),
        0,
        host.settings(),
      )
      if (!Number.isFinite(track.end))
        throw new RangeError('Shape playback must be finite.')
      stop()
      const from = frame
      const render = (time: number) => {
        const t = track.valueAt(time)
        frame = {
          path: {
            ...from.path,
            points: from.path.points.map((p, i) => p + (to.path.points[i]! - p) * t),
          },
          start: Math.max(0, Math.min(1, from.start + (to.start - from.start) * t)),
          end: Math.max(0, Math.min(1, from.end + (to.end - from.end) * t)),
        }
        paint()
      }
      active = new EffectAnimation(host, track.end, [], render, (completed, time) => {
        render(completed ? track.end : time)
        active = undefined
      })
      if (held || detached) {
        active.pause()
        restart = true
      }
      return active
    },
    set(values) {
      assert()
      const to = resolve(frame, values)
      stop()
      frame = to
      paint()
    },
    snapshot: () => ({
      d: pathString(frame.path),
      strokeStart: frame.start,
      strokeEnd: frame.end,
      attached: !ended && valid(),
    }),
    stop,
    suspend() {
      if (held || ended) return
      held = true
      hold()
    },
    resume() {
      if (!held || ended) return
      held = false
      if (valid()) detached = false
      continuePlayback()
    },
    dispose,
  }
  try {
    off.push(effectOwnership(target, 'shape', host, dispose), positioned(target))
    target.append(layer)
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
          retainDetached,
        },
        () => {
          if (!valid()) {
            if (!retainDetached()) dispose()
          } else if (detached) {
            detached = false
            continuePlayback()
          }
        },
      ),
    )
    return handle
  } catch (error) {
    dispose()
    throw error
  }
}
