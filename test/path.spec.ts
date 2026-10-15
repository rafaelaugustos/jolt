import { describe, expect, it } from 'vitest'
import { animate, sequence, press, scrollLinked, stop } from '../src/index.js'
import type { Keyframes, AnimateOptions } from '../src/index.js'
import type { ScrollView as CoreScrollView } from '@nativescript/core'
import { ScrollView } from './shims/core.js'
import { createView, driver, flush } from './helpers.js'
const curve = 'M0 0 C80 -120 200 -120 280 0'
const linear = { duration: 1200, ease: 'linear' as const }

describe('motion along a path', () => {
  it('uses native translation/rotation tracks with shared key times and endpoints', async () => {
    const view = createView(),
      animation = animate(view, { path: curve, orient: true }, linear)
    const x = driver.last('x').track,
      y = driver.last('y').track,
      r = driver.last('rotate').track
    expect(x.times).toBe(y.times)
    expect(x.times).toBe(r.times)
    expect(x.values.length).toBeGreaterThan(70)
    expect(x.valueAt(600)).toBeCloseTo(140)
    expect(y.valueAt(600)).toBeCloseTo(-90)
    expect(r.valueAt(600)).toBeCloseTo(0, 0)
    expect(view.translateX).toBe(280)
    expect(view.translateY).toBe(0)
    expect(view.rotate).toBeCloseTo(56.3099, 3)
    driver.advance(1200)
    expect(await animation).toBe(true)
  })
  it('applies easing to path progress once, rather than once per sampled segment', () => {
    const animation = animate(
      createView(),
      { path: 'M0 0 L100 0' },
      { duration: 1000, ease: (p) => p * p },
    )
    expect(driver.last('x').track.valueAt(500)).toBeCloseTo(25)
    animation.stop()
  })
  it('defaults even a straight path to a finite 300 ms tween', () => {
    const a = animate(createView(), { path: 'M0 0 L100 0' })
    expect(a.duration).toBe(300)
    expect(driver.played).toHaveLength(2)
    a.stop()
  })
  it('supports path timing overrides and independent properties without distorting the curve', () => {
    const animation = animate(
      createView(),
      { path: curve, opacity: [0, 1], rotate: [0, 90] },
      {
        duration: 300,
        path: { duration: 1200, ease: 'linear' },
        rotate: { duration: 600 },
      },
    )
    expect(driver.last('x').track.valueAt(600)).toBeCloseTo(140)
    expect(driver.last('y').track.valueAt(600)).toBeCloseTo(-90)
    expect(driver.last('opacity').track.duration).toBe(300)
    expect(driver.last('rotate').track.duration).toBe(600)
    animation.stop()
  })
  it('holds endpoints and scrubs backward, preserving a paused pose on interruption', async () => {
    const view = createView(),
      a = animate(view, { path: curve, orient: true }, linear)
    a.pause()
    a.progress = 1
    a.progress = 0.5
    const next = animate(view, { x: 300 }, 'bouncy')
    expect(driver.last('x').track.values[0]).toBeCloseTo(140)
    stop(view, ['y', 'rotate'])
    expect(view.translateY).toBeCloseTo(-90)
    expect(view.rotate).toBeCloseTo(0, 0)
    expect(await a).toBe(false)
    next.stop()
  })
  it('inherits tangential velocity when an ordinary spring takes over', () => {
    const a = animate(
      createView(),
      { path: 'M0 0 L100 0' },
      { duration: 1000, ease: 'linear', repeat: 2 },
    )
    const x = driver.last('x').track
    expect(x.velocityAt(500)).toBeCloseTo(100)
    expect(Math.abs(x.velocityAt(1000))).toBeLessThanOrEqual(101)
    a.stop()
  })
  it('runs springs on shared clamped progress, even for closed paths', () => {
    const a = animate(createView(), { path: 'M0 0 L100 0 L0 0', orient: true }, 'bouncy')
    const x = driver.last('x').track,
      y = driver.last('y').track,
      r = driver.last('rotate').track
    expect(x.values.some((v) => v > 90)).toBe(true)
    expect(x.values.every((v) => v >= 0 && v <= 100)).toBe(true)
    expect(y.duration).toBe(x.duration)
    expect(r.duration).toBe(x.duration)
    expect(x.to).toBe(0)
    a.stop()
  })
  it('includes delay, reverse repeats and stagger in playback and relative offsets', () => {
    const a = createView(),
      b = createView()
    a.translateX = 10
    b.translateX = 50
    const animation = animate(
      [a, b],
      { path: 'M0 0 L100 100', orient: true },
      {
        duration: 1000,
        ease: 'linear',
        delay: 100,
        repeat: 1,
        repeatType: 'reverse',
        stagger: 200,
        relative: true,
      },
    )
    expect(animation.duration).toBe(2300)
    animation.pause()
    animation.progress = 0.5
    stop([a, b])
    expect(a.translateX).toBeCloseTo(105)
    expect(b.translateX).toBeCloseTo(135)
    expect(a.rotate).toBeCloseTo(45)
  })
  it('waits for load, snapshots orientation and captures relative pose when loaded', () => {
    const view = createView()
    view.isLoaded = false
    const frames: Keyframes = { path: 'M0 0 L100 100', orient: true }
    const a = animate(view, frames, { duration: 1000, ease: 'linear', relative: true })
    frames.orient = false
    view.translateX = 30
    view.translateY = 50
    view.rotate = 10
    a.pause()
    a.progress = 0.5
    view.load()
    stop(view)
    expect(view.translateX).toBeCloseTo(80)
    expect(view.translateY).toBeCloseTo(100)
    expect(view.rotate).toBeCloseTo(55)
  })
  it('prepares the first path pose in sequences and allows overlapping arrivals', async () => {
    const a = createView(),
      b = createView()
    const animation = sequence([
      [a, { path: curve, orient: true }, linear],
      [b, 'fadeIn', { at: '-100', duration: 100 }],
    ])
    driver.advance(1100)
    expect(driver.last('opacity').view).toBe(b)
    driver.advance(100)
    expect(await animation).toBe(true)
  })
  it('works with a scroll binding and press cleanup through the generated properties', () => {
    const source = new ScrollView() as ScrollView & CoreScrollView,
      view = createView()
    const unlink = scrollLinked(
      source,
      view,
      { path: curve, orient: true },
      { range: [0, 120] },
    )
    source.notify({ eventName: 'scroll', object: source, scrollX: 0, scrollY: 60 })
    unlink()
    expect(view.translateX).toBeCloseTo(140)
    expect(view.translateY).toBeCloseTo(-90)
    const unpress = press(view, { path: 'M0 0 L100 0', orient: true }, linear)
    const before = view.translateX
    view.touch('down')
    view.touch('up')
    expect(driver.last('x').track.to).toBeCloseTo(before)
    expect(driver.last('rotate').track.to).toBeCloseTo(view.rotate)
    unpress()
  })
  it.each([
    [{ path: curve, x: 1 }, {}],
    [{ path: curve, y: 1 }, {}],
    [{ path: curve, orient: true, rotate: 1 }, {}],
    [{ orient: true }, {}],
    [{ path: curve, orient: 'yes' }, {}],
    [{ path: 'not a path' }, {}],
    [{ path: curve }, { x: { duration: 100 } }],
    [{ path: curve, orient: true }, { rotate: { duration: 100 } }],
    [{ path: curve }, { duration: Infinity }],
  ])('rejects conflicts and invalid input before changing a view', (frames, options) => {
    const view = createView()
    view.translateX = 20
    expect(() => animate(view, frames as Keyframes, options as AnimateOptions)).toThrow()
    expect(view.translateX).toBe(20)
    expect(driver.played).toHaveLength(0)
  })
  it('stops pending paths on unload and does not write from later progress controls', async () => {
    const view = createView(),
      a = animate(view, { path: curve }, linear)
    a.pause()
    a.progress = 0.5
    view.notify({ eventName: 'unloaded', object: view })
    expect(await a).toBe(false)
    a.progress = 0.2
    expect(view.translateX).toBeCloseTo(140)
    await flush()
  })
  it('validates all staggered path plans before taking over any target', () => {
    const a = createView(),
      b = createView()
    a.translateX = 20
    expect(() => animate([a, b], { path: curve }, { stagger: Infinity })).toThrow(
      /delays/,
    )
    expect(a.translateX).toBe(20)
    expect(driver.played).toHaveLength(0)
  })
})
