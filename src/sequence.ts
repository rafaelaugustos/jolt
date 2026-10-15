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
import { createClock } from './playback.js'
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
  const prepared = steps.map((step) => {
    if (typeof step === 'function') return { step, position: undefined }
    const [target, animation, options] = step
    if (typeof options !== 'object' || options === null)
      return { step, position: undefined }
    const { at, ...transition } = options
    const position = parsePosition(at)
    return { step: [target, animation, transition] as Step, position }
  })
  applyStartingValues(prepared.map(({ step }) => step))

  const driver = getDriver()
  // Absolute positions share the platform clock, including Android duration scale.
  const clock = prepared.some(({ position }) => typeof position === 'number')
    ? (driver.clock?.(Infinity) ?? createClock(() => driver.now()))
    : undefined
  const started: Animation[] = []
  const cancellations = new Set<() => void>()
  let stopped = false
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
    }
  })
  const cancelSchedule = () => {
    for (const cancel of cancellations) cancel()
    cancellations.clear()
    clock?.cancel()
  }
  const fail = (error: unknown) => {
    if (stopped) return
    stopped = true
    cancelSchedule()
    states.forEach((state) => state.onStart.clear())
    started.forEach((child) => child.stop())
    rejectScheduled(error)
  }
  const launch = (index: number) => {
    const state = states[index]!
    if (stopped || state.animation) return
    try {
      const step = state.step
      const child = typeof step === 'function' ? step() : animate(...step)
      state.animation = child
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
    } catch (error) {
      fail(error)
    }
  }
  const wait = (ms: number, callback: () => void) => {
    if (stopped) return
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
  }

  for (let index = 0; index < states.length; index++) {
    const { position } = states[index]!
    const begin = () => launch(index)
    if (typeof position === 'number') wait(position - clock!.time(), begin)
    else if (index === 0)
      wait(typeof position === 'object' ? Math.max(0, position.offset) : 0, begin)
    else {
      const previous = states[index - 1]!
      const follow = () => {
        if (stopped || !previous.animation) return
        if (position === '<') {
          begin()
          return
        }
        const offset = position?.offset ?? 0
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
    return !stopped && results.length === steps.length && results.every(Boolean)
  })

  const animation: Animation = {
    finished,
    stop() {
      if (stopped) return
      stopped = true
      cancelSchedule()
      states.forEach((state) => state.onStart.clear())
      resolveScheduled()
      started.forEach((animation) => animation.stop())
    },
    then: (onfulfilled, onrejected) => finished.then(onfulfilled, onrejected),
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
