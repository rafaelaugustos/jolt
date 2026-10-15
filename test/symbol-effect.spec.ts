import { Image, ImageSource } from '@nativescript/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { symbolEffect, type Animation, type SymbolEffect } from '../src/index.js'
import { createView } from './helpers.js'

const platform = vi.hoisted(() => ({ isIOS: true }))
vi.mock('@nativescript/core', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  get isIOS() {
    return platform.isIOS
  },
}))

type Completion = (context: { finished: boolean }) => void
class Options {
  speed = 1
  constructor(readonly repeat: boolean) {}
  optionsWithSpeed(speed: number) {
    this.speed = speed
    return this
  }
}

class NativeImage {
  image: unknown = null
  supportsEffects = true
  completion: Completion | undefined
  addSymbolEffectOptionsAnimatedCompletion = vi.fn(
    (_effect: unknown, _options: Options, _animated: boolean, done: Completion) => {
      this.completion = done
    },
  )
  removeSymbolEffectOfType = vi.fn(() => this.completion?.({ finished: false }))
  setSymbolImageWithContentTransitionOptionsCompletion = vi.fn(
    (image: unknown, _transition: unknown, _options: Options, done: Completion) => {
      this.image = image
      this.completion = done
    },
  )
  respondsToSelector() {
    return this.supportsEffects
  }
}

const animations: Animation[] = []
function play(...args: Parameters<typeof symbolEffect>) {
  const animation = symbolEffect(...args)
  animations.push(animation)
  return animation
}

function target(loaded = true) {
  const image = new Image()
  const native = new NativeImage()
  image.nativeViewProtected = native
  image.src = 'sys://heart'
  Object.assign(image, { isLoaded: loaded })
  return { image, native }
}

beforeEach(() => {
  platform.isIOS = true
  vi.stubGlobal('UIAccessibilityIsReduceMotionEnabled', () => false)
  for (const name of ['Bounce', 'Pulse', 'Scale', 'VariableColor']) {
    vi.stubGlobal(`NSSymbol${name}Effect`, { effect: () => ({ name }) })
  }
  vi.stubGlobal('NSSymbolReplaceContentTransition', {
    transition: () => ({ name: 'Replace' }),
  })
  vi.stubGlobal('NSSymbolEffectOptions', {
    optionsWithNonRepeating: () => new Options(false),
    optionsWithRepeating: () => new Options(true),
  })
})

afterEach(() => {
  for (const animation of animations.splice(0)) animation.stop()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('SF Symbol effects', () => {
  it.each(['bounce', 'pulse', 'variableColor'] as const)(
    'plays %s once and resolves from native completion',
    async (effect) => {
      const { image, native } = target()
      const animation = play({ nativeView: image }, effect, { speed: 1.5 })
      expect(native.addSymbolEffectOptionsAnimatedCompletion).toHaveBeenCalledWith(
        { name: effect[0]!.toUpperCase() + effect.slice(1) },
        expect.objectContaining({ speed: 1.5, repeat: false }),
        true,
        expect.any(Function),
      )
      native.completion!({ finished: true })
      expect(await animation).toBe(true)
      animation.stop()
      expect(native.removeSymbolEffectOfType).not.toHaveBeenCalled()
    },
  )

  it.each(['scale', 'pulse'] as const)(
    'keeps a held/repeating %s pending until stopped',
    async (effect) => {
      const { image, native } = target()
      const animation = play(image, effect, { repeat: effect === 'pulse' })
      const done = vi.fn()
      void animation.finished.then(done)
      native.completion!({ finished: true })
      await Promise.resolve()
      expect(done).not.toHaveBeenCalled()
      animation.stop()
      animation.stop()
      expect(await animation.finished).toBe(false)
      expect(native.removeSymbolEffectOfType).toHaveBeenCalledTimes(1)
    },
  )

  it('ignores stale completion and stop calls after another effect takes over', async () => {
    const { image, native } = target()
    const first = play(image, 'bounce')
    const oldCompletion = native.completion!
    const second = play({ nativeElement: image }, 'pulse')
    const done = vi.fn()
    void second.finished.then(done)
    expect(await first).toBe(false)
    oldCompletion({ finished: true })
    first.stop()
    await Promise.resolve()
    expect(done).not.toHaveBeenCalled()
    expect(native.removeSymbolEffectOfType).toHaveBeenCalledTimes(1)
    native.completion!({ finished: true })
    expect(await second).toBe(true)
  })

  it('waits for loading, then starts only once', async () => {
    const { image, native } = target(false)
    const animation = play(image, 'bounce')
    expect(native.addSymbolEffectOptionsAnimatedCompletion).not.toHaveBeenCalled()
    Object.assign(image, { isLoaded: true, isLoading: true })
    image.notify({ eventName: 'loaded', object: image })
    image.notify({ eventName: 'imageSourceChange', object: image })
    expect(native.addSymbolEffectOptionsAnimatedCompletion).not.toHaveBeenCalled()
    Object.assign(image, { isLoading: false })
    image.notify({ eventName: 'isLoadingChange', object: image })
    image.notify({ eventName: 'loaded', object: image })
    expect(native.addSymbolEffectOptionsAnimatedCompletion).toHaveBeenCalledTimes(1)
    native.completion!({ finished: true })
    expect(await animation).toBe(true)
  })

  it('cancels before loading and removes its listeners', async () => {
    const { image, native } = target(false)
    const animation = play(image, 'bounce')
    animation.stop()
    Object.assign(image, { isLoaded: true })
    image.notify({ eventName: 'loaded', object: image })
    expect(await animation).toBe(false)
    expect(native.addSymbolEffectOptionsAnimatedCompletion).not.toHaveBeenCalled()
    for (const event of [
      'loaded',
      'unloaded',
      'srcChange',
      'imageSourceChange',
      'isLoadingChange',
    ]) {
      expect(
        (image as unknown as { listenerCount(name: string): number }).listenerCount(
          event,
        ),
      ).toBe(0)
    }
  })

  it('waits for native property initialization to finish before playing', async () => {
    const { image, native } = target(false)
    const animation = play(image, 'bounce')
    const symbol = native.image
    // NativeScript marks isLoaded before applying src and iosSymbolScale.
    Object.assign(image, { isLoaded: true })
    native.image = null
    image.notify({ eventName: 'imageSourceChange', object: image })
    image.notify({ eventName: 'isLoadingChange', object: image })
    native.image = symbol
    image.notify({ eventName: 'imageSourceChange', object: image })
    expect(native.addSymbolEffectOptionsAnimatedCompletion).not.toHaveBeenCalled()
    image.notify({ eventName: 'loaded', object: image })
    expect(native.addSymbolEffectOptionsAnimatedCompletion).toHaveBeenCalledTimes(1)
    native.completion!({ finished: true })
    expect(await animation).toBe(true)
  })

  it.each(['unloaded', 'srcChange', 'imageSourceChange'])(
    'cancels and removes the native effect on %s',
    async (eventName) => {
      const { image, native } = target()
      const animation = play(image, 'pulse', { repeat: true })
      image.notify({ eventName, object: image })
      expect(await animation).toBe(false)
      expect(native.removeSymbolEffectOfType).toHaveBeenCalledTimes(1)
    },
  )

  it('reports native cancellation', async () => {
    const { image, native } = target()
    const animation = play(image, 'bounce')
    native.completion!({ finished: false })
    expect(await animation).toBe(false)
  })

  it('rejects invalid arguments before interrupting a running effect', async () => {
    const { image, native } = target()
    const animation = play(image, 'bounce')
    expect(() => play(createView(), 'bounce')).toThrow('Image')
    for (const invalid of [
      'unknown',
      null,
      { replace: 'heart' },
      { replace: 'sys://' },
    ]) {
      expect(() => play(image, invalid as SymbolEffect)).toThrow(TypeError)
    }
    for (const speed of [0, -1, NaN, Infinity]) {
      expect(() => play(image, 'bounce', { speed })).toThrow(RangeError)
    }
    expect(() => play(image, 'scale', { repeat: true })).toThrow(TypeError)
    expect(() => play(image, { replace: 'sys://heart.fill' }, { repeat: true })).toThrow(
      TypeError,
    )
    expect(native.removeSymbolEffectOfType).not.toHaveBeenCalled()
    native.completion!({ finished: true })
    expect(await animation).toBe(true)
  })
})

describe('SF Symbol replacement', () => {
  it('starts with the old native image and synchronizes src and imageSource', async () => {
    const { image, native } = target()
    const previous = native.image
    image.loadMode = 'async'
    native.setSymbolImageWithContentTransitionOptionsCompletion.mockImplementation(
      (next, _transition, _options, done) => {
        expect(native.image).toBe(previous)
        expect(image.src).toBe('sys://heart.fill')
        expect(image.imageSource.ios).toBe(next)
        native.image = next
        native.completion = done
      },
    )
    const animation = play(image, { replace: 'sys://heart.fill' })
    expect(image.loadMode).toBe('async')
    expect(
      native.setSymbolImageWithContentTransitionOptionsCompletion,
    ).toHaveBeenCalledTimes(1)
    native.completion!({ finished: true })
    expect(await animation).toBe(true)
    expect(image.src).toBe('sys://heart.fill')
    expect(native.image).toBe(image.imageSource.ios)
  })

  it('keeps the destination when stopped and does not restore it over a newer src', async () => {
    const { image, native } = target()
    const first = play(image, { replace: 'sys://heart.fill' })
    first.stop()
    expect(await first).toBe(false)
    expect(image.src).toBe('sys://heart.fill')
    expect(native.image).toBe(image.imageSource.ios)
    const second = play(image, { replace: 'sys://heart' })
    image.src = 'sys://star'
    expect(await second).toBe(false)
    expect(native.image).toBe(image.imageSource.ios)
    expect(image.src).toBe('sys://star')
  })

  it('leaves the original image when the requested symbol is unavailable', async () => {
    const { image, native } = target()
    const previous = native.image
    vi.spyOn(ImageSource, 'fromSystemImageSync').mockReturnValue(
      null as unknown as ImageSource,
    )
    expect(await play(image, { replace: 'sys://missing' })).toBe(false)
    expect(native.image).toBe(previous)
    expect(image.src).toBe('sys://heart')
  })

  it('does not overwrite a reentrant replacement from a source-change listener', async () => {
    const { image, native } = target()
    let second: Animation | undefined
    image.on('srcChange', () => {
      if (image.src === 'sys://heart.fill')
        second = play(image, { replace: 'sys://star' })
    })
    const first = play(image, { replace: 'sys://heart.fill' })
    expect(await first).toBe(false)
    expect(image.src).toBe('sys://star')
    native.completion!({ finished: true })
    expect(await second).toBe(true)
  })
})

describe('symbol effect fallbacks', () => {
  it('does not touch iOS globals or image sources on Android', async () => {
    platform.isIOS = false
    vi.unstubAllGlobals()
    const { image, native } = target(false)
    expect(await play(image, 'bounce')).toBe(false)
    expect(await play(image, { replace: 'sys://heart.fill' })).toBe(false)
    expect(image.src).toBe('sys://heart')
    expect(native.addSymbolEffectOptionsAnimatedCompletion).not.toHaveBeenCalled()
  })

  it('does not touch iOS 17 globals when the selectors are unavailable', async () => {
    const { image, native } = target()
    native.supportsEffects = false
    vi.unstubAllGlobals()
    vi.stubGlobal('UIAccessibilityIsReduceMotionEnabled', () => false)
    expect(await play(image, 'bounce')).toBe(false)
    expect(await play(image, { replace: 'sys://heart.fill' })).toBe(true)
    expect(image.src).toBe('sys://heart.fill')
    expect(
      native.setSymbolImageWithContentTransitionOptionsCompletion,
    ).not.toHaveBeenCalled()
  })

  it('skips decorative motion and replaces immediately with Reduce Motion', async () => {
    vi.stubGlobal('UIAccessibilityIsReduceMotionEnabled', () => true)
    const { image, native } = target()
    expect(await play(image, 'bounce')).toBe(false)
    expect(await play(image, { replace: 'sys://heart.fill' })).toBe(true)
    expect(native.addSymbolEffectOptionsAnimatedCompletion).not.toHaveBeenCalled()
    expect(
      native.setSymbolImageWithContentTransitionOptionsCompletion,
    ).not.toHaveBeenCalled()
    expect(image.src).toBe('sys://heart.fill')
  })

  it('skips a bitmap and can replace it with a symbol without a transition', async () => {
    const { image, native } = target()
    native.image = { symbolImage: false }
    expect(await play(image, 'bounce')).toBe(false)
    expect(await play(image, { replace: 'sys://heart.fill' })).toBe(true)
    expect(
      native.setSymbolImageWithContentTransitionOptionsCompletion,
    ).not.toHaveBeenCalled()
  })
})
