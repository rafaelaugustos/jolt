import {
  createClock,
  registerPlayback,
  playbackSource,
  type Animation,
  type PlaybackClock,
} from './playback.js'
import { arrivalOf, arrivalTimingOf, setArrival } from './arrival.js'

export type SequencePosition = number | '<' | `${'+' | '-'}${number}`
export interface PlayableAnimation extends Animation {
  pause(): void
  play(): void
  readonly paused: boolean
  readonly duration?: number
}
export interface TimelineAnimation extends PlayableAnimation {
  readonly duration: number | undefined
}
export interface SequenceHost {
  driver: {
    now(): number
    after(ms: number, callback: () => void): () => void
    clock?(duration: number): PlaybackClock
  }
  slowdown: number
  active?(): boolean
  cancelled?(): boolean
}
export interface PreparedStep {
  step: () => Animation
  position: Position
}

/** Platform adapters resolve targets/initial values; scheduling semantics live here. */
export function composePrepared(
  prepared: readonly PreparedStep[],
  controlled: boolean,
  host: SequenceHost,
): Animation {
  const { driver, slowdown } = host
  // Absolute positions share the platform clock, including Android duration scale.
  const clock =
    controlled || prepared.some(({ position }) => typeof position === 'number')
      ? (driver.clock?.(Infinity) ?? createClock(() => driver.now()))
      : undefined
  const started: Animation[] = []
  const cancellations = new Set<() => void>()
  let stopped = false
  let paused = false
  let settled = false
  let completed = false
  let changed = () => {}
  const resumeChildren = new Set<PlayableAnimation>()
  const waits = new Set<{ at: number; fire(): void; cancel(): void; schedule(): void }>()
  const time = () => clock?.time() ?? 0
  let resolveScheduled!: () => void
  let rejectScheduled!: (reason: unknown) => void
  const scheduled = new Promise<void>((resolve, reject) => {
    resolveScheduled = resolve
    rejectScheduled = reject
  })
  let pending = prepared.length
  const states = prepared.map(({ step, position }) => {
    return {
      step,
      position,
      onStart: new Set<() => void>(),
      animation: undefined as Animation | undefined,
      start: undefined as number | undefined,
    }
  })
  const cancelSchedule = () => {
    for (const cancel of cancellations) cancel()
    cancellations.clear()
    for (const wait of waits) wait.cancel()
    waits.clear()
    if (!controlled || stopped || settled) clock?.cancel()
  }
  const fail = (error: unknown) => {
    if (stopped) return
    stopped = true
    settled = true
    cancelSchedule()
    states.forEach((state) => state.onStart.clear())
    started.forEach((child) => child.stop())
    changed()
    rejectScheduled(error)
  }
  const stop = () => {
    if (stopped) return
    stopped = true
    settled = true
    cancelSchedule()
    states.forEach((state) => state.onStart.clear())
    resolveScheduled()
    started.forEach((animation) => animation.stop())
    resumeChildren.clear()
    changed()
  }
  const launch = (index: number) => {
    const state = states[index]!
    if (host.cancelled?.()) stop()
    if (stopped || state.animation) return
    if (host.active && !host.active()) {
      let off = () => {}
      off = driver.after(0, () => {
        cancellations.delete(off)
        launch(index)
      })
      cancellations.add(off)
      return
    }
    if (paused) {
      wait(0, () => launch(index))
      return
    }
    try {
      const step = state.step
      const child = step()
      if (controlled && !isPlayable(child)) {
        child?.stop?.()
        throw new TypeError(
          'A timeline participant must expose pause(), play() and paused; use sequence() for non-playable effects.',
        )
      }
      if (host.cancelled?.()) {
        child.stop()
        stop()
        return
      }
      state.animation = child
      state.start = time()
      if (controlled) {
        try {
          const playback = playbackSource(child).read()
          if (playback.ready) state.start = Math.max(0, time() - playback.time)
        } catch {
          /* A custom playable participant can omit a clock. */
        }
      }
      started.push(child)
      // Observe setup failures immediately, even while other steps are still
      // scheduled. Nested sequences can reject before this one reaches arrival.
      void child.finished.catch(fail)
      pending--
      for (const callback of [...state.onStart]) callback()
      state.onStart.clear()
      if (pending === 0) {
        cancelSchedule()
        resolveScheduled()
      }
      changed()
    } catch (error) {
      fail(error)
    }
  }
  const wait = (ms: number, callback: () => void) => {
    if (stopped) return
    if (!controlled) {
      if (ms <= 0) {
        callback()
        return
      }
      let cancel = () => {}
      let fired = false
      const off = driver.after(ms, () => {
        fired = true
        cancellations.delete(cancel)
        if (!stopped) callback()
      })
      cancel = off
      if (!fired) cancellations.add(cancel)
      return
    }
    let off = () => {}
    const waiting = {
      at: time() + Math.max(0, ms),
      fire() {
        off()
        waits.delete(waiting)
        if (!stopped) callback()
      },
      cancel() {
        off()
        off = () => {}
      },
      schedule() {
        waiting.cancel()
        if (paused || stopped) return
        const remaining = waiting.at - time()
        if (remaining <= 0) waiting.fire()
        else off = driver.after(remaining, waiting.fire)
      },
    }
    waits.add(waiting)
    waiting.schedule()
  }

  for (let index = 0; index < states.length; index++) {
    const { position } = states[index]!
    const begin = () => launch(index)
    if (typeof position === 'number') wait(position * slowdown - clock!.time(), begin)
    else if (index === 0)
      wait(
        typeof position === 'object' ? Math.max(0, position.offset) * slowdown : 0,
        begin,
      )
    else {
      const previous = states[index - 1]!
      const follow = () => {
        if (stopped || !previous.animation) return
        if (position === '<') {
          begin()
          return
        }
        const offset = (position?.offset ?? 0) * slowdown
        if (offset < 0) {
          const timing = arrivalTimingOf(previous.animation)
          if (!timing) {
            fail(
              new TypeError(
                'A negative at offset needs an animate() or decay() arrival forecast.',
              ),
            )
            return
          }
          let off = () => {}
          let cancelTimer = () => {}
          let fired = false
          let disposed = false
          let queued = false
          const dispose = () => {
            disposed = true
            off()
            cancelTimer()
            cancellations.delete(dispose)
          }
          const update = () => {
            cancelTimer()
            if (stopped || fired || disposed) return
            const state = timing.read()
            if (!state.arrived && (state.paused || state.remaining === undefined)) return
            const remaining = state.arrived ? 0 : state.remaining! + offset
            if (!Number.isFinite(remaining)) return
            const fire = () => {
              if (stopped || fired || disposed) return
              fired = true
              dispose()
              begin()
            }
            if (remaining <= 0) fire()
            else {
              const cancel = driver.after(remaining, fire)
              if (disposed) cancel()
              else cancelTimer = cancel
            }
          }
          off = timing.subscribe(() => {
            cancelTimer()
            // An interruption can notify from inside another animation's
            // constructor. Start followers after its ownership changes finish.
            if (queued || disposed) return
            queued = true
            void Promise.resolve().then(() => {
              queued = false
              update()
            })
          })
          cancellations.add(dispose)
          update()
        } else void arrivalOf(previous.animation).then(() => wait(offset, begin), fail)
      }
      if (previous.animation) follow()
      else previous.onStart.add(follow)
    }
  }
  if (pending === 0) resolveScheduled()

  const arrived = scheduled.then(() => Promise.all(started.map(arrivalOf)))
  const finished = arrived.then(async () => {
    const results = await Promise.all(started.map((animation) => animation.finished))
    completed = !stopped && results.length === prepared.length && results.every(Boolean)
    settled = true
    clock?.cancel()
    changed()
    return completed
  })

  const animation: Animation = {
    finished,
    stop,
    then: (onfulfilled, onrejected) => finished.then(onfulfilled, onrejected),
  }
  if (controlled) {
    const duration = () => {
      if (pending) return undefined
      let total = 0
      for (const state of states) {
        const child = state.animation as PlayableAnimation | undefined
        if (!child || child.duration === undefined) return undefined
        try {
          if (!playbackSource(child).read().ready) return undefined
        } catch {
          /* custom playable */
        }
        total = Math.max(total, (state.start ?? 0) + child.duration)
      }
      return total
    }
    Object.defineProperties(animation, {
      paused: { get: () => paused },
      duration: { get: duration },
    })
    Object.assign(animation, {
      pause() {
        if (paused || settled) return
        paused = true
        clock?.pause()
        for (const wait of waits) wait.cancel()
        for (const child of started as PlayableAnimation[]) {
          if (!child.paused) {
            resumeChildren.add(child)
            child.pause()
          }
        }
        changed()
      },
      play() {
        if (!paused || settled) return
        paused = false
        clock?.play()
        for (const child of resumeChildren) child.play()
        resumeChildren.clear()
        for (const wait of [...waits]) wait.schedule()
        changed()
      },
    })
    changed = registerPlayback(animation, () => ({
      time: time(),
      duration: duration() ?? Infinity,
      paused,
      ready: duration() !== undefined,
      settled,
      completed,
    }))
  }
  setArrival(animation, arrived)
  return animation
}

export type Position = number | '<' | { offset: number } | undefined
export function parsePosition(at: SequencePosition | undefined): Position {
  if (at === undefined || at === '<') return at
  if (typeof at === 'number' && Number.isFinite(at) && at >= 0) return at
  if (
    typeof at === 'string' &&
    /^[+-](?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(at) &&
    Number.isFinite(Number(at))
  )
    return { offset: Number(at) }
  throw new RangeError(
    'Sequence at must be a nonnegative finite time, "<", or a signed finite offset.',
  )
}

function isPlayable(animation: Animation): animation is PlayableAnimation {
  const handle = animation as PlayableAnimation | undefined
  return (
    !!handle &&
    typeof handle.pause === 'function' &&
    typeof handle.play === 'function' &&
    typeof handle.paused === 'boolean' &&
    typeof handle.stop === 'function' &&
    typeof handle.finished?.then === 'function' &&
    typeof handle.finished?.catch === 'function' &&
    (handle.duration === undefined ||
      (typeof handle.duration === 'number' && handle.duration >= 0))
  )
}
