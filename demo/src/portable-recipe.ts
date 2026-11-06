import type { DrawingItem } from '../../src/core/drawing.js'
/** The exact same chart definition is consumed by native and browser demos. */
export function portableDots(count = 259): DrawingItem[] {
  const rows = Math.ceil(count / 37)
  return Array.from({ length: count }, (_, i) => ({
    id: `dot-${i}`,
    style: 'dots',
    kind: 'circle',
    cx: 18 + (i % 37) * 20,
    cy: 15 + (Math.floor(i / 37) * 270) / rows,
    radius: 4,
  }))
}
export const portableStyles = {
  dots: { fill: '#63e3c2', strokeWidth: 0 },
  signal: { fill: '#ffc572', strokeWidth: 0 },
}
