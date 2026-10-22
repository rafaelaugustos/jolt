import { isAndroid, isIOS, type View } from '@nativescript/core'
import { toView } from './animate.js'
import { colorMixer, parseColor, type ColorValue } from './color.js'
import { reducedMotion } from './config.js'
import { getDriver } from './driver/index.js'
import { androidGradient } from './driver/android-gradient.js'
import { iosGradient } from './driver/ios-gradient.js'
import type { Animation } from './engine.js'
import { createTrack, type Track } from './track.js'
import {
  resolveTransition,
  springs,
  type SpringName,
  type Transition,
} from './transition.js'
import type { Target } from './types.js'

export type GradientType = 'linear' | 'radial' | 'conic'

export interface GradientValues {
  /** Two to eight colors. Animating keeps the count. */
  colors?: readonly ColorValue[]
  /** Where each color sits, from 0 to 1. Evenly spaced by default. */
  stops?: readonly number[]
  /** Degrees, like CSS: `linear` points this way (180 runs top to bottom), `conic` starts here (0 is up). */
  angle?: number
  /** `radial` and `conic`: the center, in fractions of the view's width and height. */
  center?: { readonly x: number; readonly y: number }
  /** `radial`: the radius, in fractions of the view's shorter side. */
  radius?: number
}

export interface GradientOptions extends GradientValues {
  type: GradientType
  colors: readonly ColorValue[]
}

export interface Gradient {
  readonly type: GradientType
  /** Animates to new values from the ones on screen. Colors and stops keep their count. */
  animate(values: GradientValues, transition?: Transition | SpringName): Animation
  /** Applies values at once, stopping the animation in progress. */
  set(values: GradientValues): void
  /** Stops the animation in progress where it is. */
  stop(): void
  /** Takes the gradient off the view. */
  remove(): void
}

/** Everything the platform needs to paint one frame. */
export interface GradientFrame {
  colors: number[]
  stops: number[]
  angle: number
  x: number
  y: number
  radius: number
}

export interface GradientTiming {
  duration: number
  delay: number
  repeat: number
  reverse: boolean
}

export interface GradientPainter {
  paint(frame: GradientFrame): void
  /** Plays sampled frames natively; `onEnd(false)` when cancelled. */
  play(
    frames: readonly GradientFrame[],
    times: readonly number[],
    timing: GradientTiming,
    onEnd: (finished: boolean) => void,
  ): { cancel(): void }
  remove(): void
}

type PainterFactory = (view: View, type: GradientType) => GradientPainter | undefined

let factory: PainterFactory | undefined

/** Test seam, like `setDriver`. */
export function setGradientPainter(next: PainterFactory | undefined) {
  factory = next
}

function platformPainter(view: View, type: GradientType) {
  if (isIOS) return iosGradient(view, type)
  if (isAndroid) return androidGradient(view, type)
  return undefined
}

const types: readonly GradientType[] = ['linear', 'radial', 'conic']

/**
 * Paints a native gradient behind a layout's children and animates it.
 *
 * ```ts
 * const glow = gradient(halo, { type: 'radial', colors: ['#FF0080', '#7928CA00'], radius: 0.8 })
 * glow.animate({ center: { x: 0.8, y: 0.2 }, radius: 1.2 }, { duration: 2000 })
 * ```
 */
export function gradient(target: Target, options: GradientOptions): Gradient {
  const view = toView(target)
  if (!options || !types.includes(options.type))
    throw new TypeError(`Gradient type must be 'linear', 'radial' or 'conic'.`)
  const first = resolve(
    { colors: [], stops: [], angle: 180, x: 0.5, y: 0.5, radius: 0.5 },
    options,
    false,
  )
  return new GradientController(view, options.type, first)
}

class GradientController implements Gradient {
  private painter: GradientPainter | undefined
  private pending: GradientFrame | undefined
  private removed = false
  private model: GradientFrame
  private running:
    | {
        from: GradientFrame
        to: GradientFrame
        track: Track
        startedAt: number
        handle: { cancel(): void }
        settle: (finished: boolean) => void
      }
    | undefined

  constructor(
    private readonly view: View,
    readonly type: GradientType,
    frame: GradientFrame,
  ) {
    this.model = frame
    this.attach((factory ?? platformPainter)(view, type))
    view.on('unloaded', this.unloaded)
  }

  private unloaded = () => this.stop()

  private attach(painter: GradientPainter | undefined) {
    if (!painter) return
    if (this.removed) return painter.remove()
    this.painter = painter
    painter.paint(this.pending ?? this.model)
    this.pending = undefined
  }

  animate(values: GradientValues, transition?: Transition | SpringName): Animation {
    this.assertActive()
    const from = this.presented()
    const to = resolve(from, values, true)
    const resolved =
      typeof transition === 'string' ? springOf(transition) : (transition ?? {})
    const track = createTrack(
      'opacity',
      [0, 1],
      resolveTransition(resolved, 'opacity', 2),
      0,
    )
    const reduced = reducedMotion()
    const frameAt = (progress: number) => mix(from, to, progress, reduced)
    this.cancelRunning()
    this.model = frameAt(track.to)

    let settle!: (finished: boolean) => void
    const finished = new Promise<boolean>((resolve) => (settle = resolve))
    const animation: Animation = {
      finished,
      stop: () => {
        if (this.running?.settle === settle) this.stop()
      },
      then: (onfulfilled, onrejected) => finished.then(onfulfilled, onrejected),
    }
    if (track.end === 0 || !this.painter) {
      this.paint(this.model)
      settle(true)
      return animation
    }
    const handle = this.painter.play(
      track.values.map(frameAt),
      track.times,
      {
        duration: track.duration,
        delay: track.delay,
        repeat: track.repeat,
        reverse: track.reverse,
      },
      (completed) => {
        if (this.running?.settle !== settle) return
        this.running = undefined
        settle(completed)
      },
    )
    this.running = {
      from,
      to,
      track,
      startedAt: getDriver().now(),
      handle,
      settle,
    }
    return animation
  }

  set(values: GradientValues) {
    this.assertActive()
    const next = resolve(this.presented(), values, false)
    this.cancelRunning()
    this.model = next
    this.paint(next)
  }

  stop() {
    if (!this.running) return
    const current = this.presented()
    this.cancelRunning()
    this.model = current
    this.paint(current)
  }

  remove() {
    if (this.removed) return
    this.cancelRunning()
    this.removed = true
    this.view.off('unloaded', this.unloaded)
    this.painter?.remove()
    this.painter = undefined
  }

  private paint(frame: GradientFrame) {
    if (this.painter) this.painter.paint(frame)
    else this.pending = frame
  }

  private presented(): GradientFrame {
    const running = this.running
    if (!running) return this.model
    const elapsed = getDriver().now() - running.startedAt
    return mix(running.from, running.to, running.track.valueAt(elapsed), reducedMotion())
  }

  private cancelRunning() {
    const running = this.running
    if (!running) return
    this.running = undefined
    running.handle.cancel()
    running.settle(false)
  }

  private assertActive() {
    if (this.removed) throw new Error('This gradient was removed.')
  }
}

function springOf(name: SpringName): Transition {
  const spring = springs[name]
  if (!spring || !Object.hasOwn(springs, name))
    throw new Error(`Unknown spring "${name}".`)
  return spring
}

/** Validates values and fills in what they leave out from `base`. */
function resolve(
  base: GradientFrame,
  values: GradientValues,
  sameCount: boolean,
): GradientFrame {
  if (!values || typeof values !== 'object')
    throw new TypeError('Gradient values must be an object.')
  const colors = values.colors ? values.colors.map(parseColor) : base.colors
  if (colors.length < 2 || colors.length > 8)
    throw new RangeError('A gradient needs between two and eight colors.')
  if (sameCount && values.colors && colors.length !== base.colors.length)
    throw new RangeError(
      `Animating a gradient keeps its ${base.colors.length} colors; use set() to change the count.`,
    )
  const stops = values.stops
    ? [...values.stops]
    : values.colors || base.stops.length !== colors.length
      ? colors.map((_, i) => i / (colors.length - 1))
      : base.stops
  if (
    stops.length !== colors.length ||
    stops.some(
      (stop, i) =>
        !Number.isFinite(stop) || stop < 0 || stop > 1 || stop < (stops[i - 1] ?? 0),
    )
  )
    throw new RangeError(
      'Gradient stops need one value per color, from 0 to 1, without going back.',
    )
  const angle = values.angle ?? base.angle
  const x = values.center?.x ?? base.x
  const y = values.center?.y ?? base.y
  const radius = values.radius ?? base.radius
  for (const [name, value] of [
    ['angle', angle],
    ['center', x],
    ['center', y],
    ['radius', radius],
  ] as const)
    if (!Number.isFinite(value))
      throw new RangeError(`Invalid gradient ${name}: ${value}.`)
  if (radius < 0)
    throw new RangeError(`Gradient radius must not be negative, got ${radius}.`)
  return { colors, stops, angle, x, y, radius }
}

/** One frame between two states. Geometry follows the curve, overshoot included; colors and stops stay between their ends. */
export function mix(
  from: GradientFrame,
  to: GradientFrame,
  progress: number,
  reduced = false,
): GradientFrame {
  const p = Math.min(Math.max(progress, 0), 1)
  const g = reduced ? 1 : progress
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t
  return {
    colors: to.colors.map((color, i) => colorMixer(from.colors[i] ?? color, color)(p)),
    stops: to.stops.map((stop, i) => lerp(from.stops[i] ?? stop, stop, p)),
    angle: lerp(from.angle, to.angle, g),
    x: lerp(from.x, to.x, g),
    y: lerp(from.y, to.y, g),
    radius: Math.max(0, lerp(from.radius, to.radius, g)),
  }
}

/**
 * The points a platform gradient needs, in unit coordinates of a `width` × `height` box.
 * Linear follows CSS: the line runs through the center at `angle` and is long enough
 * for the corners to get the first and last colors.
 */
export function gradientPoints(
  type: GradientType,
  frame: GradientFrame,
  width: number,
  height: number,
) {
  const radians = (frame.angle * Math.PI) / 180
  const sin = Math.sin(radians)
  const cos = Math.cos(radians)
  if (type === 'linear') {
    // Core Animation keeps an axial gradient's bands square to its line in unit space, so
    // on a box that isn't square the line leans to keep them square to `angle` on screen.
    const ux = height > 0 ? sin / height : 0
    const uy = width > 0 ? -cos / width : 0
    const squared = ux * ux + uy * uy
    const reach = squared > 0 ? (Math.abs(ux) + Math.abs(uy)) / (2 * squared) : 0
    return {
      start: { x: 0.5 - ux * reach, y: 0.5 - uy * reach },
      end: { x: 0.5 + ux * reach, y: 0.5 + uy * reach },
    }
  }
  const center = { x: frame.x, y: frame.y }
  const shorter = Math.min(width, height)
  if (type === 'radial') {
    const r = frame.radius * shorter
    return {
      start: center,
      end: {
        x: center.x + (width > 0 ? r / width : 0),
        y: center.y + (height > 0 ? r / height : 0),
      },
    }
  }
  return {
    start: center,
    end: {
      x: center.x + (width > 0 ? (sin * shorter) / (2 * width) : 0),
      y: center.y + (height > 0 ? (-cos * shorter) / (2 * height) : 0),
    },
  }
}
