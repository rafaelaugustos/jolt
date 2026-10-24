# SceneKit camera field of view

`sceneKitFieldOfView(camera)` animates a perspective camera's viewing angle while its position stays fixed. Bind it to the same motion value as paint, lighting or camera pose to coordinate a scene without an application frame loop. This adapter is **iOS-only**, through the optional `@rafaelaugusto/jolt-native` plugin.

<Clip name="scene-camera-ios" caption="iPhone 17 simulator, iOS 26: real SceneKit playback and XCTest taps. A fixed camera zooms from 70° toward 32° while paint and light change; pause/resume, reversal, source replacement, child seeking and scene recreation. Real time, on the main thread; simulator footage." />

Available since **0.1.0-beta.15**. Install matching core/native versions and rebuild the native app:

```sh
npm install @rafaelaugusto/jolt@0.1.0-beta.17 @rafaelaugusto/jolt-native@0.1.0-beta.17
```

The platform minimum remains NativeScript 8.9 and iOS 13; native validation used Core 9.1.3, runtime 9.1.0 and an iOS 26 simulator.

## A camera angle in degrees

```ts
import { sceneKitFieldOfView } from '@rafaelaugusto/jolt/native'

const fov = sceneKitFieldOfView(cameraNode.camera!) // SCNCamera, not SCNNode
const zoom = fov.animate(32, 'smooth')
zoom.pause()
zoom.progress = 0.5
zoom.play()

fov.get() // current native model angle in degrees
fov.set(70) // stops the current Jolt owner and applies immediately
// Before destroying the scene:
fov.dispose()
```

The supported range is **1–179 degrees, inclusive**. This is Jolt's conservative perspective range, avoiding degenerate near-zero/180° projections. Initial angles, explicit destinations and every binding sample must be finite and in range. Invalid inputs fail before replacing a working owner. Springs clamp overshoot to that range; custom mappings must produce valid angles themselves. Tween interpolation is linear in degrees before applying the chosen easing, not linear in magnification.

The target's `projectionDirection` selects the vertical or horizontal angle; Jolt preserves it. SceneKit derives the other axis from the viewport aspect ratio. Resizing the viewport therefore changes the complementary viewing angle, not the bound value. Zooming this way changes perspective; moving the camera with `sceneKitPose(cameraNode)` is a separate operation.

Only **automatic perspective projection** is supported. Orthographic cameras use `orthographicScale`, and a custom `projectionTransform` owns its own projection. The factory rejects both configurations without modifying them. If either is installed during playback, the native player stops and leaves that app-owned configuration intact. Release any source binding and dispose the wrapper before configuring/replacing the camera. Recreate a binding after restoring a supported automatic perspective camera.

The compiled sink checks public projection results at two viewport aspect ratios. It neither reads private camera flags nor overwrites a custom matrix to test whether FOV works. A fixed custom matrix is rejected even when it numerically matches one standard viewport's projection.

## Shared motion and playback

```ts
import { animate, motionScope, motionValue } from '@rafaelaugusto/jolt'
import { sceneKitFieldOfView, sceneKitLightIntensity } from '@rafaelaugusto/jolt/native'

const progress = motionValue(0)
const scope = motionScope()
const fov = sceneKitFieldOfView(cameraNode.camera!)
const light = sceneKitLightIntensity(keyLight)

scope.use(() => fov.bind(progress, (p) => 70 - p * 38))
scope.use(() => light.bind(progress, (p) => 550 + p * 350))
scope.add(animate(progress, 1, { duration: 2000, ease: 'sineInOut' }))

scope.suspend() // holds the source and releases its bindings
scope.resume() // reattaches bindings and resumes previously running work

// Before destroying camera/light targets:
scope.dispose()
fov.dispose()
light.dispose()
```

Numeric derived values and `playbackProgress(animation)` work with the same `bind()` contract. Mapping functions run while preparing/rebuilding samples, so keep them pure. Source commands and gesture events still enter JS; autonomous native interpolation/writes request no JS observation frames. NativeScript JS and these SceneKit writes share the main thread, so busy JS can stall camera updates.

Use `timeline()` to coordinate separate camera/light/material playback handles. It supports joint pause/resume/stop; seek individual finite handles where supported. The demo deliberately keeps camera position fixed so the visible size change comes from FOV, and binds paint to the same source while a second timeline participant controls lighting.

## Lens ownership and interruption

SceneKit couples `fieldOfView`, `focalLength` and `sensorHeight`: an FOV write recalculates focal length, and changing either lens property can recalculate FOV. Those side effects are part of SceneKit's camera model, documented by Apple in [fieldOfView](https://developer.apple.com/documentation/scenekit/scncamera/fieldofview) and [projectionDirection](https://developer.apple.com/documentation/scenekit/scncamera/projectiondirection).

Stop/release the FOV animation or binding before an app changes focal length, sensor height, projection direction or projection mode. Set the desired camera configuration, then hand control back. Independent app animation of these coupled properties competes with Jolt; valid external lens changes are not automatically treated as a new owner and can be overwritten by the next FOV sample. Jolt does not change near/far planes, focus distance, depth of field or camera pose.

A standalone `SCNCamera` has no public presentation getter. `get()` and interruption read the **current model angle**, which is the latest immediate Jolt write during Jolt-owned playback and can lag rendered presentation by a frame. Writes use a SceneKit transaction with implicit actions disabled, including inside an outer animated transaction. Jolt does not recover the displayed intermediate FOV of an app-owned SceneKit animation: remove competing animations and establish the handoff value first.

Wrappers for the same camera FOV share ownership, including when several nodes reference that camera. Disposing an old wrapper does not stop a newer owner's animation. Pose, light and material adapters keep their independent properties. Native sink targets are weak; JS wrappers retain camera identity until `dispose()`, so explicitly release them before scene destruction.

## Lifecycle and reduced motion

FOV is **spatial motion**. Under reduced motion, new direct animations settle immediately, and bindings use the source track's destination when preparing a new active track. Changing the preference does not retroactively rebuild every submitted native animation. To react immediately, stop and apply the intended angle or start the replacement source command after updating the preference. Pausing a source holds its current value. Lighting and color adapters retain their non-spatial policy.

Tracks follow Jolt's `timeScale` when prepared. Raw property adapters do not install an automatic background policy: their wall clock can advance while display-link delivery is suspended. For a held scene, suspend the scope on `Application.suspendEvent` and resume intentionally. A manually paused handle remains paused. Keep property wrappers outside a scope that must survive suspension; use the scope for handles and binding factories, as above.

Replace an app's per-frame subscription with a native binding:

```ts
// Remove the old subscription that assigned camera.fieldOfView on each callback.
const fov = sceneKitFieldOfView(camera)
const release = fov.bind(progress, (p) => 70 - p * 38)
// At teardown:
release()
fov.dispose()
```

The [native validation report](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/scene-camera.md) covers projected geometry, viewport changes, lens coupling, interruption, unsupported projections, scopes and main-thread contention. Orthographic-scale animation, arbitrary lens controls and Android 3D renderer integration are separate work.
