export type SheetSnap = number | `${number}%` | 'content'

export interface SheetStop {
  point: SheetSnap
  height: number
  y: number
}

export interface SheetGeometry {
  height: number
  closedY: number
  top: number
  /** How far the panel extends below the usable area, under a home indicator the keyboard does not cover. */
  extension: number
  stops: SheetStop[]
}

export function validateSnaps(points: readonly SheetSnap[]): void {
  if (!Array.isArray(points) || !points.length)
    throw new TypeError('bottomSheet() needs at least one snap point.')
  for (const point of points) {
    if (point === 'content') continue
    if (typeof point === 'number' && Number.isFinite(point) && point > 0) continue
    if (typeof point === 'string' && /^(?:\d+(?:\.\d+)?|\.\d+)%$/.test(point)) {
      const percent = Number.parseFloat(point)
      if (percent > 0 && percent <= 100) continue
    }
    throw new RangeError(
      'Sheet snaps must be positive DIPs, 0–100% (exclusive of 0), or content.',
    )
  }
  if (new Set(points).size !== points.length)
    throw new RangeError('Sheet snap points must not repeat.')
}

/**
 * Keyboard overlap is relative to the host, so adjustResize is not subtracted twice.
 * The panel extends under the bottom inset only when its host lets it reach that edge.
 */
export function sheetGeometry(
  points: readonly SheetSnap[],
  hostHeight: number,
  hostBottom: number,
  windowHeight: number,
  keyboardHeight: number,
  safeTop: number,
  safeBottom: number,
  contentHeight: number,
  extendable = true,
): SheetGeometry {
  const top = Math.max(0, safeTop)
  const overlap = Math.max(
    0,
    Math.min(hostHeight, hostBottom - (windowHeight - keyboardHeight)),
  )
  const bottom = Math.max(Math.max(0, safeBottom), overlap)
  const extension = extendable ? Math.max(0, Math.max(0, safeBottom) - overlap) : 0
  const height = Math.max(1, hostHeight - top - bottom)
  const closedY = Math.max(height, hostHeight - top)
  const stops = points.map((point) => {
    const desired =
      point === 'content'
        ? contentHeight
        : typeof point === 'number'
          ? point
          : (Number.parseFloat(point) / 100) * height
    const visible = Math.max(1, Math.min(height, desired))
    return { point, height: visible, y: height - visible }
  })
  return { height, closedY, top, extension, stops }
}

/** Projection selects a stop; the native spring retains the actual release velocity. */
export function releaseStop(
  geometry: SheetGeometry,
  y: number,
  velocity: number,
  dismissible: boolean,
): SheetStop | undefined {
  const projected = y + Math.max(-4000, Math.min(4000, velocity)) * 0.2
  let distance = dismissible ? Math.abs(projected - geometry.closedY) : Infinity
  let result: SheetStop | undefined
  for (const stop of geometry.stops) {
    const next = Math.abs(projected - stop.y)
    if (next <= distance) {
      distance = next
      result = stop
    }
  }
  return result
}
