import type { View as CoreView } from '@nativescript/core'
import { afterEach, beforeEach } from 'vitest'
import { configure } from '../src/config.js'
import { setDriver, type Driver } from '../src/driver/index.js'
import type { Property } from '../src/properties.js'
import type { Track } from '../src/track.js'
import { View } from './shims/core.js'

export interface Played {
  view: View
  track: Track
  startedAt: number
  /** The view's values when the track was handed to the platform. */
  snapshot: Record<string, number>
  held?: boolean
  offset?: number
  controlledAt?: number
  stopped: boolean
  ended: boolean
  onEnd: () => void
}

/**
 * Plays nothing: it records what it's given, and ends tracks and runs timers
 * when the clock passes them. Like Android, stopping a track ends it synchronously.
 */
export class FakeDriver implements Driver {
  time = 1000
  reduced = false
  played: Played[] = []
  private timers: { at: number; callback: () => void; done: boolean }[] = []

  now() {
    return this.time
  }

  play(view: CoreView, track: Track, startedAt: number, onEnd: () => void) {
    const shim = view as unknown as View
    const played: Played = {
      view: shim,
      track,
      startedAt,
      snapshot: snapshot(shim),
      stopped: false,
      ended: false,
      onEnd,
    }
    this.played.push(played)
    return played
  }

  stop(_view: CoreView, handle: unknown) {
    const played = handle as Played
    played.stopped = true
    end(played)
  }

  control(_view: CoreView, handle: unknown, elapsed: number, paused: boolean) {
    const played = handle as Played
    played.offset = elapsed
    played.controlledAt = this.time
    played.held = paused
  }

  presented(): number | undefined {
    return undefined
  }

  reducedMotion() {
    return this.reduced
  }

  after(ms: number, callback: () => void) {
    const timer = { at: this.time + ms, callback, done: false }
    this.timers.push(timer)
    return () => {
      timer.done = true
    }
  }

  advance(ms: number) {
    this.time += ms
    for (const timer of this.timers) {
      if (!timer.done && this.time >= timer.at) {
        timer.done = true
        timer.callback()
      }
    }
    for (const played of this.played) {
      if (
        !played.ended &&
        !played.held &&
        (played.offset ?? 0) + this.time - (played.controlledAt ?? played.startedAt) >=
          played.track.end
      )
        end(played)
    }
  }

  /** The latest track played for that property. */
  last(property: Property, view?: View): Played {
    const played = this.played.findLast(
      (p) => p.track.property === property && (!view || p.view === view),
    )
    if (!played) throw new Error(`nothing played for ${property}`)
    return played
  }
}

function end(played: Played) {
  if (played.ended) return
  played.ended = true
  played.onEnd()
}

function snapshot(view: View) {
  const { opacity, translateX, translateY, scaleX, scaleY, rotate, rotateX, rotateY } =
    view
  return { opacity, translateX, translateY, scaleX, scaleY, rotate, rotateX, rotateY }
}

export let driver: FakeDriver

beforeEach(() => {
  driver = new FakeDriver()
  setDriver(driver)
  configure({ timeScale: 1, reducedMotion: 'user' })
})

afterEach(() => setDriver(undefined))

/** Settles pending promise callbacks. */
export async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

export function state<T>(promise: Promise<T>) {
  let result: { value: T } | undefined
  void promise.then((value) => (result = { value }))
  return () => result
}

/** A view from the shim, typed as core's so it can be passed to Jolt. */
export function createView(): View & CoreView {
  return new View() as View & CoreView
}
