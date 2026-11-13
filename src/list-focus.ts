import { isIOS, type View } from '@nativescript/core'
/** Preserve semantic row identity, including a descendant path, across native cell recycling. */
export function captureListFocus<K>(
  list: View,
  rows: readonly { key: K; target: View }[],
) {
  const host = list.nativeViewProtected
  const accessible = isIOS ? UIAccessibilityFocusedElement(null) : undefined
  type Saved = { key: K; path: number[]; accessibility: boolean; native: any }
  let saved: Saved | undefined
  function find(
    native: any,
    path: number[],
  ): { path: number[]; accessibility: boolean; native: any } | undefined {
    if (isIOS ? native === accessible : native.isAccessibilityFocused())
      return { path, accessibility: true, native }
    if (isIOS ? native.isFirstResponder : native.isFocused())
      return { path, accessibility: false, native }
    const count = isIOS
      ? native.subviews.count
      : typeof native.getChildCount === 'function'
        ? native.getChildCount()
        : 0
    for (let i = 0; i < count; i++) {
      const child = isIOS ? native.subviews.objectAtIndex(i) : native.getChildAt(i),
        found = find(child, [...path, i])
      if (found) return found
    }
  }
  for (const row of rows) {
    const focused = find(row.target.nativeViewProtected, [])
    if (focused) {
      saved = { key: row.key, ...focused }
      break
    }
  }
  return (next: readonly { key: K; target: View }[]) => {
    if (!saved || !list.isLoaded) return
    const row = next.find((row) => row.key === saved!.key)
    if (!row) return // Removed/off-screen keys do not steal focus from the current control.
    let native = row.target.nativeViewProtected
    for (const index of saved.path) {
      const count = isIOS
        ? native.subviews.count
        : typeof native.getChildCount === 'function'
          ? native.getChildCount()
          : 0
      if (index >= count) return
      native = isIOS ? native.subviews.objectAtIndex(index) : native.getChildAt(index)
    }
    if (isIOS) {
      if (saved.accessibility) {
        const current = UIAccessibilityFocusedElement(null)
        if (
          current &&
          current !== saved.native &&
          current instanceof UIView &&
          !current.isDescendantOfView(host)
        )
          return
        UIAccessibilityPostNotification(UIAccessibilityLayoutChangedNotification, native)
      } else {
        const responder = (view: UIView): UIView | undefined => {
          if (view.isFirstResponder) return view
          for (let i = 0; i < view.subviews.count; i++) {
            const found = responder(view.subviews.objectAtIndex(i))
            if (found) return found
          }
        }
        const current = host.window ? responder(host.window) : undefined
        if (current && current !== saved.native && !current.isDescendantOfView(host))
          return
        native.becomeFirstResponder()
      }
    } else if (saved.accessibility)
      native.performAccessibilityAction(
        android.view.accessibility.AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS,
        null,
      )
    else {
      const current = host.getRootView().findFocus()
      if (current && current !== saved.native && current !== host) return
      native.requestFocus()
    }
    saved = undefined
  }
}
