import { Color, type View } from '@nativescript/core'
import { dip, radiusKeys, widthKeys } from './decoration.js'
import { isColorProperty, validateColorTarget } from './color.js'

export type LiveEdge = (typeof radiusKeys)[number] | (typeof widthKeys)[number]
export const liveEdges: readonly LiveEdge[] = [...radiusKeys, ...widthKeys]
export const isLiveEdge = (key: string): key is LiveEdge =>
  liveEdges.includes(key as LiveEdge)
export const isLivePaint = (key: string) =>
  isColorProperty(key) ||
  isLiveEdge(key) ||
  key === 'borderRadius' ||
  key === 'borderWidth'
export function overlapsLivePaint(a: string, b: string) {
  return (
    a !== b &&
    ((a === 'borderRadius' && radiusKeys.includes(b as never)) ||
      (b === 'borderRadius' && radiusKeys.includes(a as never)) ||
      (a === 'borderWidth' && widthKeys.includes(b as never)) ||
      (b === 'borderWidth' && widthKeys.includes(a as never)))
  )
}
export function livePaintChanges(property: string): readonly string[] {
  if (property === 'borderRadius') return radiusKeys
  if (property === 'borderWidth') return widthKeys
  if (property === 'borderColor')
    return ['borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor']
  return [property]
}
export function validateLivePaint(view: View, property: string) {
  if (!isLivePaint(property)) return
  if (isColorProperty(property)) validateColorTarget(view, property)
  if (property === 'color') {
    if ((view as View & { formattedText?: unknown }).formattedText)
      throw new TypeError(
        'Live text color requires plain Label/Button text; formatted spans retain their own colors.',
      )
    return
  }
  if (view.backgroundImage)
    throw new TypeError(
      'Live paint bindings require a solid background without an image or gradient.',
    )
  if (view.style.clipPath || view.style.cornerShape === 'squircle')
    throw new TypeError('Live paint requires circular corners without a clipPath.')
  if (
    property !== 'backgroundColor' &&
    property !== 'borderColor' &&
    view.boxShadow &&
    (!Array.isArray(view.boxShadow) || view.boxShadow.length)
  )
    throw new TypeError(
      'Live paint requires a separate shadow surface; CSS boxShadow caches its geometry.',
    )
  for (const key of liveEdges) dip(view[key])
}
export function livePaintConfig(view: View) {
  return JSON.stringify({
    background:
      view.backgroundColor instanceof Color
        ? view.backgroundColor.argb >>> 0
        : view.backgroundColor
          ? new Color(view.backgroundColor).argb >>> 0
          : 0,
    colors: [
      'borderTopColor',
      'borderRightColor',
      'borderBottomColor',
      'borderLeftColor',
    ].map(
      (key) =>
        ((view as unknown as Record<string, { argb: number }>)[key]?.argb ??
          0xff000000) >>> 0,
    ),
    radii: radiusKeys.map((key) => dip(view[key])),
    widths: widthKeys.map((key) => dip(view[key])),
  })
}
