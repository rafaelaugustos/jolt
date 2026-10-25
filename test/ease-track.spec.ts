import { maximumSampleError } from './sampling-helpers.js'
import { describe, expect, it } from 'vitest'
import { animate } from '../src/index.js'
import { resolveEasing, type EasingFunction } from '../src/easing.js'
import { createTrack } from '../src/track.js'
import { resolveTransition, type Transition } from '../src/transition.js'
import { createView, driver } from './helpers.js'

function track(keyframes: number[], transition: Transition) {
  return createTrack(
    'y',
    keyframes,
    resolveTransition(transition, 'y', keyframes.length),
    0,
  )
}

/** React Native's interpolate with `extrapolate: 'extend'`, fed by one easing over the timeline. */
function interpolate(
  progress: number,
  input: readonly number[],
  output: readonly number[],
  easing: EasingFunction,
) {
  const p = easing(progress)
  let i = 0
  while (i < input.length - 2 && p > input[i + 1]!) i++
  const t = (p - input[i]!) / (input[i + 1]! - input[i]!)
  return output[i]! + (output[i + 1]! - output[i]!) * t
}

describe('easeTrack', () => {
  const keyframes = [0, -30, -12, 0]
  const times = [0, 0.4, 0.7, 1]

  it('matches interpolate over the whole timeline', () => {
    for (const name of ['easeOut', 'easeInOut', 'circIn'] as const) {
      const result = track(keyframes, {
        duration: 900,
        ease: name,
        times,
        easeTrack: true,
      })
      const easing = resolveEasing(name)
      for (const time of [0, 90, 225, 360, 450, 630, 810, 900])
        expect(result.valueAt(time)).toBeCloseTo(
          interpolate(time / 900, times, keyframes, easing),
          6,
        )
    }
  })

  it('places keyframes on the curve rather than easing each segment', () => {
    const square = (p: number) => p * p
    const whole = track(keyframes, {
      duration: 1000,
      ease: square,
      times,
      easeTrack: true,
    })
    const each = track(keyframes, { duration: 1000, ease: square, times })

    expect(whole.valueAt(500)).toBeCloseTo(-18.75)
    expect(each.valueAt(400)).toBe(-30)
    expect(whole.valueAt(400)).not.toBeCloseTo(-30)
    expect(whole.to).toBe(0)
  })

  it('samples within the error budget with exact ends for native playback', () => {
    const result = track(keyframes, {
      duration: 900,
      ease: 'easeOut',
      times,
      easeTrack: true,
    })

    expect(result.times[0]).toBe(0)
    expect(result.times.at(-1)).toBe(1)
    expect(result.values[0]).toBe(0)
    expect(result.values.at(-1)).toBe(0)
    expect(maximumSampleError(result)).toBeLessThanOrEqual(0.25)
    for (let i = 1; i < result.times.length; i++)
      expect(result.times[i]).toBeGreaterThan(result.times[i - 1]!)
  })

  it('extends the end segments when the easing overshoots, like a two-keyframe tween', () => {
    const overshoot = track([0, 100], { duration: 400, ease: 'backOut', easeTrack: true })
    const plain = track([0, 100], { duration: 400, ease: 'backOut' })
    for (const time of [100, 200, 300])
      expect(overshoot.valueAt(time)).toBeCloseTo(plain.valueAt(time))
    expect(Math.max(...overshoot.values)).toBeGreaterThan(100)
  })

  it('is the same as per-segment linear keyframes with a linear ease', () => {
    const whole = track(keyframes, {
      duration: 900,
      ease: 'linear',
      times,
      easeTrack: true,
    })
    const each = track(keyframes, { duration: 900, ease: 'linear', times })
    expect(whole.values).toEqual(each.values)
    expect(whole.times).toEqual(each.times)
  })

  it('rejects a list of easings and springs', () => {
    expect(() =>
      track(keyframes, {
        duration: 900,
        ease: ['easeIn', 'easeOut', 'linear'],
        easeTrack: true,
      }),
    ).toThrow(/single ease/)
    expect(() => track([0, 10], { type: 'spring', easeTrack: true } as never)).toThrow(
      /tweens, not springs/,
    )
  })

  it('works with colors and leaves a spring override on another property alone', () => {
    const view = createView()
    animate(
      view,
      { backgroundColor: ['#000000', '#ff0000', '#ffffff'], y: [0, -20, 0], scale: 1.2 },
      { duration: 600, ease: 'easeIn', easeTrack: true, scale: 'bouncy' },
    )

    const color = driver.last('backgroundColor').track
    expect(color.to).toBe(0xffffffff)
    expect(color.valueAt(300)).not.toBe(0xffff0000)
    expect(driver.last('y').track.valueAt(300)).toBeCloseTo(
      interpolate(0.5, [0, 0.5, 1], [0, -20, 0], resolveEasing('easeIn')),
    )
    expect(driver.last('scaleX').track.to).toBe(1.2)
  })
})
