# SceneKit lights and materials

Animate light intensity/color, material transparency, and solid diffuse/emission colors through the existing [native property contract](./native-properties). These adapters are **iOS-only** and require the optional `@rafaelaugusto/jolt-native` plugin plus a native rebuild. They do not add an Android 3D renderer, texture blending or shader-uniform support.

Available since **0.1.0-beta.14**. Install matching core and optional native runtime versions, then rebuild the iOS application:

```sh
npm install @rafaelaugusto/jolt@0.1.0-beta.16 @rafaelaugusto/jolt-native@0.1.0-beta.16
```

<Clip name="scene-lighting-ios" caption="iPhone 17 simulator, iOS 26: real SceneKit rendering and XCTest taps. Camera, paint, glass and lighting share native bindings; a scalar charge layer adds a pulse while the base continues. Includes pause/resume, child playback seeking and scene disposal/recreation. Real-time playback on the main thread; no physical-device claim." />

## Properties and units

```ts
import {
  sceneKitLightIntensity,
  sceneKitLightColor,
  sceneKitMaterialTransparency,
  sceneKitMaterialDiffuse,
  sceneKitMaterialEmission,
} from '@rafaelaugusto/jolt/native'

const brightness = sceneKitLightIntensity(light) // SCNLight
const tint = sceneKitLightColor(light)
const opacity = sceneKitMaterialTransparency(material) // SCNMaterial
const paint = sceneKitMaterialDiffuse(material)
const glow = sceneKitMaterialEmission(material)

brightness.animate(1800, { duration: 800, ease: 'sineInOut' })
paint.animate('#14b8a6', 'smooth')
opacity.set(0.6)
```

| Adapter                                  | Target property                 | Accepted values                                                                                               |
| ---------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `sceneKitLightIntensity(light)`          | `SCNLight.intensity`            | Finite numbers ≥ 0. Lumens with physically based lighting; otherwise intensity / 1000 multiplies light color. |
| `sceneKitLightColor(light)`              | `SCNLight.color`                | NativeScript color string or `Color`.                                                                         |
| `sceneKitMaterialTransparency(material)` | `SCNMaterial.transparency`      | Finite numbers in 0–1; 1 is the default opaque multiplier.                                                    |
| `sceneKitMaterialDiffuse(material)`      | `SCNMaterial.diffuse.contents`  | Solid color only: string or `Color`.                                                                          |
| `sceneKitMaterialEmission(material)`     | `SCNMaterial.emission.contents` | Solid color only: string or `Color`.                                                                          |

Native targets must be `SCNLight` or `SCNMaterial` respectively. Existing color contents must be a convertible solid `UIColor` or `CGColor`. Grayscale and Display P3 colors are converted to sRGB; dynamic UIKit colors resolve against the current trait collection when read. Patterns, images, textures, file paths/URLs, layers, numbers and `nil` are rejected before ownership changes. The adapter never silently replaces a texture with a color. If the app later assigns unsupported contents, native playback stops and leaves those contents intact; a new binding is needed after restoring a solid color.

Color `get()` returns a NativeScript `Color`, normalized to 8-bit sRGB/alpha. Animation samples reuse Jolt's [premultiplied OKLab interpolation](./colors), clipped to the sRGB gamut. The native sink receives normalized premultiplied sRGB RGBA vectors (RGB in 0–alpha, alpha in 0–1); it interpolates between sampled vectors, unpremultiplies them and assigns one complete `UIColor`. This preserves transparent endpoints without separate per-channel setter callbacks. Native reads are rounded at the public color boundary, so interruption precision is one 8-bit component. HDR/wide-gamut output beyond sRGB is not retained. Spring overshoot is clamped for color and numeric ranges; binding mappings must return valid values themselves.

Alpha is preserved in the color value; SceneKit's material and lighting rules decide its visual contribution. Use light intensity for brightness and material transparency for an opacity multiplier. These adapters do not change `transparent`, `transparencyMode`, `blendMode`, depth settings, metalness, roughness or shader code. A color alpha of zero is not a general replacement for configuring transparent geometry.

With `physicallyBased`, `lambert`, `phong` or `blinn`, diffuse appearance depends on illumination and other material properties; a black surface in an unlit scene may hide a color change. `constant` displays diffuse color independently of direct lighting. Emission adds an appearance independent of lighting; **it does not illuminate nearby objects**. `shadowOnly` and custom shaders can ignore the normal diffuse/emission contribution. Use an actual light for illumination and configure bloom separately if desired. These are SceneKit rendering rules, described in Apple's [intensity](https://developer.apple.com/documentation/scenekit/scnlight/intensity), [emission](https://developer.apple.com/documentation/scenekit/scnmaterial/emission) and [transparency](https://developer.apple.com/documentation/scenekit/scnmaterial/transparency) references.

## Shared values and charge layers

```ts
import { Color, Application } from '@nativescript/core'
import { animate, motionValue, motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
const charge = motionValue(0)
const brightness = sceneKitLightIntensity(light)
const glow = sceneKitMaterialEmission(material)

scope.use(() => brightness.bind(charge, (n) => 400 + Math.max(0, n) * 1600))
scope.use(() =>
  glow.bind(
    charge,
    (n) => new Color(255, 0, Math.round(Math.min(1, Math.max(0, n)) * 255), 180),
  ),
)
scope.add(animate(charge, 0.6, { duration: 10000, ease: 'linear' }))
scope.animate(charge, [0, 0.5, 0], {
  duration: 1100,
  ease: 'sineInOut',
  repeat: Infinity,
  layer: 'charge',
})
```

The pulse is a layer on a **scalar motion value**; the base continues underneath. This does not add arbitrary colors, materials or quaternion poses. Use `stop(charge, { layer: 'charge' })` to remove just the pulse. A derived value or `playbackProgress(animation)` can also feed `bind()`. The demo uses the same sources for camera pose, light and materials without polling or a JS setter per frame.

Mappings execute while Jolt prepares samples or rebuilds a source track, so keep them pure. Scalar layer composition can rebuild sampling windows in JS; gesture/source events also remain JS boundaries. Native writes run in compiled Objective-C through the existing native player on the main thread. Busy JS on that thread can delay them. A `subscribe(value => sceneKitSetter(value))` callback still runs in JS and is not a native binding.

`animate()` returns the common playback handle: pause/play, finite progress seeking, stop and completion. `timeline()` coordinates these handles for pause/resume/stop; seek an individual handle where supported, since the timeline itself has no progress setter. Invalid targets, colors, numeric ranges and mapped samples are checked before replacing the current owner.

## Interruption, ownership and lifecycle

Two nodes referencing the same `SCNMaterial` or `SCNLight` share its state. Wrappers for the same native instance and property share interruption ownership. Different properties remain independent; disposing an older wrapper cannot stop a newer wrapper's work. Copy the material/light in the app if instances must animate independently.

`sceneKitPose` reads the presentation node on interruption. Standalone lights and materials have no public equivalent presentation getter, so these adapters read their **current model property**. Jolt writes with implicit SceneKit actions disabled; during Jolt-owned playback that model is the latest written sample and retargeting starts there, without a second easing curve. It can lag screen presentation by a render frame. Jolt cannot recover the displayed intermediate value of an app-owned animation on a standalone light/material. Remove competing SceneKit animations/actions/constraints and commit the desired handoff value before giving Jolt control. Stop/release Jolt before handing the property back. SceneKit ownership is exclusive, not an additive blend with SDK animations.

Own playable handles and binding factories in a motion scope. Keep property wrappers outside a scope that you intend to suspend: `scope.add(property)` adopts a disposable resource, so suspension disposes it permanently. Explicitly dispose wrappers at the scene/target destruction boundary:

```ts
const suspend = () => scope.suspend()
Application.on(Application.suspendEvent, suspend)
// On an intentional return to the scene:
scope.resume()

// Before removing/replacing the scene:
Application.off(Application.suspendEvent, suspend)
scope.dispose()
brightness.dispose()
glow.dispose()
```

Suspending pauses playable handles, detaches bindings and removes native players. Explicit resume restarts binding factories and resumes previously running handles; it does not restart a manually paused handle. The demo suspends on background and requires explicit resume. Raw adapters do not install their own app-lifecycle policy: without a scope pause/stop, their wall clock advances while the display link is suspended, and returning may catch up or finish immediately. Do not rely on background execution for native rendering.

Lighting/color/transparency adapters are non-spatial and retain their timing under reduced motion, including pulse timing. `sceneKitPose` is spatial and jumps to its destination when reduced motion is enabled at setup/source rebuild. To avoid decorative blinking, suppress the charge pulse when your app applies reduced motion. A policy change does not retroactively rebuild every existing standalone animation. Both kinds follow Jolt's `timeScale` when creating tracks.

The optional runtime uses weak native targets; wrappers retain target identity until `dispose()`. Dispose before destruction, even for paused bindings, and do not rely on GC. Compiled writes and reads use the main thread; do not call the JS API from a renderer callback on another queue. Minimums remain NativeScript 8.9 and iOS 13; this implementation was validated with NativeScript Core 9.1.3/runtime 9.1.0 and iOS 26. Rebuild with compatible core/native packages containing these adapters; older beta.13 plugin binaries do not contain them.

## Migrating a model's frame loop

Replace polling or a per-frame subscription:

```ts
// Before: app-owned JS write on every observed frame.
const unsubscribe = charge.subscribe((n) => {
  light.intensity = 400 + n * 1600
})

// After: sample the mapping at setup/source boundaries, write natively.
const brightness = sceneKitLightIntensity(light)
const release = brightness.bind(charge, (n) => 400 + Math.max(0, n) * 1600)
// At destruction: release(); brightness.dispose()
```

For a camera, keep using `sceneKitPose(cameraNode)`. Remove the old subscription/timer when installing the binding. The [validation report](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/scene-appearance.md) records native conformance, continuity, layer composition, lifecycle counters, color tolerances and the busy-JS limit.
