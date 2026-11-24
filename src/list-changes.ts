import { nativeListEffects } from './list-changes-effects.js'
import { adapterListChanges, type NativeListAdapter } from './list-adapter.js'
export type { NativeListAdapter } from './list-adapter.js'
import { captureListFocus, listFocusAfterMotion } from './list-focus.js'
import {
  Application,
  ListView,
  isIOS,
  type EventData,
  type ItemEventData,
  type View,
} from '@nativescript/core'
import {
  createListChanges,
  type ListChanges,
  type ListChangesOptions as CommonOptions,
} from './core/list-changes.js'
import type { ReorderKey } from './core/reorder.js'
import { prepareAnimation, toView } from './animate.js'
import { getDriver } from './driver/index.js'
import { requireExitCapture } from './layout-exit.js'
import { onReducedMotion, reducedMotion } from './config.js'
import { layoutExit } from './core/layout-exit.js'
import { springs, type SpringName } from './transition.js'
import type { LayoutOptions } from './layout.js'
import type { Target } from './types.js'

export type { ListChanges } from './core/list-changes.js'
export interface ListChangesOptions<
  T,
  K extends ReorderKey = ReorderKey,
> extends CommonOptions<T, K> {
  /** Explicit plugin adapter; Core ListView retains its built-in implementation. */
  adapter?: NativeListAdapter<T>
  /** Set a fixed height in DIPs, request measured rows with 'auto', or keep the list's existing sizing. */
  rowHeight?: number | 'auto'
  move?: SpringName | Omit<LayoutOptions, 'enter' | 'exit' | 'size' | 'maxSnapshotPixels'>
}
const owners = new WeakMap<ListView, ListChanges<unknown>>()
/** Flat Core ListView with fixed or measured rows. All data commits must go through update(). */
export function listChanges<T, K extends ReorderKey = ReorderKey>(
  target: Target,
  options: ListChangesOptions<T, K>,
): ListChanges<T> {
  const list = toView(target)
  if (options.adapter) return adapterListChanges(list, options, options.adapter)
  if (
    !(list instanceof ListView) ||
    list.sectioned ||
    list.stickyHeader ||
    list.showSearch
  )
    throw new TypeError(
      'listChanges supports flat Core ListView without built-in headers or search.',
    )
  if (owners.has(list))
    throw new Error('This ListView already has a listChanges controller.')
  if (options.rowHeight !== undefined) {
    if (
      options.rowHeight !== 'auto' &&
      (!Number.isFinite(options.rowHeight) || options.rowHeight <= 0)
    )
      throw new RangeError(
        'listChanges needs auto or a positive ListView rowHeight in DIPs.',
      )
    list.rowHeight = options.rowHeight
  }
  const transition =
    typeof options.move === 'string'
      ? springs[options.move]
      : (options.move ?? springs.snappy)
  if (!transition) throw new TypeError('Unknown list move spring.')
  prepareAnimation(list, { x: [0, 1], y: [0, 1], opacity: [0, 1] }, transition)
  const exit = layoutExit(options.exit)
  if (exit && !reducedMotion()) requireExitCapture()
  const data = (): T[] => {
    const items = list.items
    return Array.from({ length: items?.length ?? 0 }, (_, i) =>
      Array.isArray(items) ? items[i] : items.getItem(i),
    )
  }
  const rowTargets = new WeakMap<View, View>()
  const rows = () => {
    const current = data(),
      keys = new Map(current.map((item) => [item, options.key(item)])),
      result: { key: K; target: View; x: number; y: number }[] = []
    list.eachChildView((view) => {
      if (!view.isLoaded || !view.nativeViewProtected) return true
      // Core wraps Label/Proxy/margin templates in a native StackLayout.
      let keyed: View | undefined = keys.has(view.bindingContext as T) ? view : undefined
      if (!keyed)
        view.eachChildView((child) => {
          if (keys.has(child.bindingContext as T)) {
            keyed = child
            return false
          }
          return true
        })
      if (!keyed) return true
      const key = keys.get(keyed.bindingContext as T)!
      rowTargets.set(keyed, view)
      const native = view.nativeViewProtected,
        host = list.nativeViewProtected
      let x: number, y: number
      if (isIOS) {
        const layer = native.layer.presentationLayer() ?? native.layer
        const point = layer.convertPointToLayer(
          CGPointMake(0, 0),
          host.layer.presentationLayer() ?? host.layer,
        )
        // UIScrollView's layer coordinates include its nonzero bounds origin.
        // Normalize to the viewport before visibility filtering and FLIP deltas.
        const origin = (host.layer.presentationLayer() ?? host.layer).bounds.origin
        x = point.x - origin.x
        y = point.y - origin.y
      } else {
        const origin = Array.create('int', 2),
          local = Array.create('int', 2),
          density = native.getResources().getDisplayMetrics().density
        host.getLocationOnScreen(origin)
        native.getLocationOnScreen(local)
        x = (local[0]! - origin[0]!) / density
        y = (local[1]! - origin[1]!) / density
      }
      const height = view.getActualSize().height,
        viewport = list.getActualSize().height
      if (height > 0 && y + height > 0 && y < viewport)
        result.push({ key, target: view, x, y })
      return true
    })
    if (new Set(result.map((row) => row.key)).size !== result.length)
      throw new Error('Realized ListView keys must be unique.')
    return result
  }
  let restoreFocus: (() => void) | undefined
  const focusAfterMotion = listFocusAfterMotion(list, rows)
  const layout = (callback: () => void) => {
    if (!list.isLoaded) {
      void Promise.resolve().then(callback)
      return () => {}
    }
    const complete = () => {
      const focus = restoreFocus
      restoreFocus = undefined
      focus?.()
      callback()
    }
    // UITableView commits/reuses cells independently of NativeScript View.layout.
    // A main-loop boundary plus layoutIfNeeded covers reload and anchor relocation.
    if (isIOS)
      return getDriver().after(0, () => {
        if (!list.isLoaded) return
        list.nativeViewProtected.layoutIfNeeded()
        complete()
      })
    const release = getDriver().afterLayout?.(list, () => {
      complete()
    })
    if (!release) throw new Error('The native driver must support layout boundaries.')
    list.requestLayout()
    return release
  }
  let result: ListChanges<T>
  result = createListChanges(options, {
    items: data,
    rows,
    layout,
    reduced: reducedMotion,
    captureFocus: isIOS ? () => focusAfterMotion.capture() : undefined,
    render(items) {
      list.items = [...items]
    },
    anchor(keys) {
      if (!list.isLoaded || !keys.length) return () => {}
      restoreFocus = undefined
      const focus = captureListFocus(list, rows())
      const native = list.nativeViewProtected
      const visible: { key: K; index: number; local: number }[] = []
      if (isIOS) {
        const top = native.contentOffset.y + native.adjustedContentInset.top
        const paths = native.indexPathsForVisibleRows
        for (let i = 0; i < (paths?.count ?? 0); i++) {
          const path = paths.objectAtIndex(i),
            rect = native.rectForRowAtIndexPath(path)
          if (rect.origin.y + rect.size.height > top && keys[path.row] !== undefined)
            visible.push({
              key: keys[path.row]!,
              index: path.row,
              local: top - rect.origin.y,
            })
        }
        visible.sort((a, b) => a.index - b.index)
      } else {
        const first = native.getFirstVisiblePosition(),
          density = native.getResources().getDisplayMetrics().density
        for (let i = 0; i < native.getChildCount(); i++) {
          const index = first + i,
            child = native.getChildAt(i)
          if (child && keys[index] !== undefined)
            visible.push({
              key: keys[index]!,
              index,
              local: (native.getPaddingTop() - child.getTop()) / density,
            })
        }
      }
      if (!visible.length) return () => {}
      return (next) => {
        if (!list.isLoaded || !next.length) return
        restoreFocus = () => {
          if (!isIOS || !focus.accessibility) focus(rows())
        }
        const positions = new Map(next.map((key, index) => [key, index]))
        const anchor = visible.find((row) => positions.has(row.key)) ?? visible[0]!
        const local = anchor.local,
          destination =
            positions.get(anchor.key) ?? Math.min(anchor.index, next.length - 1)
        if (isIOS) {
          native.layoutIfNeeded()
          const path = NSIndexPath.indexPathForRowInSection(destination, 0)
          if (!native.cellForRowAtIndexPath(path)) {
            native.scrollToRowAtIndexPathAtScrollPositionAnimated(
              path,
              1 /* UITableViewScrollPositionTop */,
              false,
            )
            native.layoutIfNeeded()
          }
          const start = native.rectForRowAtIndexPath(path).origin.y
          const minimum = -native.adjustedContentInset.top
          const maximum = Math.max(
            -native.adjustedContentInset.top,
            native.contentSize.height -
              native.bounds.size.height +
              native.adjustedContentInset.bottom,
          )
          native.setContentOffsetAnimated(
            CGPointMake(
              native.contentOffset.x,
              Math.min(maximum, Math.max(minimum, start + local + minimum)),
            ),
            false,
          )
        } else {
          const density = native.getResources().getDisplayMetrics().density
          native.setSelectionFromTop(destination, Math.round(-local * density))
        }
      }
    },
    ...nativeListEffects(transition),
    observe(events) {
      const recycled = (event: EventData) => {
        const { view } = event as ItemEventData
        if (view) events.recycle(rowTargets.get(view) ?? view)
      }
      const preference = onReducedMotion((value) => {
        if (value) events.stop()
      })
      list.on(ListView.itemLoadingEvent, recycled)
      list.on('unloaded', events.dispose)
      Application.on(Application.suspendEvent, events.stop)
      return () => {
        restoreFocus = undefined
        focusAfterMotion.dispose()
        preference()
        list.off(ListView.itemLoadingEvent, recycled)
        list.off('unloaded', events.dispose)
        Application.off(Application.suspendEvent, events.stop)
        if (owners.get(list) === result) owners.delete(list)
      }
    },
  })
  owners.set(list, result)
  return result
}
