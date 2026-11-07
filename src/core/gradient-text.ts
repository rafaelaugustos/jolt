/** Plain text paint shared by native glyph masks and browser text clipping. */
export interface GradientTextDefinition<Color = string> {
  colors: readonly Color[]
  stops?: readonly number[]
  /** Degrees clockwise from left-to-right. */
  angle?: number
  sheen?: { color?: Color; width?: number; direction?: 'left' | 'right' }
}
export interface TextPaint {
  colors: number[]
  stops: number[]
  angle: number
  sheen: number
  width: number
}
export function resolveGradientText<Color>(
  options: GradientTextDefinition<Color>,
  parse: (color: Color) => number,
) {
  if (
    !Array.isArray(options.colors) ||
    options.colors.length < 2 ||
    options.colors.length > 8
  )
    throw new TypeError('Gradient text needs 2..8 colors.')
  const colors = Array.from(options.colors, parse)
  const stops = options.stops
    ? Array.from(options.stops)
    : colors.map((_, i) => i / (colors.length - 1))
  if (
    stops.length !== colors.length ||
    stops.some(
      (stop, i) =>
        !Number.isFinite(stop) || stop < 0 || stop > 1 || (i > 0 && stop < stops[i - 1]!),
    )
  )
    throw new TypeError('Gradient stops must be ordered in 0..1 and match colors.')
  const paint: TextPaint = {
    colors,
    stops,
    angle: options.angle ?? 0,
    sheen: options.sheen?.color === undefined ? 0xbfffffff : parse(options.sheen.color),
    width: options.sheen?.width ?? 0.3,
  }
  const direction = options.sheen?.direction ?? 'right'
  if (direction !== 'left' && direction !== 'right')
    throw new TypeError('Invalid text sheen direction.')
  if (
    !Number.isFinite(paint.angle) ||
    !Number.isFinite(paint.width) ||
    paint.width <= 0 ||
    paint.width > 1
  )
    throw new TypeError('Invalid text gradient angle or sheen width.')
  return { paint, direction }
}
