import { isIOS, type View } from '@nativescript/core'
import type { PhysicsSnapshot, PhysicsVector } from './index.js'
export interface CircleDriver {
  enabled(active: boolean): void
  resize(width: number, height: number): void
  impulse(index: number, x: number, y: number): void
  reset(): void
  snapshot(): Omit<PhysicsSnapshot, 'bodies'> & {
    bodies: Omit<PhysicsSnapshot['bodies'][number], 'id'>[]
  }
  dispose(): void
}
interface Configuration {
  width: number
  height: number
  gravity: PhysicsVector
  restitution: number
  damping: number
  bodies: { x: number; y: number; radius: number; mass: number; vx: number; vy: number }[]
}
export type CircleFactory = (
  container: View,
  views: readonly View[],
  options: Configuration,
) => CircleDriver
let override: CircleFactory | undefined
/** Internal test seam; not exported from the physics entry. */
export function setCircleFactory(factory: CircleFactory | undefined) {
  override = factory
}
export const createCircleDriver: CircleFactory = (container, views, options) => {
  if (override) return override(container, views, options)
  if (isIOS) {
    if (typeof JoltCircleWorld === 'undefined')
      throw new Error('Rebuild the native app to use physicsWorld().')
    const native = JoltCircleWorld.createOptions(
      container.nativeViewProtected,
      JSON.stringify(options),
    )
    try {
      views.forEach((v, i) => native.connectIndex(v.nativeViewProtected, i))
    } catch (e) {
      native.dispose()
      throw e
    }
    return {
      enabled: (v) => native.setEnabled(v),
      resize: (w, h) => native.resizeHeight(w, h),
      impulse: (i, x, y) => native.impulseXY(i, x, y),
      reset: () => native.reset(),
      snapshot: () => JSON.parse(native.snapshot()),
      dispose: () => native.dispose(),
    }
  }
  if (
    typeof org === 'undefined' ||
    typeof org.rafaelaugusto.jolt.CircleWorld !== 'function'
  )
    throw new Error('Rebuild the native app to use physicsWorld().')
  const native = new org.rafaelaugusto.jolt.CircleWorld(
    container.nativeViewProtected,
    JSON.stringify(options),
  )
  try {
    views.forEach((v, i) => native.connect(v.nativeViewProtected, i))
  } catch (e) {
    native.dispose()
    throw e
  }
  return {
    enabled: (v) => native.setEnabled(v),
    resize: (w, h) => native.resize(w, h),
    impulse: (i, x, y) => native.impulse(i, x, y),
    reset: () => native.reset(),
    snapshot: () => JSON.parse(native.snapshot()),
    dispose: () => native.dispose(),
  }
}
