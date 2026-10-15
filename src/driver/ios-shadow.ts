import type { View } from '@nativescript/core'

type BackgroundView = { _redrawNativeBackground?: (...args: unknown[]) => void }
const repairs = new WeakSet<View>()

/** Core treats alpha 0 as 1. Repair its model layer after background redraws,
 * not on animation frames. The wrapper belongs only to this view and is
 * removed when the shadow color changes. */
export function preserveZeroShadow(view: View) {
  const target = view as unknown as BackgroundView
  const hasZero = () =>
    Array.isArray(view.boxShadow) &&
    view.boxShadow.some((shadow) => shadow.color.argb >>> 24 === 0)
  if (!hasZero() || repairs.has(view)) return
  const descriptor = Object.getOwnPropertyDescriptor(view, '_redrawNativeBackground')
  const original = target._redrawNativeBackground
  const apply = () => {
    if (!hasZero()) return dispose()
    if (!view.isLoaded) return
    const layers = view.nativeViewProtected?.outerShadowContainerLayer?.sublayers as
      NSArray<CALayer> | undefined
    if (!layers || !Array.isArray(view.boxShadow)) return
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    for (let i = 0; i < Math.min(layers.count, view.boxShadow.length); i++)
      if (view.boxShadow[i]!.color.argb >>> 24 === 0)
        layers.objectAtIndex(i).shadowOpacity = 0
    CATransaction.commit()
  }
  const redraw = function (this: BackgroundView, ...args: unknown[]) {
    original!.apply(this, args)
    apply()
  }
  const dispose = () => {
    view.style.off('boxShadowChange', apply)
    view.off('loaded', apply)
    view.off('layoutChanged', apply)
    if (original && target._redrawNativeBackground === redraw) {
      if (descriptor) Object.defineProperty(view, '_redrawNativeBackground', descriptor)
      else delete target._redrawNativeBackground
    }
    repairs.delete(view)
  }
  repairs.add(view)
  if (original) target._redrawNativeBackground = redraw
  view.style.on('boxShadowChange', apply)
  view.on('loaded', apply)
  view.on('layoutChanged', apply)
  apply()
}
