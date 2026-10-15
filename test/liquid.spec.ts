import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Image as CoreImage } from '@nativescript/core'
import { liquid, type LiquidEffect } from '../src/liquid.js'
import { liquidGrid } from '../src/liquid-grid.js'
import { Application, Image, View } from './shims/core.js'

const platform = vi.hoisted(() => ({ isIOS: true }))
vi.mock('@nativescript/core', async (original) => ({
  ...(await original<object>()),
  get isIOS() {
    return platform.isIOS
  },
}))
const rect = (x: number, y: number, width: number, height: number) => ({
  origin: { x, y },
  size: { width, height },
})
class Raster {
  CGImage = {}
  images: { count: number } | null = null
  renderingMode = 0
  scale = 1
  size = { width: 200, height: 100 }
}
class Host {
  image: Raster | null = new Raster()
  bounds = rect(0, 0, 200, 200)
  window: object | null = {}
  children: Renderer[] = []
  addSubview(view: Renderer) {
    this.children.push(view)
    view.parent = this
  }
}
class Renderer {
  static alloc() {
    return new Renderer()
  }
  scene: Scene | null = null
  parent: Host | undefined
  paused = false
  frame = rect(0, 0, 0, 0)
  initWithFrame(frame: typeof this.frame) {
    this.frame = frame
    return this
  }
  presentScene(scene: Scene | null) {
    this.scene = scene
  }
  removeFromSuperview() {
    if (this.parent) this.parent.children = this.parent.children.filter((v) => v !== this)
    this.parent = undefined
  }
}
class Scene {
  children: Sprite[] = []
  size = { width: 0, height: 0 }
  addChild(node: Sprite) {
    this.children.push(node)
  }
}
class Sprite {
  size = { width: 0, height: 0 }
  position = { x: 0, y: 0 }
  warpGeometry: unknown
  texture: unknown
  actions = new Map<string, unknown>()
  runActionWithKey(action: unknown, key: string) {
    this.actions.set(key, action)
  }
  removeAllActions() {
    this.actions.clear()
  }
  removeFromParent() {}
}
let reduced = false
const effects: LiquidEffect[] = []
function start(...args: Parameters<typeof liquid>) {
  const effect = liquid(...args)
  effects.push(effect)
  return effect
}
function target() {
  const image = new Image() as Image & CoreImage
  Object.assign(image, { stretch: 'aspectFit' })
  const native = new Host()
  image.nativeViewProtected = native
  return { image, native, original: native.image }
}
async function event(image: Image, name = 'layoutChanged') {
  image.notify({ eventName: name, object: image })
  await Promise.resolve()
}
async function notify(name: string) {
  for (const [callback, notification] of Application.ios.observers)
    if (notification === name) callback()
  await Promise.resolve()
}
beforeEach(() => {
  vi.useFakeTimers()
  platform.isIOS = true
  reduced = false
  vi.stubGlobal('UIApplication', { sharedApplication: { applicationState: 0 } })
  vi.stubGlobal('UIApplicationWillResignActiveNotification', 'background')
  vi.stubGlobal('UIApplicationDidBecomeActiveNotification', 'foreground')
  vi.stubGlobal('UIAccessibilityReduceMotionStatusDidChangeNotification', 'reduce')
  vi.stubGlobal('UIAccessibilityIsReduceMotionEnabled', () => reduced)
  vi.stubGlobal('UIImageView', Host)
  vi.stubGlobal('SKView', Renderer)
  vi.stubGlobal('SKScene', {
    sceneWithSize: (size: Scene['size']) => Object.assign(new Scene(), { size }),
  })
  vi.stubGlobal('SKSpriteNode', {
    spriteNodeWithTexture: (texture: unknown) => Object.assign(new Sprite(), { texture }),
  })
  vi.stubGlobal('SKTexture', { textureWithImage: (image: Raster) => ({ image }) })
  vi.stubGlobal('SKWarpGeometryGrid', {
    gridWithColumnsRowsSourcePositionsDestPositions: (
      _c: number,
      _r: number,
      _src: unknown,
      dst: Float32Array,
    ) => ({ positions: dst.slice() }),
    gridWithColumnsRows: () => ({ identity: true }),
  })
  vi.stubGlobal('SKAction', {
    animateWithWarpsTimes: (warps: unknown[], times: number[]) => ({ warps, times }),
    warpToDuration: (warp: unknown, duration: number) => ({ warp, duration }),
    repeatActionForever: (action: unknown) => ({ repeat: action }),
    sequence: (actions: unknown[]) => ({ actions }),
  })
  vi.stubGlobal('UIColor', { clearColor: 'clear' })
  vi.stubGlobal('CGRectMake', rect)
  vi.stubGlobal('CGSizeMake', (width: number, height: number) => ({ width, height }))
  vi.stubGlobal('CGPointMake', (x: number, y: number) => ({ x, y }))
})
afterEach(() => {
  for (const effect of effects.splice(0)) effect.stop()
  expect(Application.ios.observers.size).toBe(0)
  expect(vi.getTimerCount()).toBe(0)
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
describe('liquid', () => {
  it('restores Core rendering when a tint takes over the suppressed image', async () => {
    const { image, native, original } = target()
    start(image)
    await Promise.resolve()
    Object.assign(image, { tintColor: { hex: '#ff0000' } })
    image.style.notify({ eventName: 'tintColorChange', object: image.style })
    await Promise.resolve()
    expect(native.children).toHaveLength(0)
    expect(native.image).toBe(original)
    expect(native.image!.renderingMode).toBe(2)
  })
  it('keeps an image visible when paused before its first render', async () => {
    const { image, native, original } = target()
    const effect = start(image)
    effect.pause()
    await Promise.resolve()
    expect(native.image).toBe(original)
    expect(native.children).toHaveLength(0)
    effect.resume()
    await Promise.resolve()
    expect(native.children).toHaveLength(1)
    effect.pause()
    reduced = true
    await notify('reduce')
    reduced = false
    await notify('reduce')
    expect(native.children).toHaveLength(0)
    expect(native.image).toBe(original)
  })
  it('owns one native loop and restores only its image, preserving view state', async () => {
    const { image, native, original } = target()
    image.opacity = 0.6
    image.translateX = 12
    const effect = start({ nativeView: image }, { intensity: 0.8, duration: 9000 })
    await Promise.resolve()
    expect(native.image).toBeNull()
    expect(native.children).toHaveLength(1)
    const renderer = native.children[0]!
    const sprite = renderer.scene!.children[0]!
    expect(sprite.size).toEqual({ width: 200, height: 100 })
    expect(renderer.paused).toBe(false)
    const action = sprite.actions.get('jolt:liquid') as any
    expect(action.actions[1].repeat.times.at(-1)).toBe(9)
    expect(action.actions[1].repeat.warps.at(0).positions).toEqual(
      action.actions[1].repeat.warps.at(-1).positions,
    )
    effect.stop()
    effect.stop()
    expect(native.image).toBe(original)
    expect(native.children).toHaveLength(0)
    expect(sprite.actions.size).toBe(0)
    expect(renderer.scene).toBeNull()
    expect(image.opacity).toBe(0.6)
    expect(image.translateX).toBe(12)
    for (const name of [
      'loaded',
      'layoutChanged',
      'imageSourceChange',
      'stretchChange',
      'unloaded',
    ])
      expect(image.listenerCount(name)).toBe(0)
  })
  it('pauses without replacing the scene and preserves user pause across backgrounding', async () => {
    const { image, native } = target()
    const effect = start(image)
    await Promise.resolve()
    const renderer = native.children[0]!
    const scene = renderer.scene
    effect.pause()
    expect(renderer.paused).toBe(true)
    await notify('background')
    await notify('foreground')
    expect(renderer.paused).toBe(true)
    effect.resume()
    await Promise.resolve()
    expect(renderer.paused).toBe(false)
    expect(renderer.scene).toBe(scene)
    await notify('background')
    expect(renderer.paused).toBe(true)
    await notify('foreground')
    expect(renderer.paused).toBe(false)
  })
  it('waits for load, a real image and usable geometry', async () => {
    const { image, native, original } = target()
    image.isLoaded = false
    native.image = null
    start(image)
    await Promise.resolve()
    expect(native.children).toHaveLength(0)
    image.isLoaded = true
    await event(image, 'loaded')
    expect(native.children).toHaveLength(0)
    native.image = original
    native.bounds = rect(0, 0, 0, 0)
    await event(image)
    expect(native.children).toHaveLength(0)
    native.bounds = rect(0, 0, 200, 200)
    await event(image)
    expect(native.children).toHaveLength(1)
    image.isLoaded = false
    await event(image, 'unloaded')
    expect(native.children).toHaveLength(0)
    expect(native.image).toBe(original)
    await event(image)
    expect(native.children).toHaveLength(0)
    image.isLoaded = true
    await event(image, 'loaded')
    expect(native.children).toHaveLength(1)
  })
  it.each([
    ['aspectFit', 200, 100],
    ['aspectFill', 400, 200],
    ['fill', 200, 200],
    ['none', 200, 100],
  ] as const)(
    'matches %s without restarting on layout',
    async (stretch, width, height) => {
      const { image, native } = target()
      Object.assign(image, { stretch })
      start(image)
      await Promise.resolve()
      const renderer = native.children[0]!
      const sprite = renderer.scene!.children[0]!
      expect(sprite.size).toEqual({ width, height })
      native.bounds = rect(0, 0, 300, 300)
      await event(image)
      expect(native.children[0]).toBe(renderer)
      expect(sprite.position).toEqual({ x: 150, y: 150 })
    },
  )
  it('restores the static image for Reduce Motion and hidden views', async () => {
    const { image, native, original } = target()
    reduced = true
    start(image)
    await Promise.resolve()
    expect(native.image).toBe(original)
    expect(native.children).toHaveLength(0)
    reduced = false
    await notify('reduce')
    expect(native.children).toHaveLength(1)
    reduced = true
    await notify('reduce')
    expect(native.children).toHaveLength(0)
    expect(native.image).toBe(original)
    reduced = false
    await notify('reduce')
    image.visibility = 'hidden'
    await Promise.resolve()
    expect(native.children).toHaveLength(0)
    image.visibility = 'visible'
    await Promise.resolve()
    expect(native.children).toHaveLength(1)
  })
  it('replaces an effect and ignores stale controls', async () => {
    const { image, native } = target()
    const first = start(image)
    await Promise.resolve()
    const old = native.children[0]!
    const second = start(image)
    await Promise.resolve()
    first.stop()
    first.resume()
    first.pause()
    await Promise.resolve()
    expect(native.children).toHaveLength(1)
    expect(native.children[0]).not.toBe(old)
    expect(old.scene).toBeNull()
    second.stop()
    await event(image)
    expect(native.children).toHaveLength(0)
  })
  it('does not resurrect an old source after replacement or clearing', async () => {
    const { image, native } = target()
    start(image)
    await Promise.resolve()
    const next = new Raster()
    native.image = next
    await event(image, 'imageSourceChange')
    expect(native.children[0]!.scene!.children[0]!.texture).toEqual({ image: next })
    Object.assign(image, { imageSource: { ios: null } })
    native.image = null
    await event(image, 'imageSourceChange')
    expect(native.children).toHaveLength(0)
    expect(native.image).toBeNull()
  })
  it('leaves animated, template, missing and oversized images unchanged', async () => {
    for (const source of [
      Object.assign(new Raster(), { images: { count: 3 } }),
      Object.assign(new Raster(), { renderingMode: 2 }),
      Object.assign(new Raster(), { CGImage: null }),
      Object.assign(new Raster(), { size: { width: 5000, height: 5000 } }),
    ]) {
      const { image, native } = target()
      native.image = source as Raster
      start(image)
      await Promise.resolve()
      expect(native.image).toBe(source)
      expect(native.children).toHaveLength(0)
    }
  })
  it('validates before replacing a running effect', async () => {
    const { image, native } = target()
    start(image)
    await Promise.resolve()
    const renderer = native.children[0]
    for (const options of [
      { intensity: -1 },
      { intensity: 1.01 },
      { intensity: NaN },
      { duration: 0 },
      { duration: -1 },
      { duration: Infinity },
    ]) {
      expect(() => start(image, options)).toThrow()
      expect(native.children[0]).toBe(renderer)
    }
    expect(() => start(new View() as never)).toThrow(/Image/)
  })
  it('does not start after cleanup of queued work or touch iOS on Android', async () => {
    const { image, native } = target()
    start(image).stop()
    await Promise.resolve()
    expect(native.children).toHaveLength(0)
    platform.isIOS = false
    vi.unstubAllGlobals()
    const effect = start(image)
    effect.pause()
    effect.resume()
    effect.stop()
    await Promise.resolve()
    expect(native.children).toHaveLength(0)
    expect(image.listenerCount('loaded')).toBe(0)
  })
})
describe('liquid displacement field', () => {
  it('preserves borders, stays in bounds and never folds at full intensity', () => {
    const n = 24
    for (let frame = 0; frame < 128; frame++) {
      const points = liquidGrid(n, n, frame / 128, 1)
      const point = (x: number, y: number) =>
        [points[(y * (n + 1) + x) * 2]!, points[(y * (n + 1) + x) * 2 + 1]!] as const
      const area = (a: readonly number[], b: readonly number[], c: readonly number[]) =>
        (b[0]! - a[0]!) * (c[1]! - a[1]!) - (b[1]! - a[1]!) * (c[0]! - a[0]!)
      for (let y = 0; y <= n; y++)
        for (let x = 0; x <= n; x++) {
          const p = point(x, y)
          expect(p[0]).toBeGreaterThanOrEqual(0)
          expect(p[0]).toBeLessThanOrEqual(1)
          expect(p[1]).toBeGreaterThanOrEqual(0)
          expect(p[1]).toBeLessThanOrEqual(1)
          if (x === 0 || x === n || y === 0 || y === n) {
            expect(p[0]).toBeCloseTo(x / n, 6)
            expect(p[1]).toBeCloseTo(y / n, 6)
          }
          if (x < n && y < n) {
            const right = point(x + 1, y),
              top = point(x, y + 1),
              diagonal = point(x + 1, y + 1)
            expect(area(p, right, top)).toBeGreaterThan(0)
            expect(area(right, diagonal, top)).toBeGreaterThan(0)
          }
        }
    }
  })
  it('has a seamless cycle, with motion inside the image and identity at zero intensity', () => {
    const zero = liquidGrid(12, 12, 0, 0),
      start = liquidGrid(12, 12, 0, 1),
      middle = liquidGrid(12, 12, 0.3, 1),
      end = liquidGrid(12, 12, 1, 1)
    expect(start).toEqual(end)
    expect(middle).not.toEqual(start)
    expect(start).not.toEqual(zero)
    for (let y = 0; y <= 12; y++)
      for (let x = 0; x <= 12; x++) {
        const i = (y * 13 + x) * 2
        expect(zero[i]).toBeCloseTo(x / 12, 6)
        expect(zero[i + 1]).toBeCloseTo(y / 12, 6)
      }
  })
})
