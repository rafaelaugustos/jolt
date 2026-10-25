import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Application, SharedTransition, type Frame } from '@nativescript/core'
import {
  interactiveNavigation,
  type InteractiveNavigation,
} from '../src/interactive-navigation/index.js'
import { configure } from '../src/config.js'
import { View } from './shims/core.js'
import './helpers.js'

vi.mock('@nativescript/core', async (original) => {
  const core = await original<typeof import('./shims/core.js')>()
  let id = 0
  const states = new Map<number, Record<string, unknown>>()
  return {
    ...core,
    Transition: class {
      id = ++id
    },
    SharedTransition: {
      custom: (instance: { id: number }, options: object) => {
        states.set(instance.id, { ...options, instance })
        return { instance }
      },
      getState: (id: number) => states.get(id),
      updateState: (id: number, value: object) => {
        states.set(id, { ...states.get(id), ...value })
      },
      finishState: (id: number) => states.delete(id),
    },
  }
})
const handles: InteractiveNavigation[] = []
let begins: () => boolean, event: (event: number) => void
let native: {
  interactive: boolean
  sharedEnabled?: boolean
  prepareSharedFromToImageFromRadiusToRadiusMaxPixels: ReturnType<typeof vi.fn>
  prepareOperationPresentedReducedTimeScale: ReturnType<typeof vi.fn>
  sync: ReturnType<typeof vi.fn>
  cancel: ReturnType<typeof vi.fn>
  disposeRestoringSwipe: ReturnType<typeof vi.fn>
}
beforeEach(() => {
  configure({ reducedMotion: 'never' })
  native = {
    interactive: false,
    prepareSharedFromToImageFromRadiusToRadiusMaxPixels: vi.fn(() => true),
    prepareOperationPresentedReducedTimeScale: vi.fn(),
    sync: vi.fn(),
    cancel: vi.fn(),
    disposeRestoringSwipe: vi.fn(),
  }
  vi.stubGlobal('JoltInteractiveNavigation', {
    attachStiffnessDampingMassShouldBeginOnEvent: vi.fn(
      (_nav, _k, _d, _m, begin, onEvent) => {
        begins = begin
        event = onEvent
        return native
      },
    ),
  })
})
afterEach(() => {
  handles.splice(0).forEach((h) => h.dispose())
  vi.unstubAllGlobals()
  configure({ reducedMotion: 'user' })
})
function fixture(options: Parameters<typeof interactiveNavigation>[1] = {}) {
  const page = Object.assign(new View(), { ios: {}, enableSwipeBackNavigation: true })
  const from = Object.assign(new View(), { ios: {} })
  const nav = { delegate: {} }
  const frame = Object.assign(new View(), {
    ios: { controller: nav },
    currentPage: from,
    backStack: [] as { resolvedPage: View }[],
    canGoBack: () => true,
  })
  const control = interactiveNavigation(frame as unknown as Frame, options)
  handles.push(control)
  const transition = control.transition!.instance!
  const start = vi.fn()
  function push() {
    frame.notify({
      eventName: 'navigatingTo',
      entry: { resolvedPage: page },
      isBack: false,
    })
    transition.setupInteractiveGesture!(start, frame as unknown as Frame)
    transition.iosNavigatedController!(nav, 1, from.ios, page.ios)
    event(0)
    frame.currentPage = page
    frame.backStack = [{ resolvedPage: from }]
    frame.notify({ eventName: 'navigatedTo' })
    event(1)
  }
  return { frame, page, from, nav, control, transition, start, push }
}
describe('interactive Frame entry ownership', () => {
  it('prepares one shared pair at the native layout boundary and carries its readiness with release events', () => {
    const onState = vi.fn(),
      f = fixture({ shared: { tag: 'photo' }, onState })
    f.from.children = [Object.assign(new View(), { sharedTransitionTag: 'photo' })]
    f.page.children = [Object.assign(new View(), { sharedTransitionTag: 'photo' })]
    f.push()
    event(8)
    expect(native.sharedEnabled).toBe(true)
    expect(
      native.prepareSharedFromToImageFromRadiusToRadiusMaxPixels,
    ).toHaveBeenCalledExactlyOnceWith(
      f.from.children[0]!.nativeViewProtected,
      f.page.children[0]!.nativeViewProtected,
      false,
      0,
      0,
      8_000_000,
    )
    event(3)
    expect(onState).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: 'finishing', shared: { status: 'ready' } }),
    )
  })
  it('does not hide either endpoint when source identities are ambiguous', () => {
    const onState = vi.fn(),
      f = fixture({ shared: { tag: 'photo' }, onState })
    f.from.children = [
      Object.assign(new View(), { sharedTransitionTag: 'photo' }),
      Object.assign(new View(), { sharedTransitionTag: 'photo' }),
    ]
    f.page.children = [Object.assign(new View(), { sharedTransitionTag: 'photo' })]
    f.push()
    event(8)
    event(3)
    expect(
      native.prepareSharedFromToImageFromRadiusToRadiusMaxPixels,
    ).not.toHaveBeenCalled()
    expect(onState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        shared: { status: 'unavailable', reason: 'duplicate-source' },
      }),
    )
  })
  it('keeps UIKit navigation alive when native geometry cannot be shared', () => {
    const onState = vi.fn(),
      f = fixture({ shared: { tag: 'photo' }, onState })
    f.from.children = [Object.assign(new View(), { sharedTransitionTag: 'photo' })]
    f.page.children = [Object.assign(new View(), { sharedTransitionTag: 'photo' })]
    native.prepareSharedFromToImageFromRadiusToRadiusMaxPixels.mockReturnValue(false)
    f.push()
    event(8)
    event(3)
    expect(onState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        shared: { status: 'unavailable', reason: 'unsupported-geometry' },
      }),
    )
  })

  it('uses Core transition hooks without replacing its navigation delegate', () => {
    const f = fixture(),
      delegate = f.nav.delegate
    f.push()
    expect(f.nav.delegate).toBe(delegate)
    expect(f.control.state).toBe('idle')
    expect(native.prepareOperationPresentedReducedTimeScale).toHaveBeenCalledWith(
      1,
      f.page.ios,
      false,
      1,
    )
    expect(native.sync).toHaveBeenCalled()
  })
  it('enters Core interactive state before invoking its pop callback exactly once', () => {
    const f = fixture()
    f.push()
    f.start.mockImplementation(() => {
      expect(SharedTransition.getState(f.transition.id)?.interactiveBegan).toBe(true)
    })
    native.interactive = true
    event(2)
    expect(f.start).toHaveBeenCalledTimes(1)
    expect(f.transition.iosInteractionDismiss!(null)).toBe(native)
    event(4)
    event(6)
    expect(f.control.state).toBe('idle')
    expect(SharedTransition.getState(f.transition.id)?.interactiveBegan).toBe(false)
    expect(f.frame.currentPage).toBe(f.page)
    expect(f.frame.backStack).toEqual([{ resolvedPage: f.from }])
    expect(begins()).toBe(true)
  })
  it('honors page/route gates, reduced motion, current page and busy state', () => {
    const canBegin = vi.fn(() => true),
      f = fixture({ canBegin })
    f.push()
    expect(begins()).toBe(true)
    f.page.enableSwipeBackNavigation = false
    expect(begins()).toBe(false)
    f.page.enableSwipeBackNavigation = true
    canBegin.mockReturnValue(false)
    expect(begins()).toBe(false)
    canBegin.mockImplementation(() => {
      throw new Error('guard')
    })
    expect(begins()).toBe(false)
    canBegin.mockReturnValue(true)
    configure({ reducedMotion: 'always' })
    expect(begins()).toBe(false)
    expect(native.cancel).toHaveBeenCalledOnce()
    configure({ reducedMotion: 'never' })
    f.frame.currentPage = f.from
    expect(begins()).toBe(false)
    f.frame.currentPage = f.page
    event(0)
    expect(begins()).toBe(false)
  })
  it('releases an entry after committed pop, keeping outcome notification', async () => {
    const onState = vi.fn(),
      f = fixture({ onState })
    f.push()
    event(2)
    event(3)
    f.frame.currentPage = f.from
    f.frame.backStack = []
    f.frame.notify({ eventName: 'navigatedTo' })
    // A native->JS callback can drain microtasks before completeTransition returns.
    await Promise.resolve()
    expect(f.control.state).toBe('finishing')
    event(5)
    expect(onState).toHaveBeenCalledWith({ state: 'idle', outcome: 'completed' })
    await Promise.resolve()
    expect(f.control.state).toBe('disposed')
    expect(native.disposeRestoringSwipe).toHaveBeenCalledOnce()
    expect(SharedTransition.getState(f.transition.id)).toBeUndefined()
    expect(f.frame.listenerCount('viewControllerShown')).toBe(0)
  })
  it('keeps a covered entry alive and disposes after clearHistory removes it', async () => {
    const f = fixture()
    f.push()
    f.frame.currentPage = f.from
    f.frame.backStack = [{ resolvedPage: f.page }]
    f.frame.notify({ eventName: 'navigatedTo' })
    await Promise.resolve()
    expect(f.control.state).toBe('idle')
    f.frame.backStack = []
    f.frame.notify({ eventName: 'navigatedTo' })
    await Promise.resolve()
    expect(f.control.state).toBe('disposed')
  })
  it('cancels on suspend, releases on unload and ignores repeated disposal', () => {
    const f = fixture()
    f.push()
    Application.notify({ eventName: Application.suspendEvent })
    expect(native.cancel).toHaveBeenCalledOnce()
    f.frame.notify({ eventName: 'unloaded' })
    f.control.dispose()
    event(1) // A late native callback must not recreate a released Core state.
    expect(native.disposeRestoringSwipe).toHaveBeenCalledOnce()
    expect(SharedTransition.getState(f.transition.id)).toBeUndefined()
    expect(
      f.transition.iosNavigatedController!(f.nav, 2, f.page.ios, f.from.ios),
    ).toBeUndefined()
    expect(f.frame.listenerCount('navigatingTo')).toBe(0)
  })
  it('cleans an unused transition after a rejected router navigation', () => {
    const f = fixture()
    f.control.dispose()
    expect(SharedTransition.getState(f.transition.id)).toBeUndefined()
    expect(native.disposeRestoringSwipe).not.toHaveBeenCalled()
    expect(f.frame.listenerCount('navigatedTo')).toBe(0)
  })
  it('falls back without listeners if the native class is unavailable', () => {
    vi.stubGlobal('JoltInteractiveNavigation', undefined)
    const frame = new View(),
      h = interactiveNavigation(frame as unknown as Frame)
    handles.push(h)
    expect(h.supported).toBe(false)
    expect(h.transition).toBeUndefined()
    expect(frame.listenerCount('navigatedTo')).toBe(0)
  })
  it.each([
    { duration: 0 },
    { stiffness: NaN },
    { mass: -1 },
    { damping: -1 },
    { delay: 100 },
    'missing',
  ])('rejects invalid spring configuration %j before touching UIKit', (spring) => {
    expect(() =>
      interactiveNavigation(new View() as unknown as Frame, { spring: spring as never }),
    ).toThrow()
  })
})
