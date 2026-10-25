import {
  isIOS,
  Utils,
  type ScrollView,
  type EventData,
  type TouchGestureEventData,
} from '@nativescript/core'
import { handoffIds, type HandoffIds } from './scroll-handoff.js'
import type { TraceRecorder } from './trace.js'

/** Opt-in raw OS contact capture, before recognizer arbitration. Only numeric window coordinates.
 * The accepted engine baseline normalizes these inputs; this does not record OS recognition decisions.
 */
export function observeScrollHandoffInputs(
  scroll: ScrollView,
  recorder: Pick<TraceRecorder, 'input'>,
  now: () => number,
  ids: HandoffIds = handoffIds,
): () => void {
  let origin = 0,
    previous = 0,
    lastTime = 0,
    contact = false
  const changed = (raw: EventData) => {
    const event = raw as TouchGestureEventData
    const positions: number[] = []
    if (isIOS) {
      for (const pointer of event.getAllPointers()) {
        const touch = pointer.ios as UITouch
        if (touch.phase !== 3 && touch.phase !== 4 /* ended / cancelled */)
          positions.push(touch.locationInView(null).y)
      }
    } else {
      const native = event.android,
        action = native.getActionMasked()
      if (
        action !== android.view.MotionEvent.ACTION_UP &&
        action !== android.view.MotionEvent.ACTION_CANCEL
      )
        for (let i = 0; i < native.getPointerCount(); i++) {
          if (
            action === android.view.MotionEvent.ACTION_POINTER_UP &&
            i === native.getActionIndex()
          )
            continue
          positions.push(
            Utils.layout.toDeviceIndependentPixels(
              native.getRawY() - native.getY() + native.getY(i),
            ),
          )
        }
    }
    const point = positions.length
      ? positions.reduce((sum, y) => sum + y, 0) / positions.length
      : previous
    const time = now()
    const begin = !contact && positions.length > 0 && event.action === 'down'
    if (begin) {
      contact = true
      origin = previous = point
      lastTime = time
      recorder.input({
        type: 'scroll',
        id: ids.scroll,
        offset: Math.max(0, scroll.verticalOffset),
      })
    }
    if (!contact) return
    const ended = !positions.length || event.action === 'cancel'
    recorder.input({
      type: 'gesture',
      id: ids.sheet,
      phase: begin
        ? 'begin'
        : !ended
          ? 'move'
          : event.action === 'cancel'
            ? 'cancel'
            : 'end',
      x: 0,
      y: point - origin,
      velocityX: 0,
      velocityY: ended ? 0 : ((point - previous) / Math.max(1, time - lastTime)) * 1000,
      pointers: ended ? [] : Array.from({ length: positions.length }, (_, i) => i),
    })
    previous = point
    lastTime = time
    if (ended) contact = false
  }
  scroll.on('touch', changed)
  let disposed = false
  return () => {
    if (!disposed) {
      disposed = true
      scroll.off('touch', changed)
    }
  }
}
