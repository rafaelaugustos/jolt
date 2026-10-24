import type { View } from '@nativescript/core'

export function captureTheme(view: View) {
  const native = view.nativeViewProtected as UIView | undefined
  const parent = native?.superview
  if (!native?.window || !parent) return
  const snapshot = native.snapshotViewAfterScreenUpdates(false)
  if (!snapshot) return
  snapshot.frame = native.frame
  snapshot.userInteractionEnabled = false
  snapshot.accessibilityElementsHidden = true
  // Cover the old frame while Vue applies the new palette. Once Jolt has installed
  // its circular mask, this old frame becomes the backdrop under the live content.
  parent.insertSubviewAboveSubview(snapshot, native)
  return {
    revealNewContent() {
      if (native.superview === parent) parent.insertSubviewBelowSubview(snapshot, native)
    },
    dispose() {
      snapshot.removeFromSuperview()
    },
  }
}
