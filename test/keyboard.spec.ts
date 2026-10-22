import { Utils } from '@nativescript/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { animate, followKeyboard } from '../src/index.js'
import { Application } from './shims/core.js'
import { createView, driver } from './helpers.js'

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

type Rect = { origin: { x: number; y: number }; size: { width: number; height: number } }
const rect = (y: number, height: number, width = 390): Rect => ({
  origin: { x: 0, y },
  size: { width, height },
})
const WINDOW_HEIGHT = 844

class NativeView {
  bounds = rect(0, 56)
  window: { bounds: Rect; convertRectFromWindow(frame: Rect): Rect } | null = {
    bounds: rect(0, WINDOW_HEIGHT),
    convertRectFromWindow: (frame: Rect) => frame,
  }
  constructor(
    private readonly owner: { translateY: number },
    private readonly top = 760,
  ) {}
  convertRectToView(bounds: Rect) {
    return rect(this.top + this.owner.translateY, bounds.size.height)
  }
}

const animations: { duration: number; delay: number; options: number }[] = []

function target(top?: number) {
  const view = createView()
  const native = new NativeView(view, top)
  view.nativeViewProtected = native
  return { view, native }
}

function keyboard(top: number, duration = 0.25, curve = 7) {
  const values: Record<string, unknown> = {
    frame: { CGRectValue: rect(top, WINDOW_HEIGHT - top) },
    duration,
    curve,
  }
  const notification = { userInfo: { objectForKey: (key: string) => values[key] } }
  for (const [callback, name] of Application.ios.observers)
    if (name === 'keyboard') (callback as (n: unknown) => void)(notification)
}

beforeEach(() => {
  platform.isIOS = true
  animations.length = 0
  Application.ios.observers.clear()
  vi.stubGlobal('UIKeyboardWillChangeFrameNotification', 'keyboard')
  vi.stubGlobal('UIKeyboardFrameEndUserInfoKey', 'frame')
  vi.stubGlobal('UIKeyboardAnimationDurationUserInfoKey', 'duration')
  vi.stubGlobal('UIKeyboardAnimationCurveUserInfoKey', 'curve')
  vi.stubGlobal('UIView', {
    animateWithDurationDelayOptionsAnimationsCompletion(
      duration: number,
      delay: number,
      options: number,
      block: () => void,
    ) {
      animations.push({ duration, delay, options })
      block()
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('followKeyboard on iOS', () => {
  it('lifts the view by its overlap with the keyboard timing', () => {
    const { view } = target()
    const release = followKeyboard(view)
    keyboard(600)
    expect(view.translateY).toBe(-216)
    expect(animations).toEqual([{ duration: 0.25, delay: 0, options: (7 << 16) | 4 }])
    release()
  })

  it('returns when the keyboard hides and keeps a requested gap', () => {
    const { view } = target()
    const release = followKeyboard(view, { offset: 12 })
    keyboard(600)
    expect(view.translateY).toBe(-228)
    keyboard(WINDOW_HEIGHT)
    expect(view.translateY).toBe(0)
    expect(animations).toHaveLength(2)
    release()
  })

  it('leaves a view that the keyboard does not cover alone', () => {
    const { view } = target(100)
    const release = followKeyboard(view)
    keyboard(600)
    expect(view.translateY).toBe(0)
    expect(animations).toEqual([])
    release()
  })

  it('skips frames that do not change the overlap and measures through its own translation', () => {
    const { view } = target()
    const release = followKeyboard(view)
    keyboard(600)
    keyboard(600, 0.3)
    expect(animations).toHaveLength(1)
    keyboard(500)
    expect(view.translateY).toBe(-316)
    expect(animations).toHaveLength(2)
    release()
  })

  it('also reads the duration and curve from NSNumber objects', () => {
    const { view } = target()
    const release = followKeyboard(view)
    const values: Record<string, unknown> = {
      frame: { CGRectValue: rect(600, WINDOW_HEIGHT - 600) },
      duration: { doubleValue: 0.25 },
      curve: { doubleValue: 7 },
    }
    const notification = { userInfo: { objectForKey: (key: string) => values[key] } }
    for (const [callback, name] of Application.ios.observers)
      if (name === 'keyboard') (callback as (n: unknown) => void)(notification)
    expect(view.translateY).toBe(-216)
    expect(animations).toEqual([{ duration: 0.25, delay: 0, options: (7 << 16) | 4 }])
    release()
  })

  it('applies a zero-duration change without an animation block', () => {
    const { view } = target()
    const release = followKeyboard(view)
    keyboard(600, 0)
    expect(view.translateY).toBe(-216)
    expect(animations).toEqual([])
    release()
  })

  it('stops a running Jolt animation on y before moving', () => {
    const { view } = target()
    const release = followKeyboard(view)
    const animation = animate(view, { y: 40, opacity: 0.5 }, { duration: 1000 })
    driver.advance(500)
    keyboard(600)
    expect(driver.last('y').stopped).toBe(true)
    expect(driver.last('opacity').stopped).toBe(false)
    expect(view.translateY).toBe(-216)
    release()
    animation.stop()
  })

  it('cleans up once, resetting the translation it applied', () => {
    const { view } = target()
    const release = followKeyboard({ nativeView: view })
    expect(Application.ios.observers.size).toBe(1)
    keyboard(600)
    release()
    release()
    expect(Application.ios.observers.size).toBe(0)
    expect(view.translateY).toBe(0)
    expect(view.listenerCount('unloaded')).toBe(0)
    keyboard(500)
    expect(view.translateY).toBe(0)
  })

  it('does not touch a translation it never changed', () => {
    const { view } = target()
    view.translateY = 30
    const release = followKeyboard(view)
    release()
    expect(view.translateY).toBe(30)
  })

  it('stops following when the view unloads', () => {
    const { view } = target()
    followKeyboard(view)
    keyboard(600)
    view.notify({ eventName: 'unloaded', object: view })
    expect(Application.ios.observers.size).toBe(0)
    expect(view.translateY).toBe(0)
  })

  it('waits for the view to load', () => {
    const { view, native } = target()
    view.isLoaded = false
    const release = followKeyboard(view)
    keyboard(600)
    expect(view.translateY).toBe(0)
    view.isLoaded = true
    keyboard(600)
    expect(view.translateY).toBe(-216)
    native.window = null
    keyboard(500)
    expect(view.translateY).toBe(-216)
    release()
  })

  it('rejects a nonfinite offset and non-views', () => {
    expect(() => followKeyboard(createView(), { offset: NaN })).toThrow(RangeError)
    expect(() => followKeyboard({} as never)).toThrow(TypeError)
  })
})

describe('followKeyboard on Android', () => {
  class Follower {
    static instances: Follower[] = []
    attached = false
    constructor(
      readonly native: object,
      readonly offset: number,
      readonly listener: { onStart(): void; onSettled(translation: number): void },
    ) {
      Follower.instances.push(this)
    }
    attach() {
      this.attached = true
    }
    detach() {
      this.attached = false
    }
    static Listener = class {
      constructor(implementation: Follower['listener']) {
        return implementation
      }
    }
  }
  let sdk: number

  beforeEach(() => {
    platform.isIOS = false
    sdk = 34
    Follower.instances = []
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
    vi.stubGlobal('org', { rafaelaugusto: { jolt: { KeyboardFollower: Follower } } })
  })

  it('attaches a native follower in pixels and detaches on cleanup', () => {
    const view = createView()
    const release = followKeyboard(view, { offset: 8 })
    const [follower] = Follower.instances
    expect(follower?.native).toBe(view.nativeViewProtected)
    expect(follower?.offset).toBe(24)
    expect(follower?.attached).toBe(true)
    release()
    release()
    expect(follower?.attached).toBe(false)
    expect(Follower.instances).toHaveLength(1)
    expect(view.listenerCount('unloaded')).toBe(0)
  })

  it('stops a running y animation when the keyboard starts and syncs the settled value', () => {
    const view = createView()
    const release = followKeyboard({ nativeView: view })
    const animation = animate(view, { y: 40 }, { duration: 1000 })
    const [follower] = Follower.instances
    follower!.listener.onStart()
    expect(driver.last('y').stopped).toBe(true)
    follower!.listener.onSettled(-150)
    expect(view.translateY).toBe(-50)
    release()
    expect(view.translateY).toBe(0)
    animation.stop()
  })

  it('attaches once the view loads and detaches when it unloads', () => {
    const view = createView().unload()
    followKeyboard(view)
    expect(Follower.instances).toHaveLength(0)
    view.load()
    expect(Follower.instances).toHaveLength(1)
    expect(Follower.instances[0]!.attached).toBe(true)
    view.notify({ eventName: 'unloaded', object: view })
    expect(Follower.instances[0]!.attached).toBe(false)
    view.load()
    expect(Follower.instances).toHaveLength(1)
  })

  it('below Android 11, animates from where the layout moved the view with the measured timing', () => {
    sdk = 29
    const legacy: {
      native: object
      offset: number
      listener: { onMove(from: number, to: number, keyboard: number): void }
      attached: boolean
    }[] = []
    class FrameFollower {
      attached = false
      constructor(
        readonly native: object,
        readonly offset: number,
        readonly listener: { onMove(from: number, to: number, keyboard: number): void },
      ) {
        legacy.push(this)
      }
      attach() {
        this.attached = true
      }
      detach() {
        this.attached = false
      }
      static Listener = class {
        constructor(implementation: FrameFollower['listener']) {
          return implementation
        }
      }
    }
    vi.stubGlobal('org', {
      rafaelaugusto: {
        jolt: { KeyboardFollower: Follower, KeyboardFrameFollower: FrameFollower },
      },
    })
    const view = createView()
    const release = followKeyboard(view, { offset: 4 })
    expect(Follower.instances).toHaveLength(0)
    const [follower] = legacy
    expect(follower?.native).toBe(view.nativeViewProtected)
    expect(follower?.offset).toBe(12)
    expect(follower?.attached).toBe(true)

    follower!.listener.onMove(600, -150, 900)
    const up = driver.last('y').track
    expect(up.values[0]).toBe(200)
    expect(up.to).toBe(-50)
    expect(up.duration).toBe(150)
    expect(view.translateY).toBe(-50)

    follower!.listener.onMove(-450, 0, 0)
    expect(driver.last('y').track.values[0]).toBe(-150)
    expect(driver.last('y').track.to).toBe(0)

    release()
    expect(follower?.attached).toBe(false)
    expect(view.translateY).toBe(0)
  })

  it('does nothing without the native plugin', () => {
    vi.stubGlobal('org', { rafaelaugusto: { jolt: {} } })
    const view = createView()
    const release = followKeyboard(view)
    expect(view.listenerCount('unloaded')).toBe(1)
    release()
    expect(view.listenerCount('unloaded')).toBe(0)
  })
})
