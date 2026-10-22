import { describe, expect, it } from 'vitest'
import { origamiSpring } from '../src/index.js'
import { createTrack } from '../src/track.js'
import { resolveTransition } from '../src/transition.js'
import './helpers.js'

/** React Native's closed-form spring from 0 to 1 at rest, as SpringAnimation computes it. */
function reactNativeSpring(stiffness: number, damping: number, mass: number, t: number) {
  const zeta = damping / (2 * Math.sqrt(stiffness * mass))
  const omega0 = Math.sqrt(stiffness / mass)
  const seconds = t / 1000
  if (zeta < 1) {
    const omega1 = omega0 * Math.sqrt(1 - zeta * zeta)
    const envelope = Math.exp(-zeta * omega0 * seconds)
    return (
      1 -
      envelope *
        (Math.cos(omega1 * seconds) +
          ((zeta * omega0) / omega1) * Math.sin(omega1 * seconds))
    )
  }
  return 1 - Math.exp(-omega0 * seconds) * (1 + omega0 * seconds)
}

describe('origamiSpring', () => {
  it("defaults to React Native's friction 7 and tension 40", () => {
    expect(origamiSpring()).toEqual({
      type: 'spring',
      stiffness: expect.closeTo(230.2, 6),
      damping: 22,
      mass: 1,
    })
  })

  it('converts friction and tension with the Origami formulas', () => {
    expect(origamiSpring({ friction: 3, tension: 40 })).toMatchObject({ damping: 10 })
    expect(origamiSpring({ friction: 10, tension: 100 })).toMatchObject({
      stiffness: expect.closeTo(447.4, 6),
      damping: 31,
    })
  })

  it('plays the same motion as Animated.spring', () => {
    for (const config of [
      {},
      { friction: 3, tension: 40 },
      { friction: 12, tension: 80 },
    ]) {
      const spring = origamiSpring(config)
      const track = createTrack('x', [0, 300], resolveTransition(spring, 'x', 2), 0)
      for (const time of [40, 120, 250, 400, 700])
        expect(track.valueAt(time) / 300).toBeCloseTo(
          reactNativeSpring(spring.stiffness!, spring.damping!, 1, time),
          2,
        )
    }
  })

  it('rejects values that give no spring', () => {
    expect(() => origamiSpring({ friction: Number.NaN })).toThrow(RangeError)
    expect(() => origamiSpring({ tension: -100 })).toThrow(/no spring/)
    expect(() => origamiSpring({ friction: -10 })).toThrow(/no spring/)
  })
})
