import {
  createClock,
  registerPlayback,
  validateProgress,
  type PlaybackAnimation,
  type PlaybackClock,
  type PlaybackCommand,
} from './playback.js'
import { Application, type View } from '@nativescript/core'
import { getDriver } from './driver/index.js'
import { playHaptics, type HapticOptions } from './haptics.js'
import { readValue, writeValue, type Property } from './properties.js'
import { createTrack, type Track } from './track.js'
import type { ResolvedTransition } from './transition.js'
import { isColorProperty } from './color.js'
import type { PreparedPath, PathProperty } from './path.js'
import { BASE, identity, MixHandle, mixFor, mixOf, mixesOf } from './mixer.js'

export interface Animation extends PromiseLike<boolean> {
  /**
   * Resolves with `true` once the animation played to the end, or with `false`
   * if it was stopped, superseded or skipped.
   * Playback cancellation never rejects; sequences can reject setup/callback errors.
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
  path?: PreparedPath
  /** A track that is already sampled, like a motion value mapped onto a property. */
  track?: () => Track
  /** A named layer composed with the property's base instead of replacing it. */
  layer?: string
}

interface Entry {
  readonly track: Track
  /** The property, or the property and its layer. */
  readonly key: string
  readonly layer?: string
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

const running = new WeakMap<View, Map<string, Entry>>()
const arrivals = new WeakMap<Animation, Promise<unknown>>()

/** Internal forecast for starting a timeline step before another one arrives. */
export interface ArrivalTiming {
  read(): { remaining: number | undefined; paused: boolean; arrived: boolean }
  subscribe(callback: () => void): () => void
}
const arrivalTimings = new WeakMap<Animation, ArrivalTiming>()

export function arrivalTimingOf(animation: Animation) {
  return arrivalTimings.get(animation)
}

export function setArrivalTiming(animation: Animation, timing: ArrivalTiming) {
  arrivalTimings.set(animation, timing)
}

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
  private readonly timingListeners = new Set<() => void>()
  private readonly playbackChanged: () => void
  private timingChanged() {
    this.playbackChanged()
    for (const callback of [...this.timingListeners]) callback()
  }

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
      this.timingChanged()
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
    this.timingChanged()
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
    this.timingChanged()
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
        entriesOf(this.view).set(entry.key, entry)
        this.playEntry(entry, position)
      }
    }
    this.controlTracks(position)
    this.scheduleArrival()
    this.haptics?.seek()
    if (this.pending === 0) this.becameIdle()
    this.timingChanged()
  }
  elapsed(entry: Entry, now: number) {
    if (this.controlled) return this.time()
    if (entry.handle instanceof MixHandle) return entry.handle.elapsed()
    return getDriver().elapsed?.(entry.handle) ?? now - entry.startedAt
  }
  private time() {
    return this.clock?.time() ?? 0
  }
  private controlTracks(position: number, command: PlaybackCommand = 'seek') {
    const driver = getDriver()
    for (const entry of this.entries)
      if (entry.done) continue
      else if (entry.handle instanceof MixHandle)
        entry.handle.control(position, this._paused)
      else driver.control?.(this.view, entry.handle, position, this._paused, command)
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
      this.timingChanged()
    } else
      this.cancelArrival = getDriver().after(remaining, () => {
        this.arrived = true
        this.arrive()
        this.timingChanged()
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
    const startedAt = initial ? entry.startedAt : driver.now() - elapsed
    const onEnd = (finished = true) => {
      if (entry.done || instance !== entry.generation) return
      entry.done = true
      entry.finished = finished
      entry.completedValue = readValue(this.view, entry.track.property)
      forget(entry)
      this.ended(finished)
    }
    const { property } = entry.track
    const mix =
      entry.layer !== undefined ? mixing(this.view, property) : mixOf(this.view, property)
    entry.handle = mix
      ? mix.adopt(entry.layer ?? BASE, entry.track, startedAt, onEnd)
      : driver.play(this.view, entry.track, startedAt, onEnd)
  }

  /** Moves a natively playing entry into its property's mix, without restarting it. */
  rehome(entry: Entry) {
    if (entry.done || entry.handle instanceof MixHandle) return
    const elapsed = this.elapsed(entry, getDriver().now())
    const handle = entry.handle
    entry.generation++
    getDriver().stop(this.view, handle)
    this.playEntry(entry, elapsed)
  }
  private unloaded = () => {
    // NativeScript unloads the root view when iOS enters the background.
    // An explicitly paused owner can resume after that temporary unload.
    if (this._paused && Application.suspended) return
    this.stop()
  }

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
    this.playbackChanged = registerPlayback(this, () => ({
      position: this.pendingProgress,
      time:
        this.pendingProgress === undefined
          ? this.time()
          : this.pendingProgress * this.duration,
      duration: this.duration,
      paused: this._paused,
      ready: this.ready,
      settled: this.settled,
      completed: this.settled && this.complete,
    }))
    setArrival(this, new Promise<void>((resolve) => (this.arrive = resolve)))
    setArrivalTiming(this, {
      read: () => ({
        remaining: this.started ? Math.max(0, this.arrival - this.time()) : undefined,
        paused: this._paused,
        arrived: this.arrived || this.settled,
      }),
      subscribe: (callback) => {
        this.timingListeners.add(callback)
        return () => this.timingListeners.delete(callback)
      },
    })
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

    const made = plans.map((plan) => {
      const { property, keyframes, transition, relative, path, layer } = plan
      const key = layer === undefined ? property : `${property}#${layer}`
      const mixed = layer !== undefined || mixOf(this.view, property) !== undefined
      const previous = entries.get(key)
      let current: number
      let velocity = 0
      if (previous) {
        const elapsed = elapsedOf(previous, now)
        current =
          (mixed ? undefined : driver.presented(this.view, property)) ??
          previous.track.valueAt(elapsed)
        velocity = previous.owner.paused ? 0 : previous.track.velocityAt(elapsed)
        release(previous, now, false)
      } else if (mixed) {
        current =
          mixOf(this.view, property)?.rest(layer ?? BASE) ??
          (layer === undefined ? readValue(this.view, property) : identity(property))
      } else {
        current =
          (isColorProperty(property)
            ? driver.presented(this.view, property)
            : undefined) ?? readValue(this.view, property)
      }
      const build = () => {
        if (plan.track) return plan.track()
        if (path)
          return path.track(
            property as PathProperty,
            relative ? current : 0,
            transition.delay,
          )
        return createTrack(
          property,
          keyframes.map((value) => {
            if (value === null) return current
            if (layer !== undefined || !relative || isColorProperty(property))
              return value
            return property === 'opacity' || property.startsWith('scale')
              ? current * value
              : current + value
          }),
          transition,
          velocity,
        )
      }
      return { track: build(), key, layer }
    })
    const tracks = made.map(({ track }) => track)

    for (const { track, layer } of made) {
      const mix =
        layer !== undefined
          ? mixing(this.view, track.property)
          : mixOf(this.view, track.property)
      if (!mix) writeValue(this.view, track.property, track.to)
      else if (track.end === 0) mix.setRest(layer ?? BASE, track.to)
    }
    driver.sync?.(this.view)

    for (const { track, key, layer } of made) {
      const token = Symbol(track.property)
      if (layer === undefined) {
        let tokens = revisions.get(this.view)
        if (!tokens) revisions.set(this.view, (tokens = new Map()))
        tokens.set(track.property, token)
      }
      if (track.end === 0) continue
      const entry: Entry = {
        track,
        key,
        layer,
        startedAt: now,
        owner: this,
        handle: undefined,
        done: false,
        finished: false,
        generation: 0,
        token,
      }
      entries.set(key, entry)
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
    this.timingChanged()
    if (this.pending === 0) this.becameIdle()
  }

  private waitForLoad(plans: readonly Plan[]) {
    for (const { property, keyframes, relative, layer } of plans) {
      if (layer !== undefined || (relative && !isColorProperty(property))) continue
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
    this.timingChanged()
  }
}

/** Current native presentation when available, otherwise the active curve or model. */
export function currentValue(view: View, property: Property): number {
  const mix = mixOf(view, property)
  if (mix) return mix.value()
  const entry = running.get(view)?.get(property)
  if (!entry) return readValue(view, property)
  const driver = getDriver()
  return (
    driver.presented(view, property) ??
    entry.track.valueAt(elapsedOf(entry, driver.now()))
  )
}

/** Internal property ownership marker; layout cleanup must preserve newer animations. */
export function propertyRevision(view: View, property: Property) {
  return revisions.get(view)?.get(property)
}

/** Sample an existing owner at layout time, without stealing an animation started meanwhile. */
export function captureValue(view: View, property: Property): () => number | undefined {
  const token = propertyRevision(view, property)
  const entry = running.get(view)?.get(property)
  const initial = currentValue(view, property)
  return () => {
    if (propertyRevision(view, property) !== token) return undefined
    if (entry && running.get(view)?.get(property) === entry)
      return currentValue(view, property)
    return entry?.finished ? entry.track.to : initial
  }
}

/** Stops whatever is animating these properties of the view, or all of them, layers included. */
export function stopView(view: View, properties?: readonly Property[]) {
  const tokens = revisions.get(view)
  for (const property of properties ?? tokens?.keys() ?? [])
    tokens?.set(property, Symbol(property))
  for (const mix of mixesOf(view))
    if (!properties || properties.includes(mix.property)) mix.freeze()
  const entries = running.get(view)
  if (!entries) return
  const now = getDriver().now()
  for (const entry of [...entries.values()]) {
    if (!properties || properties.includes(entry.track.property))
      release(entry, now, true)
  }
}

/** Stops the regular animations of these properties and leaves their layers running. */
export function stopBase(view: View, properties: readonly Property[]) {
  const tokens = revisions.get(view)
  for (const property of properties) tokens?.set(property, Symbol(property))
  const now = getDriver().now()
  for (const property of properties) {
    const entry = running.get(view)?.get(property)
    if (entry) release(entry, now, true)
  }
}

/** Stops one layer and takes away what it adds, also after it finished. */
export function stopLayer(view: View, layer: string, properties?: readonly Property[]) {
  const now = getDriver().now()
  for (const entry of [...(running.get(view)?.values() ?? [])])
    if (
      entry.layer === layer &&
      (!properties || properties.includes(entry.track.property))
    )
      release(entry, now, true)
  for (const mix of mixesOf(view))
    if (!properties || properties.includes(mix.property))
      mix.setRest(layer, identity(mix.property))
}

/** Writes a property's base value, under its layers when it has any. */
export function setBase(view: View, property: Property, value: number) {
  const mix = mixOf(view, property)
  if (mix) mix.setRest(BASE, value)
  else writeValue(view, property, value)
}

/** A property's base value, without what its layers add. */
export function baseValue(view: View, property: Property): number {
  return mixOf(view, property)?.rest(BASE) ?? readValue(view, property)
}

/** The property's mix, created on its first layer; a base playing natively moves into it. */
function mixing(view: View, property: Property) {
  const existing = mixOf(view, property)
  if (existing) return existing
  const mix = mixFor(view, property)
  const base = running.get(view)?.get(property)
  if (base) base.owner.rehome(base)
  return mix
}

function entriesOf(view: View) {
  let entries = running.get(view)
  if (!entries) running.set(view, (entries = new Map()))
  return entries
}

function forget(entry: Entry) {
  const entries = running.get(entry.owner.view)
  if (entries?.get(entry.key) === entry) entries.delete(entry.key)
}

function release(entry: Entry, now: number, commit: boolean) {
  const driver = getDriver()
  const { view } = entry.owner
  const { property } = entry.track
  entry.done = true
  forget(entry)
  if (entry.handle instanceof MixHandle) {
    entry.handle.mix.detach(entry.layer ?? BASE, commit)
    entry.owner.ended(false)
    return
  }
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
