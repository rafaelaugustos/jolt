import { createTrack, type Track } from '../core/track.js'
import { resolveTransition } from '../core/transition.js'

const properties = ['opacity', 'x', 'y', 'scaleX', 'scaleY', 'rotate'] as const
export type DesktopProperty = (typeof properties)[number]
export interface DesktopOptions {
  duration?: number
  ease?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'
  reducedMotion?: boolean
}
type Segment = Pick<Track, 'duration' | 'times' | 'values' | 'to'>
interface NativeChannel {
  read(): number
  write(value: number): void
  play(track: Segment, done: () => void): () => void
}

declare const performance: { now(): number }
const owners = new WeakSet<object>()

// Keep the original sample times and easing for the rest of the track.
function remainder(track: Segment, elapsed: number, held: number): Segment {
  const duration = track.duration - elapsed
  const first = track.times.findIndex((time) => time * track.duration > elapsed)
  const times = first < 0 ? [] : track.times.slice(first)
  return {
    duration,
    to: track.to,
    times: [0, ...times.map((time) => (time * track.duration - elapsed) / duration)],
    values: [held, ...(first < 0 ? [] : track.values.slice(first))],
  }
}

/** One explicit owner per surface. Call dispose when its native window or view is removed. */
export function finiteMotion(
  target: object,
  channel: (property: DesktopProperty) => NativeChannel,
  reduced: () => boolean,
) {
  if (owners.has(target))
    throw new Error('This desktop target already has a motion owner.')
  owners.add(target)
  const active = new Map<DesktopProperty, { cancel(): void; position(): number }>()
  let disposed = false
  function suspend() {
    for (const handle of [...active.values()]) handle.cancel()
  }
  return {
    animate(property: DesktopProperty, to: number, options: DesktopOptions = {}) {
      if (disposed) throw new Error('Desktop motion owner was disposed.')
      if (!properties.includes(property))
        throw new TypeError('Unsupported desktop property.')
      if (
        !Number.isFinite(to) ||
        (property === 'opacity' && (to < 0 || to > 1)) ||
        ((property === 'scaleX' || property === 'scaleY') && to <= 0)
      )
        throw new RangeError(
          'Expected a finite target, positive scale and opacity between zero and one.',
        )
      const transition = resolveTransition(
        { duration: options.duration ?? 240, ease: options.ease ?? 'easeOut' },
        property,
        2,
      )
      const port = channel(property),
        previous = active.get(property)
      const track = createTrack(
        property,
        [previous?.position() ?? port.read(), to],
        transition,
        0,
        { timeScale: 1, reducedMotion: false },
      )
      const instant = reduced() || options.reducedMotion || track.duration === 0
      previous?.cancel()
      let settle!: (finished: boolean) => void
      const finished = new Promise<boolean>((resolve) => {
        settle = resolve
      })
      let stop: (() => void) | undefined,
        elapsed = 0,
        started = 0,
        generation = 0,
        held: number | undefined
      const owner = { cancel, position: () => held ?? port.read() }
      const current = () => active.get(property) === owner
      function finish(completed: boolean) {
        if (!current()) return
        generation++
        active.delete(property)
        settle(completed)
      }
      function cancel() {
        if (!current()) return
        finish(false)
        stop?.()
        stop = undefined
      }
      function start(segment: Segment, immediate: boolean) {
        const ticket = ++generation
        try {
          if (immediate || segment.duration <= 0) {
            port.write(to)
            finish(true)
          } else {
            started = performance.now()
            stop = port.play(segment, () => {
              if (ticket === generation) finish(true)
            })
          }
        } catch (error) {
          finish(false)
          throw error
        }
      }
      function pause() {
        if (!current() || held !== undefined) return
        held = port.read()
        elapsed = Math.min(
          track.duration,
          elapsed + Math.max(0, performance.now() - started),
        )
        generation++
        stop?.()
        stop = undefined
      }
      function resume() {
        if (!current() || held === undefined) return
        const value = held
        held = undefined
        if (elapsed >= track.duration || reduced()) start(track, true)
        else start(remainder(track, elapsed, value), false)
      }
      active.set(property, owner)
      start(track, !!instant)
      return { finished, cancel, pause, resume }
    },
    suspend,
    dispose() {
      if (disposed) return
      disposed = true
      try {
        suspend()
      } finally {
        owners.delete(target)
      }
    },
  }
}
