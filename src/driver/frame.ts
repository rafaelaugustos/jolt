import {
  cancelAnimationFrame,
  requestAnimationFrame,
} from '@nativescript/core/animation-frame'

/** NativeScript schedules subsequent frames with CADisplayLink / Choreographer. */
export function frame(callback: () => void): () => void {
  const id = requestAnimationFrame(callback)
  return () => cancelAnimationFrame(id)
}
