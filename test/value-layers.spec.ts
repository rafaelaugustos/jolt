import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  animate,
  bind,
  configure,
  drag,
  motionScope,
  motionValue,
  set,
  stop,
} from '../src/index.js'
import { createView, driver } from './helpers.js'

const cleanup: (() => void)[] = []
const value = (initial = 0) => {
  const result = motionValue(initial)
  cleanup.push(() => stop(result))
  return result
}
afterEach(() => {
  for (const off of cleanup.splice(0).reverse()) off()
})
const linear = { duration: 400, ease: 'linear' } as const

describe('layers on motion values', () => {
  it('catches up after native track construction rather than seeking to a stale phase', () => {
    const progress = value(),
      first = createView(),
      second = createView()
    const play = driver.play.bind(driver)
    vi.spyOn(driver, 'play').mockImplementation((...args) => {
      const result = play(...args)
      driver.time += 80 // native keyframe allocation takes time
      return result
    })
    bind(first, { x: progress })
    bind(second, { x: progress })
    animate(progress, 100, { duration: 1000, ease: 'linear' })
    expect(driver.last('x', first).offset).toBe(80)
    expect(driver.last('x', second).offset).toBe(160)
    expect(progress.get()).toBe(16)
  })

  it('keeps the base on its original clock when an additive layer starts and stops', async () => {
    const progress = value()
    const base = animate(progress, 100, linear)
    driver.advance(100)
    const pulse = animate(progress, 20, { ...linear, layer: 'pulse' })
    driver.advance(100)
    expect(progress.get()).toBeCloseTo(55)
    stop(progress, { layer: 'pulse' })
    expect(await pulse).toBe(false)
    expect(progress.get()).toBeCloseTo(50)
    driver.advance(200)
    expect(await base).toBe(true)
    expect(progress.get()).toBe(100)
  })

  it('composes before clamped piecewise mappings for all consumers', () => {
    const progress = value(0.5)
    const mapped = progress.to([0, 0.5, 1], [0, 10, 100])
    const clamped = progress.to([0, 1], [0, 1])
    const tint = clamped.to([0, 1], ['black', 'white'])
    const first = createView(),
      second = createView()
    bind(first, { x: mapped, opacity: clamped, backgroundColor: tint })
    bind(second, { scale: mapped })
    const listener = vi.fn()
    cleanup.push(progress.subscribe(listener))
    animate(progress, 1, linear)
    animate(progress, 0.5, { ...linear, layer: 'pulse' })
    driver.advance(200)
    expect(progress.get()).toBeCloseTo(1)
    expect(listener.mock.lastCall![0]).toBeCloseTo(1)
    expect(mapped.get()).toBe(100)
    expect(driver.last('x', first).track.valueAt(200)).toBe(100)
    expect(driver.last('scaleX', second).track.valueAt(200)).toBe(100)
    expect(driver.last('opacity', first).track.valueAt(200)).toBe(1)
    expect(driver.last('backgroundColor', first).track.valueAt(200) >>> 0).toBe(
      tint.get().argb >>> 0,
    )
    expect(driver.last('x', first).track.values.every((x) => x <= 100)).toBe(true)
  })

  it('replaces a layer continuously with only that layer velocity', async () => {
    const combined = value(10),
      base = value(10),
      pulse = value()
    animate(combined, 100, { duration: 2000, ease: 'linear' })
    animate(base, 100, { duration: 2000, ease: 'linear' })
    const old = animate(combined, 30, { ...linear, layer: 'pulse' })
    animate(pulse, 30, linear)
    driver.advance(100)
    const before = combined.get()
    animate(combined, -30, { type: 'spring', duration: 500, bounce: 0.3, layer: 'pulse' })
    animate(pulse, -30, { type: 'spring', duration: 500, bounce: 0.3 })
    expect(await old).toBe(false)
    expect(combined.get()).toBeCloseTo(before)
    for (let i = 0; i < 20; i++) {
      driver.advance(20)
      expect(combined.get()).toBeCloseTo(base.get() + pulse.get())
    }
  })

  it('holds a completed layer until removed and can fade it back to neutral', async () => {
    const progress = value(5)
    await animate(progress, 3, { duration: 0, layer: 'pulse' })
    expect(progress.get()).toBe(8)
    const release = animate(progress, 0, { ...linear, layer: 'pulse' })
    driver.advance(200)
    expect(progress.get()).toBeCloseTo(6.5)
    driver.advance(200)
    expect(await release).toBe(true)
    expect(progress.get()).toBe(5)
    stop(progress, { layer: 'pulse' })
    expect(progress.get()).toBe(5)
  })

  it('stops just the channel owned by an animation handle', async () => {
    const progress = value()
    const base = animate(progress, 100, linear)
    const layer = animate(progress, 20, { ...linear, layer: 'pulse' })
    driver.advance(100)
    base.stop()
    expect(await base).toBe(false)
    driver.advance(100)
    expect(progress.get()).toBeCloseTo(35)
    layer.stop()
    expect(await layer).toBe(false)
    expect(progress.get()).toBeCloseTo(25)
  })

  it('freezes the composition with stop and clears every layer with set', async () => {
    const progress = value()
    const base = animate(progress, 100, linear)
    const pulse = animate(progress, 20, { ...linear, layer: 'pulse' })
    driver.advance(100)
    stop(progress)
    expect(await base).toBe(false)
    expect(await pulse).toBe(false)
    expect(progress.get()).toBeCloseTo(30)
    stop(progress, { layer: 'pulse' })
    expect(progress.get()).toBeCloseTo(30)
    animate(progress, 2, { ...linear, layer: 'pulse', repeat: Infinity })
    set(progress, 9)
    driver.advance(5000)
    expect(progress.get()).toBe(9)
  })

  it('combines infinite periods in one native loop after the finite base ends', () => {
    const progress = value(),
      view = createView()
    bind(view, { x: progress })
    animate(progress, 100, { duration: 1000, ease: 'linear' })
    animate(progress, [0, 10], {
      ...linear,
      layer: 'one',
      repeat: Infinity,
      repeatType: 'reverse',
    })
    animate(progress, [0, 20], {
      duration: 600,
      ease: 'linear',
      layer: 'two',
      repeat: Infinity,
      repeatType: 'reverse',
    })
    driver.advance(1000)
    const track = driver.last('x', view).track
    expect(track.duration).toBe(2400)
    expect(track.repeat).toBe(Infinity)
    const played = driver.played.length
    for (const ms of [16, 100, 300, 2500]) {
      driver.advance(ms)
      expect(track.valueAt(driver.now() - driver.last('x', view).startedAt)).toBeCloseTo(
        progress.get(),
      )
    }
    expect(driver.played).toHaveLength(played)
    expect(driver.frames.size).toBe(0)
  })

  it.each([
    [701, 709],
    [400.5, 600.25],
  ])('refreshes windows without phase drift for periods %j', (a, b) => {
    const progress = value(),
      first = value(),
      second = value(),
      view = createView()
    bind(view, { x: progress })
    animate(progress, [0, 10], {
      duration: a,
      ease: 'linear',
      repeat: Infinity,
      layer: 'one',
    })
    animate(progress, [0, 20], {
      duration: b,
      ease: 'linear',
      repeat: Infinity,
      layer: 'two',
    })
    animate(first, [0, 10], { duration: a, ease: 'linear', repeat: Infinity })
    animate(second, [0, 20], { duration: b, ease: 'linear', repeat: Infinity })
    expect(driver.last('x', view).track.duration).toBe(4000)
    for (const ms of [1000, 3000, 120, 3880, 16]) {
      driver.advance(ms)
      expect(progress.get()).toBeCloseTo(first.get() + second.get())
      const native = driver.last('x', view)
      expect(native.track.valueAt(driver.now() - native.startedAt)).toBeCloseTo(
        progress.get(),
      )
    }
    expect(driver.frames.size).toBe(0)
  })

  it('preserves short pulses over a minutes-long finite base without undersampling', () => {
    const progress = value(),
      view = createView()
    bind(view, { x: progress })
    animate(progress, 100, { duration: 240_000, ease: 'linear' })
    animate(progress, [0, 10, 0], {
      duration: 200,
      ease: 'linear',
      repeat: 99,
      layer: 'pulse',
    })
    const first = driver.last('x', view).track
    expect(first.duration).toBe(4000)
    expect(first.times.length).toBe(241)
    // The uploaded samples must retain the first 100 ms peak, not just valueAt().
    const peak = first.times.findIndex(
      (time) => Math.abs(time * first.duration - 100) < 0.001,
    )
    expect(first.values[peak]).toBeCloseTo(10 + 100 / 2400)
    driver.advance(4100)
    const next = driver.last('x', view).track
    expect(next.duration).toBe(4000)
    expect(next.values[0]).toBeCloseTo(progress.get())
    expect(driver.frames.size).toBe(0)
  })

  it('lets a late view join and follow the base after layer completion', () => {
    const progress = value(),
      view = createView().unload()
    bind(view, { x: progress })
    animate(progress, 100, { ...linear, duration: 1000 })
    animate(progress, 20, { ...linear, layer: 'pulse' })
    driver.advance(200)
    view.load()
    expect(driver.last('x', view).offset).toBe(200)
    expect(driver.last('x', view).track.valueAt(200)).toBeCloseTo(30)
    driver.advance(300)
    expect(progress.get()).toBeCloseTo(70)
    const native = driver.last('x', view)
    expect(native.track.valueAt(native.offset ?? 0)).toBeCloseTo(70)
  })

  it('retains layers while drag controls the base and releases to a base snap point', async () => {
    const progress = value(),
      view = createView()
    const pulse = animate(progress, [0, 10], {
      ...linear,
      layer: 'pulse',
      repeat: Infinity,
      repeatType: 'reverse',
    })
    const controller = drag(view, {
      axis: 'x',
      value: progress,
      bounds: { left: 0, right: 100 },
      snap: [0, 100],
    })
    cleanup.push(() => controller.dispose())
    view.touch('down')
    view.notify({ eventName: 'pan', object: view, state: 1, deltaX: 0, deltaY: 0 })
    driver.advance(100)
    view.notify({ eventName: 'pan', object: view, state: 2, deltaX: 80, deltaY: 0 })
    expect(controller.position.x).toBeCloseTo(80)
    expect(progress.get()).toBeCloseTo(82.5)
    view.notify({ eventName: 'pan', object: view, state: 3, deltaX: 80, deltaY: 0 })
    driver.advance(5000)
    expect(controller.position.x).toBe(100)
    expect(progress.get()).toBeGreaterThan(100)
    pulse.stop()
    expect(await pulse).toBe(false)
    expect(progress.get()).toBe(100)
  })

  it('applies time scale once and honors reduced motion in mapped bindings', () => {
    configure({ timeScale: 0.5, reducedMotion: 'always' })
    const progress = value(),
      view = createView()
    bind(view, { x: progress.to([0, 2], [0, 100]), opacity: progress.to([0, 2], [0, 1]) })
    animate(progress, 1, linear)
    animate(progress, 1, { ...linear, layer: 'pulse' })
    expect(view.translateX).toBe(100)
    expect(driver.played.some(({ track }) => track.property === 'x')).toBe(false)
    expect(driver.last('opacity', view).track.duration).toBe(800)
    driver.advance(200)
    expect(progress.get()).toBeCloseTo(0.5)
  })

  it('disposes owned layers and validates options before interruption', () => {
    const progress = value(),
      scope = motionScope()
    scope.animate(progress, 100, linear)
    scope.animate(progress, 20, { ...linear, layer: 'pulse' })
    for (const layer of ['', null, 4])
      expect(() => animate(progress, 9, { layer } as never)).toThrow(/nonempty string/)
    expect(() => stop(progress, { layer: '' })).toThrow(/nonempty string/)
    driver.advance(100)
    expect(progress.get()).toBeCloseTo(30)
    scope.dispose()
    driver.advance(1000)
    expect(progress.get()).toBeCloseTo(25)
    expect(driver.frames.size).toBe(0)
  })
})
