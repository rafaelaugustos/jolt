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
