import { describe, expect, it, vi } from 'vitest'
import { sizeLayout } from '../src/size-layout.js'
import { StackLayout, View, unsetValue } from '@nativescript/core'

vi.mock('@nativescript/core', async (original) => {
  const core = await original<typeof import('./shims/core.js')>()
  return {
    ...core,
    unsetValue: Symbol.for('size-test-unset'),
    StackLayout: class extends core.View {},
    GridLayout: class extends core.View {},
    Utils: {
      layout: {
        toDeviceIndependentPixels: (n: number) => n,
        EXACTLY: 1,
        makeMeasureSpec: (size: number) => size,
      },
    },
  }
})

function fixture() {
  class PlainView extends View {}
  const view = new PlainView()
  const parent = new StackLayout()
  const local: Record<string, unknown> = { width: unsetValue, height: unsetValue }
  const css: Record<string, unknown> = { width: 240, height: 'auto' }
  const keyframe: Record<string, unknown> = { width: unsetValue, height: unsetValue }
  const proto = {}
  for (const axis of ['width', 'height']) {
    const computed = () =>
      keyframe[axis] !== unsetValue
        ? keyframe[axis]
        : local[axis] !== unsetValue
          ? local[axis]
          : css[axis]
    for (const [name, store, get] of [
      [axis, local, computed],
      [`css:${axis}`, css, () => css[axis]],
      [`keyframe:${axis}`, keyframe, () => keyframe[axis]],
    ] as const)
      Object.defineProperty(proto, name, {
        get,
        set(value) {
          store[axis] = value
        },
      })
    Object.defineProperty(view, axis, {
      get: computed,
      set(value) {
        style[axis] = value
      },
    })
  }
  const style = Object.create(proto) as Record<string, unknown>
  let measured = { width: 240, height: 150 }
  let actual = { width: 240, height: 150 }
  let layouts = 0
  const calls: unknown[] = []
  Object.assign(view, {
    parent,
    style,
    minWidth: 0,
    minHeight: 0,
    maxWidth: 'auto',
    maxHeight: 'auto',
    effectiveMinWidth: 0,
    effectiveMinHeight: 0,
    effectiveMaxWidth: Infinity,
    effectiveMaxHeight: Infinity,
    getActualSize: () => ({ ...actual }),
    getMeasuredWidth: () => measured.width,
    getMeasuredHeight: () => measured.height,
  })
  Object.assign(parent, {
    _currentWidthMeasureSpec: 300,
    _currentHeightMeasureSpec: 600,
    _getCurrentLayoutBounds: () => ({ left: 0, top: 0, right: 300, bottom: 600 }),
    measure(w: number, h: number) {
      calls.push([w, h])
      measured = {
        width: typeof view.width === 'number' ? Math.min(300, view.width) : 270,
        height: typeof view.height === 'number' ? view.height : 150,
      }
    },
    layout() {
      actual = { ...measured }
      layouts++
    },
  })
  return { view, parent, style, local, css, keyframe, calls, layouts: () => layouts }
}

describe('actual-size NativeScript layout boundary', () => {
  it('ignores uninitialized zero layout caches when native bounds are already valid', () => {
    const f = fixture()
    Object.assign(f.parent, { _oldLeft: 0, _oldTop: 0, _oldRight: 0, _oldBottom: 0 })
    const adapter = sizeLayout(f.view, ['height'])
    expect(adapter.ready()).toBe(true)
    adapter.write({ height: 75 })
    adapter.layout()
    expect(f.view.getActualSize().height).toBe(75)
    adapter.dispose()
  })
  it('uses the untransformed layout allocation of the root', () => {
    const f = fixture()
    Object.assign(f.parent, {
      _oldLeft: 10,
      _oldTop: 20,
      _oldRight: 310,
      _oldBottom: 620,
    })
    const layout = vi.fn()
    f.parent.layout = layout
    const adapter = sizeLayout(f.view, ['height'])
    adapter.write({ height: 75 })
    adapter.layout()
    expect(layout).toHaveBeenCalledWith(10, 20, 310, 620)
    adapter.dispose()
  })
  it('probes using the live root constraints without laying out or changing the local/CSS declaration', () => {
    const f = fixture()
    const adapter = sizeLayout(f.view, ['width', 'height'])
    adapter.write({ width: 200, height: 70 })
    expect(adapter.measure({ width: 'auto', height: 'auto' })).toEqual({
      width: 270,
      height: 150,
    })
    expect(f.calls).toEqual([[300, 600]])
    expect(f.layouts()).toBe(0)
    expect(f.view.width).toBe(200)
    expect(f.local.width).toBe(unsetValue)
    expect(f.css.width).toBe(240)
    adapter.layout()
    expect(f.view.getActualSize()).toEqual({ width: 200, height: 70 })
    adapter.dispose()
    expect(f.view.width).toBe(240)
    expect(f.view.height).toBe('auto')
  })
  it('detects a local write even when hidden by the keyframe overlay, and removes instance hooks', () => {
    const f = fixture()
    const adapter = sizeLayout(f.view, ['height'])
    const takeover = vi.fn(() => adapter.dispose())
    adapter.watch(takeover)
    adapter.write({ height: 50 })
    expect(takeover).not.toHaveBeenCalled()
    f.view.height = 90
    expect(takeover).toHaveBeenCalledOnce()
    expect(f.view.height).toBe(90)
    expect(Object.getOwnPropertyDescriptor(f.style, 'height')).toBeUndefined()
    expect(Object.getOwnPropertyDescriptor(f.style, 'keyframe:height')).toBeUndefined()
  })
  it('lets CSS take ownership and preserves new CSS after the temporary size clears', () => {
    const f = fixture()
    const adapter = sizeLayout(f.view, ['width'])
    adapter.watch(() => adapter.dispose())
    adapter.write({ width: 50 })
    f.style['css:width'] = 180
    expect(f.view.width).toBe(180)
    expect(f.local.width).toBe(unsetValue)
  })
  it('clamps overshoot and the final numeric declaration to min/max, retaining auto semantics', () => {
    const f = fixture()
    f.view.minHeight = 30
    f.view.maxHeight = 120
    const adapter = sizeLayout(f.view, ['height'])
    adapter.write({ height: 0 })
    adapter.layout()
    expect(f.view.getActualSize().height).toBe(30)
    adapter.write({ height: 200 })
    adapter.layout()
    expect(f.view.getActualSize().height).toBe(120)
    adapter.commit({ height: 0 })
    expect(f.view.height).toBe(30)
    adapter.commit({ height: 'auto' })
    expect(f.view.height).toBe('auto')
  })
  it('rejects unsupported parents, percent declarations and competing CSS keyframes before mutation', () => {
    const f = fixture()
    f.keyframe.height = 60
    expect(() => sizeLayout(f.view, ['height'])).toThrow('CSS keyframe')
    expect(f.keyframe.height).toBe(60)
    f.keyframe.height = unsetValue
    f.local.height = { unit: '%', value: 0.5 }
    expect(() => sizeLayout(f.view, ['height'])).toThrow('percentages')
    Object.assign(f.view, { parent: {} })
    expect(() => sizeLayout(f.view, ['width'])).toThrow('StackLayout or GridLayout')
  })
  it('never restores a speculative overlay after a measurement callback gives ownership to a new animation', () => {
    const f = fixture()
    const old = sizeLayout(f.view, ['height'])
    old.watch(() => old.dispose())
    old.write({ height: 50 })
    let next: ReturnType<typeof sizeLayout> | undefined
    f.parent.measure = () => {
      old.dispose()
      next = sizeLayout(f.view, ['height'])
      next.watch(() => {})
      next.write({ height: 90 })
    }
    old.measure({ height: 'auto' })
    old.dispose()
    expect(f.view.height).toBe(90)
    next!.dispose()
    expect(f.view.height).toBe('auto')
  })
})
