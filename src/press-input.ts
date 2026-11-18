import { registerGestureEndpoints } from './core/gesture-relations.js'
import { nativeGestureEndpoints } from './gesture-relations-native.js'
import { isIOS, type EventData, type View } from '@nativescript/core'

/** Keep feedback input observational: NativeScript's iOS touch recognizer also
 * forwards touches to UIView, which can dispatch UIButton actions twice. */
export function pressInput(view: View, change: (event: EventData) => void): () => void {
  if (!isIOS || typeof UIView === 'undefined') {
    view.on('touch', change)
    let gate: org.rafaelaugusto.jolt.GestureInput | undefined
    let peers: ReturnType<typeof nativeGestureEndpoints> | undefined
    let disposed = false
    const detach = () => {
      peers?.dispose()
      gate?.dispose()
      peers = undefined
      gate = undefined
    }
    view.on('unloaded', detach)
    const dispose = () => {
      if (disposed) return
      disposed = true
      detach()
      view.off('unloaded', detach)
      view.off('touch', change)
    }
    registerGestureEndpoints(dispose, (kind = 'tap') => {
      if (disposed || !view.isLoaded || kind !== 'tap')
        throw new TypeError('Press needs a mounted tap recognizer.')
      if (!gate) {
        gate = new org.rafaelaugusto.jolt.GestureInput(
          view.nativeViewProtected,
          (view as View & { touchListener?: android.view.View.OnTouchListener })
            .touchListener ?? null,
          'tap',
          'both',
        )
        peers = nativeGestureEndpoints(() => gate!.recognizer())
      }
      return peers!.endpoint(kind)
    })
    return dispose
  }
  let input: JoltPressInput | undefined
  let peers: ReturnType<typeof nativeGestureEndpoints> | undefined
  let disposed = false
  let generation = 0
  const detach = () => {
    generation++
    peers?.dispose()
    peers = undefined
    input?.dispose()
    input = undefined
  }
  const attach = () => {
    if (disposed || input || !view.isLoaded) return
    if (typeof JoltPressInput === 'undefined')
      throw new Error('Rebuild the iOS app to install observational press input.')
    const current = ++generation
    input = JoltPressInput.attachChange(view.nativeViewProtected as UIView, (action) => {
      if (!disposed && current === generation)
        change({ eventName: 'touch', object: view, action } as EventData)
    })
  }
  view.on('loaded', attach)
  view.on('unloaded', detach)
  try {
    attach()
  } catch (error) {
    view.off('loaded', attach)
    view.off('unloaded', detach)
    throw error
  }
  const dispose = () => {
    if (disposed) return
    disposed = true
    view.off('loaded', attach)
    view.off('unloaded', detach)
    detach()
  }
  registerGestureEndpoints(dispose, (kind = 'tap') => {
    if (kind !== 'tap' || !input || disposed)
      throw new TypeError('Press needs a mounted tap recognizer.')
    peers ??= nativeGestureEndpoints(() => input!)
    return peers.endpoint(kind)
  })
  return dispose
}
