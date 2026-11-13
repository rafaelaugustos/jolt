import { itemKeys, type ReorderKey } from './reorder.js'
import {
  exitBudget,
  layoutExit,
  type LayoutExit,
  type ResolvedLayoutExit,
} from './layout-exit.js'
import type { Animation } from './playback.js'

export interface ListChanges<T> {
  readonly disposed: boolean
  readonly paused: boolean
  update(items: readonly T[]): Animation
  stop(): void
  pause(): void
  play(): void
  dispose(): void
}
export interface ListChangeRow<K, Target> {
  key: K
  target: Target
  x: number
  y: number
}
export interface ListChangeCopy {
  pixels: number
  play(exit: ResolvedLayoutExit): Animation
  dispose(): void
}
export interface ListChangeHost<T, K, Target> {
  items(): readonly T[]
  rows(): readonly ListChangeRow<K, Target>[]
  render(items: readonly T[]): void
  /** Resolve after the renderer commits; cancellation must prevent late work. */
  layout(callback: () => void): () => void
  /** Freeze the first visible key and local offset, with nearest-index fallback. */
  anchor(keys: readonly K[]): (next: readonly K[]) => void
  capture(target: Target, budget: number): ListChangeCopy | undefined
  move(
    target: Target,
    x: number,
    y: number,
    enter: boolean,
  ): { animation: Animation; dispose(): void }
  reduced(): boolean
  observe(changed: {
    stop(): void
    dispose(): void
    recycle(target: Target): void
  }): () => void
}
export interface ListChangesOptions<T, K extends ReorderKey = ReorderKey> {
  key(item: T): K
  enter?: boolean
  exit?: LayoutExit
  maxSnapshotPixels?: number
}

/** Key diff and lifecycle shared by Core ListView and explicit DOM/virtualizer adapters. */
export function createListChanges<T, K extends ReorderKey, Target>(
  options: ListChangesOptions<T, K>,
  host: ListChangeHost<T, K, Target>,
): ListChanges<T> {
  if (typeof options?.key !== 'function')
    throw new TypeError('listChanges requires a stable key(item).')
  const exit = layoutExit(options.exit),
    budget = exitBudget(options.maxSnapshotPixels)
  if (options.enter !== undefined && typeof options.enter !== 'boolean')
    throw new TypeError('List enter must be boolean.')
  itemKeys(host.items(), options.key)
  let disposed = false,
    paused = false,
    operation: { stop(): void } | undefined
  const moving = new Map<Target, { animation: Animation; dispose(): void }>()
  const recycle = (target: Target) => {
    const motion = moving.get(target)
    moving.delete(target)
    motion?.dispose()
  }
  const stop = () => {
    operation?.stop()
    operation = undefined
    for (const target of moving.keys()) recycle(target)
  }
  let unobserve = () => {}
  const result: ListChanges<T> = {
    get disposed() {
      return disposed
    },
    get paused() {
      return paused
    },
    stop,
    pause() {
      paused = true
      stop()
    },
    play() {
      if (!disposed) paused = false
    },
    dispose() {
      if (disposed) return
      disposed = true
      stop()
      unobserve()
    },
    update(items) {
      if (disposed) throw new Error('List changes controller is disposed.')
      if (!Array.isArray(items))
        throw new TypeError('List updates need an immutable array.')
      const next = [...items],
        keys = itemKeys(next, options.key),
        keySet = new Set(keys)
      const previousKeys = itemKeys(host.items(), options.key),
        oldKeySet = new Set(previousKeys)
      const before = new Map(host.rows().map((row) => [row.key, row]))
      const restoreAnchor = host.anchor(previousKeys)
      // Read the displayed positions before cancelling the previous inverse transforms.
      stop()
      let resolve!: (done: boolean) => void,
        reject!: (error: unknown) => void,
        ended = false,
        detach: (() => void) | undefined
      const finished = new Promise<boolean>((yes, no) => {
        resolve = yes
        reject = no
      })
      void finished.catch(() => {})
      const copies = new Map<K, ListChangeCopy>()
      const finish = (complete: boolean, error?: unknown) => {
        if (ended) return
        ended = true
        detach?.()
        detach = undefined
        for (const target of moving.keys()) recycle(target)
        for (const copy of copies.values()) copy.dispose()
        copies.clear()
        before.clear()
        if (operation === handle) operation = undefined
        if (error !== undefined) reject(error)
        else resolve(complete)
      }
      const handle: Animation = {
        finished,
        stop: () => finish(false),
        then: finished.then.bind(finished),
      }
      operation = handle
      try {
        let pixels = 0
        if (exit && !paused && !host.reduced())
          for (const [key, row] of before)
            if (!keySet.has(key)) {
              const copy = host.capture(row.target, budget - pixels)
              if (copy) {
                pixels += copy.pixels
                copies.set(key, copy)
              }
            }
        host.render(next)
        if (ended) return handle
        const run = () => {
          if (ended) return
          try {
            const handles: Animation[] = []
            if (!paused && !host.reduced()) {
              for (const copy of copies.values()) handles.push(copy.play(exit!))
              for (const row of host.rows()) {
                const was = before.get(row.key),
                  enter = !oldKeySet.has(row.key) && options.enter !== false
                if (!was && !enter) continue // Existing data arriving from off-screen is not an insertion.
                const x = was ? was.x - row.x : 0,
                  y = was ? was.y - row.y : 0
                if (!enter && Math.abs(x) < 0.25 && Math.abs(y) < 0.25) continue
                const motion = host.move(row.target, x, y, enter)
                moving.set(row.target, motion)
                handles.push(motion.animation)
              }
            }
            void Promise.all(handles.map((h) => h.finished)).then(
              (values) => finish(values.every(Boolean)),
              (error) => finish(false, error),
            )
          } catch (error) {
            finish(false, error)
          }
        }
        detach = host.layout(() => {
          if (ended) return
          try {
            restoreAnchor(keys)
            detach = host.layout(run)
          } catch (error) {
            finish(false, error)
          }
        })
      } catch (error) {
        finish(false, error)
        throw error
      }
      return handle
    },
  }
  unobserve = host.observe({ stop, dispose: result.dispose, recycle })
  return result
}
