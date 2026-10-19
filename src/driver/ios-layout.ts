import type { View } from '@nativescript/core'

type LayoutView = View & {
  _isTransformed: boolean
  _modifyNativeViewFrame(native: UIView, frame: CGRect): void
}
const retained = new WeakMap<View, { count: number; restore(): void }>()

/**
 * NativeScript caches whether its JS transform is nonidentity. Interactive native
 * playback can move the actual model while that cached destination is identity.
 * Let Core reset/restore the real transform when it next assigns a layout frame.
 * This hook belongs only to the opted-in instance and only while tracks own it.
 */
export function retainInteractiveLayout(view: View): () => void {
  const host = view as LayoutView
  let entry = retained.get(view)
  if (!entry) {
    const original = host._modifyNativeViewFrame
    if (typeof original !== 'function') return () => {}
    const descriptor = Object.getOwnPropertyDescriptor(host, '_modifyNativeViewFrame')
    let active = true
    const wrapper: LayoutView['_modifyNativeViewFrame'] = function (
      this: LayoutView,
      native,
      frame,
    ) {
      if (active)
        this._isTransformed = !CATransform3DEqualToTransform(
          native.layer.transform,
          CATransform3DIdentity,
        )
      original.call(this, native, frame)
    }
    host._modifyNativeViewFrame = wrapper
    entry = {
      count: 0,
      restore() {
        active = false
        const native = host.nativeViewProtected as UIView | undefined
        if (native)
          host._isTransformed = !CATransform3DEqualToTransform(
            native.layer.transform,
            CATransform3DIdentity,
          )
        if (host._modifyNativeViewFrame !== wrapper) return
        if (descriptor) Object.defineProperty(host, '_modifyNativeViewFrame', descriptor)
        else delete (host as Partial<LayoutView>)._modifyNativeViewFrame
      },
    }
    retained.set(view, entry)
  }
  entry.count++
  let released = false
  return () => {
    if (released) return
    released = true
    if (--entry.count === 0) {
      entry.restore()
      retained.delete(view)
    }
  }
}
