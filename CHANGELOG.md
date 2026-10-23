# Changelog

## Unreleased

- Add optional iOS SceneKit environment-intensity and typed shader-modifier uniform adapters. Support scalar/vector schemas, native playback, shared value bindings, per-uniform ownership and source invalidation. Include a real native demo, recording and EN/PT guides; requires rebuilding the matching optional native plugin.

## 0.1.0-beta.16 (2026-10-23)

- Add the optional `@rafaelaugusto/jolt/gestures` entry with `GestureSurface` and `gestures()`: simultaneous native pan/pinch/rotation, single/double-tap arbitration, axis thresholds, pointer rebasing and handoff with a descendant vertical Core ScrollView. Read-only outputs bind to views and live spring followers; native settling preserves release velocity and supports updated bounds, cancellation and scope cleanup. Include six reviewed iOS/Android recordings and English/Portuguese guides. Rebuild native apps; third-party list adapters and arbitrary external recognizer graphs are not included.
- Preserve the layout origin of iOS views with a nonzero initial live binding when NativeScript lays out or resizes them. Add a native regression that measures their actual location.

- Add `springValue()` with retained native position/velocity, follower chains, numeric mappings, transform/opacity bindings and named layers. The live path uses native display callbacks; fixed-target animations retain their existing playback path. Include scoped cleanup, rest/wake behavior, reduced motion, bounded delayed-frame integration, native checks and reviewed iOS/Android demo recordings in English/Portuguese guides. Rebuild the native app to include the new core classes.

- Add a native CI gate with production JavaScript on iOS simulators and Android emulators: 11 behavior groups, 20 real-size checks and a deliberate geometry failure that must be detected.
- Refresh the website, installation instructions and English/Portuguese guides with eight new reviewed native recordings.

## 0.1.0-beta.15 (2026-10-23)

- Add `animateSize()` for real width, height and intrinsic `auto` transitions in StackLayout/GridLayout, including inside ScrollView. Text reflows and neighboring controls follow the actual bounds. Support combined axes, content changes, interrupted retargeting, pause/resume, hold/restore cancellation, motion scopes and Reduced Motion. This API performs JavaScript measurement/layout on the UI thread each frame; existing `animateLayout()` keeps its FLIP behavior.
- Add the iOS `sceneKitFieldOfView(camera)` adapter for perspective camera angles, with native playback, motion-value bindings, timeline coordination, ownership validation and lifecycle cleanup. Requires matching core/native beta.15 packages and a native app rebuild. Orthographic/custom projections are unsupported; native writes share the main thread.
- Add an SVG opacity/rotation reproduction and regression evidence for iOS. The reported neighboring-image copies were not reproducible in the tested scenarios; this release does not claim a driver fix for that report.
- Include four inspected native recordings with English/Portuguese guides and validation reports. Refresh the website's release highlights, installation instructions and execution-cost descriptions.

## 0.1.0-beta.14 (2026-10-22)

- Add Android haptics at spring arrival or explicit playback points, respecting system/view feedback settings, pause/resume, seek, interruption, reduced motion and Animator duration scale. Native timing markers dispatch discrete JS boundary callbacks; there is no haptic frame loop. Styles depend on device hardware and are not calibrated intensity levels.
- Bind gradient angle, center, radius, colors and stops to motion/derived values and observable playback on iOS and Android. Share source timing, support scalar layers and scope lifecycle, and extend the Vue directive. Native playback uses bounded sampled windows; setup, gestures and window rebuilds still use JavaScript.
- Add native Android `particles()` and `confetti()` with circles, rings and rectangles, continuous/finite emission, gravity, spin, resize and window-relative bursts. Native simulation and cleanup require no per-frame JS callback. Preserve touch input, cancel on background/unload/reduced motion, and respect disabled Android animators. Rebuild Android apps to include the bundled Java classes and bridge metadata.
- Add five iOS SceneKit adapters in `@rafaelaugusto/jolt/native`: light intensity/color, material transparency and solid diffuse/emission colors. Support common playback, shared motion-value bindings, scalar charge layers, timeline controls and explicit scope lifecycle. Validate native targets/contents, preserve shared-property ownership and disable implicit SceneKit actions. Install matching `@rafaelaugusto/jolt-native` beta.14 and rebuild; camera FOV, textures and Android 3D renderer adapters are not included.
- Document native execution and lifecycle limits, including UI-thread contention, gradient sampling windows, hardware-dependent haptics and SceneKit model-value reads. Add eight new inspected recordings and refresh the iOS haptics recording, with English/Portuguese guides and physical Android, emulator and iOS simulator validation reports.

## 0.1.0-beta.13 (2026-10-22)

- Observe motion values and their numeric/color derivations with `subscribe()`, using one shared observation clock and opt-in JavaScript callbacks. Add scope-owned subscriptions and document how they differ from native view bindings.
- Add named additive layers to scalar motion values, preserving the base animation while a pulse or offset runs. Compose before derived mappings, preserve short pulses over long animations, and keep bound views aligned with the source clock.
- Accept descending input ranges in `to()`, including numeric/color mappings and chained derivations, with defined duplicate-stop behavior and clearer validation.
- Add `playbackProgress(animation)` to derive values, bind views or subscribe to an existing finite animation's progress without an application polling loop.
- Add `timeline()` to pause and resume views, motion values, image effects, nested timelines and native properties together, including pending and overlapping steps. Motion-value animations now expose playback controls. Arbitrary whole-timeline scrubbing remains unsupported.
- Add the optional `@rafaelaugusto/jolt/native` entry and `@rafaelaugusto/jolt-native` runtime package for registered external native properties. Include MapKit coordinate/camera adapters, Android MapLibre coordinate/camera adapters, and SceneKit node/camera position and orientation. Install the optional package and rebuild the native app to use them; MapLibre remains a separate app dependency and SceneKit is iOS-only.
- Preserve explicitly paused iOS view/image animations through the temporary root-view unload caused by backgrounding, while keeping normal navigation cleanup.
- Document the rolling-label height investigation: explicit `rows="auto"` fixes the model's implicit GridLayout row constraints; the rolling engine did not cause the inflated height.
- Add thirteen inspected native recordings across iOS and Android, plus native playback/binding/lifecycle checks and English/Portuguese guides. Native property setters remove per-frame JavaScript callbacks but still share the UI thread; opted-in subscriptions execute in JavaScript.

## 0.1.0-beta.12 (2026-10-22)

- Add motion values: `motionValue(initial)` is a number that animates natively and drives every view property bound to it with `bind(views, bindings)`. `to(input, output)` maps it like React Native's `interpolate`, to numbers or colors. `animate()`, `set()` and `stop()` take a value, interruptions carry its velocity to every bound view, and a value outlives its views. Add `useMotionValue()` and `useBinding()` to `/vue`.
- Add layered motion on one property: `animate(view, keyframes, { layer })` plays on top of the property's other animations, translations and rotations adding and scale and opacity multiplying, and `stop(view, properties, { layer })` takes one layer away. While a property has layers they play as one composite native track. `drag()` works with layers.
- Add `scrollValue(scrollView, { axis })` and `useScrollValue()` in `/vue`: a ScrollView's offset as a value that bindings follow. A value at rest now writes its bound properties directly, one write per property per event.
- Add `drag(view, { axis, value })` to drive a motion value with a gesture instead of moving the view. The release plays natively on every bound view, and grabbing during a release or an `animate(value)` stops the value where it is.
- Let a per-property transition over a tween change only what it sets, so `opacity: { times }` keeps the main duration and easing instead of falling back to 300 ms. Options passed to a preset merge the same way, so a preset with a new duration keeps its rhythm. Over a spring, a property's transition still replaces the curve.
- Add the `quad`, `cubic`, `quart`, `quint`, `sine` and `expo` easings with `In`, `Out` and `InOut` variants, and lead the transitions guide with the 300 ms `easeOut` tween default.
- Let a `motionStates` transition set targets apart by name, so one controller can spring one target in while another tweens in later.
- Add the `v-gradient` directive and `motionScope().gradient()`, which removes the gradient with the scope.
- Keep iOS linear gradient bands square to the angle on views that aren't square, matching Android and CSS.
- Report the keyboard with `onKeyboard()` and move views with `followKeyboard()` on Android 7 to 10, from the window's visible frame and the keyboard's measured timing. Rebuild Android apps to include the new native classes.
- Accept a `[min, max]` range in `repeatDelay` to draw a new wait before each repeat. An endless loop draws sixteen and loops them natively, and every property and view of one `animate()` call shares the draw.
- Explain why a group that draws outside its bounds can't fade as one image on Android, and how to fade it as one by fading a larger container.
- Record demos for motion values, layers, scroll values, drag values, easing curves, per-target transitions, gradients, the gradient directive, the Android 9 keyboard and random pauses on the iOS simulator and the Android emulators.

## 0.1.0-beta.11 (2026-10-21)

- Add `gradient(view, options)` for native linear, radial and conic gradients behind a layout's children, with animated colors, stops, angle, center and radius on springs, tweens and repeats. Angles follow CSS and colors mix in OKLab. iOS uses a `CAGradientLayer` with Core Animation keyframes; Android uses a new native drawable and animator. Rebuild Android apps to include it.
- Keep motion state when a view is recreated: `motionStates` targets can start as `null`, `attach(target, view)` gives a new view the current state at once or joins the transition in progress, and `ref(target)` returns a stable callback for template refs.
- Add `origamiSpring({ friction, tension })` with React Native's Origami conversion and defaults, and a guide for coming from React Native Animated.
- Record demos for gradients, recreated views and Origami springs on the iOS simulator and the Android emulator.

## 0.1.0-beta.10 (2026-10-21)

- Add `set(target, values)` to apply values at once, stopping whatever animates those properties, so the next animation starts from them. Works with colors, decorations, several targets and views that aren't loaded yet.
- Export `reducedMotion()` and add `onReducedMotion(callback)` to read and watch the preference Jolt applies, following `configure()`, Reduce Motion's notification on iOS and a fresh check on resume on Android. Add `useReducedMotion()` to `/vue`.
- Add `onKeyboard(callback)` and `useKeyboard()` in `/vue`, reporting how much of the window the keyboard covers, its duration and a transition that moves in step with it: the keyboard's own spring on iOS, measured on the simulator, and the IME animation's sampled interpolator on Android 11+ through a new native observer. Rebuild Android apps to include it.
- Animate `followKeyboard()` on iOS: the keyboard notification's duration and curve arrive as plain numbers, and the view used to jump to its position instead of moving with the keyboard.
- Add `repeatDelay` to hold the end value between repeats, never before the first play or after the last, and at both ends with `repeatType: 'reverse'`. The wait is part of the native keyframes.
- Add `easeTrack: true` to run one `ease` over a whole keyframe track with straight lines between keyframes, like React Native's `interpolate`.
- Keep children that draw outside a fading Android container visible: skip the hardware layer for containers with `setClipChildren(false)` and turn off their overlapping-rendering buffer on Android 7+, so a glow larger than its container stays round during and after the fade.
- Move npm's `latest` tag along with each pre-release until a stable version is out.
- Record demos for the keyboard state, repeat delay, track easing and fade overflow, plus the guides that had no recording, in English and Portuguese, and require a recording for every visual change.

## 0.1.0-beta.9 (2026-10-19)

- Add `animateLayout()` and `motionScope().animateLayout()` for direct-child insertion, removal, reorder and resize using native FLIP playback. Preserve existing transforms, coordinate rapid changes, settle temporary offsets on cancellation, and retain newer animation owners. Include optional size scaling and opacity entrances, Reduced Motion, lifecycle cleanup, an interactive Vue demo and English/Portuguese guides. Recycled lists and retained exit animations remain separate work.
- Keep iOS interactive geometry correct when NativeScript assigns a new layout frame while a transform animates toward identity; remove instance hooks when the tracks finish.

## 0.1.0-beta.8 (2026-10-19)

- Add `interactionSurface()` to keep native touch geometry aligned with animated content. Opt-in iOS playback updates actual transforms/opacity through a shared native display link; Android keeps its existing native property driver. Preserve native controls, clipping and gesture delivery; support playback controls and cancellation. Enable it in the drag demo and add OS touch/lifecycle probes and English/Portuguese guides. Rebuild iOS apps to include the native helper.

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
