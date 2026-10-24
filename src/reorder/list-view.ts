import {
  ListView,
  isIOS,
  type EventData,
  type ItemEventData,
  type View,
} from '@nativescript/core'
import { sheetActions as viewActions } from '../bottom-sheet/native.js'
import type { ReorderAdapter, ReorderKey } from './types.js'
import { ReorderHandle } from './handle.js'
import { ReorderSurface } from './surface.js'

/** Flat Core ListView only. Sectioned lists and plugin collection views need another adapter. */
export function coreListAdapter<T>(list: ListView): ReorderAdapter<T> {
  if (!(list instanceof ListView)) throw new TypeError('Expected a Core ListView.')
  function validate() {
    if (list.sectioned || list.stickyHeader || list.showSearch)
      throw new TypeError(
        'Reorder supports flat Core lists without built-in headers or search.',
      )
  }
  validate()
  return {
    view: list,
    items() {
      validate()
      const source = list.items
      return Array.from({ length: source?.length ?? 0 }, (_, index) =>
        Array.isArray(source) ? source[index] : source.getItem(index),
      ) as T[]
    },
    subscribe(changed) {
      let source:
        | {
            on?(event: string, listener: () => void): void
            off?(event: string, listener: () => void): void
          }
        | undefined
      const replaced = () => {
        source?.off?.('change', changed)
        source = list.items as typeof source
        source?.on?.('change', changed)
        changed()
      }
      list.on('itemsChange', replaced)
      replaced()
      return () => {
        list.off('itemsChange', replaced)
        source?.off?.('change', changed)
      }
    },
    attach(config) {
      validate()
      const options = JSON.stringify({
        longPress: config.longPress,
        edgeSize: config.edgeSize,
        edgeSpeed: config.edgeSpeed,
        reducedMotion: config.reducedMotion,
        handles: config.handle !== undefined,
      })
      let draggedKey: ReorderKey | undefined
      const event = (state: number, index: number, toIndex: number) => {
        if (state === 1) {
          config.event({ type: 'start', index })
          draggedKey = config.keyAt(index)
        } else if (state === 2) {
          const key = draggedKey
          draggedKey = undefined
          config.event({ type: 'commit', index, toIndex })
          if (key !== undefined) focusKey(key, false)
        } else {
          draggedKey = undefined
          config.event({ type: 'cancel', geometryChanged: toIndex === 1 })
        }
      }
      let native: {
        registerHandle(view: any): void
        setEnabled(value: boolean): void
        setReducedMotion(value: boolean): void
        cancel(): void
        dispose(): void
      }
      if (isIOS) {
        if (typeof JoltReorderSession === 'undefined')
          throw new Error('Rebuild the native app to use reorder().')
        native = JoltReorderSession.attachOptionsOnState(
          list.nativeViewProtected,
          options,
          event,
        )
      } else {
        if (
          !(list.parent instanceof ReorderSurface) ||
          list.parent.getChildrenCount() !== 1
        )
          throw new TypeError(
            'On Android, make the Core ListView the only child of a ReorderSurface.',
          )
        if (typeof org.rafaelaugusto.jolt.ReorderSession === 'undefined')
          throw new Error('Rebuild the native app to use reorder().')
        native = new org.rafaelaugusto.jolt.ReorderSession(
          list.parent.nativeViewProtected,
          list.nativeViewProtected,
          options,
          new org.rafaelaugusto.jolt.ReorderSession.Listener({ onState: event }),
        )
      }
      type Row = {
        index: number
        handle?: View
        release(): void
        timer?: ReturnType<typeof setTimeout>
      }
      const rows = new Map<View, Row>()
      let ended = false
      let focusTimer: ReturnType<typeof setTimeout> | undefined
      function moveRow(row: Row, direction: -1 | 1, accessible: boolean) {
        const key = config.move(row.index, direction)
        if (key !== undefined) focusKey(key, accessible)
      }
      function reveal(index: number) {
        // Run once after the app commits and Core rebinds. Estimated iOS heights
        // can move the dropped row outside the viewport during reloadData.
        if (isIOS) {
          const table = list.nativeViewProtected as UITableView
          table.layoutIfNeeded()
          const path = NSIndexPath.indexPathForRowInSection(index, 0)
          const rect = table.rectForRowAtIndexPath(path)
          const top = table.bounds.origin.y + table.adjustedContentInset.top
          const bottom =
            table.bounds.origin.y +
            table.bounds.size.height -
            table.adjustedContentInset.bottom
          // Keep the target away from an edge while UIKit resolves estimated heights.
          if (rect.origin.y < top || rect.origin.y + rect.size.height > bottom)
            table.scrollToRowAtIndexPathAtScrollPositionAnimated(path, 2, false)
        } else {
          const table = list.nativeViewProtected as android.widget.ListView
          const cell = table.getChildAt(index - table.getFirstVisiblePosition())
          if (!cell) list.scrollToIndex(index)
          else {
            const top = cell.getTop() - table.getPaddingTop()
            const bottom = cell.getBottom() - table.getHeight() + table.getPaddingBottom()
            if (top < 0) table.scrollListBy(top)
            else if (bottom > 0) table.scrollListBy(bottom)
          }
        }
      }
      function focusKey(key: ReorderKey, accessible: boolean) {
        if (ended) return
        if (focusTimer !== undefined) clearTimeout(focusTimer)
        let attempts = 0
        const focus = () => {
          focusTimer = undefined
          if (ended) return
          const index = config.indexOf(key)
          if (index < 0) return
          reveal(index)
          const target = [...rows.values()].find(
            (entry) => entry.index === index && entry.handle?.isLoaded,
          )
          if (target?.handle && list.isItemAtIndexVisible(index)) {
            target.handle.focus()
            if (accessible) target.handle.accessibilityScreenChanged()
          } else if (attempts++ < 4) {
            focusTimer = setTimeout(focus, 30)
          }
        }
        // Core lays out recycled rows after Vue flushes its new items.
        focusTimer = setTimeout(focus, 30)
      }
      function loaded(data: EventData) {
        const args = data as ItemEventData
        if (!args.view || ended) return
        const view = args.view
        let row = rows.get(view)
        if (!row) {
          row = { index: args.index, release() {} }
          rows.set(view, row)
        }
        row.index = args.index
        if (row.timer !== undefined) clearTimeout(row.timer)
        const current = row
        // Vue/Core finishes binding and creating native children after itemLoading.
        row.timer = setTimeout(() => {
          current.timer = undefined
          if (ended) return
          const handle =
            typeof config.handle === 'function'
              ? config.handle(view)
              : typeof config.handle === 'string'
                ? view.getViewById<View>(config.handle)
                : view
          if (!handle?.nativeViewProtected) return
          if (current.handle !== handle) {
            current.release()
            current.handle = handle
            const releaseActions = viewActions(handle, [
              {
                label: config.accessibility.moveUp,
                run: () => moveRow(current, -1, true),
              },
              {
                label: config.accessibility.moveDown,
                run: () => moveRow(current, 1, true),
              },
            ])
            let releaseKeys = () => {}
            if (handle instanceof ReorderHandle) {
              const move = (direction: number) =>
                moveRow(current, direction < 0 ? -1 : 1, false)
              if (isIOS) {
                const button = handle.nativeViewProtected as JoltReorderHandle
                button.onMove = move
                releaseKeys = () => {
                  button.onMove = null
                }
              } else {
                const button =
                  handle.nativeViewProtected as org.rafaelaugusto.jolt.ReorderHandle
                button.setMoveListener(
                  new org.rafaelaugusto.jolt.ReorderHandle.MoveListener({ move }),
                )
                releaseKeys = () => button.setMoveListener(null)
              }
            }
            current.release = () => {
              releaseKeys()
              releaseActions()
            }
          }
          native.registerHandle(handle.nativeViewProtected)
        }, 0)
      }
      const driver = {
        cancel: () => native.cancel(),
        setEnabled: (value: boolean) => native.setEnabled(value),
        setReducedMotion: (value: boolean) => native.setReducedMotion(value),
        dispose() {
          if (ended) return
          ended = true
          if (focusTimer !== undefined) clearTimeout(focusTimer)
          list.off('itemLoading', loaded)
          for (const row of rows.values()) {
            if (row.timer !== undefined) clearTimeout(row.timer)
            row.release()
          }
          rows.clear()
          native.dispose()
        },
      }
      list.on('itemLoading', loaded)
      try {
        list.refresh()
      } catch (error) {
        driver.dispose()
        throw error
      }
      return driver
    },
  }
}
