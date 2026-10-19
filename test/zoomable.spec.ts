import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Image as CoreImage } from '@nativescript/core'
import { zoomable, type Zoomable, type PhotoDismissal } from '../src/zoomable.js'
import { Application, Image, ImageSource, View } from './shims/core.js'
import { flush } from './helpers.js'
import type { ZoomDriver } from '../src/zoom-native.js'

const factory = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('../src/zoom-native.js', () => ({ createZoomDriver: factory.create }))
const controllers: Zoomable[] = []
let native: ZoomDriver,
  dismiss: (x: number, y: number, s: number, v: number, p: number) => void,
  settled: (x: number, y: number, s: number) => void
function target() {
  const parent = new View(),
    image = new Image() as Image & CoreImage
  image.parent = parent as never
  image.imageSource = new ImageSource({ name: 'grid', symbolImage: false }) as never
  return { image, parent }
}
function attach(...args: Parameters<typeof zoomable>) {
  const value = zoomable(...args)
  controllers.push(value)
  return value
}
beforeEach(() => {
  vi.stubGlobal('JoltPhotoZoom', {})
  vi.stubGlobal('UIAccessibilityReduceMotionStatusDidChangeNotification', 'reduce')
  native = {
    native: {} as never,
    state: { x: 0, y: 0, scale: 1, progress: 0, pending: false },
    zoom: vi.fn(),
    reset: vi.fn(),
    requestDismiss: vi.fn(),
    setReduced: vi.fn(),
    setActive: vi.fn(),
    layout: vi.fn(),
    stop: vi.fn(),
  }
  factory.create.mockReset().mockImplementation((_i, _v, _o, onDismiss, onSettled) => {
    dismiss = onDismiss
    settled = onSettled
    return native
  })
})
afterEach(() => {
  controllers.splice(0).forEach((c) => c.dispose())
  expect(Application.listenerCount('suspend')).toBe(0)
  expect(Application.ios.observers.size).toBe(0)
  vi.unstubAllGlobals()
})
describe('photo gesture ownership', () => {
  it('reports deferred native setup failure after releasing lifecycle listeners', async () => {
    const { image } = target(),
      error = new Error('native helper missing'),
      onError = vi.fn()
    factory.create.mockImplementation(() => {
      throw error
    })
    const controller = attach(image, { onError })
    await flush()
    expect(controller.ready).toBe(false)
    expect(controller.error).toBe(error)
    expect(onError).toHaveBeenCalledWith(error)
    expect(image.listenerCount('layoutChanged')).toBe(0)
  })
  it('defers setup while backgrounded and attaches on resume', async () => {
    const { image } = target()
    image.actualSize = { width: 0, height: 0 }
    attach(image)
    Application.notify({ eventName: 'suspend' })
    await flush()
    expect(factory.create).not.toHaveBeenCalled()
    image.actualSize = { width: 200, height: 200 }
    Application.notify({ eventName: 'resume' })
    await flush()
    expect(factory.create).toHaveBeenCalledOnce()
  })
  it('validates before replacing a running interaction', async () => {
    const { image } = target()
    attach(image)
    await flush()
    for (const options of [
      { scale: [0, 5] },
      { scale: [3, 2] },
      { scale: [1, NaN] },
      { doubleTap: Infinity },
    ])
      expect(() => zoomable(image, options as never)).toThrow()
    expect(() => zoomable(image, { viewport: new View() as never })).toThrow(/parent/)
    expect(native.stop).not.toHaveBeenCalled()
  })
  it('defaults to the actual parent and converts public controls into native commands', async () => {
    const { image, parent } = target(),
      controller = attach(image)
    await flush()
    expect(controller.ready).toBe(true)
    expect(factory.create.mock.calls[0]![1]).toBe(parent)
    controller.zoomTo(3)
    expect(native.zoom).toHaveBeenCalledWith(3, 100, 100, true)
    controller.zoomTo(2, { x: 30, y: 50 }, false)
    expect(native.zoom).toHaveBeenLastCalledWith(2, 30, 50, false)
    expect(() => controller.zoomTo(6)).toThrow(/range/)
  })
  it('keeps route mutation in the app and invalidates an obsolete dismissal intent', async () => {
    const { image } = target()
    let intent: PhotoDismissal | undefined
    const controller = attach(image, {
      dismiss: 'vertical',
      onDismiss: (value) => {
        intent = value
      },
    })
    await flush()
    dismiss(12, 80, 0.9, 900, 0.4)
    expect(intent!.state).toMatchObject({ pending: true, progress: 0.4 })
    controller.cancelDismiss()
    expect(intent!.complete()).toBe(false)
    expect(native.stop).not.toHaveBeenCalled()
    expect(native.reset).toHaveBeenCalledWith(true)
    dismiss(0, 100, 0.85, 1100, 0.6)
    expect(intent!.complete()).toBe(true)
    expect(intent!.complete()).toBe(false)
    expect(native.stop).toHaveBeenCalledOnce()
    expect(controller.ready).toBe(false)
  })
  it('cancels an unhandled dismissal instead of leaving a frozen standalone image', async () => {
    const { image } = target()
    attach(image, { dismiss: 'vertical' })
    await flush()
    dismiss(0, 100, 0.9, 900, 0.4)
    expect(native.reset).toHaveBeenCalledWith(true)
  })
  it('invalidates an old route intent after a native layout or preference reset', async () => {
    const { image } = target()
    let intent: PhotoDismissal | undefined
    attach(image, {
      dismiss: 'vertical',
      onDismiss: (value) => {
        intent = value
      },
    })
    await flush()
    dismiss(0, 100, 0.9, 900, 0.4)
    settled(0, 0, 1)
    intent!.complete()
    expect(native.stop).not.toHaveBeenCalled()
  })
  it('resets the native content mapping when the source changes', async () => {
    const { image } = target()
    attach(image)
    await flush()
    image.notify({ eventName: 'imageSourceChange' })
    await flush()
    expect(native.stop).toHaveBeenCalledOnce()
    expect(factory.create).toHaveBeenCalledTimes(2)
  })
  it('removes listeners, native gestures and queued work on unloading either owner', async () => {
    const { image, parent } = target(),
      controller = attach(image)
    await flush()
    parent.notify({ eventName: 'unloaded' })
    expect(native.stop).toHaveBeenCalledOnce()
    expect(image.listenerCount('imageSourceChange')).toBe(0)
    expect(parent.listenerCount('layoutChanged')).toBe(0)
    controller.dispose()
    controller.requestDismiss()
    expect(native.requestDismiss).not.toHaveBeenCalled()
    const queued = attach(image)
    queued.dispose()
    await flush()
    expect(factory.create).toHaveBeenCalledOnce()
  })
  it('invalidates pending route acknowledgements when the application suspends', async () => {
    const { image } = target()
    let intent: PhotoDismissal | undefined
    attach(image, {
      dismiss: 'vertical',
      onDismiss: (value) => {
        intent = value
      },
    })
    await flush()
    dismiss(0, 100, 0.9, 1000, 0.5)
    Application.notify({ eventName: 'suspend' })
    intent!.complete()
    expect(native.setActive).toHaveBeenCalledWith(false)
    expect(native.stop).not.toHaveBeenCalled()
    Application.notify({ eventName: 'resume' })
    expect(native.setActive).toHaveBeenLastCalledWith(true)
  })
})
