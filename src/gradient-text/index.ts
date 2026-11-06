import { Application, Label } from '@nativescript/core'
import { toView } from '../animate.js'
import { parseColor, type ColorValue } from '../color.js'
import { onReducedMotion, reducedMotion } from '../config.js'
import { TimedAnimation } from '../timed-animation.js'
import { createTrack } from '../track.js'
import { resolveTransition, type Transition } from '../transition.js'
import type { Target } from '../types.js'
import type { PlaybackAnimation } from '../playback.js'
import { createTextPainter, type TextPaint, type TextPainter } from './native.js'

export interface GradientTextOptions {
  colors: readonly ColorValue[]
  stops?: readonly number[]
  /** Degrees clockwise from left-to-right; default 0. */
  angle?: number
  sheen?: { color?: ColorValue; width?: number; direction?: 'left' | 'right' }
}
export interface GradientText {
  readonly disposed: boolean
  readonly suspended: boolean
  /** A native band clipped by cached glyphs. Stops preserve the static gradient fill. */
  play(transition?: Transition): PlaybackAnimation
  suspend(): void
  resume(): void
  stop(): void
  refresh(): void
  snapshot(): { attached: boolean; maskBytes: number; playing: boolean }
  dispose(): void
}
const owners = new WeakMap<Label, GradientText>()
const styleEvents = [
  'fontSize',
  'fontFamily',
  'fontWeight',
  'fontStyle',
  'textAlignment',
  'letterSpacing',
  'lineHeight',
  'textTransform',
  'textDecoration',
  'whiteSpace',
  'color',
].map((name) => name + 'Change')

/** Plain native Label text, including multiline shaping. Formatted spans remain outside this API. */
export function gradientText(target: Target, options: GradientTextOptions): GradientText {
  const view = toView(target)
  if (!(view instanceof Label))
    throw new TypeError('gradientText requires a NativeScript Label.')
  if (view.formattedText)
    throw new TypeError('gradientText does not support formattedText spans.')
  if (owners.has(view)) throw new Error('This label already owns gradient text.')
  if (
    !Array.isArray(options.colors) ||
    options.colors.length < 2 ||
    options.colors.length > 8
  )
    throw new TypeError('Gradient text needs 2..8 colors.')
  const colors = options.colors.map(parseColor),
    stops = options.stops
      ? [...options.stops]
      : colors.map((_, i) => i / (colors.length - 1))
  if (
    stops.length !== colors.length ||
    stops.some(
      (stop, i) =>
        !Number.isFinite(stop) || stop < 0 || stop > 1 || (i > 0 && stop < stops[i - 1]!),
    )
  )
    throw new TypeError('Gradient stops must be ordered in 0..1 and match colors.')
  const paint: TextPaint = {
    colors,
    stops,
    angle: options.angle ?? 0,
    sheen: parseColor(options.sheen?.color ?? '#BFFFFFFF'),
    width: options.sheen?.width ?? 0.3,
  }
  const direction = options.sheen?.direction ?? 'right'
  if (direction !== 'left' && direction !== 'right')
    throw new TypeError('Invalid text sheen direction.')
  if (
    !Number.isFinite(paint.angle) ||
    !Number.isFinite(paint.width) ||
    paint.width <= 0 ||
    paint.width > 1
  )
    throw new TypeError('Invalid text gradient angle or sheen width.')
  let disposed = false,
    suspended = false,
    background = Application.suspended,
    resumePlayback = false
  let painter: TextPainter | undefined,
    native: object | undefined,
    active: TimedAnimation | undefined,
    pendingTrack: ReturnType<typeof createTrack> | undefined
  let queued = false,
    started = false
  const held = () => suspended || background
  const hold = () => {
    if (active && !active.paused) {
      resumePlayback = true
      active.pause()
    }
  }
  const continuePlayback = () => {
    if (!held() && painter && resumePlayback) {
      resumePlayback = false
      active?.play()
    }
  }
  const releasePainter = () => {
    painter?.dispose()
    painter = undefined
    native = undefined
  }
  const refresh = () => {
    queued = false
    if (disposed || !view.isLoaded || !view.nativeViewProtected) return
    if (view.formattedText) {
      controller.stop()
      releasePainter()
      return
    }
    if (native && native !== view.nativeViewProtected) {
      controller.stop()
      releasePainter()
    }
    if (!painter) {
      painter = createTextPainter(view, paint)
      native = view.nativeViewProtected
      if (active && pendingTrack) {
        if (pendingTrack.end > 0 && !reducedMotion()) painter.play(pendingTrack)
        if (!active.done) {
          active.seekTime(started ? active.time : 0)
          started = true
          active.start()
          if (held()) hold()
        }
      }
    } else {
      painter.refresh()
      if (active) painter.control(active.time, active.paused)
    }
    continuePlayback()
  }
  const invalidate = () => {
    if (queued || disposed) return
    queued = true
    void Promise.resolve().then(refresh)
  }
  const unload = () => {
    if (held()) hold()
    else controller.stop()
    releasePainter()
  }
  const appSuspend = () => {
    background = true
    hold()
  }
  const appResume = () => {
    background = false
    refresh()
    continuePlayback()
  }
  const controller: GradientText = {
    get disposed() {
      return disposed
    },
    get suspended() {
      return suspended
    },
    play(transition = { duration: 1200, ease: 'linear' }) {
      if (disposed) throw new Error('Gradient text is disposed.')
      const track = createTrack(
        'x',
        direction === 'left' ? [1, 0] : [0, 1],
        resolveTransition(transition, 'x', 2),
        0,
      )
      controller.stop()
      const animation = new TimedAnimation(
        track.end,
        track.arrival,
        (time, paused) => painter?.control(time, paused),
        () => {
          painter?.stop()
          if (active === animation) {
            active = undefined
            pendingTrack = undefined
          }
        },
      )
      active = animation
      pendingTrack = track
      try {
        refresh()
        if (painter && active === animation) {
          if (!reducedMotion() && track.end > 0) painter.play(track)
          if (!started) animation.seekTime(0)
          started = true
          animation.start()
          if (held()) hold()
        }
      } catch (error) {
        animation.stop()
        throw error
      }
      return animation
    },
    suspend() {
      if (!disposed) {
        suspended = true
        hold()
      }
    },
    resume() {
      if (!disposed) {
        suspended = false
        continuePlayback()
      }
    },
    stop() {
      active?.stop()
      active = undefined
      pendingTrack = undefined
      resumePlayback = false
      started = false
      painter?.stop()
    },
    refresh: invalidate,
    snapshot: () => ({
      attached: !!painter,
      maskBytes: painter?.bytes() ?? 0,
      playing: !!active && !active.paused,
    }),
    dispose() {
      if (disposed) return
      disposed = true
      controller.stop()
      releasePainter()
      offReduced()
      view.off('loaded', invalidate)
      view.off('layoutChanged', invalidate)
      view.off('unloaded', unload)
      view.off('textChange', invalidate)
      view.off('formattedTextChange', invalidate)
      styleEvents.forEach((event) => view.style.off(event, invalidate))
      Application.off(Application.suspendEvent, appSuspend)
      Application.off(Application.resumeEvent, appResume)
      owners.delete(view)
    },
  }
  const offReduced = onReducedMotion((value) => {
    if (value) controller.stop()
  })
  owners.set(view, controller)
  view.on('loaded', invalidate)
  view.on('layoutChanged', invalidate)
  view.on('unloaded', unload)
  view.on('textChange', invalidate)
  view.on('formattedTextChange', invalidate)
  styleEvents.forEach((event) => view.style.on(event, invalidate))
  Application.on(Application.suspendEvent, appSuspend)
  Application.on(Application.resumeEvent, appResume)
  try {
    refresh()
  } catch (error) {
    controller.dispose()
    throw error
  }
  return controller
}
