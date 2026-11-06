import { View } from '@nativescript/core'
import type { NativeProperty } from '@rafaelaugusto/jolt/native'
export class PortableScene extends View {
  override createNativeView() {
    return new android.view.View(this._context)
  }
  properties(): NativeProperty<number>[] {
    return []
  }
  render(_active: boolean) {}
  redraw() {}
}
