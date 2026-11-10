export type ReorderKey = string | number
export interface ReorderMove<K extends ReorderKey = ReorderKey> {
  key: K
  beforeKey: K | null
  fromIndex: number
  toIndex: number
}

export function itemKeys<T, K extends ReorderKey>(
  items: readonly T[],
  key: (item: T) => K,
): K[] {
  const keys = items.map(key)
  if (
    keys.some(
      (value) =>
        (typeof value !== 'string' && typeof value !== 'number') ||
        (typeof value === 'number' && !Number.isFinite(value)),
    )
  )
    throw new TypeError('Reorder keys must be strings or finite numbers.')
  if (new Set(keys).size !== keys.length)
    throw new TypeError('Reorder keys must be unique and stable across recycling.')
  return keys
}

export function sameKeys<K>(a: readonly K[], b: readonly K[]): boolean {
  return a.length === b.length && a.every((key, index) => key === b[index])
}

/** toIndex is the final position, after removing the dragged item. */
export function moveAt<K extends ReorderKey>(
  keys: readonly K[],
  fromIndex: number,
  toIndex: number,
): ReorderMove<K> | undefined {
  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= keys.length ||
    toIndex >= keys.length ||
    fromIndex === toIndex
  )
    return undefined
  return {
    key: keys[fromIndex]!,
    beforeKey: keys[toIndex < fromIndex ? toIndex : toIndex + 1] ?? null,
    fromIndex,
    toIndex,
  }
}

/** Destination in a measured, realized layout. The caller supplies the dragged row's center. */
export function reorderDestination(
  rows: readonly { start: number; size: number }[],
  from: number,
  center: number,
): number | undefined {
  if (
    !Number.isInteger(from) ||
    from < 0 ||
    from >= rows.length ||
    !Number.isFinite(center)
  )
    return undefined
  let destination = 0
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    if (!Number.isFinite(row.start) || !Number.isFinite(row.size) || row.size < 0)
      return undefined
    if (i !== from && center > row.start + row.size / 2) destination++
  }
  return destination
}
