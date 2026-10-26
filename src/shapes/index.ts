import { Application, type View } from '@nativescript/core'
import { toView } from '../animate.js'
import { parseColor } from '../color.js'
import { onReducedMotion, reducedMotion } from '../config.js'
import { TimedAnimation } from '../timed-animation.js'
import { createTrack, instantTrack, type Track } from '../track.js'
import {
  resolveTransition,
  springs,
  type Transition,
  type SpringName,
} from '../transition.js'
import type { Target } from '../types.js'
import { compatible, pathString, shapePath } from './path.js'
import { createShape, type ShapePainter } from './native.js'
import {
  mixFrame,
  type Shape,
  type ShapeValues,
  type ShapeOptions,
  type ShapeFrame,
  type ShapeStyle,
} from './types.js'
export type { Shape, ShapeValues, ShapeOptions } from './types.js'
const owners = new WeakMap<View, ShapeOwner>()
function number(n: number, name: string, min: number, max: number) {
  if (!Number.isFinite(n) || n < min || n > max)
    throw new RangeError(`${name} must be within ${min}..${max}.`)
  return n
}
function resolve(base: ShapeFrame, values: ShapeValues): ShapeFrame {
  if (
    !values ||
    typeof values !== 'object' ||
    Object.keys(values).some((k) => !['d', 'strokeStart', 'strokeEnd'].includes(k))
  )
    throw new TypeError('Shape values accept d, strokeStart and strokeEnd.')
  const path = values.d === undefined ? base.path : shapePath(values.d)
  const start = number(values.strokeStart ?? base.start, 'strokeStart', 0, 1),
    end = number(values.strokeEnd ?? base.end, 'strokeEnd', 0, 1)
  if (path.contours > 1 && (start !== 0 || end !== 1))
    throw new RangeError(
      'Partial stroke drawing requires one continuous subpath. Compound paths can morph or draw their complete stroke.',
    )
  return { path, start, end }
}
/** Draw an owned native vector surface over a view. Create after native layout. */
export function shape(target: Target, options: ShapeOptions): Shape {
  if (!options || typeof options !== 'object')
    throw new TypeError('Shape options are required.')
  const frame = resolve(
    { path: shapePath(options.d), start: 0, end: 1 },
    { strokeStart: options.strokeStart, strokeEnd: options.strokeEnd },
  )
  const box = options.viewBox
  if (!Array.isArray(box) || box.length !== 4)
    throw new TypeError('viewBox needs [minX, minY, width, height].')
  const viewBox: [number, number, number, number] = [
    number(box[0]!, 'viewBox x', -1000000, 1000000),
    number(box[1]!, 'viewBox y', -1000000, 1000000),
    number(box[2]!, 'viewBox width', 0.001, 1000000),
    number(box[3]!, 'viewBox height', 0.001, 1000000),
  ]
  const style: ShapeStyle = {
    viewBox,
    stroke: parseColor(options.stroke ?? '#202630'),
    fill: parseColor(options.fill ?? '#00000000'),
    width: number(options.strokeWidth ?? 2, 'strokeWidth', 0, 1000),
    cap: options.lineCap ?? 'round',
    join: options.lineJoin ?? 'round',
    rule: options.fillRule ?? 'nonzero',
  }
  if (
    !['butt', 'round', 'square'].includes(style.cap) ||
    !['miter', 'round', 'bevel'].includes(style.join) ||
    !['nonzero', 'evenodd'].includes(style.rule)
  )
    throw new TypeError('Invalid shape cap, join or fill rule.')
  const view = toView(target)
  if (!view.isLoaded || !view.nativeViewProtected)
    throw new Error('Create shapes after native layout.')
  if (owners.has(view))
    throw new Error('This view already owns a shape. Dispose it first.')
  return new ShapeOwner(view, style, frame)
}
class ShapeOwner implements Shape {
  disposed = false
  private painter?: ShapePainter
  private native?: object
  private active?: {
    animation: TimedAnimation
    track: Track
    from: ShapeFrame
    to: ShapeFrame
  }
  private suspended = false
  private backgrounded = false
  private offReduced: () => void
  constructor(
    private readonly view: View,
    private readonly style: ShapeStyle,
    private frame: ShapeFrame,
  ) {
    this.attach()
    owners.set(view, this)
    view.on('loaded', this.layout)
    view.on('layoutChanged', this.layout)
    view.on('unloaded', this.unload)
    Application.on(Application.suspendEvent, this.background)
    Application.on(Application.resumeEvent, this.foreground)
    this.offReduced = onReducedMotion((value) => {
      if (!value || !this.active) return
      const destination = this.active.to
      this.stop()
      this.frame = destination
      this.painter?.paint(destination)
    })
  }
  private alive() {
    if (this.disposed) throw new Error('Shape has been disposed.')
  }
  private attach() {
    this.native = this.view.nativeViewProtected
    this.painter = createShape(this.view, this.style, this.frame)
  }
  private layout = () => {
    if (this.disposed || !this.view.isLoaded || !this.view.nativeViewProtected) return
    if (this.native && this.native !== this.view.nativeViewProtected) this.unload()
    if (!this.painter) {
      this.attach()
      if (this.active) {
        const { from, to, track, animation } = this.active
        this.painter!.play(from, to, track)
        this.painter!.control(animation.time, true)
      }
    }
    this.painter!.resize()
    if (!this.backgrounded && this.suspended) {
      this.active?.animation.play()
      this.suspended = false
    }
  }
  private unload = () => {
    if (this.backgrounded && this.active) this.frame = this.painter?.read() ?? this.frame
    else this.stop()
    this.painter?.dispose()
    this.painter = undefined
    this.native = undefined
  }
  private background = () => {
    if (this.backgrounded) return
    this.backgrounded = true
    this.suspended = !!this.active && !this.active.animation.paused
    if (this.suspended) this.active!.animation.pause()
  }
  private foreground = () => {
    this.backgrounded = false
    if (this.painter) {
      if (this.suspended) this.active?.animation.play()
      this.suspended = false
    }
  }
  snapshot() {
    this.frame = this.painter?.read() ?? this.frame
    return {
      d: pathString(this.frame.path),
      strokeStart: this.frame.start,
      strokeEnd: this.frame.end,
      attached: !!this.painter,
      nativeAnimations: this.painter?.animations() ?? 0,
      bounds: this.painter?.bounds() ?? null,
    }
  }
  set(values: ShapeValues) {
    this.alive()
    const frame = resolve(this.painter?.read() ?? this.frame, values)
    this.stop()
    this.frame = frame
    this.painter?.paint(frame)
  }
  animate(values: ShapeValues, options: Transition | SpringName = {}) {
    this.alive()
    if (!this.painter || !this.view.isLoaded)
      throw new Error('Load the shape before animating.')
    const from = this.painter.read(),
      to = resolve(from, values)
    compatible(from.path, to.path)
    if (typeof options === 'string' && !Object.hasOwn(springs, options))
      throw new TypeError('Unknown shape spring.')
    const settings = typeof options === 'string' ? springs[options] : options
    if ('layer' in settings)
      throw new TypeError(
        'Shapes own one geometry/trim animation; named layers are not supported.',
      )
    const transition = resolveTransition(settings, 'opacity', 2)
    const vector = (f: ShapeFrame) => [f.start, f.end, ...f.path.points]
    const a = vector(from),
      b = vector(to),
      delta = b.map((p, i) => p - a[i]!),
      squared = delta.reduce((s, v) => s + v * v, 0)
    let velocity = 0
    if (this.active && !this.active.animation.paused && squared) {
      const old = this.active,
        speed = old.track.velocityAt(old.animation.time),
        x = vector(old.from),
        y = vector(old.to)
      velocity =
        delta.reduce((s, v, i) => s + v * ((y[i] ?? 0) - (x[i] ?? 0)) * speed, 0) /
        squared
    }
    const track = reducedMotion()
      ? instantTrack('opacity', 1)
      : createTrack('opacity', [0, 1], transition, velocity)
    if (track.times.length * (a.length + 1) > 262144)
      throw new RangeError(
        'Shape animation exceeds the sampled geometry budget. Simplify the path or curve.',
      )
    this.stop()
    let animation: TimedAnimation
    animation = new TimedAnimation(
      track.end,
      track.arrival,
      (time, paused) => this.painter?.control(time, paused),
      (completed) => {
        this.frame = completed
          ? mixFrame(from, to, track.to)
          : (this.painter?.read() ?? this.frame)
        this.painter?.paint(this.frame)
        if (this.active?.animation === animation) this.active = undefined
      },
    )
    this.active = { animation, track, from, to }
    try {
      if (track.end > 0) this.painter.play(from, to, track)
      else {
        this.frame = to
        this.painter.paint(to)
      }
      animation.start()
      if (this.backgrounded && this.active) {
        this.suspended = true
        animation.pause()
      }
    } catch (e) {
      animation.stop()
      throw e
    }
    return animation
  }
  stop() {
    this.active?.animation.stop()
    this.suspended = false
  }
  dispose() {
    if (this.disposed) return
    this.stop()
    this.unload()
    this.disposed = true
    this.offReduced()
    this.view.off('loaded', this.layout)
    this.view.off('layoutChanged', this.layout)
    this.view.off('unloaded', this.unload)
    Application.off(Application.suspendEvent, this.background)
    Application.off(Application.resumeEvent, this.foreground)
    owners.delete(this.view)
  }
}
