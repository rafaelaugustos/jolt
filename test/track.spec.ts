import { maximumSampleError } from './sampling-helpers.js'
import { describe, expect, it } from 'vitest'
import { createTrack } from '../src/track.js'
import { resolveTransition, type Transition } from '../src/transition.js'
import type { Property } from '../src/properties.js'
import './helpers.js'

function track(
  keyframes: number[],
  transition: Transition,
  property: Property = 'x',
  velocity = 0,
) {
  return createTrack(
    property,
    keyframes,
    resolveTransition(transition, property, keyframes.length),
    velocity,
  )
}

describe('tween tracks', () => {
  it('passes through every keyframe at its time', () => {
    const t = track([0, 100, 50], { duration: 400, times: [0, 0.25, 1] })

    expect(t.valueAt(0)).toBe(0)
    expect(t.valueAt(100)).toBe(100)
    expect(t.valueAt(400)).toBe(50)
    expect(t.times).toContain(0.25)
    expect(t.values[t.times.indexOf(0.25)]).toBe(100)
    expect(t.to).toBe(50)
    expect(t.end).toBe(400)
  })

  it('samples eased segments and leaves linear ones as they are', () => {
    const eased = track([0, 100], { duration: 500, ease: 'easeInOut' })
    const linear = track([0, 100, 0], { duration: 500, ease: 'linear' })

    expect(maximumSampleError(eased)).toBeLessThanOrEqual(0.25)
    expect(eased.valueAt(250)).toBeCloseTo(50, 1)
    expect(linear.times).toEqual([0, 0.5, 1])
    expect(linear.values).toEqual([0, 100, 0])
  })

  it('takes an easing per segment', () => {
    const t = track([0, 100, 0], { duration: 200, ease: ['easeOut', 'linear'] })

    expect(t.valueAt(50)).toBeGreaterThan(50)
    expect(t.valueAt(150)).toBeCloseTo(50)
  })

  it('holds the first keyframe during the delay', () => {
    const t = track([10, 20], { duration: 100, delay: 300, ease: 'linear' })

    expect(t.valueAt(0)).toBe(10)
    expect(t.valueAt(299)).toBe(10)
    expect(t.valueAt(350)).toBe(15)
    expect(t.velocityAt(100)).toBe(0)
    expect(t.velocityAt(350)).toBeCloseTo(100)
    expect(t.end).toBe(400)
  })

  it('repeats', () => {
    const t = track([0, 100], { duration: 100, ease: 'linear', repeat: 2 })

    expect(t.end).toBe(300)
    expect(t.valueAt(150)).toBe(50)
    expect(t.valueAt(300)).toBe(100)
    expect(t.to).toBe(100)
  })

  it('plays every other repeat backwards', () => {
    const odd = track([0, 100], {
      duration: 100,
      ease: 'linear',
      repeat: 1,
      repeatType: 'reverse',
    })
    const even = track([0, 100], {
      duration: 100,
      ease: 'linear',
      repeat: 2,
      repeatType: 'reverse',
    })

    expect(odd.valueAt(125)).toBe(75)
    expect(odd.velocityAt(125)).toBeCloseTo(-1000)
    expect(odd.valueAt(200)).toBe(0)
    expect(odd.to).toBe(0)
    expect(even.to).toBe(100)
  })

  it('never ends with an infinite repeat, and rests on the first keyframe', () => {
    const t = track([0, 360], { duration: 1000, ease: 'linear', repeat: Infinity })

    expect(t.end).toBe(Infinity)
    expect(t.valueAt(10_250)).toBe(90)
    expect(t.to).toBe(0)
  })
})

describe('spring tracks', () => {
  it('ends exactly on the target', () => {
    const t = track([0, 100], { type: 'spring', bounce: 0.3 })

    expect(t.values[0]).toBe(0)
    expect(t.values.at(-1)).toBe(100)
    expect(t.times.at(-1)).toBe(1)
    expect(t.valueAt(t.end)).toBe(100)
    expect(maximumSampleError(t)).toBeLessThanOrEqual(0.25)
  })

  it('carries the velocity it is given, unless the transition sets one', () => {
    const inherited = track([0, 100], { type: 'spring' }, 'x', 1000)
    const explicit = track([0, 100], { type: 'spring', velocity: 0 }, 'x', 1000)

    expect(inherited.velocityAt(0.5)).toBeGreaterThan(900)
    expect(explicit.velocityAt(0.5)).toBeLessThan(100)
  })

  it('settles to the precision of the property', () => {
    const opacity = track([0, 1], { type: 'spring', bounce: 0.3 }, 'opacity')
    const near = opacity.valueAt(opacity.end - 1)

    expect(Math.abs(near - 1)).toBeLessThan(0.002)
  })

  it('arrives once it is close to the target for good, well before it settles', () => {
    const t = track([0, 100], { type: 'spring', bounce: 0.4, delay: 100 })

    expect(t.arrival).toBeLessThan(t.end * 0.7)
    expect(t.arrival).toBeGreaterThan(t.delay)
    for (let time = t.arrival; time <= t.end; time += 5) {
      expect(Math.abs(t.valueAt(time) - 100)).toBeLessThanOrEqual(5)
    }
  })

  it('arrives at the end when tweened or repeated', () => {
    expect(track([0, 100], { duration: 300 }).arrival).toBe(300)
    const repeated = track([0, 100], { type: 'spring', repeat: 1 })
    expect(repeated.arrival).toBe(repeated.end)
  })
})
