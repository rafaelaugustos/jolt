import { isIOS, type View } from '@nativescript/core'
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
const COMPLETION_TOLERANCE = 20

/** Discrete feedback only: animation playback remains entirely native. */
export function playHaptics(
  view: View,
  tracks: readonly Track[],
  options: HapticOptions | undefined,
  driver: Driver,
  startedAt: number,
) {
  if (!isIOS || !options || typeof UIImpactFeedbackGenerator === 'undefined') return
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
  const styles = {
    light: 0,
    medium: 1,
    heavy: 2,
  } satisfies Record<HapticStyle, UIImpactFeedbackStyle>
  let generator: UIImpactFeedbackGenerator | undefined =
    UIImpactFeedbackGenerator.alloc().initWithStyle(styles[options.style])
  const native = view.nativeViewProtected as UIView
  let next = 0
  let cancelPrepare: (() => void) | undefined
  let cancelImpact: (() => void) | undefined

  const active = () =>
    view.isLoaded &&
    view.nativeViewProtected === native &&
    !!native.window &&
    UIApplication.sharedApplication.applicationState === 0 // UIApplicationState.Active

  const cancel = () => {
    cancelPrepare?.()
    cancelImpact?.()
    cancelPrepare = cancelImpact = undefined
    generator = undefined
    view.off('unloaded', cancel)
  }

  const fire = (tolerance = 0) => {
    const elapsed = driver.now() - startedAt
    // A busy UI thread can delay timers. Drop stale impacts instead of replaying
    // several old taps at once when it becomes responsive again.
    while (next < offsets.length && offsets[next]! <= elapsed + tolerance) {
      const offset = offsets[next++]!
      if (active() && elapsed - offset <= MAX_LATENESS) generator?.impactOccurred()
    }
  }

  const schedule = () => {
    if (!generator || next === offsets.length) return cancel()
    const remaining = startedAt + offsets[next]! - driver.now()
    if (active()) generator.prepare()
    if (remaining > PREPARE_AHEAD) {
      cancelPrepare = driver.after(remaining - PREPARE_AHEAD, () => {
        if (active()) generator?.prepare()
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
    finish() {
      // Native completion may beat the timer at the final keyframe by a frame.
      fire(COMPLETION_TOLERANCE)
      cancel()
    },
  }
}
