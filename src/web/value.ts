import type { FrameScheduler, FrameTask } from './scheduler.js'

export interface WebReadableValue {
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
    return () => {
      this.listeners.delete(change)
      this.endings.delete(ending)
    }
  }
  subscribe(listener: (value: number) => void) {
    this.assert()
    if (typeof listener !== 'function') throw new TypeError('Expected a value listener.')
    this.observers.add(listener)
    return () => {
      this.observers.delete(listener)
      if (!this.observers.size) this.scheduler.remove(this.notify)
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
  handle(): WebMotionValue {
    const node = this
    return {
      get: () => node.get(),
      getVelocity: () => node.getVelocity(),
      set: (value) => node.set(value),
      subscribe: (listener) => node.subscribe(listener),
      get disposed() {
        return node.disposed
      },
      dispose: () => node.dispose(),
    }
  }
}
