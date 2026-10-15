import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shimmer } from '../src/index.js'
import { createView } from './helpers.js'
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

class Layer {
  bounds = rect(0, 0, 200, 40)
  frame = rect(0, 0, 0, 0)
  mask: Layer | null = null
  animations = new Map<string, Record<string, any>>()
  additions = 0
  addAnimationForKey(animation: Record<string, any>, key: string) {
    this.animations.set(key, animation)
    this.additions++
  }
  removeAnimationForKey(key: string) {
    this.animations.delete(key)
  }
}

let reduced = false
const cleanups: (() => void)[] = []
const gradients: Layer[] = []
function start(...args: Parameters<typeof shimmer>) {
  const stop = shimmer(...args)
  cleanups.push(stop)
  return stop
}

function target(loaded = true) {
  const view = createView()
  const native = { layer: new Layer(), originalMask: null as Layer | null }
  view.nativeViewProtected = native
  Object.assign(view, { isLoaded: loaded })
  return { view, native, layer: native.layer }
}

async function layout(view: ReturnType<typeof createView>) {
  view.notify({ eventName: 'layoutChanged', object: view })
  await Promise.resolve()
}

function reduceMotion(value: boolean) {
  reduced = value
  for (const callback of Application.ios.observers.keys()) callback()
}

beforeEach(() => {
  platform.isIOS = true
  reduced = false
  vi.stubGlobal('UIAccessibilityIsReduceMotionEnabled', () => reduced)
  vi.stubGlobal('UIAccessibilityReduceMotionStatusDidChangeNotification', 'reduce-motion')
  vi.stubGlobal('CATransaction', {
    begin: vi.fn(),
    setDisableActions: vi.fn(),
    commit: vi.fn(),
  })
  vi.stubGlobal('CAGradientLayer', {
    new() {
      const layer = new Layer()
      gradients.push(layer)
      return layer
    },
  })
  vi.stubGlobal('CABasicAnimation', {
    animationWithKeyPath: (keyPath: string) => ({ keyPath }),
  })
  vi.stubGlobal('CAMediaTimingFunction', { functionWithName: (name: string) => name })
  vi.stubGlobal('kCAMediaTimingFunctionLinear', 'linear')
  vi.stubGlobal('UIColor', {
    colorWithWhiteAlpha: (white: number, alpha: number) => ({
      CGColor: { white, alpha },
    }),
    whiteColor: { CGColor: { white: 1, alpha: 1 } },
  })
  vi.stubGlobal('NSArray', { arrayWithArray: (values: unknown[]) => values })
  vi.stubGlobal('CGPointMake', (x: number, y: number) => ({ x, y }))
  vi.stubGlobal('CGRectMake', rect)
})

afterEach(() => {
  for (const stop of cleanups.splice(0)) stop()
  expect(Application.ios.observers.size).toBe(0)
  gradients.length = 0
  vi.unstubAllGlobals()
})

describe('shimmer', () => {
  it('plays a native repeating mask without changing view opacity or transform', () => {
    const { view, layer } = target()
    view.opacity = 0.7
    view.translateX = 12
    const stop = start({ nativeView: view })
    const gradient = layer.mask!
    const animation = gradient.animations.get('jolt:shimmer')!
    expect(animation.keyPath).toBe('locations')
    expect(animation.duration).toBe(1.5)
    expect(animation.repeatCount).toBe(Infinity)
    expect(animation.removedOnCompletion).toBe(false)
    for (const stops of [animation.fromValue, animation.toValue] as number[][]) {
      expect(stops).toEqual([...stops].sort())
      expect(stops.every((value) => value >= 0 && value <= 1)).toBe(true)
    }
    expect(gradient.frame).toEqual(rect(-200, 0, 600, 40))
    expect(view.opacity).toBe(0.7)
    expect(view.translateX).toBe(12)
    stop()
    stop()
    expect(layer.mask).toBeNull()
    expect(gradient.animations.size).toBe(0)
    expect(view.opacity).toBe(0.7)
  })

  it('waits for loaded and a nonzero layout, and can be cancelled while waiting', async () => {
    const { view, layer } = target(false)
    layer.bounds = rect(0, 0, 0, 0)
    const stop = start(view)
    expect(Application.ios.observers.size).toBe(0)
    Object.assign(view, { isLoaded: true })
    await layout(view)
    expect(layer.mask).toBeNull()
    view.notify({ eventName: 'loaded', object: view })
    expect(layer.mask).toBeNull()
    layer.bounds = rect(0, 0, 160, 32)
    await layout(view)
    expect(layer.mask).not.toBeNull()
    stop()
    await layout(view)
    expect(layer.mask).toBeNull()

    Object.assign(view, { isLoaded: false })
    start(view)()
    Object.assign(view, { isLoaded: true })
    view.notify({ eventName: 'loaded', object: view })
    expect(layer.mask).toBeNull()
  })

  it('resizes the mask without restarting its animation', async () => {
    const { view, layer } = target()
    start(view, { duration: 2400 })
    const gradient = layer.mask!
    const animation = gradient.animations.get('jolt:shimmer')
    expect(animation?.duration).toBe(2.4)
    layer.bounds = rect(10, 20, 320, 80)
    await layout(view)
    expect(layer.mask).toBe(gradient)
    expect(gradient.frame).toEqual(rect(-310, 20, 960, 80))
    expect(gradient.animations.get('jolt:shimmer')).toBe(animation)
    expect(gradient.additions).toBe(1)
  })

  it('removes the mask at zero size and resumes after a later layout', async () => {
    const { view, layer } = target()
    start(view)
    const old = layer.mask!
    layer.bounds = rect(0, 0, 0, 40)
    await layout(view)
    expect(layer.mask).toBeNull()
    expect(old.animations.size).toBe(0)
    layer.bounds = rect(0, 0, 100, 40)
    await layout(view)
    expect(layer.mask).not.toBeNull()
  })

  it('replaces a shimmer and makes the previous cleanup harmless', () => {
    const { view, layer } = target()
    const firstStop = start(view)
    const first = layer.mask!
    const secondStop = start({ nativeElement: view })
    const second = layer.mask!
    firstStop()
    expect(first.animations.size).toBe(0)
    expect(layer.mask).toBe(second)
    expect(second.animations.size).toBe(1)
    expect(Application.ios.observers.size).toBe(1)
    secondStop()
    expect(layer.mask).toBeNull()
  })

  it('releases native resources on unload and resumes when the view loads again', async () => {
    const { view, layer } = target()
    const stop = start(view)
    const gradient = layer.mask!
    view.notify({ eventName: 'unloaded', object: view })
    expect(layer.mask).toBeNull()
    expect(gradient.animations.size).toBe(0)
    expect(Application.ios.observers.size).toBe(0)
    await layout(view)
    expect(layer.mask).toBeNull()
    view.notify({ eventName: 'loaded', object: view })
    await layout(view)
    expect(layer.mask).not.toBeNull()
    expect(layer.mask).not.toBe(gradient)
    expect(Application.ios.observers.size).toBe(1)
    stop()
    for (const name of ['loaded', 'layoutChanged', 'unloaded'])
      expect(view.listenerCount(name)).toBe(0)
    expect(view.style.listenerCount('backgroundInternalChange')).toBe(0)
    expect(Application.ios.observers.size).toBe(0)
    view.notify({ eventName: 'loaded', object: view })
    await layout(view)
    expect(layer.mask).toBeNull()
  })

  it('validates duration before removing a running shimmer', () => {
    const { view, layer } = target()
    start(view)
    const gradient = layer.mask
    for (const duration of [0, -100, NaN, Infinity]) {
      expect(() => start(view, { duration })).toThrow(RangeError)
      expect(layer.mask).toBe(gradient)
    }
  })
})

describe('shimmer with existing masks', () => {
  it('reattaches after a background redraw at the end of the layout pass', async () => {
    const { view, layer } = target()
    start(view)
    const gradient = layer.mask!
    view.notify({ eventName: 'layoutChanged', object: view })
    view.notify({ eventName: 'layoutChanged', object: view })
    // Core redraws the background after raising layoutChanged.
    layer.mask = null
    await Promise.resolve()
    expect(layer.mask).toBe(gradient)
    expect(gradient.additions).toBe(1)
  })

  it('does not reattach if stopped with a layout update queued', async () => {
    const { view, layer } = target()
    const stop = start(view)
    view.notify({ eventName: 'layoutChanged', object: view })
    stop()
    await Promise.resolve()
    expect(layer.mask).toBeNull()
  })

  it('keeps a clip mask in place so Core can update its path', async () => {
    const { view, layer } = target()
    const clip = new Layer()
    clip.bounds = rect(0, 0, 0, 0)
    layer.mask = clip
    const stop = start(view)
    const gradient = clip.mask!
    expect(layer.mask).toBe(clip)
    expect(gradient.frame).toEqual(rect(-200, 0, 600, 40))
    layer.bounds = rect(0, 0, 300, 50)
    await layout(view)
    expect(gradient.frame).toEqual(rect(-300, 0, 900, 50))
    stop()
    expect(layer.mask).toBe(clip)
    expect(clip.mask).toBeNull()
  })

  it('composes after a chain of custom masks and preserves their bounds', () => {
    const { view, layer } = target()
    const first = new Layer()
    const last = new Layer()
    last.bounds = rect(5, 6, 120, 20)
    layer.mask = first
    first.mask = last
    const stop = start(view)
    expect(last.mask!.frame).toEqual(rect(-115, 6, 360, 20))
    expect(last.bounds).toEqual(rect(5, 6, 120, 20))
    stop()
    expect(layer.mask).toBe(first)
    expect(first.mask).toBe(last)
    expect(last.mask).toBeNull()
  })

  it('reattaches after Core changes the root mask and clears its saved shimmer', async () => {
    const { view, native, layer } = target()
    const stop = start(view)
    const gradient = layer.mask!
    const clip = new Layer()
    native.originalMask = gradient
    layer.mask = clip
    view.style.notify({ eventName: 'backgroundInternalChange', object: view.style })
    await Promise.resolve()
    expect(layer.mask).toBe(clip)
    expect(clip.mask).toBe(gradient)
    expect(native.originalMask).toBeNull()
    stop()
    expect(layer.mask).toBe(clip)
    expect(clip.mask).toBeNull()
  })

  it('does not overwrite a mask installed by somebody else before cleanup', () => {
    const { view, native, layer } = target()
    const stop = start(view)
    const gradient = layer.mask!
    const replacement = new Layer()
    native.originalMask = gradient
    layer.mask = replacement
    stop()
    expect(layer.mask).toBe(replacement)
    expect(native.originalMask).toBeNull()
    expect(gradient.animations.size).toBe(0)
  })
})

describe('shimmer fallbacks', () => {
  it('shows a static placeholder with Reduce Motion and reacts to preference changes', () => {
    reduced = true
    const { view, layer } = target()
    const stop = start(view)
    expect(gradients).toHaveLength(0)
    expect(layer.mask).toBeNull()
    reduceMotion(false)
    const gradient = layer.mask!
    expect(gradient).not.toBeNull()
    reduceMotion(true)
    expect(layer.mask).toBeNull()
    expect(gradient.animations.size).toBe(0)
    stop()
    reduceMotion(false)
    expect(layer.mask).toBeNull()
  })

  it('preserves the original mask when Reduce Motion turns on', () => {
    const { view, layer } = target()
    const clip = new Layer()
    layer.mask = clip
    start(view)
    reduceMotion(true)
    expect(layer.mask).toBe(clip)
    expect(clip.mask).toBeNull()
  })

  it('does not access iOS globals or subscribe to events on Android', () => {
    platform.isIOS = false
    vi.unstubAllGlobals()
    const { view, layer } = target()
    const stop = start(view)
    stop()
    stop()
    expect(layer.mask).toBeNull()
    expect(view.listenerCount('loaded')).toBe(0)
    expect(Application.ios.observers.size).toBe(0)
  })
})
