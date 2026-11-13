import {
  createNativeScrollSource,
  nativeScrollAvailable,
  type NativeScrollSource,
} from './scroll-source.js'
import {
  scalarOperations,
  type ScalarOperation,
  type ScalarOperations,
  type ScalarSample,
} from './core/scalar.js'
import { scalarProgram, type ScalarInstruction } from './core/scalar-program.js'
import { numericMap } from './core/numeric-map.js'
import {
  Application,
  isIOS,
  Color,
  ScrollView,
  type EventData,
  type ScrollEventData,
  type View,
} from '@nativescript/core'
import {
  isLiveEdge,
  isLivePaint,
  livePaintChanges,
  overlapsLivePaint,
  validateLivePaint,
  type LiveEdge,
} from './live-paint.js'
import { toViews } from './animate.js'
import {
  colorMixer,
  isColorProperty,
  parseColor,
  validateColorTarget,
  type ColorValue,
} from './color.js'
import { onReducedMotion, reducedMotion, timeScale } from './config.js'
import { springPhysics, type SpringParams } from './spring.js'
import { layerable, mixFor } from './mixer.js'
import {
  type LiveBinding,
  type LiveInput,
  type LiveMapping,
  type LiveNode,
  type LiveProperty,
  liveComposition,
  liveSpringDriver,
  stillPhysics,
  syncLiveSprings,
  validateLivePaintRuntime,
} from './live-spring-driver.js'
import {
  clampDecoration,
  isDecorationProperty,
  validateDecorationTarget,
} from './decoration.js'
import { getDriver } from './driver/index.js'
import { setBase, stopBase, ViewAnimation, type Animation, type Plan } from './engine.js'
import { linear } from './easing.js'
import {
  isProperty,
  writeValue,
  type NumericProperty,
  type Property,
} from './properties.js'
import { createTrack, instantTrack, type Track } from './track.js'
import {
  resolveTransition,
  springs,
  type ResolvedTransition,
  type SpringName,
  type Transition,
} from './transition.js'
import type { KeyframeProperty, Target } from './types.js'
import { playbackSource, type PlaybackAnimation, type PlaybackClock } from './playback.js'
import { TimedAnimation } from './timed-animation.js'
import {
  compositionSpan,
  valueTrack,
  sampledValueTrack,
  type ValuePart,
} from './value-track.js'
import {
  ValueObservers,
  type SubscribeOptions,
  type ValueListener,
} from './value-observers.js'

export interface MapOptions {
  /** Hold the first and last outputs outside the input range. Defaults to `true`. */
  clamp?: boolean
}

/** Named motion value layers add scalar offsets before derived mappings. */
export type ValueAnimationOptions = Transition & { layer?: string }

declare const motionValueBrand: unique symbol

/** A number derived from a motion value, ready to bind to a view. */
export interface DerivedValue extends ScalarOperations<DerivedValue> {
  getVelocity(): number
  readonly disposed: boolean
  dispose(): void
  /** The value now, while it animates too. */
  get(): number
  /** Observe changes in JavaScript on the native frame clock. Unsubscribe when finished. */
  subscribe(listener: ValueListener<number>, options?: SubscribeOptions): () => void
  /** Maps through ascending or descending input ranges, like React Native's `interpolate`. */
  to(
    input: readonly number[],
    output: readonly number[],
    options?: MapOptions,
  ): DerivedValue
  to(input: readonly number[], output: readonly ColorValue[]): DerivedColor
}

/** A color derived from a motion value, for `backgroundColor`, `borderColor` or `color`. */
export interface DerivedColor {
  get(): Color
  /** Observe mapped color changes in JavaScript on the native frame clock. */
  subscribe(listener: ValueListener<Color>, options?: SubscribeOptions): () => void
}

/** A number that animates natively and drives every view property bound to it. */
export interface MotionValue extends DerivedValue {
  readonly [motionValueBrand]: true
}

type ColorKey = 'backgroundColor' | 'borderColor' | 'color'
export type Bindings = {
  [K in Exclude<KeyframeProperty, ColorKey>]?: DerivedValue
} & { [K in ColorKey]?: DerivedColor } & { [K in LiveEdge]?: DerivedValue }

interface Binding {
  readonly view: View
  readonly property: Property
  readonly root: Root
  readonly source?: Derived
  readonly read: (value: number) => number
  animation?: ViewAnimation
  cleanup?: () => void
  sync(): void
}

interface Run {
  readonly track: Track
  readonly base: number
  readonly span: number
  /** The track's samples in the value's units, ready for a native composer. */
  readonly scaled: readonly number[]
  readonly animation: TimedAnimation
  readonly startedAt: number
  readonly clock?: Pick<PlaybackClock, 'time'>
}

type Presentation = Pick<Run, 'track' | 'base' | 'span' | 'startedAt' | 'clock'>

const bound = new WeakMap<View, Map<Property, Binding>>()

interface Derived extends ScalarOperations<DerivedValue> {}
class Derived {
  private disposedMapping = false
  private frozenMapping: number | undefined
  private releases = new Set<() => void>()
  private readonly endings = new Set<() => void>()
  get disposed(): boolean {
    return this.disposedMapping || (this.source?.disposed ?? false)
  }
  onDispose(callback: () => void) {
    this.endings.add(callback)
    return () => {
      this.endings.delete(callback)
    }
  }
  dispose() {
    this.finishDerived()
  }
  protected finishDerived() {
    if (this.disposedMapping) return
    if (this.source) this.frozenMapping = this.read(this.root.raw())
    this.disposedMapping = true
    for (const stop of this.releases) stop()
    this.releases.clear()
    for (const binding of [...this.root.bindings])
      if (binding.source === this) release(binding)
    for (const callback of [...this.endings]) callback()
    this.endings.clear()
  }
  getVelocity(): number {
    if (this.color || this.disposed) return 0
    let value = this.root.raw(),
      velocity = this.root.rawVelocity()
    for (const map of this.mappings) {
      const last = map.input.length - 1
      if (map.clamp && value <= map.input[0]!) {
        value = map.output[0]!
        velocity = 0
        continue
      }
      if (map.clamp && value >= map.input[last]!) {
        value = map.output[last]!
        velocity = 0
        continue
      }
      let i = 0
      while (i < last - 1 && value > map.input[i + 1]!) i++
      const span = map.input[i + 1]! - map.input[i]!,
        slope = span > 0 ? (map.output[i + 1]! - map.output[i]!) / span : 0
      const fraction =
        span > 0 ? (value - map.input[i]!) / span : value < map.input[i]! ? 0 : 1
      value = map.output[i]! + (map.output[i + 1]! - map.output[i]!) * fraction
      velocity *= slope
    }
    return velocity
  }
  constructor(
    private readonly source: Root | undefined,
    readonly read: (value: number) => number,
    readonly color: boolean,
    readonly mappings: readonly LiveMapping[] = [],
  ) {
    Object.assign(
      this,
      scalarOperations<DerivedValue>((op, operand, maximum) => {
        if (this.color || this.disposed)
          throw new TypeError('Scalar operations require a live numeric source.')
        if (
          operand !== undefined &&
          !(operand instanceof Derived) &&
          (typeof operand !== 'number' || !Number.isFinite(operand))
        )
          throw new TypeError('Expected a finite number or a Jolt numeric value.')
        return new GraphRoot(
          this,
          op,
          operand as Derived | number | undefined,
          maximum,
        ) as unknown as DerivedValue
      }),
    )
  }

  get depth(): number {
    return this.source ? this.source.depth + this.mappings.length : 0
  }

  get root(): Root {
    return this.source ?? (this as unknown as Root)
  }

  get(): number | Color {
    const value = this.frozenMapping ?? this.read(this.root.raw())
    return this.color ? new Color(value) : value
  }

  subscribe(listener: ValueListener<number | Color>, options?: SubscribeOptions) {
    if (this.disposed) throw new Error('The value is disposed.')
    const release = this.root.retainObservation()
    try {
      const stop = this.root.observers.subscribe(this.read, this.color, listener, options)
      const cleanup = () => {
        stop()
        release()
        this.releases.delete(cleanup)
      }
      this.releases.add(cleanup)
      return cleanup
    } catch (error) {
      release()
      throw error
    }
  }

  to(
    input: readonly number[],
    output: readonly (number | ColorValue)[],
    options?: MapOptions,
  ): Derived {
    if (this.color) throw new TypeError('A color cannot be mapped again.')
    if (this.disposed) throw new Error('The value is disposed.')
    const map = mapping(input, output, options)
    const read = this.read
    return new Derived(this.root, (value) => map.read(read(value)), map.color, [
      ...this.mappings,
      {
        input: [...map.input],
        output: [...map.numbers],
        clamp: map.color || options?.clamp !== false,
        ...(map.color ? { color: true } : {}),
      },
    ])
  }
}

function retainAll<T>(
  values: readonly T[],
  retain: (value: T) => () => void,
): (() => void)[] {
  const releases: (() => void)[] = []
  try {
    for (const value of values) releases.push(retain(value))
    return releases
  } catch (error) {
    for (const release of releases.reverse()) release()
    throw error
  }
}
class Root extends Derived {
  private observations = 0
  readonly observationListeners = new Set<() => void>()
  get observed() {
    return this.observations > 0
  }
  protected observationDemandChanged() {
    for (const callback of [...this.observationListeners]) callback()
  }
  retainObservation() {
    if (this.disposed) throw new Error('The value is disposed.')
    this.observations++
    let release: () => void
    try {
      this.observationDemandChanged()
      release = this.retainConsumer()
    } catch (error) {
      this.observations--
      this.observationDemandChanged()
      throw error
    }
    let ended = false
    return () => {
      if (ended) return
      ended = true
      release()
      this.observations--
      this.observationDemandChanged()
    }
  }
  private consumers = 0
  readonly demandListeners = new Set<(active: boolean) => void>()
  get demanded() {
    return this.consumers > 0
  }
  retainConsumer(): () => void {
    this.consumers++
    try {
      this.demandChanged()
    } catch (error) {
      this.consumers--
      this.demandChanged()
      throw error
    }
    let ended = false
    return () => {
      if (ended) return
      ended = true
      this.consumers--
      this.demandChanged()
    }
  }
  protected demandChanged() {
    for (const listener of [...this.demandListeners]) listener(this.demanded)
  }
  readonly bindings = new Set<Binding>()
  readonly listeners = new Set<() => void>()
  readonly observers = new ValueObservers(
    (time) => this.raw(time),
    () => this.running,
  )
  private readonly rests = new Map<string, number>()
  private readonly runs = new Map<string, Run>()
  private presentation: Presentation | undefined
  private presented = false
  private cancelPresentation: (() => void) | undefined
  private composer: LiveNode | undefined
  private composition: { rest: number; inputs: LiveInput[] } | undefined

  constructor(initial: number) {
    super(undefined, (value) => value, false)
    if (!Number.isFinite(initial))
      throw new RangeError(`A motion value starts from a finite number, got ${initial}.`)
    this.rests.set('', initial)
  }

  raw(time = getDriver().now()): number {
    let result = 0
    for (const key of new Set([...this.rests.keys(), ...this.runs.keys()]))
      result += this.part(key, time)
    return result
  }

  rawVelocity(): number {
    return this.disposed
      ? 0
      : [...this.runs.keys()].reduce((sum, key) => sum + this.channelVelocity(key), 0)
  }
  snapshot(): { rest: number; parts: ValuePart[] } {
    const now = getDriver().now()
    let rest = 0
    const parts: ValuePart[] = []
    for (const [key, value] of this.rests) if (!this.runs.has(key)) rest += value
    for (const [key, run] of this.runs) {
      if (run.animation.paused) rest += this.part(key, now)
      else
        parts.push({
          track: run.track,
          base: run.base,
          span: run.span,
          elapsed: this.runTime(run, now),
        })
    }
    return { rest, parts }
  }
  override dispose() {
    if (this.disposed) return
    this.stop()
    for (const binding of [...this.bindings]) release(binding)
    this.cancelPresentation?.()
    this.composer?.dispose()
    this.composer = undefined
    this.observers.clear()
    super.dispose()
    for (const listener of [...this.listeners]) listener()
    this.listeners.clear()
    this.demandListeners.clear()
  }

  /** Drag input owns only the base; bounds and snap points stay in base units. */
  base(): number {
    return this.part('')
  }

  private part(key: string, time = getDriver().now()): number {
    const run = this.runs.get(key)
    return run
      ? run.base + run.span * run.track.valueAt(this.runTime(run, time))
      : (this.rests.get(key) ?? 0)
  }

  private runTime(run: Presentation, time = getDriver().now()) {
    return run.clock?.time() ?? time - run.startedAt
  }

  /** Internal development snapshot; reading it installs no observers. */
  inspect() {
    return {
      velocity: [...this.runs.keys()].reduce(
        (sum, key) => sum + this.channelVelocity(key),
        0,
      ),
      resources:
        this.bindings.size + this.listeners.size + this.observers.size + this.runs.size,
    }
  }

  private channelVelocity(key: string): number {
    const run = this.runs.get(key)
    if (!run || run.animation.paused) return 0
    return run.span * run.track.velocityAt(this.runTime(run))
  }

  animate(
    target: number | readonly (number | null)[],
    transition: ValueAnimationOptions | SpringName = {},
  ): PlaybackAnimation {
    const options: ValueAnimationOptions =
      typeof transition === 'string' ? springOf(transition) : transition
    if (this.disposed) throw new Error('The value is disposed.')
    const key = options.layer === undefined ? '' : layerName(options.layer)
    const from = this.part(key)
    const frames = (typeof target === 'number' ? [null, target] : [...target]).map(
      (frame) => (frame === null ? from : frame),
    )
    if (frames.length < 2) frames.unshift(from)
    if (frames.some((frame) => typeof frame !== 'number' || !Number.isFinite(frame)))
      throw new RangeError(`Invalid motion value keyframes: ${JSON.stringify(target)}.`)
    const resolved = resolveTransition(options, 'x', frames.length)
    const base = Math.min(...frames)
    const span = Math.max(...frames) - base
    const velocity = this.channelVelocity(key)
    if (resolved.curve.type === 'gravity') {
      // Acceleration and velocity belong to the value's units, not normalized progress.
      const track = createTrack('x', frames, resolved, velocity)
      this.halt(key)
      return track.end === 0 ? this.jump(track.to, key) : this.start(track, 0, 1, key)
    }
    if (span === 0) {
      this.halt(key)
      return this.jump(frames.at(-1)!, key)
    }

    // Sampled in the value's own range so springs settle relative to the distance.
    const track = createTrack(
      'opacity',
      frames.map((frame) => (frame - base) / span),
      resolved,
      velocity / span,
    )
    this.halt(key)
    return track.end === 0
      ? this.jump(base + span * track.to, key)
      : this.start(track, base, span, key)
  }

  /** Plays a track sampled in the value's own units, such as a drag release. */
  playTrack(track: Track): PlaybackAnimation {
    this.halt('')
    return track.end === 0 ? this.jump(track.to, '') : this.start(track, 0, 1, '')
  }

  private jump(value: number, key: string): PlaybackAnimation {
    this.rests.set(key, value)
    this.sync()
    const animation = new TimedAnimation(
      0,
      0,
      () => {},
      () => {},
    )
    animation.start()
    return animation
  }

  private start(
    track: Track,
    base: number,
    span: number,
    key: string,
  ): PlaybackAnimation {
    const driver = getDriver()
    const animation = new TimedAnimation(
      track.end,
      track.arrival,
      () => this.sync(),
      (completed) => {
        if (this.runs.get(key)?.animation !== animation) return
        const held = base + span * track.valueAt(animation.time)
        this.runs.delete(key)
        if (!completed && key !== '') this.rests.delete(key)
        else this.rests.set(key, completed ? base + span * track.to : held)
        this.sync()
      },
    )
    const run: Run = {
      track,
      base,
      span,
      scaled: track.values.map((value) => base + span * value),
      animation,
      startedAt: driver.now(),
      clock: { time: () => animation.time },
    }
    this.runs.set(key, run)
    try {
      this.sync()
      animation.start()
    } catch (error) {
      animation.stop()
      throw error
    }
    return animation
  }

  set(value: number) {
    if (this.disposed) throw new Error('The value is disposed.')
    if (!Number.isFinite(value))
      throw new RangeError(`A motion value takes a finite number, got ${value}.`)
    for (const key of [...this.runs.keys()]) this.halt(key)
    this.rests.clear()
    this.rests.set('', value)
    this.sync()
  }

  setBase(value: number) {
    if (!Number.isFinite(value))
      throw new RangeError('A motion value takes a finite number.')
    this.halt('')
    this.rests.set('', value)
    this.sync()
  }

  stopBase() {
    this.stopChannel('')
  }

  stop(layer?: string) {
    if (layer !== undefined) return this.stopChannel(layerName(layer))
    if (!this.runs.size && this.rests.size === 1) return
    const value = this.raw()
    for (const key of [...this.runs.keys()]) this.halt(key)
    this.rests.clear()
    this.rests.set('', value)
    this.sync()
  }

  private stopChannel(key: string) {
    if (!this.runs.has(key) && (key === '' || !this.rests.has(key))) return
    const held = this.part(key)
    this.halt(key)
    if (key === '') this.rests.set(key, held)
    else this.rests.delete(key)
    this.sync()
  }

  private sync() {
    this.cancelPresentation?.()
    this.cancelPresentation = undefined
    this.presentation = undefined
    this.presented = false
    const now = getDriver().now()
    const runs = [...this.runs.values()].filter((run) => !run.animation.paused)
    const span =
      runs.length > 1
        ? compositionSpan(
            runs.map((run) => ({ track: run.track, elapsed: this.runTime(run, now) })),
          )
        : undefined
    this.composition = span?.windowed && liveComposition() ? this.inputs(now) : undefined
    if (this.composition)
      this.composer?.inputs(this.composition.rest, this.composition.inputs)
    else {
      this.settle()
      this.present()
    }
    this.changed()
  }

  /** Every run as a native input on its own clock; rests and paused runs stand still. */
  inputs(now: number) {
    let rest = 0
    for (const [key, value] of this.rests) if (!this.runs.has(key)) rest += value
    const inputs: LiveInput[] = []
    for (const run of this.runs.values()) {
      const elapsed = this.runTime(run, now)
      const { track } = run
      inputs.push({
        value: run.base + run.span * track.valueAt(elapsed),
        running: !run.animation.paused,
        elapsed,
        duration: track.duration,
        delay: track.delay,
        repeat: Number.isFinite(track.repeat) ? track.repeat : -1,
        reverse: track.reverse,
        to: run.base + run.span * track.to,
        times: track.times,
        values: run.scaled,
      })
    }
    return { rest, inputs }
  }

  /** The native composer a binding joins while this value would otherwise roll windows. */
  composerNode(): LiveNode | undefined {
    const composition = this.composition
    if (!composition) return undefined
    if (!this.composer) {
      const live = liveComposition()
      if (!live) return undefined
      this.composer = live.create(this.raw(), stillPhysics, true)
      this.composer.inputs(composition.rest, composition.inputs)
    }
    return this.composer
  }

  /** Drops the composer once no binding needs it or the composition stops rolling. */
  settle() {
    if (this.composition && this.bindings.size) return
    this.composer?.dispose()
    this.composer = undefined
  }

  /** Sampled at once for tracks, on demand while bindings sit on the composer. */
  private present(): Presentation | undefined {
    if (this.presented) return this.presentation
    this.presented = true
    const now = getDriver().now()
    let rest = 0
    for (const [key, value] of this.rests) if (!this.runs.has(key)) rest += value
    const runs = [...this.runs.values()].filter((run) => !run.animation.paused)
    for (const [key, run] of this.runs)
      if (run.animation.paused) rest += this.part(key, now)
    if (!runs.length) this.presentation = undefined
    else if (runs.length === 1) {
      const run = runs[0]!
      this.presentation = { ...run, base: run.base + rest }
    } else {
      const { track, windowed } = valueTrack(
        runs.map((run) => ({
          track: run.track,
          base: run.base,
          span: run.span,
          elapsed: this.runTime(run, now),
        })),
        rest,
      )
      const driver = getDriver()
      const clock = driver.clock?.(track.end)
      this.presentation = { track, base: 0, span: 1, startedAt: now, clock }
      const cancelWindow = windowed
        ? driver.after(track.end, () => this.sync())
        : undefined
      this.cancelPresentation = () => {
        cancelWindow?.()
        clock?.cancel()
      }
    }
    return this.presentation
  }

  protected changed() {
    for (const binding of this.bindings) binding.sync()
    for (const listener of [...this.listeners]) listener()
    this.observers.changed(this.running)
  }

  /** The plan that plays this value's run, mapped, on one bound property. */
  plan(binding: Binding): Plan {
    const run = this.present()
    const { property, read } = binding
    const write = (value: number) =>
      isDecorationProperty(property)
        ? clampDecoration(property, read(value))
        : read(value)
    if (!run) {
      const value = write(this.raw())
      return {
        property,
        keyframes: [],
        transition: still,
        track: () => instantTrack(property, value),
      }
    }
    const { track, base, span } = run
    const at = (progress: number) => write(base + span * progress)
    const transition: ResolvedTransition = {
      curve: {
        type: 'tween',
        duration: track.duration,
        ease: [linear],
        times: undefined,
      },
      delay: track.delay,
      repeat: track.repeat,
      reverse: track.reverse,
    }
    const mapped = (): Track => {
      if (reducedMotion() && property !== 'opacity' && !isColorProperty(property))
        return instantTrack(property, at(track.to))
      return {
        property,
        delay: track.delay,
        duration: track.duration,
        repeat: track.repeat,
        reverse: track.reverse,
        times: track.times,
        values: track.values.map(at),
        to: at(track.to),
        end: track.end,
        arrival: track.arrival,
        valueAt: (elapsed) => at(track.valueAt(elapsed)),
        velocityAt: isColorProperty(property)
          ? () => 0
          : (elapsed) =>
              (at(track.valueAt(elapsed + 0.5)) - at(track.valueAt(elapsed - 0.5))) *
              1000,
      }
    }
    return { property, keyframes: [], transition, track: mapped }
  }

  /** Capture the current native presentation clock, even if a later command replaces it. */
  captureTime(): () => number {
    const run = this.present()
    return run ? () => this.runTime(run) : () => 0
  }

  elapsed(): number {
    const run = this.present()
    return run ? this.runTime(run) : 0
  }

  get paused(): boolean {
    return this.runs.size > 0 && !this.running
  }

  get running(): boolean {
    return [...this.runs.values()].some((run) => !run.animation.paused)
  }

  private halt(key: string) {
    const run = this.runs.get(key)
    if (!run) return
    this.runs.delete(key)
    run.animation.stop()
  }
}

export interface SpringValueOptions extends SpringParams {
  /** Initial follower position. Defaults to the source's current value. */
  initial?: number
  /** Absolute source units. Defaults to 0.001. */
  restDelta?: number
  /** Source units per second. Defaults to 0.01. */
  restSpeed?: number
}

/** A retained native follower. Settling does not dispose its source subscription. */
export interface SpringValue extends DerivedValue {
  readonly disposed: boolean
  readonly moving: boolean
  readonly paused: boolean
  /** Hold position and velocity while retaining the current source target. */
  pause(): void
  /** Resume from the held state toward the current source. */
  play(): void
  /** Current velocity in source units per second. */
  getVelocity(): number
  dispose(): void
}

class SpringRoot extends Root {
  private observerSource?: () => void
  protected override observationDemandChanged() {
    if (this.observed && !this.observerSource)
      this.observerSource = this.input.root.retainObservation()
    else if (!this.observed) {
      this.observerSource?.()
      this.observerSource = undefined
    }
    super.observationDemandChanged()
  }
  private releaseDemand: (() => void) | undefined
  externalActive = false
  protected override demandChanged() {
    const active = this.demanded && !this.ended && !this.held && !this.background
    if (active && !this.releaseDemand) {
      // A source status callback may synchronously suspend or dispose this follower.
      this.releaseDemand = () => {}
      let release: () => void
      try {
        release = this.input.root.retainConsumer()
      } catch (error) {
        this.releaseDemand = undefined
        throw error
      }
      this.releaseDemand = release
      if (!this.demanded || this.ended || this.held || this.background) {
        this.releaseDemand = undefined
        release()
      }
    } else if (!active && this.releaseDemand) {
      const release = this.releaseDemand
      this.releaseDemand = undefined
      release()
    }
    super.demandChanged()
  }
  readonly node: LiveNode
  private releaseSource: () => void = () => {}
  private releaseReduced: () => void = () => {}
  private ended = false
  private held = false
  private background = false
  private suspend = () => {
    this.background = true
    this.updatePause()
  }
  private resume = () => {
    this.background = false
    this.updatePause()
  }

  constructor(
    readonly input: Derived,
    options: SpringValueOptions,
  ) {
    const source = input
    const initial = options.initial ?? (source.get() as number)
    const instant = options.duration === 0
    const params = springPhysics(instant ? { ...options, duration: undefined } : options)
    const speed = timeScale()
    const physics = {
      stiffness: params.stiffness * speed * speed,
      damping: params.damping * speed,
      mass: params.mass,
      restDelta: options.restDelta ?? 0.001,
      restSpeed: options.restSpeed ?? 0.01,
    }
    for (const [key, value] of Object.entries(physics))
      if (!Number.isFinite(value) || (key === 'damping' ? value < 0 : value <= 0))
        throw new RangeError(`Invalid springValue ${key}: ${value}.`)
    if (
      options.duration !== undefined &&
      (!Number.isFinite(options.duration) || options.duration < 0)
    )
      throw new RangeError('springValue duration must be finite and nonnegative.')
    if (options.bounce !== undefined && !Number.isFinite(options.bounce))
      throw new RangeError('springValue bounce must be finite.')
    super(initial)
    const root = source.root
    const graphLease =
      root instanceof GraphRoot && root.live ? root.nativeLease() : undefined
    this.node = liveSpringDriver().create(initial, physics, instant || reducedMotion())
    try {
      let update: () => void
      if (root instanceof SpringRoot || graphLease) {
        if (root.disposed) throw new Error('Cannot follow a disposed spring value.')
        this.node.follow(graphLease?.node ?? (root as SpringRoot).node, source.mappings)
        update = () => this.notify()
      } else {
        const playback = valuePlayback(source as unknown as DerivedValue)
        update = () => {
          if (!root.running) {
            this.node.update({
              value: source.get() as number,
              running: false,
              elapsed: 0,
              duration: 0,
              delay: 0,
              repeat: 0,
              reverse: false,
              to: 0,
              times: [],
              values: [],
            })
            this.notify()
            return
          }
          const { track, elapsed, running, value } = playback.snapshot()
          this.node.update({
            value,
            elapsed,
            running,
            duration: track.duration,
            delay: track.delay,
            repeat: Number.isFinite(track.repeat) ? track.repeat : -1,
            reverse: track.reverse,
            to: track.to,
            times: track.times,
            values: track.values,
          })
          this.notify()
        }
      }
      root.listeners.add(update)
      this.releaseSource = () => {
        root.listeners.delete(update)
        graphLease?.release()
      }
      this.releaseReduced = onReducedMotion((reduced) => {
        this.node.reduced(instant || reduced)
        this.notify()
      })
      Application.on(Application.suspendEvent, this.suspend)
      Application.on(Application.resumeEvent, this.resume)
      update()
    } catch (error) {
      this.dispose()
      throw error
    }
  }
  override raw(): number {
    return this.node?.position() ?? super.raw()
  }
  override get running(): boolean {
    return (
      !this.ended &&
      !this.held &&
      !this.background &&
      (this.externalActive || (this.node?.moving() ?? false))
    )
  }
  get moving(): boolean {
    return this.running
  }
  override get disposed(): boolean {
    return this.ended
  }
  override get paused(): boolean {
    return this.held
  }
  pause() {
    if (!this.ended) {
      this.held = true
      this.updatePause()
    }
  }
  play() {
    if (!this.ended) {
      this.held = false
      this.updatePause()
    }
  }
  private updatePause() {
    this.node.paused(this.held || this.background)
    this.demandChanged()
    this.notify()
  }
  override getVelocity(): number {
    return this.rawVelocity()
  }
  override rawVelocity(): number {
    return this.ended || this.held || this.background ? 0 : this.node.velocity()
  }
  override plan(): Plan {
    throw new TypeError(
      'A live spring cannot be sampled as a fixed track. Bind it to transforms or opacity.',
    )
  }
  notify() {
    this.observers.changed(this.running)
    for (const listener of [...this.listeners]) listener()
  }
  override dispose() {
    if (this.ended) return
    this.ended = true
    this.demandChanged()
    this.releaseSource()
    this.observerSource?.()
    this.observerSource = undefined
    this.releaseReduced()
    Application.off(Application.suspendEvent, this.suspend)
    Application.off(Application.resumeEvent, this.resume)
    for (const binding of [...this.bindings]) release(binding)
    this.node.dispose()
    this.observers.clear()
    this.finishDerived()
    for (const listener of [...this.listeners]) listener()
    this.listeners.clear()
  }
}

/** Follow changing targets without rebuilding sampled animation tracks. Dispose with the owning scope. */
export function springValue(
  source: DerivedValue,
  options: SpringValueOptions = {},
): SpringValue {
  if (!(source instanceof Derived) || source.color)
    throw new TypeError('springValue() needs a numeric Jolt motion value.')
  if (!options || typeof options !== 'object')
    throw new TypeError('springValue() options must be an object.')
  return new SpringRoot(source, options) as unknown as SpringValue
}

/** Internal boundary notification for values driven directly by native input. */
export function liveValueInput(value: DerivedValue) {
  if (!(value instanceof Derived) || !(value.root instanceof SpringRoot))
    throw new TypeError('Native input requires a live value.')
  const root = value.root
  return {
    node: root.node,
    retain: () => root.retainConsumer(),
    changed: () => root.notify(),
    active(value: boolean) {
      root.externalActive = value
      root.notify()
    },
    demand(listener: (active: boolean) => void) {
      root.demandListeners.add(listener)
      listener(root.demanded)
      return () => {
        root.demandListeners.delete(listener)
      }
    },
  }
}

/** Compile finite sources once; live sources stay in the native evaluator's ordered frame batch. */
class GraphRoot extends Root {
  readonly level: number
  readonly sources: Root[]
  readonly program: ScalarInstruction[]
  readonly live: boolean
  private readonly evaluate: ReturnType<typeof scalarProgram>
  private stops: (() => void)[] = []
  private demandStops: (() => void)[] = []
  private observerStops: (() => void)[] = []
  private graphNode?: LiveNode
  private bridges: { root: Root; node: LiveNode }[] = []
  private leases = 0
  private cached?: { track: Track; started: number }
  private last: ScalarSample
  private readonly suspendGraph = () => this.graphNode?.paused(true)
  private readonly resumeGraph = () => this.graphNode?.paused(false)
  constructor(
    readonly left: Derived,
    readonly operation: ScalarOperation,
    readonly right?: Derived | number,
    readonly maximum?: number,
  ) {
    const sources = [...new Set([left, ...(right instanceof Derived ? [right] : [])])]
    if (sources.some((source) => source.color || source.disposed || source.depth >= 32))
      throw new TypeError('Scalar operations need live numeric sources within 32 levels.')
    const graph = compileGraph(left, operation, right, maximum)
    const evaluate = scalarProgram(graph.program, graph.sources.length)
    const initial = evaluate(
      graph.sources.map((root) => ({ value: root.raw(), velocity: root.rawVelocity() })),
    )
    super(initial.value)
    this.last = initial
    this.sources = graph.sources
    this.program = graph.program
    this.evaluate = evaluate
    this.level = Math.max(...sources.map((source) => source.depth)) + 1
    this.live = this.sources.some((root) => root instanceof SpringRoot)
    const update = () => {
      if (this.disposed) return
      if (
        sources.some((source) => source.disposed) ||
        this.sources.some((root) => root.disposed)
      ) {
        this.dispose()
        return
      }
      this.cached = undefined
      for (const { root, node } of this.bridges) {
        const snapshot = root.inputs(getDriver().now())
        node.inputs(snapshot.rest, snapshot.inputs)
      }
      this.changed()
    }
    for (const root of this.sources) {
      root.listeners.add(update)
      this.stops.push(() => root.listeners.delete(update))
    }
    for (const source of sources) this.stops.push(source.onDispose(() => this.dispose()))
    Application.on(Application.suspendEvent, this.suspendGraph)
    Application.on(Application.resumeEvent, this.resumeGraph)
  }
  override get depth() {
    return this.level ?? 0
  }
  override raw() {
    if (this.disposed) return this.last.value
    return this.evaluate(
      this.sources.map((root) => ({ value: root.raw(), velocity: root.rawVelocity() })),
    ).value
  }
  override rawVelocity() {
    return this.disposed
      ? 0
      : this.evaluate(
          this.sources.map((root) => ({
            value: root.raw(),
            velocity: root.rawVelocity(),
          })),
        ).velocity
  }
  override get running() {
    return !this.disposed && this.sources.some((root) => root.running)
  }
  protected override demandChanged() {
    const active = !this.disposed && (this.demanded || this.leases > 0)
    if (active && !this.demandStops.length)
      this.demandStops = retainAll(this.sources, (root) => root.retainConsumer())
    else if (!active) {
      for (const stop of this.demandStops) stop()
      this.demandStops = []
    }
    super.demandChanged()
  }
  protected override observationDemandChanged() {
    if (this.observed && !this.observerStops.length)
      this.observerStops = retainAll(this.sources, (root) => root.retainObservation())
    else if (!this.observed) {
      for (const stop of this.observerStops) stop()
      this.observerStops = []
    }
    super.observationDemandChanged()
  }
  private timeline() {
    return this.sources.map((root) => root.snapshot())
  }
  override composerNode(): LiveNode | undefined {
    const snapshots = this.timeline()
    if (
      !this.live &&
      !compositionSpan(snapshots.flatMap((snapshot) => snapshot.parts))?.windowed
    )
      return undefined
    return this.ensureNode()
  }
  nativeLease() {
    const node = this.ensureNode()
    this.leases++
    try {
      this.demandChanged()
    } catch (error) {
      this.leases--
      this.demandChanged()
      this.settle()
      throw error
    }
    let released = false
    return {
      node,
      release: () => {
        if (released) return
        released = true
        this.leases--
        this.demandChanged()
        this.settle()
      },
    }
  }
  private ensureNode(): LiveNode {
    if (this.graphNode) return this.graphNode
    const driver = liveSpringDriver()
    try {
      const inputs = this.sources.map((root) => {
        if (root instanceof SpringRoot) return root.node
        const node = driver.create(root.raw(), stillPhysics, true)
        this.bridges.push({ root, node })
        const snapshot = root.inputs(getDriver().now())
        node.inputs(snapshot.rest, snapshot.inputs)
        return node
      })
      const node = driver.create(this.raw(), stillPhysics, true)
      this.graphNode = node
      if (!node.compute)
        throw new Error('Combined live values need rebuilt Jolt native classes.')
      node.compute(inputs, this.program)
      return node
    } catch (error) {
      this.clearNode()
      throw error
    }
  }
  private clearNode() {
    this.graphNode?.dispose()
    this.graphNode = undefined
    for (const { node } of this.bridges) node.dispose()
    this.bridges = []
  }
  override settle() {
    if (!this.demanded && !this.leases) this.clearNode()
  }
  private presentationTrack() {
    if (this.cached) return this.cached
    const snapshots = this.timeline()
    const at = (time: number) =>
      this.evaluate(
        snapshots.map((snapshot) => ({
          value: snapshot.parts.reduce(
            (sum, part) =>
              sum + part.base + part.span * part.track.valueAt(part.elapsed + time),
            snapshot.rest,
          ),
          velocity: snapshot.parts.reduce(
            (sum, part) => sum + part.span * part.track.velocityAt(part.elapsed + time),
            0,
          ),
        })),
      ).value
    const { track } = sampledValueTrack(
      snapshots.flatMap((snapshot) => snapshot.parts),
      at,
    )
    return (this.cached = { track, started: getDriver().now() })
  }
  override plan(binding: Binding): Plan {
    const source = this.presentationTrack().track
    const at = (value: number) =>
      isDecorationProperty(binding.property)
        ? clampDecoration(binding.property, binding.read(value))
        : binding.read(value)
    return {
      property: binding.property,
      keyframes: [],
      transition: still,
      track: () => {
        if (
          reducedMotion() &&
          binding.property !== 'opacity' &&
          !isColorProperty(binding.property)
        )
          return instantTrack(binding.property, at(source.to))
        return {
          ...source,
          property: binding.property,
          values: source.values.map(at),
          to: at(source.to),
          valueAt: (time: number) => at(source.valueAt(time)),
          velocityAt: (time: number) =>
            (at(source.valueAt(time + 0.5)) - at(source.valueAt(time - 0.5))) * 1000,
        }
      },
    }
  }
  override elapsed() {
    return getDriver().now() - this.presentationTrack().started
  }
  override captureTime() {
    const start = this.presentationTrack().started
    return () => getDriver().now() - start
  }
  override dispose() {
    if (this.disposed) return
    this.last = { value: this.raw(), velocity: 0 }
    for (const stop of this.stops) stop()
    this.stops = []
    for (const stop of this.observerStops) stop()
    this.observerStops = []
    for (const stop of this.demandStops) stop()
    this.demandStops = []
    Application.off(Application.suspendEvent, this.suspendGraph)
    Application.off(Application.resumeEvent, this.resumeGraph)
    super.dispose()
    this.clearNode()
  }
}

function compileGraph(
  left: Derived,
  operation: ScalarOperation,
  right?: Derived | number,
  maximum?: number,
) {
  const sources: Root[] = [],
    program: ScalarInstruction[] = []
  const known = new Map<Derived, number>()
  const append = (node: ScalarInstruction) => {
    program.push(node)
    return program.length - 1
  }
  const walk = (value: Derived | number): number => {
    if (typeof value === 'number') return append({ op: 'constant', value })
    const cached = known.get(value)
    if (cached !== undefined) return cached
    const root = value.root
    let index: number
    if (root instanceof GraphRoot) {
      const a = walk(root.left),
        b = root.right === undefined ? undefined : walk(root.right)
      index = append({ op: root.operation, a, b, maximum: root.maximum })
    } else {
      let input = sources.indexOf(root)
      if (input < 0) {
        input = sources.length
        sources.push(root)
      }
      index = append({ op: 'input', a: input })
    }
    for (const map of value.mappings)
      index = append({
        op: 'map',
        a: index,
        input: map.input,
        output: map.output,
        clamp: map.clamp,
      })
    known.set(value, index)
    return index
  }
  const a = walk(left),
    b = right === undefined ? undefined : walk(right)
  append({ op: operation, a, b, maximum })
  return { sources, program }
}

function layerName(name: string): string {
  if (typeof name !== 'string' || !name.length)
    throw new TypeError('A layer is named by a nonempty string.')
  return name
}

const still: ResolvedTransition = {
  curve: { type: 'tween', duration: 0, ease: [linear], times: undefined },
  delay: 0,
  repeat: 0,
  reverse: false,
}

/**
 * A number that animates natively and drives the view properties bound to it.
 *
 * ```ts
 * const progress = motionValue(0)
 * bind(sheet, { y: progress.to([0, 1], [600, 0]) })
 * animate(progress, 1, 'snappy')
 * ```
 */
export function motionValue(initial = 0): MotionValue {
  return new Root(initial) as unknown as MotionValue
}

export function isMotionValue(target: unknown): target is MotionValue {
  return (
    target instanceof Root &&
    !(target instanceof SpringRoot) &&
    !(target instanceof GraphRoot)
  )
}

export function asRoot(value: MotionValue): Root {
  return value as unknown as Root
}

/**
 * Lets motion values drive a view's properties. The view takes their current values
 * at once and follows every change on the same native clock. Returns a cleanup function.
 *
 * ```ts
 * const release = bind(backdrop, { opacity: progress.to([0, 1], [0, 0.4]) })
 * ```
 */
export function bind(target: Target | readonly Target[], bindings: Bindings): () => void {
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings))
    throw new TypeError('bind() takes an object of motion values.')
  const views = toViews(target)
  const entries: [Property, Derived][] = []
  for (const [key, source] of Object.entries(bindings)) {
    if (source === undefined) continue
    if (source instanceof Derived && source.disposed)
      throw new Error('The value is disposed.')
    if (!(source instanceof Derived))
      throw new TypeError(`"${key}" needs a motion value, got ${String(source)}.`)
    const properties: Property[] =
      key === 'scale'
        ? ['scaleX', 'scaleY']
        : isProperty(key)
          ? [key]
          : isLiveEdge(key) && source.root instanceof SpringRoot
            ? [key as Property]
            : []
    if (!properties.length) throw new Error(`Can't bind "${key}".`)
    for (const property of properties) {
      if (source.root instanceof SpringRoot) {
        if (source.root.disposed) throw new Error('Cannot bind a disposed spring value.')
        if (isDecorationProperty(property) && !isLivePaint(property))
          throw new TypeError(
            'Live springs support transforms, opacity, colors, border widths and corner radii.',
          )
      }
      if (isColorProperty(property) !== source.color)
        throw new TypeError(
          source.color
            ? `"${key}" takes numbers; map the value to numbers.`
            : `"${key}" is a color; map the value to colors with to(input, colors).`,
        )
      entries.push([property, source])
    }
  }
  for (const [property] of entries)
    if (entries.some(([other]) => overlapsLivePaint(property, other)))
      throw new TypeError(
        'Bind either a uniform border width/radius or its individual edges in one call.',
      )
  for (const view of views)
    for (const [property, source] of entries) {
      if (source.root instanceof SpringRoot) {
        validateLivePaint(view, property)
        validateLivePaintRuntime(view, property)
      } else if (isColorProperty(property)) validateColorTarget(view, property)
      else if (isDecorationProperty(property)) validateDecorationTarget(view, property)
    }

  const made: (() => void)[] = []
  try {
    for (const view of views)
      for (const [property, source] of entries) made.push(attach(view, property, source))
  } catch (error) {
    for (const cleanup of made.reverse()) cleanup()
    throw error
  }
  return () => made.forEach((release) => release())
}

function attach(view: View, property: Property, source: Derived) {
  for (const [other, binding] of bound.get(view) ?? [])
    if (overlapsLivePaint(property, other)) release(binding)
  const existing = bound.get(view)?.get(property)
  if (existing) release(existing)
  const root = source.root
  if (root instanceof SpringRoot)
    return attachSpring(view, property as LiveProperty, source, root)
  let native: LiveBinding | undefined, composer: LiveNode | undefined
  let releaseMix: (() => void) | undefined
  let releaseDemand: (() => void) | undefined
  const detach = () => {
    if (!native) return
    native.cancel()
    releaseMix?.()
    releaseMix = undefined
    native = composer = undefined
    releaseDemand?.()
    releaseDemand = undefined
    root.settle()
    syncLiveSprings(view)
  }
  const binding: Binding = {
    view,
    property: property as Property,
    root,
    source,
    read: source.read,
    sync() {
      if (!view.isLoaded || !view.nativeViewProtected) return
      const node =
        root instanceof GraphRoot || (layerable(property) && !source.color)
          ? root.composerNode()
          : undefined
      if (node) {
        if (composer === node) return
        detach()
        binding.animation?.stop()
        binding.animation = undefined
        stopBase(view, [property])
        const handle = node.bind(view, property as LiveProperty, source.mappings)
        native = handle
        composer = node
        releaseDemand = root.retainConsumer()
        releaseMix = mixFor(view, property).attachLive({
          read: () => handle.value(),
          layers: (layers) => handle.layers(layers),
        })
        syncLiveSprings(view)
        return
      }
      detach()
      if (!root.running) {
        // A value at rest writes straight through, so scroll offsets cost one write per event.
        binding.animation?.stop()
        binding.animation = undefined
        stopBase(view, [property])
        const value = source.read(root.raw())
        setBase(
          view,
          property,
          isDecorationProperty(property) ? clampDecoration(property, value) : value,
        )
        if (isColorProperty(property) || isDecorationProperty(property))
          getDriver().sync?.(view)
        return
      }
      const animation = new ViewAnimation(view, [root.plan(binding)])
      // Native keyframe setup can take time, especially for a composite track on Android.
      // Catch up after construction so each binding joins the source's current phase.
      const elapsed = root.elapsed()
      if (root.paused) animation.pause()
      if ((elapsed > 1 || root.paused) && animation.duration > 0)
        animation.seekTime(elapsed)
      binding.animation = animation
    },
    cleanup() {
      view.off('unloaded', detach)
      detach()
    },
  }
  let properties = bound.get(view)
  if (!properties) bound.set(view, (properties = new Map()))
  properties.set(property as Property, binding)
  root.bindings.add(binding)
  view.on('loaded', binding.sync)
  view.on('unloaded', detach)
  try {
    binding.sync()
  } catch (error) {
    release(binding)
    throw error
  }
  return () => {
    if (root.bindings.has(binding)) {
      release(binding)
      binding.animation?.stop()
    }
  }
}

function attachSpring(
  view: View,
  property: LiveProperty,
  source: Derived,
  root: SpringRoot,
) {
  let native: LiveBinding | undefined
  let releaseMix: (() => void) | undefined
  let releaseDemand: (() => void) | undefined
  let releaseStyles: (() => void) | undefined
  const paint = isLivePaint(property)
  let externalWrite = false
  let writingPaint = false
  const detach = () => {
    if (!native) return
    const handle = native
    const value = handle.value()
    native = undefined
    handle.cancel()
    releaseMix?.()
    releaseMix = undefined
    if (paint && !externalWrite) {
      writingPaint = true
      try {
        if (isLiveEdge(property)) view[property] = Math.max(0, value)
        else writeValue(view, property, value)
      } finally {
        writingPaint = false
      }
    }
    releaseDemand?.()
    releaseDemand = undefined
    syncLiveSprings(view)
  }
  const binding: Binding = {
    view,
    property: property as Property,
    root,
    source,
    read: source.read,
    sync() {
      if (!view.isLoaded || !view.nativeViewProtected || root.disposed) return
      detach()
      validateLivePaint(view, property)
      stopBase(view, [property as Property])
      native = root.node.bind(view, property, source.mappings)
      const handle = native
      const retained = root.retainConsumer()
      if (native !== handle || root.disposed) {
        retained()
        return
      }
      releaseDemand = retained
      if (!paint)
        releaseMix = mixFor(view, property).attachLive({
          read: () => handle.value(),
          layers: (layers) => handle.layers(layers),
        })
      syncLiveSprings(view)
    },
    cleanup() {
      view.off('unloaded', detach)
      releaseStyles?.()
      detach()
    },
  }
  let properties = bound.get(view)
  if (!properties) bound.set(view, (properties = new Map()))
  properties.set(property as Property, binding)
  root.bindings.add(binding)
  view.on('loaded', binding.sync)
  view.on('unloaded', detach)
  if (paint) {
    const names = livePaintChanges(property).map((name) => `${name}Change`)
    // Core style setters own their property. Remove only this live binding before
    // the new model is applied; old cleanup must not overwrite a newer style.
    const external = () => {
      if (writingPaint || !root.bindings.has(binding)) return
      externalWrite = true
      try {
        release(binding)
      } finally {
        externalWrite = false
      }
    }
    for (const name of names) view.style.on(name, external)
    let refreshQueued = false
    const refresh = () => {
      if (refreshQueued) return
      refreshQueued = true
      void Promise.resolve().then(() => {
        refreshQueued = false
        if (!root.bindings.has(binding)) return
        try {
          validateLivePaint(view, property)
          syncLiveSprings(view)
        } catch {
          external()
        }
      })
    }
    // Core can rebuild a drawable/layer for another paint channel. Reapply the
    // retained native state after that model write instead of cancelling it.
    view.style.on('backgroundInternalChange', refresh)
    view.on('layoutChanged', refresh)
    if (property === 'color') {
      view.on('textChange', refresh)
      view.on('formattedTextChange', refresh)
    }
    releaseStyles = () => {
      for (const name of names) view.style.off(name, external)
      view.off('layoutChanged', refresh)
      view.style.off('backgroundInternalChange', refresh)
      view.off('textChange', refresh)
      view.off('formattedTextChange', refresh)
    }
  }
  try {
    binding.sync()
  } catch (error) {
    release(binding)
    throw error
  }
  return () => {
    if (root.bindings.has(binding)) release(binding)
  }
}

/** A read-only value on an existing finite animation's clock. No second animation or timer. */
export function playbackProgress(animation: Animation): DerivedValue {
  const source = playbackSource(animation)
  if (!Number.isFinite(source.read().duration))
    throw new RangeError('Progress requires a finite animation.')
  const root = new PlaybackValue(source)
  return new Derived(root, (value) => value, false) as unknown as DerivedValue
}

class PlaybackValue extends Root {
  constructor(private readonly playback: ReturnType<typeof playbackSource>) {
    super(0)
    const source = playback
    const off = source.subscribe(() => {
      this.changed()
      if (source.read().settled) off()
    })
    if (source.read().settled) off()
    this.observers.changed(this.running)
  }

  override raw() {
    const state = this.playback.read()
    return (
      state.position ??
      (state.completed
        ? 1
        : state.duration > 0
          ? Math.max(0, Math.min(1, state.time / state.duration))
          : 0)
    )
  }

  override get running() {
    const state = this.playback.read()
    return state.ready && !state.settled && !state.paused && state.duration > 0
  }

  override get paused() {
    return this.playback.read().paused
  }
  override captureTime() {
    return () => this.playback.read().time
  }
  override elapsed() {
    return this.playback.read().time
  }

  override plan(binding: Binding): Plan {
    const state = this.playback.read()
    if (!state.ready || state.settled || state.duration === 0)
      return {
        property: binding.property,
        keyframes: [],
        transition: still,
        track: () => instantTrack(binding.property, binding.read(this.raw())),
      }
    // Bypass timeScale: the source duration is already in platform playback milliseconds.
    const duration = state.duration
    const at = (ms: number) => binding.read(Math.max(0, Math.min(1, ms / duration)))
    const track: Track = {
      property: binding.property,
      delay: 0,
      duration,
      repeat: 0,
      reverse: false,
      times: [0, 1],
      values: [at(0), at(duration)],
      to: at(duration),
      end: duration,
      arrival: duration,
      valueAt: at,
      velocityAt: (ms) => (at(ms + 0.5) - at(ms - 0.5)) * 1000,
    }
    // Piecewise/color derivations need intermediate samples, not only the two endpoints.
    const steps = Math.max(1, Math.min(6000, Math.ceil((duration * 60) / 1000)))
    const times = Array.from({ length: steps + 1 }, (_, i) => i / steps)
    return {
      property: binding.property,
      keyframes: [],
      transition: still,
      track: () =>
        reducedMotion() &&
        binding.property !== 'opacity' &&
        !isColorProperty(binding.property)
          ? instantTrack(binding.property, at(duration))
          : { ...track, times, values: times.map((time) => at(time * duration)) },
    }
  }
}

/** Internal compound-binding bridge. One raw snapshot per root keeps sibling mappings coherent. */
export function valueSource(source: DerivedValue | DerivedColor, color: boolean) {
  if (!(source instanceof Derived) || source.color !== color)
    throw new TypeError(
      `Gradient component needs a ${color ? 'color' : 'numeric'} Jolt value.`,
    )
  const { root, read } = source
  return {
    identity: root,
    read,
    snapshot() {
      return {
        track: root.plan({ property: 'opacity', read: (value) => value } as Binding)
          .track!(),
        elapsed: root.elapsed(),
        time: root.captureTime(),
        running: root.running,
        value: root.raw(),
      }
    },
    subscribe(listener: () => void) {
      root.listeners.add(listener)
      return () => {
        root.listeners.delete(listener)
      }
    },
  }
}

/** Treat values as opaque identities in declarative option comparisons. */
export function isDerived(value: unknown): value is DerivedValue | DerivedColor {
  return value instanceof Derived
}

/** Internal native-adapter bridge. Mappings are sampled at boundaries, never per frame. */
export function valuePlayback(source: DerivedValue) {
  if (!(source instanceof Derived) || source.color)
    throw new TypeError('A native binding needs a numeric Jolt value.')
  const { root, read } = source
  return {
    snapshot() {
      return {
        track: root.plan({ property: 'opacity', read } as Binding).track!(),
        elapsed: root.elapsed(),
        paused: root.paused,
        running: root.running,
        value: read(root.raw()),
      }
    },
    subscribe(listener: () => void) {
      root.listeners.add(listener)
      return () => {
        root.listeners.delete(listener)
      }
    },
  }
}

function release(binding: Binding) {
  binding.root.bindings.delete(binding)
  binding.view.off('loaded', binding.sync)
  const properties = bound.get(binding.view)
  if (properties?.get(binding.property) === binding) properties.delete(binding.property)
  binding.cleanup?.()
  binding.root.settle()
}

/** A regular animation on a bound property takes it over; the value keeps its other bindings. */
export function detachBindings(view: View, properties: readonly Property[]) {
  const map = bound.get(view)
  if (!map) return
  for (const property of properties) {
    const binding = map.get(property)
    if (binding) release(binding)
  }
}

interface InspectedSource {
  identity: object
  kind: string
  value: number
  mappings: readonly LiveMapping[]
  input?: InspectedSource
}

/** Read existing binding topology without subscribing or constructing new tracks. */
export function inspectViewBindings(view: View) {
  const describe = (source: Derived, depth = 0): InspectedSource => ({
    identity: source.root,
    kind: source.root instanceof SpringRoot ? 'live spring' : 'motion value',
    value: source.root.raw(),
    mappings: source.mappings.map((mapping) => ({
      ...mapping,
      input: [...mapping.input],
      output: [...mapping.output],
    })),
    input:
      source.root instanceof SpringRoot && depth < 8
        ? describe(source.root.input, depth + 1)
        : undefined,
  })
  return [...(bound.get(view)?.values() ?? [])].map((binding) => ({
    property: binding.property,
    source: describe(binding.source ?? binding.root),
    value: binding.read(binding.root.raw()),
  }))
}

function mapping(
  input: readonly number[],
  output: readonly (number | ColorValue)[],
  options: MapOptions = {},
) {
  if (!Array.isArray(input) || !Array.isArray(output) || input.length < 2)
    throw new RangeError('to() needs at least two input and output values.')
  if (input.length !== output.length)
    throw new RangeError(
      `to() has ${input.length} inputs but ${output.length} outputs; give one output per input.`,
    )
  if (input.some((value) => !Number.isFinite(value)))
    throw new RangeError('to() inputs must all be finite numbers.')
  const descending = input[input.length - 1]! < input[0]!
  if (
    input.some(
      (value, i) => i > 0 && (descending ? value > input[i - 1]! : value < input[i - 1]!),
    )
  )
    throw new RangeError(
      'to() inputs must be monotonic (ascending or descending); ranges cannot change direction.',
    )
  // Normalize pairs together, without changing caller-owned arrays or duplicate-stop rules.
  if (descending) {
    input = [...input].reverse()
    output = [...output].reverse()
  }
  const color = typeof output[0] !== 'number'
  const numbers = color ? output.map((value) => parseColor(value)) : (output as number[])
  if (
    !color &&
    numbers.some((value) => typeof value !== 'number' || !Number.isFinite(value))
  )
    throw new RangeError('to() outputs must all be finite numbers, or all colors.')
  const mixers = color
    ? numbers.slice(1).map((value, i) => colorMixer(numbers[i]!, value))
    : undefined
  const clamp = color || options.clamp !== false
  const last = input.length - 1
  const read = (value: number) => {
    if (clamp && value <= input[0]!) return numbers[0]!
    if (clamp && value >= input[last]!) return numbers[last]!
    let i = 0
    while (i < last - 1 && value > input[i + 1]!) i++
    const span = input[i + 1]! - input[i]!
    const t = span > 0 ? (value - input[i]!) / span : value < input[i]! ? 0 : 1
    if (mixers) return mixers[i]!(Math.min(1, Math.max(0, t)))
    return numbers[i]! + (numbers[i + 1]! - numbers[i]!) * t
  }
  return { read, color, input, numbers }
}

function springOf(name: SpringName): Transition {
  if (!Object.hasOwn(springs, name)) throw new Error(`Unknown spring "${name}".`)
  return springs[name]
}

/** Scroll offsets in DIPs/points. iOS includes the adjusted leading inset; bounce stays negative. */
export interface ScrollValue extends DerivedValue {
  readonly ref: (scrollView: Target | null) => void
  readonly execution: 'native' | 'javascript'
  refresh(): void
}
export interface ScrollValueOptions {
  axis?: 'x' | 'y'
  /** auto uses rebuilt native classes; javascript preserves the observable ScrollView fallback. */
  execution?: 'auto' | 'native' | 'javascript'
  /** Required on Android virtualized lists: fixed row height; horizontal CollectionView uses item stride. */
  rowHeight?: number
}
const scrollDiagnostics = new WeakMap<
  object,
  () => { offset: number; updates: number; callbacks: number }
>()
/** Development audit; counts Jolt callbacks, not events emitted independently by NativeScript Core. */
export function inspectScrollValue(value: ScrollValue) {
  return scrollDiagnostics.get(value)?.()
}

export function scrollValue(
  scrollView?: Target | null,
  options: ScrollValueOptions = {},
): ScrollValue {
  if (
    !options ||
    typeof options !== 'object' ||
    Object.keys(options).some((key) => !['axis', 'execution', 'rowHeight'].includes(key))
  )
    throw new TypeError('Expected scroll value options.')
  const axis = options.axis ?? 'y',
    execution = options.execution ?? 'auto',
    rowHeight = options.rowHeight ?? 0
  if (axis !== 'x' && axis !== 'y') throw new TypeError('Scroll axis must be "x" or "y".')
  if (
    !['auto', 'native', 'javascript'].includes(execution) ||
    !Number.isFinite(rowHeight) ||
    rowHeight < 0
  )
    throw new TypeError(
      'Expected a valid execution path and a nonnegative fixed rowHeight.',
    )
  const native = execution !== 'javascript' && nativeScrollAvailable()
  if (!native && execution === 'native')
    throw new Error('Native scroll values need rebuilt Jolt classes.')
  const initial = new Root(0),
    root: Root = native ? new SpringRoot(initial, { duration: 0 }) : initial
  const disposeRoot = root.dispose.bind(root)
  let source: View | undefined,
    handle: NativeScrollSource | undefined,
    ended = false,
    background = false
  let updates = 0,
    callbacks = 0
  const adjusted = (offset: number) => {
    const inset = isIOS ? source?.nativeViewProtected?.adjustedContentInset : undefined
    return offset + (inset ? (axis === 'x' ? inset.left : inset.top) : 0)
  }
  const read = () => {
    if (handle) {
      handle.refresh()
      return
    }
    if (!(source instanceof ScrollView) || native) return
    const offset = adjusted(
      axis === 'x' ? source.horizontalOffset : source.verticalOffset,
    )
    if (Number.isFinite(offset) && offset !== root.raw()) {
      updates++
      root.set(offset)
    }
  }
  const onScroll = (event: EventData) => {
    if (ended || background) return
    callbacks++
    const scroll = event as ScrollEventData,
      offset = adjusted(axis === 'x' ? scroll.scrollX : scroll.scrollY)
    if (Number.isFinite(offset) && offset !== root.raw()) {
      updates++
      root.set(offset)
    }
  }
  const observe = () => handle?.observe(root.observed)
  const detachNative = () => {
    handle?.dispose()
    handle = undefined
  }
  const attach = () => {
    if (ended || background) return
    if (!native) {
      read()
      return
    }
    if (handle || !source?.isLoaded || !source.nativeViewProtected) return
    handle = createNativeScrollSource(
      source,
      (root as SpringRoot).node,
      axis,
      rowHeight,
      () => (root as SpringRoot).notify(),
    )
    observe()
    ;(root as SpringRoot).notify()
  }
  const suspend = () => {
    background = true
    handle?.enabled(false)
  }
  const resume = () => {
    background = false
    attach()
    handle?.enabled(true)
    read()
  }
  const detach = () => {
    detachNative()
    source?.off(ScrollView.scrollEvent, onScroll)
    source?.off('loaded', attach)
    source?.off('unloaded', detachNative)
    source = undefined
  }
  const ref = (target: Target | null) => {
    if (ended) {
      if (target === null) return
      throw new Error('The scroll value is disposed.')
    }
    const next = target === null ? undefined : toViews(target)[0]
    if (next === source) return
    if (next && !native && !(next instanceof ScrollView))
      throw new TypeError(
        'JavaScript scroll values require a NativeScript ScrollView; native list input needs rebuilt classes.',
      )
    detach()
    source = next
    if (!native) source?.on(ScrollView.scrollEvent, onScroll)
    source?.on('loaded', attach)
    source?.on('unloaded', detachNative)
    try {
      attach()
    } catch (error) {
      detach()
      throw error
    }
  }
  const dispose = () => {
    if (ended) return
    ended = true
    detach()
    root.observationListeners.delete(observe)
    Application.off(Application.suspendEvent, suspend)
    Application.off(Application.resumeEvent, resume)
    disposeRoot()
    if (native) initial.dispose()
  }
  root.observationListeners.add(observe)
  Application.on(Application.suspendEvent, suspend)
  Application.on(Application.resumeEvent, resume)
  const result = Object.assign(root as unknown as DerivedValue, {
    ref,
    dispose,
    refresh: read,
    execution: native ? ('native' as const) : ('javascript' as const),
  })
  scrollDiagnostics.set(
    result,
    () => handle?.snapshot() ?? { offset: root.raw(), updates, callbacks },
  )
  try {
    if (scrollView) ref(scrollView)
  } catch (error) {
    dispose()
    throw error
  }
  return result
}
