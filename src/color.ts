import type { ColorProperty } from './core/color.js'
export { colorMixer, isColorProperty, type ColorProperty } from './core/color.js'
import { Button, Color, Label, TextBase, isIOS, type View } from '@nativescript/core'

export type ColorValue = string | Color
export type ColorKeyframes = ColorValue | readonly (ColorValue | null)[]
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
