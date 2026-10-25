import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Application, type Frame } from '@nativescript/core'
import {
  sharedNavigationEntry,
  type SharedNavigationEntry,
  type SharedNavigationEntryOptions,
} from '../src/shared-navigation/entry.js'
import { interactiveNavigation } from '../src/interactive-navigation/index.js'
import { predictiveBack } from '../src/predictive-back/index.js'
import { sharedNavigation } from '../src/shared-navigation/index.js'
import { nativeBackSessions } from '../src/predictive-back/presentation.js'
import { navigationScopes } from '../src/shared-navigation/scope.js'
import { View } from './shims/core.js'
import './helpers.js'
const platform = vi.hoisted(() => ({ ios: true }))
vi.mock('@nativescript/core', async (original) => ({
  ...(await original<typeof import('./shims/core.js')>()),
  get isIOS() {
    return platform.ios
  },
  get isAndroid() {
    return !platform.ios
  },
}))
vi.mock('../src/interactive-navigation/index.js', () => ({
  interactiveNavigation: vi.fn(),
}))
vi.mock('../src/predictive-back/index.js', () => ({ predictiveBack: vi.fn() }))
vi.mock('../src/shared-navigation/index.js', () => ({ sharedNavigation: vi.fn() }))
const handles: SharedNavigationEntry[] = []
let ios: any, android: any, scene: any, bridge: any, forward: any
let iosEvent: (event: any) => void,
  androidEvent: (event: any) => void,
  forwardDone: (result: any) => void
beforeEach(() => {
  vi.useFakeTimers()
  platform.ios = true
  scene = {
    pixels: () => 100,
    bind: vi.fn(),
    isAnimating: () => true,
    validSource: () => true,
    dispose: vi.fn(),
  }
  bridge = { setSharedScene: vi.fn() }
  vi.stubGlobal('org', {
    rafaelaugusto: { jolt: { SharedNavigationScene: { capture: vi.fn(() => scene) } } },
  })
  vi.stubGlobal('android', { os: { Build: { VERSION: { SDK_INT: 36 } } } })
  vi.mocked(interactiveNavigation).mockImplementation((_frame, options) => {
    ios = {
      state: 'ready',
      supported: true,
      transition: { name: 'custom' },
      cancel: vi.fn(),
      dispose: vi.fn(() => iosEvent({ state: 'disposed' })),
    }
    iosEvent = (event) => {
      ios.state = event.state
      options!.onState!(event)
    }
    return ios
  })
  vi.mocked(predictiveBack).mockImplementation((_view, _values, options) => {
    android = {
      state: 'idle',
      supported: true,
      back: vi.fn(async () => {
        androidEvent({ state: 'finishing' })
        androidEvent({ state: 'committing' })
        const accepted = await options.commit({ animated: false })
        androidEvent({
          state: 'idle',
          outcome: accepted === false ? 'cancelled' : 'completed',
        })
      }),
      cancel: vi.fn(),
      dispose: vi.fn(() => androidEvent({ state: 'disposed' })),
    }
    androidEvent = (event) => {
      android.state = event.state
      options.onState!(event)
    }
    nativeBackSessions.set(android, bridge)
    return android
  })
  forward = {
    state: 'idle',
    navigate: vi.fn(() => ({
      finished: new Promise((resolve) => {
        forwardDone = resolve
      }),
      cancel: vi.fn(),
    })),
    dispose: vi.fn(),
  }
  vi.mocked(sharedNavigation).mockReturnValue(forward)
})
afterEach(() => {
  handles.splice(0).forEach((h) => h.dispose())
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}
function fixture(options: Partial<SharedNavigationEntryOptions> = {}) {
  const from = new View(),
    to = new View(),
    source = Object.assign(new View(), { sharedTransitionTag: 'photo' }),
    target = Object.assign(new View(), { sharedTransitionTag: 'photo' })
  from.children = [source]
  source.parent = from
  to.children = [target]
  target.parent = to
  const frame = Object.assign(new View(), {
    currentPage: from,
    backStack: [] as any[],
    ios: { controller: {} },
  })
  const onState = vi.fn(),
    back = vi.fn(() => {
      frame.currentPage = from
      frame.backStack = []
      return true
    })
  const control = sharedNavigationEntry(frame as unknown as Frame, {
    tag: 'photo',
    back,
    onState,
    ...options,
  })
  handles.push(control)
  function push() {
    frame.currentPage = to
    frame.backStack = [{ resolvedPage: from }]
    frame.notify({ eventName: 'navigatedTo' })
  }
  function finishIOS() {
    iosEvent({ state: 'animating', shared: { status: 'ready' } })
    push()
    iosEvent({ state: 'idle', shared: { status: 'ready' } })
  }
  async function finishAndroid() {
    push()
    forwardDone({ status: 'completed', navigated: true })
    await flush()
  }
  return {
    frame,
    from,
    to,
    source,
    target,
    onState,
    back,
    control,
    push,
    finishIOS,
    finishAndroid,
  }
}
describe('one shared navigation entry', () => {
  it('uses the existing iOS transition and resolves after native completion, not only route setup', async () => {
    const f = fixture(),
      navigate = vi.fn()
    const promise = f.control.open(navigate)
    expect(navigate).toHaveBeenCalledWith({ transition: ios.transition })
    expect(interactiveNavigation).toHaveBeenCalledWith(
      f.frame,
      expect.objectContaining({ shared: { tag: 'photo', maxSnapshotPixels: 8_000_000 } }),
    )
    iosEvent({ state: 'animating', shared: { status: 'ready' } })
    await flush()
    expect(f.control.state).toBe('opening')
    f.push()
    iosEvent({ state: 'idle', shared: { status: 'ready' } })
    expect(await promise).toEqual({ status: 'completed', navigated: true })
    expect(f.control.state).toBe('idle')
  })
  it('coalesces repeated back requests during opening into exactly one guarded route', async () => {
    const f = fixture()
    f.control.open(() => {})
    f.control.back()
    f.control.back()
    expect(f.back).not.toHaveBeenCalled()
    f.finishIOS()
    await flush()
    expect(f.back).toHaveBeenCalledExactlyOnceWith({})
    expect(f.control.state).toBe('disposed')
  })
  it('waits for native completion after a synchronous Core back', async () => {
    const f = fixture({
      back: () => {
        iosEvent({ state: 'animating' })
        return undefined
      },
    })
    f.control.open(() => {})
    f.finishIOS()
    f.onState.mockClear()
    f.control.back()
    await flush()
    expect(f.control.state).toBe('finishing')
    expect(f.onState.mock.calls.some(([e]) => e.outcome === 'cancelled')).toBe(false)
    f.frame.currentPage = f.from
    f.frame.backStack = []
    iosEvent({ state: 'idle' })
    expect(f.control.state).toBe('disposed')
    expect(vi.getTimerCount()).toBe(0)
  })
  it('a native cancellation keeps the entry alive, then native commit releases ownership', async () => {
    const f = fixture()
    f.control.open(() => {})
    f.finishIOS()
    iosEvent({ state: 'dragging' })
    iosEvent({ state: 'cancelling', release: { progress: 0.3, velocity: -0.4 } })
    iosEvent({ state: 'idle', outcome: 'cancelled' })
    expect(f.control.state).toBe('idle')
    expect(f.back).not.toHaveBeenCalled()
    f.frame.currentPage = f.from
    f.frame.backStack = []
    iosEvent({ state: 'idle', outcome: 'completed' })
    expect(f.control.state).toBe('disposed')
    expect(ios.dispose).toHaveBeenCalledOnce()
  })
  it('rejects reusing an entry without calling the second push', async () => {
    const f = fixture(),
      next = vi.fn()
    const first = f.control.open(() => {})
    expect(await f.control.open(next)).toMatchObject({
      status: 'unavailable',
      reason: 'busy',
    })
    f.finishIOS()
    await first
    expect(await f.control.open(next)).toMatchObject({
      status: 'unavailable',
      reason: 'busy',
    })
    expect(next).not.toHaveBeenCalled()
  })
  it('rejected forward navigation releases the recognizer and settles the open promise', async () => {
    const f = fixture()
    const result = await f.control.open(() => Promise.resolve(false))
    expect(result).toMatchObject({
      status: 'unavailable',
      reason: 'route-unchanged',
      navigated: false,
    })
    expect(f.control.state).toBe('disposed')
  })
  it('returns a failed result for a thrown forward route', async () => {
    const f = fixture(),
      error = Error('route')
    expect(
      await f.control.open(() => {
        throw error
      }),
    ).toMatchObject({ status: 'failed', error, navigated: false })
    expect(f.control.state).toBe('disposed')
  })
  it('bounds a forward guard that never settles and ignores its late result', async () => {
    const f = fixture({ navigationTimeout: 40 })
    let resolve!: (v: boolean) => void
    const result = f.control.open(
      () =>
        new Promise<boolean>((r) => {
          resolve = r
        }),
    )
    await vi.advanceTimersByTimeAsync(40)
    expect(await result).toMatchObject({ reason: 'navigation-timeout' })
    expect(f.control.state).toBe('disposed')
    resolve(true)
    await flush()
    expect(f.control.state).toBe('disposed')
  })
  it('bounds an unresolved fallback back and ignores its late result', async () => {
    let resolve!: (v: boolean) => void
    const f = fixture({
      navigationTimeout: 40,
      back: () =>
        new Promise<boolean>((r) => {
          resolve = r
        }),
    })
    f.control.open(() => {})
    f.finishIOS()
    f.control.back()
    await flush()
    await vi.advanceTimersByTimeAsync(40)
    expect(f.control.state).toBe('disposed')
    expect(ios.dispose).toHaveBeenCalledOnce()
    resolve(true)
    await flush()
    expect(f.control.state).toBe('disposed')
    expect(vi.getTimerCount()).toBe(0)
  })
  it('supports reentrant disposal from the opening observer without invoking the route', async () => {
    let control: SharedNavigationEntry
    const f = fixture({
      onState: (e) => {
        if (e.state === 'opening') control.dispose()
      },
    })
    control = f.control
    const navigate = vi.fn()
    expect(await control.open(navigate)).toMatchObject({ status: 'cancelled' })
    expect(navigate).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('rejects a stale source page before taking snapshots or navigating', async () => {
    const f = fixture()
    f.frame.currentPage = f.to
    const navigate = vi.fn()
    expect(await f.control.open(navigate)).toMatchObject({ reason: 'source-changed' })
    expect(navigate).not.toHaveBeenCalled()
    expect(interactiveNavigation).not.toHaveBeenCalled()
  })
  it('suspension releases input and pending work without an extra route', async () => {
    const f = fixture()
    const result = f.control.open(() => new Promise(() => {}))
    Application.notify({ eventName: Application.suspendEvent })
    expect(await result).toMatchObject({ status: 'cancelled' })
    expect(f.back).not.toHaveBeenCalled()
    expect(f.frame.listenerCount('navigatedTo')).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('keeps native fallback diagnostics when an identity is unavailable', async () => {
    const f = fixture()
    const result = f.control.open(() => {})
    iosEvent({
      state: 'animating',
      shared: { status: 'unavailable', reason: 'duplicate-source' },
    })
    f.push()
    iosEvent({
      state: 'idle',
      shared: { status: 'unavailable', reason: 'duplicate-source' },
    })
    expect(await result).toMatchObject({
      status: 'unavailable',
      reason: 'duplicate-source',
      navigated: true,
    })
    expect(f.control.state).toBe('idle')
  })
  it('does not strand ownership when a lifecycle observer throws', async () => {
    const f = fixture({
      onState: () => {
        throw Error('observer')
      },
    })
    f.control.open(() => {})
    f.finishIOS()
    f.control.dispose()
    expect(ios.dispose).toHaveBeenCalledOnce()
  })
})
describe('shared Android native composition', () => {
  beforeEach(() => {
    platform.ios = false
  })
  it('resolves a dynamic target only on commit and never retains a stale source scene', async () => {
    const returnTarget = { key: 'item-7', resolve: vi.fn() },
      f = fixture({ returnTarget })
    f.control.open(() => {})
    await f.finishAndroid()
    expect(org.rafaelaugusto.jolt.SharedNavigationScene.capture).not.toHaveBeenCalled()
    expect(bridge.setSharedScene).not.toHaveBeenCalled()
    androidEvent({ state: 'tracking' })
    androidEvent({ state: 'idle', outcome: 'cancelled' })
    expect(forward.navigate).toHaveBeenCalledOnce()
    expect(f.back).not.toHaveBeenCalled()
    f.control.back()
    f.control.back()
    const request = forward.navigate.mock.calls[1][0]
    expect(request).toMatchObject({ returnTarget, holdSource: true })
    request.navigate({ animated: false })
    forwardDone({ status: 'completed', navigated: true })
    await flush()
    await flush()
    expect(f.back).toHaveBeenCalledExactlyOnceWith({ animated: false })
    expect(f.control.state).toBe('disposed')
    expect(forward.dispose).toHaveBeenCalledTimes(2)
  })
  it('preserves a borrowed owner when a dynamic return fails before it starts', async () => {
    const f = fixture({ returnTarget: { key: 'item-7', resolve: () => undefined } })
    f.control.open(() => {})
    await f.finishAndroid()
    forward.dispose.mockClear()
    navigationScopes.set(f.frame as unknown as Frame, forward)
    forward.navigate.mockImplementationOnce(() => {
      throw Error('capture failed')
    })
    const commit = vi.mocked(predictiveBack).mock.calls[0]![2].commit
    await expect(commit({ animated: false })).rejects.toThrow('capture failed')
    expect(forward.dispose).not.toHaveBeenCalled()
    expect(f.back).not.toHaveBeenCalled()
    navigationScopes.delete(f.frame as unknown as Frame)
  })
  it('releases pending return work on explicit cancellation', async () => {
    const f = fixture({ returnTarget: { key: 'item-7', resolve: () => undefined } })
    f.control.open(() => {})
    await f.finishAndroid()
    f.control.back()
    const operation = forward.navigate.mock.results[1].value
    f.control.cancel()
    expect(operation.cancel).toHaveBeenCalledOnce()
    expect(android.cancel).toHaveBeenCalledOnce()
    forwardDone({ status: 'cancelled', navigated: false })
    await flush()
  })
  it('retains the return scene before pushing, budgets it with the flight and binds native input after completion', async () => {
    const f = fixture()
    const navigate = vi.fn()
    f.control.open(navigate)
    expect(org.rafaelaugusto.jolt.SharedNavigationScene.capture).toHaveBeenCalled()
    expect(forward.navigate).toHaveBeenCalledWith(
      expect.objectContaining({ navigate, maxSnapshotPixels: 7_999_900 }),
    )
    expect(predictiveBack).not.toHaveBeenCalled()
    await f.finishAndroid()
    expect(scene.bind).toHaveBeenCalledWith(f.target.nativeViewProtected, 0)
    expect(bridge.setSharedScene).toHaveBeenCalledWith(scene)
    expect(forward.dispose).toHaveBeenCalledOnce()
    expect(scene.dispose).not.toHaveBeenCalled()
  })
  it('releases scene, input and listeners after one application commit', async () => {
    const f = fixture()
    f.control.open(() => {})
    await f.finishAndroid()
    f.control.back()
    f.control.back()
    await flush()
    expect(f.back).toHaveBeenCalledExactlyOnceWith({ animated: false })
    expect(scene.dispose).toHaveBeenCalledOnce()
    expect(f.control.state).toBe('disposed')
  })
  it('a guard rejecting back retains the same scene and current route for retry', async () => {
    const back = vi.fn(() => false),
      f = fixture({ back })
    f.control.open(() => {})
    await f.finishAndroid()
    f.control.back()
    await flush()
    expect(f.control.state).toBe('idle')
    expect(scene.dispose).not.toHaveBeenCalled()
    expect(f.frame.currentPage).toBe(f.to)
  })
  it('invalidates a changed source before the first visual frame and still lets normal back commit', async () => {
    const f = fixture()
    f.control.open(() => {})
    await f.finishAndroid()
    f.source.translateX = 30
    androidEvent({ state: 'tracking' })
    expect(scene.dispose).toHaveBeenCalledOnce()
    expect(f.onState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        shared: { status: 'unavailable', reason: 'source-invalidated' },
      }),
    )
    androidEvent({ state: 'idle', outcome: 'cancelled' })
    f.control.back()
    await flush()
    expect(f.back).toHaveBeenCalledOnce()
  })
  it('still navigates when a native source cannot be snapshotted', async () => {
    vi.mocked(org.rafaelaugusto.jolt.SharedNavigationScene.capture).mockImplementation(
      () => {
        throw Error('unsupported canvas')
      },
    )
    const f = fixture()
    f.control.open(() => {})
    await f.finishAndroid()
    expect(f.control.state).toBe('idle')
    expect(bridge.setSharedScene).not.toHaveBeenCalled()
    f.control.back()
    await flush()
    expect(f.back).toHaveBeenCalledOnce()
  })
  it('reports native geometry fallback for a button return as well as a gesture', async () => {
    const f = fixture()
    f.control.open(() => {})
    await f.finishAndroid()
    scene.isAnimating = () => false
    scene.getFailureReason = () => 'target-unavailable'
    androidEvent({ state: 'finishing' })
    expect(f.onState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        shared: { status: 'unavailable', reason: 'target-unavailable' },
      }),
    )
  })
  it('drops retained images when the target identity is missing', async () => {
    const f = fixture()
    f.to.children = []
    f.control.open(() => {})
    await f.finishAndroid()
    expect(scene.dispose).toHaveBeenCalledOnce()
    expect(bridge.setSharedScene).not.toHaveBeenCalled()
  })
  it('borrows an existing idle programmatic owner without disposing it', async () => {
    const f = fixture()
    navigationScopes.set(f.frame as unknown as Frame, forward)
    f.control.open(() => {})
    await f.finishAndroid()
    f.control.dispose()
    expect(sharedNavigation).not.toHaveBeenCalled()
    expect(forward.dispose).not.toHaveBeenCalled()
    navigationScopes.delete(f.frame as unknown as Frame)
  })
  it('disposes retained snapshots after frame unload without navigation', async () => {
    const f = fixture()
    f.control.open(() => {})
    await f.finishAndroid()
    f.frame.notify({ eventName: 'unloaded' })
    expect(scene.dispose).toHaveBeenCalledOnce()
    expect(f.back).not.toHaveBeenCalled()
    expect(f.to.listenerCount('loaded')).toBe(0)
  })
})
it.each([
  { tag: '' },
  { back: null },
  { spring: 'bad' },
  { spring: 42 },
  { spring: [] },
  { spring: { type: 'tween' } },
  { spring: { duration: 0 } },
  { spring: { delay: 1 } },
  { maxSnapshotPixels: 0 },
  { navigationTimeout: 10001 },
])('validates %j before allocating resources', (options) => {
  expect(() =>
    fixture(options as unknown as Partial<SharedNavigationEntryOptions>),
  ).toThrow()
  expect(interactiveNavigation).not.toHaveBeenCalled()
  expect(org.rafaelaugusto.jolt.SharedNavigationScene.capture).not.toHaveBeenCalled()
})
