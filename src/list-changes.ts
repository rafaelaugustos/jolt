import { captureListFocus } from './list-focus.js'
import {
  Application,
  ListView,
  Length,
  Utils,
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
import { animate, prepareAnimation, toView } from './animate.js'
import { getDriver } from './driver/index.js'
import { propertyRevision } from './engine.js'
import { readValue, writeValue, type NumericProperty } from './properties.js'
import { interactionSurface } from './interaction-surface.js'
import { captureExit, requireExitCapture } from './layout-exit.js'
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
  /** Set a fixed positive ListView rowHeight in DIPs, or use its existing loaded value. */
  rowHeight?: number
  move?: SpringName | Omit<LayoutOptions, 'enter' | 'exit' | 'size' | 'maxSnapshotPixels'>
}
const owners = new WeakMap<ListView, ListChanges<unknown>>()
/** Flat fixed-height Core ListView. All data commits must go through update(). */
export function listChanges<T, K extends ReorderKey = ReorderKey>(
  target: Target,
  options: ListChangesOptions<T, K>,
): ListChanges<T> {
  const list = toView(target)
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
    if (!Number.isFinite(options.rowHeight) || options.rowHeight <= 0)
      throw new RangeError(
        'listChanges needs a fixed positive ListView rowHeight in DIPs.',
      )
    list.rowHeight = options.rowHeight
  }
  // Core coerces rowHeight to auto until the native view is attached. Validate the
  // effective height at the data commit, after its density-dependent coercion.
  const fixedRowHeight = () => {
    if (list.rowHeight === 'auto') {
      // Core iOS can leave a value assigned before native creation coerced to auto.
      // Reapply its saved requested value through Core's own coercion hook.
      ;(
        list as ListView & { updateEffectiveRowHeight(): void }
      ).updateEffectiveRowHeight()
    }
    const height = Utils.layout.toDeviceIndependentPixels(
      Length.toDevicePixels(list.rowHeight, -1),
    )
    if (!Number.isFinite(height) || height <= 0)
      throw new RangeError(
        'listChanges needs a loaded ListView with fixed positive rowHeight.',
      )
    return height
  }
  if (list.isLoaded) fixedRowHeight()
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
    render(items) {
      list.items = [...items]
    },
    anchor(keys) {
      if (!list.isLoaded || !keys.length) return () => {}
      restoreFocus = undefined
      const focus = captureListFocus(list, rows())
      const native = list.nativeViewProtected,
        rowHeight = fixedRowHeight()
      let index: number, local: number
      if (isIOS) {
        index = Math.max(
          0,
          Math.min(
            keys.length - 1,
            Math.floor(
              (native.contentOffset.y + native.adjustedContentInset.top) / rowHeight,
            ),
          ),
        )
        local =
          native.contentOffset.y + native.adjustedContentInset.top - index * rowHeight
      } else {
        index = native.getFirstVisiblePosition()
        const first = native.getChildAt(0)
        local = first
          ? (native.getPaddingTop() - first.getTop()) /
            native.getResources().getDisplayMetrics().density
          : 0
      }
      const key = keys[index]
      return (next) => {
        if (!list.isLoaded) return
        restoreFocus = () => focus(rows())
        const found = next.indexOf(key!),
          destination = found < 0 ? Math.min(index, Math.max(0, next.length - 1)) : found
        if (isIOS) {
          native.layoutIfNeeded()
          const maximum = Math.max(
            -native.adjustedContentInset.top,
            native.contentSize.height -
              native.bounds.size.height +
              native.adjustedContentInset.bottom,
          )
          native.setContentOffsetAnimated(
            CGPointMake(
              native.contentOffset.x,
              Math.min(
                maximum,
                destination * rowHeight + local - native.adjustedContentInset.top,
              ),
            ),
            false,
          )
        } else {
          const density = native.getResources().getDisplayMetrics().density
          native.setSelectionFromTop(destination, Math.round(-local * density))
        }
      }
    },
    capture(view, budget) {
      const copy = captureExit(view, budget)
      return copy
        ? {
            pixels: copy.pixels(),
            play: (exit) => copy.play(exit, transition),
            dispose: copy.dispose,
          }
        : undefined
    },
    move(view, x, y, enter) {
      const properties: NumericProperty[] = enter ? ['x', 'y', 'opacity'] : ['x', 'y']
      const rest = new Map(
        properties.map((property) => [property, readValue(view, property)]),
      )
      const surface = interactionSurface(view)
      let animation: ReturnType<typeof animate>
      try {
        animation = animate(
          view,
          {
            x: [rest.get('x')! + x, rest.get('x')!],
            y: [rest.get('y')! + y, rest.get('y')!],
            ...(enter ? { opacity: [0, rest.get('opacity')!] } : {}),
          },
          transition,
        )
      } finally {
        surface.dispose()
      }
      const tokens = new Map(
        properties.map((property) => [property, propertyRevision(view, property)]),
      )
      let ended = false
      return {
        animation,
        dispose() {
          if (ended) return
          ended = true
          const owned = properties.filter(
            (property) => propertyRevision(view, property) === tokens.get(property),
          )
          animation.stop()
          for (const property of owned)
            if (propertyRevision(view, property) === tokens.get(property))
              writeValue(view, property, rest.get(property)!)
          getDriver().sync?.(view)
        },
      }
    },
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
