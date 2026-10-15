import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loader, type LoaderOptions, type LoaderStyle } from '../src/index.js'
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
  name = ''
  bounds = rect(0, 0, 200, 80)
  position = { x: 0, y: 0 }
  cornerRadius = 0
  opacity = 1
  backgroundColor: unknown
  instanceCount = 1
  instanceDelay = 0
  instanceTransform: unknown
  mask: Layer | null = null
  superlayer: Layer | undefined
  sublayers: Layer[] = []
  animations = new Map<string, Record<string, any>>()
  additions = 0
  addSublayer(layer: Layer) {
    layer.superlayer = this
    this.sublayers.push(layer)
  }
  removeFromSuperlayer() {
    if (this.superlayer)
      this.superlayer.sublayers = this.superlayer.sublayers.filter((l) => l !== this)
    this.superlayer = undefined
  }
  addAnimationForKey(animation: Record<string, any>, key: string) {
    this.animations.set(key, animation)
    this.additions++
  }
  removeAnimationForKey(key: string) {
    this.animations.delete(key)
  }
  convertTimeFromLayer(time: number) {
    return time - 10
  }
}

let reduced = false
const cleanups: (() => void)[] = []
function start(...args: Parameters<typeof loader>) {
  const stop = loader(...args)
  cleanups.push(stop)
  return stop
}
function target(loaded = true) {
  const view = createView()
  const native = { layer: new Layer(), window: {} as object | null }
  view.nativeViewProtected = native
  Object.assign(view, { isLoaded: loaded })
  return { view, native, layer: native.layer }
}
async function event(view: ReturnType<typeof createView>, eventName = 'layoutChanged') {
  view.notify({ eventName, object: view })
  await Promise.resolve()
}
async function reduceMotion(value: boolean) {
  reduced = value
  for (const callback of Application.ios.observers.keys()) callback()
  await Promise.resolve()
}
const indicator = (host: Layer) => host.sublayers.find((l) => l.name === 'jolt:loader')!
const item = (host: Layer) => indicator(host).sublayers[0]!

beforeEach(() => {
  vi.useFakeTimers()
  platform.isIOS = true
  reduced = false
  vi.stubGlobal('UIAccessibilityIsReduceMotionEnabled', () => reduced)
  vi.stubGlobal('UIAccessibilityReduceMotionStatusDidChangeNotification', 'reduce-motion')
  vi.stubGlobal('CATransaction', {
    begin: vi.fn(),
    setDisableActions: vi.fn(),
    commit: vi.fn(),
  })
  vi.stubGlobal('CAReplicatorLayer', { new: () => new Layer() })
  vi.stubGlobal('CALayer', { new: () => new Layer() })
  vi.stubGlobal('CAKeyframeAnimation', {
    animationWithKeyPath: (keyPath: string) => ({ keyPath }),
  })
  vi.stubGlobal('NSArray', { arrayWithArray: (values: unknown[]) => values })
  vi.stubGlobal('CGPointMake', (x: number, y: number) => ({ x, y }))
  vi.stubGlobal('CGRectMake', rect)
  vi.stubGlobal('CATransform3DMakeTranslation', (x: number, y: number, z: number) => ({
    x,
    y,
    z,
  }))
  vi.stubGlobal(
    'CATransform3DMakeRotation',
    (angle: number, x: number, y: number, z: number) => ({ angle, x, y, z }),
  )
  vi.stubGlobal('CACurrentMediaTime', () => 100)
})
afterEach(() => {
  for (const stop of cleanups.splice(0)) stop()
  expect(Application.ios.observers.size).toBe(0)
  expect(vi.getTimerCount()).toBe(0)
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('loader', () => {
  it.each([
    ['dots', 3, 'transform.scale'],
    ['bars', 5, 'transform.scale.y'],
    ['ring', 12, 'opacity'],
  ] as const)(
    'plays %s with one native animated layer and no timers',
    async (style, count, path) => {
      const { view, layer } = target()
      start({ nativeView: view }, { style, color: '#dcf71d' })
      await Promise.resolve()
      const copies = indicator(layer)
      const source = item(layer)
      expect(copies.instanceCount).toBe(count)
      expect(copies.sublayers).toHaveLength(1)
      expect(source.backgroundColor).toBe('#dcf71d')
      expect(source.animations.size).toBe(1)
      const animation = source.animations.get('jolt:loader')!
      expect(animation.keyPath).toBe(path)
      expect(animation.repeatCount).toBe(Infinity)
      expect(animation.duration).toBe(1.2)
      // Delayed copies start within an already-running cycle in the layer's local time.
      expect(animation.beginTime).toBeCloseTo(88.8)
      expect(copies.instanceDelay).toBeCloseTo(style === 'ring' ? 0.1 : 0.24)
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  it('centers and fits the indicator, keeping masks, other layers and view properties', async () => {
    const { view, layer } = target()
    const unrelated = new Layer()
    const mask = new Layer()
    layer.addSublayer(unrelated)
    layer.mask = mask
    layer.bounds = rect(10, 20, 120, 30)
    view.opacity = 0.6
    view.translateX = 12
    const stop = start(view, { size: 80 })
    await Promise.resolve()
    expect(indicator(layer).bounds).toEqual(rect(0, 0, 30, 30))
    expect(indicator(layer).position).toEqual({ x: 70, y: 35 })
    expect(layer.mask).toBe(mask)
    const source = item(layer)
    stop()
    stop()
    expect(layer.sublayers).toEqual([unrelated])
    expect(layer.mask).toBe(mask)
    expect(source.animations.size).toBe(0)
    expect(view.opacity).toBe(0.6)
    expect(view.translateX).toBe(12)
  })

  it('updates geometry without restarting the animation', async () => {
    const { view, layer } = target()
    start(view, { style: 'bars', size: 60, duration: 2000 })
    await Promise.resolve()
    const copies = indicator(layer)
    const source = item(layer)
    const animation = source.animations.get('jolt:loader')
    layer.bounds = rect(5, 8, 300, 40)
    await event(view)
    expect(indicator(layer)).toBe(copies)
    expect(copies.bounds).toEqual(rect(0, 0, 40, 40))
    expect(copies.position).toEqual({ x: 155, y: 28 })
    expect(source.bounds).toEqual(rect(0, 0, 4.8, 30))
    expect(source.animations.get('jolt:loader')).toBe(animation)
    expect(source.additions).toBe(1)
    expect(animation?.duration).toBe(2)
  })

  it('waits for loaded, a window and nonzero bounds', async () => {
    const { view, native, layer } = target(false)
    native.window = null
    layer.bounds = rect(0, 0, 0, 0)
    start(view)
    await Promise.resolve()
    expect(indicator(layer)).toBeUndefined()
    expect(Application.ios.observers.size).toBe(0)
    Object.assign(view, { isLoaded: true })
    await event(view, 'loaded')
    expect(indicator(layer)).toBeUndefined()
    native.window = {}
    await event(view)
    expect(indicator(layer)).toBeUndefined()
    layer.bounds = rect(0, 0, 100, 50)
    await event(view)
    expect(indicator(layer)).toBeDefined()
  })

  it('does not start after cleanup while an update is queued', async () => {
    const { view, layer } = target()
    start(view)()
    await Promise.resolve()
    await event(view, 'loaded')
    expect(indicator(layer)).toBeUndefined()
    for (const name of ['loaded', 'layoutChanged', 'unloaded'])
      expect(view.listenerCount(name)).toBe(0)
  })

  it('replaces a loader without allowing an old cleanup to remove the replacement', async () => {
    const { view, layer } = target()
    const stopFirst = start(view)
    await Promise.resolve()
    const old = item(layer)
    const stopSecond = start({ nativeElement: view }, { style: 'ring' })
    await Promise.resolve()
    stopFirst()
    expect(old.animations.size).toBe(0)
    expect(layer.sublayers).toHaveLength(1)
    expect(indicator(layer).instanceCount).toBe(12)
    expect(Application.ios.observers.size).toBe(1)
    stopSecond()
    expect(layer.sublayers).toHaveLength(0)
  })

  it('releases native resources on unload and resumes on load until stopped', async () => {
    const { view, layer } = target()
    const stop = start(view)
    await Promise.resolve()
    const old = item(layer)
    await event(view, 'unloaded')
    expect(layer.sublayers).toHaveLength(0)
    expect(old.animations.size).toBe(0)
    expect(Application.ios.observers.size).toBe(0)
    await event(view)
    expect(layer.sublayers).toHaveLength(0)
    await event(view, 'loaded')
    expect(indicator(layer)).toBeDefined()
    expect(item(layer)).not.toBe(old)
    stop()
    await event(view, 'loaded')
    expect(layer.sublayers).toHaveLength(0)
    for (const name of ['loaded', 'layoutChanged', 'unloaded'])
      expect(view.listenerCount(name)).toBe(0)
  })

  it('releases a zero-size or detached indicator and recreates it after layout', async () => {
    const { view, native, layer } = target()
    start(view)
    await Promise.resolve()
    const old = item(layer)
    layer.bounds = rect(0, 0, 0, 40)
    await event(view)
    expect(indicator(layer)).toBeUndefined()
    expect(old.animations.size).toBe(0)
    layer.bounds = rect(0, 0, 80, 40)
    await event(view)
    expect(indicator(layer)).toBeDefined()
    native.window = null
    await event(view)
    expect(indicator(layer)).toBeUndefined()
    native.window = {}
    await event(view)
    expect(indicator(layer)).toBeDefined()
  })

  it('cleans up the old native view when it is replaced', async () => {
    const { view, layer } = target()
    start(view)
    await Promise.resolve()
    const old = item(layer)
    const replacement = { layer: new Layer(), window: {} }
    view.nativeViewProtected = replacement
    await event(view)
    expect(layer.sublayers).toHaveLength(0)
    expect(old.animations.size).toBe(0)
    expect(indicator(replacement.layer)).toBeDefined()
    expect(Application.ios.observers.size).toBe(1)
  })

  it('validates options before replacing a running loader', async () => {
    const { view, layer } = target()
    start(view)
    await Promise.resolve()
    const current = indicator(layer)
    const invalid: LoaderOptions[] = [
      { style: 'unknown' as LoaderStyle },
      { color: 'not-a-color' },
      ...[0, -1, NaN, Infinity].flatMap((value) => [
        { size: value },
        { duration: value },
      ]),
    ]
    for (const options of invalid) {
      expect(() => start(view, options)).toThrow()
      expect(indicator(layer)).toBe(current)
    }
  })

  it.each(['dots', 'bars', 'ring'] as const)(
    'keeps %s visible with Reduce Motion and responds to changes',
    async (style) => {
      reduced = true
      const { view, layer } = target()
      const stop = start(view, { style })
      await Promise.resolve()
      const source = item(layer)
      expect(source.animations.size).toBe(0)
      expect(source.opacity).toBeGreaterThan(0)
      await reduceMotion(false)
      expect(item(layer)).toBe(source)
      expect(source.animations.size).toBe(1)
      await reduceMotion(true)
      expect(source.animations.size).toBe(0)
      expect(indicator(layer)).toBeDefined()
      stop()
      await reduceMotion(false)
      expect(indicator(layer)).toBeUndefined()
    },
  )

  it('is a no-op on Android without accessing iOS globals or subscribing', async () => {
    platform.isIOS = false
    vi.unstubAllGlobals()
    const { view, layer } = target()
    start(view)()
    await Promise.resolve()
    expect(layer.sublayers).toHaveLength(0)
    expect(view.listenerCount('loaded')).toBe(0)
    expect(Application.ios.observers.size).toBe(0)
  })
})
