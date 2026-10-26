import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const platform = vi.hoisted(() => ({ ios: true }))
vi.mock('@nativescript/core', async (original) => {
  const core = await original<typeof import('@nativescript/core')>()
  class Grid extends core.GridLayout {
    override createNativeView() {
      return { android: true }
    }
    override initNativeView() {}
    override disposeNativeView() {}
    override onLoaded() {}
    override onUnloaded() {}
    override onLayout() {}
    override _redrawNativeBackground() {
      this.nativeViewProtected.layer.cornerRadius = 0
      this.nativeViewProtected.clipsToBounds = false
    }
    override _addViewToNativeVisualTree() {
      return true
    }
    override _removeViewFromNativeVisualTree() {}
  }
  // The base ownership guard is separate from the layout's platform insertion.
  core.View.prototype._addViewToNativeVisualTree = vi.fn(() => true)
  core.View.prototype._removeViewFromNativeVisualTree = vi.fn()
  return {
    ...core,
    GridLayout: Grid,
    get isIOS() {
      return platform.ios
    },
  }
})
import { GlassView, GlassContainer, supportsLiquidGlass } from '../src/glass/index.js'

function native() {
  const children: any[] = []
  const contentView = {
    subviews: {
      get count() {
        return children.length
      },
    },
    layer: { insertSublayerBelow: vi.fn() },
    insertSubviewAtIndex: vi.fn((child, index) => {
      children.splice(index, 0, child)
      child.superview = contentView
    }),
  }
  return {
    effect: null as any,
    contentView,
    layer: { cornerRadius: 0 },
    bounds: { size: { width: 80, height: 60 } },
    cornerConfiguration: null as any,
    clipsToBounds: false,
  }
}
beforeEach(() => {
  platform.ios = true
  vi.stubGlobal('UIDevice', { currentDevice: { systemVersion: '26.2' } })
  vi.stubGlobal('UIVisualEffectView', {
    alloc: () => ({ initWithEffect: () => native() }),
  })
  vi.stubGlobal('UIGlassEffect', {
    effectWithStyle: (style: number) => ({ kind: 'glass', style }),
  })
  vi.stubGlobal('UIGlassContainerEffect', {
    new: () => ({ kind: 'container', spacing: 0 }),
  })
  vi.stubGlobal('UIBlurEffect', { effectWithStyle: () => ({ kind: 'blur' }) })
  vi.stubGlobal('UICornerRadius', { fixedRadius: (value: number) => value })
  vi.stubGlobal('UICornerConfiguration', {
    capsuleConfiguration: () => 'capsule',
    configurationWithUniformRadius: (r: number) => r,
  })
})
afterEach(() => vi.unstubAllGlobals())
function make<T extends GlassContainer | GlassView>(view: T): T {
  view.nativeViewProtected = view.createNativeView()
  view.initNativeView()
  return view
}
it('checks both OS availability and native metadata before touching iOS 26 classes', () => {
  expect(supportsLiquidGlass()).toBe(true)
  vi.stubGlobal('UIDevice', { currentDevice: { systemVersion: '18.6' } })
  expect(supportsLiquidGlass()).toBe(false)
  vi.stubGlobal('UIDevice', { currentDevice: { systemVersion: '26.2' } })
  vi.stubGlobal('UIGlassContainerEffect', undefined)
  expect(supportsLiquidGlass()).toBe(false)
})
it('creates native container and glass effects with capsule corners', () => {
  const group = make(new GlassContainer()),
    view = make(new GlassView())
  expect(group.glassBackend).toBe('liquid-glass')
  expect(view.glassBackend).toBe('liquid-glass')
  expect(group.nativeViewProtected.effect).toMatchObject({
    kind: 'container',
    spacing: 16,
  })
  expect(view.nativeViewProtected.effect).toMatchObject({
    kind: 'glass',
    style: 0,
    interactive: false,
  })
  expect(view.nativeViewProtected.cornerConfiguration).toBe('capsule')
})
it('validates settings before replacing live material, including declarative strings', () => {
  const group = make(new GlassContainer()),
    view = make(new GlassView())
  group.glassSpacing = '28'
  view.glassRadius = '18'
  view.glassInteractive = 'true'
  view.glassStyle = 'clear'
  expect(group.nativeViewProtected.effect.spacing).toBe(28)
  expect(view.nativeViewProtected.effect).toMatchObject({ style: 1, interactive: true })
  expect(view.nativeViewProtected.cornerConfiguration).toBe(18)
  const old = view.nativeViewProtected.effect
  expect(() => (view.glassRadius = -1)).toThrow()
  expect(() => (group.glassSpacing = Infinity)).toThrow()
  expect(() => (view.glassStyle = 'bad' as 'clear')).toThrow()
  expect(() => (view.glassFallback = 'bad' as 'none')).toThrow()
  expect(() => (view.glassInteractive = 'yes')).toThrow()
  expect(() => (view.glassTint = 'invalid')).toThrow()
  expect(view.nativeViewProtected.effect).toBe(old)
})
it('routes children and their outer shadows into contentView, preserving insertion order', () => {
  const group = make(new GlassContainer()),
    left = new GlassView(),
    right = new GlassView()
  const shadow = { removeFromSuperlayer: vi.fn() },
    child = { outerShadowContainerLayer: shadow, layer: {}, removeFromSuperview: vi.fn() }
  left.nativeViewProtected = child
  right.nativeViewProtected = { removeFromSuperview: vi.fn() }
  expect(group._addViewToNativeVisualTree(left, 0)).toBe(true)
  group._addViewToNativeVisualTree(right, 0)
  expect(
    group.nativeViewProtected.contentView.insertSubviewAtIndex,
  ).toHaveBeenNthCalledWith(2, right.nativeViewProtected, 0)
  expect(
    group.nativeViewProtected.contentView.layer.insertSublayerBelow,
  ).toHaveBeenCalledWith(shadow, child.layer)
  group._removeViewFromNativeVisualTree(left)
  expect(shadow.removeFromSuperlayer).toHaveBeenCalledOnce()
  expect(child.removeFromSuperview).toHaveBeenCalledOnce()
})
it('uses ordinary blur before iOS 26 and keeps capsule corners in sync with layout', () => {
  vi.stubGlobal('UIDevice', { currentDevice: { systemVersion: '18.6' } })
  const group = make(new GlassContainer()),
    view = make(new GlassView())
  expect(group.nativeViewProtected.effect).toBeNull()
  expect(view.glassBackend).toBe('blur')
  expect(view.nativeViewProtected.effect.kind).toBe('blur')
  expect(view.nativeViewProtected.layer.cornerRadius).toBe(30)
  view.nativeViewProtected.bounds.size.height = 40
  view.onLayout(0, 0, 80, 40)
  expect(view.nativeViewProtected.layer.cornerRadius).toBe(20)
  view._redrawNativeBackground(null)
  expect(view.nativeViewProtected.layer.cornerRadius).toBe(20)
  expect(view.nativeViewProtected.clipsToBounds).toBe(true)
  view.glassFallback = 'none'
  expect(view.nativeViewProtected.effect).toBeNull()
  expect(view.glassBackend).toBe('none')
})
it('removes effects on unload, defers detached changes and restores the latest settings on load', () => {
  const group = make(new GlassContainer()),
    view = make(new GlassView())
  group.onUnloaded()
  view.onUnloaded()
  expect(view.nativeViewProtected.effect).toBeNull()
  expect(group.nativeViewProtected.effect).toBeNull()
  view.glassStyle = 'clear'
  group.glassSpacing = 40
  expect(view.nativeViewProtected.effect).toBeNull()
  expect(group.nativeViewProtected.effect).toBeNull()
  group.onLoaded()
  view.onLoaded()
  expect(view.nativeViewProtected.effect.style).toBe(1)
  expect(group.nativeViewProtected.effect.spacing).toBe(40)
  view.disposeNativeView()
  group.disposeNativeView()
  expect(view.nativeViewProtected.effect).toBeNull()
  expect(group.nativeViewProtected.effect).toBeNull()
})
it('keeps Android views as ordinary layouts with content and no iOS API access', () => {
  platform.ios = false
  vi.stubGlobal('UIDevice', undefined)
  vi.stubGlobal('UIVisualEffectView', undefined)
  const group = make(new GlassContainer()),
    view = make(new GlassView())
  expect(supportsLiquidGlass()).toBe(false)
  expect(view.glassBackend).toBe('none')
  expect(view.nativeViewProtected).toEqual({ android: true })
  expect(group._addViewToNativeVisualTree(view, 0)).toBe(true)
  view.glassStyle = 'clear'
  view.glassRadius = 20
  view.onUnloaded()
  view.onLoaded()
  view.disposeNativeView()
  expect(view.nativeViewProtected).toEqual({ android: true })
})
