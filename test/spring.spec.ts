import { describe, expect, it } from 'vitest'
import { solveSpring, springPhysics } from '../src/spring.js'

const ratio = ({ stiffness, damping, mass }: ReturnType<typeof springPhysics>) =>
  damping / (2 * Math.sqrt(stiffness * mass))

function samples(spring: ReturnType<typeof solveSpring>, step = 4) {
  const values: number[] = []
  for (let t = 0; t <= spring.duration; t += step) values.push(spring.position(t))
  return values
}

describe('springPhysics', () => {
  it('turns duration and bounce into physics', () => {
    const physics = springPhysics({ duration: 500, bounce: 0 })

    expect(physics.mass).toBe(1)
    expect(physics.stiffness).toBeCloseTo((2 * Math.PI * 2) ** 2)
    expect(ratio(physics)).toBeCloseTo(1)
    expect(ratio(springPhysics({ bounce: 0.3 }))).toBeCloseTo(0.7)
    expect(ratio(springPhysics({ bounce: -0.5 }))).toBeCloseTo(2)
  })

  it('takes stiffness, damping and mass as they are', () => {
    expect(springPhysics({ stiffness: 300, damping: 20 })).toEqual({
      stiffness: 300,
      damping: 20,
      mass: 1,
    })
    expect(springPhysics({ mass: 2 })).toEqual({ stiffness: 170, damping: 26, mass: 2 })
  })
})

describe('solveSpring', () => {
  it('goes from one value to the other and settles', () => {
    const spring = solveSpring(springPhysics({ bounce: 0.3 }), 0, 100, 0, 0.25)

    expect(spring.position(0)).toBe(0)
    expect(spring.position(spring.duration)).toBe(100)
    expect(spring.duration).toBeGreaterThan(300)
    expect(spring.duration).toBeLessThan(2000)
    expect(Math.abs(spring.position(spring.duration - 1) - 100)).toBeLessThan(0.25)
  })

  it('overshoots only when it bounces', () => {
    const bouncy = solveSpring(springPhysics({ bounce: 0.4 }), 0, 100, 0, 0.25)
    const smooth = solveSpring(springPhysics({ bounce: 0 }), 0, 100, 0, 0.25)
    const overdamped = solveSpring(springPhysics({ bounce: -0.5 }), 0, 100, 0, 0.25)

    expect(Math.max(...samples(bouncy))).toBeGreaterThan(105)
    expect(Math.max(...samples(smooth))).toBeLessThanOrEqual(100)
    expect(Math.max(...samples(overdamped))).toBeLessThanOrEqual(100)
    expect(samples(smooth)).toEqual([...samples(smooth)].sort((a, b) => a - b))
  })

  it('starts with the velocity it is given', () => {
    const spring = solveSpring(springPhysics({}), 0, 100, 800, 0.25)

    expect(spring.velocity(0)).toBeCloseTo(800, 0)
    expect(spring.velocity(spring.duration)).toBe(0)
  })

  it('moves with velocity alone when it starts on its target', () => {
    const spring = solveSpring(springPhysics({}), 50, 50, 500, 0.25)

    expect(spring.duration).toBeGreaterThan(0)
    expect(Math.max(...samples(spring))).toBeGreaterThan(55)
    expect(spring.position(spring.duration)).toBe(50)
  })

  it('has nothing to do at rest', () => {
    const spring = solveSpring(springPhysics({}), 1, 1, 0, 0.001)

    expect(spring.duration).toBe(0)
    expect(spring.position(0)).toBe(1)
  })

  it('takes longer over a longer distance, to the same precision', () => {
    const physics = springPhysics({})
    const short = solveSpring(physics, 0, 10, 0, 0.25)
    const long = solveSpring(physics, 0, 1000, 0, 0.25)

    expect(long.duration).toBeGreaterThan(short.duration)
  })
})
