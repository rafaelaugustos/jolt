import { describe, expect, it } from 'vitest'
import { animate, decay, sequence, stop } from '../src/index.js'
import { solveDecay } from '../src/decay.js'
import { createView, driver, flush, state } from './helpers.js'

describe('decay physics', () => {
  it('integrates exponential velocity in seconds from any starting position', () => {
    const motion = solveDecay(40, 1200, 0.998, 0.25)
    const rate = -Math.log(0.998)

    expect(motion.position(0)).toBe(40)
    expect(motion.velocity(0)).toBe(1200)
    expect(motion.velocity(100)).toBeCloseTo(1200 * 0.998 ** 100)
    expect(motion.position(100)).toBeCloseTo(
      40 + (1200 / (rate * 1000)) * (1 - 0.998 ** 100),
    )
    expect(motion.to).toBeCloseTo(40 + 1200 / (rate * 1000))
    expect(motion.position(motion.duration)).toBe(motion.to)
    expect(motion.velocity(motion.duration)).toBe(0)
  })

  it('stops within position and speed tolerances without a visible last-frame jump', () => {
    const motion = solveDecay(0, -1200, 0.998, 0.25)

    expect(motion.duration).toBeGreaterThan(0)
    expect(Math.abs(motion.position(motion.duration - 1) - motion.to)).toBeLessThan(0.251)
    expect(Math.abs(motion.velocity(motion.duration - 1))).toBeLessThan(2.51)
    expect(motion.position(100)).toBeLessThan(0)
  })

  it('gives the same result when time is divided into 60 or 120 Hz frames', () => {
    const friction = 0.998
    const velocityAt = (hz: number) =>
      Array.from({ length: hz }).reduce<number>((v) => v * friction ** (1000 / hz), 1200)
    const motion = solveDecay(0, 1200, friction, 0.25)

    expect(velocityAt(60)).toBeCloseTo(velocityAt(120), 10)
    expect(motion.velocity(1000)).toBeCloseTo(velocityAt(120), 10)
  })

  it('settles immediately with zero velocity', () => {
    const motion = solveDecay(25, 0, 0.998, 0.25)
    expect(motion.duration).toBe(0)
    expect(motion.position(0)).toBe(25)
    expect(motion.to).toBe(25)
  })
})

describe('decay', () => {
  it('plays native samples from the current translation to the projected landing', async () => {
    const view = createView()
    view.translateX = 40
    const animation = decay(view, { x: 1200 })
    const track = driver.last('x').track

    expect(track.values[0]).toBe(40)
    expect(track.to).toBeCloseTo(639.3998, 3)
    expect(track.values.at(-1)).toBe(track.to)
    expect(track.values.length).toBeGreaterThan((track.duration / 1000) * 60)
    expect(track.times[0]).toBe(0)
    expect(track.times.at(-1)).toBe(1)
    expect(track.times).toHaveLength(track.values.length)
    expect(
      track.values.every((value, i) => i === 0 || value >= track.values[i - 1]!),
    ).toBe(true)
    expect(view.translateX).toBe(track.to)
    expect(track.arrival).toBe(track.end)

    driver.advance(track.end)
    expect(await animation).toBe(true)
  })

  it('starts both axes on the same clock, with a separate landing for each', () => {
    const view = createView()
    view.translateY = 10
    decay(view, { x: 600, y: -300 }, { friction: 0.99 })
    const x = driver.last('x')
    const y = driver.last('y')

    expect(x.startedAt).toBe(y.startedAt)
    expect(y.track.to - 10).toBeCloseTo(-x.track.to / 2)
    expect(y.track.values[0]).toBe(10)
  })

  it('springs directly to the stop closest to the projected landing', async () => {
    const view = createView()
    // The current position is nearest 0; the projected landing is nearest 320.
    const animation = decay(view, { x: 600 }, { snap: [0, 320] })
    const track = driver.last('x').track

    expect(track.values[0]).toBe(0)
    expect(track.to).toBe(320)
    expect(track.velocityAt(0.001)).toBeCloseTo(600, 0)
    expect(track.arrival).toBeLessThan(track.end)
    expect(track.values.at(-1)).toBe(320)

    driver.advance(track.end)
    expect(await animation).toBe(true)
  })

  it('uses friction to choose the snap target', () => {
    const first = createView()
    const second = createView()
    decay(first, { x: 600 }, { friction: 0.998, snap: [0, 320] })
    decay(second, { x: 600 }, { friction: 0.99, snap: [0, 320] })

    expect(driver.last('x', first).track.to).toBe(320)
    expect(driver.last('x', second).track.to).toBe(0)
  })

  it('supports shared stops and per-axis stops, including negative velocities', () => {
    const first = createView()
    const second = createView()
    decay(first, { x: 600, y: -600 }, { snap: [-320, 0, 320] })
    decay(second, { x: 600, y: -600 }, { snap: { x: [0, 240], y: [-200, 0] } })

    expect(driver.last('x', first).track.to).toBe(320)
    expect(driver.last('y', first).track.to).toBe(-320)
    expect(driver.last('x', second).track.to).toBe(240)
    expect(driver.last('y', second).track.to).toBe(-200)
  })

  it('leaves axes without snap points in free decay', () => {
    const view = createView()
    decay(view, { x: 600, y: 600 }, { snap: { x: [0, 320] } })

    expect(driver.last('x').track.to).toBe(320)
    expect(driver.last('y').track.to).toBeCloseTo(299.6999, 3)
  })

  it('takes the first listed snap point when two are equally close', () => {
    const view = createView()
    view.translateX = 50
    decay(view, { x: 0 }, { snap: [100, 0] })
    expect(driver.last('x').track.to).toBe(100)
  })

  it('finishes immediately for zero velocity, but still snaps an offset view', async () => {
    const view = createView()
    view.translateX = 50
    expect(await decay(view, { x: 0 })).toBe(true)
    expect(driver.played).toHaveLength(0)
    expect(view.translateX).toBe(50)

    const animation = decay(view, { x: 0 }, { snap: [0] })
    expect(driver.last('x').track.to).toBe(0)
    driver.advance(10_000)
    expect(await animation).toBe(true)
  })

  it('uses the position on screen when interrupting animate and only replaces its axis', async () => {
    const view = createView()
    const previous = animate(
      view,
      { x: 200, opacity: 0 },
      { duration: 1000, ease: 'linear' },
    )
    driver.advance(250)
    decay(view, { x: -600 })

    expect(driver.last('x').track.values[0]).toBe(50)
    expect(driver.last('x').track.velocityAt(0.01)).toBeCloseTo(-600, 0)
    expect(driver.last('opacity').stopped).toBe(false)
    driver.advance(750)
    expect(await previous).toBe(false)
  })

  it('passes its current position and velocity to an interrupting spring', async () => {
    const view = createView()
    const first = decay(view, { x: 600 })
    const previous = driver.last('x').track
    driver.advance(120)
    animate(view, { x: 0 }, { type: 'spring' })
    const next = driver.last('x').track

    expect(next.values[0]).toBeCloseTo(previous.valueAt(120))
    expect(next.velocityAt(0.01)).toBeCloseTo(previous.velocityAt(120), 0)
    expect(await first).toBe(false)
  })

  it('replaces a decay with a new explicit velocity without jumping', async () => {
    const view = createView()
    const first = decay(view, { x: 600 })
    const previous = driver.last('x').track
    driver.advance(120)
    decay(view, { x: -300 })

    expect(driver.last('x').track.values[0]).toBeCloseTo(previous.valueAt(120))
    expect(driver.last('x').track.velocityAt(0.01)).toBeCloseTo(-300, 0)
    expect(await first).toBe(false)
  })

  it('stops at its current position through either handle or selected properties', async () => {
    const view = createView()
    const animation = decay(view, { x: 600, y: -300 })
    const x = driver.last('x').track
    const y = driver.last('y').track
    const done = state(animation.finished)
    driver.advance(100)
    stop(view, ['x'])
    await flush()

    expect(view.translateX).toBeCloseTo(x.valueAt(100))
    expect(done()).toBeUndefined()
    expect(driver.last('y').stopped).toBe(false)
    animation.stop()
    expect(view.translateY).toBeCloseTo(y.valueAt(100))
    expect(await animation).toBe(false)
  })

  it('accepts several targets and template refs and stops them together', async () => {
    const first = createView()
    const second = createView()
    second.translateX = 80
    const animation = decay([{ nativeView: first }, { nativeElement: second }], {
      x: 600,
    })

    expect(driver.last('x', first).track.values[0]).toBe(0)
    expect(driver.last('x', second).track.values[0]).toBe(80)
    driver.advance(100)
    animation.stop()
    expect(driver.played.every((played) => played.stopped)).toBe(true)
    expect(await animation).toBe(false)
  })

  it('reads position on load and keeps snap points as they were at the call', async () => {
    const view = createView().unload()
    const snap = [0, 320]
    const animation = decay(view, { x: 600 }, { snap })
    expect(view.translateX).toBe(0)
    expect(driver.played).toHaveLength(0)
    snap[1] = 800
    view.translateX = 100
    view.load()

    expect(driver.last('x').track.values[0]).toBe(100)
    expect(driver.last('x').track.to).toBe(320)
    driver.advance(10_000)
    expect(await animation).toBe(true)
  })

  it('can be cancelled before load without replaying', async () => {
    const view = createView().unload()
    const animation = decay(view, { x: 600 })
    animation.stop()
    view.load()

    expect(driver.played).toHaveLength(0)
    expect(view.listenerCount('loaded')).toBe(0)
    expect(await animation).toBe(false)
  })

  it('runs in a sequence function and advances when a snapped spring arrives', async () => {
    const view = createView()
    const animation = sequence([
      () => decay(view, { x: 600 }, { snap: [320] }),
      () => animate(view, { opacity: 0 }, { duration: 100 }),
    ])
    const movement = driver.last('x').track
    driver.advance(movement.arrival)
    await flush()

    expect(driver.last('opacity').startedAt).toBe(driver.time)
    expect(driver.time).toBeLessThan(1000 + movement.end)
    driver.advance(10_000)
    expect(await animation).toBe(true)
  })

  it('bounds the number of samples for very slow decays', () => {
    decay(createView(), { x: 600 }, { friction: 0.99999 })
    expect(driver.last('x').track.values.length).toBeLessThanOrEqual(6001)
    expect(driver.last('x').track.values.every(Number.isFinite)).toBe(true)
  })

  it('finishes empty velocities and target lists without waiting for load', async () => {
    expect(await decay(createView().unload(), {})).toBe(true)
    expect(await decay([], { x: 600 })).toBe(true)
    expect(driver.played).toHaveLength(0)
  })

  it.each([0, 1, -0.1, 1.01, NaN, Infinity])(
    'rejects invalid friction %s before interrupting',
    (friction) => {
      const view = createView()
      animate(view, { x: 200 })
      const previous = driver.last('x')
      expect(() => decay(view, { x: 600 }, { friction })).toThrow('friction')
      expect(previous.stopped).toBe(false)
    },
  )

  it('validates all axes, stops and targets before starting or interrupting', () => {
    const view = createView()
    animate(view, { x: 200 })
    const previous = driver.last('x')

    expect(() => decay(view, { x: 600, y: NaN })).toThrow('velocity')
    expect(() => decay(view, { x: Infinity })).toThrow('velocity')
    expect(() => decay(view, { x: Number.MAX_VALUE })).toThrow('unplayable')
    expect(() => decay(view, { x: 600 }, { friction: 1 - Number.EPSILON })).toThrow(
      'unplayable',
    )
    expect(() => decay(view, { rotate: 600 } as never)).toThrow('Use x or y')
    expect(() => decay(view, { x: 600 }, { snap: [] })).toThrow('snap')
    expect(() => decay(view, { x: 600 }, { snap: Array(2) })).toThrow('snap')
    expect(() => decay(view, { x: 600 }, { snap: 100 as never })).toThrow('snap')
    expect(() => decay(view, { x: 600 }, { snap: [0, Infinity] })).toThrow('snap')
    expect(() => decay(view, { x: 600 }, { snap: { x: [0], y: [NaN] } })).toThrow('snap')
    expect(() => decay([view, undefined as never], { x: 600 })).toThrow(
      'Expected a NativeScript view',
    )
    expect(driver.played).toHaveLength(1)
    expect(previous.stopped).toBe(false)
  })
})
