import { describe, expect, it } from 'vitest'
import { animate, configure, decay, sequence } from '../src/index.js'
import { createView, driver, flush } from './helpers.js'

describe('configure', () => {
  it('rejects invalid settings without changing the current ones', () => {
    configure({ timeScale: 2 })
    for (const timeScale of [0, -1, NaN, Infinity]) {
      expect(() => configure({ timeScale })).toThrow(RangeError)
    }
    expect(() => configure(null as never)).toThrow(TypeError)
    expect(() => configure('fast' as never)).toThrow(TypeError)
    animate(createView(), { x: 100 }, { duration: 300 })
    expect(driver.last('x').track.duration).toBe(150)
  })

  it('ignores unknown and undefined settings', () => {
    configure({ timeScale: undefined, other: 1 } as never)
    animate(createView(), { x: 100 }, { duration: 300 })
    expect(driver.last('x').track.duration).toBe(300)
  })
})

describe('time scale', () => {
  it('stretches durations, delays and arrivals of animations started afterwards', () => {
    const view = createView()
    const before = animate(view, { x: 100 }, { duration: 300, delay: 100 })
    expect(before.duration).toBe(400)
    configure({ timeScale: 0.5 })
    expect(before.duration).toBe(400)
    const after = animate(createView(), { x: 100 }, { duration: 300, delay: 100 })
    const track = driver.last('x').track
    expect(track.duration).toBe(600)
    expect(track.delay).toBe(200)
    expect(track.end).toBe(800)
    expect(after.duration).toBe(800)
    expect(track.valueAt(500)).toBeCloseTo(driver.played[0]!.track.valueAt(250))
    expect(track.velocityAt(500)).toBeCloseTo(driver.played[0]!.track.velocityAt(250) / 2)
  })

  it('plays the same spring trajectory more slowly, keeping its sample density', () => {
    animate(createView(), { x: 100 }, 'bouncy')
    const reference = driver.last('x').track
    configure({ timeScale: 0.2 })
    animate(createView(), { x: 100 }, 'bouncy')
    const slowed = driver.last('x').track
    expect(slowed.duration).toBeCloseTo(reference.duration * 5)
    expect(slowed.arrival).toBeCloseTo(reference.arrival * 5)
    expect(slowed.values.length).toBeGreaterThan(reference.values.length * 4)
    for (const time of [100, 500, 1200]) {
      expect(slowed.valueAt(time * 5)).toBeCloseTo(reference.valueAt(time), 3)
    }
    expect(slowed.to).toBe(100)
  })

  it('keeps the value and velocity on screen when a slowed spring is interrupted', async () => {
    configure({ timeScale: 0.5 })
    const view = createView()
    animate(view, { x: 100 }, 'bouncy')
    const previous = driver.last('x').track
    driver.advance(200)
    animate(view, { x: 0 }, 'smooth')
    await flush()
    const next = driver.last('x').track
    expect(next.values[0]).toBeCloseTo(previous.valueAt(200))
    expect(next.velocityAt(0.01)).toBeCloseTo(previous.velocityAt(200), 0)
    expect(next.velocityAt(0.01)).toBeGreaterThan(0)
  })

  it('applies to decay, colors and stagger', () => {
    decay(createView(), { x: 1000 })
    const reference = driver.last('x').track
    configure({ timeScale: 0.5 })
    decay(createView(), { x: 1000 })
    const slowed = driver.last('x').track
    expect(slowed.to).toBeCloseTo(reference.to)
    expect(slowed.duration).toBeCloseTo(reference.duration * 2)
    animate(createView(), { backgroundColor: '#ff0000' }, { duration: 300 })
    expect(driver.last('backgroundColor').track.duration).toBe(600)
    animate([createView(), createView()], { x: 100 }, { duration: 100, stagger: 50 })
    expect(driver.played.at(-1)!.track.delay).toBe(100)
  })

  it('stretches the timing of motion paths and their stagger', () => {
    configure({ timeScale: 0.5 })
    const views = [createView(), createView()]
    animate(
      views,
      { path: 'M0 0 L100 0' },
      { duration: 1000, ease: 'linear', delay: 100, stagger: 50 },
    )
    const first = driver.last('x', views[0]).track
    expect(first.delay).toBe(200)
    expect(first.duration).toBe(2000)
    expect(first.end).toBe(2200)
    expect(first.valueAt(1200)).toBeCloseTo(50)
    expect(driver.last('x', views[1]).track.delay).toBe(300)
  })

  it('scales sequence positions and offsets', async () => {
    configure({ timeScale: 0.5 })
    const a = createView()
    const b = createView()
    const c = createView()
    const d = createView()
    sequence([
      [a, { x: 100 }, { duration: 100 }],
      [b, { x: 100 }, { duration: 100, at: 50 }],
      [c, { x: 100 }, { duration: 100, at: '+50' }],
      [d, { x: 100 }, { duration: 100, at: '-50' }],
    ])
    const started = () => driver.played.map((p) => p.view)
    driver.advance(99)
    expect(started()).toEqual([a])
    driver.advance(1)
    expect(started()).toEqual([a, b])
    driver.advance(200)
    await flush()
    expect(started()).toEqual([a, b])
    driver.advance(99)
    await flush()
    expect(started()).toEqual([a, b])
    driver.advance(1)
    await flush()
    expect(started()).toEqual([a, b, c])
    driver.advance(99)
    await flush()
    expect(started()).toEqual([a, b, c])
    driver.advance(1)
    await flush()
    expect(started()).toEqual([a, b, c, d])
  })
})
