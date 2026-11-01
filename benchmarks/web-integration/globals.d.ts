import type { useWebMotion } from '../../src/web/vue/index.js'
import type { WebAnimation } from '../../src/web/public.js'
declare global {
  var oldTarget: HTMLElement
  var oldAnimation: WebAnimation
  var savedMotion: ReturnType<typeof useWebMotion>
  var resourceAudit: () => { listeners: number; observers: number; animations: number }
  var inputSamples: {
    eventToHandlerMs: number
    handlerToPreparedMs: number
    eventToFrameCallbackMs: number
  }[]
}
