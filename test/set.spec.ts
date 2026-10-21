import { describe, expect, it } from 'vitest'
import { animate, set } from '../src/index.js'
import { createView, driver } from './helpers.js'

describe('set', () => {
  it('applies values without playing anything', () => {
    const view = createView()

    set(view, { opacity: 0.4, x: 20, scale: 1.5, rotate: 45 })

    expect(view.opacity).toBe(0.4)
    expect(view.translateX).toBe(20)
    expect(view.scaleX).toBe(1.5)
    expect(view.scaleY).toBe(1.5)
    expect(view.rotate).toBe(45)
    expect(driver.played).toHaveLength(0)
    expect(view.listenerCount('unloaded')).toBe(0)
  })

  it('stops what animates those properties and leaves the others running', async () => {
    const view = createView()
    const animation = animate(
      view,
      { x: 100, opacity: 0 },
      { duration: 100, ease: 'linear' },
    )

    driver.advance(25)
    set(view, { x: 10 })

    expect(view.translateX).toBe(10)
    expect(driver.last('x').stopped).toBe(true)
    expect(driver.last('opacity').stopped).toBe(false)

    driver.advance(75)
    expect(await animation).toBe(false)
    expect(view.translateX).toBe(10)
    expect(view.opacity).toBe(0)
  })

  it('stops a spring and lets the next animation start from the set value', () => {
    const view = createView()
    animate(view, { y: 200 }, 'bouncy')

    driver.advance(80)
    set(view, { y: 0 })
    animate(view, { y: 50 }, { duration: 100 })

    const played = driver.last('y')
    expect(played.track.values[0]).toBe(0)
    expect(played.track.velocityAt(0)).toBe(0)
  })

  it('applies values to a view that is not loaded yet and keeps them once loaded', () => {
    const view = createView().unload()

    set(view, { opacity: 0, y: 24 })

    expect(view.opacity).toBe(0)
    expect(view.translateY).toBe(24)

    view.load()
    expect(view.opacity).toBe(0)
    expect(view.translateY).toBe(24)
    expect(driver.played).toHaveLength(0)
  })

  it('wins over an animation that was waiting for the same view to load', async () => {
    const view = createView().unload()
    const animation = animate(view, { opacity: [0, 1] })

    set(view, { opacity: 0.5 })
    view.load()

    expect(view.opacity).toBe(0.5)
    expect(await animation).toBe(false)
  })

  it('sets colors and several targets, including template refs', () => {
    const first = createView()
    const second = createView()

    set([{ nativeView: first }, { nativeElement: second }], {
      backgroundColor: '#ff0000',
      opacity: 0.2,
    })

    for (const view of [first, second]) {
      expect(view.backgroundColor?.argb).toBe(0xffff0000)
      expect(view.opacity).toBe(0.2)
      expect(view.listenerCount('unloaded')).toBe(0)
      expect(view.listenerCount('loaded')).toBe(0)
    }
    expect(driver.played).toHaveLength(0)
  })

  it('rejects keyframes, paths and anything that is not a value', () => {
    const view = createView()

    expect(() => set(view, { x: [0, 10] } as never)).toThrow(/one value per property/)
    expect(() => set(view, { opacity: null } as never)).toThrow(/one value per property/)
    expect(() => set(view, { path: 'M0 0 L10 10' } as never)).toThrow(/Can't set "path"/)
    expect(() => set(view, { width: 10 } as never)).toThrow(/Can't set "width"/)
    expect(() => set(view, null as never)).toThrow(/object of values/)
    expect(view.translateX).toBe(0)
  })
})
