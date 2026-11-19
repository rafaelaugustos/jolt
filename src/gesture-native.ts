import { isIOS, type View } from '@nativescript/core'
import { liveValueInput, type DerivedValue } from './motion-value.js'
import { nativeLiveNode } from './live-spring-driver.js'
import { retainScrollDelegate } from './driver/ios-scroll-delegate.js'
import { nativeGestureEndpoints } from './gesture-relations-native.js'
import type { GestureEndpoint, GestureRecognizerKind } from './core/gesture-relations.js'

export interface GestureSettings {
  axis: number
  threshold: number
  failOffset: number
  pinch: boolean
  rotate: boolean
  tap: boolean
  doubleTap: boolean
  contactEvents: boolean
  minX: number
  maxX: number
  minY: number
  maxY: number
  minScale: number
  maxScale: number
}
export interface GestureDriver {
  endpoint?(kind?: GestureRecognizerKind): GestureEndpoint
  readonly active: boolean
  cancel(): void
  enabled(value: boolean): void
  settle(values: readonly number[], animated: boolean): void
  bounds(settings: GestureSettings): void
  dispose(): void
}
export function createGestureDriver(
  surface: View,
  scroll: View | undefined,
  values: readonly DerivedValue[],
  options: GestureSettings,
  callback: (state: number, vx: number, vy: number) => void,
): GestureDriver {
  const inputs = values.map(liveValueInput)
  const nodes = inputs.map((input) => nativeLiveNode(input.node))
  const changed = (state: number, vx: number, vy: number) => {
    for (const input of inputs) input.changed()
    callback(state, vx, vy)
  }
  const json = JSON.stringify(options)
  if (isIOS) {
    if (typeof JoltGestureSession === 'undefined')
      throw new Error('Rebuild the native app to use gestures().')
    if (
      options.contactEvents &&
      typeof JoltGestureSession.supportsContactEvents !== 'function'
    )
      throw new Error(
        'Rebuild the native app to use gesture contact events and bottomSheet().',
      )
    if (scroll && typeof JoltGestureSession.supportsScrollAdapters !== 'function')
      throw new Error('Rebuild the native app to use scroll handoff adapters.')
    const [x, y, scale, rotation] = nodes as [
      JoltLiveSpring,
      JoltLiveSpring,
      JoltLiveSpring,
      JoltLiveSpring,
    ]
    const native = JoltGestureSession.attachScrollXYScaleRotationOptionsOnState(
      surface.nativeViewProtected,
      scroll?.nativeViewProtected ?? null,
      x,
      y,
      scale,
      rotation,
      json,
      changed,
    )
    const releaseDelegate = scroll
      ? retainScrollDelegate(scroll, () => native.refreshScrollDelegate())
      : () => {}
    const peers = nativeGestureEndpoints((kind) => native.recognizer(kind))
    return {
      endpoint: peers.endpoint,
      get active() {
        return native.active
      },
      cancel: () => native.cancel(),
      enabled: (value) => native.setEnabled(value),
      settle: (values, animated) => {
        native.settleXYScaleRotationAnimated(
          values[0]!,
          values[1]!,
          values[2]!,
          values[3]!,
          animated,
        )
        inputs.forEach((input) => input.changed())
      },
      bounds: (settings) =>
        native.updateLeftRightTopBottom(
          settings.minX,
          settings.maxX,
          settings.minY,
          settings.maxY,
        ),
      dispose: () => {
        peers.dispose()
        releaseDelegate()
        native.dispose()
      },
    }
  }
  if (
    options.contactEvents &&
    typeof org.rafaelaugusto.jolt.GestureSession.supportsContactEvents !== 'function'
  )
    throw new Error(
      'Rebuild the native app to use gesture contact events and bottomSheet().',
    )
  if (
    scroll &&
    typeof org.rafaelaugusto.jolt.GestureSession.supportsScrollAdapters !== 'function'
  )
    throw new Error('Rebuild the native app to use scroll handoff adapters.')
  const [x, y, scale, rotation] = nodes as [
    org.rafaelaugusto.jolt.LiveSpring,
    org.rafaelaugusto.jolt.LiveSpring,
    org.rafaelaugusto.jolt.LiveSpring,
    org.rafaelaugusto.jolt.LiveSpring,
  ]
  const native = new org.rafaelaugusto.jolt.GestureSession(
    surface.nativeViewProtected,
    scroll?.nativeViewProtected ?? null,
    x,
    y,
    scale,
    rotation,
    json,
    new org.rafaelaugusto.jolt.GestureSession.Listener({ onState: changed }),
  )
  const peers = nativeGestureEndpoints((kind) => native.recognizer(kind))
  return {
    endpoint: peers.endpoint,
    get active() {
      return native.isActive()
    },
    cancel: () => native.cancel(),
    enabled: (value) => native.setEnabled(value),
    settle: (values, animated) => {
      native.settle(values[0]!, values[1]!, values[2]!, values[3]!, animated)
      inputs.forEach((input) => input.changed())
    },
    bounds: (settings) =>
      native.updateBounds(settings.minX, settings.maxX, settings.minY, settings.maxY),
    dispose: () => {
      peers.dispose()
      native.dispose()
    },
  }
}
