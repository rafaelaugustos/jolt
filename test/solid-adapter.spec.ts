import { describe, expect, it, vi } from 'vitest'
// NativeScript needs Solid's client graph, not Node's server export condition.
vi.mock('solid-js', () =>
  vi.importActual<typeof import('solid-js')>('solid-js/dist/solid.js'),
)
import { createRoot, createSignal } from 'solid-js'
import { animate, press } from '../src/solid/index.js'
import { createView, driver } from './helpers.js'

describe('Solid native directives', () => {
  it('follows reactive values and releases both directives with the Solid owner', () => {
    const view = createView()
    const controls = createRoot((dispose) => {
      const [value, setValue] = createSignal({ x: 100 })
      animate(view, value)
      press(view, () => ({ scale: 0.95 }))
      expect(driver.last('x').track.to).toBe(100)
      return { setValue, dispose }
    })
    controls.setValue({ x: 180 })
    expect(driver.last('x').track.to).toBe(180)
    controls.dispose()
    expect(view.listenerCount('loaded')).toBe(0)
    expect(view.listenerCount('unloaded')).toBe(0)
    const count = driver.played.length
    controls.setValue({ x: 300 })
    view.touch('down')
    expect(driver.played).toHaveLength(count)
  })
})
