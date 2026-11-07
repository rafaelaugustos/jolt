import { describe, it, expect, vi } from 'vitest'
import { createWebScope, type WebMotionResource } from '../../src/web/scope.js'
import type { WebRuntime } from '../../src/web/public.js'

function owner(owners = new WeakMap<WebMotionResource, object>()) {
  return createWebScope({} as WebRuntime, owners, vi.fn())
}

describe('Web retained ownership', () => {
  it('retains static resources and settled playback until explicit release', async () => {
    const scope = owner(),
      staticResource = { dispose: vi.fn() }
    let settle!: () => void
    const playback = {
      stop: vi.fn(),
      finished: new Promise<void>((r) => {
        settle = r
      }),
    }
    scope.resource(() => staticResource)
    scope.retain(playback)
    settle()
    await playback.finished
    scope.suspend()
    scope.resume()
    expect(scope.size).toBe(2)
    expect(staticResource.dispose).not.toHaveBeenCalled()
    scope.release(playback)
    scope.release(playback)
    expect(playback.stop).toHaveBeenCalledOnce()
    scope.dispose()
    expect(staticResource.dispose).toHaveBeenCalledOnce()
  })
  it('preserves manual pause and cleans every owner even when one cleanup fails', () => {
    const scope = owner(),
      paused = { paused: true, pause: vi.fn(), play: vi.fn(), dispose: vi.fn() }
    const running = {
      suspended: false,
      suspend: vi.fn(),
      resume: vi.fn(),
      dispose: vi.fn(() => {
        throw Error('cleanup')
      }),
    }
    scope.retain(paused)
    scope.retain(running)
    scope.suspend()
    scope.resume()
    expect(paused.play).not.toHaveBeenCalled()
    expect(running.resume).toHaveBeenCalledOnce()
    expect(() => scope.dispose()).toThrow(AggregateError)
    expect(paused.dispose).toHaveBeenCalledOnce()
    expect(scope.size).toBe(0)
  })
  it('rejects foreign ownership and incompatible lifetimes without disposing the existing owner', () => {
    const owners = new WeakMap<WebMotionResource, object>(),
      a = owner(owners),
      b = owner(owners)
    const resource = { dispose: vi.fn() }
    a.retain(resource)
    expect(a.add(resource)).toBe(resource)
    const ordinary = { dispose: vi.fn() }
    a.add(ordinary)
    expect(() => a.retain(ordinary)).toThrow('different lifetime')
    expect(() => b.resource(() => resource)).toThrow('another Web motion scope')
    b.release(resource)
    expect(resource.dispose).not.toHaveBeenCalled()
    a.dispose()
    b.dispose()
    expect(resource.dispose).toHaveBeenCalledOnce()
  })
  it('cleans a newly constructed resource after reentrant disposal; ordinary settled playback still releases', async () => {
    const scope = owner(),
      resource = { dispose: vi.fn() }
    expect(() =>
      scope.resource(() => {
        scope.dispose()
        return resource
      }),
    ).toThrow('disposed')
    expect(resource.dispose).toHaveBeenCalledOnce()
    const another = owner(),
      playback = { stop: vi.fn(), finished: Promise.resolve(true) }
    another.add(playback)
    await playback.finished
    expect(another.size).toBe(0)
    another.dispose()
    expect(playback.stop).not.toHaveBeenCalled()
  })
})
