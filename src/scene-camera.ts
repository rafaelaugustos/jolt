/// <reference types="@nativescript/types-ios/lib/ios/objc-x86_64/objc!SceneKit" preserve="true" />
import { registerNativeProperty, type NativeProperty } from './native-property.js'

/** Perspective SCNCamera field of view in degrees (1..179), on its projectionDirection axis. */
export const sceneKitFieldOfView: (camera: SCNCamera) => NativeProperty<number> =
  registerNativeProperty<number>({
    name: 'jolt.scenekit/field-of-view',
    units: ['degrees on the camera projectionDirection axis'],
    platforms: ['ios'],
    spatial: true,
    encode: (value) => [value],
    decode: (values) => values[0]!,
    validate(value) {
      if (!Number.isFinite(value) || value < 1 || value > 179)
        throw new RangeError(
          'SceneKit field of view needs a finite angle in 1..179 degrees.',
        )
    },
    interpolate: (a, b, t) => Math.max(1, Math.min(179, a + (b - a) * t)),
    create(target) {
      if (
        typeof JoltReferenceProperties === 'undefined' ||
        typeof JoltReferenceProperties.sceneFieldOfView !== 'function'
      )
        throw new Error(
          'SceneKit field of view requires an updated @rafaelaugusto/jolt-native plugin. Update both packages and rebuild the native app.',
        )
      return JoltReferenceProperties.sceneFieldOfView(target as NSObject)
    },
  })
