import { describe, expect, it } from 'vitest'
import {
  animate,
  configure,
  decay,
  onReducedMotion,
  press,
  reducedMotion,
  sequence,
} from '../src/index.js'
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

describe('reduced motion', () => {
  it('validates the preference without changing the current one', () => {
    expect(() => configure({ reducedMotion: 'sometimes' as never })).toThrow(TypeError)
    expect(() => configure({ reducedMotion: 'always', timeScale: 0 })).toThrow(RangeError)
    animate(createView(), { x: 100 })
    expect(driver.played).toHaveLength(1)
  })

  it('jumps transforms and decorations to their end while opacity and colors fade', async () => {
    configure({ reducedMotion: 'always' })
    const view = createView()
    const animation = animate(
      view,
      {
        x: 100,
        scale: 0.5,
        rotate: 90,
        borderRadius: 20,
        opacity: 0,
        backgroundColor: '#ff0000',
      },
      { duration: 300 },
    )
    expect(driver.played.map((p) => p.track.property)).toEqual([
      'opacity',
      'backgroundColor',
    ])
    expect(view.translateX).toBe(100)
    expect(view.scaleX).toBe(0.5)
    expect(view.scaleY).toBe(0.5)
    expect(view.rotate).toBe(90)
    expect(view.borderRadius).toBe(20)
    expect(animation.duration).toBe(300)
    driver.advance(300)
    expect(await animation).toBe(true)
  })

  it('resolves right away when nothing is left to animate', async () => {
    configure({ reducedMotion: 'always' })
    const view = createView()
    const animation = animate(view, { y: -40 }, 'bouncy')
    expect(driver.played).toHaveLength(0)
    expect(view.translateY).toBe(-40)
    expect(animation.duration).toBe(0)
    expect(await animation).toBe(true)
  })

  it('follows the platform setting by default and only when asked', () => {
    const view = createView()
    animate(view, { x: 100 })
    expect(driver.played).toHaveLength(1)
    driver.reduced = true
    animate(view, { x: 200 })
    expect(driver.played).toHaveLength(1)
    expect(driver.played[0]!.stopped).toBe(true)
    expect(view.translateX).toBe(200)
    configure({ reducedMotion: 'never' })
    animate(view, { x: 300 })
    expect(driver.played).toHaveLength(2)
  })

  it('leaves loops and attention presets at rest', async () => {
    configure({ reducedMotion: 'always' })
    const view = createView()
    view.translateX = 5
    expect(await animate(view, 'shake')).toBe(true)
    expect(view.translateX).toBe(5)
    const loop = animate(
      view,
      { y: [0, 10, -10, 0] },
      { duration: 400, repeat: Infinity },
    )
    expect(await loop).toBe(true)
    expect(view.translateY).toBe(0)
    const back = animate(
      view,
      { rotate: [0, 90] },
      { duration: 200, repeat: 1, repeatType: 'reverse' },
    )
    expect(await back).toBe(true)
    expect(view.rotate).toBe(0)
    expect(driver.played).toHaveLength(0)
  })

  it('lands decay on its projected stop', async () => {
    const view = createView()
    decay(view, { x: 1000 })
    const landing = driver.last('x').track.to
    configure({ reducedMotion: 'always' })
    const other = createView()
    expect(await decay(other, { x: 1000 })).toBe(true)
    expect(other.translateX).toBeCloseTo(landing)
    const snapped = createView()
    expect(await decay(snapped, { x: 1000 }, { snap: [0, 300, 900] })).toBe(true)
    expect(snapped.translateX).toBe(
      Math.abs(landing - 300) < Math.abs(landing - 900) ? 300 : 900,
    )
    expect(driver.played).toHaveLength(1)
  })

  it('jumps motion paths to their end pose', async () => {
    configure({ reducedMotion: 'always' })
    const view = createView()
    const flight = animate(
      view,
      { path: 'M0 0 L100 50', orient: true },
      { duration: 1000 },
    )
    expect(await flight).toBe(true)
    expect(driver.played).toHaveLength(0)
    expect(view.translateX).toBe(100)
    expect(view.translateY).toBe(50)
    expect(view.rotate).toBeCloseTo(26.565, 2)
  })

  it('snaps press feedback and moves sequences on immediately', async () => {
    configure({ reducedMotion: 'always' })
    const button = createView()
    press(button)
    button.touch('down')
    expect(button.scaleX).toBe(0.96)
    button.touch('up')
    expect(button.scaleX).toBe(1)
    expect(driver.played).toHaveLength(0)
    const a = createView()
    const b = createView()
    const steps = sequence([
      [a, { x: 100 }, { duration: 300 }],
      [[b, a], 'fadeInUp', { stagger: 100 }],
    ])
    await flush()
    expect(a.translateX).toBe(100)
    expect(b.translateY).toBe(0)
    expect(driver.played.map((p) => p.track.property)).toEqual(['opacity', 'opacity'])
    driver.advance(1000)
    expect(await steps).toBe(true)
  })

  it('keeps the time scale for what still animates', () => {
    configure({ timeScale: 0.5, reducedMotion: 'always' })
    animate(createView(), { x: 100, opacity: 0 }, { duration: 300 })
    expect(driver.played).toHaveLength(1)
    expect(driver.last('opacity').track.duration).toBe(600)
  })
})

describe('reading and watching reduced motion', () => {
  it('follows the platform with user and overrides it with always and never', () => {
    expect(reducedMotion()).toBe(false)
    driver.reduced = true
    expect(reducedMotion()).toBe(true)
    configure({ reducedMotion: 'never' })
    expect(reducedMotion()).toBe(false)
    driver.reduced = false
    configure({ reducedMotion: 'always' })
    expect(reducedMotion()).toBe(true)
  })

  it('calls back when the platform setting or configure() changes the value', () => {
    const seen: boolean[] = []
    const off = onReducedMotion((reduced) => seen.push(reduced))

    driver.setReduced(true)
    driver.setReduced(true)
    configure({ reducedMotion: 'user' })
    configure({ reducedMotion: 'never' })
    driver.setReduced(false)
    configure({ reducedMotion: 'always' })

    expect(seen).toEqual([true, false, true])
    off()
  })

  it('watches the platform only while someone listens', () => {
    const first = onReducedMotion(() => {})
    const second = onReducedMotion(() => {})
    expect(driver.watchers.size).toBe(1)

    first()
    first()
    expect(driver.watchers.size).toBe(1)
    second()
    expect(driver.watchers.size).toBe(0)
  })

  it('stops calling back after cleanup, even for the same callback added twice', () => {
    const seen: boolean[] = []
    const callback = (reduced: boolean) => seen.push(reduced)
    const off = onReducedMotion(callback)
    const again = onReducedMotion(callback)

    driver.setReduced(true)
    off()
    driver.setReduced(false)
    again()
    driver.setReduced(true)

    expect(seen).toEqual([true, true, false])
  })

  it('starts from the value at subscription time', () => {
    driver.reduced = true
    const seen: boolean[] = []
    const off = onReducedMotion((reduced) => seen.push(reduced))

    driver.setReduced(true)
    driver.setReduced(false)

    expect(seen).toEqual([false])
    off()
  })

  it('rejects anything but a callback', () => {
    expect(() => onReducedMotion(undefined as never)).toThrow(TypeError)
    expect(driver.watchers.size).toBe(0)
  })
})
