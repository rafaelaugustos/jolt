import { Color } from '@nativescript/core'
import { describe, expect, it } from 'vitest'
import { animate, press, set } from '../src/index.js'
import { currentValue } from '../src/engine.js'
import { createView, driver } from './helpers.js'

describe('press', () => {
  it('removes a settled press contribution without stopping other layers or the base', () => {
    const view = createView()
    set(view, { scale: 1.5 })
    animate(view, { scale: 1.2 }, { layer: 'breathe', duration: 0 })
    const remove = press(view, { scale: 0.8 }, { layer: 'press', duration: 100 })
    view.touch('down')
    driver.advance(100)
    expect(currentValue(view, 'scaleX')).toBeCloseTo(1.5 * 1.2 * 0.8)
    remove()
    expect(currentValue(view, 'scaleX')).toBeCloseTo(1.5 * 1.2)
    expect(view.listenerCount('touch')).toBe(0)
  })
  it('returns a repressed layer to neutral when release is interrupted', () => {
    const view = createView()
    set(view, { x: 20, scale: 1.5 })
    press(view, { x: 8, scale: 0.9 }, { layer: 'press', duration: 100, ease: 'linear' })
    view.touch('down')
    driver.advance(100)
    view.touch('up')
    driver.advance(25)
    view.touch('down')
    driver.advance(100)
    view.touch('up')
    driver.advance(100)
    expect(currentValue(view, 'x')).toBeCloseTo(20)
    expect(currentValue(view, 'scaleX')).toBeCloseTo(1.5)
  })
  it.each(['up', 'cancel'] as const)(
    'releases only the press layer on %s while a non-unit base keeps moving',
    async (action) => {
      const view = createView()
      set(view, { x: 20, scale: 1.5 })
      press(view, { x: 8, scale: 0.9 }, { layer: 'press', duration: 100, ease: 'linear' })
      const entrance = animate(
        view,
        { x: 60, scale: 1.8 },
        { duration: 1000, ease: 'linear' },
      )
      driver.advance(200)
      view.touch('down')
      driver.advance(100)
      expect(currentValue(view, 'x')).toBeCloseTo(40)
      expect(currentValue(view, 'scaleX')).toBeCloseTo(1.59 * 0.9)
      view.touch(action)
      driver.advance(100)
      expect(currentValue(view, 'x')).toBeCloseTo(36)
      expect(currentValue(view, 'scaleX')).toBeCloseTo(1.62)
      driver.advance(600)
      expect(await entrance).toBe(true)
      expect(currentValue(view, 'x')).toBeCloseTo(60)
      expect(currentValue(view, 'scaleX')).toBeCloseTo(1.8)
    },
  )
  it('restores color objects after a colored press', () => {
    const view = createView()
    view.backgroundColor = new Color('red')
    press(view, { backgroundColor: 'blue' })
    view.touch('down')
    driver.advance(50)
    view.touch('up')
    expect(driver.last('backgroundColor').track.to).toBe(0xffff0000)
  })
  it('scales down while pressed and back when released', () => {
    const view = createView()
    press(view)

    view.touch('down')
    expect(driver.last('scaleX').track.to).toBe(0.96)

    driver.advance(50)
    view.touch('up')
    expect(driver.last('scaleX').track.to).toBe(1)
    expect(driver.last('scaleY').track.to).toBe(1)
  })

  it('goes back to the values the view had, even mid animation', () => {
    const view = createView()
    press(view, { scale: 0.9, opacity: 0.8 })

    animate(view, { opacity: [0, 0.6] }, { duration: 1000 })
    driver.advance(100)
    view.touch('down')
    view.touch('cancel')

    expect(driver.last('opacity').track.to).toBe(0.6)
  })

  it('ignores moves, repeated downs and disabled views', () => {
    const view = createView()
    press(view)

    view.touch('down')
    view.touch('move')
    view.touch('down')
    expect(driver.played).toHaveLength(2)

    driver.advance(50)
    view.touch('up')
    view.isEnabled = false
    view.touch('down')
    expect(driver.played).toHaveLength(4)
  })

  it('can be removed', () => {
    const view = createView()
    const remove = press(view)

    remove()
    view.touch('down')

    expect(driver.played).toHaveLength(0)
    expect(view.listenerCount('touch')).toBe(0)
  })

  it('restores absolute resting values after relative press feedback', () => {
    const view = createView()
    view.scaleX = 2
    view.scaleY = 0.5
    view.translateX = 40
    press(view, { scale: 0.9, x: 10 }, { relative: true, duration: 100 })

    view.touch('down')
    expect(driver.last('scaleX').track.to).toBe(1.8)
    expect(driver.last('scaleY').track.to).toBe(0.45)
    expect(driver.last('x').track.to).toBe(50)

    driver.advance(50)
    view.touch('cancel')
    expect(driver.last('scaleX').track.to).toBe(2)
    expect(driver.last('scaleY').track.to).toBe(0.5)
    expect(driver.last('x').track.to).toBe(40)
  })
})
