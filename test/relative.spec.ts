import { describe, expect, it } from 'vitest'
import {
  animate,
  definePreset,
  presets,
  sequence,
  stop,
  type Preset,
} from '../src/index.js'
import type { Property } from '../src/properties.js'
import { createView, driver, flush } from './helpers.js'

declare module '@rafaelaugusto/jolt' {
  interface Presets {
    relativeNudge: true
  }
}

const attention = [
  { name: 'shake', frames: { x: [40, 30, 50, 32, 48, 36, 44, 40] } },
  { name: 'bounce', frames: { y: [80, 62, 80, 72, 80] } },
  { name: 'wiggle', frames: { rotate: [30, 22, 38, 25, 35, 30] } },
  { name: 'pulse', frames: { scaleX: [2, 2.12, 2], scaleY: [0.5, 0.53, 0.5] } },
  {
    name: 'heartbeat',
    frames: {
      scaleX: [2, 2.3, 2, 2.3, 2, 2],
      scaleY: [0.5, 0.575, 0.5, 0.575, 0.5, 0.5],
    },
  },
  {
    name: 'jelly',
    frames: {
      scaleX: [2, 2.5, 1.5, 2.3, 1.9, 2.1, 2],
      scaleY: [0.5, 0.375, 0.625, 0.425, 0.525, 0.475, 0.5],
    },
  },
  { name: 'flash', frames: { opacity: [0.4, 0, 0.4, 0, 0.4] } },
  {
    name: 'tada',
    frames: {
      scaleX: [2, 1.8, 1.8, 2.2, 2.2, 2.2, 2.2, 2.2, 2.2, 2.2, 2],
      scaleY: [0.5, 0.45, 0.45, 0.55, 0.55, 0.55, 0.55, 0.55, 0.55, 0.55, 0.5],
      rotate: [30, 27, 27, 33, 27, 33, 27, 33, 27, 33, 30],
    },
  },
  { name: 'spin', frames: { rotate: [30, 390] } },
] as const

describe('attention presets', () => {
  it.each(attention)(
    '$name starts from the view’s current values',
    async ({ name, frames }) => {
      const view = createView()
      Object.assign(view, {
        translateX: 40,
        translateY: 80,
        scaleX: 2,
        scaleY: 0.5,
        opacity: 0.4,
        rotate: 30,
      })
      const animation = animate(view, name)
      const preset: Preset = presets[name]
      const times = 'times' in preset.transition ? preset.transition.times : undefined

      for (const [property, values] of Object.entries(frames) as [
        Property,
        readonly number[],
      ][]) {
        const track = driver.last(property).track
        values.forEach((value, i) => {
          const time = times?.[i] ?? i / (values.length - 1)
          expect(track.valueAt(time * track.duration)).toBeCloseTo(value)
        })
        expect(track.to).toBeCloseTo(values.at(-1)!)
      }

      driver.advance(2000)
      expect(await animation).toBe(true)
    },
  )

  it('can opt back into absolute preset keyframes', () => {
    const view = createView()
    view.scaleX = 2
    view.scaleY = 0.5

    animate(view, 'pulse', { relative: false })

    expect(driver.last('scaleX').track.values[0]).toBe(1)
    expect(driver.last('scaleY').track.to).toBe(1)
  })

  it('resolves each target separately and repeats without accumulating offsets', async () => {
    const first = createView()
    const second = createView()
    first.translateX = 40
    second.translateX = -20
    const animation = animate([first, second], 'shake', {
      delay: 50,
      stagger: 100,
      repeat: 1,
    })

    for (const [view, base, delay] of [
      [first, 40, 50],
      [second, -20, 150],
    ] as const) {
      const track = driver.last('x', view).track
      expect(track.delay).toBe(delay)
      expect(track.valueAt(delay - 1)).toBe(base)
      expect(track.valueAt(delay + track.duration + track.duration / 7)).toBeCloseTo(
        base - 10,
      )
      expect(track.to).toBe(base)
    }

    driver.advance(1200)
    expect(await animation).toBe(true)
  })

  it('takes over from the current position instead of the previous target', async () => {
    const view = createView()
    view.translateX = 40
    const previous = animate(view, { x: 140 }, { duration: 100, ease: 'linear' })
    driver.advance(25)

    const shake = animate(view, 'shake')

    expect(driver.last('x').track.values[0]).toBe(65)
    expect(driver.last('x').track.to).toBe(65)
    expect(await previous).toBe(false)

    driver.advance(500)
    expect(await shake).toBe(true)
    expect(view.translateX).toBe(65)
  })

  it('commits the current offset when stopped', async () => {
    const view = createView()
    view.translateX = 40
    const animation = animate(view, 'shake')
    driver.advance(500 / 7)

    stop(view, ['x'])

    expect(view.translateX).toBeCloseTo(30)
    expect(await animation).toBe(false)
  })
})

describe('relative keyframes', () => {
  it('keeps ordinary keyframes absolute unless opted in', () => {
    const view = createView()
    view.translateX = 40
    view.scaleX = 2

    animate(view, { x: 20, scaleX: 1.1 }, { duration: 100, ease: 'linear' })

    expect(driver.last('x').track.values).toEqual([40, 20])
    expect(driver.last('scaleX').track.values).toEqual([2, 1.1])
  })

  it('adds offsets, multiplies factors and keeps null as the current value', () => {
    const view = createView()
    Object.assign(view, {
      translateX: 40,
      scaleX: 2,
      scaleY: -0.5,
      opacity: 0.4,
      rotateX: 15,
      rotateY: -20,
    })

    animate(
      view,
      {
        x: [null, -10, 10, 0],
        scale: [null, 1.1, 1],
        opacity: [1, 0, 1],
        rotateX: [0, 10, 0],
        rotateY: [0, -10, 0],
      },
      { relative: true, duration: 100, ease: 'linear' },
    )

    expect(driver.last('x').track.values).toEqual([40, 30, 50, 40])
    expect(driver.last('scaleX').track.values).toEqual([2, 2.2, 2])
    expect(driver.last('scaleY').track.values).toEqual([-0.5, -0.55, -0.5])
    expect(driver.last('opacity').track.values).toEqual([0.4, 0, 0.4])
    expect(driver.last('rotateX').track.values).toEqual([15, 25, 15])
    expect(driver.last('rotateY').track.values).toEqual([-20, -30, -20])
  })

  it('uses the presented value and carries velocity into a relative spring target', async () => {
    const view = createView()
    const previous = animate(view, { x: 100 }, { duration: 100, ease: 'linear' })
    driver.advance(25)
    driver.presented = () => 23

    animate(view, { x: 20 }, { relative: true, type: 'spring' })
    const next = driver.last('x').track

    expect(next.values[0]).toBe(23)
    expect(next.to).toBe(43)
    expect(next.velocityAt(0.01)).toBeCloseTo(1000, -1)
    expect(await previous).toBe(false)
  })

  it('waits until load to resolve offsets without applying them twice', async () => {
    const view = createView().unload()
    view.translateX = 40
    const animation = animate(view, { x: [10, 0] }, { relative: true, duration: 100 })

    expect(view.translateX).toBe(40)
    expect(driver.played).toHaveLength(0)
    view.translateX = 60
    view.load()

    expect(driver.last('x').track.values[0]).toBe(70)
    expect(driver.last('x').track.to).toBe(60)
    driver.advance(100)
    expect(await animation).toBe(true)
  })

  it('keeps custom presets relative when their curve is overridden', () => {
    definePreset('relativeNudge', {
      keyframes: { x: [0, 10, 0] },
      transition: { relative: true, duration: 100 },
    })
    const view = createView()
    view.translateX = 40

    animate(view, 'relativeNudge', { duration: 200, ease: 'linear' })

    expect(driver.last('x').track.values).toEqual([40, 50, 40])
    expect(driver.last('x').track.duration).toBe(200)
  })
})

describe('relative sequence steps', () => {
  it('uses the result of the previous step as its base', async () => {
    const view = createView()
    view.translateX = 40
    const animation = sequence([
      [view, { x: 100 }, { duration: 100, ease: 'linear' }],
      [view, 'shake'],
    ])

    expect(driver.last('x').track.values[0]).toBe(40)
    driver.advance(100)
    await flush()

    expect(driver.last('x').track.values[0]).toBe(100)
    expect(driver.last('x').track.to).toBe(100)
    driver.advance(500)
    expect(await animation).toBe(true)
  })

  it('leaves a later target moving until its relative step begins', async () => {
    const lead = createView()
    const view = createView()
    view.translateX = 40
    const previous = animate(view, { x: 140 }, { duration: 200, ease: 'linear' })
    const playing = driver.last('x')
    const animation = sequence([
      [lead, 'fadeIn', { duration: 100 }],
      [view, { x: [10, 0] }, { relative: true, duration: 100, ease: 'linear' }],
    ])

    expect(playing.stopped).toBe(false)
    driver.advance(100)
    await flush()

    expect(await previous).toBe(false)
    expect(driver.last('x').track.values).toEqual([100, 90])
    driver.advance(100)
    expect(await animation).toBe(true)
  })
})
