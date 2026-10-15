import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Color } from '@nativescript/core'
import { animate, stop } from '../src/index.js'
import { setDriver } from '../src/driver/index.js'
import { createIOSDriver } from '../src/driver/ios.js'
import { createView, flush, state } from './helpers.js'

interface Transaction {
  pending: number
  completion?: () => void
}

interface NativeAnimation {
  removedOnCompletion: boolean
  preferredFrameRateRange?: { minimum: number; maximum: number; preferred: number }
}

let transaction: Transaction
let now: number

/** Models Core Animation's removal and transaction completion, not its rendering. */
class Layer {
  backgroundColor: unknown
  borderColor: unknown
  fillColor: unknown
  presentationLayer() {
    return this
  }
  convertTimeFromLayer(time: number) {
    return time
  }
  animations = new Map<string, { animation: NativeAnimation; owner: Transaction }>()

  addAnimationForKey(animation: NativeAnimation, key: string) {
    transaction.pending++
    this.animations.set(key, { animation: { ...animation }, owner: transaction })
  }

  removeAnimationForKey(key: string) {
    const entry = this.animations.get(key)
    if (!entry) return
    this.animations.delete(key)
    if (--entry.owner.pending === 0) complete(entry.owner)
  }

  removeAutomaticAnimations() {
    for (const [key, { animation }] of this.animations) {
      if (animation.removedOnCompletion) this.removeAnimationForKey(key)
    }
  }

  background() {
    const owners = new Set([...this.animations.values()].map((entry) => entry.owner))
    this.removeAutomaticAnimations()
    // On a device the transaction completes even when its animations are retained.
    for (const owner of owners) complete(owner)
  }
}

function complete(owner: Transaction) {
  const callback = owner.completion
  owner.completion = undefined
  callback?.()
}

beforeEach(() => {
  now = 1000
  vi.useFakeTimers()
  vi.stubGlobal('CACurrentMediaTime', () => now / 1000)
  vi.stubGlobal('CAKeyframeAnimation', {
    animationWithKeyPath: () => ({
      removedOnCompletion: true,
      respondsToSelector: () => true,
    }),
  })
  vi.stubGlobal('UIScreen', { mainScreen: { maximumFramesPerSecond: 60 } })
  vi.stubGlobal(
    'CAFrameRateRangeMake',
    (minimum: number, maximum: number, preferred: number) => ({
      minimum,
      maximum,
      preferred,
    }),
  )
  vi.stubGlobal('UIColor', { colorWithCGColor: (CGColor: unknown) => ({ CGColor }) })
  vi.stubGlobal('NSArray', { arrayWithArray: (values: unknown[]) => values })
  vi.stubGlobal('kCAFillModeBackwards', 'backwards')
  vi.stubGlobal('CATransaction', {
    begin: () => (transaction = { pending: 0 }),
    setDisableActions() {},
    setCompletionBlock: (callback: () => void) => (transaction.completion = callback),
    commit() {},
  })
  setDriver(createIOSDriver())
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function target() {
  const view = createView()
  const layer = new Layer()
  const shadow = new Layer()
  view.nativeViewProtected = { layer, outerShadowContainerLayer: shadow }
  const background = () => {
    layer.background()
    shadow.background()
  }
  return { view, layer, shadow, background }
}

describe('iOS refresh rate preference', () => {
  it('uses the view window screen and applies the hint to every track and shadow', async () => {
    const { view, layer, shadow } = target()
    Object.assign(view.nativeViewProtected!, {
      window: { screen: { maximumFramesPerSecond: 120 } },
    })
    const animation = animate(
      view,
      { x: [0, 100], opacity: [0, 1] },
      { delay: 100, repeat: Infinity },
    )

    for (const current of [layer, shadow]) {
      expect(current.animations.size).toBe(2)
      for (const entry of current.animations.values()) {
        expect(entry.animation.preferredFrameRateRange).toEqual({
          minimum: 80,
          maximum: 120,
          preferred: 120,
        })
      }
    }
    animation.stop()
    expect(await animation).toBe(false)
  })

  it('falls back to the main screen and keeps the range within a 60 Hz display', async () => {
    const { view, layer, shadow } = target()
    const animation = animate(view, 'fadeInUp')
    expect(layer.animations.get('jolt:y')?.animation.preferredFrameRateRange).toEqual({
      minimum: 60,
      maximum: 60,
      preferred: 60,
    })
    layer.removeAutomaticAnimations()
    shadow.removeAutomaticAnimations()
    expect(await animation).toBe(true)
  })

  it('does not access newer APIs when the animation lacks the iOS 15 selector', async () => {
    vi.stubGlobal('CAKeyframeAnimation', {
      animationWithKeyPath: () => ({
        removedOnCompletion: true,
        respondsToSelector: () => false,
      }),
    })
    vi.stubGlobal('CAFrameRateRangeMake', undefined)
    vi.stubGlobal('UIScreen', undefined)
    const { view, layer, shadow } = target()
    const animation = animate(view, 'fadeInUp')
    expect(
      layer.animations.get('jolt:y')?.animation.preferredFrameRateRange,
    ).toBeUndefined()
    layer.removeAutomaticAnimations()
    shadow.removeAutomaticAnimations()
    expect(await animation).toBe(true)
  })
})

describe('iOS background loops', () => {
  it.each(['loop', 'reverse'] as const)(
    'keeps a delayed %s pending through background cycles and can still stop it',
    async (repeatType) => {
      const { view, layer, shadow, background } = target()
      const animation = animate(
        view,
        { x: [0, 100] },
        { duration: 1000, delay: 500, ease: 'linear', repeat: Infinity, repeatType },
      )
      const done = state(animation.finished)

      // Background during the delay, then again once the loop is playing.
      background()
      now += 2250
      background()
      await flush()

      expect(done()).toBeUndefined()
      expect(layer.animations.size).toBe(1)
      expect(shadow.animations.size).toBe(1)

      animation.stop()

      expect(await animation).toBe(false)
      expect(view.translateX).toBe(repeatType === 'reverse' ? 25 : 75)
      expect(layer.animations.size).toBe(0)
      expect(shadow.animations.size).toBe(0)
    },
  )

  it('can replace a retained loop without its completion ending the replacement', async () => {
    const { view, layer, shadow, background } = target()
    const loop = animate(view, 'spin', { repeat: Infinity })
    background()
    now += 250

    const replacement = animate(view, { rotate: 0 }, { duration: 200 })
    const done = state(replacement.finished)
    await flush()

    expect(await loop).toBe(false)
    expect(done()).toBeUndefined()
    expect(layer.animations.size).toBe(1)
    expect(shadow.animations.size).toBe(1)

    now += 200
    layer.removeAutomaticAnimations()
    shadow.removeAutomaticAnimations()
    expect(await replacement).toBe(true)
  })

  it('still removes finite repeats and resolves them when they finish', async () => {
    const { view, layer, shadow } = target()
    const animation = animate(view, { x: [0, 100] }, { duration: 200, repeat: 1 })

    now += 400
    layer.removeAutomaticAnimations()
    shadow.removeAutomaticAnimations()

    expect(await animation).toBe(true)
    expect(view.translateX).toBe(100)
    expect(layer.animations.size).toBe(0)
    expect(shadow.animations.size).toBe(0)
  })
})

describe('iOS color layers', () => {
  it('animates the root background and shape border without tinting the shadow', async () => {
    const { view, layer, shadow } = target()
    const border = new Layer()
    Object.assign(view.nativeViewProtected!, { borderLayer: border })
    const animation = animate(
      view,
      { backgroundColor: ['red', 'blue'], borderColor: ['red', 'white'] },
      { duration: 1000 },
    )
    expect(layer.animations.has('jolt:backgroundColor')).toBe(true)
    expect(border.animations.has('jolt:borderColor')).toBe(true)
    expect(shadow.animations.size).toBe(0)
    expect(layer.backgroundColor).toBe(0xff0000ff)
    expect(border.fillColor).toBe(0xffffffff)
    layer.backgroundColor = 0xff123456
    stop(view, ['backgroundColor'])
    expect(view.backgroundColor?.argb).toBe(0xff123456)
    expect(border.animations.size).toBe(1)
    border.removeAutomaticAnimations()
    expect(await animation).toBe(false)
    expect(view.listenerCount('unloaded')).toBe(0)
    expect(view.style.listenerCount('backgroundColorChange')).toBe(0)
  })
  it('samples the track when a color is stopped before CA commits its first frame', async () => {
    const { view, layer } = target()
    Object.assign(layer, { presentationLayer: () => null })
    const animation = animate(
      view,
      { backgroundColor: ['red', 'blue'] },
      { duration: 1000, ease: 'linear' },
    )
    animation.stop()
    expect(view.backgroundColor?.argb).toBe(0xffff0000)
    expect(await animation).toBe(false)
  })

  it('follows a rebuilt border layer without settling or stopping sibling colors', async () => {
    const { view, layer } = target()
    const previous = new Layer()
    Object.assign(view.nativeViewProtected!, { borderLayer: previous })
    const animation = animate(
      view,
      { borderColor: ['red', 'blue'], backgroundColor: ['white', 'red'] },
      { duration: 1000 },
    )
    const done = state(animation.finished)
    const replacement = new Layer()
    Object.assign(view.nativeViewProtected!, { borderLayer: replacement })
    view.style.notify({ eventName: 'backgroundInternalChange' })
    await flush()
    expect(previous.animations.size).toBe(0)
    expect(replacement.animations.has('jolt:borderColor')).toBe(true)
    expect(layer.animations.has('jolt:backgroundColor')).toBe(true)
    expect(done()).toBeUndefined()
    layer.removeAutomaticAnimations()
    replacement.removeAutomaticAnimations()
    expect(await animation).toBe(true)
  })

  it('cancels an externally recolored edge and releases its listeners', async () => {
    const { view, layer } = target()
    const animation = animate(view, { borderColor: ['red', 'blue'] }, { duration: 1000 })
    view.borderTopColor = new Color('white')
    view.style.notify({ eventName: 'borderTopColorChange' })
    await flush()
    expect(await animation).toBe(false)
    expect(view.borderTopColor.argb).toBe(0xffffffff)
    expect(layer.animations.size).toBe(0)
    expect(view.style.listenerCount('borderTopColorChange')).toBe(0)
  })
  it('preserves image backgrounds by skipping the color layer', async () => {
    const { view, layer } = target()
    view.backgroundImage = 'image.png'
    const animation = animate(view, { backgroundColor: 'blue' })
    expect(await animation).toBe(false)
    expect(layer.animations.size).toBe(0)
    expect(view.backgroundColor?.argb).toBe(0xff0000ff)
    expect(view.listenerCount('unloaded')).toBe(0)
  })

  it('releases infinite colors on unload', async () => {
    const { view, layer } = target()
    const animation = animate(
      view,
      { backgroundColor: ['red', 'blue'] },
      { repeat: Infinity },
    )
    view.notify({ eventName: 'unloaded' })
    expect(await animation).toBe(false)
    expect(layer.animations.size).toBe(0)
    expect(view.listenerCount('unloaded')).toBe(0)
  })
})
