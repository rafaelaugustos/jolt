import { Application, ListView, Trace, type View } from '@nativescript/core'
import { onReducedMotion, reducedMotion } from '../config.js'
import { coreListAdapter } from './list-view.js'
import { itemKeys, moveAt, sameKeys } from './model.js'
import type {
  Reorder,
  ReorderAdapter,
  ReorderAdapterDriver,
  ReorderCancelReason,
  ReorderKey,
  ReorderNativeEvent,
  ReorderOptions,
} from './types.js'

export { coreListAdapter }
export { ReorderHandle } from './handle.js'
export { ReorderSurface } from './surface.js'
export type * from './types.js'

const owners = new WeakMap<View, { dispose(): void }>()
function report(callback: () => void) {
  try {
    callback()
  } catch (error) {
    Trace.write(
      `Jolt reorder callback failed: ${String(error)}`,
      Trace.categories.Error,
      Trace.messageType.error,
    )
  }
}

/** Reorder a flat, vertical Core ListView, or an explicitly supported adapter. */
export function reorder<T, K extends ReorderKey = ReorderKey>(
  source: ListView | ReorderAdapter<T>,
  options: ReorderOptions<T, K>,
): Reorder<K> {
  if (
    !options ||
    typeof options.key !== 'function' ||
    typeof options.onCommit !== 'function'
  )
    throw new TypeError('reorder() requires key(item) and onCommit(move).')
  const adapter = source instanceof ListView ? coreListAdapter<T>(source) : source
  if (
    !adapter?.view ||
    typeof adapter.items !== 'function' ||
    typeof adapter.subscribe !== 'function' ||
    typeof adapter.attach !== 'function'
  )
    throw new TypeError('Provide a Core ListView or a ReorderAdapter.')
  for (const callback of [options.onStart, options.onCancel])
    if (callback !== undefined && typeof callback !== 'function')
      throw new TypeError('Reorder callbacks must be functions.')
  if (
    options.handle !== undefined &&
    typeof options.handle !== 'string' &&
    typeof options.handle !== 'function'
  )
    throw new TypeError('The reorder handle must be a view id or resolver.')
  const longPress = options.longPress ?? 350,
    edgeSize = options.edge?.size ?? 72,
    edgeSpeed = options.edge?.speed ?? 640
  if (!Number.isFinite(longPress) || longPress < 150 || longPress > 2000)
    throw new RangeError('Reorder longPress must be between 150 and 2000 ms.')
  if (![edgeSize, edgeSpeed].every((value) => Number.isFinite(value) && value > 0))
    throw new RangeError('Reorder edge size and speed must be positive finite numbers.')

  const view = adapter.view
  let keys = itemKeys(adapter.items(), options.key)
  owners.get(view)?.dispose()
  let driver: ReorderAdapterDriver | undefined,
    active: { key: K; index: number; keys: K[] } | undefined,
    disposed = false,
    paused = false
  const read = () => itemKeys(adapter.items(), options.key)

  function cancel(reason: ReorderCancelReason) {
    const previous = active
    active = undefined
    driver?.cancel()
    if (previous) report(() => options.onCancel?.({ key: previous.key, reason }))
  }
  function refresh() {
    if (disposed) return
    let next: K[]
    try {
      next = read()
    } catch (error) {
      cancel('data-changed')
      throw error
    }
    if (active) cancel(next.includes(active.key) ? 'data-changed' : 'removed')
    keys = next
  }
  function event(event: ReorderNativeEvent) {
    if (disposed || paused) return
    if (event.type === 'start') {
      keys = read()
      const key = keys[event.index]
      if (key === undefined) {
        driver?.cancel()
        return
      }
      active = { key, index: event.index, keys: [...keys] }
      report(() => options.onStart?.(key))
    } else if (event.type === 'cancel') {
      cancel(event.geometryChanged ? 'geometry-changed' : 'cancelled')
    } else {
      const previous = active
      if (!previous) return
      const next = read()
      if (!sameKeys(previous.keys, next) || event.index !== previous.index) {
        cancel(next.includes(previous.key) ? 'data-changed' : 'removed')
        keys = next
        return
      }
      const move = moveAt(previous.keys, previous.index, event.toIndex)
      active = undefined
      if (move) report(() => options.onCommit(move))
      else report(() => options.onCancel?.({ key: previous.key, reason: 'unchanged' }))
      keys = read()
    }
  }
  function moveTo(key: K, toIndex: number): boolean {
    if (disposed || paused) return false
    cancel('cancelled')
    keys = read()
    const move = moveAt(keys, keys.indexOf(key), toIndex)
    if (!move) return false
    report(() => options.onCommit(move))
    keys = read()
    return true
  }
  function attach() {
    if (disposed || driver || !view.isLoaded) return
    keys = read()
    driver = adapter.attach({
      handle: options.handle,
      longPress,
      edgeSize,
      edgeSpeed,
      reducedMotion: reducedMotion(),
      accessibility: {
        moveUp: options.accessibility?.moveUp ?? 'Move up',
        moveDown: options.accessibility?.moveDown ?? 'Move down',
      },
      event: (input) => {
        try {
          event(input)
        } catch (error) {
          cancel('data-changed')
          report(() => {
            throw error
          })
        }
      },
      move: (index, direction) => {
        keys = read()
        const key = keys[index]
        return key !== undefined && moveTo(key, index + direction) ? key : undefined
      },
      keyAt: (index) => keys[index],
      indexOf: (key) => {
        try {
          return read().indexOf(key as K)
        } catch {
          return -1
        }
      },
    })
    driver.setEnabled(!paused)
  }
  function unload() {
    cancel('unloaded')
    driver?.dispose()
    driver = undefined
  }
  const suspend = () => cancel('cancelled')
  const releaseItems = adapter.subscribe(refresh)
  const releaseReduced = onReducedMotion((value) => driver?.setReducedMotion(value))
  const result: Reorder<K> = {
    get activeKey() {
      return active?.key
    },
    get disposed() {
      return disposed
    },
    move(key, beforeKey) {
      if (disposed || paused) return false
      const current = read(),
        from = current.indexOf(key)
      if (from < 0 || beforeKey === key) return false
      const before = beforeKey === null ? current.length : current.indexOf(beforeKey)
      return before < 0 ? false : moveTo(key, before > from ? before - 1 : before)
    },
    moveUp(key) {
      if (disposed || paused) return false
      return moveTo(key, read().indexOf(key) - 1)
    },
    moveDown(key) {
      if (disposed || paused) return false
      return moveTo(key, read().indexOf(key) + 1)
    },
    cancel: () => cancel('cancelled'),
    refresh,
    pause() {
      paused = true
      cancel('disabled')
      driver?.setEnabled(false)
    },
    play() {
      if (!disposed) {
        paused = false
        driver?.setEnabled(true)
      }
    },
    dispose() {
      if (disposed) return
      cancel('disposed')
      disposed = true
      driver?.dispose()
      driver = undefined
      releaseItems()
      releaseReduced()
      view.off('loaded', attach)
      view.off('unloaded', unload)
      Application.off(Application.suspendEvent, suspend)
      if (owners.get(view) === result) owners.delete(view)
    },
  }
  owners.set(view, result)
  view.on('loaded', attach)
  view.on('unloaded', unload)
  Application.on(Application.suspendEvent, suspend)
  try {
    attach()
  } catch (error) {
    result.dispose()
    throw error
  }
  return result
}
