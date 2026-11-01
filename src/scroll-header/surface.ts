import { GridLayout, isAndroid } from '@nativescript/core'

/** Native Android pull recognition above the list; retains Core layout and touch listeners. */
export class ScrollHeaderSurface extends GridLayout {
  override createNativeView(): ReturnType<GridLayout['createNativeView']> {
    if (!isAndroid) return super.createNativeView()
    if (typeof org.rafaelaugusto.jolt.ScrollHeaderSurface !== 'function')
      throw new Error('Rebuild the native app to use ScrollHeaderSurface.')
    return new org.rafaelaugusto.jolt.ScrollHeaderSurface(this._context)
  }
}
