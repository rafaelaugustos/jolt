import {
  createListChanges,
  type ListChanges,
  type ListChangesOptions as CommonOptions,
} from '../core/list-changes.js'
import type { ReorderKey } from '../core/reorder.js'
import type { Animation } from '../core/playback.js'
import type { AnimateOptions, SpringName } from './types.js'
import type { FrameScheduler } from './scheduler.js'
import { captureDOMExit } from './layout-exit.js'
import type { ResolvedLayoutExit } from '../core/layout-exit.js'

export type { ListChanges } from '../core/list-changes.js'
export interface WebListAdapter<T, K extends ReorderKey = ReorderKey> {
  items(): readonly T[]
  /** Reconcile keyed DOM synchronously; do not replace surviving nodes. */
  render(items: readonly T[]): void
  rows(): readonly { key: K; target: HTMLElement }[]
  /** Virtualizers must restore their own key/index and intra-row offset. */
  anchor?(keys: readonly K[]): (next: readonly K[]) => void
  /** Notify before a realized element is reused for a different key. Required for virtualizers. */
  observeRecycling?(recycle: (target: HTMLElement) => void): () => void
  virtualized?: boolean
}
export interface WebListChangesOptions<
  T,
  K extends ReorderKey = ReorderKey,
> extends CommonOptions<T, K> {
  adapter: WebListAdapter<T, K>
  move?: AnimateOptions | SpringName
  /** Scrolling viewport, defaulting to the container itself. */
  axis?: 'x' | 'y'
  scroll?: HTMLElement
}
export interface WebListHost {
  scheduler: FrameScheduler
  reduced(): boolean
  preference(callback: () => void): () => void
  animate(
    target: HTMLElement,
    x: number,
    y: number,
    enter: boolean,
  ): { animation: Animation; dispose(): void }
  exit(target: HTMLElement, pose: ResolvedLayoutExit): Animation
  release(target: HTMLElement): void
  forget(): void
}
export function createWebListChanges<T, K extends ReorderKey>(
  container: HTMLElement,
  options: WebListChangesOptions<T, K>,
  host: WebListHost,
): ListChanges<T> {
  const adapter = options.adapter,
    scroll = options.scroll ?? container,
    document = container.ownerDocument,
    view = document.defaultView! as Window & typeof globalThis
  if (
    !adapter ||
    typeof adapter.items !== 'function' ||
    typeof adapter.render !== 'function' ||
    typeof adapter.rows !== 'function'
  )
    throw new TypeError('Web listChanges needs an explicit items/render/rows adapter.')
  if (adapter.virtualized && (!adapter.anchor || !adapter.observeRecycling))
    throw new TypeError(
      'A virtualizer adapter must implement anchor restoration and recycling notifications.',
    )
  if (scroll.ownerDocument !== document)
    throw new TypeError('List viewport must belong to the same document.')
  const horizontal = options.axis === 'x'
  function visible(rect: DOMRect, viewport: DOMRect) {
    return (
      rect.height > 0 &&
      rect.width > 0 &&
      rect.bottom > viewport.top &&
      rect.top < viewport.bottom &&
      rect.right > viewport.left &&
      rect.left < viewport.right
    )
  }
  const rows = () => {
    const rows = [...adapter.rows()]
    if (
      new Set(rows.map((row) => row.target)).size !== rows.length ||
      new Set(rows.map((row) => row.key)).size !== rows.length
    )
      throw new TypeError('List adapter rows need distinct targets and keys.')
    for (const row of rows)
      if (!(row.target instanceof view.HTMLElement) || !container.contains(row.target))
        throw new TypeError('List rows must be descendants of the container.')
    return rows
  }
  rows()
  return createListChanges(options, {
    items: () => adapter.items(),
    render: (items) => {
      const focused = document.activeElement
      const previous =
        focused instanceof view.HTMLElement
          ? rows().find((row) => row.target.contains(focused))
          : undefined
      adapter.render(items)
      // Moving a retained DOM node can clear browser focus even though its key survives.
      if (
        previous &&
        focused instanceof view.HTMLElement &&
        focused.isConnected &&
        (document.activeElement === document.body ||
          document.activeElement === focused) &&
        rows().some((row) => row.key === previous.key && row.target.contains(focused))
      )
        focused.focus({ preventScroll: true })
    },
    reduced: host.reduced,
    rows: () => {
      const viewport = scroll.getBoundingClientRect()
      return rows().flatMap((row) => {
        const rect = row.target.getBoundingClientRect()
        return visible(rect, viewport) ? [{ ...row, x: rect.left, y: rect.top }] : []
      })
    },
    layout(callback) {
      const task = { read: callback }
      host.scheduler.add(task)
      return () => host.scheduler.remove(task)
    },
    anchor: adapter.anchor
      ? (keys) => adapter.anchor!(keys)
      : (keys) => {
          const viewport = scroll.getBoundingClientRect()
          const edge = horizontal ? 'left' : 'top'
          const anchors = rows().flatMap((row) => {
            const rect = row.target.getBoundingClientRect()
            return visible(rect, viewport) ? [{ key: row.key, offset: rect[edge] }] : []
          })
          const first = anchors[0]
          if (!first) return () => {}
          const index = keys.indexOf(first.key)
          return (next) => {
            const after = new Map(rows().map((row) => [row.key, row.target]))
            const anchor = anchors.find((row) => after.has(row.key)) ?? first
            const destination =
              after.get(anchor.key) ?? after.get(next[Math.min(index, next.length - 1)]!)
            if (destination)
              scroll[horizontal ? 'scrollLeft' : 'scrollTop'] +=
                destination.getBoundingClientRect()[edge] - anchor.offset
          }
        },
    capture(target, budget) {
      const copy = captureDOMExit(target, budget)
      return copy
        ? {
            pixels: copy.pixels,
            play: (pose) => host.exit(copy.element, pose),
            dispose() {
              host.release(copy.element)
              copy.dispose()
            },
          }
        : undefined
    },
    move: host.animate,
    observe(events) {
      const unobserveRecycling = adapter.observeRecycling?.(events.recycle)
      let identities = new Map(rows().map((row) => [row.target, row.key]))
      const observer = new view.MutationObserver(() => {
        if (!container.isConnected) {
          events.dispose()
          return
        }
        const next = new Map(rows().map((row) => [row.target, row.key]))
        for (const [target, key] of identities)
          if (next.get(target) !== key) events.recycle(target)
        identities = next
      })
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-key'],
      })
      const hidden = () => {
          if (document.hidden) events.stop()
        },
        resize = () => events.stop(),
        preference = host.preference(() => {
          if (host.reduced()) events.stop()
        })
      document.addEventListener('visibilitychange', hidden)
      view.addEventListener('resize', resize)
      return () => {
        unobserveRecycling?.()
        observer.disconnect()
        identities.clear()
        document.removeEventListener('visibilitychange', hidden)
        view.removeEventListener('resize', resize)
        preference()
        host.forget()
      }
    },
  })
}
