import { View } from '@nativescript/core'
export class NativeLightingDemo extends View {
  createNativeView() {
    const label = new android.widget.TextView(this._context)
    label.setText('SceneKit light and material adapters are available on iOS.')
    return label
  }
}
