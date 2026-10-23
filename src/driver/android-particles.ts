import { Application, Color, Utils, type View } from '@nativescript/core'
import { onReducedMotion, reducedMotion } from '../config.js'
import type { ParticleSettings } from '../particles.js'

type NativeEmitter = org.rafaelaugusto.jolt.ParticleEmitter
const live = new WeakMap<View, { emitter?: NativeEmitter; burst?: NativeEmitter }>()

/** Internal diagnostic seam for native conformance, not a public animation API. */
export function currentAndroidParticles(view: View, overlay = false) {
  return live.get(view)?.[overlay ? 'burst' : 'emitter']
}

export function androidParticles(
  view: View,
  settings: ParticleSettings,
  overlay: boolean,
  owners: WeakMap<View, () => void>,
): () => void {
  let stopped = false,
    queued = false
  let emitter: NativeEmitter | undefined,
    target: android.view.View | undefined,
    unwatch: (() => void) | undefined
  const key = overlay ? 'burst' : 'emitter'
  const stop = () => {
    if (stopped) return
    stopped = true
    view.off('loaded', schedule)
    view.off('layoutChanged', schedule)
    view.off('unloaded', stop)
    view.style.off('borderTopLeftRadiusChange', schedule)
    Application.off(Application.suspendEvent, stop)
    unwatch?.()
    unwatch = undefined
    if (owners.get(view) === stop) owners.delete(view)
    const active = live.get(view)
    if (active && active[key] === emitter) {
      delete active[key]
      if (!active.emitter && !active.burst) live.delete(view)
    }
    const native = emitter
    emitter = target = undefined
    native?.stop()
  }
  const update = () => {
    if (!view.isLoaded) return
    if (reducedMotion()) return stop()
    const native = view.nativeViewProtected as android.view.View | undefined
    if (target && target !== native) return stop()
    if (emitter) {
      emitter.refresh(
        (typeof view.borderRadius === 'number' ? view.borderRadius : 0) *
          Utils.layout.getDisplayDensity(),
      )
      return
    }
    if (!native?.getWindowToken() || native.getWidth() <= 0 || native.getHeight() <= 0)
      return
    const colors = Array.create('int', settings.colors.length)
    settings.colors.forEach((color, i) => {
      colors[i] = new Color(color).argb | 0
    })
    target = native
    emitter = new org.rafaelaugusto.jolt.ParticleEmitter(
      native,
      overlay,
      colors,
      settings.shape === 'circle' ? 0 : settings.shape === 'rectangle' ? 1 : 2,
      settings.source === 'center' ? 0 : settings.source === 'top' ? 1 : 2,
      settings.rate,
      settings.lifetime,
      settings.size,
      settings.velocity,
      settings.velocityRange,
      settings.angle,
      settings.spread,
      settings.gravity,
      settings.spin,
      settings.spinRange,
      settings.fadeOut,
      settings.duration ?? -1,
      new org.rafaelaugusto.jolt.ParticleEmitter.Listener({ onEnd: stop }),
    )
    const active = live.get(view) ?? {}
    active[key] = emitter
    live.set(view, active)
    emitter.refresh(
      (typeof view.borderRadius === 'number' ? view.borderRadius : 0) *
        Utils.layout.getDisplayDensity(),
    )
    emitter.start()
  }
  function schedule() {
    if (stopped || queued) return
    queued = true
    void Promise.resolve().then(() => {
      queued = false
      if (stopped) return
      try {
        update()
      } catch (error) {
        stop()
        throw error
      }
    })
  }
  owners.set(view, stop)
  view.on('loaded', schedule)
  view.on('layoutChanged', schedule)
  view.on('unloaded', stop)
  view.style.on('borderTopLeftRadiusChange', schedule)
  Application.on(Application.suspendEvent, stop)
  unwatch = onReducedMotion((reduced) => {
    if (reduced) stop()
  })
  schedule()
  return stop
}
