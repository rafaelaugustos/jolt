import { describe, expect, it } from 'vitest'
import { animate, sequence } from '../src/index.js'
import { createView, driver, flush, state } from './helpers.js'

describe('sequence', () => {
  it('starts each step once the previous one is done', async () => {
    const a = createView()
    const b = createView()

    const animation = sequence([
      [a, { x: 100 }, { duration: 100 }],
      () => animate(b, { x: 100 }, { duration: 100 }),
    ])

    expect(driver.played.map((p) => p.view)).toEqual([a])

    driver.advance(100)
    await flush()
    expect(driver.played.map((p) => p.view)).toEqual([a, b])

    driver.advance(100)
    expect(await animation).toBe(true)
  })

  it('stops the current step and skips the rest', async () => {
    const a = createView()
    const b = createView()

    const animation = sequence([
      [a, { x: 100 }, { duration: 100 }],
      [b, { x: 100 }, { duration: 100 }],
    ])
    animation.stop()

    expect(await animation).toBe(false)
    expect(driver.played).toHaveLength(1)
    expect(driver.played[0]!.stopped).toBe(true)
  })

  it('goes on when a step is interrupted, but reports it', async () => {
    const a = createView()
    const b = createView()

    const animation = sequence([
      [a, { x: 100 }, { duration: 100 }],
      [b, { x: 100 }, { duration: 100 }],
    ])
    animate(a, { x: 0 }, { duration: 100 })
    await flush()

    expect(driver.played.some((p) => p.view === b)).toBe(true)

    driver.advance(100)
    expect(await animation).toBe(false)
  })

  it('puts views of later steps in their starting state right away', () => {
    const logo = createView()
    const title = createView()

    sequence([
      [logo, 'popIn'],
      [title, 'fadeInUp'],
    ])

    expect(title.opacity).toBe(0)
    expect(title.translateY).toBe(24)
    expect(driver.played.every((p) => p.view === logo)).toBe(true)
  })

  it('leaves alone what an earlier step animates', () => {
    const card = createView()
    card.translateX = 10

    sequence([
      [card, { x: 100 }, { duration: 100 }],
      [card, { x: [50, 0], opacity: [0.5, 1] }, { duration: 100 }],
    ])

    expect(driver.last('x').track.values[0]).toBe(10)
    expect(card.opacity).toBe(0.5)
  })

  it('moves on once a spring looks done, and finishes once it settles', async () => {
    const a = createView()
    const b = createView()

    const animation = sequence([
      [a, { x: 100 }, 'bouncy'],
      [b, { x: 100 }, { duration: 100 }],
    ])
    const spring = driver.last('x', a).track
    const done = state(animation.finished)

    driver.advance(spring.arrival)
    await flush()
    expect(driver.played.some((p) => p.view === b)).toBe(true)
    expect(spring.arrival).toBeLessThan(spring.end - 100)

    driver.advance(100)
    await flush()
    expect(done()).toBeUndefined()

    driver.advance(spring.end)
    expect(await animation).toBe(true)
  })

  it('stops steps that are still settling', async () => {
    const a = createView()
    const b = createView()

    const animation = sequence([
      [a, { x: 100 }, 'bouncy'],
      [b, { x: 100 }, { duration: 1000 }],
    ])
    driver.advance(driver.last('x', a).track.arrival)
    await flush()
    animation.stop()

    expect(driver.played.every((p) => p.stopped)).toBe(true)
    expect(await animation).toBe(false)
  })
})
