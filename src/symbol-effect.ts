import { Image, ImageSource, isIOS } from '@nativescript/core'
import { toView } from './animate.js'
import type { Animation } from './engine.js'
import type { Target } from './types.js'

export type SymbolEffectName = 'bounce' | 'pulse' | 'scale' | 'variableColor'

export type SymbolEffect = SymbolEffectName | { replace: `sys://${string}` }

export interface SymbolEffectOptions {
  /** Native playback speed multiplier. Defaults to 1. */
  speed?: number
  /** Repeat bounce, pulse or variableColor until stopped. Defaults to false. */
  repeat?: boolean
}

const running = new WeakMap<Image, SymbolAnimation>()
const names: readonly string[] = ['bounce', 'pulse', 'scale', 'variableColor']

/**
 * Plays an iOS 17+ SF Symbol effect on a NativeScript Image.
 * Scale holds until stopped; replacements also update the Image's src.
 *
 * ```ts
 * symbolEffect(icon, 'bounce')
 * symbolEffect(icon, { replace: 'sys://heart.fill' })
 * ```
 */
export function symbolEffect(
  target: Target,
  effect: SymbolEffect,
  options: SymbolEffectOptions = {},
): Animation {
  const view = toView(target)
  if (!(view instanceof Image)) throw new TypeError('symbolEffect expects an Image.')
  if (
    typeof effect === 'string'
      ? !names.includes(effect)
      : !effect ||
        typeof effect.replace !== 'string' ||
        !/^sys:\/\/[^\s/]+$/.test(effect.replace)
  ) {
    throw new TypeError('Expected a symbol effect name or { replace: "sys://name" }.')
  }
  const speed = options.speed ?? 1
  if (!Number.isFinite(speed) || speed <= 0)
    throw new RangeError('Symbol effect speed must be a positive finite number.')
  if (options.repeat !== undefined && typeof options.repeat !== 'boolean')
    throw new TypeError('Symbol effect repeat must be a boolean.')
  if (options.repeat && (typeof effect !== 'string' || effect === 'scale'))
    throw new TypeError('Only bounce, pulse and variableColor can repeat.')

  return new SymbolAnimation(view, effect, speed, options.repeat ?? false)
}

class SymbolAnimation implements Animation {
  readonly finished: Promise<boolean>
  private resolve!: (finished: boolean) => void
  private settled = false
  private started = false
  private changingSource = false
  private waitingForLoad: boolean
  private native: UIImageView | undefined
  private nativeEffect: NSSymbolEffect | undefined
  private replacement: UIImage | undefined

  constructor(
    private readonly view: Image,
    private readonly effect: SymbolEffect,
    private readonly speed: number,
    private readonly repeat: boolean,
  ) {
    this.finished = new Promise((resolve) => (this.resolve = resolve))
    this.waitingForLoad = !view.isLoaded
    running.get(view)?.stop()
    running.set(view, this)
    view.on('unloaded', this.stop)
    view.on('srcChange', this.sourceChanged)
    view.on('imageSourceChange', this.imageChanged)
    view.on('loaded', this.loaded)
    view.on('isLoadingChange', this.start)
    this.start()
  }

  then<A = boolean, B = never>(
    onfulfilled?: ((finished: boolean) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): Promise<A | B> {
    return this.finished.then(onfulfilled, onrejected)
  }

  stop = () => this.end(false, true)

  private sourceChanged = () => {
    if (!this.changingSource) this.stop()
  }

  private imageChanged = () => {
    if (this.changingSource) return
    if (this.started) this.stop()
    else this.start()
  }

  private loaded = () => {
    this.waitingForLoad = false
    this.start()
  }

  private start = () => {
    if (this.settled || this.started) return
    if (!isIOS) return this.end(false)
    const { view, effect } = this
    // isLoaded becomes true before NativeScript resumes native property updates.
    // Wait for the loaded event so intermediate image resets don't start playback.
    if (
      this.waitingForLoad ||
      !view.isLoaded ||
      !view.nativeViewProtected ||
      view.isLoading
    )
      return
    this.started = true
    const native = (this.native = view.nativeViewProtected as UIImageView)
    const reducedMotion = UIAccessibilityIsReduceMotionEnabled()

    if (typeof effect !== 'string') {
      // Resolve first so a symbol absent on this OS doesn't clear the current image.
      if (!ImageSource.fromSystemImageSync(effect.replace.slice(6))?.ios)
        return this.end(false)
      const previous = native.image
      const loadMode = view.loadMode
      this.changingSource = true
      try {
        // Let NativeScript update its source, tint, configuration and pending loads.
        // Both assignments happen in this turn, before UIKit draws the next frame.
        view.loadMode = 'sync'
        view.src = effect.replace
      } finally {
        view.loadMode = loadMode
        this.changingSource = false
      }
      // A source-change listener may have started another effect or changed the src.
      if (this.settled) return
      if (view.src !== effect.replace) return this.end(false)
      const image = native.image
      if (!image) return this.end(false)
      if (
        reducedMotion ||
        !previous?.symbolImage ||
        !native.respondsToSelector(
          'setSymbolImage:withContentTransition:options:completion:',
        )
      )
        return this.end(true)

      this.replacement = image
      native.image = previous
      native.setSymbolImageWithContentTransitionOptionsCompletion(
        image,
        NSSymbolReplaceContentTransition.transition(),
        this.options(),
        this.completed,
      )
      return
    }

    if (
      reducedMotion ||
      !native.image?.symbolImage ||
      !native.respondsToSelector('addSymbolEffect:options:animated:completion:')
    )
      return this.end(false)

    const factories = {
      bounce: NSSymbolBounceEffect,
      pulse: NSSymbolPulseEffect,
      scale: NSSymbolScaleEffect,
      variableColor: NSSymbolVariableColorEffect,
    }
    this.nativeEffect = factories[effect].effect()
    native.addSymbolEffectOptionsAnimatedCompletion(
      this.nativeEffect,
      this.options(),
      true,
      this.completed,
    )
  }

  private options(): NSSymbolEffectOptions {
    const options = this.repeat
      ? NSSymbolEffectOptions.optionsWithRepeating()
      : NSSymbolEffectOptions.optionsWithNonRepeating()
    return options.optionsWithSpeed(this.speed)
  }

  private completed = (context: UISymbolEffectCompletionContext) => {
    // Scale's entrance can complete while the effect is still holding its state.
    if (context.finished && (this.effect === 'scale' || this.repeat)) return
    this.end(context.finished)
  }

  private end(finished: boolean, remove = false) {
    if (this.settled) return
    this.settled = true
    const { view, native, nativeEffect, replacement } = this
    view.off('loaded', this.loaded)
    view.off('isLoadingChange', this.start)
    view.off('unloaded', this.stop)
    view.off('srcChange', this.sourceChanged)
    view.off('imageSourceChange', this.imageChanged)
    if (running.get(view) === this) running.delete(view)
    if (remove && native) {
      if (nativeEffect) native.removeSymbolEffectOfType(nativeEffect)
      // Content transitions have no removal API. Keep the destination icon.
      if (replacement && native.image === replacement) {
        native.image = null
        native.image = replacement
      }
    }
    this.native = undefined
    this.nativeEffect = undefined
    this.replacement = undefined
    this.resolve(finished)
  }
}
