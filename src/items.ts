import { ListView, View, type EventData, type ItemEventData } from '@nativescript/core'
import { animate, endingValues, startingValues, toView } from './animate.js'
import { getDriver } from './driver/index.js'
import { stopView } from './engine.js'
import type { PresetName } from './presets.js'
import { writeValue } from './properties.js'
import type { SpringName } from './transition.js'
import type { AnimateOptions, Keyframes, Target } from './types.js'

export type ItemsOptions = AnimateOptions & {
  /** Animate each data item only the first time it shows up. Defaults to false. */
  once?: boolean
}

interface Pending {
  index: number
  section: number | undefined
  item: unknown
  key: string
}

type Row = View & {
  bindingContext?: unknown
  _listViewItemIndex?: number
  _listViewSectionIndex?: number
}

interface Source extends View {
  items?: unknown
  _getDataItem?(index: number): unknown
  _getDataItemInSection?(section: number, index: number): unknown
}

/**
 * Plays an animation on each row of a list as it comes on screen. Rows are
 * recycled, so a row that is reused for another item starts over, or settles
 * at the end values when that item was already shown and `once` is set.
 * Returns a function that removes the effect.
 *
 * ```ts
 * animateItems(listView, 'fadeInUp')
 * animateItems(listView, 'fadeInUp', { once: true })
 * ```
 */
export function animateItems(
  list: Target,
  animation: Keyframes | PresetName,
  options?: ItemsOptions | SpringName,
): () => void {
  const source = toView(list) as Source
  const { once = false, ...rest } = typeof options === 'object' ? options : {}
  if (rest.stagger !== undefined)
    throw new TypeError('animateItems animates one row at a time; stagger has no effect.')
  const transition: AnimateOptions | SpringName | undefined =
    typeof options === 'string' ? options : rest
  const properties = [...startingValues(animation, transition).keys()]
  const ends = endingValues(animation, transition)

  const rows = new Set<Row>()
  const seenItems = new WeakSet<object>()
  const seenKeys = new Set<string>()
  const pending: Pending[] = []
  let queued = false
  let disposed = false

  const settle = (row: Row) => {
    stopView(row, properties)
    for (const [property, value] of ends)
      if (value !== null) writeValue(row, property, value)
    getDriver().sync?.(row)
  }
  const show = (row: Row, { item, key }: Pending) => {
    rows.add(row)
    const tracked = typeof item === 'object' && item !== null
    const seen = tracked ? seenItems.has(item) : seenKeys.has(key)
    if (tracked) seenItems.add(item)
    else seenKeys.add(key)
    if (once && seen) settle(row)
    else {
      stopView(row, properties)
      animate(row, animation, transition)
    }
  }
  const flush = () => {
    queued = false
    if (disposed) return
    const current = new Set<Row>()
    const fresh: Row[] = []
    source.eachChildView((child: Row) => {
      current.add(child)
      if (!rows.has(child)) fresh.push(child)
      return true
    })
    for (const row of rows) if (!current.has(row)) rows.delete(row)
    for (const entry of pending.splice(0)) {
      const row =
        fresh.find(
          (candidate) =>
            candidate._listViewItemIndex === entry.index &&
            candidate._listViewSectionIndex === entry.section,
        ) ??
        fresh.find(
          (candidate) =>
            entry.item !== undefined && candidate.bindingContext === entry.item,
        )
      if (!row) continue
      fresh.splice(fresh.indexOf(row), 1)
      show(row, entry)
    }
  }
  const onItemLoading = (event: EventData) => {
    const { index, section, view } = event as ItemEventData
    const item =
      section === undefined
        ? source._getDataItem?.(index)
        : source._getDataItemInSection?.(section, index)
    const entry: Pending = { index, section, item, key: `${section ?? ''}:${index}` }
    if (view instanceof View) {
      show(view, entry)
      return
    }
    pending.push(entry)
    if (queued) return
    queued = true
    void Promise.resolve().then(flush)
  }
  const cleanup = () => {
    if (disposed) return
    disposed = true
    source.off(ListView.itemLoadingEvent, onItemLoading)
    source.off('unloaded', cleanup)
    pending.length = 0
    for (const row of rows) settle(row)
    rows.clear()
  }

  source.on(ListView.itemLoadingEvent, onItemLoading)
  source.on('unloaded', cleanup)
  return cleanup
}
