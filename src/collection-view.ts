import { View, isIOS, type ItemsSource, type EventData } from '@nativescript/core'
import { getDriver } from './driver/index.js'
import type { NativeListAdapter } from './list-adapter.js'
import { recycledListAdapter, type RecycledListView } from './reorder/list-view.js'
import type { ReorderAdapter, ReorderKey } from './reorder/types.js'

/** Structural public API of @nativescript-community/ui-collectionview 6.1.x. No eager plugin import. */
interface Collection extends RecycledListView {
  orientation: string
  reverseLayout: boolean
  reorderEnabled: boolean
  computeSpanCount(): number
  findFirstVisibleItemIndex(): number
  findLastVisibleItemIndex(): number
  getViewForItemAtIndex(index: number): View | undefined
}
function collection(view: View): Collection {
  const result = view as Collection
  if (
    !(view instanceof View) ||
    ![
      'computeSpanCount',
      'findFirstVisibleItemIndex',
      'findLastVisibleItemIndex',
      'getViewForItemAtIndex',
      'refresh',
    ].every((key) => typeof result[key as keyof Collection] === 'function')
  )
    throw new TypeError('Expected a community CollectionView (supported: 6.1.x).')
  validate(result)
  return result
}
function validate(view: Collection) {
  if (
    view.orientation !== 'vertical' ||
    view.reverseLayout ||
    view.computeSpanCount() !== 1
  )
    throw new TypeError(
      'Collection motion supports flat vertical lists with one span, without reverse layout.',
    )
  if (view.reorderEnabled)
    throw new TypeError(
      'Disable CollectionView reorderEnabled before attaching Jolt motion.',
    )
}
function items<T>(view: Collection): readonly T[] {
  const source = view.items as T[] | ItemsSource
  return Array.from({ length: source?.length ?? 0 }, (_, index) =>
    Array.isArray(source) ? source[index]! : (source.getItem(index) as T),
  )
}
function layout(view: Collection, callback: () => void) {
  if (!view.isLoaded) throw new Error('Mount CollectionView before updating its motion.')
  if (isIOS)
    return getDriver().after(0, () => {
      if (!view.isLoaded) return
      view.nativeViewProtected.layoutIfNeeded()
      callback()
    })
  const release = getDriver().afterLayout?.(view, callback)
  if (!release) throw new Error('Collection motion needs native layout boundaries.')
  view.requestLayout()
  return release
}
const claims = new WeakMap<View, { count: number; animator: unknown; native: any }>()
function claim(view: Collection) {
  validate(view)
  if (!view.isLoaded || !view.nativeViewProtected)
    throw new Error('Mount CollectionView before attaching motion.')
  if (isIOS) return () => {}
  let state = claims.get(view)
  if (!state) {
    const native = view.nativeViewProtected
    const manager = native.getLayoutManager?.()
    if (
      !manager ||
      !manager.findFirstVisibleItemPosition ||
      manager.getOrientation() !== 1 ||
      (manager.getSpanCount?.() ?? 1) !== 1
    )
      throw new TypeError('Collection motion requires a vertical native linear layout.')
    state = { count: 0, animator: native.getItemAnimator(), native }
    native.setItemAnimator(null)
    claims.set(view, state)
  }
  state.count++
  let ended = false
  return () => {
    if (ended) return
    ended = true
    if (--state.count === 0) {
      if (state.native.getItemAnimator() === null)
        state.native.setItemAnimator(state.animator)
      if (claims.get(view) === state) claims.delete(view)
    }
  }
}
function reveal(view: Collection, index: number) {
  const target = view.getViewForItemAtIndex(index)
  const position = target?.getLocationRelativeTo(view)
  if (
    !target ||
    !position ||
    position.y < 0 ||
    position.y + target.getActualSize().height > view.getActualSize().height
  )
    view.scrollToIndex(index)
}

/** Ready adapter for keyed structural mutations; all application changes go through listChanges.update. */
export function collectionViewListAdapter<T>(target: View): NativeListAdapter<T> {
  const view = collection(target)
  return {
    view,
    items: () => {
      validate(view)
      return items<T>(view)
    },
    render(next) {
      validate(view)
      view.items = [...next]
    },
    rows() {
      const data = items<T>(view)
      const rows: { item: T; target: View }[] = []
      const first = Math.max(0, view.findFirstVisibleItemIndex())
      const last = Math.min(data.length - 1, view.findLastVisibleItemIndex())
      for (let index = first; index <= last; index++) {
        const row = view.getViewForItemAtIndex(index)
        if (row?.isLoaded) rows.push({ item: data[index]!, target: row })
      }
      return rows
    },
    layout: (callback) => layout(view, callback),
    anchor<K extends ReorderKey>(keys: readonly K[]) {
      const index = Math.max(0, view.findFirstVisibleItemIndex()),
        key = keys[index]
      const native = view.nativeViewProtected
      let inset = 0
      if (isIOS) {
        const attributes = native.layoutAttributesForItemAtIndexPath(
          NSIndexPath.indexPathForItemInSection(index, 0),
        )
        if (attributes)
          inset =
            attributes.frame.origin.y -
            native.contentOffset.y -
            native.adjustedContentInset.top
      } else {
        const manager = native.getLayoutManager(),
          row = manager.findViewByPosition(index)
        if (row) inset = manager.getDecoratedTop(row) - native.getPaddingTop()
      }
      return (next: readonly K[]) => {
        if (!view.isLoaded || !next.length) return
        const found = next.indexOf(key!),
          destination = found < 0 ? Math.min(index, next.length - 1) : found
        if (isIOS) {
          native.layoutIfNeeded()
          const attributes = native.layoutAttributesForItemAtIndexPath(
            NSIndexPath.indexPathForItemInSection(destination, 0),
          )
          if (!attributes) return
          const minimum = -native.adjustedContentInset.top
          const maximum = Math.max(
            minimum,
            native.contentSize.height -
              native.bounds.size.height +
              native.adjustedContentInset.bottom,
          )
          native.setContentOffsetAnimated(
            CGPointMake(
              native.contentOffset.x,
              Math.max(
                minimum,
                Math.min(
                  maximum,
                  attributes.frame.origin.y - inset - native.adjustedContentInset.top,
                ),
              ),
            ),
            false,
          )
        } else
          native
            .getLayoutManager()
            .scrollToPositionWithOffset(destination, Math.round(inset))
      }
    },
    observeRecycling(recycle) {
      const reset = (event: EventData) => {
        const row = (event as EventData & { view?: View }).view
        // A framework may wrap the template in a retained ContentView.
        for (
          let current = row;
          current && current !== view;
          current = current.parent instanceof View ? current.parent : undefined
        )
          recycle(current)
      }
      for (const name of ['itemLoading', 'itemRecycling', 'itemDisposing'])
        view.on(name, reset)
      return () => {
        for (const name of ['itemLoading', 'itemRecycling', 'itemDisposing'])
          view.off(name, reset)
      }
    },
    claim: () => claim(view),
  }
}

/** Uses the existing native reorder session; Android keeps the list inside a ReorderSurface. */
export function collectionViewReorderAdapter<T>(target: View): ReorderAdapter<T> {
  const view = collection(target)
  return recycledListAdapter(view, {
    collection: true,
    validate: () => validate(view),
    reveal: (index) => reveal(view, index),
    claim: () => claim(view),
  })
}
