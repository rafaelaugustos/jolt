import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Application } from './shims/core.js'
import { configure, motionScope, pointerFollow } from '../src/index.js'
import { pointerPoint, resolvePointerOptions } from '../src/core/pointer.js'
import { setLiveSpringDriver, type LiveNode } from '../src/live-spring-driver.js'
import { createView, driver } from './helpers.js'

const callbacks: ((
  x: number,
  y: number,
  width: number,
  height: number,
  active: boolean,
) => void)[] = []
const observers: {
  refresh: ReturnType<typeof vi.fn>
  dispose: ReturnType<typeof vi.fn>
}[] = []
beforeEach(() => {
  callbacks.length = observers.length = 0
  setLiveSpringDriver({
    sync() {},
    create(value) {
      return {
        position: () => value,
        velocity: () => 0,
        moving: () => false,
        update: (input) => {
          value = input.value
        },
        inputs() {},
        reduced() {},
        paused() {},
        follow() {},
        dispose() {},
        bind: () => ({ value: () => value, layers() {}, cancel() {} }),
      } satisfies LiveNode
    },
  })
  vi.stubGlobal('JoltPointerInput', {
    attachChange: (_view: unknown, callback: (typeof callbacks)[number]) => {
      callbacks.push(callback)
      const observer = { refresh: vi.fn(), dispose: vi.fn() }
      observers.push(observer)
      return observer
    },
  })
})
afterEach(() => {
  Application.suspended = false
  setLiveSpringDriver(undefined)
  vi.unstubAllGlobals()
})

it('shares bounded center-origin mapping with the browser, including zero size and axis filtering', () => {
  const options = resolvePointerOptions({ range: { x: [-20, 20] }, axis: 'x' })
  expect(pointerPoint(25, 25, 100, 100, options)).toEqual({ x: 10, y: 0 })
  expect(pointerPoint(51, 0, 100, 100, options)).toBeUndefined()
  expect(pointerPoint(0, 0, 0, 100, options)).toBeUndefined()
  expect(pointerPoint(NaN, 0, 100, 100, options)).toBeUndefined()
  expect(
    pointerPoint(
      90,
      -10,
      200,
      40,
      resolvePointerOptions({ coordinates: 'pixels', range: { x: [-50, 50] } }),
    ),
  ).toEqual({ x: 50, y: -10 })
  expect(() => resolvePointerOptions({ rest: { x: 2 }, range: { x: [-1, 1] } })).toThrow(
    /rest/,
  )
})

it('publishes position/presence without owning taps, and drops stale input after native replacement', () => {
  const view = createView(),
    tap = vi.fn()
  view.on('tap', tap)
  const pointer = pointerFollow(view, { spring: false })
  expect(pointer.available).toBe(true)
  callbacks[0]!(25, -10, 100, 40, true)
  expect([pointer.x.get(), pointer.y.get(), pointer.presence.get()]).toEqual([
    0.5, -0.5, 1,
  ])
  view.notify({ eventName: 'tap' })
  expect(tap).toHaveBeenCalledOnce()
  view.notify({ eventName: 'unloaded' })
  expect(pointer.active).toBe(false)
  expect(pointer.presence.get()).toBe(0)
  view.notify({ eventName: 'loaded' })
  callbacks[0]!(50, 0, 100, 40, true)
  expect(pointer.x.get()).toBe(0)
  callbacks[1]!(10, 0, 100, 40, true)
  expect(pointer.x.get()).toBe(0.2)
  pointer.dispose()
  pointer.dispose()
  callbacks[1]!(50, 0, 100, 40, true)
  expect(pointer.presence.get()).toBe(0)
  expect(view.listenerCount('tap')).toBe(1)
  expect(view.listenerCount('loaded')).toBe(0)
  expect(observers.every((observer) => observer.dispose.mock.calls.length === 1)).toBe(
    true,
  )
  expect(driver.frames.size).toBe(0)
})

it('preserves manual pause across background, reduced motion, disabling and scope teardown', () => {
  const scope = motionScope(),
    pointer = scope.pointerFollow(createView(), { spring: false })
  callbacks[0]!(10, 0, 100, 100, true)
  pointer.suspend()
  Application.suspended = true
  Application.notify({ eventName: Application.suspendEvent })
  Application.suspended = false
  Application.notify({ eventName: Application.resumeEvent })
  expect(pointer.suspended).toBe(true)
  pointer.resume()
  configure({ reducedMotion: 'always' })
  expect(pointer.available).toBe(false)
  callbacks.at(-1)!(10, 0, 100, 100, true)
  expect(pointer.active).toBe(false)
  configure({ reducedMotion: 'never' })
  pointer.update({ disabled: true })
  expect(pointer.available).toBe(false)
  pointer.update({ disabled: false })
  expect(pointer.available).toBe(true)
  scope.dispose()
  expect(pointer.disposed).toBe(true)
})

it('reports unavailable hover without inventing touch input and rejects invalid options before attachment', () => {
  const attach = vi.fn(() => null)
  vi.stubGlobal('JoltPointerInput', { attachChange: attach })
  expect(() =>
    pointerFollow(createView(), { coordinates: 'screen' as 'pixels' }),
  ).toThrow(/coordinate/)
  expect(attach).not.toHaveBeenCalled()
  const pointer = pointerFollow(createView(), { spring: false })
  expect(pointer.available).toBe(false)
  expect(pointer.presence.get()).toBe(0)
  pointer.dispose()
})

it('replaces the native observer when a loaded target receives a new native view', () => {
  const view = createView(),
    pointer = pointerFollow(view, { spring: false })
  callbacks[0]!(20, 0, 100, 100, true)
  ;(view as any).nativeViewProtected = {}
  pointer.refresh()
  expect(observers[0]!.dispose).toHaveBeenCalledOnce()
  callbacks[0]!(40, 0, 100, 100, true)
  expect(pointer.presence.get()).toBe(0)
  callbacks[1]!(10, 0, 100, 100, true)
  expect(pointer.x.get()).toBe(0.2)
  pointer.dispose()
})
