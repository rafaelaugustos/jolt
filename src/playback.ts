import type { Animation } from './engine.js'

/** Controls returned by animate() and decay(). Effects expose the base Animation. */
export interface PlaybackAnimation extends Animation {
  /** Pauses only the properties owned by this animation. */
  pause(): void
  /** Continues from the current position. Completed/stopped animations remain terminal. */
  play(): void
  readonly paused: boolean
  /** Total milliseconds, including delays and repeats. Infinity for endless loops. */
  readonly duration: number
  /** Finite timeline position, from 0 to 1. Seeking preserves the playing/paused state. */
  progress: number
}

export type PlaybackCommand = 'pause' | 'play' | 'seek'

export interface PlaybackClock {
  time(): number
  pause(): void
  play(): void
  seek(ms: number): void
  cancel(): void
}

/** Boundary notifications, never frame callbacks. Consumers sample this same clock. */
export interface PlaybackState {
  readonly position?: number
  readonly time: number
  readonly duration: number
  readonly paused: boolean
  readonly ready: boolean
  readonly settled: boolean
  readonly completed: boolean
}

const sources = new WeakMap<
  Animation,
  {
    read(): PlaybackState
    listeners: Set<() => void>
  }
>()

export function registerPlayback(animation: Animation, read: () => PlaybackState) {
  const source = { read, listeners: new Set<() => void>() }
  sources.set(animation, source)
  return () => {
    for (const listener of [...source.listeners]) listener()
  }
}

export function playbackSource(animation: Animation) {
  const source = sources.get(animation)
  if (!source) throw new TypeError('This animation does not expose a playback clock.')
  return {
    read: source.read,
    subscribe(listener: () => void) {
      source.listeners.add(listener)
      return () => {
        source.listeners.delete(listener)
      }
    },
  }
}

/** Read only on user commands; there is no frame loop in JavaScript. */
export function createClock(now: () => number, initial = 0): PlaybackClock {
  let offset = initial
  let anchor = now()
  let paused = false
  const time = () => offset + (paused ? 0 : now() - anchor)
  return {
    time,
    pause() {
      offset = time()
      paused = true
    },
    play() {
      if (paused) {
        anchor = now()
        paused = false
      }
    },
    seek(ms) {
      offset = ms
      anchor = now()
    },
    cancel() {
      offset = time()
      paused = true
    },
  }
}

export function validateProgress(value: number, duration: number) {
  if (!Number.isFinite(value) || value < 0 || value > 1)
    throw new RangeError('Animation progress must be between 0 and 1.')
  if (!Number.isFinite(duration))
    throw new RangeError(
      'Progress requires a finite animation; endless loops can pause and play.',
    )
}
