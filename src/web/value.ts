import type { FrameScheduler, FrameTask } from './scheduler.js'
import { numericMap, type NumericMapOptions } from '../core/numeric-map.js'
import { colorMixer } from '../core/color.js'
import {
  scalarSample,
  type ScalarOperation,
  type ScalarOperations,
  type ScalarSample,
} from '../core/scalar.js'
import { colorCSS, type KeyframeProperty, type ColorProperty } from './properties.js'
export type { NumericMapOptions as WebMapOptions } from '../core/numeric-map.js'

export interface WebReadableValue extends ScalarOperations<WebReadableValue> {
  to(
    input: readonly number[],
    output: readonly number[],
    options?: NumericMapOptions,
  ): WebReadableValue
  to(
    input: readonly number[],
    output: readonly string[],
    options?: NumericMapOptions,
  ): WebColorValue
  get(): number
  /** Units per second. A stopped/disposed value reports zero. */
  getVelocity(): number
  /** Batched after frame writes. The initial value is not emitted automatically. */
  subscribe(listener: (value: number) => void): () => void
  readonly disposed: boolean
  dispose(): void
}
export interface WebMotionValue extends WebReadableValue {
  /** Set an input immediately; rendering and subscribers coalesce into the next frame. */
  set(value: number): void
}
export interface WebBinding {
  dispose(): void
}
export interface WebColorValue {
  readonly type: 'color'
  get(): string
  /** Colors have no scalar velocity; apply springValue before the color mapping. */
  getVelocity(): number
  subscribe(listener: (value: string) => void): () => void
  readonly disposed: boolean
  dispose(): void
}
export type WebBindings = Partial<
  Record<ColorProperty | 'borderColor', WebColorValue> &
    Record<Exclude<KeyframeProperty, ColorProperty | 'borderColor'>, WebReadableValue>
>

export function finite(value: number, name = 'value') {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new TypeError(`${name} must be finite.`)
  return value
}

/** Internal node, never returned directly from the public facade. */
export class NumericValue {
  readonly kind: 'number' | 'color' = 'number'
  protected position: number
  protected speed = 0
  protected time: number
  protected ended = false
  private listeners = new Set<() => void>()
  private endings = new Set<() => void>()
  private observers = new Set<(value: number) => void>()
  private notified: number
  private writer?: () => void
  private notify: FrameTask = {
    write: () => {
      const value = this.get()
      if (value === this.notified) return
      this.notified = value
      for (const listener of [...this.observers]) {
        if (this.ended || !this.observers.has(listener)) continue
        try {
          listener(value)
        } catch (error) {
          this.report(error)
        }
      }
    },
  }
  constructor(
    readonly scheduler: FrameScheduler,
    initial: number,
    protected readonly report: (error: unknown) => void,
    private readonly forget: () => void,
  ) {
    this.position = this.notified = finite(initial)
    this.time = scheduler.now()
  }
  get disposed() {
    return this.ended
  }
  get moving() {
    return false
  }
  get depth() {
    return 0
  }
  activity(cache = new Map<NumericValue, boolean>()): boolean {
    if (!cache.has(this)) cache.set(this, this.moving)
    return cache.get(this)!
  }
  protected get demanded() {
    return !!(this.listeners.size || this.observers.size)
  }
  protected demandChanged() {}
  get() {
    return this.position
  }
  getVelocity() {
    return this.ended ? 0 : this.speed
  }
  sample(cache = new Map<NumericValue, ScalarSample>()): ScalarSample {
    let sample = cache.get(this)
    if (!sample) {
      sample = { value: this.get(), velocity: this.getVelocity() }
      cache.set(this, sample)
    }
    return sample
  }
  protected assert() {
    if (this.ended) throw new Error('The motion value is disposed.')
  }
  set(value: number) {
    this.assert()
    finite(value)
    this.writer?.()
    const at = this.scheduler.now()
    const elapsed = at - this.time
    const velocity = elapsed > 0 ? ((value - this.position) * 1000) / elapsed : this.speed
    this.time = at
    this.publish(value, velocity)
  }
  claimWriter(cancel: () => void) {
    this.assert()
    this.writer?.()
    this.writer = cancel
  }
  releaseWriter(cancel: () => void) {
    if (this.writer === cancel) this.writer = undefined
  }
  writeSample(value: number, velocity: number) {
    this.assert()
    this.time = this.scheduler.now()
    this.publish(value, velocity)
  }
  protected publish(value: number, velocity: number) {
    finite(value)
    finite(velocity, 'velocity')
    const changed = value !== this.position || velocity !== this.speed
    this.position = value
    this.speed = velocity
    if (!changed) return
    for (const listener of [...this.listeners])
      if (!this.ended && this.listeners.has(listener)) listener()
    if (this.observers.size) this.scheduler.add(this.notify)
  }
  listen(change: () => void, ending: () => void = () => {}) {
    this.assert()
    this.listeners.add(change)
    this.endings.add(ending)
    this.demandChanged()
    return () => {
      this.listeners.delete(change)
      this.endings.delete(ending)
      this.demandChanged()
    }
  }
  onDispose(ending: () => void) {
    this.assert()
    this.endings.add(ending)
    return () => {
      this.endings.delete(ending)
    }
  }
  subscribe(listener: (value: number) => void) {
    this.assert()
    if (typeof listener !== 'function') throw new TypeError('Expected a value listener.')
    this.observers.add(listener)
    this.demandChanged()
    return () => {
      this.observers.delete(listener)
      if (!this.observers.size) this.scheduler.remove(this.notify)
      this.demandChanged()
    }
  }
  dispose() {
    if (this.ended) return
    this.writer?.()
    this.writer = undefined
    this.ended = true
    this.speed = 0
    this.scheduler.remove(this.notify)
    for (const ending of [...this.endings]) ending()
    this.listeners.clear()
    this.endings.clear()
    this.observers.clear()
    this.forget()
  }
  readableHandle(): WebValueHandle {
    const node = this
    return {
      get: () => node.get(),
      getVelocity: () => node.getVelocity(),
      subscribe: (listener) => node.subscribe(listener),
      get disposed() {
        return node.disposed
      },
      dispose: () => node.dispose(),
    }
  }
  handle(): WebValueHandle & Pick<WebMotionValue, 'set'> {
    return Object.assign(this.readableHandle(), {
      set: (value: number) => this.set(value),
    })
  }
}

export type WebValueHandle = Omit<
  WebReadableValue,
  'to' | keyof ScalarOperations<WebReadableValue>
>

/** Multi-input reads stay lazy. All consumers see the final source samples in the write phase. */
export class ArithmeticValueNode extends NumericValue {
  private sources: NumericValue[]
  private unlisten: (() => void)[] = []
  private sourceEndings: (() => void)[] = []
  private readonly level: number
  constructor(
    private left: NumericValue,
    private readonly op: ScalarOperation,
    private right: NumericValue | number | undefined,
    private readonly maximum: number | undefined,
    report: (error: unknown) => void,
    forget: () => void,
  ) {
    const sources = [
      ...new Set([left, ...(right instanceof NumericValue ? [right] : [])]),
    ]
    if (
      sources.some(
        (source) =>
          source.disposed ||
          source.kind !== 'number' ||
          source.depth >= 32 ||
          source.scheduler !== left.scheduler,
      )
    )
      throw new TypeError(
        'Scalar operations need live numeric values from the same runtime within 32 levels.',
      )
    if (typeof right === 'number') finite(right)
    const cache = new Map<NumericValue, ScalarSample>()
    const a = left.sample(cache),
      b =
        right instanceof NumericValue
          ? right.sample(cache)
          : { value: right ?? 0, velocity: 0 }
    super(
      left.scheduler,
      scalarSample(op, a.value, a.velocity, b.value, b.velocity, maximum).value,
      report,
      forget,
    )
    this.sources = sources
    this.level = Math.max(...sources.map((source) => source.depth)) + 1
    this.sourceEndings = sources.map((source) => source.onDispose(() => this.dispose()))
  }
  override get depth() {
    return this.level
  }
  override get moving() {
    return this.activity()
  }
  override activity(cache = new Map<NumericValue, boolean>()): boolean {
    if (!cache.has(this))
      cache.set(
        this,
        !this.ended && this.sources.some((source) => source.activity(cache)),
      )
    return cache.get(this)!
  }
  override sample(cache = new Map<NumericValue, ScalarSample>()): ScalarSample {
    const cached = cache.get(this)
    if (cached) return cached
    if (this.ended) return { value: this.position, velocity: 0 }
    const a = this.left.sample(cache)
    const b =
      this.right instanceof NumericValue
        ? this.right.sample(cache)
        : { value: this.right ?? 0, velocity: 0 }
    const result = scalarSample(
      this.op,
      a.value,
      a.velocity,
      b.value,
      b.velocity,
      this.maximum,
    )
    cache.set(this, result)
    return result
  }
  override get() {
    return this.ended ? this.position : this.sample().value
  }
  override getVelocity() {
    return this.ended ? 0 : this.sample().velocity
  }
  protected override demandChanged() {
    if (this.ended) return
    if (this.demanded && !this.unlisten.length)
      this.unlisten = this.sources.map((source) =>
        source.listen(() => {
          const sample = this.sample()
          this.publish(sample.value, sample.velocity)
        }),
      )
    else if (!this.demanded) {
      for (const stop of this.unlisten) stop()
      this.unlisten = []
    }
  }
  override dispose() {
    if (this.ended) return
    this.position = this.get()
    for (const stop of this.unlisten) stop()
    for (const stop of this.sourceEndings) stop()
    this.unlisten = this.sourceEndings = []
    super.dispose()
    this.sources = []
    this.left = undefined!
    this.right = undefined
  }
}

/** Mutable input with an optional analytical playback reader; frame work follows demand. */
export class MotionInputNode extends NumericValue {
  private reader?: () => { value: number; velocity: number; moving: boolean }
  private wake?: () => void
  get observed() {
    return this.demanded
  }
  playback(
    reader?: () => { value: number; velocity: number; moving: boolean },
    wake?: () => void,
  ) {
    this.reader = reader
    this.wake = wake
  }
  override get() {
    return this.reader?.().value ?? super.get()
  }
  override getVelocity() {
    return this.ended ? 0 : (this.reader?.().velocity ?? super.getVelocity())
  }
  override get moving() {
    return !this.ended && (this.reader?.().moving ?? false)
  }
  protected override demandChanged() {
    this.wake?.()
  }
}

/** A numeric driver mapped through the same premultiplied OKLab mixer as native. */
export class ColorMappedNode extends NumericValue {
  override readonly kind = 'color'
  private unsubscribe?: () => void
  private readonly stopEnding: () => void
  private readonly map: ReturnType<typeof numericMap>
  private readonly mixes: ((p: number) => number)[]
  constructor(
    private source: NumericValue,
    input: readonly number[],
    colors: readonly number[],
    options: NumericMapOptions | undefined,
    report: (error: unknown) => void,
    forget: () => void,
  ) {
    if (source.disposed || source.kind !== 'number' || source.depth >= 32)
      throw new TypeError(
        'Color mappings require a live numeric source within the graph depth budget.',
      )
    const map = numericMap(
      input,
      colors.map((_, i) => i),
      options,
    )
    const mixes = colors.slice(1).map((color, i) => colorMixer(colors[i]!, color))
    const at = Math.max(0, Math.min(colors.length - 1, map.sample(source.get()).value))
    const index = Math.min(mixes.length - 1, Math.floor(at))
    super(source.scheduler, mixes[index]!(at - index), report, forget)
    this.map = map
    this.mixes = mixes
    this.stopEnding = source.onDispose(() => this.dispose())
  }
  override get depth() {
    return this.source.depth + 1
  }
  override get moving() {
    return this.activity()
  }
  override activity(cache = new Map<NumericValue, boolean>()): boolean {
    if (!cache.has(this)) cache.set(this, !this.ended && this.source.activity(cache))
    return cache.get(this)!
  }
  override get() {
    if (this.ended) return this.position
    const at = Math.max(
      0,
      Math.min(this.mixes.length, this.map.sample(this.source.get()).value),
    )
    const index = Math.min(this.mixes.length - 1, Math.floor(at))
    return this.mixes[index]!(at - index)
  }
  override getVelocity() {
    return 0
  }
  protected override demandChanged() {
    if (this.ended) return
    if (this.demanded && !this.unsubscribe)
      this.unsubscribe = this.source.listen(() => this.publish(this.get(), 0))
    else if (!this.demanded) {
      this.unsubscribe?.()
      this.unsubscribe = undefined
    }
  }
  colorHandle(): WebColorValue {
    const node = this
    return {
      type: 'color',
      get: () => colorCSS(node.get()),
      getVelocity: () => 0,
      subscribe: (listener) => node.subscribe((value) => listener(colorCSS(value))),
      get disposed() {
        return node.disposed
      },
      dispose: () => node.dispose(),
    }
  }
  override dispose() {
    if (this.ended) return
    this.position = this.get()
    this.unsubscribe?.()
    this.stopEnding()
    super.dispose()
    this.source = undefined!
  }
}

/** Lazy reads, with dependency notifications only while a consumer needs updates. */
export class DerivedValueNode extends NumericValue {
  private unsubscribe?: () => void
  private readonly stopEnding: () => void
  private readonly level: number
  constructor(
    private source: NumericValue,
    private map: ReturnType<typeof numericMap>,
    report: (error: unknown) => void,
    forget: () => void,
  ) {
    if (source.disposed || source.depth >= 32)
      throw new RangeError(
        'A value graph needs a live source and at most 32 derived/follower levels.',
      )
    super(source.scheduler, map.sample(source.get()).value, report, forget)
    this.level = source.depth + 1
    this.stopEnding = source.onDispose(() => this.dispose())
  }
  override get depth() {
    return this.level
  }
  get mapping() {
    return { source: this.source, map: this.map }
  }
  protected remap(map: ReturnType<typeof numericMap>) {
    if (this.ended) return
    this.map = map
    this.publish(this.get(), this.getVelocity())
  }
  override get moving() {
    return this.activity()
  }
  override activity(cache = new Map<NumericValue, boolean>()): boolean {
    if (!cache.has(this)) cache.set(this, !this.ended && this.source.activity(cache))
    return cache.get(this)!
  }
  override sample(cache = new Map<NumericValue, ScalarSample>()): ScalarSample {
    const cached = cache.get(this)
    if (cached) return cached
    if (this.ended) return { value: this.position, velocity: 0 }
    const source = this.source.sample(cache),
      mapped = this.map.sample(source.value)
    const result = {
      value: mapped.value,
      velocity: finite(mapped.slope * source.velocity, 'mapped velocity'),
    }
    cache.set(this, result)
    return result
  }
  override get() {
    return this.sample().value
  }
  override getVelocity() {
    return this.sample().velocity
  }
  protected override demandChanged() {
    if (this.ended) return
    if (this.demanded && !this.unsubscribe)
      this.unsubscribe = this.source.listen(() =>
        this.publish(this.get(), this.getVelocity()),
      )
    else if (!this.demanded) {
      this.unsubscribe?.()
      this.unsubscribe = undefined
    }
  }
  override dispose() {
    if (this.ended) return
    this.position = this.get()
    this.unsubscribe?.()
    this.stopEnding()
    super.dispose()
    this.source = undefined!
  }
}
