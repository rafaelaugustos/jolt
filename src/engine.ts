import {
  createClock,
  validateProgress,
  type PlaybackAnimation,
  type PlaybackClock,
  type PlaybackCommand,
} from './playback.js'
import type { View } from '@nativescript/core'
import { getDriver } from './driver/index.js'
import { playHaptics, type HapticOptions } from './haptics.js'
import { readValue, writeValue, type Property } from './properties.js'
import { createTrack, type Track } from './track.js'
import type { ResolvedTransition } from './transition.js'
import { isColorProperty } from './color.js'

export interface Animation extends PromiseLike<boolean> {
  /**
   * Resolves with `true` once the animation played to the end, or with `false`
   * if it was stopped, superseded or skipped.
   * Never rejects.
   */
  readonly finished: Promise<boolean>
  /** Stops playback. Each effect documents whether it preserves or restores its visual state. */
  stop(): void
}

export interface Plan {
  property: Property
  /** `null` stands for the value the property has when the animation starts. */
  keyframes: readonly (number | null)[]
  transition: ResolvedTransition
  relative?: boolean
}

interface Entry {
  readonly track: Track
  readonly startedAt: number
  readonly owner: ViewAnimation
  handle: unknown
  done: boolean
  finished: boolean
  generation: number
  token: symbol
  completedValue?: number
}

const revisions = new WeakMap<View, Map<Property, symbol>>()

const running = new WeakMap<View, Map<Property, Entry>>()
const arrivals = new WeakMap<Animation, Promise<unknown>>()

/**
 * Resolves once the animation looks done, which for a spring is well before
 * `finished`. Sequences move on to the next step then.
 */
export function arrivalOf(animation: Animation): Promise<unknown> {
  return arrivals.get(animation) ?? animation.finished
}

export function setArrival(animation: Animation, arrival: Promise<unknown>) {
  arrivals.set(animation, arrival)
}

export class ViewAnimation implements PlaybackAnimation {
  readonly finished: Promise<boolean>
  private resolve!: (finished: boolean) => void
  private readonly entries: Entry[] = []
  private pending = 0
  private complete = true
  private settled = false
  private cancelWait: (() => void) | undefined
  private arrive!: () => void
  private cancelArrival: (() => void) | undefined
  private haptics: ReturnType<typeof playHaptics>
  private clock: PlaybackClock | undefined
  private _paused = false
  private controlled = false
  private pendingProgress: number | undefined
  private total = 0
  private started = false
  private arrival = 0
  private arrived = false
  private idleListener: (() => void) | undefined
  private readyListener: (() => void) | undefined
  private readonly endless: boolean

  get paused() {
    return this._paused
  }
  get duration() {
    return this.started ? this.total : this.endless ? Infinity : 0
  }
  get currentTime() {
    return this.time()
  }
  get ready() {
    return this.started || this.settled
  }
  get idle() {
    return this.settled || (this.started && this.pending === 0)
  }
  get progress() {
    if (!Number.isFinite(this.duration))
      throw new RangeError('Progress requires a finite animation.')
    if (this.settled && this.complete) return 1
    return (
      this.pendingProgress ??
      (this.duration ? Math.min(1, this.time() / this.duration) : this.settled ? 1 : 0)
    )
  }
  set progress(value: number) {
    validateProgress(value, this.duration)
    if (this.settled) return
    if (!this.started) {
      this.pendingProgress = value
      return
    }
    this.seekTime(this.duration * value)
  }
  onIdle(callback: () => void) {
    this.idleListener = callback
  }
  onReady(callback: () => void) {
    this.readyListener = callback
  }
  releaseGroup() {
    this.held = false
    if (this.idle && !this._paused) this.settle()
  }

  pause() {
    if (this.settled || this._paused) return
    this.controlled = true
    this._paused = true
    this.clock?.pause()
    this.cancelArrival?.()
    this.haptics?.pause()
    if (this.started) this.controlTracks(this.time(), 'pause')
  }
  play() {
    if (this.settled || !this._paused) return
    this.controlled = true
    this._paused = false
    this.clock?.play()
    if (this.started) {
      this.controlTracks(this.time(), 'play')
      this.scheduleArrival()
      this.haptics?.play()
      if (this.pending === 0) this.becameIdle()
    }
  }
  seekTime(time: number) {
    if (this.settled) return
    this.controlled = true
    const position = Math.max(0, Math.min(this.total, time))
    this.clock?.seek(position)
    if (!this._paused) this.clock?.play()
    for (const entry of this.entries) {
      if (
        entry.done &&
        entry.finished &&
        revisions.get(this.view)?.get(entry.track.property) === entry.token &&
        readValue(this.view, entry.track.property) === entry.completedValue
      ) {
        entry.done = false
        entry.finished = false
        this.pending++
        entriesOf(this.view).set(entry.track.property, entry)
        this.playEntry(entry, position)
      }
    }
    this.controlTracks(position)
    this.scheduleArrival()
    this.haptics?.seek()
    if (this.pending === 0) this.becameIdle()
  }
  elapsed(entry: Entry, now: number) {
    return this.controlled
      ? this.time()
      : (getDriver().elapsed?.(entry.handle) ?? now - entry.startedAt)
  }
  private time() {
    return this.clock?.time() ?? 0
  }
  private controlTracks(position: number, command: PlaybackCommand = 'seek') {
    const driver = getDriver()
    for (const entry of this.entries)
      if (!entry.done)
        driver.control?.(this.view, entry.handle, position, this._paused, command)
  }
  private scheduleArrival() {
    this.cancelArrival?.()
    this.cancelArrival = undefined
    if (
      this.pending === 0 ||
      this.arrived ||
      this._paused ||
      !Number.isFinite(this.arrival) ||
      this.total <= this.arrival
    )
      return
    const remaining = this.arrival - this.time()
    if (remaining <= 0) {
      this.arrived = true
      this.arrive()
    } else
      this.cancelArrival = getDriver().after(remaining, () => {
        this.arrived = true
        this.arrive()
      })
  }
  private becameIdle() {
    this.clock?.pause()
    this.idleListener?.()
    if (!this.complete || (!this.held && !this._paused)) this.settle()
  }
  private playEntry(entry: Entry, elapsed = 0) {
    const initial = entry.generation === 0
    const instance = ++entry.generation
    const driver = getDriver()
    entry.handle = driver.play(
      this.view,
      entry.track,
      initial ? entry.startedAt : driver.now() - elapsed,
      (finished = true) => {
        if (entry.done || instance !== entry.generation) return
        entry.done = true
        entry.finished = finished
        entry.completedValue = readValue(this.view, entry.track.property)
        forget(entry)
        this.ended(finished)
      },
    )
  }
  private unloaded = () => this.stop()

  constructor(
    readonly view: View,
    plans: readonly Plan[],
    private readonly haptic?: HapticOptions,
    private held = false,
  ) {
    this.endless = plans.some(
      (plan) =>
        !Number.isFinite(plan.transition.repeat) ||
        (plan.transition.curve.type === 'tween' &&
          !Number.isFinite(plan.transition.curve.duration)),
    )
    this.finished = new Promise((resolve) => (this.resolve = resolve))
    setArrival(this, new Promise<void>((resolve) => (this.arrive = resolve)))
    if (view.isLoaded && view.nativeViewProtected) this.start(plans)
    else this.waitForLoad(plans)
  }

  then<A = boolean, B = never>(
    onfulfilled?: ((finished: boolean) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): Promise<A | B> {
    return this.finished.then(onfulfilled, onrejected)
  }

  stop() {
    if (this.settled) return
    this.cancelWait?.()
    this.haptics?.cancel()
    const now = getDriver().now()
    for (const entry of this.entries) {
      if (!entry.done) release(entry, now, true)
    }
    this.complete = false
    this.settle()
  }

  ended(finished: boolean) {
    if (!finished) {
      this.complete = false
      this.haptics?.cancel()
    }
    if (--this.pending === 0) this.becameIdle()
  }

  private start(plans: readonly Plan[]) {
    this.started = true
    const driver = getDriver()
    const now = driver.now()
    const entries = entriesOf(this.view)

    const tracks = plans.map(({ property, keyframes, transition, relative }) => {
      const previous = entries.get(property)
      let current: number
      let velocity = 0
      if (previous) {
        const elapsed = elapsedOf(previous, now)
        current = driver.presented(this.view, property) ?? previous.track.valueAt(elapsed)
        velocity = previous.owner.paused ? 0 : previous.track.velocityAt(elapsed)
        release(previous, now, false)
      } else {
        current =
          (isColorProperty(property)
            ? driver.presented(this.view, property)
            : undefined) ?? readValue(this.view, property)
      }
      return createTrack(
        property,
        keyframes.map((value) => {
          if (value === null) return current
          if (!relative || isColorProperty(property)) return value
          return property === 'opacity' || property.startsWith('scale')
            ? current * value
            : current + value
        }),
        transition,
        velocity,
      )
    })

    for (const track of tracks) writeValue(this.view, track.property, track.to)
    driver.sync?.(this.view)

    for (const track of tracks) {
      let tokens = revisions.get(this.view)
      if (!tokens) revisions.set(this.view, (tokens = new Map()))
      const token = Symbol(track.property)
      tokens.set(track.property, token)
      if (track.end === 0) continue
      const entry: Entry = {
        track,
        startedAt: now,
        owner: this,
        handle: undefined,
        done: false,
        finished: false,
        generation: 0,
        token,
      }
      entries.set(track.property, entry)
      this.entries.push(entry)
      this.pending++
    }

    this.total = Math.max(0, ...tracks.map((track) => track.end))
    this.arrival = Math.max(0, ...tracks.map((track) => track.arrival))
    this.clock =
      (this.pending ? driver.clock?.(this.total) : undefined) ??
      createClock(() => driver.now())
    if (this._paused) this.clock.pause()
    this.view.on('unloaded', this.unloaded)
    this.haptics = playHaptics(this.view, tracks, this.haptic, driver, now, () =>
      this.time(),
    )
    if (this._paused) this.haptics?.pause()
    for (const entry of this.entries) this.playEntry(entry)
    if (this.pendingProgress !== undefined) {
      const progress = this.pendingProgress
      this.pendingProgress = undefined
      this.seekTime(progress * this.total)
    } else if (this._paused) this.controlTracks(0, 'pause')
    this.scheduleArrival()
    this.readyListener?.()
    if (this.pending === 0) this.becameIdle()
  }

  private waitForLoad(plans: readonly Plan[]) {
    for (const { property, keyframes, relative } of plans) {
      if (relative && !isColorProperty(property)) continue
      const first = keyframes[0]
      if (first !== null && first !== undefined) writeValue(this.view, property, first)
    }
    const onLoaded = () => {
      this.cancelWait?.()
      this.start(plans)
    }
    this.view.on('loaded', onLoaded)
    this.cancelWait = () => {
      this.view.off('loaded', onLoaded)
      this.cancelWait = undefined
    }
  }

  private settle() {
    if (this.settled) return
    this.settled = true
    this.cancelArrival?.()
    this.clock?.cancel()
    this.view.off('unloaded', this.unloaded)
    if (this.complete) this.haptics?.finish()
    else this.haptics?.cancel()
    this.haptics = undefined
    this.arrive()
    this.resolve(this.complete)
  }
}

/** Stops whatever is animating these properties of the view, or all of them. */
export function stopView(view: View, properties?: readonly Property[]) {
  const tokens = revisions.get(view)
  for (const property of properties ?? tokens?.keys() ?? [])
    tokens?.set(property, Symbol(property))
  const entries = running.get(view)
  if (!entries) return
  const now = getDriver().now()
  for (const [property, entry] of [...entries]) {
    if (!properties || properties.includes(property)) release(entry, now, true)
  }
}

function entriesOf(view: View) {
  let entries = running.get(view)
  if (!entries) running.set(view, (entries = new Map()))
  return entries
}

function forget(entry: Entry) {
  const entries = running.get(entry.owner.view)
  if (entries?.get(entry.track.property) === entry) entries.delete(entry.track.property)
}

function release(entry: Entry, now: number, commit: boolean) {
  const driver = getDriver()
  const { view } = entry.owner
  const { property } = entry.track
  entry.done = true
  forget(entry)
  if (commit) {
    const value =
      driver.presented(view, property) ?? entry.track.valueAt(elapsedOf(entry, now))
    writeValue(view, property, value)
    driver.sync?.(view, property)
  }
  driver.stop(view, entry.handle)
  entry.owner.ended(false)
}

function elapsedOf(entry: Entry, now: number) {
  return entry.owner.elapsed(entry, now)
}
