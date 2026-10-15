# Changelog

## Unreleased

- Add an Android busy-JavaScript demo and repeatable benchmark comparing Jolt, `withLayer()` and a native reveal, with the same 300 ms CPU task on the main thread or a worker. Document the UI-thread limit and worker mitigation in English and Portuguese.

## 0.1.0-beta.4 (2026-10-15)

- Animate background, border and text colors on iOS and Android through `animate()`, with OKLab interpolation, native keyframes, interruption and selective stopping. Add a palette demo and native Android color target. Rebuild Android apps after upgrading to include the native code.
- Add iOS `liquid()` texture deformation for raster images, with native looping, pause/resume, image restoration, lifecycle cleanup and Reduce Motion support. Use it on the assistant's voice orb.
- Add an interactive iOS assistant demo with animated text, spring-driven tool cards, voice and chat transitions, document previews and a replay of the full flow. Keep the animation playground available on both platforms.

## 0.1.0-beta.3 (2026-10-15)

- Keep Android sequence arrivals and interrupted velocity on the native animation clock, respecting animator duration scale, delays, repeats and disabled animations.
- Temporarily cache eligible Android containers in hardware layers during opacity animations, restoring them on completion, stop, replacement or unload. Preserve app-configured layers and skip oversized content trees.
- Apply the view's perspective and display density to Android X/Y rotation animations, including flips ending at zero.
- Add `decay()` with exponential translation, projected snap points and shared interruption and stopping with `animate()`.
- Add iOS `reveal()` and `conceal()` with circular masks, native completion, continuous reversal and Reduce Motion support.
- Add iOS `loader()` indicators with dots, bars and ring styles, native replication, layout updates and a static Reduce Motion fallback.
- Add iOS `animateText()` entrances by composed letter or word, with native glyph playback, one accessible Label, cancellation and Reduce Motion support.

## 0.1.0-beta.2 (2026-10-14)

- Add iOS `confetti()` and configurable `particles()` emitters, with native playback, automatic burst cleanup and Reduce Motion support.
- Add opt-in iOS haptic feedback at animation arrival or explicit progress points, with cancellation on interruption, stop and unload.
- Add `shimmer()` for iOS loading placeholders, with native looping, layout updates, mask preservation and Reduce Motion support.
- Add `symbolEffect()` for iOS 17+ SF Symbols: bounce, pulse, scale, variable color and animated replacement, with native completion and cancellation.
- Request up to 120 Hz for native iOS animations on compatible displays. iPhone apps must enable `CADisableMinimumFrameDurationOnPhone` in Info.plist; iOS chooses the actual refresh rate.
- Add an on-device iOS startup benchmark for 50 and 200 staggered views, with recorded iPhone measurements.

## 0.1.0-beta.1 (2026-10-14)

- Make attention presets relative to the view's current values, preserving existing position, rotation, scale and opacity. Custom animations can opt in with `relative: true`; `relative: false` keeps absolute keyframes.
- Register custom presets with `definePreset` and extend `Presets` to use typed names in `animate()` and `sequence()`.
- Stop selected properties with `stop(view, ['x', 'scale'])` while the others keep animating. `scale` stops both axes.
- Keep infinite animations running after returning from the background on iOS. Their `finished` promise stays pending until they are stopped or replaced.
- Add the documentation site with English and Portuguese guides.

## 0.1.0-beta.0 (2026-10-13)

First release. It's a beta: the engine is covered by tests against a fake platform driver, and has been checked on the iOS simulator and the Android emulator, but hasn't been through real apps yet.

- `animate()` for opacity, translation, scale and rotation (2D and 3D), with keyframes and `null` for the current value.
- Tweens with named easings, cubic beziers or any function, an easing per segment and keyframe `times`.
- Springs with real physics, described by `bounce` and `duration` or by stiffness, damping and mass, plus `smooth`, `snappy` and `bouncy`.
- Curves are computed once and played as native keyframes: Core Animation on iOS, `ObjectAnimator` on Android.
- An animation that takes over a property starts from the value on screen, with its velocity.
- 25 presets, from `fadeInUp` and `popIn` to `shake`, `jelly` and `spin`.
- `delay`, `repeat` (including `Infinity`) and `repeatType: 'reverse'`, played natively.
- Several targets at once, with `stagger`.
- `sequence()`, which moves on once a step looks done and keeps later steps in their starting state.
- `press()` for touch feedback.
- Views that aren't loaded yet take their first keyframe and play once on screen.
