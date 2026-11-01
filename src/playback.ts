import type { Animation, PlaybackState } from './core/playback.js'
export {
  createClock,
  validateProgress,
  type PlaybackAnimation,
  type PlaybackClock,
  type PlaybackCommand,
  type PlaybackState,
} from './core/playback.js'

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
