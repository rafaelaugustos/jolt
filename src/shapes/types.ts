import type { ColorValue } from '../color.js'
import type { PlaybackAnimation } from '../playback.js'
import type { Transition, SpringName } from '../transition.js'
import type { ShapePath } from './path.js'
export interface ShapeValues {
  d?: string
  /** Fractions of a single contour, clamped to 0..1. Fill remains complete. */
  strokeStart?: number
  strokeEnd?: number
}
export interface ShapeOptions extends ShapeValues {
  d: string
  /** minX, minY, width, height. Centered aspect-fit; stroke scales with this box. */
  viewBox: readonly [number, number, number, number]
  stroke?: ColorValue
  fill?: ColorValue
  /** In viewBox units, 0..1000; default 2. */
  strokeWidth?: number
  lineCap?: 'butt' | 'round' | 'square'
  lineJoin?: 'miter' | 'round' | 'bevel'
  fillRule?: 'nonzero' | 'evenodd'
}
export interface Shape {
  readonly disposed: boolean
  animate(values: ShapeValues, transition?: Transition | SpringName): PlaybackAnimation
  /** Replace geometry/trim immediately, including a different path topology. */
  set(values: ShapeValues): void
  /** Native presentation sampled only on demand. */
  snapshot(): ShapeValues & {
    d: string
    strokeStart: number
    strokeEnd: number
    attached: boolean
    nativeAnimations: number
    bounds: readonly number[] | null
  }
  stop(): void
  dispose(): void
}
export interface ShapeFrame {
  path: ShapePath
  start: number
  end: number
}
export interface ShapeStyle {
  viewBox: [number, number, number, number]
  stroke: number
  fill: number
  width: number
  cap: 'butt' | 'round' | 'square'
  join: 'miter' | 'round' | 'bevel'
  rule: 'nonzero' | 'evenodd'
}
export function mixFrame(a: ShapeFrame, b: ShapeFrame, t: number): ShapeFrame {
  return {
    path: {
      ...a.path,
      points: a.path.points.map((p, i) => p + (b.path.points[i]! - p) * t),
    },
    start: Math.max(0, Math.min(1, a.start + (b.start - a.start) * t)),
    end: Math.max(0, Math.min(1, a.end + (b.end - a.end) * t)),
  }
}
