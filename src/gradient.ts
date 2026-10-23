import { Application, Trace, isAndroid, isIOS, type View } from '@nativescript/core'
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
import { createClock, type PlaybackClock } from './playback.js'
import {
  cloneFrame,
  gradientPatch,
  gradientProgram,
  put,
  take,
  type GradientBindings,
  type GradientComponent,
  type GradientPatch,
  type GradientSource,
} from './gradient-binding.js'
export type { GradientBindings } from './gradient-binding.js'

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

export interface GradientOptions extends GradientBindings {
  type: GradientType
  colors: NonNullable<GradientBindings['colors']>
}

export interface Gradient {
  readonly type: GradientType
  /** Animates to new values from the ones on screen. Colors and stops keep their count. */
  animate(values: GradientValues, transition?: Transition | SpringName): Animation
  /** Applies values at once, stopping the animation in progress. */
  set(values: GradientValues): void
  /** Holds the current frame and detaches all gradient bindings; sources keep running. */
  stop(): void
  /** Attach mixed static/value components. Cleanup holds their current values; newer owners survive. */
  bind(values: GradientBindings): () => void
  /** Whether this gradient is explicitly suspended (independent of app/view lifecycle). */
  readonly suspended: boolean
  /** Hold and detach source subscriptions until resume; source playback is not paused. */
  suspend(): void
  /** Catch up to current source positions and reattach once. */
  resume(): void
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
  ): { cancel(): void; control?(elapsed: number, paused: boolean): void }
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
  const { frame, patch } = prepareGradient(options)
  return new GradientController(view, options.type, frame, patch)
}

/** Validate declarative replacements before removing their current native layer. */
export function prepareGradient(options: GradientOptions) {
  if (!options || !types.includes(options.type))
    throw new TypeError(`Gradient type must be 'linear', 'radial' or 'conic'.`)
  if (!options.colors)
    throw new RangeError('A gradient needs between two and eight colors.')
  const base: GradientFrame = {
    colors: [],
    stops: [],
    angle: 180,
    x: 0.5,
    y: 0.5,
    radius: 0.5,
  }
  const patch = gradientPatch(options, 0)
  const prepared = gradientProgram(
    { at: () => base, remaining: 0, elapsed: () => 0 },
    patch,
  )
  return { frame: prepared.current, patch }
}

interface GradientRun {
  from: GradientFrame
  to: GradientFrame
  track: Track
  keys: Set<GradientComponent>
  masked: Set<GradientComponent>
  clock: PlaybackClock
  cancelEnd?: () => void
  settle(finished: boolean): void
}

class GradientController implements Gradient {
  private painter: GradientPainter | undefined
  private player: ReturnType<GradientPainter['play']> | undefined
  private program: ReturnType<typeof gradientProgram> | undefined
  private model: GradientFrame
  private removed = false
  private _suspended = false
  private background = false
  private unloadedView = false
  private running: GradientRun | undefined
  private bindings = new Map<
    GradientComponent,
    { source: GradientSource; owner: object }
  >()
  private releases: (() => void)[] = []
  private cancelWindow?: () => void
  private generation = 0

  constructor(
    private readonly view: View,
    readonly type: GradientType,
    frame: GradientFrame,
    patch: GradientPatch,
  ) {
    this.model = frame
    const owner = {}
    for (const [key, source] of patch)
      if (typeof source !== 'number') this.bindings.set(key, { source, owner })
    this.painter = (factory ?? platformPainter)(view, type)
    view.on('unloaded', this.unloaded)
    view.on('loaded', this.loaded)
    view.on('layoutChanged', this.resized)
    Application.on(Application.suspendEvent, this.appSuspended)
    Application.on(Application.resumeEvent, this.appResumed)
    this.subscribe()
    this.render()
  }

  private get inactive() {
    return this.removed || this._suspended || this.background || this.unloadedView
  }
  private patch() {
    return new Map([...this.bindings].map(([key, entry]) => [key, entry.source]))
  }
  private base() {
    const run = this.running
    const elapsed = run?.clock.time() ?? 0
    const model = cloneFrame(this.model)
    return {
      remaining: run ? Math.max(0, run.track.end - elapsed) : 0,
      elapsed: () => (run ? Math.max(0, run.clock.time() - elapsed) : 0),
      at: (delta: number) => {
        const frame = cloneFrame(model)
        if (run) {
          const sample = mix(
            run.from,
            run.to,
            run.track.valueAt(elapsed + delta),
            reducedMotion(),
          )
          for (const key of run.keys)
            if (!run.masked.has(key)) put(frame, key, take(sample, key))
        }
        return frame
      },
    }
  }
  private presented(): GradientFrame {
    if (this.inactive) return cloneFrame(this.model)
    try {
      return gradientProgram(this.base(), this.patch()).current
    } catch {
      return (
        this.program?.at(Math.min(this.program.duration, this.program.elapsed())) ??
        cloneFrame(this.model)
      )
    }
  }
  private clearPlayer() {
    this.generation++
    this.cancelWindow?.()
    this.cancelWindow = undefined
    const player = this.player
    this.player = undefined
    player?.cancel()
  }
  private unsubscribe() {
    for (const release of this.releases) release()
    this.releases = []
  }
  private subscribe() {
    this.unsubscribe()
    if (this.inactive) return
    const sources = new Map<object, GradientSource>()
    for (const { source } of this.bindings.values()) sources.set(source.identity, source)
    this.releases = [...sources.values()].map((source) => source.subscribe(this.changed))
  }
  private changed = () => {
    if (this.inactive) return
    try {
      this.render()
    } catch (error) {
      // A later invalid source must not throw through its other consumers or leave
      // half of a compound frame painted. Hold the last compiled frame and detach.
      this.stop()
      Trace.write(
        `Jolt gradient binding stopped: ${String(error)}`,
        Trace.categories.Error,
        Trace.messageType.error,
      )
    }
  }
  private render() {
    if (this.inactive) return
    const prepared = gradientProgram(this.base(), this.patch())
    this.clearPlayer()
    this.program = prepared
    const painter = this.painter
    if (!painter) return
    const run = this.running
    if (run && !this.bindings.size && !run.masked.size) {
      const generation = this.generation
      this.player = painter.play(
        run.track.values.map((p) => mix(run.from, run.to, p, reducedMotion())),
        run.track.times,
        {
          duration: run.track.duration,
          delay: run.track.delay,
          repeat: run.track.repeat,
          reverse: run.track.reverse,
        },
        (completed) => {
          if (generation === this.generation && this.running === run)
            this.finish(run, completed)
        },
      )
      // Concrete playback retains its existing API; bindings always use native control.
      if (run.clock.time() > 1) this.player.control?.(run.clock.time(), false)
      return
    }
    if (prepared.duration <= 0) {
      painter.paint(prepared.current)
      return
    }
    const generation = this.generation
    this.player = painter.play(
      prepared.frames,
      prepared.times,
      { duration: prepared.duration, delay: 0, repeat: 0, reverse: false },
      () => {},
    )
    this.player.control?.(prepared.elapsed(), false)
    // Only long compound windows need a boundary callback; each source sends its
    // own completion/control notifications. There is no observer frame subscription.
    if (prepared.remaining > prepared.duration)
      this.cancelWindow = getDriver().after(
        Math.max(1, prepared.duration - prepared.elapsed()),
        () => {
          if (generation === this.generation) this.changed()
        },
      )
  }

  animate(values: GradientValues, transition?: Transition | SpringName): Animation {
    this.assertActive()
    const from = this.presented()
    const to = resolve(from, values, true)
    const patch = gradientPatch(values, from.colors.length)
    const resolved =
      typeof transition === 'string' ? springOf(transition) : (transition ?? {})
    const track = createTrack(
      'opacity',
      [0, 1],
      resolveTransition(resolved, 'opacity', 2),
      0,
    )
    this.cancelRunning()
    this.model = from
    for (const key of patch.keys()) this.bindings.delete(key)
    this.subscribe()
    let settle!: (finished: boolean) => void
    const finished = new Promise<boolean>((resolve) => {
      settle = resolve
    })
    const driver = getDriver()
    const run: GradientRun = {
      from,
      to,
      track,
      keys: new Set(patch.keys()),
      masked: new Set(),
      clock: driver.clock?.(track.end) ?? createClock(() => driver.now()),
      settle,
    }
    const animation: Animation = {
      finished,
      stop: () => {
        if (this.running !== run) return
        this.model = this.presented()
        this.cancelRunning()
        this.render()
      },
      then: (onfulfilled, onrejected) => finished.then(onfulfilled, onrejected),
    }
    this.running = run
    if (track.end === 0 || !this.painter) this.finish(run, true)
    else {
      this.render()
      if (Number.isFinite(track.end))
        run.cancelEnd = driver.after(Math.max(1, track.end - run.clock.time()), () =>
          this.finish(run, true),
        )
    }
    return animation
  }

  private finish(run: GradientRun, completed: boolean) {
    if (this.running !== run) return
    const frame = completed
      ? mix(run.from, run.to, run.track.to, reducedMotion())
      : this.presented()
    for (const key of run.keys)
      if (!run.masked.has(key)) put(this.model, key, take(frame, key))
    this.running = undefined
    run.cancelEnd?.()
    run.clock.cancel()
    this.clearPlayer()
    run.settle(completed)
    this.render()
  }
  private cancelRunning() {
    const run = this.running
    this.running = undefined
    run?.cancelEnd?.()
    run?.clock.cancel()
    this.clearPlayer()
    run?.settle(false)
  }

  bind(values: GradientBindings): () => void {
    this.assertActive()
    const held = this.presented()
    const patch = gradientPatch(values, held.colors.length)
    const candidate: GradientPatch = this.patch()
    const count = values.colors?.length ?? held.colors.length
    const structural = count !== held.colors.length
    if (structural) {
      held.colors.length = held.stops.length = count
      for (const key of candidate.keys())
        if (key.startsWith('color:') || key.startsWith('stop:')) candidate.delete(key)
    }
    for (const [key, value] of patch) candidate.set(key, value)
    const prepared = gradientProgram(
      { at: () => held, remaining: 0, elapsed: () => 0 },
      candidate,
    )
    // Validation/sampling above is transactional. Only now may ownership change.
    const owner = {}
    if (structural) {
      for (const key of this.bindings.keys())
        if (key.startsWith('color:') || key.startsWith('stop:')) this.bindings.delete(key)
      for (const key of this.running?.keys ?? [])
        if (key.startsWith('color:') || key.startsWith('stop:'))
          this.running!.masked.add(key)
    }
    this.model = prepared.current
    for (const [key, source] of patch) {
      this.running?.masked.add(key)
      if (typeof source === 'number') this.bindings.delete(key)
      else this.bindings.set(key, { source, owner })
    }
    this.subscribe()
    this.render()
    return () => {
      if (this.removed) return
      const keys = [...this.bindings]
        .filter(([, entry]) => entry.owner === owner)
        .map(([key]) => key)
      if (!keys.length) return
      const current = this.presented()
      for (const key of keys) {
        put(this.model, key, take(current, key))
        this.bindings.delete(key)
      }
      this.subscribe()
      this.render()
    }
  }

  set(values: GradientValues) {
    this.assertActive()
    const from = this.presented()
    resolve(from, values, false)
    gradientPatch(values, from.colors.length)
    this.cancelRunning()
    this.model = from
    this.bind(values)
  }
  stop() {
    if (this.removed) return
    const frame = this.presented()
    this.bindings.clear()
    this.unsubscribe()
    this.cancelRunning()
    this.model = frame
    this.program = undefined
    this.painter?.paint(frame)
  }
  private hold() {
    this.model = this.presented()
    this.cancelRunning()
    this.unsubscribe()
    this.painter?.paint(this.model)
  }
  get suspended() {
    return this._suspended
  }

  suspend() {
    if (!this._suspended && !this.removed) {
      this.hold()
      this._suspended = true
    }
  }
  resume() {
    if (this._suspended && !this.removed) {
      this._suspended = false
      this.subscribe()
      this.changed()
    }
  }
  private unloaded = () => {
    if (this.removed) return
    this.hold()
    this.unloadedView = true
    this.painter?.remove()
    this.painter = undefined
  }
  private loaded = () => {
    if (this.removed) return
    this.unloadedView = false
    this.painter ??= (factory ?? platformPainter)(this.view, this.type)
    this.subscribe()
    this.changed()
  }
  private resized = () => {
    if (this.bindings.size || this.running) this.changed()
  }
  private appSuspended = () => {
    if (!this.background && !this.removed) {
      this.hold()
      this.background = true
    }
  }
  private appResumed = () => {
    if (this.background && !this.removed) {
      this.background = false
      this.subscribe()
      this.changed()
    }
  }
  remove() {
    if (this.removed) return
    this.unsubscribe()
    this.cancelRunning()
    this.bindings.clear()
    this.removed = true
    this.view.off('unloaded', this.unloaded)
    this.view.off('loaded', this.loaded)
    this.view.off('layoutChanged', this.resized)
    Application.off(Application.suspendEvent, this.appSuspended)
    Application.off(Application.resumeEvent, this.appResumed)
    this.painter?.remove()
    this.painter = undefined
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
