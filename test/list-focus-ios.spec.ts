import { afterEach, expect, it, vi } from 'vitest'
import { Application, type View } from '@nativescript/core'
import { listFocusAfterMotion } from '../src/list-focus.js'

vi.mock('@nativescript/core', async (original) => ({
  ...(await original<object>()),
  isIOS: true,
  isAndroid: false,
}))

class NativeView {
  children: NativeView[] = []
  parent?: NativeView
  isFirstResponder = false
  get subviews() {
    return { count: this.children.length, objectAtIndex: (i: number) => this.children[i] }
  }
  add(child: NativeView) {
    child.parent = this
    this.children.push(child)
    return child
  }
  isDescendantOfView(host: NativeView): boolean {
    return this === host || !!this.parent?.isDescendantOfView(host)
  }
}
const target = (nativeViewProtected: NativeView) =>
  ({ nativeViewProtected, isLoaded: true }) as unknown as View

function scene() {
  const root = new NativeView(),
    host = root.add(new NativeView()),
    original = host.add(new NativeView()),
    originalLabel = original.add(new NativeView()),
    outside = root.add(new NativeView())
  let focused = originalLabel
  let rows = [{ key: 1, target: target(original) }]
  const list = target(host),
    queue: (() => void)[] = []
  vi.stubGlobal('UIView', NativeView)
  vi.stubGlobal('UIAccessibilityFocusedElement', () => focused)
  vi.stubGlobal('UIAccessibilityLayoutChangedNotification', 1001)
  const post = vi.fn((_kind, next) => {
    focused = next
  })
  vi.stubGlobal('UIAccessibilityPostNotification', post)
  vi.stubGlobal('NSOperationQueue', {
    mainQueue: { addOperationWithBlock: (run: () => void) => queue.push(run) },
  })
  const focus = listFocusAfterMotion(list, () => rows)
  const replacement = host.add(new NativeView()),
    replacementLabel = replacement.add(new NativeView())
  return {
    focus,
    post,
    list,
    outside,
    replacementLabel,
    host,
    setFocused(value: NativeView) {
      focused = value
    },
    rebind() {
      rows = [
        { key: 8, target: target(original) },
        { key: 1, target: target(replacement) },
      ]
    },
    remove() {
      rows = [{ key: 8, target: target(original) }]
    },
    flush() {
      queue.splice(0).forEach((run) => run())
    },
  }
}
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('restores a moved iOS descendant only after settlement and the native queue boundary', () => {
  const s = scene(),
    settled = s.focus.capture()
  s.rebind()
  s.flush()
  expect(s.post).not.toHaveBeenCalled()
  settled()
  expect(s.post).not.toHaveBeenCalled()
  s.flush()
  expect(s.post).toHaveBeenCalledExactlyOnceWith(1001, s.replacementLabel)
})
it('keeps the original key through interrupted reloads and ignores stale completions', () => {
  const s = scene(),
    first = s.focus.capture()
  s.rebind() // The original focused native label is now key 8.
  first()
  const second = s.focus.capture()
  s.flush()
  expect(s.post).not.toHaveBeenCalled()
  first()
  second()
  s.flush()
  expect(s.post).toHaveBeenCalledExactlyOnceWith(1001, s.replacementLabel)
})
it('retains the logical key until an asynchronous native focus request takes effect', () => {
  const s = scene(),
    first = s.focus.capture()
  s.rebind()
  s.post.mockImplementation(() => {}) // UIKit has not acknowledged the request yet.
  first()
  s.flush()
  const next = s.focus.capture()
  next()
  s.flush()
  expect(s.post.mock.calls.map((call) => call[1])).toEqual([
    s.replacementLabel,
    s.replacementLabel,
  ])
})
it('preserves the key when UICollectionView automatically selects another cell during an interrupted reload', () => {
  const s = scene(),
    first = s.focus.capture()
  s.rebind()
  s.setFocused(s.host.add(new NativeView()))
  const second = s.focus.capture()
  first()
  second()
  s.flush()
  expect(s.post).toHaveBeenCalledExactlyOnceWith(1001, s.replacementLabel)
})
it.each(['outside', 'removed', 'unloaded', 'disposed', 'background'] as const)(
  'does not restore stale focus after %s',
  (reason) => {
    const s = scene(),
      settled = s.focus.capture()
    s.rebind()
    settled()
    if (reason === 'outside') s.setFocused(s.outside)
    if (reason === 'removed') s.remove()
    if (reason === 'unloaded') Object.assign(s.list, { isLoaded: false })
    if (reason === 'disposed') s.focus.dispose()
    if (reason === 'background')
      vi.spyOn(Application, 'suspended', 'get').mockReturnValue(true)
    s.flush()
    expect(s.post).not.toHaveBeenCalled()
  },
)
