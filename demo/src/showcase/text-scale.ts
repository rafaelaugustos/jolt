import { eachDescendant, isIOS, Label, type View } from '@nativescript/core'

// Retained Android TextViews need their SP size reapplied after the Activity's
// resources change. Let Android perform its native (nonlinear) font conversion.
export function refreshAndroidText(root: View) {
  if (isIOS) return
  eachDescendant(root, (child) => {
    if (child instanceof Label && child.android && typeof child.fontSize === 'number') {
      child.android.setTextSize(child.fontSize)
      child.requestLayout()
    }
    return true
  })
}
