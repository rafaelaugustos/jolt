import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { colorMixer } from '../src/color.js'
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

describe('iOS decorations', () => {
  it('animates only root border geometry and freezes presentation values', async () => {
    const { view, layer, shadow } = target()
    const animation = animate(
      view,
      { borderRadius: [0, 40], borderWidth: [2, 8], x: [0, 80] },
      { duration: 1000 },
    )
    expect(layer.animations.has('jolt:borderRadius')).toBe(true)
    expect(shadow.animations.has('jolt:borderRadius')).toBe(false)
    Object.assign(layer, { cornerRadius: 17, borderWidth: 3.5 })
    stop(view, ['borderRadius', 'borderWidth'])
    expect(view.borderRadius).toBe(17)
    expect(view.borderWidth).toBe(3.5)
    expect(layer.animations.has('jolt:x')).toBe(true)
    layer.removeAutomaticAnimations()
    shadow.removeAutomaticAnimations()
    expect(await animation).toBe(false)
  })
  it('keeps the original timeline when Core refreshes decoration layers', async () => {
    const { view, layer } = target()
    const animation = animate(
      view,
      { borderRadius: [8, 40] },
      { delay: 200, duration: 1000 },
    )
    const previous = layer.animations.get('jolt:borderRadius')!.owner
    now += 400
    view.style.notify({ eventName: 'backgroundInternalChange', object: view.style })
    await flush()
    complete(previous)
    expect(state(animation.finished)()).toBeUndefined()
    expect(layer.animations.has('jolt:borderRadius')).toBe(true)
    view.notify({ eventName: 'unloaded', object: view })
    expect(await animation).toBe(false)
    expect(layer.animations.size).toBe(0)
    expect(view.listenerCount('layoutChanged')).toBe(0)
  })
  it('cancels an incompatible external restyle', async () => {
    const { view, layer } = target()
    const animation = animate(view, { borderWidth: 8 })
    view.style.notify({ eventName: 'borderTopWidthChange', object: view.style })
    await flush()
    expect(await animation).toBe(false)
    expect(layer.animations.size).toBe(0)
  })
})

describe('iOS shadow geometry', () => {
  function shadows() {
    const { view, layer } = target()
    const shadow = new Layer()
    const mask = new Layer()
    Object.assign(layer, { cornerRadius: 8 })
    Object.assign(shadow, {
      mask,
      shadowOpacity: 0.2,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 4 },
    })
    Object.assign(view.nativeViewProtected!, {
      bounds: { origin: { x: 0, y: 0 }, size: { width: 180, height: 120 } },
      outerShadowContainerLayer: {
        sublayers: { count: 1, firstObject: shadow, objectAtIndex: () => shadow },
      },
    })
    view.boxShadow = [
      {
        color: new Color('#33000000'),
        offsetX: 0,
        offsetY: 4,
        blurRadius: 8,
        inset: false,
      },
    ]
    vi.stubGlobal('CGSizeMake', (width: number, height: number) => ({ width, height }))
    vi.stubGlobal('CGRectInset', (rect: any, x: number, y: number) => ({
      origin: { x: rect.origin.x + x, y: rect.origin.y + y },
      size: { width: rect.size.width - x * 2, height: rect.size.height - y * 2 },
    }))
    vi.stubGlobal('CGPathCreateMutable', () => [])
    for (const name of [
      'CGPathMoveToPoint',
      'CGPathAddLineToPoint',
      'CGPathAddCurveToPoint',
      'CGPathAddPath',
      'CGPathAddRect',
      'CGPathCloseSubpath',
    ])
      vi.stubGlobal(name, (path: any[], ...args: unknown[]) => path.push([name, ...args]))
    return { view, layer, shadow, mask }
  }
  it('moves the shadow and its cutout with radius while keeping opacity on its own layer', async () => {
    const { view, layer, shadow, mask } = shadows()
    const animation = animate(
      view,
      {
        borderRadius: [0, 40],
        shadowOpacity: [0.2, 0],
        shadowOffsetX: -12,
        shadowOffsetY: 20,
      },
      { duration: 1000 },
    )
    expect(layer.animations.has('jolt:borderRadius')).toBe(true)
    expect(shadow.animations.has('jolt:borderRadius')).toBe(true)
    expect(mask.animations.has('jolt:borderRadius')).toBe(true)
    expect(layer.animations.has('jolt:shadowOpacity')).toBe(false)
    expect((shadow as any).shadowOpacity).toBe(0)
    expect((shadow as any).shadowOffset).toEqual({ width: -12, height: 20 })
    Object.assign(shadow, { shadowOffset: { width: -5, height: 11 } })
    stop(view, ['shadowOffsetX'])
    expect(view.boxShadow[0]!.offsetX).toBe(-5)
    expect(shadow.animations.has('jolt:shadowOffsetY')).toBe(true)
    animation.stop()
    expect(await animation).toBe(false)
    expect(mask.animations.size).toBe(0)
  })
  it('preserves a geometry animation through a uniform color change', async () => {
    const { view, layer } = shadows()
    const animation = animate(view, { borderRadius: 40 })
    view.borderColor = new Color('red')
    view.style.notify({ eventName: 'borderTopColorChange', object: view.style })
    await flush()
    expect(layer.animations.has('jolt:borderRadius')).toBe(true)
    animation.stop()
    expect(await animation).toBe(false)
  })
  it('keeps a zero shadow endpoint across a later Core redraw and releases the repair on color changes', async () => {
    const { view, shadow } = shadows()
    const draw = vi.fn(() => Object.assign(shadow, { shadowOpacity: 1 }))
    Object.assign(view, { _redrawNativeBackground: draw })
    const animation = animate(view, { shadowOpacity: 0 }, { duration: 100 })
    await flush()
    shadow.removeAutomaticAnimations()
    expect(await animation).toBe(true)
    ;(view as any)._redrawNativeBackground()
    expect(draw).toHaveBeenCalledOnce()
    await flush()
    expect((shadow as any).shadowOpacity).toBe(0)
    view.boxShadow[0]!.color = new Color('#80000000')
    view.style.notify({ eventName: 'boxShadowChange', object: view.style })
    await flush()
    expect(view.listenerCount('layoutChanged')).toBe(0)
    expect((view as any)._redrawNativeBackground).toBe(draw)
  })
  it('does not reapply an old endpoint while freezing shadow opacity', async () => {
    const { view, shadow } = shadows()
    let model = view.boxShadow
    Object.defineProperty(view, 'boxShadow', {
      get: () => model,
      set: (value) => {
        model = value
        Object.assign(shadow, { shadowOpacity: (value[0].color.argb >>> 24) / 255 })
      },
    })
    const animation = animate(view, { shadowOpacity: 0.8 }, { duration: 1000 })
    Object.assign(shadow, { shadowOpacity: 0.35 })
    stop(view, ['shadowOpacity'])
    expect((shadow as any).shadowOpacity).toBeCloseTo(0.35, 2)
    expect(await animation).toBe(false)
  })
  it('keeps capped corners and shadow paths on matching samples, including radius zero', async () => {
    const { view, layer, shadow } = shadows()
    const animation = animate(
      view,
      { borderRadius: [0, 120] },
      { duration: 1000, ease: 'linear' },
    )
    const corner = layer.animations.get('jolt:borderRadius')!.animation as any
    const path = shadow.animations.get('jolt:borderRadius')!.animation as any
    expect(corner.keyTimes).toHaveLength(61)
    expect(corner.values[0]).toBe(0)
    expect(corner.values[30]).toBe(60)
    expect(corner.values[60]).toBe(60)
    expect(path.values[30][0]).toEqual(['CGPathMoveToPoint', null, 60, 0])
    expect(path.values[0].map((command: any[]) => command[0])).toEqual(
      path.values[60].map((command: any[]) => command[0]),
    )
    animation.stop()
    expect(await animation).toBe(false)
  })
})

describe('iOS playback controls', () => {
  it('freezes and seeks CAAnimation clocks while preserving layer speed and another track', async () => {
    const { view, layer } = target()
    Object.assign(layer, { speed: 1 })
    const a = animate(view, { x: [0, 100] }, { duration: 1000 })
    const b = animate(view, { opacity: [1, 0] }, { duration: 2000 })
    const previous = layer.animations.get('jolt:x')!.owner
    now += 200
    a.pause()
    complete(previous)
    const held = layer.animations.get('jolt:x')!.animation as any
    expect(held.speed).toBe(0)
    expect(held.timeOffset).toBeCloseTo(0.2)
    expect(held.removedOnCompletion).toBe(false)
    expect((layer as any).speed).toBe(1)
    expect((layer.animations.get('jolt:opacity')!.animation as any).speed).toBe(1)
    a.progress = 0.4
    expect((layer.animations.get('jolt:x')!.animation as any).timeOffset).toBeCloseTo(0.4)
    now += 3000
    expect(a.progress).toBeCloseTo(0.4)
    a.play()
    const resumed = layer.animations.get('jolt:x')!.animation as any
    expect(resumed.speed).toBe(1)
    expect(resumed.timeOffset).toBe(0)
    expect(resumed.beginTime).toBeCloseTo(now / 1000 - 0.4)
    a.stop()
    b.stop()
    expect(await a).toBe(false)
  })
  it('keeps a paused endpoint retained and ignores stale completion callbacks', async () => {
    const { view, layer } = target()
    const animation = animate(view, { borderRadius: [0, 40] }, { duration: 1000 })
    const previous = layer.animations.get('jolt:borderRadius')!.owner
    animation.pause()
    animation.progress = 1
    complete(previous)
    layer.background()
    expect(state(animation.finished)()).toBeUndefined()
    expect(layer.animations.has('jolt:borderRadius')).toBe(true)
    animation.progress = 0.2
    animation.play()
    layer.removeAutomaticAnimations()
    expect(await animation).toBe(true)
  })
  it('takes over a scrubbed color before CA has committed its new presentation', async () => {
    const { view, layer } = target()
    view.backgroundColor = new Color('red')
    const first = animate(
      view,
      { backgroundColor: ['red', 'blue'] },
      { duration: 1000, ease: 'linear' },
    )
    first.pause()
    first.progress = 0.4
    layer.backgroundColor = 'red' // the previous presentation is still visible in this turn
    const second = animate(
      view,
      { backgroundColor: 'white' },
      { duration: 1000, ease: 'linear' },
    )
    const next = layer.animations.get('jolt:backgroundColor')!.animation as any
    expect(next.values[0]).toBe(
      colorMixer(new Color('red').argb, new Color('blue').argb)(0.4),
    )
    second.stop()
    expect(await first).toBe(false)
  })
})
