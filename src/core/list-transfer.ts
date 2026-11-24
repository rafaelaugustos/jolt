import { itemKeys, sameKeys, type ReorderKey } from './reorder.js'
import type { DropOptions, DropRect } from './drop.js'

export interface ListTransferMove<K extends ReorderKey> {
  key: K
  fromIndex: number
  toIndex: number
  beforeKey: K | null
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
  revision?(): unknown
  accept?(move: ListTransferMove<K>): boolean
  preview?(move: ListTransferMove<K> | undefined): void
  commit(move: ListTransferMove<K>): void
}): DropOptions<T> {
  let source: K[] = [],
    destination: K[] = [],
    revision: unknown,
    active = false
  let proposal: ListTransferMove<K> | undefined
  let positions = new Map<K, number>()
  function begin() {
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
  function reset() {
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
    onMove: (event) => display(event.id ? propose(event.bounds) : undefined),
    onLeave: () => display(),
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
