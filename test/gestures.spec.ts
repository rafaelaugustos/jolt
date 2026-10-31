import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Application, ScrollView } from '@nativescript/core'
import { GestureSurface, gestures, type Gestures } from '../src/gestures/index.js'
import { motionScope } from '../src/index.js'
import { setLiveSpringDriver, type LiveNode } from '../src/live-spring-driver.js'
import type { GestureDriver } from '../src/gesture-native.js'
import './helpers.js'

const factory = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('../src/gesture-native.js', () => ({ createGestureDriver: factory.create }))
vi.mock('@nativescript/core', async (original) => {
  const core = await original<typeof import('./shims/core.js')>()
  return {
    ...core,
    GridLayout: class extends core.View {},
    ScrollView: class extends core.ScrollView {
      orientation = 'vertical'
    },
  }
})
let nodes: LiveNode[], controls: Gestures[], driver: GestureDriver
let emit: (state: number, x: number, y: number) => void
beforeEach(() => {
  nodes = []
  controls = []
  setLiveSpringDriver({
    create(initial) {
      let value = initial
      const node: LiveNode = {
        position: () => value,
        velocity: () => 0,
        moving: () => false,
        follow() {},
        update(input) {
          value = input.value
        },
        inputs() {},
        reduced() {},
        paused() {},
        bind: () => ({ value: () => value, layers() {}, cancel() {} }),
        dispose: vi.fn(),
      }
      nodes.push(node)
      return node
    },
    sync() {},
  })
  driver = {
    active: false,
    cancel: vi.fn(),
    enabled: vi.fn(),
    settle: vi.fn(),
    bounds: vi.fn(),
    dispose: vi.fn(),
  }
  factory.create
    .mockReset()
    .mockImplementation((_surface, _scroll, _values, _options, callback) => {
      emit = callback
      return driver
    })
})
afterEach(() => {
  controls.forEach((control) => control.dispose())
  nodes.forEach((node) => expect(node.dispose).toHaveBeenCalledOnce())
  expect(
    (
      Application as typeof Application & { listenerCount(name: string): number }
    ).listenerCount('suspend'),
  ).toBe(0)
  setLiveSpringDriver(undefined)
})
const create = (...args: Parameters<typeof gestures>) => {
  const control = gestures(...args)
  controls.push(control)
  return control
}
describe('native gesture ownership', () => {
  it('opts into first and last contact callbacks without treating a tap as a pan', () => {
    const start = vi.fn(),
      end = vi.fn(),
      pan = vi.fn()
    create(new GestureSurface(), {
      pan: true,
      onContactStart: start,
      onContactEnd: end,
      onStart: pan,
    })
    expect(factory.create.mock.calls.at(-1)![3].contactEvents).toBe(true)
    emit(6, 0, 0)
    emit(7, 0, 0)
    expect(start).toHaveBeenCalledOnce()
    expect(end).toHaveBeenCalledOnce()
    expect(pan).not.toHaveBeenCalled()
    expect(() => create(new GestureSurface(), { onContactEnd: true as never })).toThrow()
  })
  it('owns retained values, validates replacement before disposing the previous session, and releases listeners', () => {
    const surface = new GestureSurface()
    const first = create(surface, { pan: true })
    expect(nodes).toHaveLength(4)
    expect(() => create(surface, { pan: { axis: 'x', threshold: -1 } })).toThrow()
    expect(first.disposed).toBe(false)
    create(surface, { pinch: true })
    expect(first.disposed).toBe(true)
    expect(driver.dispose).toHaveBeenCalledOnce()
  })
  it('retains mapped outputs and forwards complete positions to native settling', () => {
    const control = create(new GestureSurface(), { initial: { x: 30, y: 80 }, pan: true })
    expect(control.x.to([0, 100], [0, 1]).get()).toBeCloseTo(0.3)
    control.settleTo({ y: 120 })
    expect(driver.settle).toHaveBeenLastCalledWith([30, 120, 1, 0], true)
    control.jumpTo({ scale: 2 })
    expect(driver.settle).toHaveBeenLastCalledWith([30, 80, 2, 0], false)
    expect(() => control.jumpTo({ x: NaN })).toThrow()
    control.updateBounds({ top: 0, bottom: 400 })
    expect(driver.bounds).toHaveBeenCalledWith(
      expect.objectContaining({ minY: 0, maxY: 400 }),
    )
    control.updateBounds({ bottom: 250 })
    expect(driver.bounds).toHaveBeenLastCalledWith(
      expect.objectContaining({ minY: 0, maxY: 250 }),
    )
    expect(() => control.updateBounds({ top: 300 })).toThrow(/ordered/)
    control.updateBounds({ bottom: 200 })
    expect(driver.bounds).toHaveBeenLastCalledWith(
      expect.objectContaining({ minY: 0, maxY: 200 }),
    )
  })
  it('allows only a descendant vertical ScrollView for handoff', () => {
    const surface = new GestureSurface(),
      scroll = new ScrollView()
    expect(() =>
      create(surface, {
        pan: { axis: 'y', bounds: { top: 0, bottom: 400 } },
        scrollView: scroll,
      }),
    ).toThrow(/inside/)
    Object.assign(scroll, { parent: surface })
    expect(() => create(surface, { pan: { axis: 'x' }, scrollView: scroll })).toThrow(
      /y-axis/,
    )
    create(surface, {
      pan: { axis: 'y', bounds: { top: 0, bottom: 400 } },
      scrollView: scroll,
    })
    expect(factory.create).toHaveBeenCalledWith(
      surface,
      scroll,
      expect.any(Array),
      expect.objectContaining({ axis: 2 }),
      expect.any(Function),
    )
  })
  it('cancels on scope suspension and preserves a manual pause across app resume', () => {
    const scope = motionScope()
    const control = scope.add(create(new GestureSurface(), { pan: true }))
    scope.suspend()
    expect(driver.enabled).toHaveBeenLastCalledWith(false)
    scope.resume()
    expect(driver.enabled).toHaveBeenLastCalledWith(true)
    control.pause()
    Application.notify({ eventName: Application.suspendEvent, object: Application })
    Application.notify({ eventName: Application.resumeEvent, object: Application })
    expect(driver.enabled).toHaveBeenLastCalledWith(false)
    scope.dispose()
    expect(control.disposed).toBe(true)
  })
  it('cleans retained values after a deferred native attach fails', () => {
    const surface = new GestureSurface() as GestureSurface & {
      load(): void
      unload(): void
    }
    surface.unload()
    const control = create(surface, { pan: true })
    expect(factory.create).not.toHaveBeenCalled()
    factory.create.mockImplementation(() => {
      throw new Error('native setup failure')
    })
    expect(() => surface.load()).toThrow('native setup failure')
    expect(control.disposed).toBe(true)
  })
  it('keeps disabled interaction disabled across play and app resume', () => {
    const surface = new GestureSurface()
    const control = create(surface, { pan: true })
    surface.isEnabled = false
    surface.notify({ eventName: 'isEnabledChange', object: surface })
    expect(driver.enabled).toHaveBeenLastCalledWith(false)
    control.play()
    Application.notify({ eventName: Application.resumeEvent, object: Application })
    expect(driver.enabled).toHaveBeenLastCalledWith(false)
    surface.isEnabled = true
    surface.notify({ eventName: 'isEnabledChange', object: surface })
    expect(driver.enabled).toHaveBeenLastCalledWith(true)
    surface.isUserInteractionEnabled = false
    surface.notify({ eventName: 'isUserInteractionEnabledChange', object: surface })
    expect(driver.enabled).toHaveBeenLastCalledWith(false)
  })
  it('survives disposal and application callback failures at native boundaries', () => {
    const surface = new GestureSurface()
    const control = create(surface, {
      pan: true,
      onStart: () => {
        throw new Error('consumer failure')
      },
      onEnd: () => control.dispose(),
    })
    expect(() => emit(1, 3, 4)).not.toThrow()
    emit(2, 3, 4)
    expect(control.disposed).toBe(true)
    control.dispose()
    expect(driver.dispose).toHaveBeenCalledOnce()
  })
})
