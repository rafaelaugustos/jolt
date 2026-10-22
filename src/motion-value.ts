import {
  Color,
  ScrollView,
  type EventData,
  type ScrollEventData,
  type View,
} from '@nativescript/core'
import { toViews } from './animate.js'
import {
  colorMixer,
  isColorProperty,
  parseColor,
  validateColorTarget,
  type ColorValue,
} from './color.js'
import { reducedMotion } from './config.js'
import {
  clampDecoration,
  isDecorationProperty,
  validateDecorationTarget,
} from './decoration.js'
import { getDriver } from './driver/index.js'
import {
  setArrival,
  setBase,
  stopBase,
  ViewAnimation,
  type Animation,
  type Plan,
} from './engine.js'
import { linear } from './easing.js'
import { isProperty, type Property } from './properties.js'
import { createTrack, instantTrack, type Track } from './track.js'
import {
  resolveTransition,
  springs,
  type ResolvedTransition,
  type SpringName,
  type Transition,
} from './transition.js'
import type { KeyframeProperty, Target } from './types.js'
import type { PlaybackClock } from './playback.js'
import { valueTrack } from './value-track.js'
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
export interface DerivedValue {
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
} & { [K in ColorKey]?: DerivedColor }

interface Binding {
  readonly view: View
  readonly property: Property
  readonly root: Root
  readonly read: (value: number) => number
  animation?: ViewAnimation
  sync(): void
}

interface Run {
  readonly track: Track
  readonly base: number
  readonly span: number
  readonly animation: Animation
  readonly startedAt: number
  readonly clock?: PlaybackClock
  readonly settle: (finished: boolean) => void
  readonly cancel: () => void
}

type Presentation = Pick<Run, 'track' | 'base' | 'span' | 'startedAt' | 'clock'>

const bound = new WeakMap<View, Map<Property, Binding>>()

class Derived {
  constructor(
    private readonly source: Root | undefined,
    readonly read: (value: number) => number,
    readonly color: boolean,
  ) {}

  get root(): Root {
    return this.source ?? (this as unknown as Root)
  }

  get(): number | Color {
    const value = this.read(this.root.raw())
    return this.color ? new Color(value) : value
  }

  subscribe(listener: ValueListener<number | Color>, options?: SubscribeOptions) {
    return this.root.observers.subscribe(this.read, this.color, listener, options)
  }

  to(
    input: readonly number[],
    output: readonly (number | ColorValue)[],
    options?: MapOptions,
  ): Derived {
    if (this.color) throw new TypeError('A color cannot be mapped again.')
    const map = mapping(input, output, options)
    const read = this.read
    return new Derived(this.root, (value) => map.read(read(value)), map.color)
  }
}

class Root extends Derived {
  readonly bindings = new Set<Binding>()
  readonly observers = new ValueObservers((time) => this.raw(time))
  private readonly rests = new Map<string, number>()
  private readonly runs = new Map<string, Run>()
  private presentation: Presentation | undefined
  private cancelPresentation: (() => void) | undefined

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

  private velocity(key: string): number {
    const run = this.runs.get(key)
    if (!run) return 0
    return run.span * run.track.velocityAt(this.runTime(run))
  }

  animate(
    target: number | readonly (number | null)[],
    transition: ValueAnimationOptions | SpringName = {},
  ): Animation {
    const options: ValueAnimationOptions =
      typeof transition === 'string' ? springOf(transition) : transition
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
    const velocity = this.velocity(key)
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
  play(track: Track): Animation {
    this.halt('')
    return track.end === 0 ? this.jump(track.to, '') : this.start(track, 0, 1, '')
  }

  private jump(value: number, key: string): Animation {
    const { animation, settle } = this.handle(key)
    this.rests.set(key, value)
    this.sync()
    settle(true)
    setArrival(animation, Promise.resolve())
    return animation
  }

  private handle(key: string) {
    let settle!: (finished: boolean) => void
    const finished = new Promise<boolean>((resolve) => (settle = resolve))
    const animation: Animation = {
      finished,
      stop: () => {
        if (this.runs.get(key)?.animation === animation) this.stopChannel(key)
      },
      then: (onfulfilled, onrejected) => finished.then(onfulfilled, onrejected),
    }
    return { animation, settle }
  }

  private start(track: Track, base: number, span: number, key: string): Animation {
    const { animation, settle } = this.handle(key)
    let arrive: () => void = () => {}
    let run: Run | undefined
    const driver = getDriver()
    const clock = driver.clock?.(track.end)
    setArrival(animation, new Promise<void>((resolve) => (arrive = resolve)))
    const timers = [
      Number.isFinite(track.end)
        ? driver.after(track.end, () => {
            if (this.runs.get(key) !== run) return
            this.rests.set(key, base + span * track.to)
            this.runs.delete(key)
            run?.cancel()
            this.sync()
            arrive()
            settle(true)
          })
        : undefined,
      Number.isFinite(track.arrival)
        ? driver.after(track.arrival, () => arrive())
        : undefined,
    ]
    run = {
      track,
      base,
      span,
      animation,
      startedAt: driver.now(),
      clock,
      settle: (completed) => {
        arrive()
        settle(completed)
      },
      cancel: () => {
        timers.forEach((cancel) => cancel?.())
        clock?.cancel()
      },
    }
    this.runs.set(key, run)
    this.sync()
    return animation
  }

  set(value: number) {
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
    const now = getDriver().now()
    let rest = 0
    for (const [key, value] of this.rests) if (!this.runs.has(key)) rest += value
    const runs = [...this.runs.values()]
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
    for (const binding of this.bindings) binding.sync()
    this.observers.changed(this.running)
  }

  /** The plan that plays this value's run, mapped, on one bound property. */
  plan(binding: Binding): Plan {
    const run = this.presentation
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

  elapsed(): number {
    return this.presentation ? this.runTime(this.presentation) : 0
  }

  get running(): boolean {
    return this.runs.size > 0
  }

  private halt(key: string) {
    const run = this.runs.get(key)
    if (!run) return
    this.runs.delete(key)
    run.cancel()
    run.settle(false)
  }
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
  return target instanceof Root
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
    if (!(source instanceof Derived))
      throw new TypeError(`"${key}" needs a motion value, got ${String(source)}.`)
    const properties: Property[] =
      key === 'scale' ? ['scaleX', 'scaleY'] : isProperty(key) ? [key] : []
    if (!properties.length) throw new Error(`Can't bind "${key}".`)
    for (const property of properties) {
      if (isColorProperty(property) !== source.color)
        throw new TypeError(
          source.color
            ? `"${key}" takes numbers; map the value to numbers.`
            : `"${key}" is a color; map the value to colors with to(input, colors).`,
        )
      entries.push([property, source])
    }
  }
  for (const view of views)
    for (const [property] of entries)
      if (isColorProperty(property)) validateColorTarget(view, property)
      else if (isDecorationProperty(property)) validateDecorationTarget(view, property)

  const made = views.flatMap((view) =>
    entries.map(([property, source]) => attach(view, property, source)),
  )
  return () => made.forEach((release) => release())
}

function attach(view: View, property: Property, source: Derived) {
  const existing = bound.get(view)?.get(property)
  if (existing) release(existing)
  const root = source.root
  const binding: Binding = {
    view,
    property,
    root,
    read: source.read,
    sync() {
      if (!view.isLoaded || !view.nativeViewProtected) return
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
      if (elapsed > 1 && animation.duration > 0) animation.seekTime(elapsed)
      binding.animation = animation
    },
  }
  let properties = bound.get(view)
  if (!properties) bound.set(view, (properties = new Map()))
  properties.set(property, binding)
  root.bindings.add(binding)
  view.on('loaded', binding.sync)
  binding.sync()
  return () => {
    if (root.bindings.has(binding)) {
      release(binding)
      binding.animation?.stop()
    }
  }
}

function release(binding: Binding) {
  binding.root.bindings.delete(binding)
  binding.view.off('loaded', binding.sync)
  const properties = bound.get(binding.view)
  if (properties?.get(binding.property) === binding) properties.delete(binding.property)
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
  return { read, color }
}

function springOf(name: SpringName): Transition {
  if (!Object.hasOwn(springs, name)) throw new Error(`Unknown spring "${name}".`)
  return springs[name]
}

/** A number that follows a scroll view's offset. Bind it like a motion value. */
export interface ScrollValue extends DerivedValue {
  /** Follows this scroll view instead, or none with `null`. Stable, so it works as a template ref. */
  readonly ref: (scrollView: Target | null) => void
  /** Stops following; bound views stay where they are. */
  dispose(): void
}

/**
 * The scroll offset of a ScrollView, in DIPs, as a value that bindings follow.
 *
 * ```ts
 * const offset = scrollValue(scroll)
 * bind(header, { y: offset.to([0, 120], [0, -60]), opacity: offset.to([0, 80], [1, 0]) })
 * ```
 */
export function scrollValue(
  scrollView?: Target | null,
  options: { axis?: 'x' | 'y' } = {},
): ScrollValue {
  const axis = options.axis ?? 'y'
  if (axis !== 'x' && axis !== 'y') throw new TypeError('Scroll axis must be "x" or "y".')
  const root = new Root(0)
  let source: ScrollView | undefined
  const read = () => {
    if (!source) return
    const offset = axis === 'x' ? source.horizontalOffset : source.verticalOffset
    if (Number.isFinite(offset) && offset !== root.raw()) root.set(offset)
  }
  const onScroll = (event: EventData) => {
    const { scrollX, scrollY } = event as ScrollEventData
    const offset = axis === 'x' ? scrollX : scrollY
    if (Number.isFinite(offset) && offset !== root.raw()) root.set(offset)
  }
  const detach = () => {
    source?.off(ScrollView.scrollEvent, onScroll)
    source?.off('loaded', read)
    source = undefined
  }
  const ref = (target: Target | null) => {
    const next = target === null ? undefined : toViews(target)[0]
    if (next === source) return
    if (next !== undefined && !(next instanceof ScrollView))
      throw new TypeError('scrollValue() follows a NativeScript ScrollView.')
    detach()
    source = next
    source?.on(ScrollView.scrollEvent, onScroll)
    source?.on('loaded', read)
    read()
  }
  if (scrollView) ref(scrollView)
  return Object.assign(root as unknown as DerivedValue, { ref, dispose: detach })
}
