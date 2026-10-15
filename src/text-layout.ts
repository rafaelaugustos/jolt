/** TextKit lays out the complete string before any glyphs are separated. */
type Insets = { top: number; left: number; bottom: number; right: number }
type NativeLabel = UILabel & { padding?: Insets; borderThickness?: Insets }
const MAX_PIECES = 256
const MAX_PIXELS = 4_000_000

/** Ligatures and composed characters may share glyphs. Never draw a shared glyph twice. */
export function mergeGlyphRanges(ranges: readonly NSRange[]): NSRange[] {
  const merged: NSRange[] = []
  for (const range of ranges) {
    if (!range.length) continue
    const previous = merged.at(-1)
    if (
      previous &&
      range.location < previous.location + previous.length &&
      range.location + range.length > previous.location
    ) {
      const end = Math.max(
        previous.location + previous.length,
        range.location + range.length,
      )
      previous.location = Math.min(previous.location, range.location)
      previous.length = end - previous.location
    } else merged.push({ location: range.location, length: range.length })
  }
  return merged
}

export function textLayer(native: NativeLabel, by: 'letter' | 'word') {
  if (native.adjustsFontSizeToFitWidth) return undefined
  const original = native.attributedText
  const text = original?.string ?? native.text ?? ''
  if (!text.trim()) return { text, layer: undefined }
  const string = NSString.stringWithString(text)
  const full = { location: 0, length: string.length }
  const attributed = original
    ? NSMutableAttributedString.alloc().initWithAttributedString(original)
    : NSMutableAttributedString.alloc().initWithString(text)
  const paragraph = NSMutableParagraphStyle.new()
  paragraph.alignment = native.textAlignment
  paragraph.lineBreakMode = native.lineBreakMode
  const defaults: [string, unknown][] = [
    [NSFontAttributeName, native.font],
    [NSForegroundColorAttributeName, native.textColor],
    [NSParagraphStyleAttributeName, paragraph],
  ]
  if (native.shadowColor) {
    const shadow = NSShadow.new()
    shadow.shadowColor = native.shadowColor
    shadow.shadowOffset = native.shadowOffset
    defaults.push([NSShadowAttributeName, shadow])
  }
  for (const [key, value] of defaults) {
    attributed.enumerateAttributeInRangeOptionsUsingBlock(
      key,
      full,
      0 as NSAttributedStringEnumerationOptions,
      (attribute, range) => {
        if (attribute == null && value != null)
          attributed.addAttributeValueRange(key, value, range)
      },
    )
  }
  const inset = (side: keyof Insets) =>
    (native.padding?.[side] ?? 0) + (native.borderThickness?.[side] ?? 0)
  const bounds = native.bounds
  const width = bounds.size.width - inset('left') - inset('right')
  const height = bounds.size.height - inset('top') - inset('bottom')
  if (width <= 0 || height <= 0) return undefined
  const storage = NSTextStorage.alloc().initWithAttributedString(attributed)
  const manager = NSLayoutManager.new()
  manager.usesFontLeading = false
  const container = NSTextContainer.alloc().initWithSize(CGSizeMake(width, height))
  container.lineFragmentPadding = 0
  container.maximumNumberOfLines = native.numberOfLines
  container.lineBreakMode = native.lineBreakMode
  manager.addTextContainer(container)
  storage.addLayoutManager(manager)
  manager.ensureLayoutForTextContainer(container)
  const visible = manager.glyphRangeForTextContainer(container)
  if (visible.length !== manager.numberOfGlyphs) return undefined
  // A truncation token is not an independently addressable character. Keep the real label.
  for (let glyph = 0; glyph < manager.numberOfGlyphs;) {
    if (manager.truncatedGlyphRangeInLineFragmentForGlyphAtIndex(glyph).length)
      return undefined
    const range = new interop.Reference<NSRange>()
    manager.lineFragmentRectForGlyphAtIndexEffectiveRange(glyph, range)
    const next = range.value.location + range.value.length
    if (next <= glyph) return undefined
    glyph = next
  }
  const characters: NSRange[] = []
  string.enumerateSubstringsInRangeOptionsUsingBlock(
    full,
    by === 'letter' ? 2 : 3,
    (substring, range) => {
      if (substring?.trim())
        characters.push({ location: range.location, length: range.length })
    },
  )
  if (by === 'word') {
    // Attach spaces and punctuation to the surrounding word, preserving every visible mark.
    characters.forEach((range, index) => {
      const start = index === 0 ? 0 : range.location
      const end = characters[index + 1]?.location ?? full.length
      range.location = start
      range.length = end - start
    })
    if (!characters.length) characters.push(full)
  }
  const ranges = mergeGlyphRanges(
    characters.map((range) =>
      manager.glyphRangeForCharacterRangeActualCharacterRange(range, null),
    ),
  )
  if (ranges.length > MAX_PIECES) return undefined
  const used = manager.usedRectForTextContainer(container)
  const offsetX = bounds.origin.x + inset('left')
  const offsetY =
    bounds.origin.y + inset('top') + (height - used.size.height) / 2 - used.origin.y
  const scale = native.window?.screen.scale ?? UIScreen.mainScreen.scale
  const padding = Math.max(4, native.font.pointSize * 0.1)
  const pieces = ranges.map((range) => {
    const glyph = manager.boundingRectForGlyphRangeInTextContainer(range, container)
    return {
      range,
      rect: CGRectIntegral(
        CGRectMake(
          glyph.origin.x + offsetX - padding,
          glyph.origin.y + offsetY - padding,
          glyph.size.width + padding * 2,
          glyph.size.height + padding * 2,
        ),
      ),
    }
  })
  if (
    pieces.reduce(
      (pixels, { rect }) => pixels + rect.size.width * rect.size.height * scale * scale,
      0,
    ) > MAX_PIXELS
  )
    return undefined
  const layer = CALayer.new()
  layer.name = 'jolt:text'
  layer.frame = bounds
  const transparent = UIColor.clearColor
  const noShadow = NSShadow.new()
  noShadow.shadowColor = transparent
  const hidden = NSMutableAttributedString.alloc().initWithAttributedString(attributed)
  for (const key of [
    NSForegroundColorAttributeName,
    NSBackgroundColorAttributeName,
    NSUnderlineColorAttributeName,
    NSStrikethroughColorAttributeName,
    NSStrokeColorAttributeName,
  ]) {
    hidden.addAttributeValueRange(key, transparent, full)
  }
  hidden.addAttributeValueRange(NSShadowAttributeName, noShadow, full)
  let attachments = false
  attributed.enumerateAttributeInRangeOptionsUsingBlock(
    NSAttachmentAttributeName,
    full,
    0 as NSAttributedStringEnumerationOptions,
    (value) => {
      if (value != null) attachments = true
    },
  )
  if (attachments) return undefined
  const shadowColor = native.shadowColor
  try {
    native.shadowColor = null
    for (const { range, rect } of pieces) {
      const fragment = NSMutableAttributedString.alloc().initWithAttributedString(hidden)
      const characters = manager.characterRangeForGlyphRangeActualGlyphRange(range, null)
      attributed.enumerateAttributesInRangeOptionsUsingBlock(
        characters,
        0 as NSAttributedStringEnumerationOptions,
        (attributes, part) => fragment.setAttributesRange(attributes, part),
      )
      native.attributedText = fragment
      // UILabel draws its own glyphs, preserving its baseline rounding and fallback-font metrics.
      // Other glyphs keep their shaping/advances but have transparent paint.
      UIGraphicsBeginImageContextWithOptions(rect.size, false, scale)
      let image: UIImage | null
      try {
        CGContextTranslateCTM(
          UIGraphicsGetCurrentContext()!,
          -rect.origin.x,
          -rect.origin.y,
        )
        native.drawTextInRect(bounds)
        image = UIGraphicsGetImageFromCurrentImageContext()
      } finally {
        UIGraphicsEndImageContext()
      }
      if (!image?.CGImage) return undefined
      const piece = CALayer.new()
      piece.frame = CGRectMake(
        rect.origin.x - bounds.origin.x,
        rect.origin.y - bounds.origin.y,
        rect.size.width,
        rect.size.height,
      )
      piece.contents = image.CGImage
      piece.contentsScale = scale
      layer.addSublayer(piece)
    }
  } finally {
    if (original) native.attributedText = original
    else native.text = text
    native.shadowColor = shadowColor
  }
  return { text, layer }
}
