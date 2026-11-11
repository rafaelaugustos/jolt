import { Application, GridLayout, StackLayout, isIOS } from '@nativescript/core'
import { motionScope } from '@rafaelaugusto/jolt'

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
// In-app mouse events through the window callback; physical accessories are not covered.
function hover(activity: android.app.Activity, action: number, x: number, y: number) {
  const MotionEvent = android.view.MotionEvent
  const properties = Array.create(MotionEvent.PointerProperties, 1)
  const property = new MotionEvent.PointerProperties()
  property.id = 0
  property.toolType = MotionEvent.TOOL_TYPE_MOUSE
  properties[0] = property
  const coordinates = Array.create(MotionEvent.PointerCoords, 1)
  const point = new MotionEvent.PointerCoords()
  point.x = x
  point.y = y
  coordinates[0] = point
  const now = android.os.SystemClock.uptimeMillis()
  const event = MotionEvent.obtain(
    now,
    now,
    action,
    1,
    properties,
    coordinates,
    0,
    0,
    1,
    1,
    0,
    0,
    android.view.InputDevice.SOURCE_MOUSE,
    0,
  )
  try {
    activity.getWindow().getCallback().dispatchGenericMotionEvent(event)
  } finally {
    event.recycle()
  }
}

/** Rotated/scaled mapping, exit, re-entry and disposal on Android; unavailable hover on iPhone. */
export async function runPointerChecks(host: StackLayout) {
  const assert = (value: unknown, message: string) => {
    if (!value) throw new Error(message)
  }
  const near = (actual: number, expected: number, message: string) =>
    assert(Math.abs(actual - expected) <= 0.03, `${message}: ${actual} != ${expected}`)
  const scope = motionScope()
  const container = new GridLayout(),
    region = new GridLayout()
  container.height = 260
  region.width = 160
  region.height = 80
  region.backgroundColor = '#26323f'
  region.scaleX = region.scaleY = 1.5
  region.rotate = 90
  container.addChild(region)
  host.insertChild(container, 0)
  try {
    await wait(150)
    if (isIOS) {
      const native = region.ios as UIView
      const before = native.gestureRecognizers?.count ?? 0
      const pointer = scope.pointerFollow(region, { spring: false })
      assert(!pointer.available && pointer.presence.get() === 0, 'iPhone reported hover')
      scope.dispose()
      assert(
        (native.gestureRecognizers?.count ?? 0) === before,
        'Pointer source left a recognizer',
      )
      return { stage: 'pointer', platform: 'ios', available: false }
    }
    const activity = (Application.android.foregroundActivity ??
      Application.android.startActivity) as android.app.Activity
    const window = activity.getWindow(),
      original = window.getCallback()
    const native = region.android as android.view.View
    const origin = Array.create('int', 2)
    ;(container.android as android.view.View).getLocationInWindow(origin)
    const cx = origin[0]! + native.getLeft() + native.getWidth() / 2,
      cy = origin[1]! + native.getTop() + native.getHeight() / 2
    const dx = native.getWidth() / 4,
      dy = native.getHeight() / 4
    const { HOVER_ENTER, HOVER_MOVE, HOVER_EXIT } = {
      HOVER_ENTER: android.view.MotionEvent.ACTION_HOVER_ENTER,
      HOVER_MOVE: android.view.MotionEvent.ACTION_HOVER_MOVE,
      HOVER_EXIT: android.view.MotionEvent.ACTION_HOVER_EXIT,
    }
    const pointer = scope.pointerFollow(region, { spring: false })
    assert(
      pointer.available && !window.getCallback().equals(original),
      'Pointer did not attach',
    )
    const rotated = native.getScaleX()
    hover(activity, HOVER_ENTER, cx + dy * rotated, cy + dx * rotated)
    const turned = { x: pointer.x.get(), y: pointer.y.get() }
    near(turned.x, 0.5, 'Rotated and scaled x')
    near(turned.y, -0.5, 'Rotated and scaled y')
    assert(
      pointer.presence.get() === 1 && pointer.active,
      'Pointer did not report presence',
    )
    hover(activity, HOVER_EXIT, 0, 0)
    assert(pointer.presence.get() === 0 && pointer.x.get() === 0, 'Exit did not rest')
    region.rotate = 0
    region.scaleX = region.scaleY = 0.6
    await wait(100)
    const reduced = native.getScaleX()
    hover(activity, HOVER_MOVE, cx + dx * reduced, cy + dy * reduced)
    const shrunk = { x: pointer.x.get(), y: pointer.y.get() }
    near(shrunk.x, 0.5, 'Reduced-scale x')
    near(shrunk.y, 0.5, 'Reduced-scale y')
    scope.dispose()
    assert(pointer.presence.get() === 0, 'Disposal kept presence')
    assert(
      window.getCallback().equals(original),
      'Disposal did not restore the window callback',
    )
    hover(activity, HOVER_MOVE, cx, cy)
    assert(pointer.presence.get() === 0 && !pointer.active, 'Disposed pointer moved')
    return { stage: 'pointer', platform: 'android', turned, shrunk, rotated, reduced }
  } finally {
    scope.dispose()
    host.removeChild(container)
  }
}
