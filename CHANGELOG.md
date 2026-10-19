# Changelog

## Unreleased

- Add `drag()` and `motionScope().drag()` with axis constraints, bounds, velocity-based snap selection, rubberband, bounded decay, native release keyframes, callbacks, cancellation and reload/scope lifecycle. Add card/panel demos and English/Portuguese guides. Tracking uses synchronous JS pan updates; gesture composition and nested-scroll handoff remain separate work.
- Add `motionScope()` ownership for animations and subscriptions, pause/resume, recycling reset and idempotent disposal; add Vue `useMotionScope()` lifecycle integration.
- Add `motionStates()` with inferred names, absolute visual targets, coordinated interruption and cancellation, plus an upload/retry demo and English/Portuguese guides.
- Clean up active press feedback and older disjoint `v-animate` tracks at unmount without cancelling newer owners.

## 0.1.0-beta.7 (2026-10-19)

- Add native `imageEffect()` ripple, touch distortion and deterministic dissolve for raster images, with playback controls, lifecycle cleanup and reduced-motion fallback. Uses Metal on iOS and AGSL on Android 13+.
- Add optional native `zoomable()` photo gestures with focal pinch, double-tap zoom, bounded pan, dismissal intents, accessible programmatic controls and lifecycle cleanup.
- Coordinate image ownership across `liquid()`, `imageEffect()` and `zoomable()`; replacing an image controller disposes the previous one.
- Add the optional image lab and standalone photo viewer demo, including native gesture checks, transparent/mixed-aspect fixtures and English/Portuguese guides. Rebuild native iOS and Android apps after upgrading to include the new native classes.
- Bring the assistant demo to Android and expand the playground and demo recordings.

## 0.1.0-beta.6 (2026-10-17)

- Add `configure({ reducedMotion })` with `'user'` (default), `'always'` and `'never'`. With Reduce Motion on iOS or Remove animations on Android, translation, scale, rotation, paths, decorations and decay now jump to their end values while opacity and colors still animate; set `'never'` to keep the previous behavior. The iOS effects follow the same preference. Add the controls to the playground and English/Portuguese guides.
- Add `configure({ timeScale })` to slow down or speed up every engine animation on iOS and Android: durations, delays, stagger, sequence positions and spring time stretch together, keyframe density follows playback time, and interruptions keep the value and velocity on screen. Add speed controls to the playground and English/Portuguese guides.
- Add `rollTo()` to change a Label's number and roll only the digits that differ, aligned on the units digit, with a spring, optional stagger and an automatic or explicit direction. Play it with temporary glyph layers on iOS and a native span animator on Android, keep the final text and accessibility in the label throughout, and request tabular figures. Add a balance demo and English/Portuguese guides. Rebuild Android apps to include the native class.
- Animate text on Android with `animateText()`: spans that only affect drawing fade and lift each letter or word under one native animator, while the TextView keeps its layout, truncation, formatted-text spans and accessible text. Disabled animators skip the entrance like Reduce Motion. Rebuild Android apps after upgrading to include the native class.
- Add the `@rafaelaugusto/jolt/vue` entry for NativeScript-Vue 3: `v-animate` plays on mount and on value changes, `v-press` wraps `press()`, and `JoltTransition` animates children in and out through Vue's `BaseTransition`, keeping the element until the leave settles. Register with `app.use()` or import per component; the core stays framework free. Add a playground section and English/Portuguese guides.
- Add `followKeyboard()` to lift a view by its overlap with the software keyboard at the platform's own timing: iOS uses the keyboard notification's duration and curve, and Android 11+ follows the IME frame by frame through a native `WindowInsetsAnimation` callback that works with `adjustResize` and `adjustPan`. The effect writes `translateY`, stops Jolt animations on `y` first and returns a cleanup function. Add a composer to the playground and English/Portuguese guides. Rebuild Android apps to include the native class.
- Add `animateItems()` to play an entrance on ListView rows as they appear, restarting recycled rows or settling them at the end values once an item was shown with `once`. Rows are matched through `itemLoading` and the list's realized views, so CollectionView and sectioned lists work too. Add a list demo and English/Portuguese guides.
- Add SVG motion paths to `animate()` with optional tangent orientation, shared arc-length progress, tween/spring timing, native translation/rotation tracks, playback controls and relative/staggered targets on iOS and Android. Support line, Bézier and arc commands with bounded geometry work; add a flight/orbit demo and English/Portuguese guides.
- Add `at` positions to `sequence()`: signed offsets from the previous arrival, `"<"` for its start, and absolute milliseconds. Preserve early spring arrivals, native Android duration scale, stagger, loading, interruption and cancellation of future steps. Add a timeline demo and English/Portuguese guides.
- Add `scrollLinked()` on iOS and Android to scrub one paused animation from a ScrollView offset, with clamped or descending DIP ranges, horizontal support, restored offsets and unload cleanup. Add a parallax heading and fixed-title crossfade to the playground, plus English and Portuguese guides.
- Keep exact paused endpoints visible on iOS instead of wrapping to the first frame, including colors, decorations, reverse repeats and shorter properties in a longer timeline.

## 0.1.0-beta.5 (2026-10-15)

- Add `pause()`, `play()` and writable `progress` to `animate()` and `decay()`, with native clocks, controlled interruption, delayed and repeated timelines, grouped stagger, unload cleanup and paused haptics. Add a slider demo and English/Portuguese playback guides. Layers keep their own timing on iOS; Android animations share one native elapsed-time marker while active.
- Animate uniform `borderRadius` and `borderWidth` on iOS and Android, iOS outer-shadow opacity, radius and offsets, and Android elevation and translation Z. Preserve interruption, selective stop and native playback. Add a morph demo and English/Portuguese guides with geometry and layout limits. Rebuild Android to include the new native target.
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
