import { View } from '@nativescript/core'
export class NativeMapDemo extends View {
  map: any
  marker: any
  whenReady(callback: () => void): void
}
export class NativeSceneDemo extends View {
  camera: any
}
