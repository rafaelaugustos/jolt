import { resolveHaptic, type HapticOptions, type HapticStyle } from '../core/haptic.js'
import { playbackSource, type PlaybackAnimation } from '../core/playback.js'
import type { Track } from '../core/track.js'
import type { EffectHost } from './effect.js'

export type { Haptic, HapticStyle, HapticOptions } from '../core/haptic.js'
export interface WebHapticResult {
  readonly backend: 'vibration' | 'none'
  /** Requested means the browser accepted a request, never proof of tactile output. */
  readonly status: 'requested' | 'unavailable' | 'blocked' | 'disabled'
}
export function requestHaptic(style: HapticStyle, host: EffectHost): WebHapticResult {
  if (!resolveHaptic(style))
    throw new TypeError('A haptic request needs an impact style.')
  const view = host.document.defaultView!,
    navigator = view.navigator
  const backend = typeof navigator.vibrate === 'function' ? 'vibration' : 'none'
  if (backend === 'none') return { backend, status: 'unavailable' }
  if (host.reduced()) return { backend, status: 'disabled' }
  if (host.document.hidden || !navigator.userActivation?.hasBeenActive)
    return { backend, status: 'blocked' }
  try {
    // These are short duration hints, not native impact intensity equivalents.
    return {
      backend,
      status: navigator.vibrate({ light: 10, medium: 20, heavy: 30 }[style])
        ? 'requested'
        : 'blocked',
    }
  } catch {
    return { backend, status: 'blocked' }
  }
}

/** Boundary timers follow the visual playback clock. Seeking never replays old cues. */
export function animationHaptics(
  animation: PlaybackAnimation,
  tracks: readonly Track[],
  options: HapticOptions,
  host: EffectHost,
  active: () => boolean,
) {
  const moving = tracks.filter(
    (t) => t.duration > 0 && t.values.some((v) => v !== t.values[0]),
  )
  if (!moving.length || !Number.isFinite(animation.duration) || host.document.hidden)
    return
  const delay = Math.min(...moving.map((t) => t.delay)),
    end = animation.duration
  const offsets = options.times?.map((t) => delay + (end - delay) * t) ?? [
    Math.max(...moving.map((t) => t.arrival)),
  ]
  const source = playbackSource(animation)
  let next = 0,
    ended = false,
    timer: (() => void) | undefined
  let off = () => {}
  let visibility = () => {}
  const cancel = () => {
    ended = true
    timer?.()
    off()
    visibility()
  }
  const skip = (time: number) => {
    while (next < offsets.length && offsets[next]! <= time) next++
  }
  const fire = (time: number) => {
    while (next < offsets.length && offsets[next]! <= time + 0.5) {
      const offset = offsets[next++]!
      if (time - offset <= 100 && active()) requestHaptic(options.style, host)
    }
  }
  const sync = () => {
    timer?.()
    timer = undefined
    if (ended) return
    const state = source.read()
    if (!active()) return cancel()
    if (state.settled) {
      if (state.completed) fire(end)
      return cancel()
    }

    if (!state.ready || state.paused) return
    if (next >= offsets.length) return cancel()
    timer = host.after(Math.max(1, offsets[next]! - state.time), () => {
      fire(source.read().time)
      sync()
    })
  }
  off = source.subscribe(sync)
  visibility = host.visibility(() => {
    if (host.document.hidden) cancel()
  })
  sync()
  return { cancel, seek: skip }
}
