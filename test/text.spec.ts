import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { animateText, configure, sequence, type Animation } from '../src/index.js'
import { mergeGlyphRanges } from '../src/text-layout.js'
import { Application, Label, Observable, Utils } from './shims/core.js'
import { createView, driver, flush, state } from './helpers.js'
const platform = vi.hoisted(() => ({ isIOS: true }))
const layout = vi.hoisted(() => ({ supported: true, pieces: 3, call: vi.fn() }))
vi.mock('@nativescript/core', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  get isIOS() {
    return platform.isIOS
  },
  get isAndroid() {
    return !platform.isIOS
  },
}))
vi.mock('../src/text-layout.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  textLayer: (native: NativeLabel, by: string) => {
    layout.call(native, by)
    if (!layout.supported) return undefined
    const layer = new Layer()
    layer.name = 'jolt:text'
    for (let i = 0; i < layout.pieces; i++) layer.addSublayer(new Layer())
    return { text: native.text, layer }
  },
}))
const rect = (width = 200, height = 60) => ({
  origin: { x: 0, y: 0 },
  size: { width, height },
})
class Layer {
  name = ''
  children: Layer[] = []
  parent: Layer | undefined
  animations = new Map<string, any>()
  get sublayers() {
    const items = this.children
    return { count: items.length, objectAtIndex: (i: number) => items[i]! }
  }
  addSublayer(layer: Layer) {
    this.children.push(layer)
    layer.parent = this
  }
  removeFromSuperlayer() {
    if (this.parent)
      this.parent.children = this.parent.children.filter((layer) => layer !== this)
    this.parent = undefined
  }
  addAnimationForKey(animation: unknown, key: string) {
    this.animations.set(key, animation)
  }
  removeAnimationForKey(key: string) {
    const animation = this.animations.get(key)
    this.animations.delete(key)
    animation?.delegate?.animationDidStopFinished(animation, false)
  }
}
class NativeLabel {
  bounds = rect()
  window: object | null = {}
  layer = new Layer()
  accessibilityLabel: string | null = null
  private content = 'Olá 👩🏽‍💻'
  private attributed: { string: string; length: number } | null = null
  get text() {
    return this.content
  }
  set text(text: string) {
    this.content = text
    this.attributed = null
  }
  get attributedText() {
    return this.attributed
  }
  set attributedText(text: { string: string; length: number } | null) {
    this.attributed = text
    this.content = text?.string ?? ''
  }
}
const handles: Animation[] = []
function target() {
  const view = new Label()
  view.text = 'Olá 👩🏽‍💻'
  const native = new NativeLabel()
  view.nativeViewProtected = native
  return { view: view as unknown as import('@nativescript/core').Label, native }
}
function start(
  view: Parameters<typeof animateText>[0],
  options?: Parameters<typeof animateText>[1],
) {
  const handle = animateText(view, options)
  handles.push(handle)
  return handle
}
function complete(native: NativeLabel, finished = true) {
  const layer = native.layer.children[0]!
  const animation = layer.children.at(-1)!.animations.get('jolt:text')
  animation.delegate.animationDidStopFinished(animation, finished)
}
function event(view: { notify(data: any): void }, eventName: string) {
  view.notify({ eventName, object: view })
}
beforeEach(() => {
  platform.isIOS = true
  layout.supported = true
  layout.pieces = 3
  layout.call.mockClear()
  vi.useFakeTimers()
  vi.stubGlobal('UILabel', NativeLabel)
  vi.stubGlobal('UIAccessibilityReduceMotionStatusDidChangeNotification', 'reduce-motion')
  vi.stubGlobal('CATransaction', {
    begin: vi.fn(),
    commit: vi.fn(),
    setDisableActions: vi.fn(),
  })
  vi.stubGlobal('CABasicAnimation', {
    animationWithKeyPath: (keyPath: string) => ({ keyPath }),
  })
  vi.stubGlobal('CAAnimationGroup', { new: () => ({}) })
  vi.stubGlobal('NSArray', { arrayWithArray: (values: unknown[]) => values })
  vi.stubGlobal('CACurrentMediaTime', () => 100)
  vi.stubGlobal('kCAFillModeBackwards', 'backwards')
  vi.stubGlobal('kCAMediaTimingFunctionEaseOut', 'easeOut')
  vi.stubGlobal('CAMediaTimingFunction', { functionWithName: (name: string) => name })
  vi.stubGlobal('CAAnimationDelegate', {})
  vi.stubGlobal(
    'NSObject',
    class {
      static new() {
        return new this()
      }
      static extend(methods: object) {
        class Delegate extends this {}
        Object.assign(Delegate.prototype, methods)
        return Delegate
      }
    },
  )
})
afterEach(() => {
  handles.splice(0).forEach((handle) => handle.stop())
  expect(Application.ios.observers.size).toBe(0)
  expect(vi.getTimerCount()).toBe(0)
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('text entrance', () => {
  it('plays native staggered fades and translations while retaining one accessible label', async () => {
    const { view, native } = target()
    const handle = start(
      { nativeView: view },
      { by: 'word', duration: 600, stagger: 80, delay: 200, y: -8 },
    )
    const done = state(handle.finished)
    await flush()
    expect(layout.call).toHaveBeenCalledWith(native, 'word')
    expect(view.text).toBe('Olá 👩🏽‍💻')
    expect(native.text).toBe('')
    expect(native.accessibilityLabel).toBe('Olá 👩🏽‍💻')
    const pieces = native.layer.children[0]!.children
    expect(pieces).toHaveLength(3)
    pieces.forEach((piece, i) => {
      const group = piece.animations.get('jolt:text')
      expect(group.beginTime).toBeCloseTo(100.2 + i * 0.08)
      expect(group.duration).toBe(0.6)
      expect(group.fillMode).toBe('backwards')
      expect(group.animations).toEqual([
        { keyPath: 'opacity', fromValue: 0, toValue: 1, duration: 0.6 },
        { keyPath: 'transform.translation.y', fromValue: -8, toValue: 0, duration: 0.6 },
      ])
    })
    await vi.advanceTimersByTimeAsync(10000)
    expect(done()).toBeUndefined()
    complete(native)
    expect(await handle).toBe(true)
    expect(native.text).toBe(view.text)
    expect(native.accessibilityLabel).toBeNull()
    expect(native.layer.children).toHaveLength(0)
  })
  it('stretches its timing with the global time scale', async () => {
    configure({ timeScale: 0.5 })
    const { view, native } = target()
    const handle = start(view, { duration: 600, stagger: 80, delay: 200 })
    await flush()
    const pieces = native.layer.children[0]!.children
    pieces.forEach((piece, i) => {
      const group = piece.animations.get('jolt:text')
      expect(group.beginTime).toBeCloseTo(100.4 + i * 0.16)
      expect(group.duration).toBe(1.2)
      expect(group.animations[0].duration).toBe(1.2)
    })
    complete(native)
    expect(await handle).toBe(true)
  })
  it('restores attributed text and a custom accessibility label on stop', async () => {
    const { view, native } = target()
    const attributed = { string: 'Formatted', length: 9 }
    native.attributedText = attributed
    native.accessibilityLabel = 'Read this title'
    const handle = start(view)
    await flush()
    expect(native.accessibilityLabel).toBe('Read this title')
    handle.stop()
    expect(await handle).toBe(false)
    expect(native.attributedText).toBe(attributed)
    expect(native.accessibilityLabel).toBe('Read this title')
    expect(native.layer.children).toHaveLength(0)
  })
  it('restarts on replacement and ignores late native completion', async () => {
    const { view, native } = target()
    const first = start(view)
    await flush()
    const group = native.layer.children[0]!.children.at(-1)!.animations.get('jolt:text')
    const second = start(view, { by: 'word' })
    await flush()
    expect(await first).toBe(false)
    expect(native.layer.children).toHaveLength(1)
    group.delegate.animationDidStopFinished(group, true)
    expect(native.layer.children).toHaveLength(1)
    complete(native)
    expect(await second).toBe(true)
  })
  it('does not cancel a running entrance for invalid input', async () => {
    const { view, native } = target()
    const first = start(view)
    await flush()
    for (const options of [
      { duration: -1 },
      { stagger: NaN },
      { delay: Infinity },
      { y: NaN },
      { by: 'line' },
    ]) {
      expect(() => animateText(view, options as never)).toThrow()
    }
    expect(native.text).toBe('')
    complete(native)
    expect(await first).toBe(true)
    expect(() => animateText(createView())).toThrow('NativeScript Label')
  })
  it('waits for load and layout without replacing the label contents', async () => {
    const { view, native } = target()
    Object.assign(view, { isLoaded: false })
    const handle = start(view)
    await flush()
    expect(native.text).toBe(view.text)
    Object.assign(view, { isLoaded: true })
    native.bounds = rect(0, 0)
    event(view, 'loaded')
    await flush()
    expect(layout.call).not.toHaveBeenCalled()
    native.bounds = rect()
    event(view, 'layoutChanged')
    await flush()
    complete(native)
    expect(await handle).toBe(true)
  })
  it('cancels before queued preparation without allocating native layers', async () => {
    const { view, native } = target()
    const handle = start(view)
    handle.stop()
    await flush()
    expect(await handle).toBe(false)
    expect(layout.call).not.toHaveBeenCalled()
    expect(native.text).toBe(view.text)
  })
  it.each(['unloaded', 'resize', 'replacement'] as const)(
    'releases layers after %s',
    async (reason) => {
      const { view, native } = target()
      const handle = start(view)
      await flush()
      if (reason === 'resize') native.bounds = rect(250)
      if (reason === 'replacement') view.nativeViewProtected = new NativeLabel()
      event(view, reason === 'unloaded' ? 'unloaded' : 'layoutChanged')
      await flush()
      expect(await handle).toBe(false)
      expect(native.layer.children).toHaveLength(0)
      expect(native.text).toBe('Olá 👩🏽‍💻')
    },
  )
  it('keeps new app text and accessibility changes made during playback', async () => {
    const { view, native } = target()
    const handle = start(view)
    await flush()
    view.text = 'New title'
    native.text = 'New title'
    native.accessibilityLabel = 'New description'
    event(view, 'textChange')
    expect(await handle).toBe(false)
    expect(native.text).toBe('New title')
    expect(native.accessibilityLabel).toBe('New description')
  })
  it('refreshes suppressed native text through core after a style change', async () => {
    const { view, native } = target()
    const handle = start(view)
    await flush()
    event(view.style, 'fontInternalChange')
    expect(await handle).toBe(false)
    expect(native.text).toBe(view.text)
  })
  it('unsubscribes from the original formatted string when it is replaced', async () => {
    const { view, native } = target()
    const original = new Observable()
    view.formattedText = original as never
    const handle = start(view)
    await flush()
    const next = new Observable()
    view.formattedText = next as never
    native.text = 'Updated formatting'
    event(view, 'formattedTextChange')
    expect(await handle).toBe(false)
    expect(original.listenerCount('propertyChange')).toBe(0)
    expect(native.text).toBe('Updated formatting')
  })
  it('skips decorative playback for Reduce Motion and zero duration', async () => {
    const { view, native } = target()
    expect(await start(view, { duration: 0, delay: 1000 })).toBe(true)
    driver.reduced = true
    expect(await start(view)).toBe(true)
    expect(layout.call).not.toHaveBeenCalled()
    expect(native.text).toBe(view.text)
  })
  it('follows the configured reduced-motion preference', async () => {
    const { view, native } = target()
    configure({ reducedMotion: 'always' })
    expect(await start(view)).toBe(true)
    expect(layout.call).not.toHaveBeenCalled()
    configure({ reducedMotion: 'never' })
    driver.reduced = true
    const handle = start(view)
    await flush()
    expect(native.text).toBe('')
    for (const callback of [...Application.ios.observers.keys()]) callback()
    expect(native.text).toBe('')
    complete(native)
    expect(await handle).toBe(true)
  })
  it('restores text immediately when Reduce Motion is enabled during playback', async () => {
    const { view, native } = target()
    const handle = start(view)
    await flush()
    driver.reduced = true
    for (const callback of [...Application.ios.observers.keys()]) callback()
    expect(await handle).toBe(true)
    expect(native.text).toBe(view.text)
    expect(native.layer.children).toHaveLength(0)
  })
  it.each(['unsupported', 'hidden', 'error'] as const)(
    'leaves the original label for %s',
    async (reason) => {
      const { view, native } = target()
      if (reason === 'unsupported') layout.supported = false
      if (reason === 'hidden') view.visibility = 'hidden'
      if (reason === 'error')
        layout.call.mockImplementationOnce(() => {
          throw new Error('Snapshot failed')
        })
      const handle = start(view)
      await flush()
      expect(await handle).toBe(false)
      expect(native.text).toBe(view.text)
      expect(native.layer.children).toHaveLength(0)
    },
  )
  it('completes an empty label without playback', async () => {
    layout.pieces = 0
    const { view, native } = target()
    const handle = start(view)
    await flush()
    expect(await handle).toBe(true)
    expect(native.text).toBe(view.text)
  })
  it('can be awaited as a sequence step', async () => {
    const a = target(),
      b = target()
    const handle = sequence([() => start(a.view), () => start(b.view, { by: 'word' })])
    handles.push(handle)
    await flush()
    expect(b.native.text).toBe(b.view.text)
    complete(a.native)
    await flush()
    expect(b.native.text).toBe('')
    complete(b.native)
    expect(await handle).toBe(true)
  })
})
describe('Android text entrance', () => {
  const reveals: NativeReveal[] = []
  const animators = { enabled: true, sdk: 34 }
  const support = { value: true }
  class NativeTextView {}
  class NativeReveal {
    static Callback = class {
      constructor(readonly implementation: { onEnd(finished: boolean): void }) {}
    }
    readonly options: unknown[]
    readonly callback: { onEnd(finished: boolean): void }
    started = false
    cancelled = false
    constructor(...args: unknown[]) {
      this.options = args.slice(0, 6)
      this.callback = (
        args[6] as { implementation: { onEnd(finished: boolean): void } }
      ).implementation
      reveals.push(this)
    }
    isSupported() {
      return support.value
    }
    start() {
      this.started = true
    }
    cancel() {
      this.cancelled = true
      this.callback.onEnd(false)
    }
    finish() {
      this.callback.onEnd(true)
    }
  }
  function label() {
    const view = new Label()
    view.text = 'Olá 👩🏽‍💻'
    const native = new NativeTextView()
    view.nativeViewProtected = native
    return { view: view as Label & import('@nativescript/core').Label, native }
  }
  beforeEach(() => {
    platform.isIOS = false
    reveals.length = 0
    animators.enabled = true
    animators.sdk = 34
    support.value = true
    vi.stubGlobal('android', {
      widget: { TextView: NativeTextView },
      os: {
        Build: {
          VERSION: {
            get SDK_INT() {
              return animators.sdk
            },
          },
        },
      },
      animation: { ValueAnimator: { areAnimatorsEnabled: () => animators.enabled } },
    })
    vi.stubGlobal('org', { rafaelaugusto: { jolt: { TextReveal: NativeReveal } } })
  })
  afterEach(() => vi.restoreAllMocks())

  it('plays the native span reveal with options converted to pixels', async () => {
    vi.spyOn(Utils.layout, 'getDisplayDensity').mockReturnValue(2)
    const { view, native } = label()
    const handle = start(
      { nativeView: view },
      { by: 'word', duration: 600, stagger: 80, delay: 200, y: -8 },
    )
    const done = state(handle.finished)
    await flush()
    const [reveal] = reveals
    expect(reveal!.options).toEqual([native, true, 600, 80, 200, -16])
    expect(reveal!.started).toBe(true)
    expect(view.text).toBe('Olá 👩🏽‍💻')
    await vi.advanceTimersByTimeAsync(10000)
    expect(done()).toBeUndefined()
    reveal!.finish()
    expect(await handle).toBe(true)
    expect(reveal!.cancelled).toBe(false)
    expect(view.listenerCount('textChange')).toBe(0)
  })
  it('uses letters, rounded times and the display density by default', async () => {
    const { view, native } = label()
    start(view, { stagger: 35.4 })
    await flush()
    expect(reveals[0]!.options).toEqual([native, false, 400, 35, 0, 12])
  })
  it('cancels the native reveal on stop', async () => {
    const { view } = label()
    const handle = start(view)
    await flush()
    handle.stop()
    expect(reveals[0]!.cancelled).toBe(true)
    expect(await handle).toBe(false)
    expect(view.listenerCount('unloaded')).toBe(0)
  })
  it.each(['textChange', 'formattedTextChange', 'unloaded'] as const)(
    'cancels on %s',
    async (eventName) => {
      const { view } = label()
      const handle = start(view)
      await flush()
      event(view, eventName)
      expect(reveals[0]!.cancelled).toBe(true)
      expect(await handle).toBe(false)
    },
  )
  it('cancels after a style change and when the native view is replaced', async () => {
    const a = label()
    const first = start(a.view)
    await flush()
    event(a.view.style, 'fontInternalChange')
    expect(await first).toBe(false)
    const b = label()
    const second = start(b.view)
    await flush()
    b.view.nativeViewProtected = new NativeTextView()
    event(b.view, 'layoutChanged')
    expect(await second).toBe(false)
    expect(reveals.map((reveal) => reveal.cancelled)).toEqual([true, true])
  })
  it('keeps playing through layout changes of the same view', async () => {
    const { view } = label()
    const handle = start(view)
    await flush()
    event(view, 'layoutChanged')
    await flush()
    expect(reveals).toHaveLength(1)
    expect(reveals[0]!.cancelled).toBe(false)
    reveals[0]!.finish()
    expect(await handle).toBe(true)
  })
  it('waits for the label to load', async () => {
    const { view } = label()
    Object.assign(view, { isLoaded: false })
    const handle = start(view)
    await flush()
    expect(reveals).toHaveLength(0)
    Object.assign(view, { isLoaded: true })
    event(view, 'loaded')
    await flush()
    expect(reveals).toHaveLength(1)
    reveals[0]!.finish()
    expect(await handle).toBe(true)
  })
  it('replaces a running reveal and ignores its late completion', async () => {
    const { view } = label()
    const first = start(view)
    await flush()
    const second = start(view, { by: 'word' })
    await flush()
    expect(await first).toBe(false)
    expect(reveals[0]!.cancelled).toBe(true)
    expect(reveals[1]!.options[1]).toBe(true)
    const done = state(second.finished)
    reveals[0]!.finish()
    await flush()
    expect(done()).toBeUndefined()
    reveals[1]!.finish()
    expect(await second).toBe(true)
  })
  it('leaves the label alone when the native reveal is unsupported', async () => {
    support.value = false
    const { view } = label()
    expect(await start(view)).toBe(false)
    expect(reveals[0]!.started).toBe(false)
  })
  it('resolves false without the native class or a TextView', async () => {
    vi.stubGlobal('org', {})
    const { view } = label()
    expect(await start(view)).toBe(false)
    vi.stubGlobal('org', { rafaelaugusto: { jolt: { TextReveal: NativeReveal } } })
    const plain = label()
    plain.view.nativeViewProtected = {}
    expect(await start(plain.view)).toBe(false)
    expect(reveals).toHaveLength(0)
  })
  it('skips playback when the platform reduces motion', async () => {
    driver.reduced = true
    const { view } = label()
    expect(await start(view, { delay: 1000 })).toBe(true)
    expect(reveals).toHaveLength(0)
  })
  it('completes an empty label through the native callback', async () => {
    const { view } = label()
    view.text = ''
    const handle = start(view)
    await flush()
    reveals[0]!.finish()
    expect(await handle).toBe(true)
  })
})
describe('shaped glyph grouping', () => {
  it('copies native struct fields even when they are not enumerable', () => {
    const range = Object.defineProperties(
      {},
      { location: { value: 2 }, length: { value: 3 } },
    ) as NSRange
    expect(mergeGlyphRanges([range])).toEqual([{ location: 2, length: 3 }])
  })
  it('coalesces overlapping ligature ranges without merging neighboring letters', () => {
    expect(
      mergeGlyphRanges([
        { location: 0, length: 1 },
        { location: 1, length: 2 },
        { location: 1, length: 2 },
        { location: 2, length: 1 },
        { location: 3, length: 1 },
      ]),
    ).toEqual([
      { location: 0, length: 1 },
      { location: 1, length: 2 },
      { location: 3, length: 1 },
    ])
  })
  it('keeps disjoint glyph ranges and skips empty ranges', () => {
    expect(
      mergeGlyphRanges([
        { location: 5, length: 1 },
        { location: 0, length: 2 },
        { location: 2, length: 0 },
      ]),
    ).toEqual([
      { location: 5, length: 1 },
      { location: 0, length: 2 },
    ])
  })
})
