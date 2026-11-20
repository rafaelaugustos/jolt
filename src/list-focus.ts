import { Application, isIOS, type View } from '@nativescript/core'
/** Preserve semantic row identity, including a descendant path, across native cell recycling. */
export function captureListFocus<K>(
  list: View,
  rows: readonly { key: K; target: View }[],
) {
  const host = list.nativeViewProtected
  const accessible = isIOS ? UIAccessibilityFocusedElement(null) : undefined
  type Saved = { key: K; path: number[]; accessibility: boolean; native: any }
  let saved: Saved | undefined
  let restoredNative: any
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
  const restore = (next: readonly { key: K; target: View }[]) => {
    if (!saved || !list.isLoaded) return
    const row = next.find((row) => row.key === saved!.key)
    if (!row) {
      saved = undefined // Removed/off-screen keys do not force a focus jump.
      return
    }
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
        ) {
          saved = undefined
          return
        }
        UIAccessibilityPostNotification(UIAccessibilityLayoutChangedNotification, native)
        // Posting is asynchronous. Keep one logical identity while the controller
        // lives, so an immediate next reload cannot capture a stale recycled key.
        restoredNative = native
        return
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
    } else if (saved.accessibility) {
      const focused = (view: any): any => {
        if (view.isAccessibilityFocused()) return view
        const count = typeof view.getChildCount === 'function' ? view.getChildCount() : 0
        for (let i = 0; i < count; i++) {
          const current = focused(view.getChildAt(i))
          if (current) return current
        }
      }
      const current = focused(host.getRootView())
      if (current && current !== saved.native) {
        let ancestor = current
        while (ancestor && ancestor !== host) ancestor = ancestor.getParent?.()
        if (ancestor !== host) return
      }
      native.performAccessibilityAction(
        android.view.accessibility.AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS,
        null,
      )
    } else {
      const current = host.getRootView().findFocus()
      if (current && current !== saved.native && current !== host) return
      native.requestFocus()
    }
    saved = undefined
  }
  return Object.assign(restore, {
    accessibility: !!saved?.accessibility,
    isCurrent: () => {
      if (!saved || !isIOS) return false
      const current = UIAccessibilityFocusedElement(null)
      if (restoredNative && current === restoredNative) {
        saved.native = restoredNative
        restoredNative = undefined
      }
      return current === saved.native
    },
  })
}

/** iOS updates its accessibility cache while recycled rows move. Restore once
 * after motion settles, and carry the original key through superseding updates
 * while the reader still points at the same recycled native element. */
export function listFocusAfterMotion<K>(
  list: View,
  rows: () => readonly { key: K; target: View }[],
) {
  let pending: ReturnType<typeof captureListFocus<K>> | undefined
  let generation = 0
  let moving = false
  return {
    capture() {
      const current = UIAccessibilityFocusedElement(null)
      const interrupted =
        moving &&
        pending &&
        current instanceof UIView &&
        current.isDescendantOfView(list.nativeViewProtected)
      if (!pending?.isCurrent() && !interrupted) {
        const next = captureListFocus(list, rows())
        pending = next.accessibility ? next : undefined
      }
      const token = ++generation
      moving = true
      return () => {
        if (token !== generation) return
        if (!pending) {
          moving = false
          return
        }
        NSOperationQueue.mainQueue.addOperationWithBlock(() => {
          if (token !== generation) return
          moving = false
          if (!list.isLoaded || Application.suspended) {
            pending = undefined
            return
          }
          pending?.(rows())
        })
      }
    },
    dispose() {
      generation++
      moving = false
      pending = undefined
    },
  }
}
