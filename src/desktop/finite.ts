import { createTrack, type Track } from '../core/track.js'
import { resolveTransition } from '../core/transition.js'

export type DesktopProperty = 'opacity' | 'x' | 'y'
export interface DesktopOptions {
  duration?: number
  ease?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'
  reducedMotion?: boolean
}
interface NativeChannel {
  read(): number
  write(value: number): void
  play(track: Track, done: () => void): () => void
}

const owners = new WeakSet<object>()

/** One explicit owner per surface. Call dispose when its native window or view is removed. */
export function finiteMotion(
  target: object,
  channel: (property: DesktopProperty) => NativeChannel,
  reduced: () => boolean,
) {
  if (owners.has(target))
    throw new Error('This desktop target already has a motion owner.')
  owners.add(target)
  const active = new Map<DesktopProperty, () => void>()
  let disposed = false
  function suspend() {
    for (const cancel of [...active.values()]) cancel()
  }
  return {
    animate(property: DesktopProperty, to: number, options: DesktopOptions = {}) {
      if (disposed) throw new Error('Desktop motion owner was disposed.')
      if (!['opacity', 'x', 'y'].includes(property))
        throw new TypeError('Unsupported desktop property.')
      if (!Number.isFinite(to) || (property === 'opacity' && (to < 0 || to > 1)))
        throw new RangeError('Expected a finite target and opacity between zero and one.')
      const transition = resolveTransition(
        { duration: options.duration ?? 240, ease: options.ease ?? 'easeOut' },
        property,
        2,
      )
      const port = channel(property)
      const track = createTrack(property, [port.read(), to], transition, 0, {
        timeScale: 1,
        reducedMotion: false,
      })
      const instant = reduced() || options.reducedMotion || track.duration === 0
      active.get(property)?.()
      let settle!: (finished: boolean) => void
      const finished = new Promise<boolean>((resolve) => {
        settle = resolve
      })
      let stop = () => {}
      function finish(success: boolean) {
        if (active.get(property) !== cancel) return
        active.delete(property)
        settle(success)
      }
      function cancel() {
        if (active.get(property) !== cancel) return
        finish(false)
        stop()
      }
      active.set(property, cancel)
      try {
        if (instant) {
          port.write(to)
          finish(true)
        } else stop = port.play(track, () => finish(true))
      } catch (error) {
        finish(false)
        throw error
      }
      return { finished, cancel }
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
