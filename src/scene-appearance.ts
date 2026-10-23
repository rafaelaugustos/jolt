/// <reference types="@nativescript/types-ios/lib/ios/objc-x86_64/objc!SceneKit" preserve="true" />
import { Color } from '@nativescript/core'
import { colorMixer, parseColor, type ColorValue } from './color.js'
import { registerNativeProperty, type NativeProperty } from './native-property.js'

const clamp = (n: number) => Math.max(0, Math.min(1, n))
function scalar(name: string, maximum: number, create: (target: object) => object) {
  return registerNativeProperty<number>({
    name: `jolt.scenekit/${name}`,
    units: [
      name === 'light-intensity'
        ? 'lumens (PBR); 1000 = unit multiplier otherwise'
        : 'opacity fraction',
    ],
    platforms: ['ios'],
    encode: (value) => [value],
    decode: (values) => values[0]!,
    validate(value) {
      if (!Number.isFinite(value) || value < 0 || value > maximum)
        throw new RangeError(`${name} needs a finite value in 0..${maximum}.`)
    },
    interpolate: (a, b, t) => Math.max(0, Math.min(maximum, a + (b - a) * t)),
    create,
  })
}
function color(name: string, create: (target: object) => object) {
  return registerNativeProperty<ColorValue>({
    name: `jolt.scenekit/${name}`,
    // Premultiply the sampled sRGB channels, so native linear interpolation also handles zero alpha.
    units: [
      'premultiplied sRGB red',
      'premultiplied sRGB green',
      'premultiplied sRGB blue',
      'alpha',
    ],
    platforms: ['ios'],
    encode(value) {
      const argb = parseColor(value),
        alpha = (argb >>> 24) / 255
      return [
        (((argb >>> 16) & 255) / 255) * alpha,
        (((argb >>> 8) & 255) / 255) * alpha,
        ((argb & 255) / 255) * alpha,
        alpha,
      ]
    },
    decode(values) {
      const alpha = clamp(values[3]!)
      const channel = (i: number) =>
        Math.round(clamp(alpha ? values[i]! / alpha : 0) * 255)
      return new Color(
        ((Math.round(alpha * 255) << 24) |
          (channel(0) << 16) |
          (channel(1) << 8) |
          channel(2)) >>>
          0,
      )
    },
    interpolate: (a, b, t) => new Color(colorMixer(parseColor(a), parseColor(b))(t)),
    create,
  })
}

/** SCNLight intensity, finite and nonnegative. Non-spatial: retains timing under reduced motion. */
export const sceneKitLightIntensity: (light: SCNLight) => NativeProperty<number> = scalar(
  'light-intensity',
  Infinity,
  (target) => JoltReferenceProperties.sceneLightIntensity(target as NSObject),
)
/** Solid UIColor/CGColor light color. Returns a normalized sRGB Color from get(). */
export const sceneKitLightColor: (light: SCNLight) => NativeProperty<ColorValue> = color(
  'light-color',
  (target) => JoltReferenceProperties.sceneLightColor(target as NSObject),
)
/** SCNMaterial transparency in 0..1; does not change transparencyMode/transparent contents. */
export const sceneKitMaterialTransparency: (
  material: SCNMaterial,
) => NativeProperty<number> = scalar('material-transparency', 1, (target) =>
  JoltReferenceProperties.sceneMaterialTransparency(target as NSObject),
)
/** Solid color diffuse contents only; never converts a texture into a color. */
export const sceneKitMaterialDiffuse: (
  material: SCNMaterial,
) => NativeProperty<ColorValue> = color('material-diffuse', (target) =>
  JoltReferenceProperties.sceneMaterialDiffuse(target as NSObject),
)
/** Solid color emission contents only; does not make the material illuminate nearby geometry. */
export const sceneKitMaterialEmission: (
  material: SCNMaterial,
) => NativeProperty<ColorValue> = color('material-emission', (target) =>
  JoltReferenceProperties.sceneMaterialEmission(target as NSObject),
)
