import { getDriver } from './driver/index.js'
import { Trace } from '@nativescript/core'
import { setArrival, setArrivalTiming } from './engine.js'
import {
  createClock,
  registerPlayback,
  validateProgress,
  type PlaybackAnimation,
  type PlaybackCommand,
} from './playback.js'

/** A sampled resource's control clock. Native sinks play frames; JS runs only at boundaries. */
export class TimedAnimation implements PlaybackAnimation {
  readonly finished: Promise<boolean>
  private resolve!: (value: boolean) => void
  private arrive!: () => void
  private readonly clock
  private readonly notifyPlayback: () => void
  private readonly listeners = new Set<() => void>()
  private cancelEnd?: () => void
  private cancelArrival?: () => void
  private _paused = false
  private settled = false
  private completed = false
  private arrived = false
  private active = false

  constructor(
    readonly duration: number,
    private readonly arrival: number,
    private readonly update: (
      time: number,
      paused: boolean,
      command: PlaybackCommand,
    ) => void,
    private readonly finish: (completed: boolean) => void,
  ) {
    const driver = getDriver()
    this.clock = driver.clock?.(duration) ?? createClock(() => driver.now())
    this.finished = new Promise((resolve) => {
      this.resolve = resolve
    })
    setArrival(
      this,
      new Promise<void>((resolve) => {
        this.arrive = resolve
      }),
    )
    this.notifyPlayback = registerPlayback(this, () => ({
      time: this.time,
      duration,
      paused: this._paused,
      ready: this.active,
      settled: this.settled,
      completed: this.completed,
    }))
    setArrivalTiming(this, {
      read: () => ({
        remaining: Math.max(0, arrival - this.time),
        paused: this.paused,
        arrived: this.arrived,
      }),
      subscribe: (callback) => {
        this.listeners.add(callback)
        return () => {
          this.listeners.delete(callback)
        }
      },
    })
  }

  get time() {
    return Math.max(0, Math.min(this.duration, this.clock.time()))
  }
  get paused() {
    return this._paused
  }
  get done() {
    return this.settled
  }
  get progress() {
    if (!Number.isFinite(this.duration))
      throw new RangeError('Progress requires a finite animation.')
    return this.completed ? 1 : this.duration ? this.time / this.duration : 0
  }
  set progress(value: number) {
    validateProgress(value, this.duration)
    this.seekTime(value * this.duration)
  }

  start() {
    if (this.active || this.settled) return
    this.active = true
    this.schedule()
    this.notify()
  }

  pause() {
    if (this._paused || this.settled) return
    this.clock.pause()
    this._paused = true
    this.cancelTimers()
    this.update(this.time, true, 'pause')
    this.notify()
  }

  play() {
    if (!this._paused || this.settled) return
    this._paused = false
    this.clock.play()
    this.update(this.time, false, 'play')
    this.schedule()
    this.notify()
  }

  seekTime(time: number) {
    if (!Number.isFinite(time) || time < 0)
      throw new RangeError('Seek time must be finite and nonnegative.')
    if (this.settled) return
    this.clock.seek(Math.min(this.duration, time))
    this.update(this.time, this._paused, 'seek')
    this.schedule()
    this.notify()
  }

  stop() {
    this.settle(false)
  }

  then<A = boolean, B = never>(
    onfulfilled?: ((value: boolean) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): Promise<A | B> {
    return this.finished.then(onfulfilled, onrejected)
  }

  private notify() {
    this.notifyPlayback()
    for (const callback of [...this.listeners]) callback()
  }
  private cancelTimers() {
    this.cancelEnd?.()
    this.cancelArrival?.()
    this.cancelEnd = this.cancelArrival = undefined
  }
  private schedule() {
    this.cancelTimers()
    if (!this.active || this._paused || this.settled) return
    const driver = getDriver()
    if (Number.isFinite(this.duration)) {
      const remaining = this.duration - this.time
      if (remaining <= 0) {
        this.settle(true)
        return
      }
      this.cancelEnd = driver.after(remaining, () => this.settle(true))
    }
    if (!this.arrived && Number.isFinite(this.arrival)) {
      const remaining = this.arrival - this.time
      const arrive = () => {
        this.arrived = true
        this.arrive()
        this.notify()
      }
      if (remaining <= 0) arrive()
      else this.cancelArrival = driver.after(remaining, arrive)
    }
  }
  private settle(completed: boolean) {
    if (this.settled) return
    this.settled = true
    this.completed = completed
    this.cancelTimers()
    if (completed) this.clock.seek(this.duration)
    this.clock.cancel()
    try {
      this.finish(completed)
    } catch (error) {
      this.completed = false
      Trace.write(
        `Jolt sampled playback failed: ${String(error)}`,
        Trace.categories.Error,
        Trace.messageType.error,
      )
    }
    this.arrived = true
    this.arrive()
    this.notify()
    this.resolve(this.completed)
    this.listeners.clear()
  }
}
