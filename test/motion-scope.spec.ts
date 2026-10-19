import { describe, expect, it, vi } from 'vitest'
import { animate, motionScope } from '../src/index.js'
import { createView, driver, flush } from './helpers.js'

describe('motion scopes', () => {
  it('cancels pending load, delayed work and scheduled sequence steps', async () => {
    const scope = motionScope(),
      view = createView(),
      unloaded = createView()
    unloaded.unload()
    const waiting = scope.animate(unloaded, { x: [0, 80] })
    const delayed = scope.animate(view, { y: 80 }, { delay: 500 })
    const callback = vi.fn(() => animate(view, { rotate: 90 }))
    const timeline = scope.sequence([[view, { opacity: 0 }, { duration: 200 }], callback])
    scope.dispose()
    scope.dispose()
    expect(await waiting).toBe(false)
    expect(await delayed).toBe(false)
    expect(await timeline).toBe(false)
    expect(unloaded.listenerCount('loaded')).toBe(0)
    unloaded.load()
    driver.advance(1000)
    await flush()
    expect(callback).not.toHaveBeenCalled()
    expect(scope.size).toBe(0)
    expect(() => scope.animate(view, { x: 20 })).toThrow(/disposed/)
  })
  it('never stops newer ownership or unrelated properties in another scope', async () => {
    const a = motionScope(),
      b = motionScope(),
      view = createView()
    const first = a.animate(view, { x: 100, y: 80 })
    driver.advance(100)
    const second = b.animate(view, { x: 200 })
    const opacity = b.animate(view, { opacity: 0 })
    a.dispose()
    expect(await first).toBe(false)
    expect(driver.last('x').stopped).toBe(false)
    expect(driver.last('opacity').stopped).toBe(false)
    driver.advance(10000)
    expect(await second).toBe(true)
    expect(await opacity).toBe(true)
    await flush()
    expect(b.size).toBe(0)
    b.dispose()
  })
  it('suspends playback without reviving a manually paused animation', async () => {
    const scope = motionScope(),
      view = createView()
    const running = scope.animate(view, { x: 100 }, { duration: 1000, ease: 'linear' })
    const paused = scope.animate(view, { y: 80 }, { duration: 1000 })
    paused.pause()
    driver.advance(200)
    scope.suspend()
    scope.suspend()
    expect(running.paused).toBe(true)
    const progress = running.progress
    driver.advance(4000)
    expect(running.progress).toBeCloseTo(progress)
    expect(() => scope.animate(view, { rotate: 40 })).toThrow(/suspended/)
    scope.resume()
    scope.resume()
    expect(paused.paused).toBe(true)
    expect(running.paused).toBe(false)
    driver.advance(1000)
    expect(await running).toBe(true)
    scope.dispose()
    expect(await paused).toBe(false)
  })
  it('detaches and recreates subscriptions while preserving disposal ownership', () => {
    const scope = motionScope(),
      dispose = vi.fn(),
      setup = vi.fn(() => dispose)
    const remove = scope.use(setup)
    expect(scope.size).toBe(1)
    scope.suspend()
    expect(dispose).toHaveBeenCalledTimes(1)
    scope.resume()
    expect(setup).toHaveBeenCalledTimes(2)
    remove()
    remove()
    scope.dispose()
    expect(dispose).toHaveBeenCalledTimes(2)
    expect(scope.size).toBe(0)
  })
  it('defers new subscriptions registered while suspended and cancels non-playable work', async () => {
    const scope = motionScope(),
      view = createView()
    const sequence = scope.sequence([
      [view, { x: 100 }],
      [view, { x: 0 }],
    ])
    const cleanup = vi.fn()
    scope.add(cleanup)
    scope.suspend()
    expect(await sequence).toBe(false)
    expect(cleanup).toHaveBeenCalledOnce()
    const setup = vi.fn(() => vi.fn())
    scope.use(setup)
    expect(setup).not.toHaveBeenCalled()
    scope.resume()
    expect(setup).toHaveBeenCalledOnce()
    scope.dispose()
  })
  it('cleans every resource even if one cleanup throws, without running it twice', () => {
    const scope = motionScope(),
      cleanup = vi.fn()
    scope.add(() => {
      throw new Error('bad cleanup')
    })
    scope.add(cleanup)
    expect(() => scope.dispose()).toThrow(AggregateError)
    expect(cleanup).toHaveBeenCalledOnce()
    expect(scope.size).toBe(0)
    expect(() => scope.dispose()).not.toThrow()
  })
  it('rejects sharing one resource between scopes and adopts duplicates only once', () => {
    const a = motionScope(),
      b = motionScope(),
      cleanup = vi.fn()
    expect(a.add(cleanup)).toBe(cleanup)
    a.add(cleanup)
    expect(a.size).toBe(1)
    expect(() => b.add(cleanup)).toThrow(/another scope/)
    b.dispose()
    expect(cleanup).not.toHaveBeenCalled()
    a.dispose()
    expect(cleanup).toHaveBeenCalledOnce()
  })
  it('cancels a pressed animation and removes native listeners on suspension/disposal', () => {
    const scope = motionScope(),
      view = createView()
    scope.press(view)
    view.touch('down')
    scope.suspend()
    expect(driver.last('scaleX').stopped).toBe(true)
    expect(view.listenerCount('touch')).toBe(0)
    scope.resume()
    expect(view.listenerCount('touch')).toBe(1)
    view.touch('down')
    animate(view, { scale: 2 })
    scope.dispose()
    expect(driver.last('scaleX').stopped).toBe(false)
    expect(view.listenerCount('touch')).toBe(0)
  })
  it('unload does not destroy a cached scope; reset supports new recycled item work', async () => {
    const scope = motionScope(),
      view = createView()
    const first = scope.animate(view, { x: 100 })
    view.notify({ eventName: 'unloaded' })
    view.unload()
    expect(await first).toBe(false)
    expect(scope.disposed).toBe(false)
    scope.reset()
    view.load()
    const second = scope.animate(view, { x: 200 })
    scope.reset()
    expect(await second).toBe(false)
    const third = scope.animate(view, { x: 300 })
    driver.advance(10000)
    expect(await third).toBe(true)
    scope.dispose()
  })
  it('repeated attachment returns listener and resource counts to baseline', async () => {
    const view = createView()
    for (let i = 0; i < 30; i++) {
      const scope = motionScope()
      scope.press(view)
      scope.animate(view, 'spin', { repeat: Infinity })
      view.touch('down')
      scope.dispose()
      await flush()
      expect(scope.size).toBe(0)
      expect(view.listenerCount('touch')).toBe(0)
      expect(view.listenerCount('unloaded')).toBe(0)
    }
  })
})

describe('scope reentrancy', () => {
  it('cleans a resource returned by setup after setup disposed its scope', () => {
    const scope = motionScope(),
      cleanup = vi.fn()
    scope.use(() => {
      scope.dispose()
      return cleanup
    })
    expect(cleanup).toHaveBeenCalledOnce()
    expect(scope.size).toBe(0)
  })
  it('does not leak a sequence created by a callback that disposes the scope', () => {
    const scope = motionScope(),
      view = createView()
    expect(() =>
      scope.sequence([
        () => {
          scope.dispose()
          return animate(view, { x: 100 })
        },
      ]),
    ).toThrow(/disposed/)
    expect(driver.last('x').stopped).toBe(true)
  })
  it('does not allow cleanup to repopulate a recycled scope', () => {
    const scope = motionScope(),
      cleanup = vi.fn()
    scope.add(() => {
      scope.add(cleanup)
    })
    expect(() => scope.reset()).toThrow(AggregateError)
    expect(scope.size).toBe(0)
    scope.add(cleanup)
    scope.dispose()
    expect(cleanup).toHaveBeenCalledOnce()
  })
})
