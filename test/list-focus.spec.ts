import { afterEach, expect, it, vi } from 'vitest'
import type { View } from '@nativescript/core'
import { captureListFocus } from '../src/list-focus.js'

vi.mock('@nativescript/core', async (original) => ({
  ...(await original<object>()),
  isIOS: false,
  isAndroid: true,
}))

class NativeView {
  accessibilityFocused = false
  children: NativeView[] = []
  parent?: NativeView
  performAccessibilityAction = vi.fn()
  add(child: NativeView) {
    child.parent = this
    this.children.push(child)
    return child
  }
  isAccessibilityFocused() {
    return this.accessibilityFocused
  }
  isFocused() {
    return false
  }
  getChildCount() {
    return this.children.length
  }
  getChildAt(index: number) {
    return this.children[index]
  }
  getParent() {
    return this.parent
  }
  getRootView(): NativeView {
    return this.parent?.getRootView() ?? this
  }
}
const target = (native: NativeView) =>
  ({ nativeViewProtected: native, isLoaded: true }) as unknown as View
function scene() {
  vi.stubGlobal('android', {
    view: {
      accessibility: { AccessibilityNodeInfo: { ACTION_ACCESSIBILITY_FOCUS: 64 } },
    },
  })
  const root = new NativeView(),
    list = root.add(new NativeView()),
    row = list.add(new NativeView()),
    control = row.add(new NativeView()),
    outside = root.add(new NativeView())
  control.accessibilityFocused = true
  const restore = captureListFocus(target(list), [{ key: 'first', target: target(row) }])
  control.accessibilityFocused = false
  const replacement = new NativeView(),
    replacementControl = replacement.add(new NativeView())
  list.children = []
  list.add(replacement)
  return {
    outside,
    replacementControl,
    restore: () => restore([{ key: 'first', target: target(replacement) }]),
  }
}
afterEach(() => vi.unstubAllGlobals())

it('restores Android accessibility focus to the same key and descendant after recycling', () => {
  const s = scene()
  s.restore()
  expect(s.replacementControl.performAccessibilityAction).toHaveBeenCalledWith(64, null)
})

it('does not steal Android accessibility focus after the user leaves the list', () => {
  const s = scene()
  s.outside.accessibilityFocused = true
  s.restore()
  expect(s.replacementControl.performAccessibilityAction).not.toHaveBeenCalled()
})
