import type { ScrollView as CoreScrollView } from '@nativescript/core'
import { describe, expect, it } from 'vitest'
import { animate, bind, scrollValue } from '../src/index.js'
import { ScrollView } from './shims/core.js'
import { createView, driver } from './helpers.js'

const createScroll = () => new ScrollView() as ScrollView & CoreScrollView
const scroll = (view: ScrollView, y: number, x = 0) => {
  view.verticalOffset = y
  view.horizontalOffset = x
  view.notify({ eventName: 'scroll', object: view, scrollX: x, scrollY: y })
}

describe('scrollValue', () => {
  it('drives bound views from the offset with one write per event', () => {
    const source = createScroll()
    const header = createView()
    const offset = scrollValue(source)
    bind(header, {
      y: offset.to([0, 120], [0, -60]),
      opacity: offset.to([0, 80], [1, 0]),
    })

    scroll(source, 60)
    expect(header.translateY).toBe(-30)
    expect(header.opacity).toBe(0.25)
    scroll(source, 200)
    expect(header.translateY).toBe(-60)
    expect(header.opacity).toBe(0)
    expect(offset.get()).toBe(200)
    expect(driver.played).toHaveLength(0)
  })

  it('start from the current offset and follow the horizontal axis', () => {
    const source = createScroll()
    source.verticalOffset = 40
    source.horizontalOffset = 10
    expect(scrollValue(source).get()).toBe(40)

    const strip = createView()
    const offset = scrollValue(source, { axis: 'x' })
    bind(strip, { x: offset.to([0, 100], [0, -100]) })
    expect(strip.translateX).toBe(-10)
    scroll(source, 40, 50)
    expect(strip.translateX).toBe(-50)
  })

  it('take over a property that was animating when it is bound', async () => {
    const source = createScroll()
    const header = createView()
    const move = animate(header, { y: 100 }, { duration: 500 })
    const fade = animate(header, { opacity: 0.5 }, { duration: 500 })
    driver.advance(100)

    bind(header, { y: scrollValue(source) })
    expect(await move).toBe(false)
    expect(header.translateY).toBe(0)
    scroll(source, 20)
    expect(header.translateY).toBe(20)
    expect(driver.last('opacity', header).stopped).toBe(false)
    void fade
  })

  it('switch scroll views through its ref and stop when disposed', () => {
    const first = createScroll()
    const second = createScroll()
    second.verticalOffset = 70
    const header = createView()
    const offset = scrollValue()
    bind(header, { y: offset })

    offset.ref(first)
    scroll(first, 30)
    expect(header.translateY).toBe(30)
    offset.ref({ nativeView: second } as never)
    expect(header.translateY).toBe(70)
    scroll(first, 10)
    expect(header.translateY).toBe(70)

    offset.dispose()
    scroll(second, 90)
    expect(header.translateY).toBe(70)
  })

  it('accept only scroll views and known axes', () => {
    expect(() => scrollValue(createView() as never)).toThrow(/ScrollView/)
    expect(() => scrollValue(null, { axis: 'z' as never })).toThrow(/axis/)
  })

  it('stop following with the component in Vue', async () => {
    const { useScrollValue, useBinding } = await import('../src/vue/index.js')
    const { unmountHooks } = await import('./shims/vue.js')
    const source = createScroll()
    const header = createView()
    const offset = useScrollValue()
    useBinding({ y: offset.to([0, 100], [0, -50]) })({ nativeView: header })
    offset.ref(source)

    scroll(source, 50)
    expect(header.translateY).toBe(-25)
    unmountHooks.splice(0).forEach((hook) => hook())
    scroll(source, 100)
    expect(header.translateY).toBe(-25)
  })
})
