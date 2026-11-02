import type { AnimateOptions, Keyframes, SpringName } from './types.js'
import {
  createViewportEntrance,
  type ViewportHost,
  type WebViewportOptions,
} from './viewport.js'
import type { WebAnimation } from './public.js'

export type WebItemKey = string | number | object
export interface WebItem {
  key: WebItemKey
  target: HTMLElement
}
export type WebItemsOptions = AnimateOptions &
  Pick<WebViewportOptions, 'once' | 'root' | 'rootMargin' | 'threshold' | 'disabled'>
export interface WebItemsAnimation {
  readonly disposed: boolean
  readonly suspended: boolean
  readonly pending: number
  readonly completed: number
  update(items: readonly WebItem[]): void
  /** Clear once history (all keys by default); live rows become eligible again. */
  forget(key?: WebItemKey): void
  refresh(): void
  suspend(): void
  resume(): void
  dispose(): void
}
export interface ItemsHost extends Omit<ViewportHost, 'play'> {
  assert(): void
  prepare(
    targets: readonly HTMLElement[],
    animation: Keyframes | string,
    transition?: AnimateOptions | SpringName,
  ): (index: number, settle: boolean) => WebAnimation
}
export function createItemsAnimation(
  input: readonly WebItem[],
  animation: Keyframes | string,
  options: WebItemsOptions | SpringName,
  host: ItemsHost,
): WebItemsAnimation {
  if (
    typeof options !== 'string' &&
    (!options || typeof options !== 'object' || Array.isArray(options))
  )
    throw new TypeError('Expected item animation options.')
  const {
    once = false,
    root,
    rootMargin,
    threshold,
    disabled,
    ...motion
  } = typeof options === 'string' ? {} : options
  if (motion.stagger !== undefined)
    throw new TypeError(
      'animateItems animates each row as it appears; stagger has no effect.',
    )
  const transition = typeof options === 'string' ? options : motion
  let rows: (WebItem & { token: object })[] = []
  let objects = new WeakSet<object>()
  const keys = new Set<string | number>()
  const seen = (key: WebItemKey) =>
    typeof key === 'object' ? objects.has(key) : keys.has(key)
  const remember = (key: WebItemKey) =>
    typeof key === 'object' ? objects.add(key) : keys.add(key)
  const prepare = (items: readonly WebItem[]) => {
    host.assert()
    if (!Array.isArray(items))
      throw new TypeError('animateItems needs an array of keyed rows.')
    const unique = new Set<WebItemKey>()
    const previous = new Map(rows.map((row) => [row.key, row]))
    const next = items.map((row) => {
      if (
        !row ||
        typeof row !== 'object' ||
        !('key' in row) ||
        !(
          typeof row.key === 'string' ||
          (typeof row.key === 'number' && Number.isFinite(row.key)) ||
          (typeof row.key === 'object' && row.key !== null)
        )
      )
        throw new TypeError('Each row needs a string, finite number or object identity.')
      if (unique.has(row.key)) throw new TypeError('Item identities must be unique.')
      unique.add(row.key)
      const old = previous.get(row.key)
      return {
        key: row.key,
        target: row.target,
        token: old && old.target === row.target ? old.token : {},
      }
    })
    const play = host.prepare(
      next.map((row) => row.target),
      animation,
      transition,
    )
    return { next, play }
  }
  let prepared = prepare(input)
  rows = prepared.next
  const viewport = createViewportEntrance(
    rows.map((row) => row.target),
    { once, root, rootMargin, threshold, disabled },
    {
      ...host,
      forget() {
        keys.clear()
        objects = new WeakSet()
        rows = []
        prepared = {
          next: [],
          play() {
            throw new Error('Item animation is disposed.')
          },
        }
        host.forget()
      },
      play(index) {
        const row = rows[index]!
        const settle = once && seen(row.key)
        const animation = prepared.play(index, settle)
        remember(row.key)
        return animation
      },
    },
    rows.map((row) => row.token),
  )
  const controller: WebItemsAnimation = {
    get disposed() {
      return viewport.disposed
    },
    get suspended() {
      return viewport.suspended
    },
    get pending() {
      return viewport.pending
    },
    get completed() {
      return viewport.completed
    },
    update(items) {
      if (viewport.disposed) throw new Error('Item animation is disposed.')
      const next = prepare(items)
      prepared = next
      rows = next.next
      viewport.reconcile(
        rows.map((row) => row.target),
        rows.map((row) => row.token),
      )
    },
    forget(key) {
      if (viewport.disposed) throw new Error('Item animation is disposed.')
      if (key === undefined) {
        keys.clear()
        objects = new WeakSet()
      } else if (typeof key === 'object') objects.delete(key)
      else keys.delete(key)
      for (const row of rows) if (key === undefined || row.key === key) row.token = {}
      viewport.reconcile(
        rows.map((row) => row.target),
        rows.map((row) => row.token),
      )
    },
    refresh: () => viewport.refresh(),
    suspend: () => viewport.suspend(),
    resume: () => viewport.resume(),
    dispose: () => viewport.dispose(),
  }
  return controller
}
