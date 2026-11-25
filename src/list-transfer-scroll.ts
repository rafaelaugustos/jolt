import { ScrollView } from '@nativescript/core'
import { getDriver } from './driver/index.js'
import type { TransferScrollPort } from './core/list-transfer.js'

/** Use a mounted vertical destination ScrollView as the edge-scroll viewport. */
export function listTransferScroll(view: ScrollView): TransferScrollPort {
  if (!(view instanceof ScrollView) || view.orientation !== 'vertical')
    throw new TypeError('Expected a vertical destination ScrollView.')
  const driver = getDriver()
  return {
    viewport() {
      if (!view.isLoaded) return
      const point = view.getLocationInWindow()
      if (point) return { top: point.y, bottom: point.y + view.getActualSize().height }
    },
    scrollBy(delta) {
      if (!view.isLoaded) return false
      const from = view.verticalOffset
      const to = Math.max(0, Math.min(view.scrollableHeight, from + delta))
      if (Math.abs(to - from) < 0.01) return false
      view.scrollToVerticalOffset(to, false)
      return true
    },
    frame: (callback) => driver.frame(callback),
    now: () => driver.now(),
  }
}
