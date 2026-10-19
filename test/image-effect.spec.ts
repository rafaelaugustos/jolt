import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Image as CoreImage, ImageSource as CoreSource } from '@nativescript/core'
import { imageEffect, type ImageEffect } from '../src/image-effect.js'
import { Application, Image, ImageSource, View } from './shims/core.js'
import { driver, flush } from './helpers.js'
import type { ImageRenderer } from '../src/image-effect-native.js'

const factory = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('../src/image-effect-native.js', () => ({ createImageRenderer: factory.create }))
const handles: ImageEffect[] = []
let backend: ImageRenderer, complete: (finished: boolean, progress: number) => void
const source = () =>
  new ImageSource({ name: 'fixture', symbolImage: false }) as ImageSource & CoreSource
function image() {
  const view = new Image() as Image & CoreImage
  view.imageSource = source()
  return view
}
function start(...args: Parameters<typeof imageEffect>) {
  const h = imageEffect(...args)
  handles.push(h)
  return h
}
beforeEach(() => {
  vi.stubGlobal('UIAccessibilityReduceMotionStatusDidChangeNotification', 'reduce')
  backend = {
    backend: 'metal',
    progress: 0,
    frames: 4,
    textureBytes: 2048,
    longestFrameMs: 17,
    play: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    seek: vi.fn(),
    finish: vi.fn(),
    stop: vi.fn(),
  }
  factory.create.mockReset().mockImplementation((_image, _settings, ended) => {
    complete = ended
    return backend
  })
})
afterEach(() => {
  handles.splice(0).forEach((h) => h.stop())
  expect(Application.listenerCount('suspend')).toBe(0)
  expect(Application.listenerCount('resume')).toBe(0)
  expect(Application.ios.observers.size).toBe(0)
  vi.unstubAllGlobals()
})
describe('native image effects', () => {
  it('waits for an initially missing source without cancelling the pending effect', async () => {
    const target = image()
    target.imageSource = undefined as never
    const effect = start(target, 'ripple')
    await flush()
    expect(factory.create).not.toHaveBeenCalled()
    target.imageSource = source()
    target.notify({ eventName: 'imageSourceChange' })
    await flush()
    expect(factory.create).toHaveBeenCalledOnce()
    complete(true, 1)
    expect(await effect).toBe(true)
  })
  it('validates all arguments before taking ownership from a running renderer', async () => {
    const target = image()
    start(target, 'ripple')
    await flush()
    for (const opts of [
      { amplitude: -1 },
      { amplitude: NaN },
      { radius: 0 },
      { duration: Infinity },
      { seed: 0.5 },
      { origin: { x: NaN, y: 1 } },
    ])
      expect(() => imageEffect(target, 'ripple', opts)).toThrow()
    expect(() => imageEffect(target, 'dissolve')).toThrow(/loaded/)
    const unloaded = source()
    Object.defineProperty(unloaded, 'width', { value: NaN })
    expect(() => imageEffect(target, 'dissolve', { to: unloaded })).toThrow(/loaded/)
    expect(() => imageEffect(new View() as never, 'ripple')).toThrow(/Image/)
    expect(backend.stop).not.toHaveBeenCalled()
  })
  it('starts once after usable layout and keeps paused initialization at the requested frame', async () => {
    const target = image()
    target.actualSize = { width: 0, height: 0 }
    const effect = start(target, 'ripple', { paused: true, origin: { x: 30, y: 40 } })
    effect.progress = 0.25
    await flush()
    expect(factory.create).not.toHaveBeenCalled()
    target.actualSize = { width: 240, height: 160 }
    target.notify({ eventName: 'layoutChanged' })
    await flush()
    expect(factory.create).toHaveBeenCalledOnce()
    expect(factory.create.mock.calls[0]![1]).toMatchObject({ x: 30, y: 40, mode: 0 })
    expect(backend.seek).toHaveBeenCalledWith(0.25)
    expect(backend.play).not.toHaveBeenCalled()
    effect.play()
    expect(backend.play).toHaveBeenCalledWith(1)
    effect.reverse()
    expect(backend.play).toHaveBeenLastCalledWith(0)
  })
  it('only commits a dissolve destination on forward completion', async () => {
    const target = image(),
      original = target.imageSource,
      next = source()
    next.rotationAngle = 90
    const first = start(target, 'dissolve', { to: next })
    await flush()
    complete(true, 0)
    expect(await first).toBe(true)
    expect(target.imageSource).toBe(original)
    const second = start(target, 'dissolve', { to: next })
    await flush()
    complete(true, 1)
    expect(await second).toBe(true)
    expect(target.imageSource).not.toBe(next)
    expect(target.imageSource?.getNativeSource()).toBe(next.getNativeSource())
    expect(target.imageSource?.rotationAngle).toBe(90)
    target.imageSource!.ios = null
    expect(next.getNativeSource()).not.toBeNull()
    expect(second.diagnostics.textureBytes).toBe(0)
  })
  it('cancellation preserves app source replacement and settles exactly once', async () => {
    const target = image(),
      next = source(),
      replacement = source()
    const effect = start(target, 'dissolve', { to: next })
    await flush()
    target.imageSource = replacement
    target.notify({ eventName: 'imageSourceChange' })
    complete(true, 1)
    effect.finish()
    expect(await effect).toBe(false)
    expect(target.imageSource).toBe(replacement)
    expect(backend.stop).toHaveBeenCalledOnce()
    expect(backend.stop).toHaveBeenCalledWith(true)
  })
  it('replaces the native owner and makes stale commands harmless', async () => {
    const target = image(),
      first = start(target, 'ripple')
    await flush()
    const second = start(target, 'distortion')
    await flush()
    expect(await first).toBe(false)
    const calls = vi.mocked(backend.play).mock.calls.length
    first.play()
    first.reverse()
    first.finish()
    expect(backend.play).toHaveBeenCalledTimes(calls)
    expect(() => {
      second.progress = 0.5
    }).toThrow(/touch/)
    expect(() => second.reverse()).toThrow(/direction/)
  })
  it('suspends native work and preserves the user pause across foregrounding', async () => {
    const effect = start(image(), 'ripple')
    await flush()
    effect.pause()
    Application.notify({ eventName: 'suspend' })
    Application.notify({ eventName: 'resume' })
    expect(backend.play).toHaveBeenCalledTimes(1)
    effect.play()
    expect(backend.play).toHaveBeenCalledTimes(2)
  })
  it('defers a paused renderer until foregrounding without starting playback', async () => {
    start(image(), 'ripple', { paused: true })
    Application.notify({ eventName: 'suspend' })
    await flush()
    expect(factory.create).not.toHaveBeenCalled()
    Application.notify({ eventName: 'resume' })
    await flush()
    expect(factory.create).toHaveBeenCalledOnce()
    expect(backend.play).not.toHaveBeenCalled()
  })
  it('settles a supported content change under reduced motion without constructing a renderer', async () => {
    driver.reduced = true
    const target = image(),
      next = source(),
      effect = start(target, 'dissolve', { to: next })
    await flush()
    expect(await effect).toBe(true)
    expect(target.imageSource).not.toBe(next)
    expect(target.imageSource?.getNativeSource()).toBe(next.getNativeSource())
    expect(factory.create).not.toHaveBeenCalled()
    expect(effect.diagnostics).toMatchObject({
      backend: 'fallback',
      reason: 'reduced-motion',
    })
  })
  it('cleans up native rendering and observers on unload, including queued initialization', async () => {
    const target = image(),
      effect = start(target, 'ripple')
    await flush()
    target.notify({ eventName: 'unloaded' })
    expect(await effect).toBe(false)
    expect(target.listenerCount('layoutChanged')).toBe(0)
    const second = start(target, 'ripple')
    second.stop()
    await flush()
    expect(factory.create).toHaveBeenCalledOnce()
  })
  it('handles unsupported renderers and native preparation failures without hiding the image', async () => {
    factory.create.mockReturnValue(undefined)
    const target = image(),
      original = target.imageSource,
      effect = start(target, 'ripple')
    await flush()
    expect(await effect).toBe(false)
    expect(target.imageSource).toBe(original)
    expect(effect.diagnostics.backend).toBe('fallback')
  })
  it('stops a stale surface when padding or clipping changes and removes style observers', async () => {
    const target = image(),
      effect = start(target, 'ripple')
    await flush()
    target.style.notify({ eventName: 'borderTopLeftRadiusChange' })
    expect(await effect).toBe(false)
    expect(backend.stop).toHaveBeenCalledOnce()
    expect(target.style.listenerCount('borderTopLeftRadiusChange')).toBe(0)
    expect(target.style.listenerCount('paddingLeftChange')).toBe(0)
  })
  it('commits content after a native setup exception and retains diagnostics', async () => {
    factory.create.mockImplementation(() => {
      throw new Error('texture preparation failed')
    })
    const target = image(),
      next = source(),
      effect = start(target, 'dissolve', { to: next })
    expect(await effect).toBe(true)
    expect(target.imageSource).not.toBe(next)
    expect(target.imageSource?.getNativeSource()).toBe(next.getNativeSource())
    expect(effect.diagnostics).toMatchObject({
      backend: 'fallback',
      reason: 'unsupported',
      detail: 'Error: texture preparation failed',
    })
  })
})
