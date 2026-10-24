/// <reference types="@nativescript/types-ios/lib/ios/objc-x86_64/objc!SceneKit" preserve="true" />
import {
  nativePropertyTarget,
  registerNativeProperty,
  type NativeProperty,
} from './native-property.js'

export type SceneUniformType = 'float' | 'float2' | 'float3' | 'float4'
export type SceneUniformValue<T extends SceneUniformType> = T extends 'float'
  ? number
  : T extends 'float2'
    ? readonly [number, number]
    : T extends 'float3'
      ? readonly [number, number, number]
      : readonly [number, number, number, number]
export interface SceneUniformOptions<T extends SceneUniformType> {
  type: T
  /** Finite inclusive limits applied to every component; spring overshoot is clamped. */
  range: readonly [number, number]
  /** One application-defined unit per component. Vectors have no implicit color conversion. */
  units: readonly string[]
  /** Spatial uniforms jump under Reduced Motion; appearance uniforms keep their timing. */
  motion: 'spatial' | 'appearance'
}
function runtime() {
  if (typeof JoltSceneShaderProperties === 'undefined')
    throw new Error(
      'Update @rafaelaugusto/jolt-native and rebuild the native app to use SceneKit environment and shader adapters.',
    )
  return JoltSceneShaderProperties
}
function sink(
  create: (error: interop.Reference<NSError>) => JoltPropertySink | null,
): JoltPropertySink {
  const error = new interop.Reference<NSError>()
  const result = create(error)
  if (!result)
    throw new Error(
      error.value?.localizedDescription ??
        'Invalid SceneKit property target or shader schema.',
    )
  return result
}

/** Scene environment multiplier, nonnegative; leaves the environment/background images untouched. */
export const sceneKitEnvironmentIntensity: (scene: SCNScene) => NativeProperty<number> =
  registerNativeProperty<number>({
    name: 'jolt.scenekit/environment-intensity',
    units: ['environment illumination multiplier'],
    platforms: ['ios'],
    encode: (value) => [value],
    decode: (values) => values[0]!,
    validate(value) {
      if (!Number.isFinite(value) || value < 0)
        throw new RangeError('Environment intensity must be finite and nonnegative.')
    },
    interpolate: (a, b, t) => Math.max(0, a + (b - a) * t),
    create: (target) =>
      sink((error) => runtime().environmentError(target as NSObject, error)),
  })

/** Declared Metal shaderModifiers input, initialized by the application before attachment. */
export function sceneKitUniform<T extends SceneUniformType>(
  target: SCNMaterial | SCNGeometry,
  name: string,
  options: SceneUniformOptions<T>,
): NativeProperty<SceneUniformValue<T>> {
  if (
    typeof name !== 'string' ||
    !/^[A-Za-z][A-Za-z0-9_]*$/.test(name) ||
    /^(u_|a_|v_|scn_)/.test(name)
  )
    throw new TypeError(
      'Use a declared custom uniform identifier without a reserved SceneKit prefix or KVC path.',
    )
  if (!options || !['float', 'float2', 'float3', 'float4'].includes(options.type))
    throw new TypeError('Shader uniforms support float, float2, float3 and float4.')
  const count = options.type === 'float' ? 1 : Number(options.type.slice(-1))
  const range = options.range
  if (
    !Array.isArray(range) ||
    range.length !== 2 ||
    !range.every((n) => Number.isFinite(n) && Math.abs(n) <= 3.4028234663852886e38) ||
    range[0] >= range[1]
  )
    throw new RangeError('Declare an ordered finite range for the shader components.')
  if (
    !Array.isArray(options.units) ||
    options.units.length !== count ||
    options.units.some((unit) => typeof unit !== 'string' || !unit.trim())
  )
    throw new TypeError('Declare one nonempty unit for each shader component.')
  if (!['spatial', 'appearance'].includes(options.motion))
    throw new TypeError('Declare whether the shader motion is spatial or appearance.')
  // Copy the schema: caller mutation cannot change an already attached native sink.
  const [low, high] = range,
    type = options.type,
    units = [...options.units]
  const vector = (value: SceneUniformValue<T>): number[] => {
    const values = type === 'float' ? [value] : value
    if (
      !Array.isArray(values) ||
      values.length !== count ||
      values.some(
        (n) => typeof n !== 'number' || !Number.isFinite(n) || n < low || n > high,
      )
    )
      throw new RangeError(
        `${name} needs ${count} finite component(s) in ${low}..${high}.`,
      )
    return [...values] as number[]
  }
  return nativePropertyTarget(target, {
    name: `jolt.scenekit/uniform-${name}`,
    units,
    platforms: ['ios'],
    spatial: options.motion === 'spatial',
    encode: vector,
    decode: (values) =>
      (type === 'float' ? values[0]! : [...values]) as SceneUniformValue<T>,
    interpolate(a, b, t) {
      const first = vector(a),
        last = vector(b)
      const result = first.map((value, i) =>
        Math.max(low, Math.min(high, value + (last[i]! - value) * t)),
      )
      return (type === 'float' ? result[0]! : result) as SceneUniformValue<T>
    },
    create: (object) =>
      sink((error) =>
        runtime().uniformNameConfigurationError(
          object as NSObject,
          name,
          JSON.stringify({ type, low, high }),
          error,
        ),
      ),
  })
}
