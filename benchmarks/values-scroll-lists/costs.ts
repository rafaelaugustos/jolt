import { isIOS, type View } from '@nativescript/core'
import { captureExit } from '../../dist/layout-exit'
/** Bounded emulator experiment; no allocation/frame-rate or physical-device claim. */
export function exitCosts(view: View) {
  const native = view.nativeViewProtected
  const parent = isIOS ? native.superview : native.getParent()
  const overlay: any = isIOS
    ? UIView.new()
    : new android.widget.FrameLayout(native.getContext())
  const index = isIOS
    ? parent.subviews.indexOfObject(native)
    : parent.indexOfChild(native)
  const params = isIOS ? native.frame : native.getLayoutParams()
  if (isIOS) {
    overlay.frame = parent.bounds
    parent.addSubview(overlay)
  } else parent.addView(overlay)
  const snapshot: number[] = [],
    retain: number[] = []
  try {
    for (let i = 0; i < 8; i++) {
      const start = performance.now(),
        copy = captureExit(view, 8_000_000)
      if (!copy) throw new Error('Cost fixture was not capturable')
      const duration = performance.now() - start
      copy.dispose()
      if (i >= 3) snapshot.push(duration)
      const move = performance.now()
      // Raw native reparenting only. NativeScript teardown is deliberately excluded.
      if (isIOS) {
        native.removeFromSuperview()
        overlay.addSubview(native)
        native.removeFromSuperview()
        parent.insertSubviewAtIndex(native, index)
        native.frame = params
      } else {
        parent.removeView(native)
        overlay.addView(native)
        overlay.removeView(native)
        parent.addView(native, index, params)
      }
      if (i >= 3) retain.push(performance.now() - move)
    }
  } finally {
    if (isIOS) overlay.removeFromSuperview()
    else parent.removeView(overlay)
  }
  return {
    snapshotSetupMs: snapshot,
    rawNativeReparentRoundTripMs: retain,
    limitations:
      'Five warm samples; raw reparent excludes NativeScript removal/teardown and is not a supported retained-view exit implementation.',
  }
}
