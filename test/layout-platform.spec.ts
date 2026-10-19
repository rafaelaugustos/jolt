import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createIOSDriver } from '../src/driver/ios.js'
import { createAndroidDriver } from '../src/driver/android.js'
import { retainInteractiveLayout } from '../src/driver/ios-layout.js'
import { createView } from './helpers.js'
beforeEach(() =>
  vi.stubGlobal('android', {
    view: {
      View: {},
      animation: { LinearInterpolator: class {} },
      ViewTreeObserver: {
        OnPreDrawListener: class {
          constructor(value: object) {
            Object.assign(this, value)
          }
        },
      },
    },
  }),
)
afterEach(() => vi.unstubAllGlobals())

describe('native layout boundaries', () => {
  it('reads iOS untransformed bounds rather than the transformed UIView frame', () => {
    const view = createView()
    view.nativeViewProtected = {
      bounds: { size: { width: 100, height: 50 } },
      layer: { position: { x: 60, y: 80 }, anchorPoint: { x: 0.2, y: 0.4 } },
      frame: { origin: { x: -500, y: -500 }, size: { width: 1000, height: 1000 } },
    }
    expect(createIOSDriver().layoutFrame!(view)).toEqual({
      x: 40,
      y: 60,
      width: 100,
      height: 50,
    })
  })
  it('reads Android layout edges without including translation and scale', () => {
    const view = createView()
    view.nativeViewProtected = {
      getLeft: () => 40,
      getTop: () => 60,
      getWidth: () => 100,
      getHeight: () => 50,
      getX: () => 400,
    }
    expect(createAndroidDriver().layoutFrame!(view)).toEqual({
      x: 40,
      y: 60,
      width: 100,
      height: 50,
    })
  })
  it('runs iOS after the complete layout and restores an inherited method', () => {
    const view = createView(),
      order: string[] = []
    const prototype = Object.create(Object.getPrototypeOf(view))
    prototype.layout = () => order.push('layout')
    Object.setPrototypeOf(view, prototype)
    const detach = createIOSDriver().afterLayout!(view, () => order.push('animation'))
    view.layout(0, 0, 100, 100)
    expect(order).toEqual(['layout', 'animation'])
    expect(Object.hasOwn(view, 'layout')).toBe(false)
    detach()
    view.layout(0, 0, 100, 100)
    expect(order).toEqual(['layout', 'animation', 'layout'])
  })
  it('does not clobber an extension that replaces the layout hook', () => {
    const view = createView(),
      callback = vi.fn()
    view.layout = vi.fn()
    const detach = createIOSDriver().afterLayout!(view, callback)
    const extension = vi.fn()
    view.layout = extension
    detach()
    expect(view.layout).toBe(extension)
    expect(callback).not.toHaveBeenCalled()
  })
  it('detaches the Android pre-draw listener exactly once', () => {
    const view = createView(),
      callback = vi.fn(),
      remove = vi.fn()
    let listener!: { onPreDraw(): boolean }
    const observer = {
      isAlive: () => true,
      addOnPreDrawListener: (next: typeof listener) => (listener = next),
      removeOnPreDrawListener: remove,
    }
    view.nativeViewProtected = { getViewTreeObserver: () => observer }
    const detach = createAndroidDriver().afterLayout!(view, callback)
    expect(listener.onPreDraw()).toBe(true)
    listener.onPreDraw()
    detach()
    expect(callback).toHaveBeenCalledOnce()
    expect(remove).toHaveBeenCalledExactlyOnceWith(listener)
  })
  it('uses the actual interactive transform when NativeScript lays out an identity destination', () => {
    const view = createView() as ReturnType<typeof createView> & {
      _isTransformed: boolean
      _modifyNativeViewFrame(native: any, frame: any): void
    }
    const identity = {},
      moved = {}
    vi.stubGlobal('CATransform3DIdentity', identity)
    vi.stubGlobal('CATransform3DEqualToTransform', (a: unknown, b: unknown) => a === b)
    const native = { layer: { transform: moved } }
    view.nativeViewProtected = native
    view._isTransformed = false
    const observed: boolean[] = []
    const original = function (this: typeof view) {
      observed.push(this._isTransformed)
    }
    view._modifyNativeViewFrame = original
    const one = retainInteractiveLayout(view),
      two = retainInteractiveLayout(view)
    view._modifyNativeViewFrame(native, {})
    expect(observed).toEqual([true])
    one()
    expect(view._modifyNativeViewFrame).not.toBe(original)
    native.layer.transform = identity
    two()
    two()
    expect(view._modifyNativeViewFrame).toBe(original)
    expect(view._isTransformed).toBe(false)
  })
})
