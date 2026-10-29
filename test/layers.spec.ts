import { describe, expect, it, vi } from 'vitest'
import {
  animate,
  bind,
  configure,
  motionValue,
  sequence,
  set,
  stop,
} from '../src/index.js'
import { currentValue, setBase } from '../src/engine.js'
import { createView, driver } from './helpers.js'

const linear = (duration: number) => ({ duration, ease: 'linear' }) as const

describe('layers', () => {
  it('catches the composite up after native keyframe allocation', () => {
    const card = createView()
    const play = driver.play.bind(driver)
    vi.spyOn(driver, 'play').mockImplementation((...args) => {
      const handle = play(...args)
      driver.time += 80
      return handle
    })
    animate(
      card,
      { x: [0, 10, 0] },
      { ...linear(900), repeat: Infinity, layer: 'wobble' },
    )
    animate(
      card,
      { x: [0, 20, 0] },
      { ...linear(1600), repeat: Infinity, layer: 'pulse' },
    )
    const latest = driver.last('x')
    expect(latest.offset).toBe(80)
    expect(latest.track.valueAt(latest.offset!)).toBeCloseTo(currentValue(card, 'x'))
  })
  it('add translations to the animation underneath on one native track', async () => {
    const card = createView()
    const move = animate(card, { x: [0, 100] }, linear(400))
    const nudge = animate(card, { x: [0, 20] }, { ...linear(300), layer: 'feedback' })

    const composite = driver.last('x').track
    expect(composite.valueAt(0)).toBeCloseTo(0)
    expect(composite.valueAt(150)).toBeCloseTo(37.5 + 10)
    expect(composite.valueAt(300)).toBeCloseTo(75 + 20)

    driver.advance(300)
    expect(await nudge).toBe(true)
    driver.advance(100)
    expect(await move).toBe(true)
    expect(card.translateX).toBeCloseTo(120)
  })

  it('multiply scale and opacity', () => {
    const card = createView()
    set(card, { scale: 2, opacity: 0.5 })
    animate(
      card,
      { scale: [1, 1.2], opacity: [1, 0.5] },
      { ...linear(200), layer: 'pulse' },
    )

    expect(driver.last('scaleX').track.valueAt(200)).toBeCloseTo(2.4)
    expect(driver.last('opacity').track.valueAt(200)).toBeCloseTo(0.25)
  })

  it('keep running when the animation underneath is replaced, which inherits its own velocity', () => {
    const card = createView()
    animate(card, { x: [0, 100] }, linear(400))
    animate(card, { x: [0, 10, 0] }, { ...linear(1000), layer: 'wobble' })
    driver.advance(200)

    animate(card, { x: 0 }, 'snappy')
    const composite = driver.last('x').track
    expect(composite.valueAt(0)).toBeCloseTo(50 + 4)
    expect(composite.velocityAt(0)).toBeGreaterThan(0)
  })

  it('end with their own animation and leave a plain property behind', async () => {
    const card = createView()
    const shake = animate(card, 'shake', { layer: 'feedback' })
    driver.advance(1000)
    expect(await shake).toBe(true)
    expect(card.translateX).toBeCloseTo(0)

    animate(card, { x: 50 }, linear(100))
    expect(driver.last('x').track.values[0]).toBe(0)
    expect(driver.last('x').track.to).toBe(50)
  })

  it('stop one layer and take away what it adds', async () => {
    const card = createView()
    set(card, { x: 40 })
    const lift = animate(card, { y: -8 }, { ...linear(200), layer: 'hover' })
    const shake = animate(card, { x: [0, 30] }, { ...linear(400), layer: 'feedback' })
    driver.advance(200)
    expect(await lift).toBe(true)
    expect(card.translateY).toBeCloseTo(-8)

    stop(card, ['x'], { layer: 'feedback' })
    expect(await shake).toBe(false)
    expect(card.translateX).toBeCloseTo(40)

    stop(card, undefined, { layer: 'hover' })
    expect(card.translateY).toBeCloseTo(0)
  })

  it('stop everything and keep what is on screen as the new value', async () => {
    const card = createView()
    const move = animate(card, { x: [0, 100] }, linear(400))
    const nudge = animate(card, { x: [0, 20] }, { ...linear(400), layer: 'feedback' })
    driver.advance(200)

    stop(card)
    expect(await move).toBe(false)
    expect(await nudge).toBe(false)
    expect(card.translateX).toBeCloseTo(60)
    animate(card, { x: 0 }, linear(100))
    expect(driver.last('x').track.values[0]).toBeCloseTo(60)
  })

  it('loop two endless layers over the least common multiple of their periods', () => {
    const card = createView()
    const loop = { ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' } as const
    animate(card, { rotate: [-5, 5] }, { ...loop, duration: 900, layer: 'sway' })
    animate(card, { rotate: [-2, 2] }, { ...loop, duration: 1600, layer: 'wobble' })

    const composite = driver.last('rotate').track
    expect(composite.repeat).toBe(Infinity)
    expect(composite.duration).toBe(28800)
    expect(composite.valueAt(0)).toBeCloseTo(-7)
    expect(composite.valueAt(28800)).toBeCloseTo(-7)
  })

  it('switch from a finite window to a native loop when the finite part ends', () => {
    const card = createView()
    animate(
      card,
      { scale: [1, 1.1] },
      {
        duration: 500,
        repeat: Infinity,
        repeatType: 'reverse',
        layer: 'breathe',
      },
    )
    animate(card, { scale: [0.5, 1] }, linear(300))
    expect(driver.last('scaleX').track.repeat).toBe(0)

    driver.advance(300)
    const loop = driver.last('scaleX').track
    expect(loop.repeat).toBe(Infinity)
    expect(loop.duration).toBe(1000)
  })

  it('hold a paused layer while the rest keeps moving', () => {
    const card = createView()
    animate(card, { x: [0, 100] }, linear(400))
    const nudge = animate(card, { x: [0, 40] }, { ...linear(400), layer: 'feedback' })
    driver.advance(100)

    nudge.pause()
    const composite = driver.last('x').track
    expect(composite.valueAt(0)).toBeCloseTo(25 + 10)
    expect(composite.valueAt(100)).toBeCloseTo(50 + 10)
  })

  it('follow a base written from outside, like a drag', () => {
    const card = createView()
    animate(card, { x: [0, 30] }, { ...linear(300), layer: 'feedback' })
    driver.advance(100)

    setBase(card, 'x', 50)
    expect(driver.last('x').track.valueAt(0)).toBeCloseTo(60)
    expect(currentValue(card, 'x')).toBeCloseTo(60)
  })

  it('compose with motion values bound to the same property', () => {
    const offset = motionValue(0)
    const card = createView()
    bind(card, { x: offset })
    animate(card, { x: [0, 10] }, { ...linear(200), layer: 'feedback' })
    animate(offset, 100, linear(200))

    expect(driver.last('x').track.valueAt(200)).toBeCloseTo(110)
  })

  it('jump transforms with reduced motion and still fade opacity', () => {
    configure({ reducedMotion: 'always' })
    const card = createView()
    animate(card, 'shake', { layer: 'feedback' })
    animate(card, { opacity: [1, 0.5, 1] }, { ...linear(300), layer: 'blink' })

    expect(driver.played.map((played) => played.track.property)).toEqual(['opacity'])
    expect(card.translateX).toBe(0)
  })

  it('write no starting values when a sequence step plays on a layer', () => {
    const card = createView().unload()
    sequence([[card, { x: [30, 0] }, { duration: 200, layer: 'feedback' }]])
    expect(card.translateX).toBe(0)
  })

  it('play an entrance, a press and a shake together, and stop the shake alone', async () => {
    const card = createView()
    set(card, { x: 20, scale: 1.5 })
    const entrance = animate(card, { x: [60, 20], opacity: [0, 1] }, linear(600))
    const press = animate(card, { scale: [1, 0.9] }, { ...linear(200), layer: 'press' })
    const shake = animate(
      card,
      { x: [0, -8, 8, 0] },
      { ...linear(300), layer: 'feedback' },
    )
    driver.advance(100)

    expect(currentValue(card, 'x')).toBeCloseTo(60 - (40 * 100) / 600 - 8)
    expect(currentValue(card, 'scaleX')).toBeCloseTo(1.5 * 0.95)

    stop(card, ['x'], { layer: 'feedback' })
    expect(await shake).toBe(false)
    expect(currentValue(card, 'x')).toBeCloseTo(60 - (40 * 100) / 600)
    driver.advance(100)
    expect(await press).toBe(true)
    expect(card.scaleX).toBeCloseTo(1.35)
    driver.advance(400)
    expect(await entrance).toBe(true)
    expect(card.translateX).toBeCloseTo(20)
    expect(card.opacity).toBe(1)
  })

  it('reject colors, decorations, paths and unnamed layers', () => {
    const card = createView()
    expect(() => animate(card, { backgroundColor: 'red' }, { layer: 'tint' })).toThrow(
      /single owner/,
    )
    expect(() => animate(card, { borderRadius: 4 }, { layer: 'round' })).toThrow(
      /single owner/,
    )
    expect(() => animate(card, { path: 'M0 0 L10 10' }, { layer: 'route' })).toThrow(
      /path owns x and y/,
    )
    expect(() => animate(card, { x: 10 }, { layer: '' })).toThrow(/nonempty string/)
  })
})
