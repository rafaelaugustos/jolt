import { describe, expect, it } from 'vitest'
import { Color } from '@nativescript/core'
import { animate, sequence, stop } from '../src/index.js'
import { readValue } from '../src/properties.js'
import { createView, driver, flush } from './helpers.js'

const card = () => {
  const view = createView()
  view.borderRadius = 8
  view.borderWidth = 2
  view.borderColor = new Color('#b6ee64')
  view.boxShadow = [
    {
      color: new Color('#80000000'),
      offsetX: 0,
      offsetY: 4,
      blurRadius: 12,
      spreadRadius: 2,
      inset: false,
    },
  ]
  return view
}

describe('border and shadow properties', () => {
  it('commits uniform border geometry and independent shadow endpoints without losing color or spread', async () => {
    const view = card()
    const animation = animate(view, {
      borderRadius: 36,
      borderWidth: 6,
      shadowOpacity: 0.75,
      shadowRadius: 10,
      shadowOffsetX: -4,
      shadowOffsetY: 12,
    })
    expect(view.borderTopRightRadius).toBe(36)
    expect(view.borderLeftWidth).toBe(6)
    expect(view.boxShadow[0]).toEqual({
      color: expect.objectContaining({ argb: 0xbf000000 }),
      offsetX: -4,
      offsetY: 12,
      blurRadius: 20,
      spreadRadius: 2,
      inset: false,
    })
    for (const entry of driver.played) expect(entry.track.duration).toBe(300)
    driver.advance(300)
    expect(await animation).toBe(true)
  })
  it('takes over from the visible radius and selectively freezes width without cancelling motion', async () => {
    const view = card()
    const first = animate(
      view,
      { borderRadius: [8, 48], borderWidth: [2, 10], x: 80 },
      { duration: 1000, ease: 'linear' },
    )
    driver.advance(250)
    const second = animate(view, { borderRadius: 20 }, { duration: 500, ease: 'linear' })
    expect(driver.last('borderRadius').track.values[0]).toBeCloseTo(18)
    stop(view, ['borderWidth'])
    expect(view.borderLeftWidth).toBeCloseTo(4)
    expect(driver.last('x').stopped).toBe(false)
    driver.advance(1000)
    expect(await first).toBe(false)
    expect(await second).toBe(true)
  })
  it('freezes each shadow field independently in the same boxShadow model', async () => {
    const view = card()
    const animation = animate(
      view,
      {
        shadowOpacity: [0, 1],
        shadowRadius: [0, 20],
        shadowOffsetX: [0, 20],
        shadowOffsetY: [0, 40],
      },
      { duration: 1000, ease: 'linear' },
    )
    driver.advance(250)
    stop(view, ['shadowOpacity', 'shadowOffsetX'])
    expect(readValue(view, 'shadowOpacity')).toBeCloseTo(0.25, 2)
    expect(readValue(view, 'shadowOffsetX')).toBe(5)
    expect(readValue(view, 'shadowRadius')).toBe(20)
    expect(driver.last('shadowOffsetY').stopped).toBe(false)
    animation.stop()
    expect(await animation).toBe(false)
  })
  it('supports relative dimensions, sequences, explicit first values and reverse completion', async () => {
    const view = card()
    const animation = sequence([
      [
        view,
        { borderRadius: [4, 20] },
        { duration: 100, repeat: 1, repeatType: 'reverse' },
      ],
      [view, { borderWidth: 3 }, { duration: 100, relative: true }],
    ])
    expect(view.borderRadius).toBe(4)
    driver.advance(200)
    await flush()
    expect(view.borderRadius).toBe(4)
    expect(view.borderWidth).toBe(5)
    driver.advance(100)
    expect(await animation).toBe(true)
  })
  it('clamps spring overshoot at physical and opacity bounds', () => {
    const view = card()
    const animation = animate(
      view,
      { borderRadius: [20, 0], shadowOpacity: [0, 1] },
      { type: 'spring', bounce: 0.8, duration: 400 },
    )
    expect(driver.last('borderRadius').track.values.every((v) => v >= 0)).toBe(true)
    expect(driver.last('shadowOpacity').track.values.every((v) => v >= 0 && v <= 1)).toBe(
      true,
    )
    for (let time = 0; time < 2000; time += 11) {
      expect(driver.last('borderRadius').track.valueAt(time)).toBeGreaterThanOrEqual(0)
      expect(driver.last('shadowOpacity').track.valueAt(time)).toBeLessThanOrEqual(1)
    }
    animation.stop()
  })
  it('rejects nonuniform geometry, clip paths, missing shadows and invalid endpoints before committing', () => {
    const view = card()
    view.borderTopWidth = 9
    expect(() => animate(view, { x: 100, borderRadius: 30 })).toThrow(/uniform/)
    expect(view.translateX).toBe(0)
    expect(driver.played).toHaveLength(0)
    view.borderWidth = 2
    Object.assign(view.style, { clipPath: 'circle(50%)' })
    expect(() => animate(view, { borderWidth: 4 })).toThrow(/clipPath/)
    Object.assign(view.style, { clipPath: undefined })
    view.boxShadow = []
    expect(() => animate(view, { shadowRadius: 10 })).toThrow(/one existing/)
    expect(() => animate(view, { borderRadius: -1 })).toThrow(/Invalid keyframes/)
    expect(() => animate(view, { borderWidth: Infinity })).toThrow(/Invalid keyframes/)
    expect(() => animate(view, { borderRadius: 20 }, { duration: Infinity })).toThrow(
      /duration/,
    )
  })
  it('validates all targets before a stagger writes any model', () => {
    const first = card(),
      second = card()
    second.borderBottomLeftRadius = 3
    expect(() => animate([first, second], { borderRadius: 32 }, { stagger: 50 })).toThrow(
      /uniform/,
    )
    expect(first.borderRadius).toBe(8)
    expect(driver.played).toHaveLength(0)
  })
  it('starts a new iOS radius animation from the capped native corner', () => {
    const view = card()
    view.borderRadius = 120
    view.nativeViewProtected = { layer: { cornerRadius: 60 } }
    const animation = animate(
      view,
      { borderRadius: 0 },
      { duration: 1000, ease: 'linear' },
    )
    expect(driver.last('borderRadius').track.values[0]).toBe(60)
    animation.stop()
  })
})
