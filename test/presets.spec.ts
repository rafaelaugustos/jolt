import { beforeEach, describe, expect, it } from 'vitest'
import { animate, definePreset, sequence } from '../src/index.js'
import { createView, driver, flush } from './helpers.js'

declare module '@rafaelaugusto/jolt' {
  interface Presets {
    cardIn: true
    unregisteredCard: true
  }
}

beforeEach(() => {
  definePreset('cardIn', {
    keyframes: { opacity: [0, 1], y: [40, 0] },
    transition: {
      type: 'spring',
      duration: 400,
      bounce: 0.2,
      delay: 20,
      stagger: 30,
      opacity: { duration: 120 },
    },
  })
})

describe('custom presets', () => {
  it('plays registered keyframes with their own curves and timing', async () => {
    const view = createView()
    const animation = animate(view, 'cardIn')

    expect(driver.last('opacity').track.values[0]).toBe(0)
    expect(driver.last('opacity').track.to).toBe(1)
    expect(driver.last('opacity').track.duration).toBe(120)
    expect(driver.last('opacity').track.delay).toBe(20)
    expect(driver.last('y').track.values[0]).toBe(40)
    expect(driver.last('y').track.to).toBe(0)
    expect(Math.min(...driver.last('y').track.values)).toBeLessThan(0)

    driver.advance(5000)
    expect(await animation).toBe(true)
  })

  it('keeps its curves when overriding only timing', () => {
    const view = createView()
    animate(view, 'cardIn')
    const curve = driver.last('y').track.values

    animate(view, 'cardIn', { delay: 100, repeat: 1 })

    expect(driver.last('y').track.values).toEqual(curve)
    expect(driver.last('y').track.delay).toBe(100)
    expect(driver.last('y').track.repeat).toBe(1)
    expect(driver.last('opacity').track.duration).toBe(120)
  })

  it('uses its stagger unless the call overrides it, including with zero', () => {
    const views = [createView(), createView()]
    animate(views, 'cardIn')
    expect(views.map((view) => driver.last('y', view).track.delay)).toEqual([20, 50])

    animate(views, 'cardIn', { stagger: 0 })
    expect(views.map((view) => driver.last('y', view).track.delay)).toEqual([20, 20])
  })

  it('can override one property or replace all preset curves', () => {
    const view = createView()
    animate(view, 'cardIn', { opacity: { duration: 60 } })
    expect(driver.last('opacity').track.duration).toBe(60)
    expect(Math.min(...driver.last('y').track.values)).toBeLessThan(0)

    animate(view, 'cardIn', { duration: 200 })
    expect(driver.last('opacity').track.duration).toBe(200)
    expect(driver.last('y').track.duration).toBe(200)
    expect(driver.last('y').track.delay).toBe(20)
  })

  it('sets up a later sequence step before playing it', async () => {
    const first = createView()
    const card = createView()
    const animation = sequence([
      [first, 'fadeIn', { duration: 100 }],
      [card, 'cardIn'],
    ])

    expect(card.opacity).toBe(0)
    expect(card.translateY).toBe(40)
    expect(driver.played.every((played) => played.view === first)).toBe(true)

    driver.advance(100)
    await flush()
    expect(driver.last('y', card).track.values[0]).toBe(40)
    expect(driver.last('opacity', card).track.duration).toBe(120)

    driver.advance(5000)
    expect(await animation).toBe(true)
  })

  it('uses a new definition for future animations without changing running ones', async () => {
    const first = animate(createView(), 'cardIn')
    const playing = driver.last('y')
    definePreset('cardIn', {
      keyframes: { x: [10, 100] },
      transition: { duration: 200 },
    })
    const second = animate(createView(), 'cardIn')

    expect(playing.stopped).toBe(false)
    expect(playing.track.values[0]).toBe(40)
    expect(driver.last('x').track.values[0]).toBe(10)
    expect(driver.last('x').track.duration).toBe(200)

    driver.advance(5000)
    expect(await Promise.all([first, second])).toEqual([true, true])
  })

  it('does not replace a built-in preset', () => {
    expect(() =>
      definePreset('fadeIn', { keyframes: { x: 100 }, transition: { duration: 50 } }),
    ).toThrow('Preset "fadeIn" is built in and cannot be replaced.')

    animate(createView(), 'fadeIn')
    expect(driver.last('opacity').track.duration).toBe(300)
  })

  it('requires registration even when a name is declared in TypeScript', () => {
    const view = createView()
    expect(() => animate(view, 'unregisteredCard')).toThrow(
      'Unknown preset "unregisteredCard".',
    )
    expect(() => sequence([[view, 'unregisteredCard']])).toThrow(
      'Unknown preset "unregisteredCard".',
    )
    expect(driver.played).toHaveLength(0)
  })

  it.each(['constructor', 'toString', '__proto__'])(
    'does not mistake the inherited name %s for a preset',
    (name) => {
      expect(() => animate(createView(), name as never)).toThrow(
        `Unknown preset "${name}".`,
      )
    },
  )
})
