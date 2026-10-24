import {
  ListView,
  isIOS,
  type EventData,
  type ItemEventData,
  type View,
} from '@nativescript/core'
import { sheetActions as viewActions } from '../bottom-sheet/native.js'
import type { ReorderAdapter } from './types.js'
import { ReorderHandle } from './handle.js'

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
      const event = (state: number, index: number, toIndex: number) => {
        if (state === 1) config.event({ type: 'start', index })
        else if (state === 2) config.event({ type: 'commit', index, toIndex })
        else config.event({ type: 'cancel', geometryChanged: toIndex === 1 })
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
        if (typeof org.rafaelaugusto.jolt.ReorderSession === 'undefined')
          throw new Error('Rebuild the native app to use reorder().')
        native = new org.rafaelaugusto.jolt.ReorderSession(
          list.nativeViewProtected,
          options,
          (list as ListView & { touchListener?: android.view.View.OnTouchListener })
            .touchListener ?? null,
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
                run: () => config.move(current.index, -1),
              },
              {
                label: config.accessibility.moveDown,
                run: () => config.move(current.index, 1),
              },
            ])
            let releaseKeys = () => {}
            if (handle instanceof ReorderHandle) {
              const move = (direction: number) =>
                config.move(current.index, direction < 0 ? -1 : 1)
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
      list.on('itemLoading', loaded)
      list.refresh()
      return {
        cancel: () => native.cancel(),
        setEnabled: (value) => native.setEnabled(value),
        setReducedMotion: (value) => native.setReducedMotion(value),
        dispose() {
          if (ended) return
          ended = true
          list.off('itemLoading', loaded)
          for (const row of rows.values()) {
            if (row.timer !== undefined) clearTimeout(row.timer)
            row.release()
          }
          rows.clear()
          native.dispose()
        },
      }
    },
  }
}
