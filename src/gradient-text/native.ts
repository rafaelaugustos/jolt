import { isAndroid, type Label } from '@nativescript/core'
import type { Track } from '../track.js'
import { iosGradientText } from './ios.js'
import { androidGradientText } from './android.js'
import type { TextPaint } from '../core/gradient-text.js'
export type { TextPaint } from '../core/gradient-text.js'
export interface TextPainter {
  refresh(): void
  play(track: Track): void
  control(time: number, paused: boolean): void
  stop(): void
  dispose(): void
  bytes(): number
}
type Factory = (label: Label, paint: TextPaint) => TextPainter
let override: Factory | undefined
export function setTextPainterFactory(factory?: Factory) {
  override = factory
}
export const createTextPainter: Factory = (label, paint) =>
  (override ?? (isAndroid ? androidGradientText : iosGradientText))(label, paint)
