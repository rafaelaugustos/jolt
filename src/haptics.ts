import { isAndroid, isIOS, type View } from '@nativescript/core'
import type { Driver } from './driver/index.js'
import type { Track } from './track.js'

export type HapticStyle = 'light' | 'medium' | 'heavy'

export interface HapticOptions {
  style: HapticStyle
  /** Points from 0 to 1 over the finite animation, excluding its initial delay. Defaults to arrival. */
  times?: readonly number[]
}

export type Haptic = HapticStyle | HapticOptions | false

/** Validate before any running animation is interrupted. */
export function resolveHaptic(haptic: Haptic | undefined): HapticOptions | undefined {
  if (haptic === undefined || haptic === false) return undefined
  const options = typeof haptic === 'string' ? { style: haptic } : haptic
  if (!options || !['light', 'medium', 'heavy'].includes(options.style))
    throw new TypeError('Haptic style must be light, medium or heavy.')
  const times = options.times
  if (
    times !== undefined &&
    (!Array.isArray(times) ||
      times.length === 0 ||
      Array.from(times).some(
        (time, i) =>
          !Number.isFinite(time) ||
          time <= 0 ||
          time > 1 ||
          (i > 0 && time <= times[i - 1]!),
      ))
  )
    throw new RangeError(
      'Haptic times must be increasing points greater than 0 and at most 1.',
    )
  return { style: options.style, times: times && [...times] }
}

const PREPARE_AHEAD = 100
const MAX_LATENESS = 100

interface Feedback {
  active(): boolean
  enabled(): boolean
  prepare?(): void
  fire(): void
}

function feedbackFor(
  view: View,
  style: HapticStyle,
  driver: Driver,
): Feedback | undefined {
  if (isAndroid) {
    if (typeof android === 'undefined' || driver.reducedMotion?.()) return
    const native = view.nativeViewProtected as android.view.View | undefined
    if (!native) return
    const sdk = android.os.Build.VERSION.SDK_INT
    const constants = android.view.HapticFeedbackConstants
    const effect =
      style === 'heavy'
        ? constants.LONG_PRESS
        : style === 'medium' && sdk >= 23
          ? constants.CONTEXT_CLICK
          : style === 'light' && sdk >= 21
            ? constants.CLOCK_TICK
            : constants.KEYBOARD_TAP
    return {
      // Animator scale zero must also silence opacity/color feedback when
      // configure({ reducedMotion: 'never' }) keeps a logical track alive.
      enabled: () => !driver.reducedMotion?.(),
      active: () =>
        view.isLoaded &&
        view.nativeViewProtected === native &&
        !!native.getWindowToken() &&
        native.getWindowVisibility() === 0 &&
        native.isShown() &&
        native.hasWindowFocus(),
      // No ignore-setting flags, forced vibration or permission. A false result
      // means the system declined this request; do not retry with a stronger effect.
      fire: () => {
        native.performHapticFeedback(effect)
      },
    }
  }
  if (!isIOS || typeof UIImpactFeedbackGenerator === 'undefined') return
  const styles = { light: 0, medium: 1, heavy: 2 } satisfies Record<
    HapticStyle,
    UIImpactFeedbackStyle
  >
  const generator = UIImpactFeedbackGenerator.alloc().initWithStyle(styles[style])
  const native = view.nativeViewProtected as UIView
  return {
    enabled: () => true,
    active: () =>
      view.isLoaded &&
      view.nativeViewProtected === native &&
      !!native.window &&
      UIApplication.sharedApplication.applicationState === 0,
    prepare: () => generator.prepare(),
    fire: () => generator.impactOccurred(),
  }
}

/** Discrete feedback only: animation playback remains entirely native. */
export function playHaptics(
  view: View,
  tracks: readonly Track[],
  options: HapticOptions | undefined,
  driver: Driver,
  startedAt: number,
  elapsedTime = () => driver.now() - startedAt,
) {
  if (!options) return
  const moving = tracks.filter(
    (track) =>
      track.duration > 0 && track.values.some((value) => value !== track.values[0]),
  )
  if (!moving.length) return
  const end = Math.max(...tracks.map((track) => track.end))
  if (!Number.isFinite(end)) return
  const delay = Math.min(...moving.map((track) => track.delay))
  const offsets = options.times
    ? options.times.map((time) => delay + (end - delay) * time)
    : [Math.max(...tracks.map((track) => track.arrival))]
  let feedback = feedbackFor(view, options.style, driver)
  if (!feedback) return
  let paused = false
  let next = 0
  let cancelPrepare: (() => void) | undefined
  let cancelImpact: (() => void) | undefined

  const cancelTimers = () => {
    cancelPrepare?.()
    cancelImpact?.()
    cancelPrepare = cancelImpact = undefined
  }
  const cancel = () => {
    cancelPrepare?.()
    cancelImpact?.()
    cancelPrepare = cancelImpact = undefined
    feedback = undefined
    view.off('unloaded', cancel)
  }

  const fire = (elapsed = elapsedTime()) => {
    // A busy UI thread can delay timers. Drop stale impacts instead of replaying
    // several old taps at once when it becomes responsive again.
    while (next < offsets.length && offsets[next]! <= elapsed) {
      const offset = offsets[next++]!
      if (feedback?.enabled() && feedback.active() && elapsed - offset <= MAX_LATENESS)
        feedback.fire()
    }
  }

  const schedule = () => {
    if (paused) return
    if (!feedback?.enabled() || next === offsets.length) return cancel()
    if (isAndroid) {
      // Start pending markers together with the visual animators. Chaining a
      // new ValueAnimator from each impact adds another first-frame startup
      // delay, which can wrongly make subsequent points stale at fast scales.
      const markers = new Set<() => void>()
      cancelImpact = () => {
        for (const release of markers) release()
        markers.clear()
      }
      const arm = (index: number) => {
        if (!feedback?.enabled()) return cancel()
        // Native durations are integer milliseconds; zero completes synchronously.
        const remaining = Math.max(1, offsets[index]! - elapsedTime())
        const release = driver.after(remaining, () => {
          markers.delete(release)
          if (!feedback || paused) return
          if (!feedback.enabled()) return cancel()
          fire()
          if (next === offsets.length) cancel()
          else if (next <= index) arm(index)
        })
        markers.add(release)
      }
      for (let index = next; index < offsets.length; index++) arm(index)
      return
    }
    const remaining = offsets[next]! - elapsedTime()
    if (feedback.active()) feedback.prepare?.()
    if (feedback.prepare && remaining > PREPARE_AHEAD) {
      cancelPrepare = driver.after(remaining - PREPARE_AHEAD, () => {
        if (feedback?.active()) feedback.prepare?.()
      })
    }
    cancelImpact = driver.after(Math.max(0, remaining), () => {
      fire()
      schedule()
    })
  }

  view.on('unloaded', cancel)
  schedule()
  return {
    cancel,
    pause() {
      paused = true
      cancelTimers()
    },
    play() {
      if (paused) {
        paused = false
        schedule()
      }
    },
    seek() {
      cancelTimers()
      while (next < offsets.length && offsets[next]! <= elapsedTime()) next++
      schedule()
    },
    finish() {
      // Native completion proves that the final frame was reached, even when
      // a scaled/resumed clock sample is one frame behind. Earlier impacts are
      // still judged against the end position, so stale points are not replayed.
      fire(Math.max(end, elapsedTime()))
      cancel()
    },
  }
}
