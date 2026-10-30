import { isIOS, type View } from '@nativescript/core'

/** Compare actual Android interpolation, including uneven offsets and float rounding. */
export function runAndroidKeyframeChecks(view: View) {
  if (isIOS) return { platform: 'ios', skipped: 'Android factory' }
  const factory = org.rafaelaugusto.jolt.KeyframeFactory
  if (typeof factory !== 'function') throw new Error('Missing native KeyframeFactory')
  const native = view.android as android.view.View
  const properties = [
    android.view.View.TRANSLATION_X,
    android.view.View.TRANSLATION_Y,
    android.view.View.SCALE_X,
    android.view.View.SCALE_Y,
    android.view.View.ROTATION,
    android.view.View.ROTATION_X,
    android.view.View.ROTATION_Y,
    android.view.View.ALPHA,
  ]
  const times = [0, 0.13, 0.43, 1]
  const values = [0.125, 1.23456789, -0.25, 0.75]
  const samples: object[] = []
  for (const property of properties) {
    const original = property.get(native)
    try {
      for (const unit of [1, 2.625, 3]) {
        const frames = Array.create(android.animation.Keyframe, times.length)
        values.forEach(
          (v, i) => (frames[i] = android.animation.Keyframe.ofFloat(times[i]!, v * unit)),
        )
        const holders = Array.create(android.animation.PropertyValuesHolder, 1)
        holders[0] = android.animation.PropertyValuesHolder.ofKeyframe(property, frames)
        const legacy = android.animation.ObjectAnimator.ofPropertyValuesHolder(
          native,
          holders,
        )
        const bulk = factory.create(native, property, times, values, unit)
        for (const a of [legacy, bulk]) {
          a.setDuration(1000)
          a.setInterpolator(new android.view.animation.LinearInterpolator())
        }
        for (const time of [0, 79, 130, 250, 430, 700, 1000, 250]) {
          legacy.setCurrentPlayTime(time)
          const expected = Number(property.get(native))
          bulk.setCurrentPlayTime(time)
          const actual = Number(property.get(native))
          if (!Number.isFinite(actual) || actual !== expected)
            throw new Error(`${property.getName()} at ${time}: ${actual} != ${expected}`)
          samples.push({ property: property.getName(), unit, time, actual, expected })
        }
        legacy.cancel()
        bulk.cancel()
      }
    } finally {
      property.set(native, original)
    }
  }
  let rejected = false
  try {
    factory.create(native, properties[0]!, [0], [0, 1], 1)
  } catch {
    rejected = true
  }
  if (!rejected) throw new Error('Factory accepted mismatched arrays')
  return { platform: 'android', samples, rejectedMismatchedArrays: rejected }
}
