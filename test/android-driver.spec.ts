import { Utils } from '@nativescript/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { animate, stop } from '../src/index.js'
import { setDriver } from '../src/driver/index.js'
import { createAndroidDriver } from '../src/driver/android.js'
import { createView } from './helpers.js'

let createDescriptor: PropertyDescriptor | undefined
let time: number
let animators: NativeAnimator[]

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
  started = false
  constructor(readonly view: NativeView) {
    animators.push(this)
  }
  setDuration() {}
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

beforeEach(() => {
  vi.useFakeTimers()
  time = 1000
  animators = []
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
    animation: {
      Keyframe: { ofFloat: (offset: number, value: number) => ({ offset, value }) },
      PropertyValuesHolder: {
        ofKeyframe: (property: string, frames: unknown[]) => ({ property, frames }),
      },
      ObjectAnimator: {
        ofPropertyValuesHolder: (view: NativeView) => new NativeAnimator(view),
      },
      ValueAnimator: { INFINITE: -1, REVERSE: 2, RESTART: 1 },
      Animator: {
        AnimatorListener: class {
          constructor(listener: NativeAnimator['listener']) {
            return listener
          }
        },
      },
    },
  })
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
