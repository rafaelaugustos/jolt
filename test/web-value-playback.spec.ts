import { it, expect } from 'vitest'
import { valueTrack } from '../src/web/value-playback.js'
import { solveSpring, springPhysics } from '../src/core/spring.js'
const settings = { timeScale: 1, reducedMotion: false }
it('keeps explicit spring velocity in value units when normalizing different ranges', () => {
  for (const [from, to, velocity] of [
    [80, 0, 250],
    [0, 200, 500],
    [0.2, 0.8, -0.4],
    [-100, -20, -80],
  ] as const) {
    const options = { type: 'spring' as const, stiffness: 180, damping: 26, velocity }
    const value = valueTrack(to, options, from, 0, settings)
    const original = solveSpring(springPhysics(options), from, to, velocity, 0.000001)
    expect(Math.abs(value.velocityAt(0) - velocity)).toBeLessThan(
      Math.max(0.001, Math.abs(velocity) * 0.001),
    )
    for (const time of [0, 10, 30, 80, 200])
      expect(value.valueAt(time)).toBeCloseTo(original.position(time), 6)
  }
})
it('a spring returning to the same value retains its incoming momentum', () => {
  const value = valueTrack(25, { type: 'spring', velocity: 100 }, 25, 0, settings)
  expect(value.velocityAt(0)).toBeCloseTo(100, 1)
  expect(value.valueAt(30)).toBeGreaterThan(25)
  expect(value.to).toBe(25)
  expect(value.valueAt(value.end)).toBe(25)
})
