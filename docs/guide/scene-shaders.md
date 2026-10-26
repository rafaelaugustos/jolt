# SceneKit environment and shader inputs

`sceneKitEnvironmentIntensity(scene)` animates environment illumination. `sceneKitUniform(target, name, options)` animates a declared scalar or vector input of an application's SceneKit shader modifier. Both are optional iOS adapters from `@rafaelaugusto/jolt/native`.

Available since **0.1.0-beta.17**. Install matching `@rafaelaugusto/jolt@0.1.0-rc.1` and `@rafaelaugusto/jolt-native@0.1.0-rc.1`, then rebuild the native app. Updating JavaScript alone cannot install the compiled sinks.

The native helper baseline is iOS 13+ with NativeScript 8.9+; your chosen app/runtime may require newer versions. Android SceneKit rendering is not provided.

<Clip name="scene-shaders-ios" caption="Real XCTest taps on an iOS simulator: environment illumination, a cabin blend and a shader vector follow one source, with pause/resume, seek, image replacement and scene recreation. Playback timing is unchanged. This is not physical-device performance evidence." />

## Environment intensity

```ts
import { sceneKitEnvironmentIntensity } from '@rafaelaugusto/jolt/native'

const environment = sceneKitEnvironmentIntensity(scene)
environment.animate(0.45, { duration: 1200 })
// Later, before destroying the scene:
environment.dispose()
```

The target is an `SCNScene`. Values are finite, nonnegative illumination multipliers; negative spring overshoot is clamped to zero. This adapter does not change `lightingEnvironment.contents`, `background`, lights, exposure or tone mapping. Replacing or removing the environment image leaves intensity ownership intact. With no environment image, changing the multiplier may have no visible effect.

Apple describes the generic material-property intensity as 0–1. Environment multipliers above one are accepted by SceneKit, and the native probe checks 0, 0.45, 1.6 and 4 with image-luminance measurements. These are not calibrated light units or a guarantee about arbitrary HDR ranges. See [Apple's intensity reference](https://developer.apple.com/documentation/scenekit/scnmaterialproperty/intensity).

## Typed shader inputs

The application owns the shader and initializes its values before creating adapters:

```ts
material.shaderModifiers = NSDictionary.dictionaryWithObjectForKey(
  `#pragma arguments
float cabinView;
#pragma body
_output.color.rgb = mix(_output.color.rgb, float3(0.03, 0.04, 0.05), cabinView);`,
  SCNShaderModifierEntryPointFragment,
)
material.setValueForKey(0, 'cabinView') // Setup only

const cabin = sceneKitUniform(material, 'cabinView', {
  type: 'float',
  range: [0, 1],
  units: ['blend fraction'],
  motion: 'appearance',
})
cabin.animate(1, 'smooth')
```

Supported targets are `SCNMaterial` and `SCNGeometry`, using literal Metal declarations under `#pragma arguments`.

| Shader type | Jolt value     | Initial SceneKit value        |
| ----------- | -------------- | ----------------------------- |
| `float`     | number         | NSNumber / numeric KVC value  |
| `float2`    | `[x, y]`       | NSValue containing CGPoint    |
| `float3`    | `[x, y, z]`    | NSValue containing SCNVector3 |
| `float4`    | `[x, y, z, w]` | NSValue containing SCNVector4 |

Declare a finite ordered `range`, one `units` string per component and a `motion` policy. The range applies to every component; sampled spring overshoot is clamped at its boundaries. Vectors are written as one boxed native value. Floating-point readback has the platform's float precision.

A vector is **not automatically a color**. There is no sRGB conversion, premultiplication or implicit alpha meaning. If your shader expects linear RGB or RGBA, initialize and map those components in that space yourself. Existing material-color adapters have a different color contract.

Names must be custom identifiers, without KVC paths or SceneKit's reserved `u_`, `a_`, `v_` and `scn_` prefixes. Setup checks the literal declaration, component type and initialized native value. Undeclared names, arrays, matrices, samplers, structs, conditional/macro-defined schemas and custom `SCNProgram` buffers are unsupported. This bounded declaration check is not a Metal compiler: the application remains responsible for valid shader code and for actually using its input. See [Apple's shader modifier contract](https://developer.apple.com/documentation/scenekit/scnshadable).

## One source, native playback

```ts
import { animate, motionScope, motionValue } from '@rafaelaugusto/jolt'
import { sceneKitEnvironmentIntensity, sceneKitUniform } from '@rafaelaugusto/jolt/native'

const scope = motionScope()
const inside = motionValue(0)
const environment = sceneKitEnvironmentIntensity(scene)
const cabin = sceneKitUniform(material, 'cabinView', {
  type: 'float',
  range: [0, 1],
  units: ['blend fraction'],
  motion: 'appearance',
})
const clamp = (p: number) => Math.max(0, Math.min(1, p))
scope.use(() => environment.bind(inside, (p) => 1.6 - 1.15 * clamp(p)))
scope.use(() => cabin.bind(inside, clamp))
const run = scope.add(animate(inside, 1, { duration: 1800 }))
run.pause()
run.progress = 0.5
run.play()
// Teardown:
scope.dispose()
cabin.dispose()
environment.dispose()
```

This replaces an application `inside.subscribe(...)` loop that assigns the environment intensity and shader value in JavaScript. The inspected car consumer uses a scalar `cabinView` modifier; its airflow emission/transparency already use other adapters. The example intentionally blends the cabin continuously. The original car's threshold toggle is a different visual choice: sampled mappings can interpolate across a threshold, so they are not exact discrete event callbacks.

Normal motion values, numeric derivations and `playbackProgress()` use the existing external-property playback bridge. JavaScript samples mappings at setup and playback boundaries; the compiled Objective-C player performs frame writes on the main thread. Native execution does not imply render-thread isolation or immunity to main-thread contention.

Retained `springValue()` and native gesture outputs cannot be sampled as fixed external-property tracks. Binding those sources rejects explicitly; there is no hidden JavaScript subscription fallback. A live native-source bridge is a separate capability.

## Ownership, reads and lifecycle

Both adapters provide `get`, `set`, `animate`, `bind`, `stop` and `dispose`. Playback supports pause/resume/seek, time scale and scope cleanup. Reads use current model values because these targets have no public presentation getter. Native writes disable implicit SceneKit actions. Remove competing SceneKit animations before transferring ownership to Jolt.

Ownership is per native target and property/uniform name. Different uniforms animate independently; wrappers for the same uniform interrupt the previous owner. An older wrapper's disposal cannot cancel the replacement. Shared materials also share their uniforms.

Changing shader source or assigning a program invalidates the adapter and cancels its playback. Dispose it and create a new adapter after initializing the replacement shader. Comparing source dictionaries cannot detect assigning identical source or a compiler rebuild with unchanged source; explicitly recreate adapters when your application needs that boundary. Native sinks hold targets weakly, and explicit disposal releases ownership/resources.

Environment intensity is non-spatial and retains timing under Reduced Motion. Every uniform declares either `motion: 'appearance'` (retains timing) or `'spatial'` (settles immediately under Reduced Motion). Jolt cannot infer an arbitrary shader's visual effect from its name. Use scope suspension/resumption for backgrounding and dispose before destroying the scene. The native validation report separates actual simulator behavior from physical-device performance claims.
