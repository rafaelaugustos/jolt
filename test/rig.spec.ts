import { describe, it, expect } from 'vitest'
import { rig2d } from '../src/rig/index.js'
import { animate, configure } from '../src/index.js'
import { createView, driver, flush } from './helpers.js'

describe('native articulated parts', () => {
  it('validates hierarchy and ownership before claiming native targets', () => {
    expect(() =>
      rig2d({ parts: { a: { parent: 'b' }, b: { parent: 'a' } }, poses: {} }),
    ).toThrow(/cycle/)
    const view = createView()
    const rig = rig2d({ parts: { body: {} }, poses: {} }, { body: view })
    expect(() => rig2d({ parts: { body: {} }, poses: {} }, { body: view })).toThrow(
      /owner/,
    )
    expect(() => rig.attach({ body: view, missing: view })).toThrow(/Unknown/)
    rig.dispose()
    const second = rig2d({ parts: { body: {} }, poses: {} }, { body: view })
    second.dispose()
  })
  it('blends partial poses from rest, interrupts from presentation and clamps all spring samples', async () => {
    const view = createView()
    const rig = rig2d(
      {
        parts: { arm: { rest: { rotate: 0, x: 10 }, rotation: [-30, 60] } },
        poses: {
          wave: { arm: { rotate: 120 } },
          left: { arm: { rotate: -60, x: 30 } },
          rest: {},
        },
      },
      { arm: view },
    )
    const first = rig.to('wave', { duration: 1000, ease: 'linear' })
    driver.advance(250)
    const before = driver.last('rotate').track.valueAt(250)
    const second = rig.blend([{ pose: 'left', weight: 0.5 }], 'bouncy')
    expect(driver.last('rotate').track.valueAt(0)).toBeCloseTo(before)
    expect(driver.last('x').track.to).toBe(20)
    const track = driver.last('rotate').track
    expect(track.values.every((value) => value >= -30 && value <= 60)).toBe(true)
    expect(await first.finished).toBe(false)
    driver.advance(10000)
    await flush()
    expect(await second.finished).toBe(true)
    rig.dispose()
    expect(view.rotate).toBe(0)
    expect(view.translateX).toBe(0)
  })
  it('takes the short angular path and leaves unrelated/newer property ownership intact', () => {
    const view = createView()
    view.rotate = 350
    const rig = rig2d(
      { parts: { head: {} }, poses: { turn: { head: { rotate: 10 } } } },
      { head: view },
    )
    rig.to('turn', { duration: 1000 })
    expect(driver.last('rotate').track.to).toBe(370)
    const replacement = animate(view, { rotate: 90, opacity: 0.5 }, { duration: 2000 })
    rig.dispose()
    expect(driver.last('rotate').stopped).toBe(false)
    expect(driver.last('opacity').stopped).toBe(false)
    replacement.stop()
  })
  it('uses native parent transforms for sockets and refreshes geometry without polling', () => {
    const body = createView(),
      hand = createView(),
      flower = createView()
    hand.parent = body
    flower.parent = hand
    body.layoutBounds = { left: 10, top: 20, right: 110, bottom: 120 }
    hand.layoutBounds = { left: 20, top: 0, right: 60, bottom: 100 }
    flower.layoutBounds = { left: 0, top: 0, right: 10, bottom: 10 }
    const rig = rig2d(
      {
        parts: {
          body: { pivot: { x: 0, y: 0 }, rest: { rotate: 90 } },
          hand: { parent: 'body', pivot: { x: 0, y: 0 } },
        },
        poses: {},
        sockets: { grip: { part: 'hand', x: 0.5, y: 1, units: 'relative' } },
      },
      { body, hand },
    )
    rig.accessory('grip', flower)
    expect(flower.translateX).toBe(15)
    expect(flower.translateY).toBe(95)
    expect(rig.point('grip').x).toBeCloseTo(-90)
    expect(rig.point('grip').y).toBeCloseTo(60)
    hand.layoutBounds.bottom = 150
    hand.notify({ eventName: 'layoutChanged' })
    expect(flower.translateY).toBe(145)
    rig.accessory('grip', null)
    expect(flower.translateY).toBe(0)
    expect(driver.frames.size).toBe(0)
    rig.dispose()
    expect(body.originX).toBe(0.5)
    expect(hand.listenerCount('layoutChanged')).toBe(0)
    expect(flower.listenerCount('layoutChanged')).toBe(0)
  })
  it('replaces parts, preserves pause, honors reduced motion and releases listeners', async () => {
    const a = createView(),
      b = createView()
    const rig = rig2d(
      { parts: { part: { rest: { x: 0 } } }, poses: { right: { part: { x: 100 } } } },
      { part: a },
    )
    const animation = rig.to('right', { duration: 1000 })
    rig.pause()
    expect(animation.paused).toBe(true)
    rig.attach({ part: b })
    expect(a.listenerCount('layoutChanged')).toBe(0)
    expect(await animation.finished).toBe(false)
    rig.play()
    configure({ reducedMotion: 'always' })
    expect(await rig.to('right').finished).toBe(true)
    expect(b.translateX).toBe(100)
    rig.dispose()
    expect(b.translateX).toBe(0)
    expect(b.listenerCount('layoutChanged')).toBe(0)
  })
})
