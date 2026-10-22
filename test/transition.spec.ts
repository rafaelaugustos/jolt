import { describe, expect, it } from 'vitest'
import { animate } from '../src/index.js'
import { springPhysics } from '../src/spring.js'
import {
  fitTransition,
  mergeTransitions,
  resolveTransition,
  springs,
} from '../src/transition.js'
import { createView, driver } from './helpers.js'

describe('resolveTransition', () => {
  it('springs transforms and fades opacity by default', () => {
    const y = resolveTransition({}, 'y', 2)
    const opacity = resolveTransition({}, 'opacity', 2)

    expect(y.curve).toEqual({
      type: 'spring',
      physics: springPhysics(springs.snappy),
      velocity: undefined,
    })
    expect(opacity.curve).toMatchObject({ type: 'tween', duration: 300 })
  })

  it('tweens keyframes by default', () => {
    expect(resolveTransition({}, 'x', 3).curve.type).toBe('tween')
  })

  it('is a spring as soon as it has spring options', () => {
    expect(resolveTransition({ bounce: 0.2 }, 'opacity', 2).curve.type).toBe('spring')
    expect(resolveTransition({ stiffness: 400 }, 'x', 2).curve.type).toBe('spring')
    expect(resolveTransition({ duration: 200 }, 'x', 2).curve.type).toBe('tween')
  })

  it('keeps timing apart from the curve', () => {
    expect(
      resolveTransition({ delay: 100, repeat: 2, repeatType: 'reverse' }, 'x', 2),
    ).toMatchObject({ delay: 100, repeat: 2, reverse: true })
  })

  it('refuses a spring between more than two keyframes', () => {
    expect(() => resolveTransition({ type: 'spring' }, 'x', 3)).toThrow(
      'A spring goes from one value to another',
    )
  })

  it('checks easings and times against the keyframes', () => {
    expect(() => resolveTransition({ ease: ['easeIn'] }, 'x', 3)).toThrow(
      '2 segments between keyframes but 1 easings',
    )
    expect(() => resolveTransition({ times: [0, 1] }, 'x', 3)).toThrow(
      'one value per keyframe',
    )
    expect(() => resolveTransition({ times: [0, 0.8, 0.5, 1] }, 'x', 4)).toThrow(
      'without going back',
    )
    expect(() => resolveTransition({ duration: -1 }, 'x', 2)).toThrow('Invalid duration')
  })
})

describe('mergeTransitions', () => {
  it('takes the curve whole over a spring, or when the override is a spring', () => {
    expect(
      mergeTransitions({ type: 'spring', bounce: 0.4, delay: 100 }, { duration: 200 }),
    ).toEqual({ delay: 100, duration: 200 })
    expect(
      mergeTransitions({ duration: 900, ease: 'easeInOut' }, { bounce: 0.3 }),
    ).toEqual({ bounce: 0.3 })
    expect(mergeTransitions({ delay: 100 }, { times: [0, 0.5, 1] })).toEqual({
      delay: 100,
      times: [0, 0.5, 1],
    })
  })

  it('merges a tween over a tween key by key', () => {
    expect(
      mergeTransitions({ duration: 900, ease: 'easeInOut' }, { times: [0, 0.3, 1] }),
    ).toEqual({ duration: 900, ease: 'easeInOut', times: [0, 0.3, 1] })
    expect(
      mergeTransitions({ duration: 900, ease: 'easeInOut' }, { ease: 'linear' }),
    ).toEqual({ duration: 900, ease: 'linear' })
  })

  it("drops inherited times and easings that don't fit the keyframes", () => {
    const merged = mergeTransitions(
      { duration: 600, ease: ['easeOut', 'easeIn'], times: [0, 0.3, 1] },
      { duration: 200 },
    )
    expect(fitTransition(merged, 3)).toEqual({
      duration: 200,
      ease: ['easeOut', 'easeIn'],
      times: [0, 0.3, 1],
    })
    expect(fitTransition(merged, 2)).toEqual({ duration: 200 })
    const own = { duration: 600, times: [0, 0.3, 1] }
    expect(fitTransition(own, 2)).toBe(own)
  })

  it('merges timing into the base curve', () => {
    expect(
      mergeTransitions({ duration: 300, delay: 100 }, { delay: 50, repeat: 1 }),
    ).toEqual({
      duration: 300,
      delay: 50,
      repeat: 1,
    })
  })
})

describe('per-property transitions', () => {
  it('keep the main tween duration and ease when they only set times', () => {
    const view = createView()
    animate(
      view,
      { scale: [0.8, 1.05, 1], opacity: [0, 1, 1] },
      { duration: 900, ease: 'linear', opacity: { times: [0, 0.3, 1] } },
    )
    const fade = driver.last('opacity').track
    expect(fade.duration).toBe(900)
    expect(fade.valueAt(135)).toBeCloseTo(0.5)
    expect(fade.valueAt(270)).toBeCloseTo(1)
  })

  it('still replace the curve over a spring', () => {
    const view = createView()
    animate(
      view,
      { y: 0, opacity: 1 },
      { type: 'spring', bounce: 0.3, opacity: { duration: 150 } },
    )
    expect(driver.last('opacity').track.duration).toBe(150)
  })

  it('leave out inherited times that belong to other keyframes', () => {
    const view = createView()
    animate(
      view,
      { x: [0, 100, 50], opacity: [0, 1] },
      { duration: 600, times: [0, 0.3, 1], ease: 'linear', opacity: { ease: 'linear' } },
    )
    expect(driver.last('x').track.valueAt(180)).toBeCloseTo(100)
    expect(driver.last('opacity').track.valueAt(300)).toBeCloseTo(0.5)
  })

  it("keep a preset's shape when its duration changes", () => {
    const view = createView()
    animate(view, 'heartbeat', { duration: 2000 })
    const beat = driver.last('scaleX').track
    expect(beat.duration).toBe(2000)
    expect(beat.valueAt(280)).toBeCloseTo(1.15)

    const card = createView()
    animate(card, 'popOut', { duration: 900 })
    expect(driver.last('scaleX', card).track.valueAt(270)).toBeCloseTo(1.08)
    expect(driver.last('opacity', card).track.duration).toBe(900)
  })
})
