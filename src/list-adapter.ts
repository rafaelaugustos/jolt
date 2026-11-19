import { Application, View, isIOS } from '@nativescript/core'
import { prepareAnimation } from './animate.js'
import { createListChanges, type ListChanges } from './core/list-changes.js'
import type { ReorderKey } from './core/reorder.js'
import { onReducedMotion, reducedMotion } from './config.js'
import { layoutExit } from './core/layout-exit.js'
import { requireExitCapture } from './layout-exit.js'
import { nativeListEffects } from './list-changes-effects.js'
import { springs } from './transition.js'
import type { ListChangesOptions } from './list-changes.js'

export interface NativeListAdapter<T> {
  readonly view: View
  items(): readonly T[]
  render(items: readonly T[]): void
  rows(): readonly { item: T; target: View }[]
  layout(callback: () => void): () => void
  anchor<K extends ReorderKey>(keys: readonly K[]): (next: readonly K[]) => void
  /** Runs synchronously before new content is bound to an old target. */
  observeRecycling(recycle: (target: View) => void): () => void
  /** Optional native animation ownership; released when this controller is disposed. */
  claim?(): () => void
}
const owners = new WeakMap<View, ListChanges<unknown>>()
export function adapterListChanges<T, K extends ReorderKey>(
  view: View,
  options: ListChangesOptions<T, K>,
  adapter: NativeListAdapter<T>,
): ListChanges<T> {
  if (
    adapter.view !== view ||
    !['items', 'render', 'rows', 'layout', 'anchor', 'observeRecycling'].every(
      (key) => typeof adapter[key as keyof NativeListAdapter<T>] === 'function',
    )
  )
    throw new TypeError(
      'Native list adapters must own their target, keyed rows, anchor and recycling lifecycle.',
    )
  if (owners.has(view)) throw new Error('This list already has a listChanges controller.')
  const transition =
    typeof options.move === 'string'
      ? springs[options.move]
      : (options.move ?? springs.snappy)
  if (!transition) throw new TypeError('Unknown list move spring.')
  prepareAnimation(view, { x: [0, 1], y: [0, 1], opacity: [0, 1] }, transition)
  if (layoutExit(options.exit) && !reducedMotion()) requireExitCapture()
  const rows = () => {
    const result = adapter.rows().flatMap(({ item, target }) => {
      if (!target.isLoaded || !target.nativeViewProtected) return []
      let local: { x: number; y: number }
      const native = target.nativeViewProtected,
        host = view.nativeViewProtected
      if (isIOS) {
        const layer = native.layer.presentationLayer() ?? native.layer
        const hostLayer = host.layer.presentationLayer() ?? host.layer
        const point = layer.convertPointToLayer(CGPointMake(0, 0), hostLayer)
        local = {
          x: point.x - hostLayer.bounds.origin.x,
          y: point.y - hostLayer.bounds.origin.y,
        }
      } else {
        const point = Array.create('int', 2),
          origin = Array.create('int', 2)
        native.getLocationOnScreen(point)
        host.getLocationOnScreen(origin)
        const density = native.getResources().getDisplayMetrics().density
        local = {
          x: (point[0]! - origin[0]!) / density,
          y: (point[1]! - origin[1]!) / density,
        }
      }
      const size = target.getActualSize(),
        extent = view.getActualSize()
      if (
        !local ||
        size.height <= 0 ||
        local.y + size.height <= 0 ||
        local.y >= extent.height
      )
        return []
      return [{ key: options.key(item), target, x: local.x, y: local.y }]
    })
    if (
      new Set(result.map((row) => row.key)).size !== result.length ||
      new Set(result.map((row) => row.target)).size !== result.length
    )
      throw new TypeError('Realized list rows must have unique current keys and targets.')
    return result
  }
  let result: ListChanges<T>
  const release = adapter.claim?.() ?? (() => {})
  try {
    result = createListChanges(options, {
      items: () => adapter.items(),
      render: (items) => adapter.render(items),
      rows,
      layout: (callback) => adapter.layout(callback),
      anchor: (keys) => adapter.anchor(keys),
      reduced: reducedMotion,
      ...nativeListEffects(transition),
      observe(events) {
        const recycle = adapter.observeRecycling(events.recycle)
        const preference = onReducedMotion((value) => {
          if (value) events.stop()
        })
        view.on('unloaded', events.dispose)
        Application.on(Application.suspendEvent, events.stop)
        return () => {
          recycle()
          preference()
          release()
          view.off('unloaded', events.dispose)
          Application.off(Application.suspendEvent, events.stop)
          if (owners.get(view) === result) owners.delete(view)
        }
      },
    })
  } catch (error) {
    release()
    throw error
  }
  owners.set(view, result)
  return result
}
