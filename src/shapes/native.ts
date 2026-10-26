import { isAndroid, type View } from '@nativescript/core'
import type { Track } from '../track.js'
import type { ShapeFrame, ShapeStyle } from './types.js'
import { iosShape } from './ios.js'
import { androidShape } from './android.js'
export interface ShapePainter {
  paint(frame: ShapeFrame): void
  read(): ShapeFrame
  play(from: ShapeFrame, to: ShapeFrame, track: Track): void
  control(time: number, paused: boolean): void
  resize(): void
  animations(): number
  bounds(): number[]
  dispose(): void
}
export type ShapeFactory = (
  view: View,
  style: ShapeStyle,
  frame: ShapeFrame,
) => ShapePainter
let override: ShapeFactory | undefined
/** Internal injection for lifecycle tests. */
export function setShapeFactory(value: ShapeFactory | undefined) {
  override = value
}
export const createShape: ShapeFactory = (view, style, frame) =>
  (override ?? (isAndroid ? androidShape : iosShape))(view, style, frame)
