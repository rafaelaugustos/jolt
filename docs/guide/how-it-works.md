# How it works

When an animation starts, Jolt resolves the starting values and computes the source curve. Numeric springs, decays and tweens use [adaptive keyframes](./transitions#adaptive-keyframes), concentrating detail where linear interpolation needs it. Authored keyframe times stay exact and straight numeric segments keep only their endpoints. Spring settlement, interruption velocity and sequence arrival retain their previous timing contract. Color mixing and composed motion-value mappings keep their separate sampling policies.

The samples go to the platform in one go:

- **iOS**: a `CAKeyframeAnimation` per property on the view's layer (`opacity`, `transform.translation.x`, `transform.scale.y`, `transform.rotation.z`...). Core Animation composes them, so `x` and `scale` can belong to different animations, and plays them in the render server.
- **Android**: an `ObjectAnimator` per property with `Keyframe`s and a linear interpolator, on the view's `alpha`, `translationX`, `scaleY`, `rotation`...

Solid [colors](./colors) use CGColor keyframes on iOS and int keyframes through a native Java target on Android. iOS text uses a UILabel alpha mask so glyph positions stay fixed while the color layer animates.

Before playing, the final values are set on the NativeScript view, like `view.animate()` does, so `view.translateX` already holds the target while the animation runs. Stopping writes back the values on screen.

Each running property remembers its curve and start time. On Android, interruptions read the displayed value and the animator's current play time, so inherited velocity follows the system's animator duration scale. Early spring arrivals use a native timing marker with completion callbacks only; other sequences advance on native completion. Delays, repeats and disabled animations follow the same platform clock, without JavaScript running per frame.

[`animateSize()`](./size) has a different execution path: real dimensions and text reflow require NativeScript measurement/layout on the UI thread each frame. Its library-owned frame callback runs JavaScript; it is not render-server playback. `animateLayout()` still measures once and uses native transform tracks. Opt-in motion-value subscribers, scroll input and timeline callback activation also retain their documented JS costs.

[`springValue()`](./live-springs) uses a separate live path: persistent C/Java spring state, a shared native display callback, and native mappings/layer composition. It does not rebuild keyframe animations on each target update. These callbacks share the UI thread; they are not render-server isolation from busy JavaScript. Fixed-target animations keep the sampled path described above.

The optional [`gestures()`](./gestures) entry recognizes pan/pinch/rotation and coordinates the ScrollView in native code. Retained outputs drive bindings without a JS callback for each movement; requested callbacks and existing Core listeners still execute JavaScript. Recognition and live springs share the UI thread.

## Tests

The tests run the engine against a fake platform driver ([`test/helpers.ts`](https://github.com/rafaelaugustos/jolt/blob/main/test/helpers.ts)) with its own clock: it records the keyframes it would play and ends them when the clock passes their end. The iOS and Android drivers are type-checked against the platform typings.

The native CI fixture also reads presentation-layer/view values on iOS and Android, checks actual dimensions and live follower lifecycle, and verifies an intentional geometry failure. C and Java spring kernels are compiled and compared in deterministic trajectory tests.
