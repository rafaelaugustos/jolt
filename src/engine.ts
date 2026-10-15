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
}

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

export class ViewAnimation implements Animation {
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

  constructor(
    readonly view: View,
    plans: readonly Plan[],
    private readonly haptic?: HapticOptions,
  ) {
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
    if (--this.pending === 0) this.settle()
  }

  private start(plans: readonly Plan[]) {
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
        velocity = previous.track.velocityAt(elapsed)
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

    for (const track of tracks) {
      if (track.end === 0) continue
      const entry: Entry = {
        track,
        startedAt: now,
        owner: this,
        handle: undefined,
        done: false,
      }
      entries.set(track.property, entry)
      this.entries.push(entry)
      this.pending++
    }

    this.haptics = playHaptics(this.view, tracks, this.haptic, driver, now)

    for (const entry of this.entries) {
      entry.handle = driver.play(this.view, entry.track, now, (finished = true) => {
        if (entry.done) return
        entry.done = true
        forget(entry)
        this.ended(finished)
      })
    }

    const arrival = Math.max(...this.entries.map((entry) => entry.track.arrival))
    if (this.pending === 0) this.settle()
    else if (Number.isFinite(arrival) && tracks.some((track) => track.end > arrival)) {
      this.cancelArrival = driver.after(arrival, this.arrive)
    }
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
    if (this.complete) this.haptics?.finish()
    else this.haptics?.cancel()
    this.haptics = undefined
    this.arrive()
    this.resolve(this.complete)
  }
}

/** Stops whatever is animating these properties of the view, or all of them. */
export function stopView(view: View, properties?: readonly Property[]) {
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
  }
  driver.stop(view, entry.handle)
  entry.owner.ended(false)
}

function elapsedOf(entry: Entry, now: number) {
  return getDriver().elapsed?.(entry.handle) ?? now - entry.startedAt
}
