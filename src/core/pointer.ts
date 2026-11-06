export interface PointerCoordinatesOptions {
  axis?: 'x' | 'y' | 'both'
  coordinates?: 'normalized' | 'pixels'
  range?: { x?: readonly [number, number]; y?: readonly [number, number] }
  rest?: { x?: number; y?: number }
  disabled?: boolean
}
export function resolvePointerOptions(input: PointerCoordinatesOptions) {
  if (!input || typeof input !== 'object')
    throw new TypeError('Expected pointer options.')
  const axis = input.axis ?? 'both',
    coordinates = input.coordinates ?? 'normalized'
  if (
    !['x', 'y', 'both'].includes(axis) ||
    !['normalized', 'pixels'].includes(coordinates)
  )
    throw new TypeError('Invalid pointer axis or coordinate mode.')
  if (input.disabled !== undefined && typeof input.disabled !== 'boolean')
    throw new TypeError('disabled must be boolean.')
  const range = {
    x: input.range?.x && [...input.range.x],
    y: input.range?.y && [...input.range.y],
  }
  const rest = { x: input.rest?.x ?? 0, y: input.rest?.y ?? 0 }
  for (const channel of ['x', 'y'] as const) {
    const bounds = range[channel]
    if (
      !Number.isFinite(rest[channel]) ||
      (bounds &&
        (bounds.length !== 2 ||
          !bounds.every(Number.isFinite) ||
          bounds[0]! >= bounds[1]! ||
          rest[channel] < bounds[0]! ||
          rest[channel] > bounds[1]!))
    )
      throw new RangeError('Pointer ranges must be finite, increasing and contain rest.')
  }
  return { axis, coordinates, range, rest, disabled: input.disabled ?? false }
}
/** Center-origin coordinates. Native supplies local DIPs; Web supplies viewport CSS pixels. */
export function pointerPoint(
  x: number,
  y: number,
  width: number,
  height: number,
  options: ReturnType<typeof resolvePointerOptions>,
) {
  if (
    ![x, y, width, height].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0 ||
    Math.abs(x) > width / 2 ||
    Math.abs(y) > height / 2
  )
    return undefined
  const result = { x, y }
  for (const channel of ['x', 'y'] as const) {
    let value = result[channel]
    const bounds = options.range[channel]
    if (options.coordinates === 'normalized') {
      value /= (channel === 'x' ? width : height) / 2
      if (bounds) value = bounds[0]! + ((value + 1) * (bounds[1]! - bounds[0]!)) / 2
    }
    if (bounds) value = Math.max(bounds[0]!, Math.min(bounds[1]!, value))
    result[channel] =
      options.axis === 'both' || options.axis === channel ? value : options.rest[channel]
  }
  return result
}
