import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Application, SharedTransition, View as CoreView } from '@nativescript/core'
import {
  interactiveModal,
  type InteractiveModal,
} from '../src/interactive-navigation/modal.js'
import { configure } from '../src/config.js'
import { View } from './shims/core.js'
import './helpers.js'

vi.mock('@nativescript/core', async (original) => {
  const core = await original<typeof import('./shims/core.js')>()
  let id = 0
  const states = new Map<number, any>()
  return {
    ...core,
    View: class extends core.View {
      static get closedModallyEvent() {
        return 'closedModally'
      }
    },
    Transition: class {
      id = ++id
    },
    SharedTransition: {
      custom: (instance: { id: number }, options: object) => {
        states.set(instance.id, { ...options, instance })
        return { instance }
      },
      getState: (id: number) => states.get(id),
      updateState: (id: number, value: object) => Object.assign(states.get(id), value),
      finishState: (id: number) => states.delete(id),
    },
  }
})
let event: (event: number) => void, begins: () => boolean
let native: {
  interactive: boolean
  progress: number
  velocity: number
  preparePresentingReducedTimeScale: ReturnType<typeof vi.fn>
  cancel: ReturnType<typeof vi.fn>
  dispose: ReturnType<typeof vi.fn>
}
const controls: InteractiveModal[] = []
beforeEach(() => {
  configure({ reducedMotion: 'never' })
  native = {
    interactive: false,
    progress: 0.3,
    velocity: 0.8,
    preparePresentingReducedTimeScale: vi.fn(),
    cancel: vi.fn(),
    dispose: vi.fn(),
  }
  vi.stubGlobal('JoltInteractiveModal', {
    attachStiffnessDampingMassShouldBeginOnEvent: vi.fn(
      (_controller, _k, _d, _m, begin, onEvent) => {
        begins = begin
        event = onEvent
        return native
      },
    ),
  })
})
afterEach(() => {
  controls.splice(0).forEach((control) => control.dispose())
  vi.useRealTimers()
  vi.unstubAllGlobals()
  configure({ reducedMotion: 'user' })
})
function fixture(options: Parameters<typeof interactiveModal>[0] = {}) {
  const callbacks = vi.fn(),
    onState = vi.fn(options.onState)
  const control = interactiveModal({ ...options, onState })
  controls.push(control)
  const transition = control.transition!.instance!
  const controller = { presentingViewController: {} }
  const modal = Object.assign(new View(), {
    viewController: controller,
    attached: true,
    closeModal: vi.fn(),
  })
  const close = () => {
    const core = SharedTransition.getState(transition.id)
    if (!core?.interactiveBegan) modal.attached = false
    transition.iosDismissedController!(controller)
  }
  modal.closeModal.mockImplementation(close)
  const start = vi.fn(close)
  transition.setupInteractiveGesture!(start, modal as unknown as CoreView)
  transition.iosPresentedController!(controller, {}, {})
  function opened() {
    event(0)
    event(1)
    modal.notify({ eventName: 'shownModally' })
  }
  function drag() {
    native.interactive = true
    event(2)
  }
  function coreCompletion() {
    const core = SharedTransition.getState(transition.id)
    if (core?.interactiveBegan)
      SharedTransition.updateState(transition.id, { interactiveBegan: false })
    if (!core?.interactiveCancelled) {
      modal.attached = false
      callbacks()
      modal.notify({ eventName: 'closedModally' })
    }
  }
  function cancelled() {
    event(4)
    coreCompletion()
    native.interactive = false
    event(6)
  }
  return {
    control,
    transition,
    modal,
    start,
    callbacks,
    onState,
    opened,
    drag,
    cancelled,
    coreCompletion,
  }
}
describe('interactive modal ownership', () => {
  it('preserves the Core modal and callback through cancellation, then closes once on retry', () => {
    const f = fixture()
    f.opened()
    f.drag()
    expect(f.start).toHaveBeenCalledOnce()
    expect(f.modal.attached).toBe(true)
    f.cancelled()
    expect(f.callbacks).not.toHaveBeenCalled()
    expect(f.modal.attached).toBe(true)
    expect(f.control.state).toBe('idle')
    expect(begins()).toBe(true)
    f.drag()
    event(3)
    f.coreCompletion()
    expect(f.callbacks).toHaveBeenCalledOnce()
    expect(f.control.state).toBe('disposed')
    expect(native.dispose).toHaveBeenCalledOnce()
    expect(SharedTransition.getState(f.transition.id)).toBeUndefined()
  })
  it('does not clear Core cancellation until its delayed completion has observed it', () => {
    vi.useFakeTimers()
    const f = fixture()
    f.opened()
    f.drag()
    event(4)
    event(6)
    expect(f.control.state).toBe('cancelling')
    expect(SharedTransition.getState(f.transition.id)?.interactiveCancelled).toBe(true)
    f.coreCompletion()
    vi.advanceTimersByTime(10)
    expect(f.callbacks).not.toHaveBeenCalled()
    expect(f.control.state).toBe('idle')
    expect(SharedTransition.getState(f.transition.id)?.interactiveCancelled).toBe(false)
  })
  it('forwards programmatic close arguments and coalesces repeated requests', () => {
    const f = fixture()
    f.opened()
    expect(f.control.close('saved', 7)).toBe(true)
    expect(f.control.close('again')).toBe(false)
    expect(f.modal.closeModal).toHaveBeenCalledExactlyOnceWith('saved', 7)
    f.coreCompletion()
    expect(f.control.state).toBe('disposed')
  })
  it('queues the first close while opening until Core reports shownModally', () => {
    const f = fixture()
    event(0)
    expect(f.control.close('early')).toBe(true)
    expect(f.control.close('duplicate')).toBe(false)
    event(1)
    expect(f.modal.closeModal).not.toHaveBeenCalled()
    f.modal.notify({ eventName: 'shownModally' })
    expect(f.modal.closeModal).toHaveBeenCalledExactlyOnceWith('early')
    f.coreCompletion()
  })
  it('rejects close during a drag or cancellation', () => {
    const f = fixture()
    f.opened()
    f.drag()
    expect(f.control.close()).toBe(false)
    event(4)
    expect(f.control.close()).toBe(false)
    f.coreCompletion()
    event(6)
  })
  it('keeps ordinary close usable when UIKit skips animation callbacks', () => {
    const f = fixture()
    f.modal.notify({ eventName: 'shownModally' })
    expect(f.control.state).toBe('idle')
    expect(f.control.close('instant')).toBe(true)
    f.coreCompletion()
    expect(f.callbacks).toHaveBeenCalledOnce()
    expect(f.control.state).toBe('disposed')
  })
  it('retains Core cancellation bookkeeping when disposed during a drag', () => {
    vi.useFakeTimers()
    const f = fixture()
    f.opened()
    f.drag()
    native.cancel.mockImplementation(() => {
      event(4)
      event(6)
    })
    f.control.dispose()
    expect(native.dispose).not.toHaveBeenCalled()
    f.coreCompletion()
    vi.advanceTimersByTime(10)
    expect(f.callbacks).not.toHaveBeenCalled()
    expect(f.modal.attached).toBe(true)
    expect(native.dispose).toHaveBeenCalledOnce()
    expect(f.control.state).toBe('disposed')
  })
  it('disposes an idle owner without closing and leaves ordinary Core close available', () => {
    const f = fixture()
    f.opened()
    f.control.dispose()
    f.control.dispose()
    expect(f.modal.closeModal).not.toHaveBeenCalled()
    expect(native.dispose).toHaveBeenCalledOnce()
    expect(f.transition.iosDismissedController!({})).toBeUndefined()
  })
  it('gates gesture start and contains exceptions from the app gate', () => {
    const canBegin = vi.fn(() => true),
      f = fixture({ canBegin })
    expect(begins()).toBe(false)
    f.opened()
    expect(begins()).toBe(true)
    canBegin.mockReturnValue(false)
    expect(begins()).toBe(false)
    canBegin.mockImplementation(() => {
      throw Error('guard')
    })
    expect(begins()).toBe(false)
  })
  it('suspends interaction, cancels the native context and permits retry on resume', () => {
    vi.useFakeTimers()
    const f = fixture()
    f.opened()
    Application.notify({ eventName: Application.suspendEvent, object: Application })
    expect(native.cancel).toHaveBeenCalledOnce()
    expect(begins()).toBe(false)
    Application.notify({ eventName: Application.resumeEvent, object: Application })
    vi.runOnlyPendingTimers()
    expect(begins()).toBe(true)
  })
  it('passes reduced motion to native and cancels when the preference becomes active', () => {
    const f = fixture()
    f.opened()
    configure({ reducedMotion: 'always' })
    expect(native.cancel).toHaveBeenCalledOnce()
    f.transition.iosDismissedController!({})
    expect(native.preparePresentingReducedTimeScale).toHaveBeenLastCalledWith(
      false,
      true,
      1,
    )
  })
  it('reports native release progress and velocity only at a boundary', () => {
    const f = fixture()
    f.opened()
    f.drag()
    event(4)
    expect(f.onState).toHaveBeenLastCalledWith({
      state: 'cancelling',
      release: { progress: 0.3, velocity: 0.8 },
    })
    f.coreCompletion()
    event(6)
  })
  it('disposes an unused handle without creating native resources', () => {
    const control = interactiveModal()
    controls.push(control)
    control.dispose()
    expect(control.state).toBe('disposed')
    expect(native.dispose).not.toHaveBeenCalled()
    expect(control.close()).toBe(false)
  })
  it('returns an explicit fallback when the native class is absent', () => {
    vi.stubGlobal('JoltInteractiveModal', undefined)
    const control = interactiveModal()
    controls.push(control)
    expect(control.supported).toBe(false)
    expect(control.transition).toBeUndefined()
    expect(control.close()).toBe(false)
  })
  it('requires the Core modal-completion lifecycle event', () => {
    const event = vi
      .spyOn(CoreView, 'closedModallyEvent', 'get')
      .mockReturnValue(undefined as any)
    try {
      const control = interactiveModal()
      controls.push(control)
      expect(control.supported).toBe(false)
      expect(control.transition).toBeUndefined()
    } finally {
      event.mockRestore()
    }
  })
  it('keeps the owner through a temporary background unload', () => {
    vi.useFakeTimers()
    const f = fixture()
    f.opened()
    Application.notify({ eventName: Application.suspendEvent, object: Application })
    f.modal.isLoaded = false
    f.modal.notify({ eventName: 'unloaded' })
    vi.runOnlyPendingTimers()
    expect(native.dispose).not.toHaveBeenCalled()
    f.modal.isLoaded = true
    Application.notify({ eventName: Application.resumeEvent, object: Application })
    vi.runOnlyPendingTimers()
    expect(f.control.state).toBe('idle')
    expect(begins()).toBe(true)
  })
  it('releases a modal detached from UIKit and removes its lifecycle listeners', () => {
    vi.useFakeTimers()
    const f = fixture()
    f.opened()
    f.modal.isLoaded = false
    f.modal.viewController.presentingViewController = undefined as any
    f.modal.notify({ eventName: 'unloaded' })
    vi.runOnlyPendingTimers()
    expect(f.control.state).toBe('disposed')
    expect(f.modal.listenerCount('closedModally')).toBe(0)
    expect(f.modal.listenerCount('shownModally')).toBe(0)
    expect(f.modal.listenerCount('unloaded')).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('contains observer exceptions without losing final cleanup', () => {
    const f = fixture({
      onState() {
        throw Error('observer')
      },
    })
    f.opened()
    f.control.close()
    f.coreCompletion()
    expect(f.callbacks).toHaveBeenCalledOnce()
    expect(f.control.state).toBe('disposed')
    expect(native.dispose).toHaveBeenCalledOnce()
  })
  it.each([{ stiffness: 0 }, { mass: -1 }, { damping: -1 }, { duration: Infinity }])(
    'rejects invalid physics %j',
    (spring) => {
      expect(() => interactiveModal({ spring })).toThrow()
    },
  )
})
