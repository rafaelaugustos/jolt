import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { animate } from '../src/index.js'
import { setDriver } from '../src/driver/index.js'
import { createIOSDriver } from '../src/driver/ios.js'
import { createView, flush, state } from './helpers.js'

interface Transaction {
  pending: number
  completion?: () => void
}

interface NativeAnimation {
  removedOnCompletion: boolean
}

let transaction: Transaction
let now: number

/** Models Core Animation's removal and transaction completion, not its rendering. */
class Layer {
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
    animationWithKeyPath: () => ({ removedOnCompletion: true }),
  })
  vi.stubGlobal('NSArray', { arrayWithArray: (values: unknown[]) => values })
  vi.stubGlobal('kCAFillModeBackwards', 'backwards')
  vi.stubGlobal('CATransaction', {
    begin: () => (transaction = { pending: 0 }),
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
