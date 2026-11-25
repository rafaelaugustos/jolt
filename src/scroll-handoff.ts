import { ListView, ScrollView, View } from '@nativescript/core'

/** A native scroller port. Its adapter owns offset, limits, delta consumption and release velocity. */
export interface ScrollHandoffAdapter {
  readonly view: View
  readonly axis: 'x' | 'y'
}
export type ScrollHandoffSource = ScrollView | ScrollHandoffAdapter

/** Core lists, Core ScrollView and regular community CollectionView layouts use the same native port. */
export function scrollHandoff(
  view: View,
  options: { axis?: 'x' | 'y' } = {},
): ScrollHandoffAdapter {
  if (!(view instanceof View)) throw new TypeError('Scroll handoff needs a native view.')
  const axis =
    options.axis ??
    (view instanceof ScrollView && view.orientation === 'horizontal' ? 'x' : 'y')
  if (!['x', 'y'].includes(axis))
    throw new TypeError('Scroll handoff axis must be x or y.')
  if (
    view instanceof ScrollView &&
    (view.orientation === 'horizontal') !== (axis === 'x')
  )
    throw new TypeError('Scroll handoff axis must match its ScrollView.')
  if (view instanceof ListView && axis !== 'y')
    throw new TypeError('Core ListView is vertical.')
  const plugin = view as View & {
    computeSpanCount?(): number
    orientation?: string
    reverseLayout?: boolean
    layoutStyle?: string
    spanSize?: unknown
  }
  if (plugin.computeSpanCount) {
    const spans = plugin.computeSpanCount()
    if (
      !Number.isInteger(spans) ||
      spans < 1 ||
      (spans > 1 && (axis !== 'y' || plugin.spanSize)) ||
      plugin.reverseLayout ||
      (plugin.orientation === 'horizontal') !== (axis === 'x') ||
      plugin.layoutStyle !== 'grid'
    )
      throw new TypeError(
        'CollectionView handoff needs a matching forward linear or regular vertical grid layout.',
      )
  }
  // Custom/plugin native widget validation occurs on attachment, after native creation.
  return Object.freeze({ view, axis })
}
export function handoffSource(
  source?: ScrollHandoffSource,
): ScrollHandoffAdapter | undefined {
  if (!source) return undefined
  if (source instanceof ScrollView) return scrollHandoff(source)
  if (!(source.view instanceof View) || !['x', 'y'].includes(source.axis))
    throw new TypeError('Provide a ScrollView or a scrollHandoff adapter.')
  return scrollHandoff(source.view, { axis: source.axis })
}
