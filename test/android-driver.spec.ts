import { Color, Utils } from '@nativescript/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { animate, sequence, stop } from '../src/index.js'
import { setDriver } from '../src/driver/index.js'
import { createAndroidDriver } from '../src/driver/android.js'
import { createView, flush, state } from './helpers.js'
import { createTrack } from '../src/track.js'
import { resolveTransition } from '../src/transition.js'

vi.mock('@nativescript/core', async () => ({
  ...(await import('./shims/core.js')),
  isAndroid: true,
  isIOS: false,
}))

let createDescriptor: PropertyDescriptor | undefined
let time: number
let animators: NativeAnimator[]
let markers: NativeMarker[]
let durationScale: number

class NativeView {
  cameraDistance = 8000
  rotationX = 0
  rotationY = 0
  rotation = 0
  alpha = 1
  layerType = 0
  hardwareAccelerated = true
  layerChanges: number[] = []
  width = 300
  height = 200
  getWidth() {
    return this.width
  }
  getHeight() {
    return this.height
  }
  getResources() {
    return { getDisplayMetrics: () => ({ widthPixels: 1080, heightPixels: 2400 }) }
  }
  isHardwareAccelerated() {
    return this.hardwareAccelerated
  }
  getLayerType() {
    return this.layerType
  }
  setLayerType(value: number, _paint: unknown) {
    this.layerType = value
    this.layerChanges.push(value)
  }
  setCameraDistance(value: number) {
    this.cameraDistance = value
  }
  setRotationX(value: number) {
    this.rotationX = value
  }
  setRotationY(value: number) {
    this.rotationY = value
  }
  setRotation(value: number) {
    this.rotation = value
  }
  setAlpha(value: number) {
    this.alpha = value
  }
  getRotationX() {
    return this.rotationX
  }
  getRotationY() {
    return this.rotationY
  }
  getRotation() {
    return this.rotation
  }
  getAlpha() {
    return this.alpha
  }
}

class ColorTarget extends NativeView {
  constructor(
    readonly native: NativeView,
    readonly property: number,
    private color: number,
  ) {
    super()
  }
  isSupported() {
    return true
  }
  setColor(color: number) {
    this.color = color
  }
  getColor() {
    return this.color
  }
}

class DecorationTarget extends NativeView {
  supported = true
  acquired = false
  constructor(
    readonly native: NativeView,
    readonly property: number,
    private value: number,
  ) {
    super()
  }
  getValue() {
    return this.value
  }
  setValue(value: number) {
    this.value = value
  }
  isSupported() {
    return this.supported
  }
  acquire() {
    this.acquired = true
  }
  release() {
    this.acquired = false
  }
}

class NativeGroup extends NativeView {
  children = 3
  getChildCount() {
    return this.children
  }
}

class NativeAnimator {
  cameraAtStart: number | undefined
  listener!: {
    onAnimationStart(): void
    onAnimationCancel(): void
    onAnimationEnd(): void
    onAnimationRepeat(): void
  }
  delay = 0
  duration = 0
  playTime = 0
  started = false
  constructor(
    readonly view: NativeView,
    readonly holders: { frames: { value: number }[] }[] = [],
  ) {
    animators.push(this)
  }
  setDuration(duration: number) {
    this.duration = duration
  }
  getCurrentPlayTime() {
    return this.playTime
  }
  setStartDelay(delay: number) {
    this.delay = delay
  }
  setInterpolator() {}
  setRepeatCount() {}
  setRepeatMode() {}
  addListener(listener: NativeAnimator['listener']) {
    this.listener = listener
  }
  start() {
    this.cameraAtStart = this.view.cameraDistance
    if (this.delay === 0) this.begin()
    if (durationScale === 0) this.finish()
  }
  begin() {
    this.started = true
    this.listener.onAnimationStart()
  }
  cancel() {
    if (!this.started) this.begin()
    this.listener.onAnimationCancel()
    this.listener.onAnimationEnd()
  }
  finish() {
    this.listener.onAnimationEnd()
  }
}

class NativeMarker {
  duration = 0
  active = false
  listener!: NativeAnimator['listener']
  constructor() {
    markers.push(this)
  }
  setDuration(duration: number) {
    this.duration = duration
  }
  addListener(listener: NativeAnimator['listener']) {
    this.listener = listener
  }
  start() {
    this.active = true
    if (durationScale === 0) this.finish()
  }
  finish() {
    this.active = false
    this.listener.onAnimationEnd()
  }
  cancel() {
    this.active = false
    this.listener.onAnimationCancel()
    this.listener.onAnimationEnd()
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  time = 1000
  animators = []
  markers = []
  durationScale = 1
  createDescriptor = Object.getOwnPropertyDescriptor(Array, 'create')
  Object.defineProperty(Array, 'create', {
    configurable: true,
    value: (_type: unknown, length: number) => Array.from({ length }),
  })
  vi.spyOn(Utils.layout, 'getDisplayDensity').mockReturnValue(3)
  vi.stubGlobal('android', {
    os: { SystemClock: { uptimeMillis: () => time } },
    view: {
      View: {
        ROTATION_X: 'rotationX',
        ROTATION_Y: 'rotationY',
        ROTATION: 'rotation',
        ALPHA: 'alpha',
        LAYER_TYPE_NONE: 0,
        LAYER_TYPE_SOFTWARE: 1,
        LAYER_TYPE_HARDWARE: 2,
      },
      ViewGroup: NativeGroup,
      animation: { LinearInterpolator: class {} },
    },
    widget: { TextView: class {} },
    animation: {
      ArgbEvaluator: class {},
      Keyframe: {
        ofFloat: (offset: number, value: number) => ({ offset, value }),
        ofInt: (offset: number, value: number) => ({ offset, value }),
      },
      PropertyValuesHolder: {
        ofKeyframe: (property: string, frames: unknown[]) => ({
          property,
          frames,
          setEvaluator() {},
        }),
      },
      ObjectAnimator: {
        ofPropertyValuesHolder: (view: NativeView, holders: NativeAnimator['holders']) =>
          new NativeAnimator(view, holders),
      },
      ValueAnimator: {
        INFINITE: -1,
        REVERSE: 2,
        RESTART: 1,
        ofFloat: () => new NativeMarker(),
      },
      Animator: {
        AnimatorListener: class {
          constructor(listener: NativeAnimator['listener']) {
            return listener
          }
        },
      },
    },
  })
  vi.stubGlobal('org', { rafaelaugusto: { jolt: { ColorTarget, DecorationTarget } } })
  setDriver(createAndroidDriver())
})

function container() {
  const view = createView()
  const native = new NativeGroup()
  view.nativeViewProtected = native
  return { view, native }
}

describe('Android fade layers', () => {
  it.each([
    [0, 200],
    [300, 0],
    [1081, 200],
    [300, 2401],
  ])('skips a %s by %s container outside the cache size limit', async (width, height) => {
    const { view, native } = container()
    native.width = width!
    native.height = height!
    const animation = animate(view, { opacity: 0.2 })
    animators[0]!.finish()
    expect(await animation).toBe(true)
    expect(native.layerChanges).toEqual([])
  })
  it('promotes a container during a fade and restores it before completing', async () => {
    const { view, native } = container()
    const animation = animate(view, { opacity: 0.2 }, { duration: 400 })
    expect(native.layerType).toBe(2)
    expect(view.listenerCount('unloaded')).toBe(1)
    animators[0]!.finish()
    expect(await animation).toBe(true)
    expect(native.layerChanges).toEqual([2, 0])
    expect(view.listenerCount('unloaded')).toBe(0)
  })

  it('waits through the start delay and keeps the layer across repeats', async () => {
    const { view, native } = container()
    const animation = animate(
      view,
      { opacity: [1, 0.2] },
      { delay: 500, repeat: Infinity, repeatType: 'reverse' },
    )
    expect(native.layerChanges).toEqual([])
    animators[0]!.begin()
    animators[0]!.listener.onAnimationRepeat()
    expect(native.layerChanges).toEqual([2])
    animation.stop()
    expect(await animation).toBe(false)
    expect(native.layerChanges).toEqual([2, 0])
  })

  it('does not allocate a layer when a delayed fade is cancelled before starting', async () => {
    const { view, native } = container()
    const animation = animate(view, { opacity: 0 }, { delay: 500 })
    animation.stop()
    expect(await animation).toBe(false)
    expect(native.layerChanges).toEqual([])
    expect(view.listenerCount('unloaded')).toBe(0)
  })

  it('does not promote a detached or replaced native view when its delay ends', async () => {
    const { view, native } = container()
    const animation = animate(view, { opacity: 0 }, { delay: 500 })
    view.unload()
    view.load()
    view.nativeViewProtected = new NativeGroup()
    animators[0]!.begin()
    expect(native.layerChanges).toEqual([])
    animation.stop()
    expect(await animation).toBe(false)
  })

  it('restores on selected-property stopping while the other track continues', async () => {
    const { view, native } = container()
    const animation = animate(view, { opacity: 0.2, rotateY: 45 }, { duration: 400 })
    native.alpha = 0.7
    stop(view, ['opacity'])
    expect(view.opacity).toBe(0.7)
    expect(native.layerChanges).toEqual([2, 0])
    animators[1]!.finish()
    expect(await animation).toBe(false)
  })

  it('restores a replaced fade once and ignores its late completion', async () => {
    const { view, native } = container()
    const first = animate(view, { opacity: 0.2 }, { duration: 400 })
    native.alpha = 0.6
    const second = animate(view, { opacity: 1 }, { duration: 400 })
    expect(await first).toBe(false)
    expect(native.layerChanges).toEqual([2, 0, 2])
    animators[0]!.finish()
    expect(native.layerType).toBe(2)
    animators[1]!.finish()
    expect(await second).toBe(true)
    expect(native.layerChanges).toEqual([2, 0, 2, 0])
  })

  it('restores on native cancellation even before the native end notification', () => {
    const { view, native } = container()
    animate(view, { opacity: 0.2 })
    animators[0]!.listener.onAnimationCancel()
    expect(native.layerChanges).toEqual([2, 0])
    animators[0]!.finish()
    expect(native.layerChanges).toEqual([2, 0])
  })

  it('releases the original native layer on unload and removes the listener', async () => {
    const { view, native } = container()
    const animation = animate(view, { opacity: 0.2 }, { repeat: Infinity })
    view.notify({ eventName: 'unloaded', object: view })
    expect(native.layerChanges).toEqual([2, 0])
    expect(view.listenerCount('unloaded')).toBe(0)
    const replacement = new NativeGroup()
    view.nativeViewProtected = replacement
    animation.stop()
    expect(await animation).toBe(false)
    expect(native.layerChanges).toEqual([2, 0])
    expect(replacement.layerChanges).toEqual([])
  })

  it.each([1, 2])('keeps an app-owned layer type %s untouched', async (type) => {
    const { view, native } = container()
    native.layerType = type
    const animation = animate(view, { opacity: 0.2 })
    animators[0]!.finish()
    expect(await animation).toBe(true)
    expect(native.layerType).toBe(type)
    expect(native.layerChanges).toEqual([])
  })

  it('does not replace an app layer change made while fading', async () => {
    const { view, native } = container()
    const animation = animate(view, { opacity: 0.2 })
    native.setLayerType(1, null)
    animators[0]!.finish()
    expect(await animation).toBe(true)
    expect(native.layerChanges).toEqual([2, 1])
  })

  it('skips empty groups, software rendering, constant opacity and non-opacity tracks', async () => {
    const empty = container()
    empty.native.children = 0
    const software = container()
    software.native.hardwareAccelerated = false
    const constant = container()
    const rotating = container()
    const animations = [
      animate(empty.view, { opacity: 0.2 }),
      animate(software.view, { opacity: 0.2 }),
      animate(constant.view, { opacity: [1, 1] }, { duration: 400 }),
      animate(rotating.view, { rotateY: 45 }),
    ]
    for (const animator of animators) animator.finish()
    expect(await Promise.all(animations)).toEqual([true, true, true, true])
    for (const { native } of [empty, software, constant, rotating])
      expect(native.layerChanges).toEqual([])
  })
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  if (createDescriptor) Object.defineProperty(Array, 'create', createDescriptor)
  else Reflect.deleteProperty(Array, 'create')
})

function target(perspective = 1000) {
  const view = createView()
  const native = new NativeView()
  view.perspective = perspective
  view.nativeViewProtected = native
  return { view, native }
}

describe('Android animation clock', () => {
  it.each([0.5, 1, 2])('inherits the velocity at native time at %sx', async (scale) => {
    durationScale = scale
    const { view, native } = target()
    const transition = resolveTransition({ duration: 1000, ease: 'easeIn' }, 'rotate', 2)
    const previous = createTrack('rotate', [0, 100], transition, 0)
    const first = animate(view, { rotate: 100 }, { duration: 1000, ease: 'easeIn' })
    animators[0]!.playTime = 250
    time += 250 * scale
    native.rotation = previous.valueAt(250)
    const second = animate(view, { rotate: 0 }, 'bouncy')
    const expected = createTrack(
      'rotate',
      [native.rotation, 0],
      resolveTransition({ type: 'spring', duration: 550, bounce: 0.4 }, 'rotate', 2),
      previous.velocityAt(250),
    )
    expect(animators[1]!.holders[0]!.frames.map((frame) => frame.value)).toEqual(
      expected.values,
    )
    expect(await first).toBe(false)
    second.stop()
    expect(await second).toBe(false)
  })

  it('includes delay and reverse iterations in native elapsed time', () => {
    const driver = createAndroidDriver()
    const { view } = target()
    const track = createTrack(
      'rotate',
      [0, 100],
      resolveTransition(
        { duration: 1000, delay: 200, repeat: 3, repeatType: 'reverse', ease: 'linear' },
        'rotate',
        2,
      ),
      0,
    )
    const handle = driver.play(view, track, time, () => {})
    expect(driver.elapsed!(handle)).toBe(0)
    animators[0]!.begin()
    animators[0]!.playTime = 1250
    expect(driver.elapsed!(handle)).toBe(1450)
    expect(track.velocityAt(driver.elapsed!(handle))).toBeCloseTo(-100)
    driver.stop(view, handle)
  })

  it('uses native elapsed time when no presentation value is available on stop', async () => {
    const driver = createAndroidDriver()
    driver.presented = () => undefined
    setDriver(driver)
    const { view } = target()
    const animation = animate(
      view,
      { rotate: 100 },
      { duration: 1000, delay: 100, ease: 'linear' },
    )
    time += 900
    animation.stop()
    expect(view.rotate).toBe(0)
    expect(await animation).toBe(false)
    const next = animate(
      view,
      { rotate: 100 },
      { duration: 1000, delay: 100, ease: 'linear' },
    )
    animators[1]!.begin()
    animators[1]!.playTime = 250
    time += 500
    next.stop()
    expect(view.rotate).toBeCloseTo(25)
  })

  it('waits for native spring arrival rather than an unscaled JS timer', async () => {
    const a = target().view
    const b = target().view
    const animation = sequence([
      [a, { rotate: 100 }, 'bouncy'],
      [b, { rotate: 90 }, { duration: 100 }],
    ])
    expect(markers).toHaveLength(1)
    expect(markers[0]!.duration).toBeLessThan(animators[0]!.duration)
    await vi.advanceTimersByTimeAsync(10000)
    expect(animators).toHaveLength(1)
    markers[0]!.finish()
    await flush()
    expect(animators).toHaveLength(2)
    animators.forEach((animator) => animator.finish())
    expect(await animation).toBe(true)
  })

  it('cancels arrival markers when stopped and ignores late native completion', async () => {
    const animation = sequence([
      [target().view, { rotate: 100 }, 'bouncy'],
      [target().view, 'fadeIn'],
    ])
    animation.stop()
    expect(markers[0]!.active).toBe(false)
    markers[0]!.finish()
    await flush()
    expect(animators).toHaveLength(1)
    expect(await animation).toBe(false)
  })

  it('finishes tweens on native completion without allocating arrival markers', async () => {
    const animation = animate(target().view, { rotate: 100 }, { duration: 400 })
    const done = state(animation.finished)
    await vi.advanceTimersByTimeAsync(4000)
    expect(done()).toBeUndefined()
    expect(markers).toHaveLength(0)
    animators[0]!.finish()
    expect(await animation).toBe(true)
  })

  it('finishes a multi-property sequence immediately when system animations are disabled', async () => {
    durationScale = 0
    const animation = sequence([
      [target().view, { rotate: 100, opacity: 0.2 }, 'bouncy'],
      [target().view, { rotate: 0 }, { duration: 400, delay: 500 }],
    ])
    expect(await animation).toBe(true)
    expect(animators).toHaveLength(3)
    expect(markers).toHaveLength(0)
  })
})

describe('Android 3D perspective', () => {
  it.each(['rotateX', 'rotateY'] as const)(
    'sets the camera before %s starts, including flips ending at zero',
    async (property) => {
      const { view, native } = target()
      const animation = animate(view, { [property]: [-90, 0] }, { duration: 400 })

      expect(native.cameraDistance).toBe(3000)
      expect(animators[0]!.cameraAtStart).toBe(3000)
      expect(property === 'rotateX' ? native.rotationX : native.rotationY).toBe(-90)
      animators[0]!.finish()
      expect(await animation).toBe(true)
    },
  )

  it('uses the configured perspective and current screen density', () => {
    vi.mocked(Utils.layout.getDisplayDensity).mockReturnValue(2.625)
    const { view, native } = target(600)
    animate(view, { rotateY: 45 }, { duration: 400 })
    expect(native.cameraDistance).toBe(1575)
  })

  it('uses the same fallback as iOS when perspective is zero', () => {
    const { view, native } = target(0)
    animate(view, { rotateX: 45 }, { duration: 400 })
    expect(native.cameraDistance).toBe(900)
  })

  it.each(['rotate', 'opacity'] as const)(
    'keeps the camera distance for %s tracks',
    (property) => {
      const { view, native } = target()
      animate(view, { [property]: 0.5 }, { duration: 400 })
      expect(native.cameraDistance).toBe(8000)
      expect(animators[0]!.cameraAtStart).toBe(8000)
    },
  )

  it('keeps perspective after completion and stopping at a tilted position', async () => {
    const { view, native } = target(600)
    const first = animate(view, { rotateY: 45 }, { duration: 400 })
    native.rotationY = 45
    animators[0]!.finish()
    expect(await first).toBe(true)
    expect(native.cameraDistance).toBe(1800)

    const second = animate(view, { rotateY: 0 }, { duration: 400 })
    native.rotationY = 27
    stop(view, ['rotateY'])
    expect(await second).toBe(false)
    expect(view.rotateY).toBe(27)
    expect(native.cameraDistance).toBe(1800)
  })

  it('uses an updated perspective on an interrupted rotation and preserves the visible angle', async () => {
    const { view, native } = target()
    const first = animate(view, { rotateX: 60 }, { duration: 400 })
    native.rotationX = 28
    time += 100
    view.perspective = 700
    const second = animate(view, { rotateX: 0 }, { duration: 400 })

    expect(await first).toBe(false)
    expect(native.rotationX).toBe(28)
    expect(animators[1]!.cameraAtStart).toBe(2100)
    second.stop()
    expect(await second).toBe(false)
  })
})

describe('Android native color target', () => {
  it('uses int keyframes and a native setter, and reads the visible color on stop', async () => {
    const { view } = container()
    const animation = animate(
      view,
      { backgroundColor: ['red', 'blue'] },
      { duration: 1000, ease: 'linear' },
    )
    const native = animators[0]!
    const target = native.view as ColorTarget
    expect(target).toBeInstanceOf(ColorTarget)
    expect(native.holders[0]!.frames[0]!.value).toBe(0xffff0000 | 0)
    expect(native.holders[0]!.frames.at(-1)!.value).toBe(0xff0000ff | 0)
    target.setColor(0xff8c53a2 | 0)
    native.playTime = 500
    stop(view, ['backgroundColor'])
    expect(view.backgroundColor?.argb).toBe(0xff8c53a2)
    expect(await animation).toBe(false)
    expect(view.listenerCount('unloaded')).toBe(0)
    expect(view.style.listenerCount('backgroundColorChange')).toBe(0)
  })
  it('settles with the final model color if native code has not been installed', async () => {
    vi.stubGlobal('org', undefined)
    const { view } = container()
    const animation = animate(view, { backgroundColor: 'blue' })
    expect(await animation).toBe(false)
    expect(view.backgroundColor?.argb).toBe(0xff0000ff)
    expect(animators).toHaveLength(0)
    expect(view.listenerCount('unloaded')).toBe(0)
  })
  it('cancels only the changed color and preserves an external value', async () => {
    const { view } = container()
    const animation = animate(view, { borderColor: ['red', 'blue'] }, { duration: 1000 })
    view.borderTopColor = new Color('white')
    view.style.notify({ eventName: 'borderTopColorChange' })
    await flush()
    expect(await animation).toBe(false)
    expect(view.borderTopColor.argb).toBe(0xffffffff)
    expect(view.style.listenerCount('borderTopColorChange')).toBe(0)
  })
  it('settles an infinite color when its view unloads', async () => {
    const { view } = container()
    const animation = animate(
      view,
      { backgroundColor: ['red', 'blue'] },
      { repeat: Infinity, delay: 100 },
    )
    view.notify({ eventName: 'unloaded' })
    expect(await animation).toBe(false)
    expect(view.listenerCount('unloaded')).toBe(0)
  })
})

describe('Android decorations', () => {
  it('hands DIP samples to a native float target and freezes its actual value', async () => {
    const { view } = container()
    const animation = animate(
      view,
      { borderRadius: [8, 40], borderWidth: [2, 8] },
      { delay: 100, duration: 1000 },
    )
    const target = animators[0]!.view as DecorationTarget
    expect(target.property).toBe(0)
    expect(target.getValue()).toBe(24)
    expect(animators[0]!.holders[0]!.frames.at(-1)!.value).toBe(120)
    expect(animators[0]!.delay).toBe(100)
    target.setValue(60)
    stop(view, ['borderRadius'])
    expect(view.borderRadius).toBe(20)
    expect(target.acquired).toBe(false)
    expect((animators[1]!.view as DecorationTarget).acquired).toBe(true)
    animators[1]!.finish()
    expect(await animation).toBe(false)
  })
  it('balances Z ownership on unload and reports skipped native helpers', async () => {
    const { view } = container()
    const animation = animate(view, { elevation: [2, 24], translationZ: [0, 8] })
    const targets = animators.map((animator) => animator.view as DecorationTarget)
    expect(targets.map((target) => target.property)).toEqual([2, 3])
    view.notify({ eventName: 'unloaded', object: view })
    expect(await animation).toBe(false)
    expect(targets.every((target) => !target.acquired)).toBe(true)
    expect(view.listenerCount('unloaded')).toBe(0)
    vi.stubGlobal('org', undefined)
    expect(await animate(view, { borderRadius: 12 })).toBe(false)
    expect(view.borderRadius).toBe(12)
  })
  it('rejects iOS shadow fields and cached CSS shadow geometry on Android', () => {
    const { view } = container()
    expect(() => animate(view, { shadowRadius: 12 })).toThrow(/iOS/)
    view.boxShadow = [{ color: new Color('black'), offsetX: 0, offsetY: 4, inset: false }]
    expect(() => animate(view, { borderRadius: 24 })).toThrow(/elevation shadows/)
    expect(animators).toHaveLength(0)
  })
  it('reapplies other native presentations after committing a stopped border to Core', async () => {
    const { view } = container()
    const animation = animate(
      view,
      { borderRadius: [8, 40], borderWidth: [2, 8] },
      { duration: 1000 },
    )
    const radius = animators[0]!.view as DecorationTarget
    radius.setValue(60)
    const restore = vi.spyOn(radius, 'setValue')
    stop(view, ['borderWidth'])
    expect(restore).toHaveBeenLastCalledWith(60)
    animation.stop()
    expect(await animation).toBe(false)
  })
})
