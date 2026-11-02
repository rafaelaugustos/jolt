import type { FrameScheduler, FrameTask } from './scheduler.js'
import { numericMap, type NumericMapOptions } from '../core/numeric-map.js'
export type { NumericMapOptions as WebMapOptions } from '../core/numeric-map.js'

export interface WebReadableValue {
  to(
    input: readonly number[],
    output: readonly number[],
    options?: NumericMapOptions,
  ): WebReadableValue
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
export type WebBindings = Partial<
  Record<
    'x' | 'y' | 'rotate' | 'scale' | 'scaleX' | 'scaleY' | 'opacity',
    WebReadableValue
  >
>

export function finite(value: number, name = 'value') {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new TypeError(`${name} must be finite.`)
  return value
}

/** Internal node, never returned directly from the public facade. */
export class NumericValue {
  protected position: number
  protected speed = 0
  protected time: number
  protected ended = false
  private listeners = new Set<() => void>()
  private endings = new Set<() => void>()
  private observers = new Set<(value: number) => void>()
  private notified: number
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
  protected assert() {
    if (this.ended) throw new Error('The motion value is disposed.')
  }
  set(value: number) {
    this.assert()
    finite(value)
    const at = this.scheduler.now()
    const elapsed = at - this.time
    const velocity = elapsed > 0 ? ((value - this.position) * 1000) / elapsed : this.speed
    this.time = at
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
    this.ended = true
    this.speed = 0
    this.scheduler.remove(this.notify)
    for (const ending of [...this.endings]) ending()
    this.listeners.clear()
    this.endings.clear()
    this.observers.clear()
    this.forget()
  }
  readableHandle(): Omit<WebReadableValue, 'to'> {
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
  handle(): Omit<WebMotionValue, 'to'> {
    return Object.assign(this.readableHandle(), {
      set: (value: number) => this.set(value),
    })
  }
}

/** Lazy reads, with dependency notifications only while a consumer needs updates. */
export class DerivedValueNode extends NumericValue {
  private unsubscribe?: () => void
  private readonly stopEnding: () => void
  private readonly level: number
  constructor(
    private source: NumericValue,
    private readonly map: ReturnType<typeof numericMap>,
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
  override get moving() {
    return !this.ended && this.source.moving
  }
  override get() {
    return this.ended ? this.position : this.map.sample(this.source.get()).value
  }
  override getVelocity() {
    return this.ended
      ? 0
      : finite(
          this.map.sample(this.source.get()).slope * this.source.getVelocity(),
          'mapped velocity',
        )
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
