import { Color, type View } from '@nativescript/core'
import { colorProperty } from '@nativescript/core/ui/styling/style-properties'
import { formattedTextProperty, textProperty } from '@nativescript/core/ui/text-base'
import { readColor, type ColorProperty } from '../color.js'
import { iosPlayback } from './ios-playback.js'
import type { Track } from '../track.js'

type TextView = View & {
  text?: string
  formattedText?: {
    toString(): string
    style: object
    spans: { length: number; getItem(index: number): { text: string; style: object } }
  }
}
type PaintLayer = {
  layer: CALayer
  path: 'backgroundColor' | 'borderColor' | 'fillColor'
}
type NativeView = UIView & { borderLayer?: CAShapeLayer }
interface ColorHandle {
  elapsed(): number
  control(elapsed: number, paused: boolean): void
  stop(): void
  presented(): number | undefined
}
const playing = new WeakMap<View, Map<string, ColorHandle>>()
const labelOf = (view: View) => {
  const native = view.nativeViewProtected
  return native instanceof UILabel
    ? native
    : native instanceof UIButton
      ? native.titleLabel
      : undefined
}

export function presentedIOSColor(
  view: View,
  property: ColorProperty,
): number | undefined {
  const active = playing.get(view)?.get(property)
  if (active) return active.presented()
  if (property === 'color' && !view.color) {
    const label = labelOf(view)
    if (label?.textColor) return Color.fromIosColor(label.textColor).argb >>> 0
  }
  return readColor(view, property)
}

/** Glyph entrances and color masks cannot own the same UILabel paint at once. */
export function stopIOSColorText(view: View) {
  playing.get(view)?.get('color')?.stop()
}

/** Core Animation paints a solid layer through an exact UILabel alpha mask. */
export function playIOSColor(
  view: View,
  track: Track,
  startedAt: number,
  onEnd: (finished?: boolean) => void,
): ColorHandle {
  const timing = iosPlayback(track, startedAt)
  const property = track.property as ColorProperty
  let target: PaintLayer | undefined
  let restore: (() => void) | undefined
  let stopped = false
  let queued = false
  let attached = false
  let generation = 0
  let textGeometry: string | undefined
  const native = view.nativeViewProtected as NativeView
  const label = property === 'color' ? labelOf(view) : undefined
  const key = `jolt:${property}`
  const listeners: [
    object & {
      on(name: string, callback: () => void): void
      off(name: string, callback: () => void): void
    },
    string,
    () => void,
  ][] = []
  const listen = (
    object: typeof view | typeof view.style,
    name: string,
    callback: () => void,
  ) => {
    object.on(name, callback)
    listeners.push([object, name, callback])
  }
  const cleanup = () => {
    if (stopped) return
    stopped = true
    generation++
    for (const [object, name, callback] of listeners) object.off(name, callback)
    target?.layer.removeAnimationForKey(key)
    restore?.()
    if (playing.get(view)?.get(property) === handle) playing.get(view)?.delete(property)
  }
  const cancel = () => {
    if (stopped) return
    cleanup()
    onEnd(false)
  }
  const scheduleCancel = () => {
    if (stopped || queued) return
    queued = true
    void Promise.resolve().then(() => {
      queued = false
      if (!stopped) cancel()
    })
  }
  const handle: ColorHandle = {
    stop: cancel,
    elapsed: timing.elapsed,
    control(time, paused) {
      if (!stopped) {
        timing.control(time, paused)
        attach()
      }
    },
    presented() {
      // A new CA copy commits at the end of the turn. After controls, the engine
      // clock is authoritative even before presentationLayer catches up.
      if (timing.controlled) return undefined
      if (!target) return track.values[0]
      const layer = target.layer.presentationLayer()
      // Before CA commits its first frame, the model already contains the target.
      if (!layer) return track.valueAt(timing.elapsed())
      const color = (layer as unknown as Record<string, interop.Pointer | null>)[
        target.path
      ]
      return color
        ? Color.fromIosColor(UIColor.colorWithCGColor(color)).argb >>> 0
        : undefined
    },
  }
  let entries = playing.get(view)
  if (!entries) playing.set(view, (entries = new Map()))
  entries.set(property, handle)
  listen(view, 'unloaded', cancel)
  for (const name of property === 'borderColor'
    ? [
        'borderTopColorChange',
        'borderRightColorChange',
        'borderBottomColorChange',
        'borderLeftColorChange',
      ]
    : [`${property}Change`])
    listen(view.style, name, scheduleCancel)
  if (property === 'backgroundColor')
    listen(view.style, 'backgroundImageChange', scheduleCancel)

  const start = () => {
    if (stopped || attached) return
    if (property === 'color') {
      if (
        !label ||
        !label.window ||
        label.bounds.size.width <= 0 ||
        label.bounds.size.height <= 0
      )
        return
      let paint: ReturnType<typeof textPaint>
      try {
        paint = textPaint(view as TextView, label)
      } catch {
        return cancel()
      }
      if (!paint) return cancel()
      target = { layer: paint.layer, path: 'backgroundColor' }
      restore = paint.restore
    } else {
      // Core rasterizes an image together with its background into a pattern.
      // Replacing that CGColor would erase the image.
      if (
        property === 'backgroundColor' &&
        typeof view.backgroundImage === 'string' &&
        view.backgroundImage
      )
        return cancel()
      target =
        property === 'borderColor' && native.borderLayer
          ? { layer: native.borderLayer, path: 'fillColor' }
          : { layer: native.layer, path: property }
    }
    attached = true
    if (label) textGeometry = geometry(label)
    attach()
  }
  const attach = () => {
    if (!target || stopped) return
    const instance = ++generation
    const { layer, path } = target
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    ;(layer as unknown as Record<string, interop.Pointer>)[path] = new Color(
      track.to,
    ).ios.CGColor
    CATransaction.commit()
    const animation = CAKeyframeAnimation.animationWithKeyPath(path)
    animation.values = NSArray.arrayWithArray(
      track.values.map((color) => new Color(color).ios.CGColor),
    )
    animation.keyTimes = NSArray.arrayWithArray(track.times as number[])
    animation.duration = Math.max(track.duration, 1) / 1000
    timing.configure(animation, layer)
    if (animation.respondsToSelector('setPreferredFrameRateRange:')) {
      const maximum = Math.min(
        120,
        native.window?.screen.maximumFramesPerSecond ??
          UIScreen.mainScreen.maximumFramesPerSecond,
      )
      animation.preferredFrameRateRange = CAFrameRateRangeMake(
        Math.min(80, maximum),
        maximum,
        maximum,
      )
    }
    if (track.repeat > 0) {
      animation.autoreverses = track.reverse
      animation.repeatCount = track.reverse ? (track.repeat + 1) / 2 : track.repeat + 1
    }
    CATransaction.begin()
    if (!timing.paused && track.repeat !== Infinity)
      CATransaction.setCompletionBlock(() => {
        if (!stopped && instance === generation) {
          cleanup()
          onEnd()
        }
      })
    layer.addAnimationForKey(animation, key)
    CATransaction.commit()
  }

  if (property === 'color') {
    for (const name of ['textChange', 'formattedTextChange', 'isEnabledChange'])
      listen(view, name, scheduleCancel)
    for (const name of [
      'fontInternalChange',
      'textTransformChange',
      'whiteSpaceChange',
      'textOverflowChange',
      'maxLinesChange',
      'textStrokeChange',
      'directionChange',
      'visibilityChange',
      'paddingLeftChange',
      'paddingRightChange',
      'paddingTopChange',
      'paddingBottomChange',
      'textAlignmentChange',
      'letterSpacingChange',
      'textDecorationChange',
      'textShadowChange',
      'lineHeightChange',
    ])
      listen(view.style, name, scheduleCancel)
    listen(view, 'layoutChanged', () => {
      if (attached) {
        // Core can relayout after rebuilding an identical attributed string.
        // Only changed glyph geometry invalidates the captured mask.
        if (label && geometry(label) !== textGeometry) scheduleCancel()
      } else start()
    })
    const formatted = (view as TextView).formattedText
    if (formatted) {
      const object = formatted as unknown as typeof view
      listen(object, 'propertyChange', scheduleCancel)
    }
  } else if (property === 'borderColor') {
    // Core may rebuild its border layer after a background or geometry change.
    // Reattach on the same native timeline, without cancelling sibling colors.
    let pending = false
    const followBorder = () => {
      if (stopped || pending) return
      pending = true
      void Promise.resolve().then(() => {
        pending = false
        if (stopped || !attached || !target) return
        const next: PaintLayer = native.borderLayer
          ? { layer: native.borderLayer, path: 'fillColor' }
          : { layer: native.layer, path: 'borderColor' }
        if (next.layer === target.layer && next.path === target.path) return
        const previous = target
        target = next
        generation++
        previous.layer.removeAnimationForKey(key)
        attach()
      })
    }
    listen(view, 'layoutChanged', followBorder)
    listen(view.style, 'backgroundInternalChange', followBorder)
  }
  start()
  return handle
}

function textPaint(
  view: TextView,
  native: UILabel,
): { layer: CALayer; restore(): void } | undefined {
  const owner = view.nativeViewProtected
  const original = native.attributedText
  const text = original?.string ?? native.text ?? ''
  const bounds = native.bounds
  const scale = native.window?.screen.scale ?? UIScreen.mainScreen.scale
  if (
    !text ||
    Array.from(text).some((char) => {
      const cp = char.codePointAt(0)!
      return (
        (cp >= 0x1f000 && cp <= 0x1faff) ||
        (cp >= 0x2600 && cp <= 0x27bf) ||
        cp === 0x200d ||
        cp === 0x20e3 ||
        cp === 0xfe0f
      )
    }) ||
    (native.shadowColor && CGColorGetAlpha(native.shadowColor.CGColor) > 0) ||
    bounds.size.width * bounds.size.height * scale * scale > 4_000_000
  )
    return undefined
  const source = original
    ? NSMutableAttributedString.alloc().initWithAttributedString(original)
    : NSMutableAttributedString.alloc().initWithString(text)
  const full = { location: 0, length: source.length }
  let unsupported = false
  for (const attribute of [NSAttachmentAttributeName, NSShadowAttributeName])
    source.enumerateAttributeInRangeOptionsUsingBlock(
      attribute,
      full,
      0 as NSAttributedStringEnumerationOptions,
      (value) => {
        if (attribute === NSShadowAttributeName) {
          const color = (value as NSShadow | null)?.shadowColor as UIColor | null
          if (color && CGColorGetAlpha(color.CGColor) > 0) unsupported = true
        } else if (value != null) unsupported = true
      },
    )
  if (unsupported) return undefined
  const ranges: NSRange[] = []
  const ownColor = (style: object) =>
    ((style as Record<symbol, number>)[colorProperty.sourceKey] ?? 0) >= 2
  const formatted = view.formattedText
  if (formatted) {
    let offset = 0
    for (let i = 0; i < formatted.spans.length; i++) {
      const span = formatted.spans.getItem(i)
      if (!ownColor(formatted.style) && !ownColor(span.style))
        ranges.push({ location: offset, length: span.text.length })
      offset += span.text.length
    }
  } else ranges.push(full)
  const maskText = NSMutableAttributedString.alloc().initWithAttributedString(source)
  const hidden = NSMutableAttributedString.alloc().initWithAttributedString(source)
  maskText.addAttributeValueRange(NSFontAttributeName, native.font, full)
  // Keep per-span fonts, weights and paragraph metrics exactly as UILabel uses them.
  if (original)
    original.enumerateAttributeInRangeOptionsUsingBlock(
      NSFontAttributeName,
      full,
      0 as NSAttributedStringEnumerationOptions,
      (font, range) => {
        if (font) maskText.addAttributeValueRange(NSFontAttributeName, font, range)
      },
    )
  for (const name of [
    NSForegroundColorAttributeName,
    NSBackgroundColorAttributeName,
    NSUnderlineColorAttributeName,
    NSStrikethroughColorAttributeName,
    NSStrokeColorAttributeName,
  ])
    maskText.addAttributeValueRange(name, UIColor.clearColor, full)
  for (const range of ranges)
    for (const name of [
      NSForegroundColorAttributeName,
      NSUnderlineColorAttributeName,
      NSStrikethroughColorAttributeName,
      NSStrokeColorAttributeName,
    ]) {
      maskText.addAttributeValueRange(name, UIColor.whiteColor, range)
      hidden.addAttributeValueRange(name, UIColor.clearColor, range)
    }
  let image: UIImage | null
  try {
    native.attributedText = maskText
    UIGraphicsBeginImageContextWithOptions(bounds.size, false, scale)
    try {
      CGContextTranslateCTM(
        UIGraphicsGetCurrentContext()!,
        -bounds.origin.x,
        -bounds.origin.y,
      )
      native.drawTextInRect(bounds)
      image = UIGraphicsGetImageFromCurrentImageContext()
    } finally {
      UIGraphicsEndImageContext()
    }
  } finally {
    if (original) native.attributedText = original
    else native.text = text
  }
  if (!image?.CGImage) return undefined
  const mask = CALayer.new()
  mask.frame = CGRectMake(0, 0, bounds.size.width, bounds.size.height)
  mask.contents = image.CGImage
  mask.contentsScale = scale
  const layer = CALayer.new()
  layer.frame = bounds
  layer.name = 'jolt:color'
  layer.mask = mask
  native.attributedText = hidden
  native.layer.addSublayer(layer)
  return {
    layer,
    restore() {
      layer.removeFromSuperlayer()
      if (view.nativeViewProtected !== owner) return
      const property = view.formattedText ? formattedTextProperty : textProperty
      ;(view as unknown as Record<symbol, (value: unknown) => void>)[property.setNative]!(
        view.formattedText ?? view.text,
      )
    },
  }
}

function geometry(label: UILabel): string {
  const bounds = label.bounds
  const text = label.textRectForBoundsLimitedToNumberOfLines(bounds, label.numberOfLines)
  return [
    bounds.origin.x,
    bounds.origin.y,
    bounds.size.width,
    bounds.size.height,
    text.origin.x,
    text.origin.y,
    text.size.width,
    text.size.height,
  ].join(',')
}
