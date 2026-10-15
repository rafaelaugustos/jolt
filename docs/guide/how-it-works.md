# How it works

When an animation starts, Jolt resolves where each property starts from (the value on screen, or the keyframes you gave), and computes the whole curve: easing, keyframes, spring physics and exponential decay. It samples the curve 60 times per second of motion, and keeps keyframe times exact. Linear segments aren't sampled at all. Very long free decays cap sampling at 6,001 keyframes.

The samples go to the platform in one go:

- **iOS**: a `CAKeyframeAnimation` per property on the view's layer (`opacity`, `transform.translation.x`, `transform.scale.y`, `transform.rotation.z`...). Core Animation composes them, so `x` and `scale` can belong to different animations, and plays them in the render server.
- **Android**: an `ObjectAnimator` per property with `Keyframe`s and a linear interpolator, on the view's `alpha`, `translationX`, `scaleY`, `rotation`...

Before playing, the final values are set on the NativeScript view, like `view.animate()` does, so `view.translateX` already holds the target while the animation runs. Stopping writes back the values on screen.

Each running property remembers its curve and start time, so Jolt knows the value and velocity of any property at any moment without asking the platform. That's what lets an interruption pick up the motion where it was. On Android, where an animator starts on the next frame, it reads the value on screen instead.

## Tests

The tests run the engine against a fake platform driver ([`test/helpers.ts`](https://github.com/rafaelaugustos/jolt/blob/main/test/helpers.ts)) with its own clock: it records the keyframes it would play and ends them when the clock passes their end. The iOS and Android drivers are type-checked against the platform typings.
