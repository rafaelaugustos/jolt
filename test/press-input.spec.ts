import { afterEach, expect, it, vi } from 'vitest'
import { pressInput } from '../src/press-input.js'
import { createView } from './helpers.js'

afterEach(() => vi.unstubAllGlobals())

it('owns only its iOS observer and clears late callbacks across unload/dispose', () => {
  vi.stubGlobal('UIView', class {})
  const callbacks: ((action: string) => void)[] = []
  const observers: { dispose: ReturnType<typeof vi.fn> }[] = []
  vi.stubGlobal('JoltPressInput', {
    attachChange: (_view: unknown, change: (action: string) => void) => {
      callbacks.push(change)
      const observer = { dispose: vi.fn() }
      observers.push(observer)
      return observer
    },
  })
  const view = createView(),
    change = vi.fn()
  const off = pressInput(view, change)
  expect(view.listenerCount('touch')).toBe(0)
  callbacks[0]!('down')
  expect(change).toHaveBeenCalledOnce()
  view.notify({ eventName: 'unloaded' })
  expect(observers[0]!.dispose).toHaveBeenCalledOnce()
  callbacks[0]!('up')
  expect(change).toHaveBeenCalledOnce()
  view.notify({ eventName: 'loaded' })
  expect(observers).toHaveLength(2)
  off()
  off()
  callbacks[1]!('up')
  expect(change).toHaveBeenCalledOnce()
  expect(observers[1]!.dispose).toHaveBeenCalledOnce()
  expect(view.listenerCount('loaded')).toBe(0)
  expect(view.listenerCount('unloaded')).toBe(0)
})
