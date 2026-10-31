import { Application } from './shims/core.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { motionScope } from '../src/index.js'
import { playbackSource } from '../src/playback.js'
import { createView, driver, flush } from './helpers.js'

const scopes: ReturnType<typeof motionScope>[] = []
const own = () => {
  const scope = motionScope()
  scopes.push(scope)
  return scope
}
function background(value: boolean) {
  Application.suspended = value
  Application.notify({
    eventName: value ? Application.suspendEvent : Application.resumeEvent,
  })
}
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.dispose())
  Application.suspended = false
})

describe('motion scope app background ownership', () => {
  it('holds endless path, stagger, reverse and layered clocks across root unload/reload', async () => {
    const scope = own(),
      views = [createView(), createView(), createView(), createView()]
    const options = { duration: 1400, repeat: Infinity, ease: 'linear' } as const
    const handles = [
      scope.animate(views[0]!, { path: 'M0 0 L100 100', opacity: [0.5, 1] }, options),
      scope.animate(
        [views[1]!, views[2]!],
        { scale: [0.7, 1.2, 0.7] },
        { ...options, stagger: 430 },
      ),
      scope.animate(
        views[3]!,
        { y: [0, -24] },
        { ...options, repeatType: 'reverse', layer: 'idle' },
      ),
      scope.animate(
        views[3]!,
        { y: [0, 8] },
        { ...options, duration: 1700, repeatType: 'reverse', layer: 'accent' },
      ),
    ]
    const ended = handles.map((handle) => {
      const done = vi.fn()
      void handle.finished.then(done)
      return done
    })
    for (const wait of [3000, 20_000, 3000]) {
      driver.advance(743)
      const positions = handles.map((handle) => playbackSource(handle).read().time)
      background(true)
      views.forEach((view) => view.notify({ eventName: 'unloaded' }))
      expect(handles.every((handle) => handle.paused)).toBe(true)
      driver.advance(wait)
      await flush()
      handles.forEach((handle, index) =>
        expect(playbackSource(handle).read().time).toBeCloseTo(positions[index]!),
      )
      ended.forEach((done) => expect(done).not.toHaveBeenCalled())
      // NativeScript's iOS resume event precedes root loaded.
      background(false)
      views.forEach((view) => view.notify({ eventName: 'loaded' }))
      driver.advance(170)
      handles.forEach((handle, index) => {
        expect(handle.paused).toBe(false)
        expect(playbackSource(handle).read().time).toBeCloseTo(positions[index]! + 170)
      })
    }
  })

  it('preserves manual pauses and independent scope suspension reasons', () => {
    const scope = own(),
      view = createView()
    const running = scope.animate(view, { x: 100 }, { duration: 1000, repeat: Infinity })
    const held = scope.animate(view, { y: 100 }, { duration: 1000, repeat: Infinity })
    held.pause()
    background(true)
    scope.suspend() // A KeepAlive deactivation while the app is already suspended.
    background(false)
    expect(scope.suspended).toBe(true)
    expect(running.paused).toBe(true)
    scope.resume()
    expect(running.paused).toBe(false)
    expect(held.paused).toBe(true)
    scope.suspend()
    background(true)
    scope.resume() // Activating a cached component must not override app suspension.
    expect(scope.suspended).toBe(true)
    expect(running.paused).toBe(true)
    background(false)
    expect(running.paused).toBe(false)
    expect(held.paused).toBe(true)
  })

  it('does not revive stopped, reset, disposed or ordinarily unloaded work', async () => {
    const scope = own(),
      view = createView()
    const handle = scope.animate(view, { x: 100 }, { repeat: Infinity })
    background(true)
    handle.stop()
    await flush()
    background(false)
    expect(await handle).toBe(false)
    expect(scope.size).toBe(0)
    const detached = scope.animate(view, { x: 100 }, { repeat: Infinity })
    view.notify({ eventName: 'unloaded' })
    expect(await detached).toBe(false)
    for (const action of ['reset', 'dispose'] as const) {
      const current = scope.animate(view, { x: 100 }, { repeat: Infinity })
      background(true)
      scope[action]()
      background(false)
      expect(await current).toBe(false)
      expect(scope.size).toBe(0)
    }
  })

  it('releases app listeners when empty and supports work created while backgrounded', async () => {
    const baseline = ['suspend', 'resume'].map((event) =>
      Application.listenerCount(event),
    )
    const scope = own(),
      view = createView()
    for (let i = 0; i < 10; i++) {
      background(true)
      const one = scope.animate(view, { x: 100 }, { duration: 1000 })
      const two = scope.animate(view, { y: 100 }, { duration: 1000 })
      expect(one.paused).toBe(true)
      expect(two.paused).toBe(true)
      const cleanup = vi.fn(),
        setup = vi.fn(() => cleanup)
      const remove = scope.use(setup)
      expect(setup).not.toHaveBeenCalled()
      background(false)
      expect(setup).toHaveBeenCalledOnce()
      driver.advance(1001)
      await flush()
      remove()
      expect(scope.size).toBe(0)
      expect(cleanup).toHaveBeenCalledOnce()
      expect(
        ['suspend', 'resume'].map((event) => Application.listenerCount(event)),
      ).toEqual(baseline)
    }
  })

  it('keeps finite delays and does not reclaim a property replaced in background', async () => {
    const scope = own(),
      other = own(),
      view = createView()
    const first = scope.animate(
      view,
      { x: [0, 100], y: [0, 80] },
      {
        duration: 1000,
        delay: 500,
        ease: 'linear',
      },
    )
    driver.advance(200)
    background(true)
    driver.advance(20_000)
    const replacement = other.animate(
      view,
      { x: [30, 200] },
      { duration: 1000, ease: 'linear' },
    )
    background(false)
    driver.advance(300)
    expect(playbackSource(first).read().time).toBeCloseTo(500)
    driver.advance(1001)
    expect(await first).toBe(false)
    expect(await replacement).toBe(true)
    expect(view.translateX).toBe(200)
    expect(view.translateY).toBe(80)
  })

  it('does not duplicate subscription teardown for overlapping app and manual suspension', () => {
    const scope = own(),
      cleanup = vi.fn(),
      setup = vi.fn(() => cleanup)
    const baseline = Application.listenerCount('resume')
    scope.use(setup)
    background(true)
    background(true)
    scope.suspend()
    background(false)
    expect(setup).toHaveBeenCalledOnce()
    expect(cleanup).toHaveBeenCalledOnce()
    scope.resume()
    expect(setup).toHaveBeenCalledTimes(2)
    scope.dispose()
    background(true)
    background(false)
    expect(setup).toHaveBeenCalledTimes(2)
    expect(cleanup).toHaveBeenCalledTimes(2)
    expect(Application.listenerCount('resume')).toBe(baseline)
  })
})
