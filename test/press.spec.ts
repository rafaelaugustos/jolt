import { describe, expect, it } from 'vitest'
import { animate, press } from '../src/index.js'
import { createView, driver } from './helpers.js'

describe('press', () => {
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
})
