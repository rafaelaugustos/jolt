import { describe, expect, it } from 'vitest'
import {
  animate,
  bind,
  configure,
  motionScope,
  motionValue,
  set,
  stop,
} from '../src/index.js'
import { solveGravity } from '../src/gravity.js'
import { createView, driver } from './helpers.js'
import { maximumSampleError } from './sampling-helpers.js'

describe('ballistic gravity', () => {
  it('matches the closed-form free fall and impact time in seconds', () => {
    const motion = solveGravity(20, 520, 1000, 0, 0, 0.25)
    expect(motion.duration).toBe(1000)
    expect(motion.position(500)).toBe(145)
    expect(motion.velocity(500)).toBe(500)
    expect(motion.position(1000)).toBe(520)
    expect(motion.velocity(1000)).toBe(0)
  })
  it('loses restitution squared of the bounce height, without penetrating the floor', () => {
    const motion = solveGravity(0, 500, 1000, 0.5, 0, 0.25)
    expect(motion.position(1000)).toBeCloseTo(500)
    expect(motion.velocity(1000)).toBeCloseTo(-500)
    expect(motion.position(1500)).toBeCloseTo(375)
    expect(motion.position(2250)).toBeCloseTo(468.75)
    for (let time = 0; time <= motion.duration; time += 0.7)
      expect(motion.position(time)).toBeLessThanOrEqual(500)
  })
  it('mirrors a negative landing and accepts initial velocity away from the floor', () => {
    const a = solveGravity(40, 440, 1500, 0.6, -300, 0.25)
    const b = solveGravity(-40, -440, 1500, 0.6, 300, 0.25)
    expect(a.position(100)).toBeLessThan(40)
    expect(a.duration).toBe(b.duration)
    for (let t = 0; t < a.duration; t += 17) {
      expect(a.position(t)).toBeCloseTo(-b.position(t))
      expect(a.velocity(t)).toBeCloseTo(-b.velocity(t))
    }
  })
  it('can toss away from an already reached floor and return', () => {
    const motion = solveGravity(50, 50, 1000, 0, -500, 0.25)
    expect(motion.position(500)).toBe(-75)
    expect(motion.duration).toBe(1000)
    expect(motion.position(1000)).toBe(50)
  })
  it('rests immediately with zero energy and handles incoming contact at time zero', () => {
    const rest = solveGravity(12, 12, 1800, 0.55, 0, 0.25)
    expect(rest.duration).toBe(0)
    expect(rest.velocity(-1)).toBe(0)
    const contact = solveGravity(0, 0, 1000, 0.5, 400, 0.25)
    expect(contact.velocity(0)).toBe(-200)
    expect(contact.position(200)).toBe(-20)
  })
  it('bounds setup for almost elastic impacts and extreme flight durations', () => {
    expect(() => solveGravity(0, 500, 1000, 1 - Number.EPSILON, 0, 0.25)).toThrow(
      '60 seconds',
    )
    expect(() => solveGravity(0, 500, 0.001, 0.5, 0, 0.25)).toThrow('60 seconds')
    expect(() => solveGravity(0, 500, Number.MAX_VALUE, 0, 0, 0.25)).toThrow(
      'numeric range',
    )
  })
})

describe('gravity through the existing animation API', () => {
  it('hands native players bounded samples with every impact represented exactly', async () => {
    const view = createView()
    const animation = animate(
      view,
      { y: 500 },
      { type: 'gravity', acceleration: 1000, restitution: 0.5 },
    )
    const track = driver.last('y').track
    expect(track.sampling?.bounded).toBe(true)
    expect(maximumSampleError(track)).toBeLessThanOrEqual(0.250001)
    for (const impact of [1000, 2000, 2500]) {
      const i = track.times.findIndex((t) => Math.abs(t * track.duration - impact) < 1e-6)
      expect(i).toBeGreaterThan(0)
      expect(track.values[i]).toBeCloseTo(500)
    }
    expect(track.arrival).toBe(track.end)
    driver.advance(track.end)
    expect(await animation).toBe(true)
    expect(view.translateY).toBe(500)
    expect(driver.frames.size).toBe(0)
  })
  it('inherits current position and signed velocity when interrupted, and hands them to a spring', async () => {
    const view = createView()
    animate(view, { y: [0, 200], opacity: [1, 0.5] }, { duration: 1000, ease: 'linear' })
    driver.advance(250)
    const falling = animate(view, { y: 500 }, { type: 'gravity' })
    const first = driver.last('y').track
    expect(first.values[0]).toBe(50)
    expect(first.velocityAt(0)).toBeCloseTo(200)
    expect(driver.last('opacity').stopped).toBe(false)
    driver.advance(100)
    animate(view, { y: 0 }, 'snappy')
    const second = driver.last('y').track
    expect(second.values[0]).toBeCloseTo(first.valueAt(100))
    expect(second.velocityAt(0)).toBeCloseTo(first.velocityAt(100), 0)
    expect(await falling).toBe(false)
  })
  it('accepts an explicit launch velocity instead of inherited momentum', () => {
    const view = createView()
    animate(view, { y: 300 }, { type: 'gravity', velocity: -400 })
    expect(driver.last('y').track.velocityAt(0)).toBe(-400)
    expect(driver.last('y').track.valueAt(100)).toBeLessThan(0)
  })
  it('uses a motion value in its original physical units, including coincident endpoints', () => {
    const value = motionValue(20),
      view = createView()
    const unbind = bind(view, { y: value })
    animate(value, 520, { type: 'gravity', acceleration: 1000, restitution: 0 })
    driver.advance(500)
    expect(value.get()).toBeCloseTo(145)
    set(value, 520)
    animate(value, 520, {
      type: 'gravity',
      acceleration: 1000,
      restitution: 0,
      velocity: -500,
    })
    driver.advance(500)
    expect(value.get()).toBeCloseTo(395)
    stop(value)
    unbind()
  })
  it('pauses, seeks across impacts, resumes and stops at the visible position', async () => {
    const view = createView()
    const animation = animate(view, { y: 400 }, { type: 'gravity' })
    const track = driver.last('y').track
    driver.advance(100)
    animation.pause()
    const progress = animation.progress
    driver.advance(500)
    expect(animation.progress).toBe(progress)
    animation.progress = 0.6
    animation.play()
    driver.advance(30)
    animation.stop()
    expect(view.translateY).toBeCloseTo(track.valueAt(0.6 * track.duration + 30))
    expect(await animation).toBe(false)
  })
  it('supports delayed, staggered and reversed playback through ordinary timing', () => {
    const a = createView(),
      b = createView()
    animate(
      [a, b],
      { y: [0, 300] },
      { type: 'gravity', delay: 100, stagger: 50, repeat: 1, repeatType: 'reverse' },
    )
    expect(driver.last('y', a).track.delay).toBe(100)
    expect(driver.last('y', b).track.delay).toBe(150)
    expect(driver.last('y', a).track.to).toBe(0)
  })
  it('settles immediately under reduced motion for views and motion values', async () => {
    configure({ reducedMotion: 'always' })
    const view = createView(),
      value = motionValue(0)
    expect(await animate(view, { y: 300 }, { type: 'gravity' })).toBe(true)
    expect(await animate(value, 300, { type: 'gravity' })).toBe(true)
    expect(view.translateY).toBe(300)
    expect(value.get()).toBe(300)
    expect(driver.played).toHaveLength(0)
  })
  it('owns and releases a falling animation through a motion scope', async () => {
    const scope = motionScope(),
      view = createView()
    const animation = scope.animate(view, { y: 300 }, { type: 'gravity' })
    driver.advance(100)
    scope.suspend()
    expect(animation.paused).toBe(true)
    scope.resume()
    expect(animation.paused).toBe(false)
    scope.dispose()
    scope.dispose()
    expect(await animation).toBe(false)
    expect(driver.last('y').stopped).toBe(true)
  })
  it('retains ordinary property overrides and gravity timing overrides', () => {
    const view = createView()
    animate(
      view,
      { y: 300, opacity: 0 },
      { type: 'gravity', y: { delay: 50 }, opacity: { type: 'tween', duration: 200 } },
    )
    expect(driver.last('y').track.delay).toBe(50)
    expect(driver.last('opacity').track.duration).toBe(200)
    animate(view, { y: 300 }, { duration: 100, y: { type: 'gravity' } })
    expect(driver.last('y').track.duration).toBeGreaterThan(100)
  })
  it('honors global playback speed without changing the trajectory', () => {
    const a = createView(),
      b = createView()
    animate(a, { y: 300 }, { type: 'gravity' })
    const normal = driver.last('y', a).track
    configure({ timeScale: 0.5 })
    animate(b, { y: 300 }, { type: 'gravity' })
    const slow = driver.last('y', b).track
    expect(slow.duration).toBe(normal.duration * 2)
    expect(slow.valueAt(400)).toBeCloseTo(normal.valueAt(200))
    expect(slow.velocityAt(400)).toBeCloseTo(normal.velocityAt(200) / 2)
  })
  it('rejects invalid contracts before interrupting an existing owner', () => {
    const view = createView()
    animate(view, { y: 300 }, { duration: 1000 })
    const previous = driver.last('y')
    for (const options of [
      { acceleration: 0 },
      { acceleration: Infinity },
      { restitution: -1 },
      { restitution: 1 },
      { velocity: NaN },
      { duration: 100 },
      { ease: 'linear' },
    ])
      expect(() =>
        animate(view, { y: 400 }, { type: 'gravity', ...options } as never),
      ).toThrow()
    expect(() => animate(view, { y: [0, 100, 400] }, { type: 'gravity' })).toThrow(
      'one fixed',
    )
    expect(() => animate(view, { rotate: 400 }, { type: 'gravity' })).toThrow('x, y')
    expect(() =>
      animate(view, { y: 400 }, { type: 'gravity', acceleration: 0.000001 }),
    ).toThrow('60 seconds')
    expect(previous.stopped).toBe(false)
  })
})
