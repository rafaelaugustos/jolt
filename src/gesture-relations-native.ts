import { isIOS } from '@nativescript/core'
import {
  forgetGestureEndpoint,
  registerGestureEndpoints,
  type GestureEndpoint,
  type GestureRecognizerKind,
  type GestureRelationKind,
} from './core/gesture-relations.js'

interface AndroidPeer {
  isActive(): boolean
  isDisposed(): boolean
  connect(other: AndroidPeer, kind: string): { dispose(): void }
}
export function nativeGestureEndpoints(
  resolve: (kind: GestureRecognizerKind) => UIGestureRecognizer | AndroidPeer | null,
) {
  let disposed = false
  const cache = new Map<GestureRecognizerKind, NativeEndpoint>()
  class NativeEndpoint implements GestureEndpoint {
    constructor(readonly native: UIGestureRecognizer | AndroidPeer) {}
    get disposed() {
      return disposed || (!isIOS && (this.native as AndroidPeer).isDisposed())
    }
    get active() {
      return isIOS
        ? (this.native as UIGestureRecognizer).numberOfTouches > 0
        : (this.native as AndroidPeer).isActive()
    }
    connect(other: GestureEndpoint, kind: GestureRelationKind) {
      if (!(other instanceof NativeEndpoint)) {
        // Each controller owns a factory; the shared brand below validates native endpoints across factories.
        if (!(other as BrandedEndpoint)[nativeBrand])
          throw new TypeError('Gesture runtimes must match.')
      }
      const peer = other as NativeEndpoint
      const link = isIOS
        ? JoltGestureLink.connectOtherRelation(
            this.native as UIGestureRecognizer,
            peer.native as UIGestureRecognizer,
            kind,
          )
        : (this.native as AndroidPeer).connect(peer.native as AndroidPeer, kind)
      return () => link.dispose()
    }
    readonly [nativeBrand] = true
  }
  return {
    endpoint(kind: GestureRecognizerKind = 'pan'): GestureEndpoint {
      if (disposed) throw new Error('Gesture recognizer was disposed.')
      if (!cache.has(kind)) {
        const native = resolve(kind)
        if (!native) throw new TypeError(`This controller does not enable ${kind}.`)
        cache.set(kind, new NativeEndpoint(native))
      }
      return cache.get(kind)!
    },
    dispose() {
      disposed = true
      for (const peer of cache.values()) {
        if (isIOS) JoltGestureLink.detach(peer.native as UIGestureRecognizer)
        forgetGestureEndpoint(peer)
      }
      cache.clear()
    },
  }
}
const nativeBrand = Symbol('Jolt native gesture endpoint')
type BrandedEndpoint = { [nativeBrand]?: boolean }

/** Optional entry for an app-owned UIKit recognizer or Android Jolt GesturePeer.
 * Disposing removes Jolt relationships; the application retains native ownership. */
export function nativeGestureRecognizer(
  native: object,
  kind: GestureRecognizerKind = 'pan',
) {
  if (
    !native ||
    (isIOS
      ? !(native instanceof UIGestureRecognizer)
      : typeof (native as AndroidPeer).connect !== 'function')
  )
    throw new TypeError('Expected an app-owned native recognizer.')
  const peers = nativeGestureEndpoints((requested) =>
    requested === kind ? (native as UIGestureRecognizer | AndroidPeer) : null,
  )
  let disposed = false
  const handle = {
    get disposed() {
      return disposed
    },
    dispose() {
      if (!disposed) {
        disposed = true
        peers.dispose()
        unregister()
      }
    },
  }
  const unregister = registerGestureEndpoints(handle, (requested = kind) =>
    peers.endpoint(requested),
  )
  return handle
}
