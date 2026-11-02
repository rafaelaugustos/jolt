import { expect, it, vi } from 'vitest'
import {
  createWebScope,
  type WebMotionResource,
  type WebMotionScope,
} from '../../src/web/scope.js'
import type { WebRuntime } from '../../src/web/public.js'

function context() {
  const owners = new WeakMap<WebMotionResource, object>()
  const scopes = new Set<WebMotionScope>()
  const runtime = {
    scope(setup?: (scope: WebMotionScope) => void) {
      const scope = createWebScope(runtime as WebRuntime, owners, () =>
        scopes.delete(scope),
      )
      scopes.add(scope)
      try {
        setup?.(scope)
      } catch (error) {
        scope.dispose()
        throw error
      }
      return scope
    },
  }
  return { ...runtime, scopes }
}

it('adopts once, borrows without ownership and rejects competing owners', () => {
  const runtime = context(),
    a = runtime.scope(),
    b = runtime.scope()
  const resource = { dispose: vi.fn() },
    shared = { dispose: vi.fn() }
  expect(a.add(resource)).toBe(resource)
  a.add(resource)
  b.borrow(resource)
  a.borrow(shared)
  expect(() => b.add(resource)).toThrow(/another/)
  b.dispose()
  expect(resource.dispose).not.toHaveBeenCalled()
  a.dispose()
  a.dispose()
  expect(resource.dispose).toHaveBeenCalledTimes(1)
  expect(shared.dispose).not.toHaveBeenCalled()
  expect(runtime.scopes.size).toBe(0)
})

it('cleans partial nested setup, then leaves its sibling active', () => {
  const runtime = context(),
    scope = runtime.scope()
  const sibling = scope.add({ dispose: vi.fn() }),
    partial = { dispose: vi.fn() }
  expect(() =>
    scope.use((child) => {
      child.add(partial)
      child.scope((nested) => nested.add({ dispose: vi.fn() }))
      throw new Error('failed setup')
    }),
  ).toThrow('failed setup')
  expect(partial.dispose).toHaveBeenCalledOnce()
  expect(sibling.dispose).not.toHaveBeenCalled()
  expect(runtime.scopes.size).toBe(1)
  scope.dispose()
})

it('pauses only playing handles, recreates subscriptions and cancels non-playable work', () => {
  const runtime = context(),
    scope = runtime.scope()
  const playback = { pause: vi.fn(), play: vi.fn(), stop: vi.fn(), paused: false }
  const manual = { pause: vi.fn(), play: vi.fn(), stop: vi.fn(), paused: true }
  const binding = { dispose: vi.fn() },
    unsubscribe = vi.fn()
  const setup = vi.fn(() => unsubscribe)
  scope.add(playback)
  scope.add(manual)
  scope.add(binding)
  scope.use(setup)
  scope.suspend()
  scope.suspend()
  expect(playback.pause).toHaveBeenCalledOnce()
  expect(manual.pause).not.toHaveBeenCalled()
  expect(binding.dispose).toHaveBeenCalledOnce()
  expect(unsubscribe).toHaveBeenCalledOnce()
  scope.resume()
  scope.resume()
  expect(playback.play).toHaveBeenCalledOnce()
  expect(manual.play).not.toHaveBeenCalled()
  expect(setup).toHaveBeenCalledTimes(2)
  scope.dispose()
  expect(unsubscribe).toHaveBeenCalledTimes(2)
})

it('rejects work after disposal without adopting it and continues cleanup after errors', () => {
  const scope = context().scope(),
    last = vi.fn()
  scope.add(last)
  scope.add(() => {
    throw new Error('cleanup')
  })
  expect(() => scope.dispose()).toThrow(AggregateError)
  expect(last).toHaveBeenCalledOnce()
  const outside = { dispose: vi.fn() }
  expect(() => scope.add(outside)).toThrow(/disposed/)
  expect(outside.dispose).not.toHaveBeenCalled()
  expect(scope.size).toBe(0)
  scope.dispose()
})

it('releases completed playback and resets children without destroying a reusable scope', async () => {
  const runtime = context(),
    scope = runtime.scope()
  const stop = vi.fn()
  scope.add({ stop, finished: Promise.resolve(true) })
  await Promise.resolve()
  expect(scope.size).toBe(0)
  const child = scope.scope(),
    cleanup = vi.fn()
  child.add(cleanup)
  scope.reset()
  expect(child.disposed).toBe(true)
  expect(cleanup).toHaveBeenCalledOnce()
  expect(scope.disposed).toBe(false)
  scope.dispose()
  expect(stop).not.toHaveBeenCalled()
  expect(runtime.scopes.size).toBe(0)
})

it('handles suspension/disposal inside setup without leaking late returned resources', () => {
  const runtime = context(),
    scope = runtime.scope(),
    early = vi.fn(),
    late = vi.fn()
  scope.use((child) => {
    child.add(early)
    scope.dispose()
    return late
  })
  expect(early).toHaveBeenCalledOnce()
  expect(late).toHaveBeenCalledOnce()
  expect(runtime.scopes.size).toBe(0)
})

it('defers use while suspended, removes pending setup and rejects async setup', () => {
  const runtime = context(),
    scope = runtime.scope(),
    setup = vi.fn()
  scope.suspend()
  const remove = scope.use(setup)
  expect(setup).not.toHaveBeenCalled()
  remove()
  remove()
  scope.resume()
  expect(setup).not.toHaveBeenCalled()
  expect(() => scope.use((() => Promise.resolve()) as never)).toThrow(/synchronous/)
  expect(runtime.scopes.size).toBe(1)
  scope.dispose()
})
