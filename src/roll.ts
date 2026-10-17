import { Application, Label, Utils, isAndroid, isIOS } from '@nativescript/core'
import { toView } from './animate.js'
import type { Animation } from './engine.js'
import { completion, forgetCompletion, watchLabel } from './label.js'
import { diffFromEnd, type Grapheme } from './roll-diff.js'
import { textLayer, type TextPiece } from './text-layout.js'
import { createTrack } from './track.js'
import { resolveTransition } from './transition.js'
import type { Target } from './types.js'

export interface RollOptions {
  /** Turns a number into the text to show. Defaults to `String`. */
  format?: (value: number) => string
  /** How long the spring feels, in milliseconds. Defaults to 600. */
  duration?: number
  /** Spring bounce, from -1 to 1. Defaults to 0.2. */
  bounce?: number
  /** Milliseconds between changed positions, counted from the right. Defaults to zero. */
  stagger?: number
  /** Milliseconds before the first position moves. Defaults to zero. */
  delay?: number
  /** `auto` rolls up to a higher number and down to a lower one. Defaults to `auto`. */
  direction?: 'auto' | 'up' | 'down'
  /** Tabular figures on the native label, so every digit takes the same width. Defaults to true. */
  tabular?: boolean
}

interface Options {
  duration: number
  bounce: number
  stagger: number
  delay: number
  direction: 1 | -1
  tabular: boolean
}

const running = new WeakMap<Label, RollAnimation>()
const lastValues = new WeakMap<Label, number>()
const MAX_POSITIONS = 256
const directions = ['auto', 'up', 'down']
const paintKeys = () => [
  NSForegroundColorAttributeName,
  NSStrokeColorAttributeName,
  NSUnderlineColorAttributeName,
  NSStrikethroughColorAttributeName,
  NSShadowAttributeName,
]
// CoreText layout features: kNumberSpacingType and kMonospacedNumbersSelector.
const NUMBER_SPACING = 6
const MONOSPACED_NUMBERS = 0

/**
 * Changes a Label's text and rolls the digits that differ, each one sliding
 * out while its replacement slides in. The label holds the final text from the
 * start; only the drawing moves.
 *
 * ```ts
 * rollTo(balance, 1249.9, { format: (n) => n.toFixed(2) })
 * ```
 */
export function rollTo(
  target: Target,
  value: number | string,
  options: RollOptions = {},
): Animation {
  const config = resolveOptions(options)
  const view = toView(target)
  if (!(view instanceof Label)) throw new TypeError('Expected a NativeScript Label.')
  const text = typeof value === 'string' ? value : (options.format ?? String)(value)
  if (typeof text !== 'string') throw new TypeError('Roll format must return a string.')
  running.get(view)?.stop()
  const previous = currentText(view)
  const direction = resolveDirection(options.direction, view, value, previous)
  if (typeof value === 'number') lastValues.set(view, value)
  else lastValues.delete(view)
  if (view.formattedText) view.formattedText = undefined as never
  view.text = text
  return new RollAnimation(view, previous, text, { ...config, direction })
}

function resolveOptions(options: RollOptions): Omit<Options, 'direction'> {
  const duration = options.duration ?? 600
  const bounce = options.bounce ?? 0.2
  const stagger = options.stagger ?? 0
  const delay = options.delay ?? 0
  if (!Number.isFinite(duration) || duration <= 0)
    throw new RangeError('Roll duration must be a positive finite number.')
  if (!Number.isFinite(bounce) || bounce < -1 || bounce > 1)
    throw new RangeError('Roll bounce must be between -1 and 1.')
  if (!Number.isFinite(stagger) || stagger < 0)
    throw new RangeError('Roll stagger must be a nonnegative finite number.')
  if (!Number.isFinite(delay) || delay < 0)
    throw new RangeError('Roll delay must be a nonnegative finite number.')
  if (options.direction !== undefined && !directions.includes(options.direction))
    throw new TypeError('Roll direction must be auto, up or down.')
  if (options.format !== undefined && typeof options.format !== 'function')
    throw new TypeError('Roll format must be a function.')
  return { duration, bounce, stagger, delay, tabular: options.tabular ?? true }
}

function resolveDirection(
  option: RollOptions['direction'],
  view: Label,
  value: number | string,
  previous: string,
): 1 | -1 {
  if (option === 'up') return 1
  if (option === 'down') return -1
  if (typeof value !== 'number') return 1
  const before = lastValues.get(view) ?? Number(previous)
  return Number.isFinite(before) && value < before ? -1 : 1
}

function currentText(view: Label): string {
  const native = view.nativeViewProtected as unknown
  if (isIOS && native instanceof UILabel)
    return native.attributedText?.string ?? native.text ?? ''
  if (isAndroid && native instanceof android.widget.TextView)
    return native.getText()?.toString() ?? ''
  return view.text ?? ''
}

function reduced() {
  if (isIOS) return UIAccessibilityIsReduceMotionEnabled()
  if (isAndroid)
    return (
      android.os.Build.VERSION.SDK_INT >= 26 &&
      !android.animation.ValueAnimator.areAnimatorsEnabled()
    )
  return false
}

function springTrack(shift: number, { duration, bounce }: Options) {
  return createTrack(
    'y',
    [shift, 0],
    resolveTransition({ type: 'spring', duration, bounce }, 'y', 2),
    0,
  )
}

function fadeTrack({ duration }: Options) {
  return createTrack(
    'opacity',
    [0, 1],
    resolveTransition(
      { type: 'tween', duration: duration / 2, ease: 'easeOut' },
      'opacity',
      2,
    ),
    0,
  )
}

function pieceAt(pieces: readonly TextPiece[], grapheme: Grapheme) {
  const index = pieces.findIndex(
    ({ location, length }) =>
      grapheme.start >= location && grapheme.start < location + length,
  )
  return index === -1 ? undefined : index
}

function layersOf(layer: CALayer | undefined): CALayer[] {
  const sublayers = layer?.sublayers
  if (!sublayers) return []
  const layers: CALayer[] = []
  for (let i = 0; i < sublayers.count; i++) layers.push(sublayers.objectAtIndex(i))
  return layers
}

function isClear(text: NSAttributedString) {
  if (!text.length) return true
  const color = text.attributeAtIndexEffectiveRange(
    NSForegroundColorAttributeName,
    0,
    null,
  ) as UIColor | null
  return !color || color.isEqual(UIColor.clearColor)
}

function tabularFont(font: UIFont): UIFont {
  const feature = NSDictionary.dictionaryWithObjectsForKeys(
    [NUMBER_SPACING, MONOSPACED_NUMBERS],
    [UIFontFeatureTypeIdentifierKey, UIFontFeatureSelectorIdentifierKey],
  )
  const descriptor = font.fontDescriptor.fontDescriptorByAddingAttributes(
    NSDictionary.dictionaryWithObjectForKey(
      [feature],
      UIFontDescriptorFeatureSettingsAttribute,
    ),
  )
  return UIFont.fontWithDescriptorSize(descriptor, font.pointSize)
}

class RollAnimation implements Animation {
  readonly finished: Promise<boolean>
  private resolve!: (finished: boolean) => void
  private settled = false
  private queued = false
  private started = false
  private unwatch: (() => void) | undefined
  private native: UILabel | undefined
  private container: CALayer | undefined
  private pieces: CALayer[] = []
  private attributed: NSAttributedString | null = null
  private hidden: NSAttributedString | null = null
  private color: UIColor | undefined
  private shadow: UIColor | null = null
  private delegate: NSObject | undefined
  private observer: ReturnType<typeof Application.ios.addNotificationObserver> | undefined
  private roll: org.rafaelaugusto.jolt.NumberRoll | undefined

  constructor(
    private readonly view: Label,
    private readonly previous: string,
    private readonly next: string,
    private readonly options: Options,
  ) {
    this.finished = new Promise((resolve) => {
      this.resolve = resolve
    })
    running.set(view, this)
    const { changes, removed } = diffFromEnd(previous, next)
    if (!changes.length && !removed.length) {
      this.end(true)
      return
    }
    if (!isIOS && !isAndroid) {
      this.end(false)
      return
    }
    if (reduced()) {
      this.end(true)
      return
    }
    view.on('loaded', this.schedule)
    view.on('unloaded', this.stop)
    if (isIOS) view.on('layoutChanged', this.layoutChanged)
    this.unwatch = watchLabel(view, this.changed)
    this.schedule()
  }

  then<A = boolean, B = never>(
    onfulfilled?: ((finished: boolean) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): Promise<A | B> {
    return this.finished.then(onfulfilled, onrejected)
  }
  /** Cancels the roll. The label keeps its final text. */
  stop = () => this.end(false)
  private changed = () => this.end(false)
  private motionChanged = () => {
    if (reduced()) this.end(true)
  }
  private layoutChanged = () => {
    if (!this.container) return this.schedule()
    const native = this.view.nativeViewProtected
    if (native !== this.native || !this.native?.window) return this.stop()
    this.container.frame = this.native.bounds
  }
  private schedule = () => {
    if (this.settled || this.queued) return
    this.queued = true
    void Promise.resolve().then(() => {
      this.queued = false
      if (this.settled || this.started || !this.view.isLoaded) return
      try {
        this.start()
      } catch {
        this.end(false)
      }
    })
  }
  private start() {
    if (reduced()) return this.end(true)
    if (this.view.visibility !== 'visible') return this.end(false)
    if (isIOS) this.startIOS()
    else this.startAndroid()
  }
  private startIOS() {
    const native = this.view.nativeViewProtected as UILabel | undefined
    if (!(native instanceof UILabel) || !native.window) return
    if (native.bounds.size.width <= 0 || native.bounds.size.height <= 0) return
    if (this.options.tabular) native.font = tabularFont(native.font)
    const attributed = native.attributedText
    let before: ReturnType<typeof textLayer>
    try {
      if (attributed) {
        const copy =
          NSMutableAttributedString.alloc().initWithAttributedString(attributed)
        copy.replaceCharactersInRangeWithString(
          { location: 0, length: copy.length },
          this.previous,
        )
        native.attributedText = copy
      } else native.text = this.previous
      before = textLayer(native, 'letter')
    } finally {
      if (attributed) native.attributedText = attributed
      else native.text = this.next
    }
    const after = textLayer(native, 'letter')
    if (!before || !after) return this.end(false)
    this.started = true

    const { changes, removed } = diffFromEnd(this.previous, this.next)
    const entering = new Map<number, number>()
    const exiting = new Map<number, number>()
    const assign = (
      map: Map<number, number>,
      pieces: readonly TextPiece[],
      grapheme: Grapheme,
      step: number,
    ) => {
      const index = pieceAt(pieces, grapheme)
      if (index !== undefined && !map.has(index)) map.set(index, step)
    }
    changes.forEach(({ next, previous }, step) => {
      assign(entering, after.pieces, next, step)
      if (previous) assign(exiting, before.pieces, previous, step)
    })
    removed.forEach((grapheme, index) =>
      assign(exiting, before.pieces, grapheme, changes.length + index),
    )
    if (!entering.size && !exiting.size) return this.end(true)
    if (entering.size + exiting.size > MAX_POSITIONS) return this.end(false)
    const last = Math.max(...entering.values(), ...exiting.values())

    const { delay, stagger, direction } = this.options
    const shift = native.font.lineHeight
    const spring = springTrack(shift, this.options)
    const fade = fadeTrack(this.options)
    const container = CALayer.new()
    container.name = 'jolt:roll'
    container.frame = native.bounds
    container.masksToBounds = true
    const oldPieces = layersOf(before.layer)
    const newPieces = layersOf(after.layer)
    const start = CACurrentMediaTime()
    this.native = native
    this.container = container
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    try {
      this.hide(native)
      oldPieces.forEach((piece, index) => {
        if (!exiting.has(index)) piece.removeFromSuperlayer()
      })
      if (before.layer) container.addSublayer(before.layer)
      if (after.layer) container.addSublayer(after.layer)
      native.layer.addSublayer(container)
      const roll = (piece: CALayer, step: number, incoming: boolean) => {
        if (!incoming) {
          piece.opacity = 0
          piece.transform = CATransform3DMakeTranslation(0, -direction * shift, 0)
        }
        const move = CAKeyframeAnimation.animationWithKeyPath('transform.translation.y')
        move.values = NSArray.arrayWithArray(
          spring.values.map((value) => direction * (incoming ? value : value - shift)),
        )
        move.keyTimes = NSArray.arrayWithArray(spring.times as number[])
        move.duration = spring.duration / 1000
        const opacity = CAKeyframeAnimation.animationWithKeyPath('opacity')
        opacity.values = NSArray.arrayWithArray(
          fade.values.map((value) => (incoming ? value : 1 - value)),
        )
        opacity.keyTimes = NSArray.arrayWithArray(fade.times as number[])
        opacity.duration = fade.duration / 1000
        const group = CAAnimationGroup.new()
        group.animations = NSArray.arrayWithArray([opacity, move])
        group.duration = Math.max(spring.duration, fade.duration) / 1000
        group.beginTime = start + (delay + step * stagger) / 1000
        group.fillMode = kCAFillModeBackwards
        if (step === last && !this.delegate)
          this.delegate = group.delegate = completion((finished) => this.end(finished))
        piece.addAnimationForKey(group, 'jolt:roll')
        this.pieces.push(piece)
      }
      for (const [index, step] of exiting) roll(oldPieces[index]!, step, false)
      for (const [index, step] of entering) roll(newPieces[index]!, step, true)
      this.observer = Application.ios.addNotificationObserver(
        UIAccessibilityReduceMotionStatusDidChangeNotification,
        this.motionChanged,
      )
    } finally {
      CATransaction.commit()
    }
  }
  private hide(native: UILabel) {
    this.color = native.textColor
    // UILabel synthesizes an attributed string for plain text, so this is the usual path.
    const attributed = native.attributedText
    if (attributed) {
      const hidden =
        NSMutableAttributedString.alloc().initWithAttributedString(attributed)
      const full = { location: 0, length: hidden.length }
      const shadow = NSShadow.new()
      shadow.shadowColor = UIColor.clearColor
      for (const key of paintKeys())
        hidden.addAttributeValueRange(
          key,
          key === NSShadowAttributeName ? shadow : UIColor.clearColor,
          full,
        )
      this.attributed = attributed
      this.hidden = hidden
      native.attributedText = hidden
    } else native.textColor = UIColor.clearColor
    this.shadow = native.shadowColor
    native.shadowColor = null
  }
  private show(native: UILabel) {
    // UIKit hands back a normalized copy of the attributed text and keeps the
    // clear color for text the app sets later, so "still ours" means the text
    // is still clear. A color the app painted meanwhile wins.
    const current = native.attributedText
    if (!current || isClear(current)) {
      if (current && this.attributed && current.string === this.hidden?.string) {
        const restored =
          NSMutableAttributedString.alloc().initWithAttributedString(current)
        const full = { location: 0, length: restored.length }
        for (const key of paintKeys()) {
          restored.removeAttributeRange(key, full)
          this.attributed.enumerateAttributeInRangeOptionsUsingBlock(
            key,
            full,
            0 as NSAttributedStringEnumerationOptions,
            (value, range) => {
              if (value != null) restored.addAttributeValueRange(key, value, range)
            },
          )
        }
        native.attributedText = restored
      }
      if (this.color && native.textColor?.isEqual(UIColor.clearColor))
        native.textColor = this.color
    }
    if (!native.shadowColor) native.shadowColor = this.shadow
  }
  private startAndroid() {
    const native = this.view.nativeViewProtected as android.widget.TextView | undefined
    if (!(native instanceof android.widget.TextView)) return this.end(false)
    const { changes } = diffFromEnd(this.previous, this.next)
    if (!changes.length) return this.end(true)
    if (changes.length > MAX_POSITIONS) return this.end(false)
    this.started = true
    const density = Utils.layout.getDisplayDensity()
    const shift = native.getLineHeight()
    const spring = springTrack(shift / density, this.options)
    const fade = fadeTrack(this.options)
    const starts = Array.create('int', changes.length)
    const ends = Array.create('int', changes.length)
    const previous = Array.create(java.lang.String, changes.length)
    changes.forEach(({ next, previous: old }, index) => {
      starts[index] = next.start
      ends[index] = next.end
      previous[index] = old?.text ?? ''
    })
    const times = Array.create('float', spring.times.length)
    const values = Array.create('float', spring.values.length)
    spring.times.forEach((time, index) => (times[index] = time))
    spring.values.forEach((value, index) => (values[index] = value * density))
    const { delay, stagger, direction, tabular } = this.options
    let roll: org.rafaelaugusto.jolt.NumberRoll
    try {
      roll = new org.rafaelaugusto.jolt.NumberRoll(
        native,
        starts,
        ends,
        previous,
        direction,
        times,
        values,
        spring.duration,
        Math.round(delay),
        Math.round(stagger),
        shift,
        fade.duration,
        tabular,
        new org.rafaelaugusto.jolt.NumberRoll.Callback({
          onEnd: (finished) => this.end(finished),
        }),
      )
    } catch {
      // A JS-only update cannot install the native plugin. The label shows the final text.
      return this.end(false)
    }
    if (!roll.isSupported()) return this.end(false)
    this.roll = roll
    roll.start()
  }
  private end(finished: boolean) {
    if (this.settled) return
    this.settled = true
    const { view, native, container } = this
    view.off('loaded', this.schedule)
    view.off('unloaded', this.stop)
    view.off('layoutChanged', this.layoutChanged)
    this.unwatch?.()
    if (running.get(view) === this) running.delete(view)
    if (this.observer)
      Application.ios.removeNotificationObserver(
        this.observer,
        UIAccessibilityReduceMotionStatusDidChangeNotification,
      )
    if (this.delegate) forgetCompletion(this.delegate)
    if (native && container) {
      CATransaction.begin()
      CATransaction.setDisableActions(true)
      try {
        this.show(native)
        container.removeFromSuperlayer()
        for (const piece of this.pieces) piece.removeAnimationForKey('jolt:roll')
      } finally {
        CATransaction.commit()
      }
    }
    this.roll?.cancel()
    this.pieces = []
    this.native = this.container = this.delegate = this.observer = this.roll = undefined
    this.attributed = this.hidden = null
    this.resolve(finished)
  }
}
