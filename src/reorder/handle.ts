import { Button, isIOS } from '@nativescript/core'

/** Focusable native handle: Alt/Option + ↑/↓ moves its current item. */
export class ReorderHandle extends Button {
  override createNativeView() {
    if (isIOS) return JoltReorderHandle.new()
    return new org.rafaelaugusto.jolt.ReorderHandle(this._context)
  }
}
