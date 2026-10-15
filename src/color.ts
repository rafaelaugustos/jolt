import { Button, Color, Label, TextBase, isIOS, type View } from '@nativescript/core'

export type ColorProperty = 'backgroundColor' | 'borderColor' | 'color'
export type ColorValue = string | Color
export type ColorKeyframes = ColorValue | readonly (ColorValue | null)[]
export const isColorProperty = (property: string): property is ColorProperty =>
  property === 'backgroundColor' || property === 'borderColor' || property === 'color'

export function parseColor(value: unknown): number {
  if (value instanceof Color) return value.argb >>> 0
  if (typeof value !== 'string' || !Color.isValid(value))
    throw new TypeError(`Invalid animation color: ${String(value)}.`)
  return new Color(value).argb >>> 0
}

export function readColor(view: View, property: ColorProperty): number {
  const value = property === 'borderColor' ? view.borderTopColor : view[property]
  return value instanceof Color
    ? value.argb >>> 0
    : property === 'backgroundColor'
      ? 0
      : 0xff000000
}

export function validateColorTarget(view: View, property: ColorProperty) {
  if (
    property === 'color' &&
    !(isIOS ? view instanceof Label || view instanceof Button : view instanceof TextBase)
  )
    throw new TypeError(
      'Text color animation requires a Label or Button on iOS, or a TextBase on Android.',
    )
  if (property === 'borderColor') {
    const colors = [
      view.borderTopColor,
      view.borderRightColor,
      view.borderBottomColor,
      view.borderLeftColor,
    ]
    if (
      colors.some(
        (color) => (color?.argb ?? 0xff000000) !== (colors[0]?.argb ?? 0xff000000),
      )
    )
      throw new TypeError(
        'borderColor animation requires the same starting color on every edge.',
      )
  }
}

const clamp = (value: number) => Math.max(0, Math.min(1, value))
const linear = (channel: number) =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
const encoded = (channel: number) =>
  channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055

function lab(value: number) {
  const r = linear(((value >>> 16) & 255) / 255)
  const g = linear(((value >>> 8) & 255) / 255)
  const b = linear((value & 255) / 255)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ] as const
}

/** Premultiplied OKLab interpolation, clipped to the sRGB output gamut. */
export function colorMixer(from: number, to: number): (progress: number) => number {
  const a = lab(from),
    b = lab(to)
  const alphaA = (from >>> 24) / 255,
    alphaB = (to >>> 24) / 255
  return (progress) => {
    const p = clamp(progress)
    if (p === 0) return from
    if (p === 1) return to
    const alpha = alphaA + (alphaB - alphaA) * p
    if (alpha <= 0) return 0
    const channel = (i: number) => (a[i]! * alphaA * (1 - p) + b[i]! * alphaB * p) / alpha
    const L = channel(0),
      A = channel(1),
      B = channel(2)
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
    const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
    const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
    const r = Math.round(
      clamp(encoded(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)) * 255,
    )
    const g = Math.round(
      clamp(encoded(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)) * 255,
    )
    const blue = Math.round(
      clamp(encoded(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)) * 255,
    )
    return ((Math.round(alpha * 255) << 24) | (r << 16) | (g << 8) | blue) >>> 0
  }
}
