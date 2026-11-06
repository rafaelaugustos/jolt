import { isIOS, type View } from '@nativescript/core'

export interface PointerInput {
  refresh(): void
  dispose(): void
}
export type PointerChange = (
  x: number,
  y: number,
  width: number,
  height: number,
  active: boolean,
) => void

/** Observational input only. Each delivered hover event crosses into JavaScript. */
export function pointerInput(
  view: View,
  change: PointerChange,
): PointerInput | undefined {
  if (isIOS) {
    if (typeof JoltPointerInput === 'undefined')
      throw new Error('Rebuild the iOS app to install pointer input.')
    return (
      JoltPointerInput.attachChange(view.nativeViewProtected as UIView, change) ??
      undefined
    )
  }
  const native = view.nativeViewProtected as android.view.View
  let context = native.getContext()
  while (
    !(context instanceof android.app.Activity) &&
    context instanceof android.content.ContextWrapper
  ) {
    const base = context.getBaseContext()
    if (base === context) break
    context = base
  }
  if (!(context instanceof android.app.Activity)) return undefined
  return new org.rafaelaugusto.jolt.PointerInput(
    context,
    native,
    new org.rafaelaugusto.jolt.PointerInput.Listener({ onPoint: change }),
  )
}
