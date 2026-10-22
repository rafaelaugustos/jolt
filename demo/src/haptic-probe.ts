import { isAndroid, View } from '@nativescript/core'

export interface HapticRequest {
  at: number
  effect: number
  accepted: boolean
  xPixels: number
  yPixels: number
}

declare global {
  namespace org.rafaelaugusto.jolt.fixture {
    class HapticProbeView extends android.view.View {
      constructor(context: android.content.Context)
      getFeedbackEvents(): string
      clearFeedbackEvents(): void
    }
  }
}

/** Only the demo uses this view; the library has no instrumentation hooks. */
export class HapticProbe extends View {
  override createNativeView() {
    return isAndroid
      ? new org.rafaelaugusto.jolt.fixture.HapticProbeView(this._context)
      : UIView.new()
  }

  requests(): HapticRequest[] {
    return isAndroid && this.nativeViewProtected
      ? JSON.parse(this.nativeViewProtected.getFeedbackEvents())
      : []
  }

  clearRequests() {
    if (isAndroid) this.nativeViewProtected?.clearFeedbackEvents()
  }
}
