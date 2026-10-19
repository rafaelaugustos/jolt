import { Utils, type PanGestureEventData, type View } from '@nativescript/core'
import { getDriver } from './driver/index.js'

interface Sample {
  x: number
  y: number
  time: number
}

/** Android's raw coordinates avoid feedback from translating the touched view. */
export class DragInput {
  private samples: Sample[] = []
  private lastMoved = 0
  reset() {
    this.samples = []
    this.lastMoved = 0
  }
  read(event: PanGestureEventData, view: View) {
    const ios = event.ios as UIPanGestureRecognizer | undefined
    const android = event.android?.current as android.view.MotionEvent | undefined
    const parent = view.parent?.nativeViewProtected ?? view.nativeViewProtected
    const delta = ios
      ? ios.translationInView(parent)
      : { x: event.deltaX, y: event.deltaY }
    const density = Utils.layout.getDisplayDensity()
    const sample: Sample = android
      ? {
          x: android.getRawX() / density,
          y: android.getRawY() / density,
          time: Number(android.getEventTime()),
        }
      : { ...delta, time: getDriver().now() }
    if (
      Number.isFinite(sample.x) &&
      Number.isFinite(sample.y) &&
      Number.isFinite(sample.time)
    ) {
      const previous = this.samples.at(-1)
      if (!previous || sample.x !== previous.x || sample.y !== previous.y)
        this.lastMoved = sample.time
      // Replace duplicate times (Android sends began + changed for the same event).
      if (this.samples.at(-1)?.time === sample.time) this.samples.pop()
      this.samples.push(sample)
      while (this.samples.length > 2 && this.samples[1]!.time < sample.time - 100)
        this.samples.shift()
    }
    const first = this.samples[0]
    const elapsed = first ? sample.time - first.time : 0
    // UIKit may retain its last movement velocity when the finger holds still
    // before lifting. A stale velocity must not turn that hold into a fling.
    const nativeVelocity = ios
      ? sample.time - this.lastMoved > 100
        ? { x: 0, y: 0 }
        : ios.velocityInView(parent)
      : undefined
    const velocity = nativeVelocity ?? {
      x: elapsed > 0 && elapsed <= 150 ? ((sample.x - first!.x) * 1000) / elapsed : 0,
      y: elapsed > 0 && elapsed <= 150 ? ((sample.y - first!.y) * 1000) / elapsed : 0,
    }
    const action = android?.getActionMasked()
    return {
      x: delta.x,
      y: delta.y,
      velocityX: Number.isFinite(velocity.x) ? velocity.x : 0,
      velocityY: Number.isFinite(velocity.y) ? velocity.y : 0,
      cancelled:
        event.state === 0 ||
        action === 3 ||
        action === 5 ||
        action === 6 ||
        (android ? android.getPointerCount() > 1 : (ios?.numberOfTouches ?? 1) > 1),
    }
  }
}
