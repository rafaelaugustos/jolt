import type { TransferScrollPort } from '../core/list-transfer.js'

/** A vertical DOM scroll container. Frames run only during an active edge contact. */
export function listTransferScroll(element: HTMLElement): TransferScrollPort {
  const view = element.ownerDocument.defaultView
  if (!view) throw new TypeError('Expected a destination element with a window.')
  let remainder = 0
  return {
    viewport() {
      if (!element.isConnected || element.ownerDocument.hidden) return
      const top = element.getBoundingClientRect().top + element.clientTop
      return { top, bottom: top + element.clientHeight }
    },
    scrollBy(delta) {
      const before = element.scrollTop
      const limit = element.scrollHeight - element.clientHeight
      if (delta < 0 ? before <= 0 : before >= limit) {
        remainder = 0
        return false
      }
      if (Math.sign(delta) !== Math.sign(remainder)) remainder = 0
      const distance = delta + remainder
      const step = Math.trunc(distance)
      remainder = distance - step
      if (step) element.scrollBy({ top: step, behavior: 'instant' })
      return true
    },
    frame(callback) {
      const id = view.requestAnimationFrame(callback)
      return () => view.cancelAnimationFrame(id)
    },
    now: () => view.performance.now(),
  }
}
