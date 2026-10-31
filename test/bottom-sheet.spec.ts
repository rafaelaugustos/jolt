import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Application, GridLayout, ScrollView, View } from '@nativescript/core'
import {
  bottomSheet,
  GestureSurface,
  type BottomSheet,
} from '../src/bottom-sheet/index.js'

const mocks = vi.hoisted(() => ({
  gestures: vi.fn(),
  bind: vi.fn(),
  actions: vi.fn(),
  restore: vi.fn(),
  reveal: vi.fn(),
  dismissKeyboard: vi.fn(),
  keyboard: undefined as
    undefined | ((state: { visible: boolean; height: number }) => void),
  offKeyboard: vi.fn(),
  releaseActions: vi.fn(),
  insets: { top: 0, bottom: 0 },
}))
vi.mock('@nativescript/core', async (original) => {
  const core = await original<typeof import('./shims/core.js')>()
  return {
    ...core,
    isAndroid: true,
    GridLayout: class extends core.View {},
    ScrollView: class extends core.ScrollView {
      orientation = 'vertical'
    },
    Application: Object.assign(new core.Observable(), {
      android: Object.assign(new core.Observable(), {
        activityBackPressedEvent: 'activityBackPressed',
      }),
    }),
  }
})
vi.mock('../src/gestures/index.js', async () => {
  const { GridLayout } = await import('@nativescript/core')
  return { GestureSurface: class extends GridLayout {}, gestures: mocks.gestures }
})
vi.mock('../src/motion-value.js', () => ({ bind: mocks.bind }))
vi.mock('../src/keyboard.js', () => ({
  currentKeyboard: () => ({ visible: false, height: 0 }),
  onKeyboard: (callback: typeof mocks.keyboard) => {
    mocks.keyboard = callback
    return mocks.offKeyboard
  },
}))
vi.mock('../src/bottom-sheet/native.js', () => ({
  windowHeight: () => 800,
  hostInsets: () => mocks.insets,
  captureFocus: () => mocks.restore,
  revealFocusedField: mocks.reveal,
  dismissKeyboard: mocks.dismissKeyboard,
  sheetActions: mocks.actions,
}))

type Input = ReturnType<typeof makeInput>
function makeInput(y: number, callbacks: Record<string, Function>) {
  const observers = new Set<() => void>()
  const input = {
    active: false,
    disposed: false,
    paused: false,
    y: {
      get: () => y,
      to: () => ({}),
      subscribe: (callback: () => void) => {
        observers.add(callback)
        return () => observers.delete(callback)
      },
    },
    settleTo: vi.fn((_next: { y: number }) => {
      if (input.active) {
        input.active = false
        callbacks.onCancel?.()
      }
    }),
    updateBounds: vi.fn(),
    pause: vi.fn(() => {
      input.paused = true
      if (input.active) {
        input.active = false
        callbacks.onCancel?.()
      }
    }),
    play: vi.fn(() => {
      input.paused = false
    }),
    dispose: vi.fn(() => {
      input.disposed = true
      callbacks.onCancel?.()
    }),
    advance(value: number) {
      y = value
      for (const callback of [...observers]) callback()
    },
    contactStart() {
      callbacks.onContactStart?.({ y, velocityY: 0 })
    },
    contactEnd() {
      callbacks.onContactEnd?.({ y, velocityY: 0 })
    },
    release(value: number, velocity: number) {
      y = value
      input.active = false
      callbacks.onEnd?.({ y, velocityY: velocity })
    },
    get subscriptions() {
      return observers.size
    },
  }
  return input
}
const controls: BottomSheet[] = []
let inputs: Input[]
beforeEach(() => {
  mocks.insets = { top: 0, bottom: 0 }
  vi.useFakeTimers()
  vi.clearAllMocks()
  inputs = []
  mocks.bind.mockImplementation(() => vi.fn())
  mocks.actions.mockImplementation(() => mocks.releaseActions)
  mocks.gestures.mockImplementation((_panel, options) => {
    const input = makeInput(options.initial.y, options)
    inputs.push(input)
    return input
  })
})
afterEach(() => {
  controls.splice(0).forEach((control) => control.dispose())
  inputs.forEach((input) => {
    expect(input.disposed).toBe(true)
    expect(input.subscriptions).toBe(0)
  })
  vi.useRealTimers()
})
function fixture(extra: Partial<Parameters<typeof bottomSheet>[1]> = {}) {
  const host = new GridLayout(),
    panel = new GestureSurface(),
    handle = new GridLayout(),
    scroll = new ScrollView(),
    content = new GridLayout(),
    backdrop = new GridLayout()
  Object.assign(host, {
    actualSize: { width: 400, height: 800 },
    getLocationInWindow: () => ({ x: 0, y: 0 }),
  })
  Object.assign(panel, { parent: host, actualSize: { width: 400, height: 800 } })
  Object.assign(handle, { parent: panel })
  Object.assign(scroll, {
    parent: panel,
    content,
    actualSize: { width: 400, height: 760 },
  })
  Object.assign(content, { parent: scroll, actualSize: { width: 400, height: 240 } })
  Object.assign(backdrop, { parent: host })
  const options = {
    handle,
    scrollView: scroll,
    backdrop,
    snap: ['content', '50%', '90%'] as const,
    ...extra,
  }
  const sheet = bottomSheet(panel, options)
  controls.push(sheet)
  return {
    host,
    panel,
    handle,
    scroll,
    content,
    backdrop,
    sheet,
    options,
    input: inputs.at(-1)!,
  }
}
const notify = (view: View, eventName: string) => view.notify({ eventName, object: view })

describe('bottom sheet lifecycle and coordination', () => {
  it('does not restore focus or emit dismissal for an interrupted close', () => {
    const onDismiss = vi.fn(),
      { sheet, input, panel } = fixture({ onDismiss })
    expect(panel.visibility).toBe('hidden')
    sheet.open('50%')
    expect(input.settleTo).toHaveBeenLastCalledWith({ y: 400 })
    input.advance(500)
    sheet.dismiss()
    expect(input.settleTo).toHaveBeenLastCalledWith({ y: 800 })
    input.advance(700)
    sheet.open('90%')
    expect(input.y.get()).toBe(700)
    expect(input.settleTo).toHaveBeenLastCalledWith({ y: 80 })
    input.advance(80)
    expect(onDismiss).not.toHaveBeenCalled()
    expect(mocks.restore).not.toHaveBeenCalled()
    sheet.dismiss()
    input.advance(800)
    expect(onDismiss).toHaveBeenCalledOnce()
    expect(mocks.restore).toHaveBeenCalledOnce()
    expect(panel.visibility).toBe('hidden')
  })

  it('settles a touch interruption even when it never becomes a pan', () => {
    const { sheet, input } = fixture()
    sheet.open('50%')
    input.advance(400)
    sheet.dismiss()
    input.advance(650)
    const calls = input.settleTo.mock.calls.length
    input.contactStart()
    expect(input.settleTo).toHaveBeenCalledTimes(calls)
    expect(sheet.isOpen).toBe(true)
    input.contactEnd()
    expect(input.settleTo).toHaveBeenLastCalledWith({ y: 520 })
    expect(sheet.snapPoint).toBe('content')
    expect(mocks.restore).not.toHaveBeenCalled()
  })

  it('retargets growing content from the current position without restarting its input', () => {
    const { sheet, input, content } = fixture()
    sheet.open('content')
    expect(input.settleTo).toHaveBeenLastCalledWith({ y: 520 })
    input.advance(600)
    Object.assign(content, { actualSize: { width: 400, height: 500 } })
    notify(content, 'layoutChanged')
    vi.runOnlyPendingTimers()
    expect(input.y.get()).toBe(600)
    expect(input.settleTo).toHaveBeenLastCalledWith({ y: 260 })
    expect(inputs).toHaveLength(1)
    expect(sheet.snapPoint).toBe('content')
  })

  it('temporarily expands for a focused field and restores the chosen snap after keyboard dismissal', () => {
    const { sheet, panel, input } = fixture()
    sheet.open('50%')
    mocks.keyboard!({ visible: true, height: 300 })
    expect(panel.height).toBe(500)
    expect(input.settleTo).toHaveBeenLastCalledWith({ y: 0 })
    expect(sheet.snapPoint).toBe('50%')
    expect(mocks.reveal).toHaveBeenCalled()
    expect(mocks.dismissKeyboard).not.toHaveBeenCalled()
    mocks.keyboard!({ visible: false, height: 0 })
    expect(panel.height).toBe(720)
    expect(input.settleTo).toHaveBeenLastCalledWith({ y: 400 })
  })

  it('handles accessibility expansion, backdrop dismissal and Android back without intercepting a closed sheet', () => {
    const { sheet, input, backdrop } = fixture()
    const actions = mocks.actions.mock.calls.at(-1)![1] as {
      label: string
      run(): void
    }[]
    actions.find((action) => action.label === 'Expand')!.run()
    expect(sheet.snapPoint).toBe('content')
    actions.find((action) => action.label === 'Expand')!.run()
    expect(sheet.snapPoint).toBe('50%')
    notify(backdrop, 'tap')
    input.advance(800)
    const closed = {
      eventName: 'activityBackPressed',
      object: Application.android,
      cancel: false,
    }
    Application.android.notify(closed)
    expect(closed.cancel).toBe(false)
    sheet.open('90%')
    const opened = { ...closed }
    Application.android.notify(opened)
    expect(opened.cancel).toBe(true)
    expect(sheet.isOpen).toBe(false)
  })

  it('respects nondismissible gestures and backdrop while still allowing an explicit dismiss call', () => {
    const { sheet, input, backdrop } = fixture({ dismissible: false })
    sheet.open('50%')
    input.release(600, 2000)
    expect(sheet.snapPoint).toBe('content')
    notify(backdrop, 'tap')
    expect(sheet.isOpen).toBe(true)
    expect(mocks.actions.mock.calls.at(-1)![1]).toHaveLength(2)
    sheet.dismiss()
    expect(sheet.isOpen).toBe(false)
  })

  it('releases native ownership on unload and reconnects once on reload', () => {
    const { sheet, panel, handle, input, content } = fixture()
    expect(content.verticalAlignment).toBe('top')
    sheet.open('50%')
    input.active = true
    Object.assign(panel, { isLoaded: false })
    const calls = input.settleTo.mock.calls.length
    notify(panel, 'unloaded')
    expect(input.dispose).toHaveBeenCalledOnce()
    expect(input.settleTo).toHaveBeenCalledTimes(calls)
    Object.assign(panel, { isLoaded: true })
    notify(panel, 'loaded')
    notify(handle, 'loaded')
    expect(inputs).toHaveLength(2)
    expect(inputs[1]!.settleTo).toHaveBeenLastCalledWith({ y: 400 })
    sheet.dispose()
    expect(mocks.releaseActions).toHaveBeenCalled()
    expect(content.verticalAlignment).not.toBe('top')
  })

  it('does not replace a valid controller when the replacement has invalid snaps', () => {
    const { panel, options, sheet } = fixture()
    expect(() => bottomSheet(panel, { ...options, snap: [0] })).toThrow()
    expect(sheet.disposed).toBe(false)
  })

  it('holds layout retargeting while paused and resumes the latest target', () => {
    const { sheet, input } = fixture()
    sheet.open('50%')
    sheet.pause()
    const calls = input.settleTo.mock.calls.length
    mocks.keyboard!({ visible: true, height: 300 })
    expect(input.settleTo).toHaveBeenCalledTimes(calls)
    sheet.play()
    expect(input.settleTo).toHaveBeenLastCalledWith({ y: 0 })
  })
})

describe('bottom sheet safe areas', () => {
  it('places the panel where the host already insets its children and extends it under the home indicator', () => {
    mocks.insets = { top: 62, bottom: 34 }
    const { sheet, panel, input } = fixture()
    expect(panel.marginTop).toBe(0)
    expect(panel.iosIgnoreSafeArea).toBe(true)
    expect(panel.height).toBeCloseTo(0.9 * 704)
    expect(panel.paddingBottom ?? 0).toBe(0)
    sheet.open('content')
    expect(input.settleTo).toHaveBeenLastCalledWith({ y: 704 - 280 })
    sheet.open('90%')
    expect(input.settleTo).toHaveBeenLastCalledWith({ y: expect.closeTo(704 * 0.1, 5) })
    sheet.dismiss()
    expect(input.settleTo).toHaveBeenLastCalledWith({ y: 800 - 62 })
  })

  it('lets a top override add to the host placement but never move the panel above it', () => {
    mocks.insets = { top: 62, bottom: 34 }
    const raised = fixture({ safeArea: { top: 80, bottom: 0 } })
    expect(raised.panel.marginTop).toBe(18)
    expect(raised.panel.height).toBeCloseTo(0.9 * 720)
    const lowered = fixture({ safeArea: { top: 0 } })
    expect(lowered.panel.marginTop).toBe(0)
    expect(lowered.panel.height).toBeCloseTo(0.9 * 704)
  })

  it('drops the extension while the keyboard covers the home indicator and restores it afterwards', () => {
    const { sheet, panel, input } = fixture({ safeArea: { top: 62, bottom: 34 } })
    expect(panel.height).toBeCloseTo(0.9 * 704 + 34)
    expect(panel.paddingBottom).toBe(34)
    Object.assign(panel, { effectivePaddingBottom: 34 })
    sheet.open('50%')
    mocks.keyboard!({ visible: true, height: 300 })
    expect(panel.height).toBe(800 - 62 - 300)
    expect(panel.paddingBottom).toBe(0)
    Object.assign(panel, { effectivePaddingBottom: 0 })
    expect(input.settleTo).toHaveBeenLastCalledWith({ y: 0 })
    mocks.keyboard!({ visible: false, height: 0 })
    expect(panel.height).toBeCloseTo(0.9 * 704 + 34)
    expect(panel.paddingBottom).toBe(34)
    expect(input.settleTo).toHaveBeenLastCalledWith({ y: 352 })
  })

  it('measures the content snap without the padding that keeps rows above the inset', () => {
    const { sheet, panel, scroll, input } = fixture({ safeArea: { bottom: 34 } })
    expect(panel.height).toBeCloseTo(0.9 * 766 + 34)
    expect(panel.paddingBottom).toBe(34)
    Object.assign(panel, {
      actualSize: { width: 400, height: 0.9 * 766 + 34 },
      effectivePaddingBottom: 34,
    })
    Object.assign(scroll, { actualSize: { width: 400, height: 0.9 * 766 - 40 } })
    sheet.remeasure()
    sheet.open('content')
    expect(input.settleTo).toHaveBeenLastCalledWith({ y: 766 - 280 })
    sheet.dispose()
    expect(panel.paddingBottom ?? 0).toBe(0)
  })
})
