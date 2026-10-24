import { GridLayout, isAndroid } from '@nativescript/core'

/** Android dispatch boundary: owns the drag after the source cell is recycled. */
export class ReorderSurface extends GridLayout {
  override createNativeView(): ReturnType<GridLayout['createNativeView']> {
    return isAndroid
      ? new org.rafaelaugusto.jolt.ReorderSurface(this._context)
      : super.createNativeView()
  }
}
