import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { conceal, reveal, type Animation } from '../src/index.js'
import { createView, flush, state } from './helpers.js'
import { Application } from './shims/core.js'

const platform = vi.hoisted(() => ({ isIOS: true }))
vi.mock('@nativescript/core', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  get isIOS() {
    return platform.isIOS
  },
}))
const rect = (x: number, y: number, width: number, height: number) => ({
  origin: { x, y },
  size: { width, height },
})
type Rect = ReturnType<typeof rect>
class Layer {
  name = ''
  bounds = rect(0, 0, 200, 100)
  position = { x: 0, y: 0 }
  mask: Layer | null = null
  path: Rect | null = null
  fillColor: unknown
  sublayers: Layer[] = []
  presented: Layer | null = null
  animations = new Map<string, any>()
  addSublayer(layer: Layer) {
    this.sublayers.push(layer)
  }
  addAnimationForKey(animation: unknown, key: string) {
    this.animations.set(key, animation)
  }
  removeAnimationForKey(key: string) {
    const animation = this.animations.get(key)
    this.animations.delete(key)
    animation?.delegate.animationDidStopFinished(animation, false)
  }
  presentationLayer() {
    return this.presented
  }
}
let reduced = false
let now = 100
const handles: Animation[] = []
function start(
  target: Parameters<typeof reveal>[0],
  options?: Parameters<typeof reveal>[1],
  opening = true,
) {
  const handle = opening
    ? reveal(target, options)
    : conceal(target, { to: options?.from, duration: options?.duration })
  handles.push(handle)
  return handle
}
function target(
  visibility: 'visible' | 'hidden' | 'collapse' = 'visible',
  loaded = true,
) {
  const view = createView()
  view.visibility = visibility
  const native = {
    layer: new Layer(),
    window: {} as object | null,
    originalMask: null as Layer | null,
    maskType: null as string | null,
  }
  view.nativeViewProtected = native
  Object.assign(view, { isLoaded: loaded })
  return { view, native, layer: native.layer }
}
const shape = (layer: Layer) => layer.mask!.sublayers[0]!
const animation = (layer: Layer) => shape(layer).animations.get('jolt:reveal')!
function complete(animation: any, finished = true) {
  animation.delegate.animationDidStopFinished(animation, finished)
}
async function event(view: ReturnType<typeof createView>, eventName: string) {
  view.notify({ eventName, object: view })
  await flush()
}
function preference(value: boolean) {
  reduced = value
  for (const callback of [...Application.ios.observers.keys()]) callback()
}
beforeEach(() => {
  vi.useFakeTimers()
  platform.isIOS = true
  reduced = false
  now = 100
  vi.stubGlobal('UIAccessibilityIsReduceMotionEnabled', () => reduced)
  vi.stubGlobal('UIAccessibilityReduceMotionStatusDidChangeNotification', 'reduce-motion')
  vi.stubGlobal('CATransaction', {
    begin: vi.fn(),
    setDisableActions: vi.fn(),
    commit: vi.fn(),
  })
  vi.stubGlobal('CALayer', { new: () => new Layer() })
  vi.stubGlobal('CAShapeLayer', { new: () => new Layer() })
  vi.stubGlobal('CABasicAnimation', {
    animationWithKeyPath: (keyPath: string) => ({ keyPath }),
  })
  vi.stubGlobal('UIColor', { blackColor: { CGColor: 'black' } })
  vi.stubGlobal('CAMediaTimingFunction', { functionWithName: (name: string) => name })
  vi.stubGlobal('kCAMediaTimingFunctionEaseInEaseOut', 'easeInOut')
  vi.stubGlobal('UIBezierPath', {
    bezierPathWithOvalInRect: (bounds: Rect) => ({ CGPath: bounds }),
  })
  vi.stubGlobal('CGPathGetBoundingBox', (path: Rect) => path)
  vi.stubGlobal('CGPointMake', (x: number, y: number) => ({ x, y }))
  vi.stubGlobal('CGRectMake', rect)
  vi.stubGlobal('CACurrentMediaTime', () => now)
  vi.stubGlobal(
    'NSObject',
    class {
      static new() {
        return new this()
      }
      static extend(methods: object) {
        class Delegate extends this {}
        Object.assign(Delegate.prototype, methods)
        return Delegate
      }
    },
  )
  vi.stubGlobal('CAAnimationDelegate', {})
})
afterEach(() => {
  handles.splice(0).forEach((handle) => handle.stop())
  expect(Application.ios.observers.size).toBe(0)
  expect(vi.getTimerCount()).toBe(0)
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('circular reveal', () => {
  it('reveals from a point, covers every corner, and completes through the native delegate', async () => {
    const { view, layer } = target('hidden')
    view.opacity = 0.6
    view.translateX = 12
    const handle = start({ nativeView: view }, { from: { x: 20, y: 30 }, duration: 700 })
    const result = state(handle.finished)
    await flush()
    const playing = animation(layer)
    expect(view.visibility).toBe('visible')
    expect(playing.keyPath).toBe('path')
    expect(playing.duration).toBe(0.7)
    expect(playing.timingFunction).toBe('easeInOut')
    expect(playing.fromValue).toEqual(rect(19.99, 29.99, 0.02, 0.02))
    expect(playing.toValue.size.width / 2).toBeCloseTo(Math.hypot(180, 70) + 1)
    expect(shape(layer).path).toBe(playing.toValue)
    expect(result()).toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
    complete(playing)
    expect(await handle).toBe(true)
    expect(layer.mask).toBeNull()
    expect(view.visibility).toBe('visible')
    expect(view.opacity).toBe(0.6)
    expect(view.translateX).toBe(12)
  })

  it('hides before removing the mask, preserves layout and restores existing masks', async () => {
    const { view, layer } = target()
    const original = new Layer()
    const nested = new Layer()
    original.mask = nested
    layer.mask = original
    const handle = start(view, undefined, false)
    await flush()
    const wrapper = layer.mask!
    expect(wrapper.mask).toBe(original)
    expect(original.mask).toBe(nested)
    const playing = animation(layer)
    expect(playing.toValue.size.width).toBe(0.02)
    let maskAtHide: Layer | null = null
    view.style.on('visibilityChange', () => {
      if (view.visibility === 'hidden') maskAtHide = layer.mask
    })
    complete(playing)
    expect(await handle).toBe(true)
    expect(maskAtHide).toBe(wrapper)
    expect(view.visibility).toBe('hidden')
    expect(layer.mask).toBe(original)
    expect(original.mask).toBe(nested)
    expect(wrapper.mask).toBeNull()
  })

  it('uses view-local DIPs with nonzero bounds origins and an off-center origin', async () => {
    const { view, layer } = target()
    layer.bounds = rect(10, 20, 200, 100)
    start(view, { from: { x: -20, y: 10 } })
    await flush()
    const playing = animation(layer)
    expect(playing.fromValue.origin.x).toBeCloseTo(-10.01)
    expect(playing.fromValue.origin.y).toBeCloseTo(29.99)
    expect(playing.toValue.size.width / 2).toBeCloseTo(Math.hypot(220, 90) + 1)
    expect(layer.mask!.bounds).toEqual(layer.bounds)
    expect(layer.mask!.position).toEqual({ x: 110, y: 70 })
  })

  it('reverses from the presentation circle and ignores an older completion', async () => {
    const { view, layer } = target('hidden')
    const first = start(view, { from: { x: 30, y: 40 } })
    await flush()
    const oldAnimation = animation(layer)
    const presented = new Layer()
    presented.path = rect(-10, 0, 80, 80)
    shape(layer).presented = presented
    const second = start(view, { duration: 600 }, false)
    await flush()
    expect(await first).toBe(false)
    const next = animation(layer)
    expect(next.fromValue).toEqual(presented.path)
    expect(next.toValue).toEqual(rect(29.99, 39.99, 0.02, 0.02))
    complete(oldAnimation)
    expect(animation(layer)).toBe(next)
    complete(next)
    expect(await second).toBe(true)
    expect(view.visibility).toBe('hidden')
  })

  it('falls back to elapsed curve time when the presentation layer is unavailable', async () => {
    const { view, layer } = target()
    start(view, { duration: 1000 })
    await flush()
    const radius = animation(layer).toValue.size.width / 2
    now += 0.5
    start(view, undefined, false)
    await flush()
    expect(animation(layer).fromValue.size.width / 2).toBeCloseTo(radius / 2)
  })

  it('restores the original visibility on stop, including across a reversal chain', async () => {
    const { view, layer } = target('hidden')
    start(view)
    await flush()
    now += 0.1
    const second = start(view, undefined, false)
    await flush()
    const oldShape = shape(layer)
    second.stop()
    second.stop()
    expect(await second).toBe(false)
    expect(view.visibility).toBe('hidden')
    expect(layer.mask).toBeNull()
    expect(oldShape.animations.size).toBe(0)
    for (const name of ['loaded', 'layoutChanged', 'unloaded'])
      expect(view.listenerCount(name)).toBe(0)
    expect(view.style.listenerCount('backgroundInternalChange')).toBe(0)
    expect(view.style.listenerCount('visibilityChange')).toBe(0)
  })

  it('waits for loaded, a window and nonzero layout', async () => {
    const { view, native, layer } = target('hidden', false)
    native.window = null
    layer.bounds = rect(0, 0, 0, 0)
    start(view)
    await flush()
    expect(layer.mask).toBeNull()
    Object.assign(view, { isLoaded: true })
    await event(view, 'loaded')
    native.window = {}
    await event(view, 'layoutChanged')
    expect(layer.mask).toBeNull()
    layer.bounds = rect(0, 0, 100, 100)
    await event(view, 'layoutChanged')
    expect(layer.mask).not.toBeNull()
  })

  it('reserves layout for a collapsed target and restores collapse if cancelled', async () => {
    const { view, layer } = target('collapse', false)
    const handle = start(view)
    expect(view.visibility).toBe('hidden')
    handle.stop()
    await event(view, 'loaded')
    expect(await handle).toBe(false)
    expect(view.visibility).toBe('collapse')
    expect(layer.mask).toBeNull()
  })

  it('cancels on unload and does not replay when loaded again', async () => {
    const { view, layer } = target()
    const handle = start(view, undefined, false)
    await flush()
    await event(view, 'unloaded')
    expect(await handle).toBe(false)
    expect(layer.mask).toBeNull()
    expect(view.visibility).toBe('visible')
    await event(view, 'loaded')
    expect(layer.mask).toBeNull()
  })

  it('cancels when bounds change but keeps playback through an unchanged layout', async () => {
    const { view, layer } = target()
    const handle = start(view)
    await flush()
    const playing = animation(layer)
    await event(view, 'layoutChanged')
    expect(animation(layer)).toBe(playing)
    layer.bounds = rect(0, 0, 300, 100)
    await event(view, 'layoutChanged')
    expect(await handle).toBe(false)
    expect(layer.mask).toBeNull()
  })

  it('cancels after a native view replacement or detachment', async () => {
    const { view, native, layer } = target()
    const first = start(view)
    await flush()
    native.window = null
    await event(view, 'layoutChanged')
    expect(await first).toBe(false)
    expect(layer.mask).toBeNull()
    native.window = {}
    const second = start(view)
    await flush()
    view.nativeViewProtected = { layer: new Layer(), window: {} }
    await event(view, 'layoutChanged')
    expect(await second).toBe(false)
    expect(layer.mask).toBeNull()
  })

  it('keeps a replacement clip mask and removes Core references to the temporary mask', async () => {
    const { view, native, layer } = target()
    const custom = new Layer()
    layer.mask = custom
    const handle = start(view)
    await flush()
    const wrapper = layer.mask
    const replacement = new Layer()
    native.originalMask = wrapper
    layer.mask = replacement
    view.style.notify({ eventName: 'backgroundInternalChange' })
    expect(await handle).toBe(false)
    expect(layer.mask).toBe(replacement)
    expect(native.originalMask).toBe(custom)
  })

  it('restores the saved underlying mask when Core already owned a clip mask', async () => {
    const { view, native, layer } = target()
    const base = new Layer()
    const clip = new Layer()
    native.originalMask = base
    native.maskType = 'clip'
    layer.mask = clip
    const handle = start(view)
    await flush()
    native.originalMask = layer.mask
    const replacement = new Layer()
    layer.mask = replacement
    view.style.notify({ eventName: 'backgroundInternalChange' })
    expect(await handle).toBe(false)
    expect(layer.mask).toBe(replacement)
    expect(native.originalMask).toBe(base)
  })

  it('does not overwrite an external visibility or mask change', async () => {
    const { view, layer } = target()
    const handle = start(view)
    await flush()
    const external = new Layer()
    layer.mask = external
    view.visibility = 'collapse'
    expect(await handle).toBe(false)
    expect(layer.mask).toBe(external)
    expect(view.visibility).toBe('collapse')
  })

  it('validates options before interrupting a running animation', async () => {
    const { view, layer } = target()
    start(view)
    await flush()
    const current = layer.mask
    for (const duration of [-1, NaN, Infinity])
      expect(() => reveal(view, { duration })).toThrow(RangeError)
    for (const from of [
      { x: NaN, y: 0 },
      { x: 0, y: Infinity },
    ])
      expect(() => reveal(view, { from })).toThrow(TypeError)
    expect(layer.mask).toBe(current)
  })
})

describe('circular reveal fallbacks', () => {
  it('sets final visibility immediately at zero duration without native resources', async () => {
    const { view, layer } = target('hidden', false)
    expect(await start(view, { duration: 0 })).toBe(true)
    expect(view.visibility).toBe('visible')
    expect(await start(view, { duration: 0 }, false)).toBe(true)
    expect(view.visibility).toBe('hidden')
    expect(layer.mask).toBeNull()
    expect(Application.ios.observers.size).toBe(0)
  })

  it('does not uncollapse an already concealed view', async () => {
    const { view, layer } = target('collapse')
    expect(await start(view, { duration: 0 }, false)).toBe(true)
    expect(view.visibility).toBe('collapse')
    expect(layer.mask).toBeNull()
  })

  it('applies final visibility with Reduce Motion initially or enabled during playback', async () => {
    reduced = true
    const { view, layer } = target('hidden')
    expect(await start(view)).toBe(true)
    expect(view.visibility).toBe('visible')
    expect(layer.mask).toBeNull()
    reduced = false
    const hiding = start(view, undefined, false)
    await flush()
    preference(true)
    expect(await hiding).toBe(true)
    expect(view.visibility).toBe('hidden')
    expect(layer.mask).toBeNull()
    preference(false)
    expect(layer.mask).toBeNull()
  })

  it('restores visibility if native playback is cancelled', async () => {
    const { view, layer } = target('hidden')
    const handle = start(view)
    await flush()
    complete(animation(layer), false)
    expect(await handle).toBe(false)
    expect(view.visibility).toBe('hidden')
    expect(layer.mask).toBeNull()
  })

  it('does not start after stop while waiting for the first layout', async () => {
    const { view, layer } = target('hidden', false)
    const handle = start(view)
    handle.stop()
    await event(view, 'loaded')
    expect(await handle).toBe(false)
    expect(layer.mask).toBeNull()
    expect(view.listenerCount('loaded')).toBe(0)
  })

  it('is a no-op on Android without touching iOS globals or visibility', async () => {
    platform.isIOS = false
    vi.unstubAllGlobals()
    const { view, layer } = target('hidden')
    expect(await start(view)).toBe(false)
    expect(await start(view, undefined, false)).toBe(false)
    expect(view.visibility).toBe('hidden')
    expect(layer.mask).toBeNull()
    expect(view.listenerCount('loaded')).toBe(0)
  })
})
