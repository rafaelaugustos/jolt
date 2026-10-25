import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { View as CoreView } from '@nativescript/core'
import {
  predictiveBack,
  type PredictiveBack,
  type PredictiveBackOptions,
  type PredictiveBackValues,
} from '../src/predictive-back/index.js'
import { configure } from '../src/config.js'
import { View } from './shims/core.js'
import './helpers.js'

vi.mock('@nativescript/core', async (original) => ({
  ...(await original<typeof import('./shims/core.js')>()),
  isAndroid: true,
  isIOS: false,
}))
const handles: PredictiveBack[] = []
let attach: ReturnType<typeof vi.fn>, progress: number
let event: (code: number, progress?: number, velocity?: number, edge?: number) => void
let native: {
  completeCommit: ReturnType<typeof vi.fn>
  handleOnBackPressed: ReturnType<typeof vi.fn>
  getProgress: () => number
  dispose: ReturnType<typeof vi.fn>
  cancel: ReturnType<typeof vi.fn>
  setInputEnabled: ReturnType<typeof vi.fn>
  setMotion: ReturnType<typeof vi.fn>
}
beforeEach(() => {
  vi.useFakeTimers()
  configure({ reducedMotion: 'never' })
  progress = 0
  native = {
    completeCommit: vi.fn((accepted) => {
      event(accepted ? 6 : 5)
      if (accepted) event(7)
    }),
    handleOnBackPressed: vi.fn(() => {
      event(3)
      event(4)
    }),
    getProgress: () => progress,
    dispose: vi.fn(() => event(7)),
    cancel: vi.fn(),
    setInputEnabled: vi.fn(),
    setMotion: vi.fn(),
  }
  attach = vi.fn((_view, _config, listener) => {
    event = (code, p = 0, velocity = 0, edge = -1) =>
      listener.onState(code, p, velocity, edge)
    return native
  })
  vi.stubGlobal('org', {
    rafaelaugusto: {
      jolt: {
        PredictiveBackSession: {
          attach,
          Listener: class {
            constructor(listener: object) {
              Object.assign(this, listener)
            }
          },
        },
      },
    },
  })
})
afterEach(() => {
  handles.splice(0).forEach((h) => h.dispose())
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
function fixture(options: Partial<PredictiveBackOptions> = {}, view = new View()) {
  const commit = vi.fn(() => true),
    onState = vi.fn()
  const control = predictiveBack(
    view as unknown as CoreView,
    { x: [0, 30], scale: [1, 0.9] },
    { commit, onState, ...options },
  )
  handles.push(control)
  return { view, control, commit, onState }
}
const flush = () => Promise.resolve()
describe('predictive back ownership and commit boundary', () => {
  it('passes relative endpoints to native and polls progress without JS notifications', () => {
    const f = fixture()
    expect(f.control.supported).toBe(true)
    expect(JSON.parse(attach.mock.calls[0]![1])).toMatchObject({
      values: { x: [0, 30], scale: [1, 0.9] },
      mirrorX: true,
      enabled: true,
      reduced: false,
    })
    progress = 0.6
    expect(f.control.progress).toBe(0.6)
    expect(f.onState).not.toHaveBeenCalled()
    event(1, 0, 0, 1)
    event(2, 0.6, -2, 1)
    event(5, 0, 0, 1)
    expect(f.commit).not.toHaveBeenCalled()
    expect(f.onState).toHaveBeenCalledWith({
      state: 'cancelling',
      edge: 'right',
      release: { progress: 0.6, velocity: -2 },
    })
    expect(f.onState).toHaveBeenLastCalledWith({
      state: 'idle',
      edge: 'right',
      outcome: 'cancelled',
    })
  })
  it('does not navigate until native settles an OS commit and cannot double commit from buttons', async () => {
    const f = fixture()
    event(1)
    event(3, 0.2, 3)
    f.control.back()
    expect(f.commit).not.toHaveBeenCalled()
    event(4)
    f.control.back()
    expect(f.commit).toHaveBeenCalledExactlyOnceWith({ animated: false })
    await flush()
    expect(native.completeCommit).toHaveBeenCalledExactlyOnceWith(true)
    expect(f.control.state).toBe('disposed')
    expect(f.view.listenerCount('unloaded')).toBe(0)
  })
  it('rolls back a rejected router guard and permits another attempt', async () => {
    const commit = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const f = fixture({ commit })
    f.control.back()
    await flush()
    expect(f.control.state).toBe('idle')
    expect(f.onState).toHaveBeenLastCalledWith({
      state: 'idle',
      outcome: 'cancelled',
      reason: 'rejected',
    })
    f.control.back()
    await flush()
    expect(f.control.state).toBe('disposed')
    expect(commit).toHaveBeenCalledTimes(2)
  })
  it.each(['throw', 'reject'] as const)('restores after a commit %s', async (kind) => {
    const f = fixture({
      commit: () => {
        if (kind === 'throw') throw Error('guard')
        return Promise.reject(Error('guard'))
      },
    })
    f.control.back()
    await flush()
    expect(f.onState).toHaveBeenLastCalledWith({
      state: 'idle',
      outcome: 'cancelled',
      reason: 'error',
    })
  })
  it('bounds async waiting and ignores a late result without changing the next attempt', async () => {
    let resolve!: (value: boolean) => void
    const f = fixture({
      commitTimeout: 50,
      commit: () =>
        new Promise<boolean>((r) => {
          resolve = r
        }),
    })
    f.control.back()
    await vi.advanceTimersByTimeAsync(50)
    expect(f.onState).toHaveBeenLastCalledWith({
      state: 'idle',
      outcome: 'cancelled',
      reason: 'timeout',
    })
    const late = resolve
    f.control.back()
    late(true)
    await flush()
    expect(f.control.state).toBe('committing')
    expect(native.completeCommit).toHaveBeenCalledTimes(1)
    resolve(false)
    await flush()
    expect(f.control.state).toBe('idle')
  })
  it('allows a route to unload while commit resolves, then cleans up exactly once', async () => {
    let resolve!: () => void
    const f = fixture({
      commit: () =>
        new Promise<void>((r) => {
          resolve = r
        }),
    })
    f.control.back()
    f.view.notify({ eventName: 'unloaded' })
    expect(native.dispose).not.toHaveBeenCalled()
    resolve()
    await flush()
    expect(f.control.state).toBe('disposed')
    f.control.dispose()
    expect(f.onState.mock.calls.filter(([e]) => e.state === 'disposed')).toHaveLength(1)
  })
  it('disposal invalidates pending completion and releases exclusive view ownership', async () => {
    let resolve!: (value: boolean) => void
    const f = fixture({
      commit: () =>
        new Promise<boolean>((r) => {
          resolve = r
        }),
    })
    expect(() => fixture({}, f.view)).toThrow('already has')
    f.control.back()
    f.control.dispose()
    const next = fixture({}, f.view)
    resolve(true)
    await flush()
    expect(native.completeCommit).not.toHaveBeenCalled()
    expect(next.control.state).toBe('idle')
    expect(vi.getTimerCount()).toBe(0)
  })
  it('unload cancels a held gesture without invoking navigation', () => {
    const f = fixture()
    event(1)
    f.view.notify({ eventName: 'unloaded' })
    expect(f.control.state).toBe('disposed')
    expect(f.commit).not.toHaveBeenCalled()
  })
  it('disable delegates to native and ignores explicit back; reduced motion updates native', () => {
    const f = fixture()
    f.control.enabled = false
    f.control.back()
    expect(native.setInputEnabled).toHaveBeenCalledWith(false)
    expect(f.commit).not.toHaveBeenCalled()
    configure({ reducedMotion: 'always' })
    expect(native.setMotion).toHaveBeenCalledWith(true, 1)
    f.control.cancel()
    expect(native.cancel).toHaveBeenCalledOnce()
  })
  it('can dispose from a lifecycle observer before the commit callback', () => {
    let control: PredictiveBack
    const f = fixture({
      onState: (e) => {
        if (e.state === 'committing') control.dispose()
      },
    })
    control = f.control
    f.control.back()
    expect(f.commit).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('observer exceptions do not strand the native session', async () => {
    const f = fixture({
      onState: () => {
        throw Error('observer')
      },
    })
    f.control.back()
    await flush()
    expect(f.control.state).toBe('disposed')
  })
  it.each(['missing-plugin', 'unattached-or-old-android'])(
    'keeps normal input untouched on %s and supports an explicit fallback button',
    async (kind) => {
      if (kind === 'missing-plugin') vi.stubGlobal('org', undefined)
      else attach.mockReturnValue(null)
      const f = fixture()
      expect(f.control.supported).toBe(false)
      expect(f.commit).not.toHaveBeenCalled()
      f.control.back()
      await flush()
      expect(f.commit).toHaveBeenCalledOnce()
      expect(native.handleOnBackPressed).not.toHaveBeenCalled()
    },
  )
})
describe('predictive back validates before attaching native input', () => {
  it.each([
    { x: [1, 4] },
    { scale: [1, 0] },
    { opacity: [1, 2] },
    { x: [0, Infinity] },
    { scale: [1, 0.9], scaleX: [1, 0.8] },
    { backgroundColor: [0, 1] },
    {},
  ])('rejects %j', (values) => {
    expect(() =>
      predictiveBack(new View() as unknown as CoreView, values as PredictiveBackValues, {
        commit() {},
      }),
    ).toThrow()
    expect(attach).not.toHaveBeenCalled()
  })
  it.each([
    { commitTimeout: 0 },
    { commitTimeout: 10001 },
    { spring: 'unknown' },
    { spring: '__proto__' },
    { spring: 42 },
    { spring: [] },
    { spring: { damping: -1 } },
    { spring: { duration: NaN } },
    { spring: { mass: 0 } },
    { spring: { delay: 10 } },
    { commit: null },
  ])('rejects invalid options %j', (options) => {
    expect(() => fixture(options as unknown as Partial<PredictiveBackOptions>)).toThrow()
    expect(attach).not.toHaveBeenCalled()
  })
})
