import { describe, expect, it } from 'vitest'
import { animate, motionScope, motionStates } from '../src/index.js'
import { createView, driver, flush, state } from './helpers.js'

describe('motion states', () => {
  it('coordinates multiple targets and settles only when all finish', async () => {
    const icon = createView(),
      label = createView()
    const control = motionStates(
      { icon, label },
      {
        idle: { icon: { scale: 1 }, label: { opacity: 1 } },
        sending: { icon: { scale: 0.8 }, label: { opacity: 0 } },
      },
    )
    const handle = control.to('sending'),
      result = state(handle.finished)
    expect(control.current).toBe('sending')
    expect(control.settled).toBeUndefined()
    driver.advance(50)
    await flush()
    expect(result()).toBeUndefined()
    driver.advance(10000)
    expect(await handle).toBe(true)
    expect(control.settled).toBe('sending')
    control.dispose()
  })
  it('transfers position and velocity before cancelling the superseded transition', async () => {
    const view = createView()
    const control = motionStates(
      { view },
      { right: { view: { x: 200 } }, left: { view: { x: -80 } } },
    )
    const first = control.to('right')
    const old = driver.last('x')
    driver.advance(100)
    const value = old.track.valueAt(100),
      velocity = old.track.velocityAt(100)
    const second = control.to('left')
    const next = driver.last('x')
    expect(next.track.valueAt(0)).toBeCloseTo(value)
    expect(next.track.velocityAt(0.01)).toBeCloseTo(velocity, -1)
    expect(await first).toBe(false)
    driver.advance(10000)
    expect(await second).toBe(true)
    expect(control.settled).toBe('left')
  })
  it('freezes omitted old properties and leaves external animation owners alone', async () => {
    const view = createView()
    const control = motionStates(
      { view },
      { a: { view: { x: 100, y: 200 } }, b: { view: { x: 0 } } },
    )
    const a = control.to('a')
    driver.advance(100)
    const expectedY = driver.last('y').track.valueAt(100)
    const outside = animate(view, { opacity: 0 })
    const b = control.to('b')
    expect(await a).toBe(false)
    expect(view.translateY).toBeCloseTo(expectedY)
    expect(driver.last('opacity').stopped).toBe(false)
    control.dispose()
    expect(await b).toBe(false)
    driver.advance(10000)
    expect(await outside).toBe(true)
  })
  it('invalid definitions or transitions never cancel existing ownership', () => {
    const view = createView()
    const active = animate(view, { x: 100 })
    expect(() =>
      motionStates({ view }, { bad: { view: { x: [0, 1] } } } as never),
    ).toThrow(/endpoint/)
    expect(() => motionStates({ view }, { bad: { other: { x: 2 } } } as never)).toThrow(
      /target/,
    )
    expect(() => motionStates({ view, duplicate: view }, { a: {} })).toThrow(/distinct/)
    const control = motionStates({ view }, { a: { view: { x: 20 } } })
    expect(() => control.to('unknown' as never)).toThrow(/Unknown/)
    expect(() => control.to('a', { repeat: Infinity } as never)).toThrow(/repeat/)
    expect(driver.last('x').stopped).toBe(false)
    active.stop()
    control.dispose()
  })
  it('cancels stale immediate reduced-motion completions during rapid requests', async () => {
    driver.reduced = true
    const view = createView()
    const control = motionStates(
      { view },
      { a: { view: { x: 100 } }, b: { view: { x: 0 } } },
    )
    const first = control.to('a'),
      second = control.to('b')
    expect(await first).toBe(false)
    expect(await second).toBe(true)
    expect(control.current).toBe('b')
    expect(control.settled).toBe('b')
    expect(view.translateX).toBe(0)
  })
  it('disposes pending unloaded work and prevents future transitions', async () => {
    const view = createView()
    view.unload()
    const scope = motionScope()
    const control = scope.states({ view }, { a: { view: { x: 100 } } })
    const result = control.to('a')
    scope.dispose()
    expect(await result).toBe(false)
    expect(view.listenerCount('loaded')).toBe(0)
    view.load()
    expect(driver.played).toHaveLength(0)
    expect(() => control.to('a')).toThrow(/disposed/)
  })
  it('pauses through its owning scope and preserves paused state through retargeting', async () => {
    const view = createView(),
      scope = motionScope()
    const control = motionStates(
      { view },
      { a: { view: { x: 100 } }, b: { view: { x: 200 } } },
      { scope, transition: { duration: 1000 } },
    )
    const a = control.to('a')
    driver.advance(200)
    scope.suspend()
    expect(control.paused).toBe(true)
    const b = control.to('b')
    expect(await a).toBe(false)
    expect(driver.last('x').held).toBe(true)
    driver.advance(10000)
    scope.resume()
    driver.advance(1000)
    expect(await b).toBe(true)
    scope.dispose()
  })
  it('copies numeric definitions and safely disposes after outside replacement', async () => {
    const view = createView(),
      definitions = { a: { view: { x: 100 } } }
    const control = motionStates({ view }, definitions)
    definitions.a.view.x = 999
    const a = control.to('a')
    expect(driver.last('x').track.to).toBe(100)
    const outside = animate(view, { x: 200 })
    control.dispose()
    control.dispose()
    expect(await a).toBe(false)
    expect(driver.last('x').stopped).toBe(false)
    driver.advance(10000)
    expect(await outside).toBe(true)
  })
  it('supports an empty state that cancels the previous pose without new tracks', async () => {
    const view = createView()
    const control = motionStates({ view }, { a: { view: { x: 100 } }, hold: {} })
    const a = control.to('a')
    driver.advance(80)
    const expected = driver.last('x').track.valueAt(80)
    expect(await control.to('hold')).toBe(true)
    expect(await a).toBe(false)
    expect(view.translateX).toBeCloseTo(expected)
  })
})
