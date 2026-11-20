import { expect, it } from 'vitest'
import { animate, press } from '../src/svelte/index.js'
import { createView, driver } from './helpers.js'

it('keeps native Svelte action update/unload/remount/disposal ownership', () => {
  const view = createView()
  const action = animate({ nativeView: view }, { x: 80 })
  const feedback = press({ nativeView: view }, { scale: 0.94 })
  expect(driver.last('x').track.to).toBe(80)
  view.unload()
  action.update({ x: 120 })
  view.load()
  expect(driver.last('x').track.to).toBe(120)
  feedback.destroy()
  action.destroy()
  const count = driver.played.length
  view.touch('down')
  action.update({ x: 180 })
  view.load()
  expect(driver.played).toHaveLength(count)
  expect(view.listenerCount('loaded')).toBe(0)
  expect(view.listenerCount('unloaded')).toBe(0)
})
