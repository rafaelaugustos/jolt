import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Image as CoreImage, ImageSource as CoreSource } from '@nativescript/core'
import { imageEffect, type ImageEffect } from '../src/image-effect.js'
import { Application, Image, ImageSource, View, ScrollView } from './shims/core.js'
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
    nativeParameterWrites: 0,
    renderCpuMs: 0,
    renderGpuMs: 0,
    videoFrames: 0,
    videoTime: 0,
    videoStatus: 'none',
    resizeCount: 0,
    peakTextureBytes: 2048,
    resize: vi.fn(),
    set: vi.fn(),
    bind: vi.fn(() => vi.fn()),
    bindScroll: vi.fn(() => vi.fn()),
    setVideo: vi.fn(),
    pauseVideo: vi.fn(),
    playVideo: vi.fn(),
    suspended: vi.fn(),
    progress: 0,
    frames: 4,
    textureBytes: 2048,
    longestFrameMs: 17,
    frameIntervalsMs: [16, 17],
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
  it('retains an explicitly paused renderer during the background root unload', async () => {
    const target = image(),
      effect = start(target, 'ripple')
    await flush()
    effect.pause()
    try {
      Application.suspended = true
      Application.notify({ eventName: 'suspend' })
      target.notify({ eventName: 'unloaded' })
      expect(backend.stop).not.toHaveBeenCalled()
    } finally {
      Application.suspended = false
    }
    Application.notify({ eventName: 'resume' })
    target.notify({ eventName: 'loaded' })
    effect.play()
    expect(factory.create).toHaveBeenCalledOnce()
    target.notify({ eventName: 'unloaded' })
    expect(await effect.finished).toBe(false)
    expect(backend.stop).toHaveBeenCalledOnce()
  })
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
  it('refreshes padding and clipping without replacing playback, then removes style observers on stop', async () => {
    const target = image(),
      effect = start(target, 'ripple')
    await flush()
    target.style.notify({ eventName: 'borderTopLeftRadiusChange' })
    await flush()
    expect(backend.resize).toHaveBeenCalledOnce()
    expect(backend.stop).not.toHaveBeenCalled()
    effect.stop()
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
  it('preserves a paused seek across repeated resize and accounts for native resource peaks', async () => {
    const target = image(),
      effect = start(target, 'ripple', { paused: true })
    await flush()
    effect.progress = 0.4
    for (let i = 0; i < 12; i++) {
      target.actualSize = { width: 180 + i * 2, height: 160 }
      target.notify({ eventName: 'layoutChanged' })
      await flush()
    }
    expect(backend.resize).toHaveBeenCalledTimes(12)
    expect(factory.create).toHaveBeenCalledOnce()
    expect(backend.play).not.toHaveBeenCalled()
    expect(backend.stop).not.toHaveBeenCalled()
    expect(effect.paused).toBe(true)
    effect.stop()
    expect(effect.diagnostics.textureBytes).toBe(0)
  })
  it('settles resize allocation failure without retaining a stale renderer', async () => {
    const target = image(),
      effect = start(target, 'ripple')
    await flush()
    vi.mocked(backend.resize).mockImplementation(() => {
      throw new Error('budget')
    })
    target.actualSize = { width: 9000, height: 9000 }
    target.notify({ eventName: 'layoutChanged' })
    await flush()
    expect(await effect).toBe(false)
    expect(effect.diagnostics.detail).toContain('budget')
    expect(effect.diagnostics.textureBytes).toBe(0)
  })
  it('validates and copies mask geometry before taking ownership', async () => {
    const target = image()
    start(target, 'ripple')
    await flush()
    expect(() => imageEffect(target, 'liquid-mask', { mask: { shapes: [] } })).toThrow(
      /1..8/,
    )
    const pose = { x: 0.5, y: 0.5, width: 0.3, height: 0.4, radius: 0.1 }
    const mask = {
      blend: 20,
      shapes: [
        { kind: 'rectangle' as const, from: { ...pose }, to: { ...pose, x: 0.7 } },
      ],
    }
    const effect = start(target, 'liquid-mask', { mask, paused: true })
    mask.shapes[0]!.from.x = 3
    await flush()
    expect(factory.create.mock.calls.at(-1)![1].mask.shapes[0].from.x).toBe(0.5)
    effect.progress = 0.4
    effect.finish()
    expect(backend.stop).toHaveBeenCalledTimes(1) // only the previous ripple
    effect.reverse()
    expect(backend.play).toHaveBeenLastCalledWith(0)
  })
  it('replaces native scroll ownership and makes stale disposers harmless', async () => {
    const scroll = new ScrollView(),
      target = image(),
      effect = start(target, 'ripple', { paused: true })
    await flush()
    const oldStop = vi.fn(),
      newStop = vi.fn()
    vi.mocked(backend.bindScroll)
      .mockReturnValueOnce(oldStop)
      .mockReturnValueOnce(newStop)
    const first = effect.bindScroll('progress', scroll as never, { range: [0, 200] })
    const second = effect.bindScroll('progress', scroll as never, { range: [200, 0] })
    expect(oldStop).toHaveBeenCalledOnce()
    first()
    expect(newStop).not.toHaveBeenCalled()
    effect.progress = 0.3
    expect(newStop).toHaveBeenCalledOnce()
    second()
    expect(newStop).toHaveBeenCalledOnce()
    expect(scroll.listenerCount('loaded')).toBe(0)
    expect(scroll.listenerCount('scroll')).toBe(0)
  })
  it('rejects invalid scroll mappings without interrupting a valid binding', async () => {
    const effect = start(image(), 'ripple', { paused: true }),
      scroll = new ScrollView()
    await flush()
    const stop = vi.fn()
    vi.mocked(backend.bindScroll).mockReturnValue(stop)
    effect.bindScroll('progress', scroll as never, { range: [0, 100] })
    expect(() =>
      effect.bindScroll('progress', scroll as never, { range: [0, 0] }),
    ).toThrow()
    expect(() =>
      effect.bindScroll('progress', scroll as never, { range: [0, 100], output: [0, 2] }),
    ).toThrow()
    expect(stop).not.toHaveBeenCalled()
    effect.stop()
    expect(stop).toHaveBeenCalledOnce()
  })
  it('suspends video and inputs independently of the explicit video pause', async () => {
    const effect = start(image(), 'ripple', {
      paused: true,
      video: { src: '/movie.mp4' },
    })
    await flush()
    effect.pauseVideo()
    Application.notify({ eventName: 'suspend' })
    Application.notify({ eventName: 'resume' })
    expect(backend.pauseVideo).toHaveBeenCalledOnce()
    expect(backend.playVideo).not.toHaveBeenCalled()
    expect(backend.suspended).toHaveBeenNthCalledWith(1, true)
    expect(backend.suspended).toHaveBeenNthCalledWith(2, false)
    effect.setVideo({ src: '/replacement.mp4', paused: true })
    expect(backend.setVideo).toHaveBeenCalledWith({
      src: '/replacement.mp4',
      paused: true,
    })
    expect(() => effect.setVideo({ src: 'https://example.com/a.mp4' })).toThrow(/local/)
  })
})
