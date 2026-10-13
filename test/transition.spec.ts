import { describe, expect, it } from 'vitest'
import { springPhysics } from '../src/spring.js'
import { mergeTransitions, resolveTransition, springs } from '../src/transition.js'

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
  it('takes the curve whole from the override', () => {
    expect(
      mergeTransitions({ type: 'spring', bounce: 0.4, delay: 100 }, { duration: 200 }),
    ).toEqual({ delay: 100, duration: 200 })
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
