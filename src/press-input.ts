import { isIOS, type EventData, type View } from '@nativescript/core'

/** Keep feedback input observational: NativeScript's iOS touch recognizer also
 * forwards touches to UIView, which can dispatch UIButton actions twice. */
export function pressInput(view: View, change: (event: EventData) => void): () => void {
  if (!isIOS || typeof UIView === 'undefined') {
    view.on('touch', change)
    return () => view.off('touch', change)
  }
  let input: JoltPressInput | undefined
  let disposed = false
  let generation = 0
  const detach = () => {
    generation++
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
  return () => {
    if (disposed) return
    disposed = true
    view.off('loaded', attach)
    view.off('unloaded', detach)
    detach()
  }
}
