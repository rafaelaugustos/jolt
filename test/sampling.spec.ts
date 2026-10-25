import { describe, it, expect } from 'vitest'
import { createTrack } from '../src/track.js'
import { precision } from '../src/properties.js'
import { resolveTransition } from '../src/transition.js'
import { solveSpring, springPhysics } from '../src/spring.js'
import { solveDecay } from '../src/decay.js'
import { sampleCurve } from '../src/sampling.js'
import { samplingCases } from '../benchmarks/curve-sampling-cases.js'
import { maximumSampleError, sampledPosition } from './sampling-helpers.js'
import baseline from './fixtures/sampling-timing.json'
import './helpers.js'

describe('adaptive native keyframes', () => {
  for (const c of samplingCases)
    it(c.name, () => {
      const track = createTrack(
        c.property,
        c.frames,
        resolveTransition(c.transition, c.property, c.frames.length),
        c.velocity ?? 0,
      )
      const previous = baseline.find((b) => b.name === c.name)!
      expect(track.duration).toBe(previous.durationMs)
      expect(track.arrival).toBe(previous.arrivalMs)
      expect(track.velocityAt(0)).toBe(previous.initialVelocity)
      expect(maximumSampleError(track)).toBeLessThanOrEqual(precision[c.property] + 1e-8)
      expect(track.times[0]).toBe(0)
      expect(track.times.at(-1)).toBe(1)
      expect(track.values[0]).toBe(c.frames[0])
      expect(track.values.at(-1)).toBe(c.frames.at(-1))
      for (let i = 1; i < track.times.length; i++)
        expect(track.times[i]).toBeGreaterThan(track.times[i - 1]!)
    })
  it('includes property clamp seams in the interpolation error budget', () => {
    for (const [property, frames] of [
      ['shadowOpacity', [0, 1]],
      ['borderRadius', [20, 0]],
    ] as const) {
      const track = createTrack(
        property,
        frames,
        resolveTransition({ type: 'spring', duration: 200, bounce: 0.7 }, property, 2),
        0,
      )
      expect(maximumSampleError(track)).toBeLessThanOrEqual(precision[property] + 1e-8)
      expect(track.sampling?.bounded).toBe(true)
    }
  })
  it('does not miss a full spring oscillation between midpoint probes', () => {
    const motion = solveSpring(
      springPhysics({ stiffness: 10000, damping: 4, mass: 1 }),
      0,
      300,
      0,
      0.25,
    )
    const curve = sampleCurve({
      duration: motion.duration,
      position: motion.position,
      tolerance: 0.25,
      errorBound: motion.interpolationError,
    })
    expect(curve.sampling.bounded).toBe(true)
    let max = 0
    for (let t = 0; t < motion.duration; t += 0.05)
      max = Math.max(
        max,
        Math.abs(
          sampledPosition({ ...curve, duration: motion.duration }, t) -
            motion.position(t),
        ),
      )
    expect(max).toBeLessThanOrEqual(0.25)
  })
  it('bounds an exponential decay including its final settlement snap', () => {
    const motion = solveDecay(30, 5000, 0.998, 0.25)
    const curve = sampleCurve({
      duration: motion.duration,
      position: motion.position,
      tolerance: 0.25,
      errorBound: motion.interpolationError,
    })
    expect(curve.sampling.bounded).toBe(true)
    for (let t = 0; t < motion.duration; t += 0.5)
      expect(
        Math.abs(
          sampledPosition({ ...curve, duration: motion.duration }, t) -
            motion.position(t),
        ),
      ).toBeLessThanOrEqual(0.25)
  })
  it('keeps narrow authored knots after whole-track easing', () => {
    const t = createTrack(
      'x',
      [0, 0, 100, 0, 0],
      resolveTransition(
        {
          duration: 1000,
          ease: 'quadIn',
          easeTrack: true,
          times: [0, 0.5, 0.5001, 0.5002, 1],
        },
        'x',
        5,
      ),
      0,
    )
    for (const progress of [
      0.5, 0.500025, 0.50005, 0.500075, 0.5001, 0.500125, 0.50015, 0.500175, 0.5002,
    ]) {
      const time = Math.sqrt(progress) * 1000
      expect(Math.abs(sampledPosition(t, time) - t.valueAt(time))).toBeLessThan(0.25)
    }
  })
  it('keeps unknown functions conservative without claiming a mathematical guarantee', () => {
    const curve = sampleCurve({
      duration: 1000,
      position: (t) => t,
      tolerance: 0.25,
      custom: true,
    })
    expect(curve.sampling.bounded).toBe(false)
    expect(curve.times.length).toBeGreaterThanOrEqual(121)
    // A narrow arbitrary pulse can still lie between every finite probe.
    const hidden = sampleCurve({
      duration: 1000,
      position: (t) => (t > 1.001 && t < 1.002 ? 100 : 0),
      tolerance: 0.25,
      custom: true,
    })
    expect(hidden.sampling.bounded).toBe(false)
  })
  it('caps work and falls back explicitly without losing mandatory times or endpoints', () => {
    const curve = sampleCurve({
      duration: 1000,
      position: (t) => (t === 1000 ? 1 : Math.sin(t) * 100),
      tolerance: 1e-12,
      errorBound: () => 1,
      breakpoints: [123.456],
    })
    expect(curve.sampling.method).toBe('uniform-fallback')
    expect(curve.sampling.bounded).toBe(false)
    expect(curve.sampling.evaluations).toBeLessThanOrEqual(30010)
    expect(curve.times).toContain(0.123456)
    expect(curve.values.at(-1)).toBe(1)
    expect(curve.times.length).toBeLessThanOrEqual(6002)
  })
})
