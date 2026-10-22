import { describe, expect, it } from 'vitest'
import { animate, bind, motionValue, playbackProgress, set } from '../src/index.js'
import { Application } from './shims/core.js'
import { createView, driver, flush, state } from './helpers.js'

describe('observable playback progress', () => {
  it('keeps an explicitly paused view through a background unload, but cancels navigation unloads', async () => {
    const view = createView(),
      animation = animate(view, { x: 100 }, { duration: 1000, ease: 'linear' })
    const progress = playbackProgress(animation)
    driver.advance(200)
    animation.pause()
    try {
      Application.suspended = true
      view.notify({ eventName: 'unloaded', object: view })
      driver.advance(500)
      expect(progress.get()).toBeCloseTo(0.2)
    } finally {
      Application.suspended = false
    }
    view.notify({ eventName: 'loaded', object: view })
    animation.play()
    driver.advance(800)
    await expect(animation.finished).resolves.toBe(true)
    const navigated = animate(view, { x: 0 }, { duration: 1000 })
    navigated.pause()
    view.notify({ eventName: 'unloaded', object: view })
    await expect(navigated.finished).resolves.toBe(false)
  })
  it('exposes a requested position before target load', () => {
    const view = createView()
    view.isLoaded = false
    const animation = animate(view, { x: 100 }, { duration: 1000 })
    const value = playbackProgress(animation)
    animation.pause()
    animation.progress = 0.6
    expect(value.get()).toBe(0.6)
    view.isLoaded = true
    view.notify({ eventName: 'loaded', object: view })
    expect(value.get()).toBeCloseTo(0.6)
    animation.stop()
  })
  it('binds and subscribes to the original clock through pause, resume and seek', async () => {
    const animation = animate(
      createView(),
      { x: 100 },
      { duration: 1000, ease: 'linear' },
    )
    const progress = playbackProgress(animation)
    const bar = createView()
    const offBind = bind(bar, { scaleX: progress })
    expect(driver.frames.size).toBe(0)
    const seen: number[] = []
    const off = progress.subscribe((value) => seen.push(value))
    driver.advance(250)
    expect(progress.get()).toBeCloseTo(0.25)
    expect(seen.at(-1)).toBeCloseTo(0.25)
    animation.pause()
    driver.advance(600)
    expect(progress.get()).toBeCloseTo(0.25)
    expect(bar.scaleX).toBeCloseTo(0.25)
    expect(driver.frames.size).toBe(0)
    animation.progress = 0.7
    driver.advance(16)
    expect(progress.get()).toBeCloseTo(0.7)
    expect(bar.scaleX).toBeCloseTo(0.7)
    animation.play()
    expect(driver.last('scaleX').offset).toBeCloseTo(700)
    driver.advance(300)
    await expect(animation.finished).resolves.toBe(true)
    expect(progress.get()).toBe(1)
    expect(seen.at(-1)).toBe(1)
    expect(driver.frames.size).toBe(0)
    off()
    offBind()
  })

  it('samples nonlinear and color derivations for native consumers', () => {
    const animation = animate(
      createView(),
      { x: 100 },
      { duration: 1000, ease: 'linear' },
    )
    const value = playbackProgress(animation)
    const view = createView()
    const off = bind(view, {
      opacity: value.to([0, 0.5, 1], [0, 1, 0]),
      backgroundColor: value.to([0, 1], ['black', 'white']),
    })
    expect(driver.last('opacity').track.values).toContain(1)
    expect(driver.last('backgroundColor').track.values.length).toBeGreaterThan(2)
    expect(driver.frames.size).toBe(0)
    off()
    animation.stop()
  })

  it('retains cancellation position and rejects endless or non-playback handles', async () => {
    const animation = animate(
      createView(),
      { x: 100 },
      { duration: 1000, ease: 'linear' },
    )
    const value = playbackProgress(animation)
    driver.advance(320)
    animation.stop()
    driver.advance(1000)
    expect(value.get()).toBeCloseTo(0.32)
    await expect(animation.finished).resolves.toBe(false)
    const loop = animate(
      createView(),
      { x: [0, 100] },
      { duration: 1000, repeat: Infinity },
    )
    expect(() => playbackProgress(loop)).toThrow(/finite/)
    loop.stop()
  })

  it('waits for unloaded views and follows total duration of staggered playback', async () => {
    const first = createView(),
      second = createView()
    first.isLoaded = false
    const animation = animate(
      [first, second],
      { x: 100 },
      { duration: 1000, stagger: 200, ease: 'linear' },
    )
    const value = playbackProgress(animation)
    expect(value.get()).toBe(0)
    first.isLoaded = true
    first.notify({ eventName: 'loaded', object: first })
    driver.advance(600)
    expect(value.get()).toBeCloseTo(0.5)
    animation.pause()
    driver.advance(400)
    expect(value.get()).toBeCloseTo(0.5)
    animation.stop()
    await flush()
  })

  it('uses whole playback time for delays and reverse repeats, independent of easing', () => {
    const animation = animate(
      createView(),
      { x: [0, 100] },
      { duration: 1000, delay: 200, repeat: 1, repeatType: 'reverse' },
    )
    const value = playbackProgress(animation)
    driver.advance(1100)
    expect(value.get()).toBeCloseTo(0.5)
    animation.stop()
    const instant = animate(createView(), { x: 100 }, { duration: 0 })
    expect(playbackProgress(instant).get()).toBe(1)
  })
})

describe('motion value playback controls', () => {
  it('holds one channel while the other layers continue', async () => {
    const value = motionValue(0)
    const base = animate(value, 100, { duration: 1000, ease: 'linear' })
    const layer = animate(value, 20, { duration: 1000, ease: 'linear', layer: 'pulse' })
    driver.advance(250)
    base.pause()
    driver.advance(250)
    expect(value.get()).toBeCloseTo(35)
    expect(base.progress).toBeCloseTo(0.25)
    layer.pause()
    driver.advance(500)
    expect(value.get()).toBeCloseTo(35)
    base.progress = 0.5
    expect(value.get()).toBeCloseTo(60)
    base.play()
    layer.play()
    driver.advance(500)
    expect(value.get()).toBeCloseTo(120)
    await expect(base.finished).resolves.toBe(true)
    await expect(layer.finished).resolves.toBe(true)
  })

  it('keeps paused completion pending and removes a stopped layer while preserving the base', async () => {
    const value = motionValue(10)
    const animation = animate(value, 20, {
      layer: 'pulse',
      duration: 1000,
      ease: 'linear',
    })
    const done = state(animation.finished)
    animation.pause()
    animation.progress = 1
    driver.advance(2000)
    await flush()
    expect(done()).toBeUndefined()
    animation.progress = 0.5
    animation.stop()
    expect(value.get()).toBeCloseTo(10)
    await expect(animation.finished).resolves.toBe(false)
    set(value, 0)
  })

  it('resumes bindings at the same source phase and supports observing its handle', () => {
    const value = motionValue(0)
    const animation = animate(value, 100, { duration: 1000, ease: 'linear' })
    const progress = playbackProgress(animation)
    const view = createView()
    const off = bind(view, { x: value })
    driver.advance(300)
    animation.pause()
    driver.advance(500)
    expect(view.translateX).toBeCloseTo(30)
    animation.play()
    expect(driver.last('x').offset).toBeCloseTo(300)
    expect(progress.get()).toBeCloseTo(0.3)
    animation.stop()
    off()
  })
})
