import { LayoutBase, ScrollView, View, isIOS, Trace } from '@nativescript/core'
import { sheetActions } from '../bottom-sheet/native.js'
import { getDriver } from '../driver/index.js'
import { ReorderHandle } from './handle.js'
import type { ReorderAdapter, ReorderKey, ReorderOptions } from './types.js'

export interface RealizedReorderItem<K extends ReorderKey = ReorderKey> {
  key: K
  target: View
  handle?: View
}
export interface RealizedReorderOptions<K extends ReorderKey = ReorderKey> extends Omit<
  ReorderOptions<RealizedReorderItem<K>, K>,
  'key' | 'handle'
> {
  items(): readonly RealizedReorderItem<K>[]
  /** Defaults to the closest Core ScrollView ancestor. */
  scroll?: ScrollView
}
function descendant(view: View, parent: View) {
  for (let current: View['parent'] = view; current; current = current.parent)
    if (current === parent) return true
  return false
}

export function realizedRowsAdapter<K extends ReorderKey>(
  container: LayoutBase,
  options: Pick<RealizedReorderOptions<K>, 'items' | 'scroll'>,
): ReorderAdapter<RealizedReorderItem<K>> {
  if (
    !(container instanceof LayoutBase) ||
    !options ||
    typeof options.items !== 'function'
  )
    throw new TypeError('Realized reorder requires a LayoutBase and items().')
  let scroll = options.scroll
  if (!scroll)
    for (let parent = container.parent; parent; parent = parent.parent)
      if (parent instanceof ScrollView) {
        scroll = parent
        break
      }
  if (
    !(scroll instanceof ScrollView) ||
    scroll.orientation !== 'vertical' ||
    !descendant(container, scroll)
  )
    throw new TypeError('Realized reorder requires a vertical Core ScrollView ancestor.')
  const source = scroll
  const read = () => {
    const rows = [...options.items()]
    if (rows.length > 100 || new Set(rows.map((row) => row.target)).size !== rows.length)
      throw new TypeError('Realized reorder supports at most 100 distinct retained rows.')
    for (const row of rows)
      if (
        !(row.target instanceof View) ||
        !descendant(row.target, container) ||
        (row.handle &&
          (!(row.handle instanceof View) || !descendant(row.handle, row.target)))
      )
        throw new TypeError(
          'Rows must be descendants of the container, with optional descendant handles.',
        )
    return rows
  }
  read()
  return {
    view: container,
    items: read,
    subscribe(changed) {
      let ended = false,
        queued = false
      const notify = () => {
        if (ended || queued) return
        queued = true
        void Promise.resolve().then(() => {
          queued = false
          if (!ended)
            try {
              changed()
            } catch (error) {
              Trace.write(String(error), 'Jolt', Trace.messageType.error)
            }
        })
      }
      container.on('layoutChanged', notify)
      return () => {
        ended = true
        container.off('layoutChanged', notify)
      }
    },
    attach(config) {
      if (!source.isLoaded || !container.isLoaded)
        throw new Error('Mount the ScrollView before attaching reorder input.')
      let ended = false,
        queued = false
      let activeKey: ReorderKey | undefined
      let layoutRelease: (() => void) | undefined
      let focusGeneration = 0
      let refreshRelease: (() => void) | undefined
      const releases: (() => void)[] = []
      let native: {
        setEnabled(value: boolean): void
        setReducedMotion(value: boolean): void
        cancel(): void
        dispose(): void
      }
      const focus = (key: ReorderKey, accessible: boolean) => {
        const generation = ++focusGeneration
        layoutRelease?.()
        // Resolve the identity after the host renderer reconciles its children.
        void Promise.resolve().then(() => {
          if (ended || generation !== focusGeneration) return
          layoutRelease = getDriver().afterLayout?.(container, () => {
            layoutRelease = undefined
            if (ended) return
            const row = read().find((row) => row.key === key)
            const handle = row?.handle ?? row?.target
            if (!row || !handle?.isLoaded) return
            const location = row.target.getLocationRelativeTo(source)
            if (location) {
              const height = row.target.getActualSize().height,
                viewport = source.getActualSize().height
              if (location.y < 0)
                source.scrollToVerticalOffset(source.verticalOffset + location.y, false)
              else if (location.y + height > viewport)
                source.scrollToVerticalOffset(
                  source.verticalOffset + location.y + height - viewport,
                  false,
                )
            }
            handle.focus()
            if (accessible) handle.accessibilityScreenChanged()
          })
          container.requestLayout()
        })
      }
      const event = (state: number, index: number, destination: number) => {
        if (ended) return
        if (state === 1) {
          activeKey = config.keyAt(index)
          config.event({ type: 'start', index })
        } else if (state === 2) {
          const key = activeKey
          activeKey = undefined
          config.event({ type: 'commit', index, toIndex: destination })
          refresh()
          if (key !== undefined) focus(key, false)
        } else {
          activeKey = undefined
          config.event({ type: 'cancel', geometryChanged: destination === 1 })
        }
      }
      const settings = JSON.stringify({
        longPress: config.longPress,
        edgeSize: config.edgeSize,
        edgeSpeed: config.edgeSpeed,
        reducedMotion: config.reducedMotion,
      })
      if (isIOS) {
        if (typeof JoltRealizedReorder === 'undefined')
          throw new Error('Rebuild the native application for realized-row reorder.')
        native = JoltRealizedReorder.attachContainerOptionsOnState(
          source.nativeViewProtected,
          container.nativeViewProtected,
          settings,
          event,
        )
      } else {
        if (typeof org.rafaelaugusto.jolt.RealizedReorder === 'undefined')
          throw new Error('Rebuild the native application for realized-row reorder.')
        native = new org.rafaelaugusto.jolt.RealizedReorder(
          source.nativeViewProtected,
          container.nativeViewProtected,
          settings,
          new org.rafaelaugusto.jolt.RealizedReorder.Listener({ onState: event }),
        )
      }
      function update() {
        if (ended) return
        const rows = read()
        const positions = rows.map((row) => row.target.getLocationRelativeTo(container))
        if (
          rows.some(
            (row, i) =>
              !row.target.isLoaded ||
              !row.target.nativeViewProtected ||
              !positions[i] ||
              row.target.getActualSize().height <= 0,
          )
        )
          throw new Error('Wait for realized reorder rows to finish layout.')
        if (
          rows.some(
            (row, i) =>
              i > 0 &&
              positions[i]!.y <
                positions[i - 1]!.y + rows[i - 1]!.target.getActualSize().height - 0.5,
          )
        )
          throw new TypeError(
            'Realized reorder rows must be vertical, ordered and nonoverlapping.',
          )
        const handles = rows.map((row) => row.handle ?? row.target)
        if (isIOS)
          (native as JoltRealizedReorder).setRowsHandles(
            NSArray.arrayWithArray(rows.map((row) => row.target.nativeViewProtected)),
            NSArray.arrayWithArray(handles.map((view) => view.nativeViewProtected)),
          )
        else {
          const views = Array.create('android.view.View', rows.length),
            targets = Array.create('android.view.View', rows.length)
          rows.forEach((row, i) => {
            views[i] = row.target.nativeViewProtected
            targets[i] = handles[i]!.nativeViewProtected
          })
          ;(native as org.rafaelaugusto.jolt.RealizedReorder).setRows(views, targets)
        }
        for (const release of releases.splice(0)) release()
        rows.forEach((row, index) => {
          const handle = handles[index]!
          const move = (direction: -1 | 1, accessible: boolean) => {
            const current = config.indexOf(row.key)
            if (current < 0) return
            const key = config.move(current, direction)
            if (key !== undefined) {
              refresh()
              focus(key, accessible)
            }
          }
          releases.push(
            sheetActions(handle, [
              { label: config.accessibility.moveUp, run: () => move(-1, true) },
              { label: config.accessibility.moveDown, run: () => move(1, true) },
            ]),
          )
          if (handle instanceof ReorderHandle) {
            if (isIOS) {
              const button = handle.nativeViewProtected as JoltReorderHandle
              const callback = (direction: number) => move(direction < 0 ? -1 : 1, false)
              button.onMove = callback
              releases.push(() => {
                if (button.onMove === callback) button.onMove = null
              })
            } else {
              const button =
                handle.nativeViewProtected as org.rafaelaugusto.jolt.ReorderHandle
              button.setMoveListener(
                new org.rafaelaugusto.jolt.ReorderHandle.MoveListener({
                  move: (direction) => move(direction < 0 ? -1 : 1, false),
                }),
              )
              releases.push(() => button.setMoveListener(null))
            }
          }
        })
      }
      function refresh(movedKey?: ReorderKey) {
        if (!ended && movedKey !== undefined) focus(movedKey, false)
        if (ended || queued) return
        queued = true
        void Promise.resolve().then(() => {
          if (ended) return
          // A keyed host move can recreate Android native views without changing
          // the container's bounds. Resolve those views after renderer layout.
          const complete = () => {
            refreshRelease = undefined
            queued = false
            if (!ended)
              try {
                update()
              } catch (error) {
                native.cancel()
                Trace.write(String(error), 'Jolt', Trace.messageType.error)
              }
          }
          refreshRelease = getDriver().afterLayout?.(container, complete)
          if (refreshRelease) container.requestLayout()
          else complete()
        })
      }
      const result = {
        refresh,
        cancel: () => native.cancel(),
        setEnabled: (value: boolean) => native.setEnabled(value),
        setReducedMotion: (value: boolean) => native.setReducedMotion(value),
        dispose() {
          if (ended) return
          ended = true
          layoutRelease?.()
          refreshRelease?.()
          for (const release of releases.splice(0)) release()
          native.dispose()
        },
      }
      try {
        update()
        return result
      } catch (error) {
        result.dispose()
        throw error
      }
    },
  }
}
