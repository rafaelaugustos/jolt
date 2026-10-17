import { stopIOSColorText } from './driver/ios-color.js'
import { Application, Label, Utils, isAndroid, isIOS } from '@nativescript/core'
import { textProperty, formattedTextProperty } from '@nativescript/core/ui/text-base'
import { toView } from './animate.js'
import type { Animation } from './engine.js'
import { completion, forgetCompletion, watchLabel } from './label.js'
import { textLayer } from './text-layout.js'
import type { Target } from './types.js'

export interface TextOptions {
  /** Composed letters (including emoji), or words. Defaults to 'letter'. */
  by?: 'letter' | 'word'
  /** Milliseconds per piece. Defaults to 400. */
  duration?: number
  /** Milliseconds between pieces. Defaults to 35. */
  stagger?: number
  /** Milliseconds before the first piece. Defaults to zero. */
  delay?: number
  /** Initial vertical offset in DIPs. Defaults to 12. */
  y?: number
}
type Options = Required<TextOptions>
const running = new WeakMap<Label, TextAnimation>()

/** Reveals the text of a Label without splitting its layout or accessibility element. */
export function animateText(target: Target, options: TextOptions = {}): Animation {
  const config: Options = {
    by: options.by ?? 'letter',
    duration: options.duration ?? 400,
    stagger: options.stagger ?? 35,
    delay: options.delay ?? 0,
    y: options.y ?? 12,
  }
  if (config.by !== 'letter' && config.by !== 'word')
    throw new TypeError('Text grouping must be letter or word.')
  for (const key of ['duration', 'stagger', 'delay'] as const) {
    if (!Number.isFinite(config[key]) || config[key] < 0)
      throw new RangeError(`Text ${key} must be a nonnegative finite number.`)
  }
  if (!Number.isFinite(config.y)) throw new RangeError('Text y must be finite.')
  const view = toView(target)
  if (!(view instanceof Label)) throw new TypeError('Expected a NativeScript Label.')
  running.get(view)?.stop()
  return new TextAnimation(view, config)
}

class TextAnimation implements Animation {
  readonly finished: Promise<boolean>
  private resolve!: (finished: boolean) => void
  private settled = false
  private queued = false
  private native: UILabel | android.widget.TextView | undefined
  private reveal: org.rafaelaugusto.jolt.TextReveal | undefined
  private unwatch: (() => void) | undefined
  private bounds: CGRect | undefined
  private layer: CALayer | undefined
  private originalText: string | null = null
  private originalAttributed: NSAttributedString | null = null
  private accessibility: string | null = null
  private temporaryAccessibility: string | undefined
  private delegate: NSObject | undefined
  private observer: ReturnType<typeof Application.ios.addNotificationObserver> | undefined

  constructor(
    private readonly view: Label,
    private readonly options: Options,
  ) {
    this.finished = new Promise((resolve) => {
      this.resolve = resolve
    })
    if (isIOS) stopIOSColorText(view)
    running.set(view, this)
    if (!isIOS && !isAndroid) {
      this.end(false)
      return
    }
    if (options.duration === 0 || reduceMotion()) {
      this.end(true)
      return
    }
    view.on('loaded', this.schedule)
    view.on('layoutChanged', this.layoutChanged)
    view.on('unloaded', this.stop)
    this.unwatch = watchLabel(view, this.changed)
    this.schedule()
  }

  then<A = boolean, B = never>(
    onfulfilled?: ((finished: boolean) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): Promise<A | B> {
    return this.finished.then(onfulfilled, onrejected)
  }
  /** Cancels the entrance and restores the full text. */
  stop = () => this.end(false)
  private changed = () => this.end(false, true)
  private motionChanged = () => {
    if (reduceMotion()) this.end(true)
  }
  private layoutChanged = () => {
    if (isAndroid) {
      if (!this.reveal) this.schedule()
      else if (this.view.nativeViewProtected !== this.native) this.stop()
      return
    }
    const native = this.view.nativeViewProtected as UILabel | undefined
    const a = this.bounds
    const b = native?.bounds
    if (
      this.layer &&
      (native !== this.native ||
        !native?.window ||
        !b ||
        !a ||
        a.origin.x !== b.origin.x ||
        a.origin.y !== b.origin.y ||
        a.size.width !== b.size.width ||
        a.size.height !== b.size.height)
    )
      return this.stop()
    this.schedule()
  }
  private schedule = () => {
    if (this.settled || this.queued) return
    this.queued = true
    void Promise.resolve().then(() => {
      this.queued = false
      if (this.settled || this.layer || this.reveal || !this.view.isLoaded) return
      try {
        this.start()
      } catch {
        this.end(false)
      }
    })
  }
  private start() {
    if (this.options.duration === 0 || reduceMotion()) return this.end(true)
    if (this.view.visibility !== 'visible') return this.end(false)
    if (isAndroid) return this.startAndroid()
    const native = this.view.nativeViewProtected as UILabel | undefined
    if (!(native instanceof UILabel) || !native.window) return
    if (native.bounds.size.width <= 0 || native.bounds.size.height <= 0) return
    const prepared = textLayer(native, this.options.by)
    if (!prepared) return this.end(false)
    if (!prepared.layer?.sublayers?.count) return this.end(true)
    if (
      !Number.isFinite(
        this.options.delay +
          this.options.duration +
          (prepared.layer.sublayers.count - 1) * this.options.stagger,
      )
    )
      return this.end(false)
    this.native = native
    this.bounds = native.bounds
    this.layer = prepared.layer
    this.originalText = native.text
    this.originalAttributed = native.attributedText
    this.accessibility = native.accessibilityLabel
    this.temporaryAccessibility = this.accessibility ?? prepared.text
    const { duration, delay, stagger, y } = this.options
    const start = CACurrentMediaTime()
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    try {
      native.text = ''
      native.accessibilityLabel = this.temporaryAccessibility
      native.layer.addSublayer(this.layer)
      const pieces = this.layer.sublayers!
      for (let i = 0; i < pieces.count; i++) {
        const piece = pieces.objectAtIndex(i)
        const fade = CABasicAnimation.animationWithKeyPath('opacity')
        fade.fromValue = 0
        fade.toValue = 1
        const move = CABasicAnimation.animationWithKeyPath('transform.translation.y')
        move.fromValue = y
        move.toValue = 0
        fade.duration = move.duration = duration / 1000
        const group = CAAnimationGroup.new()
        group.animations = NSArray.arrayWithArray([fade, move])
        group.duration = duration / 1000
        group.beginTime = start + (delay + i * stagger) / 1000
        group.fillMode = kCAFillModeBackwards
        group.timingFunction = CAMediaTimingFunction.functionWithName(
          kCAMediaTimingFunctionEaseOut,
        )
        if (i === pieces.count - 1)
          this.delegate = group.delegate = completion((finished) => this.end(finished))
        piece.addAnimationForKey(group, 'jolt:text')
      }
      this.observer = Application.ios.addNotificationObserver(
        UIAccessibilityReduceMotionStatusDidChangeNotification,
        this.motionChanged,
      )
    } finally {
      CATransaction.commit()
    }
  }
  private startAndroid() {
    const native = this.view.nativeViewProtected as android.widget.TextView | undefined
    if (!(native instanceof android.widget.TextView)) return this.end(false)
    const { by, duration, stagger, delay, y } = this.options
    let reveal: org.rafaelaugusto.jolt.TextReveal
    try {
      reveal = new org.rafaelaugusto.jolt.TextReveal(
        native,
        by === 'word',
        Math.round(duration),
        Math.round(stagger),
        Math.round(delay),
        y * Utils.layout.getDisplayDensity(),
        new org.rafaelaugusto.jolt.TextReveal.Callback({
          onEnd: (finished: boolean) => {
            if (this.reveal !== reveal) return
            this.reveal = undefined
            this.end(finished)
          },
        }),
      )
    } catch {
      // A JS-only update cannot install the native plugin. Keep the label as it is.
      return this.end(false)
    }
    if (!reveal.isSupported()) return this.end(false)
    this.native = native
    this.reveal = reveal
    reveal.start()
  }
  private end(finished: boolean, refresh = false) {
    if (this.settled) return
    this.settled = true
    const { view, layer } = this
    const native = this.native as UILabel | undefined
    const reveal = this.reveal
    this.reveal = undefined
    reveal?.cancel()
    view.off('loaded', this.schedule)
    view.off('layoutChanged', this.layoutChanged)
    view.off('unloaded', this.stop)
    this.unwatch?.()
    if (running.get(view) === this) running.delete(view)
    if (this.observer)
      Application.ios.removeNotificationObserver(
        this.observer,
        UIAccessibilityReduceMotionStatusDidChangeNotification,
      )
    if (this.delegate) forgetCompletion(this.delegate)
    if (native && layer) {
      CATransaction.begin()
      CATransaction.setDisableActions(true)
      try {
        // Restore only the native text we suppressed; app changes win.
        if (!native.text && !native.attributedText?.length) {
          if (refresh && view.nativeViewProtected === native) {
            const property = view.formattedText ? formattedTextProperty : textProperty
            ;(view as unknown as Record<symbol, (value: unknown) => void>)[
              property.setNative
            ]!(view.formattedText ?? view.text)
          } else if (this.originalAttributed)
            native.attributedText = this.originalAttributed
          else native.text = this.originalText
        }
        if (native.accessibilityLabel === this.temporaryAccessibility)
          native.accessibilityLabel = this.accessibility
        layer.removeFromSuperlayer()
        const pieces = layer.sublayers
        if (pieces)
          for (let i = 0; i < pieces.count; i++)
            pieces.objectAtIndex(i).removeAnimationForKey('jolt:text')
      } finally {
        CATransaction.commit()
      }
    }
    this.native = this.layer = this.delegate = this.observer = undefined
    this.originalAttributed = null
    this.resolve(finished)
  }
}

function reduceMotion() {
  if (isAndroid)
    return (
      android.os.Build.VERSION.SDK_INT >= 26 &&
      !android.animation.ValueAnimator.areAnimatorsEnabled()
    )
  return UIAccessibilityIsReduceMotionEnabled()
}
