import { preserveZeroShadow } from './driver/ios-shadow.js'
import { Color, Utils, isAndroid, type View } from '@nativescript/core'

type Shadow = Exclude<View['boxShadow'], string>[number]
export type DecorationProperty =
  | 'borderRadius'
  | 'borderWidth'
  | 'shadowOpacity'
  | 'shadowRadius'
  | 'shadowOffsetX'
  | 'shadowOffsetY'
  | 'elevation'
  | 'translationZ'

export const decorationProperties: readonly DecorationProperty[] = [
  'borderRadius',
  'borderWidth',
  'shadowOpacity',
  'shadowRadius',
  'shadowOffsetX',
  'shadowOffsetY',
  'elevation',
  'translationZ',
]
export const radiusKeys = [
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomRightRadius',
  'borderBottomLeftRadius',
] as const
export const widthKeys = [
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
] as const
const writing = new WeakSet<View>()
export const isWritingDecoration = (view: View) => writing.has(view)
export const isDecorationProperty = (key: string): key is DecorationProperty =>
  decorationProperties.includes(key as DecorationProperty)

/** Core lengths may be numbers, px strings or parsed { value, unit } lengths. */
export function dip(value: unknown): number {
  if (value === undefined || value === null) return 0
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const match = /^(-?(?:\d+(?:\.\d*)?|\.\d+))(dip|px)?$/.exec(value.trim())
    if (match)
      return Number(match[1]) / (match[2] === 'px' ? Utils.layout.getDisplayDensity() : 1)
  }
  if (typeof value === 'object' && 'value' in value && 'unit' in value) {
    const length = value as { value: number; unit: string }
    if (Number.isFinite(length.value) && (length.unit === 'dip' || length.unit === 'px'))
      return length.value / (length.unit === 'px' ? Utils.layout.getDisplayDensity() : 1)
  }
  throw new TypeError('Decoration animations require finite DIP or px lengths.')
}

export function singleShadow(view: View): Shadow {
  const shadows = view.boxShadow
  if (!Array.isArray(shadows) || shadows.length !== 1 || shadows[0]!.inset)
    throw new TypeError('Shadow animation requires one existing outer boxShadow.')
  return shadows[0]!
}

export function validateDecorationTarget(view: View, property: DecorationProperty) {
  const shadow = property.startsWith('shadow')
  const z = property === 'elevation' || property === 'translationZ'
  if ((shadow && isAndroid) || (z && !isAndroid))
    throw new TypeError(`"${property}" is only supported on ${z ? 'Android' : 'iOS'}.`)
  if (z) return
  if (view.style.clipPath || view.style.cornerShape === 'squircle')
    throw new TypeError(
      'Decoration animations require circular corners without a clipPath.',
    )
  for (const keys of [radiusKeys, widthKeys]) {
    const values = keys.map((key) => dip(view[key]))
    if (values.some((value) => value !== values[0]))
      throw new TypeError(
        'Decoration animations require uniform border widths and radii.',
      )
  }
  const colors = [
    view.borderTopColor,
    view.borderRightColor,
    view.borderBottomColor,
    view.borderLeftColor,
  ].map((color) => color?.argb ?? 0)
  if (colors.some((color) => color !== colors[0]))
    throw new TypeError('Decoration animations require uniform border colors.')
  if (shadow) {
    const value = singleShadow(view)
    for (const length of [
      value.offsetX,
      value.offsetY,
      value.blurRadius,
      value.spreadRadius,
    ])
      dip(length)
  }
  if (
    property === 'borderRadius' &&
    isAndroid &&
    view.boxShadow &&
    (!Array.isArray(view.boxShadow) || view.boxShadow.length)
  )
    throw new TypeError(
      'Animate Android radius with elevation shadows; CSS boxShadow caches its shape.',
    )
}

export function validateDecorationFrames(
  property: DecorationProperty,
  frames: readonly (number | null)[],
) {
  if (
    frames.some((value) => value !== null && clampDecoration(property, value) !== value)
  )
    throw new RangeError(`Invalid keyframes for "${property}".`)
}
export function clampDecoration(property: DecorationProperty, value: number): number {
  if (property === 'shadowOpacity') return Math.max(0, Math.min(1, value))
  return property === 'borderRadius' ||
    property === 'borderWidth' ||
    property === 'shadowRadius' ||
    property === 'elevation'
    ? Math.max(0, value)
    : value
}

export function readDecoration(view: View, property: DecorationProperty): number {
  if (property === 'borderRadius') {
    const radius = !isAndroid ? view.nativeViewProtected?.layer?.cornerRadius : undefined
    return typeof radius === 'number' ? radius : dip(view.borderTopLeftRadius)
  }
  if (property === 'borderWidth') return dip(view.borderTopWidth)
  if (property === 'elevation')
    return view.nativeViewProtected?.getElevation
      ? view.nativeViewProtected.getElevation() / Utils.layout.getDisplayDensity()
      : view.androidElevation || 0
  if (property === 'translationZ')
    return (
      view.nativeViewProtected?.getTranslationZ?.() / Utils.layout.getDisplayDensity() ||
      0
    )
  const shadow = singleShadow(view)
  if (property === 'shadowOpacity')
    return ((shadow.color?.argb ?? 0xff000000) >>> 24) / 255
  return property === 'shadowRadius'
    ? dip(shadow.blurRadius) / 2
    : dip(property === 'shadowOffsetX' ? shadow.offsetX : shadow.offsetY)
}

export function writeDecoration(view: View, property: DecorationProperty, raw: number) {
  const value = clampDecoration(property, raw)
  writing.add(view)
  try {
    if (property === 'borderRadius' || property === 'borderWidth') view[property] = value
    else if (property === 'elevation') view.androidElevation = value
    else if (property === 'translationZ')
      view.nativeViewProtected?.setTranslationZ?.(
        value * Utils.layout.getDisplayDensity(),
      )
    else {
      const shadow = { ...singleShadow(view) }
      if (property === 'shadowOpacity')
        shadow.color = new Color(
          ((Math.round(value * 255) << 24) | ((shadow.color?.argb ?? 0) & 0xffffff)) >>>
            0,
        )
      else if (property === 'shadowRadius') shadow.blurRadius = value * 2
      else if (property === 'shadowOffsetX') shadow.offsetX = value
      else shadow.offsetY = value
      view.boxShadow = [shadow]
      if (!isAndroid) preserveZeroShadow(view)
    }
  } finally {
    writing.delete(view)
  }
}
