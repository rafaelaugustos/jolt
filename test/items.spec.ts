import type { ListView as CoreListView } from '@nativescript/core'
import { describe, expect, it } from 'vitest'
import { animate, animateItems } from '../src/index.js'
import { endingValues } from '../src/animate.js'
import { ListView, View } from './shims/core.js'
import { createView, driver, flush } from './helpers.js'

function createList(items: unknown[] = ['Inbox', 'Starred', 'Snoozed']) {
  const list = new ListView()
  list.items = items
  return list as ListView & CoreListView
}

function playedFor(view: View) {
  return driver.played.filter((played) => played.view === view)
}

describe('animateItems', () => {
  it('animates a row when it is handed to itemLoading, before it loads', () => {
    const list = createList()
    const unlink = animateItems(list, 'fadeInUp')
    const row = createView().unload()

    list.realize(0, row)
    expect(row.opacity).toBe(0)
    expect(row.translateY).toBe(24)
    expect(driver.played).toHaveLength(0)

    row.load()
    expect(playedFor(row).map((played) => played.track.property)).toEqual([
      'opacity',
      'y',
    ])
    unlink()
  })

  it('animates a recycled row again by default', () => {
    const list = createList()
    const unlink = animateItems(list, { opacity: [0, 1] }, { duration: 200 })
    const row = createView()

    list.realize(0, row)
    driver.advance(300)
    list.realize(2, row)

    expect(playedFor(row)).toHaveLength(2)
    expect(row.opacity).toBe(1)
    unlink()
  })

  it('stops a row mid-animation when it is recycled and starts over', () => {
    const list = createList()
    const unlink = animateItems(list, { opacity: [0, 1] }, { duration: 1000 })
    const row = createView()

    list.realize(0, row)
    driver.advance(500)
    const first = driver.last('opacity')
    list.realize(2, row)

    expect(first.stopped).toBe(true)
    expect(driver.last('opacity')).not.toBe(first)
    expect(driver.last('opacity').track.values[0]).toBe(0)
    expect(driver.last('opacity').startedAt).toBe(driver.time)
    unlink()
  })

  it('animates each object only once when asked, settling other rows at the end', () => {
    const inbox = { title: 'Inbox' }
    const list = createList([inbox, { title: 'Sent' }])
    const unlink = animateItems(list, 'fadeInUp', { once: true })
    const row = createView()
    const other = createView()

    list.realize(0, row)
    list.realize(1, other)
    driver.advance(100)
    expect(driver.played).toHaveLength(4)

    list.realize(0, other)
    expect(driver.played).toHaveLength(4)
    expect(driver.last('opacity', other).stopped).toBe(true)
    expect(other.opacity).toBe(1)
    expect(other.translateY).toBe(0)

    list.realize(1, other)
    expect(driver.played).toHaveLength(4)
    unlink()
  })

  it('keys primitive items by their index when animating once', () => {
    const list = createList(['a', 'a', 'b'])
    const unlink = animateItems(list, { opacity: [0, 1] }, { once: true })
    const row = createView()

    list.realize(0, row)
    list.realize(1, row)
    list.realize(0, row)
    list.realize(2, row, undefined)

    expect(driver.played).toHaveLength(3)
    unlink()
  })

  it('finds fresh cells created after itemLoading and matches them to their items', async () => {
    const first = { title: 'First' }
    const second = { title: 'Second' }
    const list = createList([first, second])
    const unlink = animateItems(list, { opacity: [0, 1] }, { once: true })

    list.realize(1)
    list.realize(0)
    expect(driver.played).toHaveLength(0)
    await flush()

    expect(driver.played.map((played) => played.view.bindingContext)).toEqual([
      second,
      first,
    ])
    const recycled = list.children[0]!
    list.realize(0, recycled)
    expect(driver.played).toHaveLength(2)
    expect(recycled.opacity).toBe(1)
    unlink()
  })

  it('matches duplicate primitive items in order and skips rows it cannot place', async () => {
    const list = createList(['a', 'a'])
    const unlink = animateItems(list, { opacity: [0, 1] })
    const stranger = new View()
    stranger.bindingContext = 'header'
    list.children.push(stranger)

    list.realize(0)
    list.realize(1)
    await flush()

    expect(driver.played).toHaveLength(2)
    expect(driver.played.map((played) => played.view)).not.toContain(stranger)
    unlink()
  })

  it('reads items from their section when the list is sectioned', () => {
    const mail = { title: 'Mail' }
    const list = createList([{ items: [mail] }, { items: [{ title: 'Chat' }] }])
    const unlink = animateItems(list, { opacity: [0, 1] }, { once: true })
    const row = createView()

    list.realize(0, row, 0)
    list.realize(0, row, 1)
    list.realize(0, row, 0)

    expect(driver.played).toHaveLength(2)
    unlink()
  })

  it('stops rows and writes their end values on cleanup', () => {
    const list = createList()
    const unlink = animateItems(list, 'fadeInUp')
    const row = createView()
    const other = createView()

    list.realize(0, row)
    list.realize(1, other)
    driver.advance(100)
    unlink()
    unlink()

    expect(driver.played.every((played) => played.stopped)).toBe(true)
    expect([row.opacity, row.translateY, other.opacity, other.translateY]).toEqual([
      1, 0, 1, 0,
    ])
    expect(list.listenerCount('itemLoading')).toBe(0)
    expect(list.listenerCount('unloaded')).toBe(0)

    list.realize(2, row)
    expect(driver.played).toHaveLength(4)
  })

  it('leaves unknown end values alone and stops at the current value', () => {
    const list = createList()
    const unlink = animateItems(list, { x: [0, -10, 10, 0] }, { relative: true })
    const row = createView()
    row.translateX = 40

    list.realize(0, row)
    driver.advance(150)
    unlink()

    expect(driver.last('x').stopped).toBe(true)
    expect(row.translateX).not.toBe(40)
  })

  it('cleans up when the list unloads', () => {
    const list = createList()
    animateItems(list, 'fadeInUp')
    const row = createView()

    list.realize(0, row)
    list.notify({ eventName: 'unloaded', object: list })

    expect(driver.last('opacity').stopped).toBe(true)
    expect(row.opacity).toBe(1)
    expect(list.listenerCount('itemLoading')).toBe(0)
  })

  it('keeps other animations on a row and takes over only its own properties', () => {
    const list = createList()
    const unlink = animateItems(list, { opacity: [0, 1] })
    const row = createView()
    animate(row, { x: 100 }, { duration: 1000 })

    list.realize(0, row)
    driver.advance(100)
    list.realize(1, row)

    expect(driver.last('x').stopped).toBe(false)
    unlink()
    expect(driver.last('x').stopped).toBe(false)
  })

  it('takes elements that hold a list and a named spring', () => {
    const list = createList()
    const unlink = animateItems({ nativeView: list }, { scale: [0.9, 1] }, 'bouncy')
    const row = createView()

    list.realize(0, row)
    expect(driver.last('scaleX').track.duration).toBeGreaterThan(0)
    unlink()
  })

  it('explains bad input', () => {
    const list = createList()
    expect(() => animateItems(undefined as never, 'fadeIn')).toThrow(
      'Expected a NativeScript view',
    )
    expect(() => animateItems(list, 'fadeInSideways' as never)).toThrow('Unknown preset')
    expect(() => animateItems(list, 'fadeIn', { stagger: 40 })).toThrow(
      'stagger has no effect',
    )
    expect(list.listenerCount('itemLoading')).toBe(0)
  })
})

describe('endingValues', () => {
  it('follows the last keyframe, or the first one for loops and odd reverses', () => {
    expect([...endingValues('fadeInUp')]).toEqual([
      ['opacity', 1],
      ['y', 0],
    ])
    expect(endingValues({ x: [0, 50] }, { repeat: Infinity }).get('x')).toBe(0)
    expect(
      endingValues({ x: [0, 50] }, { repeat: 1, repeatType: 'reverse' }).get('x'),
    ).toBe(0)
    expect(
      endingValues({ x: [0, 50] }, { repeat: 2, repeatType: 'reverse' }).get('x'),
    ).toBe(50)
  })

  it('reports null when the end depends on the view', () => {
    expect(endingValues({ x: [10, null] }).get('x')).toBeNull()
    expect(endingValues({ x: [0, 10] }, { relative: true }).get('x')).toBeNull()
    expect(endingValues({ path: 'M0 0 L10 10' }).get('x')).toBeNull()
    expect(
      endingValues({ backgroundColor: ['red', 'blue'] }, { relative: true }),
    ).toEqual(new Map([['backgroundColor', 0xff0000ff]]))
  })
})
