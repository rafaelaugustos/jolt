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

class NativeAnimator {
  cameraAtStart: number | undefined
  listener!: { onAnimationEnd(): void }
  constructor(readonly view: NativeView) {
    animators.push(this)
  }
  setDuration() {}
  setStartDelay() {}
  setInterpolator() {}
  addListener(listener: NativeAnimator['listener']) {
    this.listener = listener
  }
  start() {
    this.cameraAtStart = this.view.cameraDistance
  }
  cancel() {
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
      },
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
