import { Utils } from '@nativescript/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onKeyboard, type KeyboardState } from '../src/index.js'
import { currentKeyboard } from '../src/keyboard.js'
import { resolveTransition } from '../src/transition.js'
import { createTrack } from '../src/track.js'
import { Application } from './shims/core.js'
import './helpers.js'

const platform = vi.hoisted(() => ({ isIOS: true }))
vi.mock('@nativescript/core', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  get isIOS() {
    return platform.isIOS
  },
  get isAndroid() {
    return !platform.isIOS
  },
}))

const WINDOW_HEIGHT = 844
const rect = (y: number, height: number) => ({
  origin: { x: 0, y },
  size: { width: 390, height },
})

function keyboard(top: number, duration = 0.25, curve = 7, height = WINDOW_HEIGHT - top) {
  const values: Record<string, unknown> = {
    frame: { CGRectValue: rect(top, height) },
    duration,
    curve,
  }
  const notification = { userInfo: { objectForKey: (key: string) => values[key] } }
  for (const [callback, name] of Application.ios.observers)
    if (name === 'keyboard') (callback as (n: unknown) => void)(notification)
}

const cleanups: (() => void)[] = []

function listen() {
  const seen: KeyboardState[] = []
  const off = onKeyboard((state) => seen.push(state))
  cleanups.push(off)
  return { seen, off }
}

afterEach(() => {
  cleanups.splice(0).forEach((off) => off())
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('onKeyboard on iOS', () => {
  beforeEach(() => {
    platform.isIOS = true
    Application.ios.observers.clear()
    Application.ios.window = {
      bounds: rect(0, WINDOW_HEIGHT),
      convertRectFromWindow: (frame: unknown) => frame,
    }
    vi.stubGlobal('UIKeyboardWillChangeFrameNotification', 'keyboard')
    vi.stubGlobal('UIKeyboardFrameEndUserInfoKey', 'frame')
    vi.stubGlobal('UIKeyboardAnimationDurationUserInfoKey', 'duration')
    vi.stubGlobal('UIKeyboardAnimationCurveUserInfoKey', 'curve')
  })

  it('reports how much of the window the keyboard covers, and when it hides', () => {
    const { seen, off } = listen()
    keyboard(508)
    keyboard(508)
    keyboard(WINDOW_HEIGHT)

    expect(seen.map(({ visible, height }) => ({ visible, height }))).toEqual([
      { visible: true, height: 336 },
      { visible: false, height: 0 },
    ])
    off()
  })

  it('times the keyboard curve as the critically damped spring Core Animation plays', () => {
    const { seen, off } = listen()
    keyboard(508)

    const [state] = seen
    expect(state!.duration).toBe(500)
    const track = createTrack(
      'y',
      [0, 336],
      resolveTransition(state!.transition, 'y', 2),
      0,
    )
    for (const [time, measured] of [
      [17, 0.0371],
      [97, 0.5286],
      [208, 0.8926],
      [304, 0.9746],
      [401, 0.9945],
    ] as const)
      expect(track.valueAt(time) / 336).toBeCloseTo(measured, 2)
    off()
  })

  it('maps the public curves to tweens and an instant change to no animation', () => {
    const { seen, off } = listen()
    keyboard(508, 0.3, 2)
    keyboard(500, 0.3, 3)
    keyboard(400, 0)

    expect(seen.map((state) => [state.duration, state.transition])).toEqual([
      [300, { duration: 300, ease: 'easeOut' }],
      [300, { duration: 300, ease: 'linear' }],
      [0, { duration: 0 }],
    ])
    off()
  })

  it('treats a floating or undocked keyboard as not covering the window', () => {
    const { seen, off } = listen()
    keyboard(508)
    keyboard(300, 0.25, 7, 200)
    keyboard(0, 0.25, 7, 0)

    expect(seen.map((state) => state.visible)).toEqual([true, false])
    off()
  })

  it('shares one observer and removes it with the last listener', () => {
    const first = listen()
    const second = listen()
    expect(Application.ios.observers.size).toBe(1)
    keyboard(508)
    expect(currentKeyboard().height).toBe(336)

    first.off()
    first.off()
    expect(Application.ios.observers.size).toBe(1)
    second.off()
    expect(Application.ios.observers.size).toBe(0)
    expect(first.seen).toHaveLength(1)
    expect(second.seen).toHaveLength(1)
  })

  it('ignores notifications without a window or an end frame', () => {
    const { seen, off } = listen()
    Application.ios.window = undefined
    keyboard(508)
    expect(seen).toEqual([])
    off()
  })

  it('keeps a Vue ref in sync until the component unmounts', async () => {
    const { useKeyboard } = await import('../src/vue/index.js')
    const { unmountHooks } = await import('./shims/vue.js')
    const state = useKeyboard()
    expect(state.value.visible).toBe(false)

    keyboard(508)
    expect(state.value).toMatchObject({ visible: true, height: 336 })
    unmountHooks.splice(0).forEach((hook) => hook())
    expect(Application.ios.observers.size).toBe(0)
    keyboard(WINDOW_HEIGHT)
    expect(state.value.visible).toBe(true)
  })

  it('rejects anything but a callback', () => {
    expect(() => onKeyboard(undefined as never)).toThrow(TypeError)
    expect(Application.ios.observers.size).toBe(0)
  })
})

describe('onKeyboard on Android', () => {
  class Observer {
    static instances: Observer[] = []
    attached = false
    covered = 0
    constructor(
      readonly root: object,
      readonly listener: {
        onChange(height: number, duration: number, curve: number[] | null): void
      },
    ) {
      Observer.instances.push(this)
    }
    attach() {
      this.attached = true
    }
    detach() {
      this.attached = false
    }
    height() {
      return this.covered
    }
    static Listener = class {
      constructor(implementation: Observer['listener']) {
        return implementation
      }
    }
  }
  const decor = {}
  const activity = { getWindow: () => ({ getDecorView: () => decor }) }
  let sdk: number

  beforeEach(() => {
    platform.isIOS = false
    sdk = 34
    Observer.instances = []
    Application.android.foregroundActivity = activity
    Application.android.startActivity = undefined
    vi.spyOn(Utils.layout, 'getDisplayDensity').mockReturnValue(3)
    vi.stubGlobal('android', {
      os: {
        Build: {
          VERSION: {
            get SDK_INT() {
              return sdk
            },
          },
        },
      },
    })
    vi.stubGlobal('org', { rafaelaugusto: { jolt: { KeyboardObserver: Observer } } })
  })

  it('observes the window and reports DIPs with the keyboard interpolator', () => {
    const { seen, off } = listen()
    const [observer] = Observer.instances
    expect(observer?.root).toBe(decor)
    expect(observer?.attached).toBe(true)

    const curve = [0, 0.5, 0.8, 1]
    observer!.listener.onChange(900, 285, curve)
    observer!.listener.onChange(0, 0, null)

    const [shown, hidden] = seen
    expect(shown).toMatchObject({ visible: true, height: 300, duration: 285 })
    const ease = (shown!.transition as { ease: (p: number) => number }).ease
    expect([0, 1 / 6, 1 / 3, 1].map((p) => ease(p))).toEqual([
      0,
      expect.closeTo(0.25),
      0.5,
      1,
    ])
    expect(hidden).toMatchObject({
      visible: false,
      height: 0,
      transition: { duration: 0 },
    })

    off()
    expect(observer?.attached).toBe(false)
  })

  it('starts from a keyboard that is already open without calling back', () => {
    const first = listen()
    first.off()
    Observer.prototype.covered = 0
    const proto = Observer.prototype as unknown as { height(): number }
    vi.spyOn(proto, 'height').mockReturnValue(600)

    const { seen, off } = listen()
    expect(currentKeyboard()).toMatchObject({ visible: true, height: 200 })
    expect(seen).toEqual([])
    off()
  })

  it('waits for the activity when it starts before the app launches', () => {
    Application.android.foregroundActivity = undefined
    const { off } = listen()
    expect(Observer.instances).toHaveLength(0)

    Application.android.startActivity = activity
    Application.notify({ eventName: Application.launchEvent, object: Application })
    expect(Observer.instances).toHaveLength(1)
    Application.notify({ eventName: Application.launchEvent, object: Application })
    expect(Observer.instances).toHaveLength(1)
    off()
  })

  it('reads the visible frame below Android 11, with the measured timing', () => {
    sdk = 29
    const frames: { root: object; listener: { onChange(height: number): void } }[] = []
    class Frame {
      constructor(
        readonly root: object,
        readonly listener: { onChange(height: number): void },
      ) {
        frames.push(this)
      }
      attach() {}
      detach() {}
      height() {
        return 0
      }
      static Listener = class {
        constructor(implementation: Frame['listener']) {
          return implementation
        }
      }
    }
    vi.stubGlobal('org', { rafaelaugusto: { jolt: { KeyboardFrame: Frame } } })
    const { seen, off } = listen()
    expect(Observer.instances).toHaveLength(0)
    expect(frames[0]?.root).toBe(decor)
    frames[0]!.listener.onChange(900)
    frames[0]!.listener.onChange(0)
    expect(seen).toEqual([
      {
        visible: true,
        height: 300,
        duration: 150,
        transition: { duration: 150, ease: 'quadOut' },
      },
      {
        visible: false,
        height: 0,
        duration: 150,
        transition: { duration: 150, ease: 'quadIn' },
      },
    ])
    off()
  })

  it('does nothing without the native plugin', () => {
    vi.stubGlobal('org', { rafaelaugusto: { jolt: {} } })
    for (const version of [29, 34]) {
      sdk = version
      const { seen, off } = listen()
      expect(seen).toEqual([])
      off()
    }
    expect(Observer.instances).toHaveLength(0)
  })
})
