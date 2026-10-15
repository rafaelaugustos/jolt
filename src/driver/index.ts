import { isAndroid, type View } from '@nativescript/core'
import type { Property } from '../properties.js'
import type { Track } from '../track.js'
import { createAndroidDriver } from './android.js'
import { createIOSDriver } from './ios.js'

export interface Driver {
  /** Milliseconds, on the clock the platform's animations run on. */
  now(): number
  /** Starts the track at `startedAt + track.delay` and calls `onEnd` once, however it ends. */
  play(view: View, track: Track, startedAt: number, onEnd: () => void): unknown
  stop(view: View, handle: unknown): void
  /** Track time, including its delay, when the native clock differs from `now()`. */
  elapsed?(handle: unknown): number
  /** The value on screen, when the platform knows it better than the track does. */
  presented(view: View, property: Property): number | undefined
  /** Calls back after `ms` of animation time, respecting platform speed settings. */
  after(ms: number, callback: () => void): () => void
}

export function after(ms: number, callback: () => void) {
  const timer = setTimeout(callback, ms)
  return () => clearTimeout(timer)
}

let driver: Driver | undefined

export function getDriver(): Driver {
  return (driver ??= isAndroid ? createAndroidDriver() : createIOSDriver())
}

export function setDriver(next: Driver | undefined) {
  driver = next
}
