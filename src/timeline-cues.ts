import { timeScale, reducedMotion } from './config.js'
import { getDriver } from './driver/index.js'
import { playbackSource } from './playback.js'
import { motionScope, type MotionResource } from './motion-scope.js'
import type { PlayableAnimation } from './sequence.js'

export interface TimelineCue {
  name: string
  /** Logical milliseconds, before configure({ timeScale }). */
  at: number
  effect(event: { name: string; pass: number; lateBy: number }): MotionResource | void
  /** Explicit passes; cues do not infer repeats from individual visual tracks. */
  repeat?: { every: number; count: number; reverse?: boolean }
}
export interface TimelineCueOptions {
  /** Drop stale side effects by default. JavaScript cues cannot run during a JS stall. */
  late?: 'skip' | 'catch-up'
  /** Logical milliseconds; default 50. */
  tolerance?: number
  onError?: (error: unknown, name: string) => void
}
export interface CuedTimeline extends PlayableAnimation {
  /** Available only when the wrapped scene supports seeking. Seeking never fires cues. */
  progress: number
  /** Cancel visuals, pending cues and active effects together. */
  dispose(): void
}

/** Own an existing Jolt timeline/playback and schedule named effects from its native clock. */
export function withTimelineCues(
  animation: PlayableAnimation,
  cues: readonly TimelineCue[],
  options: TimelineCueOptions = {},
): CuedTimeline {
  const source = playbackSource(animation),
    driver = getDriver(),
    slowdown = 1 / timeScale()
  const tolerance = options.tolerance ?? 50
  if (
    !Number.isFinite(tolerance) ||
    tolerance < 0 ||
    (options.late !== undefined && !['skip', 'catch-up'].includes(options.late)) ||
    cues.length > 1024
  )
    throw new TypeError('Invalid timeline cue policy or cue budget.')
  const names = new Set<string>()
  const events = cues
    .flatMap((cue) => {
      if (
        !cue ||
        typeof cue.name !== 'string' ||
        !cue.name ||
        names.has(cue.name) ||
        !Number.isFinite(cue.at) ||
        cue.at < 0 ||
        typeof cue.effect !== 'function'
      )
        throw new TypeError(
          'Cues need unique names, nonnegative times and effect callbacks.',
        )
      names.add(cue.name)
      const count = cue.repeat?.count ?? 1,
        every = cue.repeat?.every ?? 0
      if (
        !Number.isInteger(count) ||
        count < 1 ||
        count > 1024 ||
        (cue.repeat && (!Number.isFinite(every) || every <= 0 || cue.at > every))
      )
        throw new RangeError('Cue repeats need a positive period and 1..1024 passes.')
      return Array.from({ length: count }, (_, pass) => ({
        cue,
        pass,
        at:
          (pass * every + (cue.repeat?.reverse && pass % 2 ? every - cue.at : cue.at)) *
          slowdown,
        fired: false,
      }))
    })
    .sort((a, b) => a.at - b.at)
  if (events.length > 4096)
    throw new RangeError('A timeline supports at most 4096 cue occurrences.')
  const reduced = reducedMotion()
  if (
    !reduced &&
    animation.duration !== undefined &&
    events.some((event) => event.at > animation.duration!)
  )
    throw new RangeError('Cues must lie inside the visual timeline duration.')
  if (reduced)
    events.forEach((event) => {
      event.fired = true
    })
  const effects = motionScope()
  const pending = new Set<Promise<unknown>>()
  let disposed = false,
    off = () => {},
    cancelTimer = () => {},
    seeking = false,
    cancelled = false,
    paused = false
  const report = (error: unknown, name: string) => {
    try {
      options.onError?.(error, name)
    } catch {
      /* Effect errors are isolated. */
    }
  }
  const cleanup = () => {
    if (disposed) return
    disposed = true
    cancelTimer()
    off()
    try {
      effects.dispose()
    } catch (error) {
      report(error, 'cleanup')
    }
  }
  const due = (time: number) => {
    for (const event of events) {
      if (disposed || seeking) return
      if (event.fired || event.at > time) continue
      event.fired = true // Set before invoking application code, including reentrant stop/seek.
      if (reducedMotion()) continue
      const lateBy = Math.max(0, (time - event.at) / slowdown)
      if (options.late !== 'catch-up' && lateBy > tolerance) continue
      try {
        const resource = event.cue.effect({
          name: event.cue.name,
          pass: event.pass,
          lateBy,
        })
        if (!resource) continue
        if (disposed) {
          if (typeof resource === 'function') resource()
          else if ('dispose' in resource) resource.dispose()
          else resource.stop()
          continue
        }
        effects.add(resource)
        const finished = (resource as { finished?: Promise<unknown> }).finished
        if (finished) {
          const observed = finished.catch((error) => report(error, event.cue.name))
          pending.add(observed)
          void observed.then(() => pending.delete(observed))
        }
      } catch (error) {
        report(error, event.cue.name)
      }
    }
  }
  const schedule = () => {
    cancelTimer()
    cancelTimer = () => {}
    if (disposed || seeking) return
    const state = source.read()
    if (paused || state.paused) effects.suspend()
    else effects.resume()
    if (state.settled) {
      if (state.completed) due(state.time)
      else cleanup()
      return
    }
    if (paused || state.paused || (!state.ready && animation.duration !== undefined))
      return
    const next = events.find((event) => !event.fired)
    if (!next) return
    cancelTimer = driver.after(Math.max(0, next.at - state.time), () => {
      if (disposed) return
      const current = source.read()
      if (!paused && !current.paused && (!current.settled || current.completed))
        due(current.time)
      schedule()
    })
  }
  off = source.subscribe(schedule)
  const finished = animation.finished.then(
    async (completed) => {
      if (completed && !disposed) {
        due(source.read().time)
        await Promise.all([...pending])
      }
      cleanup()
      return completed && !cancelled
    },
    (error) => {
      cleanup()
      throw error
    },
  )
  const controller: CuedTimeline = {
    finished,
    then: (fulfilled, rejected) => finished.then(fulfilled, rejected),
    get duration() {
      return animation.duration
    },
    get paused() {
      return paused || animation.paused
    },
    get progress() {
      if (!('progress' in animation)) throw new TypeError('This timeline cannot seek.')
      return (animation as PlayableAnimation & { progress: number }).progress
    },
    set progress(value) {
      if (!('progress' in animation)) throw new TypeError('This timeline cannot seek.')
      if (disposed) return
      seeking = true
      try {
        ;(animation as PlayableAnimation & { progress: number }).progress = value
        // Re-arm future occurrences on backward scrubs; never deliver crossed markers.
        const time = source.read().time
        for (const event of events) event.fired = event.at <= time
        effects.reset()
      } finally {
        seeking = false
        schedule()
      }
    },
    pause() {
      if (!disposed) {
        paused = true
        animation.pause()
        schedule()
      }
    },
    play() {
      if (!disposed) {
        paused = false
        animation.play()
        schedule()
      }
    },
    stop() {
      cancelled = true
      cleanup()
      animation.stop()
    },
    dispose() {
      controller.stop()
    },
  }
  schedule()
  return controller
}
