/** A bounded exit for a static presentation copy. Angles/3D/layout resizing remain on ordinary animations. */
export type LayoutExit =
  false | 'fadeOut' | { opacity?: number; x?: number; y?: number; scale?: number }
export interface ResolvedLayoutExit {
  opacity: number
  x: number
  y: number
  scale: number
}
export function layoutExit(
  input: LayoutExit | undefined,
): ResolvedLayoutExit | undefined {
  if (input === undefined || input === false) return undefined
  if (input === 'fadeOut') return { opacity: 0, x: 0, y: 0, scale: 1 }
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !['opacity', 'x', 'y', 'scale'].includes(key))
  )
    throw new TypeError('Layout exit is fadeOut, false, or opacity/x/y/scale.')
  const result = {
    opacity: input.opacity ?? 0,
    x: input.x ?? 0,
    y: input.y ?? 0,
    scale: input.scale ?? 1,
  }
  if (
    !Object.values(result).every(Number.isFinite) ||
    result.opacity < 0 ||
    result.opacity > 1 ||
    result.scale <= 0
  )
    throw new RangeError(
      'Exit values must be finite, with opacity in [0,1] and positive scale.',
    )
  return result
}
export function exitBudget(value = 8_000_000) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 32_000_000)
    throw new RangeError('maxSnapshotPixels must be an integer in [1,32000000].')
  return value
}
