import type { View } from '@nativescript/core'

export type ReorderKey = string | number
export type ReorderCancelReason =
  | 'cancelled'
  | 'unchanged'
  | 'data-changed'
  | 'removed'
  | 'unloaded'
  | 'disposed'
  | 'disabled'
  | 'geometry-changed'

export interface ReorderMove<K extends ReorderKey = ReorderKey> {
  key: K
  /** Insert before this identity; null appends. The app owns the mutation. */
  beforeKey: K | null
  fromIndex: number
  toIndex: number
}

export interface ReorderOptions<T, K extends ReorderKey = ReorderKey> {
  key(item: T): K
  /** View id, or a resolver within a realized row. Omit to drag anywhere on the row. */
  handle?: string | ((row: View) => View | undefined)
  onCommit(move: ReorderMove<K>): void
  onStart?: (key: K) => void
  onCancel?: (event: { key: K; reason: ReorderCancelReason }) => void
  /** Long-press activation in milliseconds; default 350. */
  longPress?: number
  /** Edge region in DIPs and maximum native autoscroll speed in DIPs/second. */
  edge?: { size?: number; speed?: number }
  accessibility?: { moveUp?: string; moveDown?: string }
}

export interface Reorder<K extends ReorderKey = ReorderKey> {
  readonly activeKey: K | undefined
  readonly disposed: boolean
  /** A keyboard/button alternative. Returns false for a missing key or unchanged order. */
  move(key: K, beforeKey: K | null): boolean
  moveUp(key: K): boolean
  moveDown(key: K): boolean
  cancel(): void
  /** Call after in-place changes to a plain array or row geometry. */
  refresh(): void
  pause(): void
  play(): void
  dispose(): void
}

export type ReorderNativeEvent =
  | { type: 'start'; index: number }
  | { type: 'commit'; index: number; toIndex: number }
  | { type: 'cancel'; geometryChanged?: boolean }

export interface ReorderAdapterDriver {
  cancel(): void
  setEnabled(enabled: boolean): void
  setReducedMotion(reduced: boolean): void
  dispose(): void
}

/**
 * Optional list-plugin integration. Indices refer to the current items until a
 * change invalidates the gesture. Drivers own native input, measured variable
 * heights, snapshot overlays, recycled-cell restoration and edge scrolling.
 * Emit only lifecycle events; do not bridge pointer/display frames to JS.
 */
export interface ReorderAdapter<T> {
  readonly view: View
  items(): readonly T[]
  /** Notify synchronously when identities/order/content change. */
  subscribe(changed: () => void): () => void
  attach(config: {
    handle: ReorderOptions<T>['handle']
    longPress: number
    edgeSize: number
    edgeSpeed: number
    reducedMotion: boolean
    accessibility: { moveUp: string; moveDown: string }
    event(event: ReorderNativeEvent): void
    move(index: number, direction: -1 | 1): void
  }): ReorderAdapterDriver
}
