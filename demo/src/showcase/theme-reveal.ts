import { Application, isIOS, type EventData, type View } from '@nativescript/core'
import { nextTick, onUnmounted, watch } from 'nativescript-vue'
import { reducedMotion, reveal, type Animation } from '@rafaelaugusto/jolt'
import { colorMode } from './theme'
import { captureTheme, type ThemeSnapshot } from './theme-snapshot'

/** Animate only the visible page, keeping its old palette underneath Jolt's mask. */
export function useThemeReveal() {
  let view: View | undefined
  let active = false
  let suspended = false
  let origin: { x: number; y: number } | undefined
  let animation: Animation | undefined
  let snapshot: ThemeSnapshot | undefined
  let generation = 0

  function stop() {
    generation++
    animation?.stop()
    animation = undefined
    snapshot?.dispose()
    snapshot = undefined
  }

  // A synchronous watcher captures the outgoing frame before Vue patches colors.
  watch(
    colorMode,
    async () => {
      const from = origin
      origin = undefined
      stop()
      if (!active || suspended || !isIOS || !view?.isLoaded || reducedMotion()) return
      const target = view
      const token = generation
      try {
        snapshot = captureTheme(target)
        if (!snapshot) return
        await nextTick()
        if (token !== generation) return
        animation = reveal(target, { from, duration: 560 })
        // reveal() installs its native mask in a microtask; keep the old frame above
        // it until then so the incoming theme never flashes unmasked.
        await Promise.resolve()
        if (token !== generation) return
        snapshot?.revealNewContent()
        await animation.finished
      } finally {
        if (token === generation) stop()
      }
    },
    { flush: 'sync' },
  )

  function suspend() {
    suspended = true
    stop()
  }
  function resume() {
    suspended = false
  }
  Application.on(Application.suspendEvent, suspend)
  Application.on(Application.resumeEvent, resume)
  onUnmounted(() => {
    stop()
    Application.off(Application.suspendEvent, suspend)
    Application.off(Application.resumeEvent, resume)
  })
  return {
    loaded(event: EventData) {
      view = event.object as View
    },
    unloaded() {
      stop()
      view = undefined
    },
    enter() {
      active = true
    },
    leave() {
      active = false
      origin = undefined
      stop()
    },
    fromTap(event: EventData) {
      if (!view) return
      const source = event.object as View
      const position = source.getLocationRelativeTo(view)
      const size = source.getActualSize()
      origin = position && {
        x: position.x + size.width / 2,
        y: position.y + size.height / 2,
      }
      const point = origin
      void nextTick().then(() => {
        if (origin === point) origin = undefined
      })
    },
  }
}
