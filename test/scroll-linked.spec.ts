import type { ScrollView as CoreScrollView } from '@nativescript/core'
import { describe, expect, it, vi } from 'vitest'
import { animate, scrollLinked, stop } from '../src/index.js'
import type { ScrollLinkedOptions } from '../src/index.js'
import { ScrollView } from './shims/core.js'
import { createView, driver, flush } from './helpers.js'

const createScroll = () => new ScrollView() as ScrollView & CoreScrollView
const scroll = (view: ScrollView, y: number, x = 0) => {
  view.verticalOffset = y
  view.horizontalOffset = x
  view.notify({ eventName: 'scroll', object: view, scrollX: x, scrollY: y })
}

describe('scrollLinked', () => {
  it('builds tracks once and seeks both properties synchronously in either direction', () => {
    const source = createScroll()
    const header = createView()
    const unlink = scrollLinked(
      source,
      header,
      { y: [0, -60], opacity: [1, 0] },
      { range: [0, 120] },
    )
    const tracks = [...driver.played]
    scroll(source, 60)
    expect(driver.last('y').offset).toBe(500)
    expect(driver.last('opacity').offset).toBe(500)
    driver.advance(5000)
    expect(driver.last('y').held).toBe(true)
    scroll(source, 120)
    scroll(source, 30)
    expect(driver.last('y').offset).toBe(250)
    expect(driver.played).toEqual(tracks)
    unlink()
    expect(header.translateY).toBeCloseTo(-15)
    expect(header.opacity).toBeCloseTo(0.75)
  })

  it('clamps overscroll and skips unchanged and nonfinite offsets', () => {
    const source = createScroll()
    const unlink = scrollLinked(
      source,
      createView(),
      { x: [0, 100] },
      { range: [20, 120] },
    )
    const control = vi.spyOn(driver, 'control')
    scroll(source, -50)
    expect(control).not.toHaveBeenCalled()
    scroll(source, 200)
    expect(control).toHaveBeenCalledTimes(1)
    expect(driver.last('x').offset).toBe(1000)
    scroll(source, 300)
    scroll(source, NaN)
    scroll(source, Infinity)
    expect(control).toHaveBeenCalledTimes(1)
    scroll(source, 70)
    expect(driver.last('x').offset).toBe(500)
    unlink()
  })

  it('uses a restored offset immediately and supports wrapped views and horizontal ranges', () => {
    const source = createScroll()
    source.horizontalOffset = 75
    const view = createView()
    const unlink = scrollLinked(
      { nativeElement: source },
      { nativeView: view },
      { x: [0, 80] },
      { range: [50, 150], axis: 'x' },
    )
    expect(driver.last('x').offset).toBe(250)
    scroll(source, 500, 100)
    expect(driver.last('x').offset).toBe(500)
    unlink()
    expect(view.translateX).toBeCloseTo(40)
  })

  it('accepts a descending range and snapshots its endpoints', () => {
    const source = createScroll()
    const range: [number, number] = [120, 20]
    const unlink = scrollLinked(source, createView(), { x: [0, 100] }, { range })
    expect(driver.last('x').offset).toBe(1000)
    range[0] = 200
    scroll(source, 95)
    expect(driver.last('x').offset).toBe(250)
    unlink()
  })

  it('defers progress until the target loads and refreshes the source offset on load', () => {
    const source = createScroll()
    source.isLoaded = false
    const view = createView()
    view.isLoaded = false
    const unlink = scrollLinked(source, view, { y: [0, -60] }, { range: [0, 120] })
    source.verticalOffset = 90
    source.load()
    expect(driver.played).toHaveLength(0)
    view.load()
    expect(driver.last('y').held).toBe(true)
    expect(driver.last('y').offset).toBe(750)
    unlink()
    expect(view.translateY).toBeCloseTo(-45)
  })

  it('can unlink before load without leaving a pending animation', () => {
    const source = createScroll()
    const view = createView()
    view.isLoaded = false
    const unlink = scrollLinked(source, view, { y: [0, -60] }, { range: [0, 120] })
    unlink()
    expect(source.listenerCount('scroll')).toBe(0)
    expect(view.listenerCount('loaded')).toBe(0)
    view.load()
    expect(driver.played).toHaveLength(0)
  })

  it.each(['source', 'target'] as const)(
    'unlinks on %s unload without touching other animations',
    async (which) => {
      const source = createScroll()
      const header = createView()
      const independent = animate(header, { x: [0, 100] }, { duration: 1000 })
      const unlink = scrollLinked(source, header, { y: [0, -60] }, { range: [0, 120] })
      scroll(source, 60)
      const unloading = which === 'source' ? source : header
      unloading.notify({ eventName: 'unloaded', object: unloading })
      unloading.unload()
      expect(source.listenerCount('scroll')).toBe(0)
      expect(source.listenerCount('loaded')).toBe(0)
      expect(source.listenerCount('unloaded')).toBe(0)
      expect(header.translateY).toBeCloseTo(-30)
      if (which === 'source') expect(driver.last('x').stopped).toBe(false)
      unlink()
      scroll(source, 120)
      expect(header.translateY).toBeCloseTo(-30)
      if (which === 'source') {
        driver.advance(1000)
        expect(await independent).toBe(true)
      } else expect(await independent).toBe(false)
    },
  )

  it('removes only its own listener and cleanup is idempotent', () => {
    const source = createScroll()
    const other = vi.fn()
    source.on('scroll', other)
    const view = createView()
    const unlink = scrollLinked(source, view, { x: [0, 100] }, { range: [0, 120] })
    scroll(source, 30)
    unlink()
    unlink()
    scroll(source, 120)
    expect(view.translateX).toBeCloseTo(25)
    expect(source.listenerCount('scroll')).toBe(1)
    expect(other).toHaveBeenCalledTimes(2)
  })

  it('releases listeners after all owned properties are stopped or replaced', async () => {
    const source = createScroll()
    const view = createView()
    scrollLinked(source, view, { y: [0, -60], opacity: [1, 0] }, { range: [0, 120] })
    scroll(source, 60)
    const next = animate(view, { y: -100 }, { duration: 1000 })
    await flush()
    expect(source.listenerCount('scroll')).toBe(1)
    scroll(source, 90)
    expect(driver.last('y').held).toBeUndefined()
    expect(driver.last('opacity').offset).toBe(750)
    stop(view, ['opacity'])
    await flush()
    expect(source.listenerCount('scroll')).toBe(0)
    expect(driver.last('y').stopped).toBe(false)
    next.stop()
  })

  it.each([
    { range: [0, 0] },
    { range: [0, NaN] },
    { range: [0, Infinity] },
    { range: [-Number.MAX_VALUE, Number.MAX_VALUE] },
    { range: [0] },
    { range: [0, 1, 2] },
  ])('rejects invalid range %j before changing the target', ({ range }) => {
    const source = createScroll()
    const view = createView()
    expect(() =>
      scrollLinked(source, view, { y: -60 }, { range } as unknown as ScrollLinkedOptions),
    ).toThrow(RangeError)
    expect(driver.played).toHaveLength(0)
    expect(view.translateY).toBe(0)
    expect(source.listenerCount('scroll')).toBe(0)
  })

  it('validates the source and axis before starting an animation', () => {
    const view = createView()
    expect(() => scrollLinked(view, view, { y: -60 }, { range: [0, 120] })).toThrow(
      /ScrollView/,
    )
    expect(() =>
      scrollLinked(createScroll(), view, { y: -60 }, {
        range: [0, 120],
        axis: 'z',
      } as unknown as ScrollLinkedOptions),
    ).toThrow(/axis/)
    expect(driver.played).toHaveLength(0)
  })
})
