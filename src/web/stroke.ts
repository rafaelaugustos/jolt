import { shapePath } from '../core/shape-path.js'
import { registerPlayback, playbackSource, validateProgress } from '../core/playback.js'
import { setArrival, setArrivalTiming } from '../core/arrival.js'
import { instantTrack, type CompilationSettings, type Track } from '../core/track.js'
import { valuePlan, valueTrack, type WebValueAnimationOptions } from './value-playback.js'
import { flatten, type Point } from './curve.js'
import type { SpringName, DistributiveOmit } from './types.js'
import type { WebAnimation } from './public.js'

export interface WebPathOptions {
  progress?: number
}
export type WebPathTransition = DistributiveOmit<WebValueAnimationOptions, 'layer'>
export interface WebPathDrawing {
  readonly disposed: boolean
  readonly paused: boolean
  animate(
    progress: number | readonly (number | null)[],
    transition?: WebPathTransition | SpringName,
  ): WebAnimation
  set(progress: number): void
  snapshot(): { progress: number; velocity: number; length: number; playing: boolean }
  /** Re-measure authored geometry without restarting the normalized playback clock. */
  refresh(): void
  pause(): void
  play(): void
  stop(): void
  dispose(): void
}
export interface StrokeHost {
  document: Document
  now(): number
  settings(): CompilationSettings
  maxKeyframes: number
  after(ms: number, callback: () => void): () => void
  remember(animation: WebAnimation): void
  preference(callback: () => void): () => void
  forget(): void
  assert(): void
}
type Realm = Window & typeof globalThis
const owned = new WeakMap<SVGGeometryElement, StrokeSurface>()
const properties = ['stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity'] as const
const clamp = (value: number) => Math.max(0, Math.min(1, value))
function endpoint(value: number) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1)
    throw new RangeError('Drawing progress must be between 0 and 1.')
  return value
}
interface Geometry {
  length: number
  units: number
}
function measure(target: SVGGeometryElement): Geometry {
  if (target.localName === 'path') {
    const css = target.ownerDocument
      .defaultView!.getComputedStyle(target)
      .getPropertyValue('d')
    const value = css.startsWith('path(')
      ? JSON.parse(css.slice(5, -1))
      : target.getAttribute('d')
    if (value && value !== 'none' && shapePath(value, true).contours > 1)
      throw new TypeError(
        'Partial stroke drawing requires one continuous contour; use a drawing per SVG contour.',
      )
  }
  const length = target.getTotalLength()
  const css = target.ownerDocument
    .defaultView!.getComputedStyle(target)
    .getPropertyValue('path-length')
    .trim()
  const authored =
    css && css !== 'none' && css !== 'auto' ? css : target.getAttribute('pathLength')
  const units = authored === null ? length : Number(authored)
  if (
    !Number.isFinite(length) ||
    length < 0 ||
    !Number.isFinite(units) ||
    units < 0 ||
    (authored !== null && units === 0)
  )
    throw new RangeError(
      'SVG path length must be finite and nonnegative, with a positive authored pathLength.',
    )
  return { length, units: units || 1 }
}

export class StrokeSurface implements WebPathDrawing {
  readonly target: SVGGeometryElement
  readonly host: StrokeHost
  readonly view: Realm
  private geometry: Geometry
  private initial: Map<string, { value: string; priority: string }>
  private written = new Map<string, string>()
  private opacity: number
  private position: number
  private active?: StrokeRun
  private held = false
  private ended = false
  private mutation: MutationObserver
  private resize: ResizeObserver
  private offPreference: () => void
  constructor(
    target: SVGGeometryElement,
    options: WebPathOptions,
    host: StrokeHost,
    previous?: StrokeSurface,
  ) {
    const view = host.document.defaultView as Realm
    if (
      !(target instanceof view.SVGGeometryElement) ||
      target.ownerDocument !== host.document ||
      !target.isConnected
    )
      throw new TypeError(
        'drawPath() requires mounted SVG geometry in this runtime document.',
      )
    if (owned.has(target) && owned.get(target) !== previous)
      throw new Error('The SVG geometry belongs to another motion context.')
    if (
      !options ||
      typeof options !== 'object' ||
      Array.isArray(options) ||
      Object.keys(options).some((k) => k !== 'progress')
    )
      throw new TypeError('Unknown drawPath option.')
    const geometry = measure(target),
      position = endpoint(options.progress ?? previous?.snapshot().progress ?? 1)
    this.target = target
    this.host = host
    this.view = view
    this.geometry = geometry
    this.position = position
    this.initial =
      previous?.initial ??
      new Map(
        properties.map((name) => [
          name,
          {
            value: target.style.getPropertyValue(name),
            priority: target.style.getPropertyPriority(name),
          },
        ]),
      )
    this.opacity =
      previous?.opacity ?? Number(view.getComputedStyle(target).strokeOpacity)
    if (!Number.isFinite(this.opacity)) this.opacity = 1
    previous?.destroy(false)
    owned.set(target, this)
    this.write(position)
    this.mutation = new view.MutationObserver(() => this.autoRefresh())
    this.mutation.observe(target, {
      attributes: true,
      attributeFilter: [
        'd',
        'points',
        'pathLength',
        'x',
        'y',
        'width',
        'height',
        'r',
        'rx',
        'ry',
        'cx',
        'cy',
        'x1',
        'x2',
        'y1',
        'y2',
        'class',
        'style',
      ],
    })
    this.resize = new view.ResizeObserver(() => this.autoRefresh())
    this.resize.observe(target)
    this.offPreference = host.preference(() => {
      if (host.settings().reducedMotion) this.active?.finish(true)
    })
  }
  get disposed() {
    return this.ended
  }
  get paused() {
    return this.held
  }
  private assert() {
    this.host.assert()
    if (this.ended) throw new Error('SVG drawing is disposed.')
    if (!this.target.isConnected || this.target.ownerDocument !== this.host.document) {
      this.dispose()
      throw new Error('Mount SVG geometry in its runtime document before drawing.')
    }
  }
  snapshot() {
    const run = this.active
    return {
      progress: run?.position() ?? this.position,
      velocity: run?.velocity() ?? 0,
      length: this.geometry.length,
      playing: !!run && !run.paused,
    }
  }
  animate(
    input: number | readonly (number | null)[],
    transition: WebPathTransition | SpringName = {},
  ): WebAnimation {
    this.assert()
    const config = valuePlan(transition)
    if (config.layer !== undefined)
      throw new TypeError(
        'SVG drawings own one stroke; numeric layers belong to motion values.',
      )
    if (typeof input !== 'number' && !Array.isArray(input))
      throw new TypeError('Expected stroke progress or numeric keyframes.')
    for (const value of typeof input === 'number' ? [input] : input)
      if (value !== null) endpoint(value)
    const geometry = measure(this.target),
      current = this.snapshot()
    let track = valueTrack(input, config, current.progress, current.velocity, {
      ...this.host.settings(),
      reducedMotion: false,
    })
    if (!Number.isFinite(track.end))
      throw new RangeError('SVG drawing requires finite playback.')
    if (this.host.settings().reducedMotion || !geometry.length)
      track = instantTrack('opacity', clamp(track.to))
    const points = flatten(track, this.host.maxKeyframes)
    const run = new StrokeRun(this, track, points, geometry, this.held)
    this.active?.finish(false, false)
    this.geometry = geometry
    this.active = run
    this.host.remember(run)
    run.start()
    return run
  }
  set(progress: number) {
    this.assert()
    endpoint(progress)
    this.stop()
    this.position = progress
    this.write(progress)
  }
  pause() {
    if (this.ended || this.held) return
    this.held = true
    this.active?.pause()
  }
  play() {
    if (this.ended || !this.held) return
    this.held = false
    this.active?.play()
  }
  stop() {
    this.active?.stop()
  }
  refresh() {
    this.assert()
    const geometry = measure(this.target)
    if (
      geometry.length === this.geometry.length &&
      geometry.units === this.geometry.units
    )
      return
    this.active?.refresh(geometry)
    this.geometry = geometry
    if (!this.active) this.write(this.position)
  }
  private autoRefresh() {
    if (this.ended) return
    try {
      this.refresh()
    } catch {
      this.dispose()
    }
  }
  frames(points: readonly Point[], duration: number, geometry: Geometry): Keyframe[] {
    const opacity = this.opacity
    const frames: Keyframe[] = []
    const add = (time: number, value: number, alpha: number) =>
      frames.push({
        offset: duration ? time / duration : 1,
        strokeDasharray: `${geometry.units} ${geometry.units}`,
        strokeDashoffset: String(geometry.units * (1 - clamp(value))),
        strokeOpacity: geometry.length ? alpha : 0,
      })
    for (let i = 0; i < points.length; i++) {
      const point = points[i]!,
        prev = points[i - 1],
        next = points[i + 1],
        alpha = point.value <= 0 ? 0 : opacity
      // Hide zero-progress round caps without fading the whole stroke.
      if (point.value <= 0 && prev && prev.value > 0)
        add(Math.max(prev.time, point.time - 0.0001), point.value, opacity)
      add(point.time, point.value, alpha)
      if (point.value <= 0 && next && next.value > 0)
        add(Math.min(next.time, point.time + 0.0001), point.value, opacity)
    }
    return frames
  }
  write(progress: number) {
    const values: Record<string, string> = {
      'stroke-dasharray': `${this.geometry.units} ${this.geometry.units}`,
      'stroke-dashoffset': String(this.geometry.units * (1 - clamp(progress))),
      'stroke-opacity': String(this.geometry.length && progress > 0 ? this.opacity : 0),
    }
    for (const [property, value] of Object.entries(values)) {
      this.target.style.setProperty(property, value)
      this.written.set(property, this.target.style.getPropertyValue(property))
    }
  }
  settled(run: StrokeRun, progress: number, write: boolean) {
    if (this.active !== run) return
    this.position = progress
    this.active = undefined
    if (write) this.write(progress)
  }
  dispose() {
    this.destroy(true)
  }
  private destroy(restore: boolean) {
    if (this.ended) return
    this.ended = true
    this.active?.finish(false, false)
    this.mutation?.disconnect()
    this.resize?.disconnect()
    this.offPreference?.()
    if (owned.get(this.target) === this) {
      if (restore)
        for (const [property, original] of this.initial)
          if (
            this.target.style.getPropertyValue(property) === this.written.get(property) &&
            !this.target.style.getPropertyPriority(property)
          ) {
            if (original.value)
              this.target.style.setProperty(property, original.value, original.priority)
            else this.target.style.removeProperty(property)
          }
      owned.delete(this.target)
    }
    this.host.forget()
  }
}

class StrokeRun implements WebAnimation {
  readonly duration: number
  readonly finished: Promise<boolean>
  readonly ready: Promise<void>
  private resolve!: (completed: boolean) => void
  private readyResolve!: () => void
  private arrive!: () => void
  private effect: globalThis.Animation
  private end = false
  private completed = false
  private held = 0
  private playing = false
  private pending = false
  private arrived = false
  private cancelArrival?: () => void
  private notify: () => void
  constructor(
    private surface: StrokeSurface,
    private track: Track,
    private points: Point[],
    geometry: Geometry,
    paused: boolean,
  ) {
    this.duration = track.end
    this.finished = new Promise((resolve) => {
      this.resolve = resolve
    })
    this.ready = new Promise((resolve) => {
      this.readyResolve = resolve
    })
    this.effect = new surface.view.Animation(
      new surface.view.KeyframeEffect(
        surface.target,
        surface.frames(points, this.duration, geometry),
        { duration: this.duration, fill: 'both', easing: 'linear' },
      ),
      surface.host.document.timeline,
    )
    void this.effect.finished.catch(() => {})
    this.playing = !paused
    this.pending = surface.host.document.timeline.currentTime === null
    this.notify = registerPlayback(this, () => ({
      time: this.time(),
      duration: this.duration,
      paused: this.paused,
      ready: !this.pending,
      settled: this.end,
      completed: this.completed,
    }))
    setArrival(
      this,
      new Promise<void>((resolve) => {
        this.arrive = resolve
      }),
    )
    setArrivalTiming(this, {
      read: () => ({
        remaining: this.pending ? undefined : Math.max(0, track.arrival - this.time()),
        paused: this.paused,
        arrived: this.arrived,
      }),
      subscribe: (callback) => playbackSource(this).subscribe(callback),
    })
  }
  start() {
    if (!this.duration) {
      this.readyResolve()
      queueMicrotask(() => this.finish(true))
      return
    }
    if (this.playing) {
      this.effect.play()
      if (!this.pending) this.effect.startTime = this.surface.host.now()
    } else {
      this.effect.pause()
      this.effect.currentTime = 0
    }
    if (!this.pending) this.readyResolve()
    void this.effect.ready.then(
      () => {
        if (this.end) return
        this.pending = false
        this.readyResolve()
        this.notify()
        this.arrival()
      },
      () => {},
    )
    void this.effect.finished.then(
      () => {
        if (!this.end && !this.paused) this.finish(true)
      },
      () => {},
    )
    this.arrival()
  }
  private time() {
    if (this.end || this.paused || this.pending) return this.held
    const start = this.effect.startTime
    return Math.max(
      0,
      Math.min(
        this.duration,
        typeof start === 'number'
          ? this.surface.host.now() - start
          : Number(this.effect.currentTime ?? 0),
      ),
    )
  }
  position() {
    return clamp(this.track.valueAt(this.time()))
  }
  velocity() {
    const value = this.track.valueAt(this.time())
    return this.paused || this.end || value < 0 || value > 1
      ? 0
      : this.track.velocityAt(this.time())
  }
  get paused() {
    return !this.playing
  }
  get progress() {
    return this.completed ? 1 : this.duration ? this.time() / this.duration : 0
  }
  set progress(value: number) {
    validateProgress(value, this.duration)
    if (this.end) return
    this.held = value * this.duration
    this.effect.currentTime = this.held
    if (this.playing && !this.pending)
      this.effect.startTime = this.surface.host.now() - this.held
    this.notify()
    this.arrival()
  }
  pause() {
    if (this.end || this.paused) return
    this.held = this.time()
    this.playing = false
    this.effect.pause()
    this.effect.currentTime = this.held
    this.notify()
    this.arrival()
  }
  play() {
    if (this.end || !this.paused) return
    this.playing = true
    this.effect.play()
    if (!this.pending) this.effect.startTime = this.surface.host.now() - this.held
    this.notify()
    this.arrival()
    void this.effect.finished.then(
      () => {
        if (!this.end && !this.paused) this.finish(true)
      },
      () => {},
    )
  }
  stop() {
    this.finish(false)
  }
  then<A = boolean, B = never>(
    resolve?: ((value: boolean) => A | PromiseLike<A>) | null,
    reject?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ) {
    return this.finished.then(resolve, reject)
  }
  refresh(geometry: Geometry) {
    ;(this.effect.effect as KeyframeEffect).setKeyframes(
      this.surface.frames(this.points, this.duration, geometry),
    )
  }
  private arrival() {
    this.cancelArrival?.()
    this.cancelArrival = undefined
    if (this.end || this.arrived || this.paused || this.pending) return
    const remaining = this.track.arrival - this.time()
    if (remaining <= 0) {
      this.arrived = true
      this.arrive()
      this.notify()
    } else this.cancelArrival = this.surface.host.after(remaining, () => this.arrival())
  }
  finish(completed: boolean, write = true) {
    if (this.end) return
    const time = completed ? this.duration : this.time(),
      position = completed ? clamp(this.track.to) : clamp(this.track.valueAt(time))
    this.held = time
    this.end = true
    this.completed = completed
    this.pending = false
    this.surface.settled(this, position, write)
    this.effect.cancel()
    this.cancelArrival?.()
    this.cancelArrival = undefined
    this.arrived = true
    this.arrive()
    this.readyResolve()
    this.notify()
    this.resolve(completed)
    this.effect.effect = null
    this.surface = undefined!
  }
}
