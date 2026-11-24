import { itemKeys, sameKeys, type ReorderKey } from './reorder.js'
import type { DropOptions, DropRect } from './drop.js'

export interface ListTransferMove<K extends ReorderKey> {
  key: K
  fromIndex: number
  toIndex: number
  beforeKey: K | null
}

/** Scrolling and frame scheduling belong to the destination viewport. Coordinates and deltas use DIPs or CSS pixels. */
export interface TransferScrollPort {
  viewport(): { top: number; bottom: number } | undefined
  scrollBy(delta: number): boolean
  frame(tick: () => void): () => void
  now(): number
}

/** Pass the returned options to the platform's dropZones for each draggable row.
 * Both arrays are application-owned. Row centers use the same window coordinates
 * as dropZones (DIPs or CSS pixels). Include only currently realized destination rows.
 */
export function listTransferOptions<T, K extends ReorderKey>(options: {
  key: K
  target: T
  sourceKeys(): readonly K[]
  targetKeys(): readonly K[]
  centers(): readonly { key: K; center: number }[]
  axis?: 'x' | 'y'
  reverse?: boolean
  edgeScroll?: TransferScrollPort
  revision?(): unknown
  accept?(move: ListTransferMove<K>): boolean
  preview?(move: ListTransferMove<K> | undefined): void
  commit(move: ListTransferMove<K>): void
}): DropOptions<T> {
  const scroll = options.edgeScroll
  if (scroll && options.axis === 'x')
    throw new TypeError('Destination edge scrolling requires a vertical list.')
  let cancelFrame: (() => void) | undefined
  let held: DropRect | undefined,
    previousTime = 0,
    generation = 0
  function stopScroll() {
    generation++
    cancelFrame?.()
    cancelFrame = undefined
    held = undefined
  }
  let source: K[] = [],
    destination: K[] = [],
    revision: unknown,
    active = false
  let proposal: ListTransferMove<K> | undefined
  let positions = new Map<K, number>()
  function begin() {
    stopScroll()
    source = itemKeys(options.sourceKeys(), (key) => key)
    destination = itemKeys(options.targetKeys(), (key) => key)
    itemKeys([...source, ...destination], (key) => key)
    positions = new Map(destination.map((key, index) => [key, index]))
    revision = options.revision?.()
    active = source.includes(options.key)
  }
  function valid() {
    return (
      active &&
      revision === options.revision?.() &&
      sameKeys(source, options.sourceKeys()) &&
      sameKeys(destination, options.targetKeys())
    )
  }
  function propose(bounds: DropRect, append = false): ListTransferMove<K> | undefined {
    if (!valid()) {
      active = false
      return
    }
    const coordinate =
      options.axis === 'x' ? bounds.x + bounds.width / 2 : bounds.y + bounds.height / 2
    const sign = options.reverse ? -1 : 1
    let slot = destination.length
    if (!append && destination.length) {
      const centers = options.centers()
      if (!centers.length) return
      let previous = -1,
        previousCenter = -Infinity
      slot = -1
      for (const row of centers) {
        const index = positions.get(row.key) ?? -1,
          center = sign * row.center
        if (index <= previous || !Number.isFinite(center) || center <= previousCenter)
          return
        if (slot < 0 && sign * coordinate < center) slot = index
        previous = index
        previousCenter = center
      }
      if (slot < 0) slot = previous + 1
    }
    return {
      key: options.key,
      fromIndex: source.indexOf(options.key),
      toIndex: slot,
      beforeKey: destination[slot] ?? null,
    }
  }
  function display(move?: ListTransferMove<K>) {
    if (proposal?.toIndex === move?.toIndex) return
    proposal = move
    options.preview?.(move)
  }
  function speed(bounds: DropRect) {
    const rect = scroll?.viewport()
    if (!rect || !(rect.bottom > rect.top)) return 0
    const y = bounds.y + bounds.height / 2
    if (y < rect.top || y > rect.bottom) return 0
    const edge = Math.min(48, (rect.bottom - rect.top) / 3)
    return (
      600 *
      (Math.max(0, 1 - (rect.bottom - y) / edge) - Math.max(0, 1 - (y - rect.top) / edge))
    )
  }
  function updateScroll(bounds: DropRect) {
    if (!scroll || !speed(bounds)) {
      stopScroll()
      return
    }
    held = bounds
    if (cancelFrame) return
    previousTime = scroll.now()
    const ticket = generation
    const tick = () => {
      if (ticket !== generation || !held) return
      cancelFrame = undefined
      if (!valid()) {
        reset()
        return
      }
      const rate = speed(held),
        now = scroll.now()
      const dt = Math.min(50, Math.max(0, now - previousTime))
      previousTime = now
      if (!rate || (dt > 0 && !scroll.scrollBy((rate * dt) / 1000))) {
        stopScroll()
        return
      }
      if (ticket !== generation || !held) return
      display(propose(held))
      if (ticket === generation && held) cancelFrame = scroll.frame(tick)
    }
    cancelFrame = scroll.frame(tick)
  }
  function reset() {
    stopScroll()
    active = false
    display()
  }
  let accepted: ListTransferMove<K> | undefined
  return {
    targets: [
      {
        id: 'destination',
        target: options.target,
        accept(event, bounds) {
          if (!bounds) return false
          if (event.method === 'request') begin()
          accepted = propose(bounds, event.method === 'request')
          if (!accepted) return false
          const allowed = options.accept ? options.accept(accepted) : true
          if (typeof allowed !== 'boolean')
            throw new TypeError('List transfer acceptance must be synchronous.')
          return allowed && valid()
        },
      },
    ],
    onStart: begin,
    onMove(event) {
      const move = event.id ? propose(event.bounds) : undefined
      display(move)
      if (event.id && valid()) updateScroll(event.bounds)
      else stopScroll()
    },
    onLeave() {
      stopScroll()
      display()
    },
    onReject: reset,
    onCancel: reset,
    onDrop() {
      const move = accepted
      accepted = undefined
      if (!move || !valid()) {
        reset()
        return
      }
      reset()
      options.commit(move)
    },
  }
}
