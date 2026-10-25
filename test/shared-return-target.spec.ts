import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  resolveReturnTarget,
  resolveListTarget,
  validateReturnTarget,
} from '../src/shared-navigation/return-target.js'
import { ReturnScope } from '../src/shared-navigation/return-signal.js'
import { View } from './shims/core.js'
import { driver, flush } from './helpers.js'
const tagged = () =>
  Object.assign(new View(), {
    sharedTransitionTag: 'item:42',
    getLocationInWindow: () => ({ x: 10, y: 20 }),
  })
const context = (page: View, scope: ReturnScope) => ({
  key: '42',
  tag: 'item:42',
  page: page as never,
  signal: scope.signal,
})
const layouts = async (n = 4) => {
  for (let i = 0; i < n; i++) {
    driver.layout()
    await flush()
  }
}
beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())
describe('bounded current return identity', () => {
  it('flushes deferred native cell layout before the provider reads the current page', async () => {
    const page = new View(),
      current = tagged(),
      scope = new ReturnScope()
    const flushNative = vi.fn(() => {
      page.children = [current]
    })
    page.nativeViewProtected = { layoutIfNeeded: flushNative }
    const result = resolveReturnTarget(
      { key: '42', resolve: () => page.children[0] as never },
      'item:42',
      page as never,
      scope.signal,
    )
    expect(flushNative).not.toHaveBeenCalled()
    await layouts()
    expect(await result).toEqual({ view: current })
    expect(flushNative).toHaveBeenCalled()
  })
  it('resolves a freshly realized view instead of retaining the original cell', async () => {
    const page = new View(),
      old = tagged(),
      current = tagged(),
      scope = new ReturnScope()
    page.children = [old]
    const resolve = vi.fn(() => {
      page.children = [current]
      return current as never
    })
    const result = resolveReturnTarget(
      { key: '42', resolve },
      'item:42',
      page as never,
      scope.signal,
    )
    expect(resolve).not.toHaveBeenCalled()
    await layouts()
    expect(await result).toEqual({ view: current })
    expect(resolve).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('rejects a view that was recycled again before final measurement', async () => {
    const page = new View(),
      old = tagged(),
      current = tagged(),
      scope = new ReturnScope()
    page.children = [current]
    const result = resolveReturnTarget(
      { key: '42', resolve: () => old as never },
      'item:42',
      page as never,
      scope.signal,
    )
    await layouts()
    expect(await result).toEqual({ reason: 'stale-target' })
  })
  it('rejects ambiguous identities before any overlay can hide a cell', async () => {
    const page = new View(),
      a = tagged(),
      scope = new ReturnScope()
    page.children = [a, tagged()]
    const result = resolveReturnTarget(
      { key: '42', resolve: () => a as never },
      'item:42',
      page as never,
      scope.signal,
    )
    await layouts()
    expect(await result).toEqual({ reason: 'duplicate-target' })
  })
  it('ignores a detached measurement/recycle cell carrying the same item tag', async () => {
    const page = new View(),
      current = tagged(),
      cached = tagged(),
      scope = new ReturnScope()
    Object.assign(cached, { getLocationInWindow: () => undefined })
    Object.assign(current, { getLocationInWindow: () => ({ x: 10, y: 20 }) })
    page.children = [cached, current]
    const result = resolveReturnTarget(
      { key: '42', resolve: () => current as never },
      'item:42',
      page as never,
      scope.signal,
    )
    await layouts()
    expect(await result).toEqual({ view: current })
  })
  it('bounds a resolver that never settles, aborts it and ignores a late view', async () => {
    const page = new View(),
      scope = new ReturnScope()
    let signal: ReturnScope['signal'] | undefined, late!: (v: any) => void
    const result = resolveReturnTarget(
      {
        key: '42',
        timeout: 40,
        resolve: (c) => {
          signal = c.signal
          return new Promise((r) => (late = r))
        },
      },
      'item:42',
      page as never,
      scope.signal,
    )
    await layouts(1)
    await vi.advanceTimersByTimeAsync(40)
    expect(await result).toEqual({ reason: 'target-timeout' })
    expect(signal?.aborted).toBe(true)
    late(tagged())
    await layouts()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('cancels before layout without invoking the application resolver', async () => {
    const page = new View(),
      scope = new ReturnScope(),
      resolve = vi.fn()
    const result = resolveReturnTarget(
      { key: '42', resolve },
      'item:42',
      page as never,
      scope.signal,
    )
    scope.abort()
    await layouts()
    expect(await result).toEqual({ reason: 'target-cancelled' })
    expect(resolve).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('turns a deleted item or failed provider into explicit fallback', async () => {
    const page = new View(),
      scope = new ReturnScope()
    const missing = resolveReturnTarget(
      { key: '42', resolve: () => undefined },
      'item:42',
      page as never,
      scope.signal,
    )
    await layouts()
    expect(await missing).toEqual({ reason: 'missing-target' })
    const failed = resolveReturnTarget(
      { key: '42', resolve: () => Promise.reject(Error('scroll refused')) },
      'item:42',
      page as never,
      scope.signal,
    )
    await layouts()
    expect(await failed).toEqual({ reason: 'target-resolution-failed' })
  })
  it('looks up the new row index when a list reorders while realizing its cell', async () => {
    const page = new View(),
      scope = new ReturnScope(),
      view = tagged(),
      list = Object.assign(new View(), { scrollToIndex: vi.fn() })
    let index = 7
    const result = resolveListTarget(context(page, scope), {
      list: list as never,
      indexOf: () => index,
      viewForKey: () => view as never,
    })
    expect(list.scrollToIndex).toHaveBeenCalledWith(7)
    index = 12
    await layouts()
    expect(list.scrollToIndex).toHaveBeenLastCalledWith(12)
    expect(await result).toBe(view)
  })
  it('waits for estimated row offsets to stabilize before returning the live cell', async () => {
    const page = new View(),
      scope = new ReturnScope(),
      view = tagged()
    const list = Object.assign(new View(), { scrollToIndex: vi.fn() })
    let y = 20
    view.getLocationInWindow = () => ({ x: 10, y })
    let settled = false
    const result = resolveListTarget(context(page, scope), {
      list: list as never,
      indexOf: () => 29,
      viewForKey: () => view as never,
    }).then((value) => {
      settled = true
      return value
    })
    await layouts(1)
    expect(settled).toBe(false)
    y = 29.33
    await layouts(1)
    expect(settled).toBe(false)
    await layouts(1)
    expect(await result).toBe(view)
  })
  it('falls back after bounded realization when cell geometry keeps moving', async () => {
    const page = new View(),
      scope = new ReturnScope(),
      view = tagged()
    const list = Object.assign(new View(), { scrollToIndex: vi.fn() })
    let y = 0
    view.getLocationInWindow = () => ({ x: 10, y: y++ })
    const result = resolveListTarget(context(page, scope), {
      list: list as never,
      indexOf: () => 29,
      viewForKey: () => view as never,
    })
    await layouts(5)
    expect(await result).toBeUndefined()
    expect(list.scrollToIndex).toHaveBeenCalledTimes(4)
  })
  it('does not scroll to a deleted index and rejects a cell with the wrong key tag', async () => {
    const page = new View(),
      scope = new ReturnScope(),
      list = Object.assign(new View(), { scrollToIndex: vi.fn() })
    expect(
      await resolveListTarget(context(page, scope), {
        list: list as never,
        indexOf: () => -1,
        viewForKey: () => undefined,
      }),
    ).toBeUndefined()
    expect(list.scrollToIndex).not.toHaveBeenCalled()
    const result = resolveListTarget(context(page, scope), {
      list: list as never,
      indexOf: () => 2,
      viewForKey: () => new View() as never,
    })
    await layouts(5)
    expect(await result).toBeUndefined()
    expect(list.scrollToIndex).toHaveBeenCalledTimes(4)
  })
  it.each([
    { key: '', resolve: () => {} },
    { key: 'x', resolve: null },
    { key: 'x', resolve: () => {}, timeout: 5001 },
    { key: 'x', resolve: () => {}, timeout: 0 },
  ])('validates %j before taking ownership', (value) =>
    expect(() => validateReturnTarget(value as never)).toThrow(),
  )
})
