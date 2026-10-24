import {
  Application,
  Screen,
  Utils,
  isIOS,
  type ScrollView,
  type View,
} from '@nativescript/core'

function firstResponder(view: UIView): UIView | undefined {
  if (view.isFirstResponder) return view
  for (let i = 0; i < view.subviews.count; i++) {
    const found = firstResponder(view.subviews.objectAtIndex(i))
    if (found) return found
  }
  return undefined
}

export function windowHeight(view: View): number {
  if (isIOS)
    return (
      (view.nativeViewProtected as UIView)?.window?.bounds.size.height ??
      Screen.mainScreen.heightDIPs
    )
  const activity =
    Application.android.foregroundActivity ?? Application.android.startActivity
  if (android.os.Build.VERSION.SDK_INT >= 30 && activity)
    return (
      activity.getWindowManager().getCurrentWindowMetrics().getBounds().height() /
      Utils.layout.getDisplayDensity()
    )
  return Screen.mainScreen.heightDIPs
}

export function captureFocus(panel: View, returnFocus?: View): () => void {
  if (returnFocus)
    return () => {
      if (!returnFocus.isLoaded) return
      returnFocus.focus()
      returnFocus.accessibilityScreenChanged()
    }
  if (isIOS) {
    const window = (panel.nativeViewProtected as UIView)?.window
    const responder = window ? firstResponder(window) : undefined
    const accessible = UIAccessibilityFocusedElement(null)
    return () => {
      if (responder?.window) responder.becomeFirstResponder()
      UIAccessibilityPostNotification(
        UIAccessibilityLayoutChangedNotification,
        accessible ?? responder ?? null,
      )
    }
  }
  const activity =
    Application.android.foregroundActivity ?? Application.android.startActivity
  const previous = activity?.getCurrentFocus()
  return () => {
    if (previous?.isAttachedToWindow()) {
      previous.requestFocus()
      previous.sendAccessibilityEvent(
        android.view.accessibility.AccessibilityEvent.TYPE_VIEW_FOCUSED,
      )
    }
  }
}

export function revealFocusedField(panel: View, scroll?: ScrollView): void {
  if (!scroll?.nativeViewProtected || !panel.nativeViewProtected) return
  if (isIOS) {
    const focused = firstResponder(panel.nativeViewProtected as UIView)
    const native = scroll.nativeViewProtected as UIScrollView
    if (focused?.isDescendantOfView(native))
      native.scrollRectToVisibleAnimated(
        focused.convertRectToView(focused.bounds, native),
        false,
      )
  } else {
    const focused = (panel.nativeViewProtected as android.view.View).findFocus()
    if (focused)
      focused.requestRectangleOnScreen(
        new android.graphics.Rect(0, 0, focused.getWidth(), focused.getHeight()),
        true,
      )
  }
}

export function dismissKeyboard(panel: View): void {
  if (!panel.nativeViewProtected) return
  if (isIOS) (panel.nativeViewProtected as UIView).endEditing(true)
  else {
    const focused = (panel.nativeViewProtected as android.view.View).findFocus()
    if (focused) {
      const manager = focused
        .getContext()
        .getSystemService(
          android.content.Context.INPUT_METHOD_SERVICE,
        ) as android.view.inputmethod.InputMethodManager
      manager.hideSoftInputFromWindow(focused.getWindowToken(), 0)
      focused.clearFocus()
    }
  }
}

/** Add only our actions; preserve an application's existing native accessibility actions. */
export function sheetActions(
  handle: View,
  actions: readonly { label: string; run(): void }[],
): () => void {
  if (isIOS) {
    const native = handle.nativeViewProtected as UIView
    const previous = native.accessibilityCustomActions
    const own = actions.map(({ label, run }) =>
      UIAccessibilityCustomAction.alloc().initWithNameActionHandler(label, () => {
        run()
        return true
      }),
    )
    const existing: UIAccessibilityCustomAction[] = []
    if (previous)
      for (let i = 0; i < previous.count; i++) existing.push(previous.objectAtIndex(i))
    native.accessibilityCustomActions = NSArray.arrayWithArray([...existing, ...own])
    return () => {
      const current = native.accessibilityCustomActions
      const retained: UIAccessibilityCustomAction[] = []
      if (current)
        for (let i = 0; i < current.count; i++) {
          const action = current.objectAtIndex(i)
          if (!own.includes(action)) retained.push(action)
        }
      native.accessibilityCustomActions = retained.length
        ? NSArray.arrayWithArray(retained)
        : null
    }
  }
  const native = handle.nativeViewProtected as android.view.View
  const compat = androidx.core.view.ViewCompat
  const ids: number[] = []
  let ended = false,
    timer: ReturnType<typeof setTimeout> | undefined
  // Core batches accessibility-style updates in a microtask and installs its delegate.
  // Wrap that delegate afterwards, retaining its semantics and all existing actions.
  const repair = () => {
    if (ended || handle.nativeViewProtected !== native) return
    compat.setAccessibilityDelegate(
      native,
      compat.getAccessibilityDelegate(native) ??
        new androidx.core.view.AccessibilityDelegateCompat(),
    )
    if (ids.length) return
    const node = native.createAccessibilityNodeInfo(),
      existing = node.getActionList()
    const used = new Set<number>()
    for (let index = 0; index < existing.size(); index++)
      used.add(existing.get(index).getId())
    node.recycle()
    const resources = native.getResources(),
      packageName = native.getContext().getPackageName()
    const available: number[] = []
    for (let index = 0; index < 32; index++) {
      const id = resources.getIdentifier(
        `accessibility_custom_action_${index}`,
        'id',
        packageName,
      )
      if (id && !used.has(id)) available.push(id)
    }
    if (available.length < actions.length)
      throw new Error(
        'Not enough free Android accessibility actions for the sheet handle.',
      )
    for (let index = 0; index < actions.length; index++) {
      const { label, run } = actions[index]!,
        id = available[index]!
      const action =
        new androidx.core.view.accessibility.AccessibilityNodeInfoCompat.AccessibilityActionCompat(
          id,
          label,
        )
      compat.replaceAccessibilityAction(
        native,
        action,
        label,
        new androidx.core.view.accessibility.AccessibilityViewCommand({
          perform: () => {
            run()
            return true
          },
        }),
      )
      ids.push(id)
    }
  }
  const schedule = () => {
    if (ended || timer !== undefined) return
    timer = setTimeout(() => {
      timer = undefined
      repair()
    }, 0)
  }
  const changes = [
    'accessibleChange',
    'accessibilityRoleChange',
    'accessibilityStateChange',
    'accessibilityMediaSessionChange',
  ]
  for (const event of changes) handle.style.on(event, schedule)
  schedule()
  return () => {
    ended = true
    if (timer !== undefined) clearTimeout(timer)
    for (const event of changes) handle.style.off(event, schedule)
    ids.forEach((id) => compat.removeAccessibilityAction(native, id))
  }
}
