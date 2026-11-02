export interface ContactPoint {
  x: number
  y: number
}
export function contactGeometry(points: readonly ContactPoint[]) {
  const count = points.length
  if (!count) return { x: 0, y: 0, distance: 0, angle: 0 }
  const x = points.reduce((sum, p) => sum + p.x, 0) / count
  const y = points.reduce((sum, p) => sum + p.y, 0) / count
  const first = points[0]!,
    second = points[1] ?? first
  return {
    x,
    y,
    distance: Math.hypot(second.x - first.x, second.y - first.y),
    angle: (Math.atan2(second.y - first.y, second.x - first.x) * 180) / Math.PI,
  }
}
export function angleDelta(next: number, previous: number) {
  return ((((next - previous + 540) % 360) + 360) % 360) - 180
}
export const constrain = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))
/** Finger delta is consumed exactly once. Positive panel motion collapses it. */
export function consumeScroll(
  delta: number,
  panel: number,
  bounds: readonly [number, number],
  offsets: readonly { position: number; max: number }[],
) {
  let rest = delta
  const scroll = offsets.map((item) => item.position)
  const movePanel = () => {
    const next = constrain(panel + rest, ...bounds)
    rest -= next - panel
    panel = next
  }
  const moveScroll = () => {
    offsets.forEach((item, i) => {
      const next = constrain(scroll[i]! - rest, 0, item.max)
      rest += next - scroll[i]!
      scroll[i] = next
    })
  }
  if (delta < 0) {
    movePanel()
    moveScroll()
  } else {
    moveScroll()
    movePanel()
  }
  return { panel, scroll, remaining: rest }
}
