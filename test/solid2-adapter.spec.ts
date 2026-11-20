import { expect, it, vi } from 'vitest'
vi.mock('solid-js', async () => ({
  ...(await vi.importActual<object>('solid-js/dist/solid.js')),
  createTrackedEffect() {},
}))
import { animate, press } from '../src/solid/index.js'
import { createView, driver } from './helpers.js'

it('rejects the unsupported Solid 2 binding contract before allocating native resources', () => {
  const view = createView()
  for (const run of [
    () => animate(view, () => ({ x: 100 })),
    () => press(view, () => ({ scale: 0.9 })),
  ])
    expect(run).toThrow('requires Solid 1.x')
  expect(driver.played).toHaveLength(0)
  expect(view.listenerCount('loaded')).toBe(0)
  expect(view.listenerCount('unloaded')).toBe(0)
})
