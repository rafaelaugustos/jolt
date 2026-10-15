import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { confetti, particles } from '../src/index.js'
import { createView, flush } from './helpers.js'
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
  frame = rect(0, 0, 0, 0)
  bounds = rect(0, 0, 200, 100)
  mask: object | null = null
  sublayers: Layer[] = []
  superlayer: Layer | undefined
  animations = new Map<string, any>()
  emitterCells: any[] = []
  emitterPosition = { x: 0, y: 0 }
  emitterSize = { width: 0, height: 0 }
  birthRate = 1
  beginTime = 0
  addSublayer(layer: Layer) {
    this.sublayers.push(layer)
    layer.superlayer = this
  }
  removeFromSuperlayer() {
    if (this.superlayer)
      this.superlayer.sublayers = this.superlayer.sublayers.filter((x) => x !== this)
    this.superlayer = undefined
  }
  addAnimationForKey(animation: any, key: string) {
    this.animations.set(key, animation)
  }
  removeAllAnimations() {
    this.animations.clear()
  }
  convertTimeFromLayer(time: number) {
    return time - 2
  }
}
const cleanups: (() => void)[] = []
let reduced: boolean
let created: Layer[]
function start(
  target: Parameters<typeof particles>[0],
  options?: Parameters<typeof particles>[1],
) {
  const stop = particles(target, options)
  cleanups.push(stop)
  return stop
}
function burst(
  target: Parameters<typeof confetti>[0],
  options?: Parameters<typeof confetti>[1],
) {
  const stop = confetti(target, options)
  cleanups.push(stop)
  return stop
}
function target(loaded = true) {
  const view = createView()
  const window = { layer: new Layer() }
  window.layer.bounds = rect(0, 0, 400, 800)
  const native = {
    layer: new Layer(),
    window: window as typeof window | null,
    convertPointToView: (point: { x: number; y: number }) => ({
      x: point.x + 40,
      y: point.y + 200,
    }),
  }
  view.nativeViewProtected = native
  Object.assign(view, { isLoaded: loaded })
  return { view, native, window }
}
async function layout(view: ReturnType<typeof createView>) {
  view.notify({ eventName: 'layoutChanged', object: view })
  await flush()
}
function reduceMotion(value: boolean) {
  reduced = value
  for (const callback of Application.ios.observers.keys()) callback()
}

beforeEach(() => {
  platform.isIOS = true
  reduced = false
  created = []
  vi.useFakeTimers()
  vi.stubGlobal('UIAccessibilityIsReduceMotionEnabled', () => reduced)
  vi.stubGlobal('UIAccessibilityReduceMotionStatusDidChangeNotification', 'reduce-motion')
  vi.stubGlobal('CATransaction', { begin() {}, commit() {}, setDisableActions() {} })
  vi.stubGlobal('CAEmitterLayer', {
    new() {
      const layer = new Layer()
      created.push(layer)
      return layer
    },
  })
  vi.stubGlobal('CAEmitterCell', { emitterCell: () => ({}) })
  vi.stubGlobal('CABasicAnimation', {
    animationWithKeyPath: (keyPath: string) => ({ keyPath }),
  })
  vi.stubGlobal('kCAEmitterLayerPoint', 'point')
  vi.stubGlobal('kCAEmitterLayerLine', 'line')
  vi.stubGlobal('CACurrentMediaTime', () => 12)
  vi.stubGlobal('NSArray', { arrayWithArray: (items: unknown[]) => items })
  vi.stubGlobal('CGPointMake', (x: number, y: number) => ({ x, y }))
  vi.stubGlobal('CGSizeMake', (width: number, height: number) => ({ width, height }))
  vi.stubGlobal('CGRectMake', rect)
  vi.stubGlobal('UIColor', { whiteColor: { CGColor: 'white' } })
  vi.stubGlobal('UIGraphicsImageRendererFormat', { defaultFormat: () => ({}) })
  vi.stubGlobal('UIGraphicsImageRenderer', {
    alloc: () => ({
      initWithSizeFormat: () => ({
        imageWithActions(callback: (context: any) => void) {
          callback({ CGContext: {} })
          return { CGImage: {} }
        },
      }),
    }),
  })
  for (const name of [
    'CGContextSetFillColorWithColor',
    'CGContextFillRect',
    'CGContextFillEllipseInRect',
    'CGContextSetStrokeColorWithColor',
    'CGContextSetLineWidth',
    'CGContextStrokeEllipseInRect',
  ])
    vi.stubGlobal(name, () => {})
})
afterEach(() => {
  for (const stop of cleanups.splice(0)) stop()
  expect(Application.ios.observers.size).toBe(0)
  expect(vi.getTimerCount()).toBe(0)
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('confetti', () => {
  it('emits into the target window without changing the target or its masks', async () => {
    const { view, native, window } = target()
    const mask = (native.layer.mask = {})
    view.opacity = 0.6
    view.translateX = 14
    const stop = burst(
      { nativeView: view },
      { count: 80, colors: ['#facc15', '#ef4444'] },
    )
    await flush()
    const layer = created[0]!
    expect(window.layer.sublayers).toEqual([layer])
    expect(native.layer.sublayers).toEqual([])
    expect(layer.emitterPosition).toEqual({ x: 140, y: 250 })
    expect(layer.beginTime).toBe(10)
    expect(layer.emitterCells.map((cell) => cell.color)).toEqual(['#facc15', '#ef4444'])
    const emission = layer.animations.get('jolt:emission')
    expect(layer.birthRate).toBe(0)
    expect(emission).toMatchObject({
      keyPath: 'birthRate',
      fromValue: 1,
      toValue: 1,
      duration: 0.2,
    })
    const totalRate = layer.emitterCells.reduce((sum, cell) => sum + cell.birthRate, 0)
    expect(totalRate * emission.duration).toBe(80)
    expect(native.layer.mask).toBe(mask)
    expect(view.opacity).toBe(0.6)
    expect(view.translateX).toBe(14)
    stop()
    stop()
    expect(window.layer.sublayers).toHaveLength(0)
    expect(layer.animations.size).toBe(0)
    expect(native.layer.mask).toBe(mask)
  })

  it('cleans up automatically after emission and the last particle lifetime', async () => {
    const { view, window } = target()
    burst(view)
    await flush()
    vi.advanceTimersByTime(2449)
    expect(window.layer.sublayers).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(window.layer.sublayers).toHaveLength(0)
    for (const event of ['loaded', 'layoutChanged', 'unloaded'])
      expect(view.listenerCount(event)).toBe(0)
  })

  it('keeps the burst at its captured position when the source moves', async () => {
    const { view, native } = target()
    burst(view)
    await flush()
    const layer = created[0]!
    native.convertPointToView = () => ({ x: 999, y: 999 })
    await layout(view)
    expect(layer.emitterPosition).toEqual({ x: 140, y: 250 })
    expect(created).toHaveLength(1)
  })

  it('replaces an earlier burst without letting its old cleanup stop the new one', async () => {
    const { view, window } = target()
    const old = burst(view)
    await flush()
    burst(view)
    await flush()
    old()
    expect(window.layer.sublayers).toEqual([created[1]])
    expect(created[0]!.animations.size).toBe(0)
  })
})

describe('particle emitters', () => {
  it('runs continuously in the target layer without frame callbacks or timers', async () => {
    const { view, native } = target()
    start(
      { nativeElement: view },
      {
        source: 'top',
        angle: 90,
        rate: 24,
        lifetime: 4000,
        velocity: 40,
        colors: ['white', 'blue'],
      },
    )
    await flush()
    const layer = created[0]!
    expect(native.layer.sublayers).toEqual([layer])
    expect(layer.emitterPosition).toEqual({ x: 100, y: 0 })
    expect(layer.emitterSize).toEqual({ width: 200, height: 0 })
    expect(layer.emitterCells[0]).toMatchObject({
      birthRate: 12,
      lifetime: 4,
      velocity: 40,
      emissionLongitude: Math.PI,
      alphaSpeed: -0.25,
    })
    expect(layer.animations.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('resizes the source without replacing the emitter or its particles', async () => {
    const { view, native } = target()
    start(view, {
      source: 'bottom',
      shape: 'ring',
      spin: 180,
      spinRange: 90,
      fadeOut: false,
    })
    await flush()
    const layer = created[0]!
    const cells = layer.emitterCells
    native.layer.bounds = rect(0, 0, 300, 180)
    await layout(view)
    expect(created).toHaveLength(1)
    expect(layer.emitterCells).toBe(cells)
    expect(layer.emitterPosition).toEqual({ x: 150, y: 180 })
    expect(layer.emitterSize.width).toBe(300)
    expect(cells[0]).toMatchObject({
      spin: Math.PI,
      spinRange: Math.PI / 2,
      alphaSpeed: 0,
    })
  })

  it('ends finite emission natively and uses a timer only for final cleanup', async () => {
    const { view, native } = target()
    start(view, { duration: 500, lifetime: 1000 })
    await flush()
    const layer = created[0]!
    expect(layer.animations.get('jolt:emission').duration).toBe(0.5)
    expect(layer.birthRate).toBe(0)
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(1550)
    expect(native.layer.sublayers).toHaveLength(0)
  })

  it('can coexist with confetti and unrelated layers', async () => {
    const { view, native, window } = target()
    const other = new Layer()
    native.layer.addSublayer(other)
    const stopParticles = start(view)
    burst(view)
    await flush()
    stopParticles()
    expect(native.layer.sublayers).toEqual([other])
    expect(window.layer.sublayers).toHaveLength(1)
  })
})

describe('particle lifecycle and validation', () => {
  it('waits for a loaded view, window and nonzero layout', async () => {
    const { view, native, window } = target(false)
    native.window = null
    native.layer.bounds = rect(0, 0, 0, 0)
    burst(view)
    await flush()
    expect(created).toHaveLength(0)
    expect(Application.ios.observers.size).toBe(0)
    Object.assign(view, { isLoaded: true })
    view.notify({ eventName: 'loaded', object: view })
    await flush()
    expect(created).toHaveLength(0)
    native.window = window
    await layout(view)
    expect(created).toHaveLength(0)
    native.layer.bounds = rect(0, 0, 100, 40)
    await layout(view)
    expect(created).toHaveLength(1)
  })

  it('can stop while waiting or with an update queued', async () => {
    const a = target(false)
    burst(a.view)()
    const b = target()
    start(b.view)()
    Object.assign(a.view, { isLoaded: true })
    await layout(a.view)
    await flush()
    expect(created).toHaveLength(0)
    expect(a.view.listenerCount('loaded')).toBe(0)
    expect(b.view.listenerCount('layoutChanged')).toBe(0)
  })

  it('cleans up on unload and does not replay on a later load', async () => {
    const { view, native, window } = target()
    start(view)
    burst(view)
    await flush()
    view.notify({ eventName: 'unloaded', object: view })
    expect(native.layer.sublayers).toHaveLength(0)
    expect(window.layer.sublayers).toHaveLength(0)
    expect(Application.ios.observers.size).toBe(0)
    view.notify({ eventName: 'loaded', object: view })
    await flush()
    expect(created).toHaveLength(2)
  })

  it('stops when the native view or window changes, disappears or loses its size', async () => {
    for (const situation of ['view', 'window', 'detach', 'size']) {
      const { view, native, window } = target()
      burst(view)
      await flush()
      if (situation === 'view') view.nativeViewProtected = { ...native }
      if (situation === 'window') native.window = { layer: new Layer() }
      if (situation === 'detach') native.window = null
      if (situation === 'size') native.layer.bounds = rect(0, 0, 0, 0)
      await layout(view)
      expect(window.layer.sublayers).toHaveLength(0)
    }
  })

  it('skips Reduce Motion and removes active effects when it is enabled', async () => {
    const { view, native, window } = target()
    reduced = true
    burst(view)
    start(view)
    await flush()
    expect(created).toHaveLength(0)
    expect(view.listenerCount('loaded')).toBe(0)
    reduced = false
    burst(view)
    start(view)
    await flush()
    reduceMotion(true)
    expect(native.layer.sublayers).toHaveLength(0)
    expect(window.layer.sublayers).toHaveLength(0)
    reduceMotion(false)
    await flush()
    expect(created).toHaveLength(2)
  })

  it('checks Reduce Motion again before a waiting effect starts', async () => {
    const { view } = target(false)
    start(view)
    reduced = true
    Object.assign(view, { isLoaded: true })
    view.notify({ eventName: 'loaded', object: view })
    await flush()
    expect(created).toHaveLength(0)
    expect(view.listenerCount('loaded')).toBe(0)
  })

  it('validates before replacing an existing effect', async () => {
    const { view, native, window } = target()
    start(view)
    burst(view)
    await flush()
    for (const options of [
      { rate: -1 },
      { rate: Infinity },
      { lifetime: NaN },
      { lifetime: 0 },
      { duration: 0 },
      { size: 0 },
      { size: 129 },
      { rate: 10000, lifetime: 2000 },
      { colors: [] },
      { colors: ['garbage'] },
      { colors: Array(2) },
      { shape: 'triangle' },
      { source: 'left' },
      { fadeOut: 'yes' },
      { spread: 361 },
    ])
      expect(() => start(view, options as never)).toThrow()
    for (const count of [-1, 0.5, Infinity, 10001])
      expect(() => burst(view, { count })).toThrow()
    expect(native.layer.sublayers).toHaveLength(1)
    expect(window.layer.sublayers).toHaveLength(1)
  })

  it('treats zero count and rate as silent cleanup', async () => {
    const { view, native, window } = target()
    burst(view)
    start(view)
    await flush()
    burst(view, { count: 0 })
    start(view, { rate: 0 })
    await flush()
    expect(native.layer.sublayers).toHaveLength(0)
    expect(window.layer.sublayers).toHaveLength(0)
    expect(created).toHaveLength(2)
  })

  it('does not use native APIs, timers or listeners on Android', async () => {
    platform.isIOS = false
    vi.unstubAllGlobals()
    const { view } = target()
    burst(view)()
    start(view)()
    await flush()
    expect(created).toHaveLength(0)
    expect(view.listenerCount('loaded')).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })
})
