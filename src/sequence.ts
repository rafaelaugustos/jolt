import { timeScale } from './config.js'
import { getDriver } from './driver/index.js'
import { isDecorationProperty, validateDecorationTarget } from './decoration.js'
import type { View } from '@nativescript/core'
import { animate, startingValues, toViews } from './animate.js'
import {
  arrivalOf,
  arrivalTimingOf,
  setArrival,
  stopView,
  type Animation,
} from './engine.js'
import { createClock, registerPlayback, playbackSource } from './playback.js'
import {
  isMotionValue,
  type MotionValue,
  type ValueAnimationOptions,
} from './motion-value.js'
import type { PresetName } from './presets.js'
import { writeValue, type Property } from './properties.js'
import type { SpringName } from './transition.js'
import type { AnimateOptions, Keyframes, Target } from './types.js'

/** Absolute milliseconds, a signed offset from the previous arrival, or its start. */
export type SequencePosition = number | '<' | `${'+' | '-'}${number}`
export type SequenceOptions = AnimateOptions & { at?: SequencePosition }

export type Step =
  | readonly [
      target: Target | readonly Target[],
      animation: Keyframes | PresetName,
      options?: SequenceOptions | SpringName,
    ]
  | (() => Animation)

/** A participant that can genuinely freeze and continue, rather than restart. */
export interface PlayableAnimation extends Animation {
  pause(): void
  play(): void
  readonly paused: boolean
  readonly duration?: number
}

export type TimelineStep =
  | Exclude<Step, () => Animation>
  | readonly [
      MotionValue,
      number | readonly (number | null)[],
      ((ValueAnimationOptions & { at?: SequencePosition }) | SpringName)?,
    ]
  | { readonly at?: SequencePosition; readonly run: () => PlayableAnimation }
  | (() => PlayableAnimation)

export interface TimelineAnimation extends PlayableAnimation {
  /** Unknown until every step has activated and every participant reports a duration. */
  readonly duration: number | undefined
}

/** Overlapping steps with a shared pause/resume control, including pending launches. */
export function timeline(steps: readonly TimelineStep[]): TimelineAnimation {
  return compose(steps, true) as TimelineAnimation
}

/**
 * By default a step starts once the previous one looks done. `at` can overlap
 * that arrival, share the previous start, or select an absolute timeline time.
 * Views in later steps take their first absolute keyframe right away, so a title
 * that fades in third doesn't show up before its turn. Relative and null keyframes
 * read the current value when their step starts.
 *
 * ```ts
 * await sequence([
 *   [logo, 'popIn'],
 *   [title, 'fadeInUp', { at: '-150' }],
 *   [buttons, 'fadeInUp', { stagger: 50, at: '<' }],
 * ])
 * ```
 */
export function sequence(steps: readonly Step[]): Animation {
  return compose(steps, false)
}

function compose(
  steps: readonly TimelineStep[] | readonly Step[],
  controlled: boolean,
): Animation {
  const prepared = steps.map((step) => {
    if (typeof step === 'function') return { step, position: undefined }
    if (!Array.isArray(step)) {
      const descriptor = step as { at?: SequencePosition; run: () => PlayableAnimation }
      if (typeof descriptor.run !== 'function')
        throw new TypeError('A timeline step needs a run() factory.')
      return { step: descriptor.run, position: parsePosition(descriptor.at) }
    }
    const [target, animation, options] = step as Exclude<
      TimelineStep,
      Function | { run: () => PlayableAnimation }
    >
    if (typeof options !== 'object' || options === null)
      return { step, position: undefined }
    const { at, ...transition } = options
    const position = parsePosition(at)
    return { step: [target, animation, transition] as Step, position }
  })
  applyStartingValues(
    prepared
      .map(({ step }) => step as Step)
      .filter((step) => typeof step === 'function' || !isMotionValue(step[0])),
  )

  const driver = getDriver()
  const slowdown = 1 / timeScale()
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
  const launch = (index: number) => {
    const state = states[index]!
    if (stopped || state.animation) return
    if (paused) {
      wait(0, () => launch(index))
      return
    }
    try {
      const step = state.step
      const child =
        typeof step === 'function'
          ? step()
          : (animate as (...args: any[]) => Animation)(...(step as any[]))
      if (controlled && !isPlayable(child)) {
        child?.stop?.()
        throw new TypeError(
          'A timeline participant must expose pause(), play() and paused; use sequence() for non-playable effects.',
        )
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
    completed = !stopped && results.length === steps.length && results.every(Boolean)
    settled = true
    clock?.cancel()
    changed()
    return completed
  })

  const animation: Animation = {
    finished,
    stop() {
      if (stopped) return
      stopped = true
      settled = true
      cancelSchedule()
      states.forEach((state) => state.onStart.clear())
      resolveScheduled()
      started.forEach((animation) => animation.stop())
      resumeChildren.clear()
      changed()
    },
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

type Position = number | '<' | { offset: number } | undefined
function parsePosition(at: SequencePosition | undefined): Position {
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

function applyStartingValues(steps: readonly Step[]) {
  const claimed = new Map<View, Set<Property>>()
  for (const step of steps) {
    if (typeof step === 'function') continue
    const [target, animation, options] = step
    const starts = startingValues(animation, options)

    for (const view of toViews(target)) {
      for (const property of starts.keys())
        if (isDecorationProperty(property)) validateDecorationTarget(view, property)
      let properties = claimed.get(view)
      if (!properties) claimed.set(view, (properties = new Set()))

      const fresh = [...starts].filter(
        ([property, value]) => !properties.has(property) && value !== null,
      )
      stopView(
        view,
        fresh.map(([property]) => property),
      )
      for (const [property, value] of fresh) {
        if (value !== null) writeValue(view, property, value)
      }
      getDriver().sync?.(view)
      for (const property of starts.keys()) properties.add(property)
    }
  }
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
