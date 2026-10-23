import { Application, Color, Trace } from '@nativescript/core'
import { getDriver } from './driver/index.js'

export interface SubscribeOptions {
  /** Deliver the current value synchronously when subscribing. Defaults to true. */
  immediate?: boolean
}

/** `time` is milliseconds on the native animation clock, shared by a notification batch. */
export type ValueListener<T> = (value: T, time: number) => void

interface Observer {
  read(value: number): number
  color: boolean
  listener: ValueListener<number | Color>
  previous: number
}

// Only sources that need a frame live here. Idle subscriptions retain no global root reference.
const pending = new Set<ValueObservers>()
let cancelFrame: (() => void) | undefined
let listening = false
let suspended = false

function suspend() {
  suspended = true
  cancelFrame?.()
  cancelFrame = undefined
}

function resume() {
  suspended = false
  schedule()
}

function schedule() {
  if (!pending.size) {
    cancelFrame?.()
    cancelFrame = undefined
    if (listening && !suspended) {
      Application.off(Application.suspendEvent, suspend)
      Application.off(Application.resumeEvent, resume)
      listening = false
    }
    return
  }
  if (!listening) {
    Application.on(Application.suspendEvent, suspend)
    Application.on(Application.resumeEvent, resume)
    listening = true
  }
  if (cancelFrame || suspended) return
  cancelFrame = getDriver().frame(() => {
    cancelFrame = undefined
    const time = getDriver().now()
    const sources = [...pending]
    pending.clear()
    // Capture every source before calling any listener: reentrant writes belong to the next batch.
    const deliveries = sources.map((source) => source.snapshot(time))
    for (const source of sources) if (source.active) pending.add(source)
    for (const deliver of deliveries) deliver()
    schedule()
  })
}

function deliver(observer: Observer, value: number, time: number) {
  try {
    observer.listener(observer.color ? new Color(value) : value, time)
  } catch (error) {
    // A consumer failure must not interrupt other consumers or strand the shared frame source.
    Trace.write(
      `Jolt motion value subscriber failed: ${error instanceof Error ? error.stack : String(error)}`,
      Trace.categories.Error,
      Trace.messageType.error,
    )
  }
}

/** Root-owned subscriptions; mappings are evaluated only for consumers that opted in. */
export class ValueObservers {
  private readonly observers = new Set<Observer>()
  private running = false

  constructor(
    private readonly read: (time: number) => number,
    private readonly isRunning?: () => boolean,
  ) {}

  get active() {
    return (this.isRunning?.() ?? this.running) && this.observers.size > 0
  }

  subscribe(
    read: (value: number) => number,
    color: boolean,
    listener: ValueListener<number | Color>,
    options: SubscribeOptions = {},
  ): () => void {
    if (typeof listener !== 'function')
      throw new TypeError('subscribe() needs a listener function.')
    const time = getDriver().now()
    const observer = { read, color, listener, previous: read(this.read(time)) }
    this.observers.add(observer)
    if (options.immediate !== false) deliver(observer, observer.previous, time)
    if (this.active) this.changed(true)
    return () => {
      this.observers.delete(observer)
      if (!this.observers.size) {
        pending.delete(this)
        schedule()
      }
    }
  }

  changed(running: boolean) {
    this.running = running
    if (this.observers.size) {
      pending.add(this)
      schedule()
    }
  }

  clear() {
    this.observers.clear()
    pending.delete(this)
    this.running = false
    schedule()
  }

  snapshot(time: number): () => void {
    const value = this.read(time)
    const deliveries = [...this.observers].flatMap((observer) => {
      const next = observer.read(value)
      if (Object.is(next, observer.previous)) return []
      observer.previous = next
      return [{ observer, next }]
    })
    return () => {
      for (const { observer, next } of deliveries)
        if (this.observers.has(observer)) deliver(observer, next, time)
    }
  }
}
