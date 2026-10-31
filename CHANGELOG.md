# Changelog

## Unreleased

## 0.1.0-rc.4 (2026-10-31)

- Publish matching core and optional native packages with 74 preview examples in four languages. Rebuild native applications after upgrading: the live nodes gained summed sampled inputs on both platforms, and the Android shape, gradient and blur clocks are rebuilt on resume.
- Compose rolling windows on native live nodes (#260): endless layers and motion-value runs whose periods share no loop under 30 seconds, and finite compositions longer than four seconds, play on a native composer instead of being resampled into four-second tracks for every bound property. On the same phones before and after, boundary submissions went from 384 to 0 and the worst callback gaps for 64 views with three properties from 437–679 ms to 17.5 ms on an ASUS Z017DC and from 100–141 ms to 17–27 ms on an iPhone 17 Pro; both full matrices are accepted. The iPhone composer costs 12–14% of one core for 192 bindings; an app binary without the native classes keeps the sampled windows.
- Continue Android shapes, gradients and blur from the paused time on resume (#264): the native clock is rebuilt after a seek instead of resumed, which Android shifted by the pause duration. The shape audit pauses a stroke mid-flight on both platforms.
- Place the bottom sheet by the host's safe-area insets in DIPs (#267): Core reports them in device pixels on iOS and already lays a host's children out inside them. The panel ignores Core's own adjustment, extends under the home indicator with padding when the host leaves that edge reachable, and ends at the keyboard. The demo gains full-window and edge-to-edge variants with native checks and an iOS recording.
- Offer only the handle actions a stop can take (#268): Expand and Collapse follow the selected stop, Dismiss stays while the sheet is dismissible, and `accessibility.value(point)` formats the spoken value, with none for a single stop.

## 0.1.0-rc.3 (2026-10-31)

- Publish matching core and optional native packages with 74 preview examples in four languages. Rebuild native applications after upgrading. Physical-device acceptance remains open for the gallery, scroll composition and sensors; composition-window rebuild cost is tracked in #260.
- Create shapes before the view loads (#254): `shape()` attaches when the view loads, with the frame it holds at that point, and an animation requested before that starts once the surface attaches. Export `toView()`. The shape lab creates its surfaces on mount, with native audits and launch recordings on both platforms.
- Accept NativeScript-Vue component instances as targets through their `$el` (#255), and describe an unsupported target without stringifying it.

- Complete the bounded physical binding/layer audit (#242) with OS-input-to-native-pose onset, calibrated delay controls, process allocator snapshots and 15 repeated mount/unmount cycles on each phone. Preserve failed/inconclusive attempts and prior diagnostic failures, enforce evidence with offline negative controls, and document workload guidance in four locales. These measurements do not establish input-to-photon latency, universal capacity or unbounded leak freedom.

- Build Android numeric keyframe tracks in one native call (#242), retaining the prior path for older app binaries. Preserve native interpolation, units and playback controls, with on-device equivalence checks and physical workload evidence. Rebuild Android to use the optimization.

- Record physical Android binding/composition observations for #242: all 22 workloads and 66 trials, with 20 verified workloads and two retained sparse-window failures, plus four automated real-input checks. Label unavailable pre-29 thermal telemetry explicitly and allow collection to resume without restarting the app. Preserve existing recordings and document the evidence in four locales. No production animation change; capacity, sparse-window diagnosis, presentation/input latency and heap acceptance remain open.

- Complete the initial rotation/gravity physical acceptance for #114: Android lifecycle and intervals, real iPhone/Android recovery after controlled native service failures, process-cost observations, raw traces and offline negative controls. Reuse the reviewed physical recordings in all four guide locales. No production API/runtime change; deferred sensor types are tracked in #256. Calibrated axis accuracy, presented-frame latency, battery and sustained capacity are not established by these checks.

- Measure existing binding/layer workloads on a physical iPhone and validate them on an Android emulator (#242), with real input, raw evidence, bounded offline checks and reviewed recordings in all four guide locales. Document composition-window costs and cleanup; physical Android capacity, presented-frame/input latency and heap-allocation acceptance remain open. No public API or library runtime change.

- Add `interactiveModal()` to the optional interactive-navigation entry (#26): custom full-window iOS modals follow a downward native pan and settle with Jolt spring physics. Preserve Core/Vue ownership on cancellation, queue an early close, coalesce duplicate requests, respect gesture gates and Reduce Motion, and release native resources on close/disposal. Include simulator input/lifecycle evidence and reviewed English recordings in all four guide locales. Verified with Core 9.1.3 and NativeScript-Vue 3.1.2; rebuild the native app. Native sheet detents, popovers and scroll-to-dismiss handoff are outside this API.

- Make the gallery reference fit enlarged system text (#117): measure its chrome, wrap titles and controls, and bound the scrolling control panel while keeping a separate photo gesture viewport. Opt into iOS Dynamic Type and refresh retained Android SP sizes after configuration changes. Add simulator/emulator text, zoom, rotation and return evidence plus reviewed recordings in all four guide locales. Physical-device and screen-reader acceptance remain open.

- Preserve collapsed scroll-header rows below a growing compact title or pinned section (#116), enforce the iOS native viewport clip, and use an exact Android item/offset target for animated scrolling. Update the reference layout for large system fonts and long titles, with native simulator/emulator checks and recordings in all four guide locales. Rebuild the native app; physical-device and screen-reader acceptance remain open.

- Validate sensor sampling intervals on a physical iPhone (#114): twelve windows cover `auto`, 16/33/100 ms, shared acquisition at different rates, binding removal, resumption and disposal. Add the captured trace, 22 offline negative controls and a reviewed English recording in all four guide locales. This confirms existing native behavior; broader physical acceptance remains open.

- Validate real Core Motion rotation/gravity on a physical iPhone 17 Pro (#114), including shared acquisition, pause/Reduce Motion, background recovery, repeated screen disposal and native commit counters without steady-state JS callbacks. Add the physical trace, offline negative controls and a reviewed English recording in all four guide locales. Android physical evidence and broader axis/access/performance acceptance remain open.

- Validate sensor background/resume and repeated screen reentry (#114) on iOS Simulator and Android emulator. Add fresh lifecycle observations, strict continuity/cleanup verification and reviewed English recordings in all four guide locales. This confirms existing sensor behavior without changing the public API; physical acquisition and performance acceptance remain open.

## 0.1.0-rc.2 (2026-10-29)

- Publish matching core and optional native packages with 74 preview examples in four languages. Rebuild native applications after upgrading. Physical-device acceptance remains open for the gallery, scroll composition, sensors and binding/layer capacity.
- Preserve Core ListView scroll anchors through asynchronous remeasurement, unload/reload and rotation on iOS/Android (#116); include lifecycle and reentry evidence.
- Add Spanish and Simplified Chinese documentation and refresh the homepage demonstrations.

- Validate the Android gallery lifecycle (#117) with actual zoomed rotation, Home/resume, fresh gestures and repeated shared returns. Add reproducible native observations, an offline verifier and a reviewed English recording in all four guide locales. This audit confirms the existing behavior; broader gallery acceptance remains open.

- Fix layered `press()` release/cancellation on a nonzero translation or non-unit scale: restore only the press contribution to neutral and clear it when the effect is removed. Catch compiled view-layer tracks up after native keyframe allocation so preparation time does not shift their phase. Consolidate #152 with real iOS/Android input evidence and four-language execution-path documentation; physical-device capacity measurements remain in #242.

- Preserve the iOS interactive navigation owner across NativeScript's temporary background unload (#26). A held return cancels without changing history; after resume, the same Jolt transition accepts another gesture. Frames or routes actually removed are still cleaned up. Add native suspension/rotation evidence and reviewed recordings in all four documentation locales.

- Add opt-in native spring dragging to `physicsWorld()` (#238): a pointer moves a temporary spring anchor while the body retains finite mass and collision response. Release preserves simulated body velocity for snapping or the resting attachment; cancellation restores the previous dock and clears velocity. Includes a four-language preview, real iOS/Android interaction audits and recordings. Rebuild the native application.

- Consolidate the three delivered physics milestones from #39: finite gravity, native circle collisions, and fixed-point attachments/release snapping. Correct their status across all four documentation locales and index the existing native evidence. The opt-in pointer spring extension is included in this candidate (#238).

## 0.1.0-rc.1 (2026-10-26)

- Start the 0.1.0 release-candidate phase with matching core and optional native packages and 73 preview examples in English, Portuguese, Spanish and Simplified Chinese. Freeze the feature scope; focus subsequent candidates on fixes, compatibility and physical-device acceptance. Rebuild native applications after upgrading from beta.18.
- Keep the declared platform/adapter limits. Physical-device validation for the gallery, scroll composition and sensors remains open in #117, #116 and #114 before stable acceptance; simulator recordings do not establish device performance. Additional frameworks, shader effects, sensor types and general physics remain later work.

- Add optional `@rafaelaugusto/jolt/glass`: native iOS 26 glass containers and surfaces that merge through existing transform playback, with ordinary blur on older iOS and unchanged layouts on Android. Include the four-language Better as one preview, native lifecycle checks and English recordings in both guides.
- Add optional `@rafaelaugusto/jolt/blur`: animated native material intensity on iOS and content blur on Android 12+, with interruption, playback/lifecycle controls and a no-effect fallback. Include the four-language Soft focus preview and English recordings in both guides. Rebuild both platforms to load the helpers.

- Add optional `@rafaelaugusto/jolt/shapes`: native SVG stroke drawing and compatible-path morphing on iOS/Android, presentation-based interruption, playback controls and lifecycle cleanup. Include the 71st four-language preview and English native recordings in both guides. Rebuild Android to load the compiled renderer.

- Extend native circle physics with fixed-anchor springs, velocity-aware release snap points, native tether drawing and `attach()` / `snapTo()` commands. Preserve collisions, cancellation, bounds, sleep and lifecycle ownership. Include the 70th four-language preview and English iOS/Android recordings in both guides. Rebuild the native app; body-to-body joints and general constraints remain outside this #39 milestone.

- Add optional `@rafaelaugusto/jolt/physics` for up to 16 native circles: pair/wall collisions, native drag/release, impulses, bounded fixed-step work, sleep and lifecycle cleanup on iOS/Android. Include the four-language **Better together** preview and English native recordings in both guides. Rebuild the native app. General physics remains tracked in #39.

- Add `{ type: 'gravity' }` for finite ballistic fall and bounce on translations and motion values, with native sampled playback, exact impact seams, inherited velocity and existing playback/scope controls. Include the localized **A softer landing** preview and real iOS/Android recordings. Circle collisions use the optional physics entry; broader physics remains in #39.

- Add optional native rotation/gravity sources through `@rafaelaugusto/jolt/sensors`, with shared hardware subscriptions, demand-driven collection, frame coalescing, quaternion/interface coordinates, scope lifecycle and native spring bindings. Add the localized **Move the light** preview and explicit native sensor test-input playback. Physical-device sensor/performance validation and other sensor types remain tracked in #114.

- Translate the preview into Spanish and Simplified Chinese, including catalog/search, controls, accessibility, status text and the map illustration. Extend automatic phone-language selection and the saved language picker to four languages.

- Add `scrollHeader()` for flat Core ListView: a measured collapsing hero, native parallax/title handoff, pinned section, anchored resizing/insertion and lifecycle cleanup. Include the 66th bilingual preview and real EN/PT iOS/Android recordings. Fixed data rows plus a spacer are the initial supported adapter; physical-device acceptance remains open in #116. Rebuild the native app.

- Added a connected gallery recipe combining native photo zoom/dismiss with current-cell returns. `entry.returnToSource()` captures held/clipped image poses and translation velocity before routing; the 65th EN/PT preview demonstrates the complete interaction with real iOS/Android recordings.

- Resolve shared return targets by stable item key after scrolling, recycling and reordering, with bounded async preparation, cancellation, deleted-item fade and current-item accessibility focus. Add a Core ListView adapter, the 64th bilingual preview and real EN/PT native recordings. Android resolves the live destination after system commitment; iOS defers the shared pair until ready. Rebuild the native app. Physical-device gallery acceptance remains open in #117.

- Add optional `sharedNavigation()` for programmatic image/plain-card transitions between pages in one NativeScript Frame, with native geometry and crop interpolation, rounded clipping, scoped tags, bounded fallback and cleanup.

- Add `sharedNavigationEntry` in the optional shared-navigation entry: native interactive image/card return on stable iOS and Android 14+ pages, cancellable gestures, guarded single commits, bounded snapshots and lifecycle cleanup. Include the 63rd bilingual preview and real EN/PT iOS/Android recordings. Rebuild the native app. Combine with the current-cell resolver and connected gallery included in this candidate.

- Add optional `@rafaelaugusto/jolt/predictive-back` for Android 14+: system-owned edge progress and commit decisions, native Jolt spring settlement, one guarded application commit, reduced motion and lifecycle cleanup. Include the 62nd bilingual preview, real Android recordings and a tracked demo manifest opt-in. Rebuild the native application.

- Add optional `@rafaelaugusto/jolt/interactive-navigation` for iOS Frame pages: native edge-swipe progress, cancellable return and velocity-preserving Jolt spring completion through Core's existing delegate. Include router integration, nested-entry cleanup, reduced motion, the 61st bilingual preview and real iOS recordings. Rebuild the native app. Use shared navigation for image/card morphs and the separate predictive-back entry on Android; arbitrary modals remain unsupported.

- Stabilize native curve sampling checks by waiting past NativeScript's initial macrotask and two display callbacks before reading a held presentation. Preserve the 0.28-DIP assertion and negative controls; add bounded cancellation/timeout tests and structured seek diagnostics to native CI reports. Animation drivers and curve generation are unchanged.

## 0.1.0-beta.18 (2026-10-25)

- Publish matching core and optional native packages with 59 bilingual preview examples and reviewed iOS/Android recordings. Rebuild the native application after upgrading.

- Add the optional development-only `@rafaelaugusto/jolt/inspector` entry: read-only view selection, property ownership/timing, binding graphs, bounded native observation batches, explicit finite-playback scrubbing and reproducible spring tuning. Include the 59th bilingual preview, native overhead/cleanup checks and real iOS/Android recordings. Rebuild the native app for the new dormant probe classes.

- Adapt numeric native keyframes to property error budgets. Use analytical spring/decay bounds, preserve authored seams, cap setup work with an explicit fallback, and keep settlement, interruption velocity and sequence arrival unchanged. Include the bilingual curve comparison, dense-reference/native benchmarks and iOS/Android videos.

- Complete scroll-to-sheet interaction replay with an independent headless contract and the production native consumption policy on iOS/Android. Capture numeric OS contacts, check both owners and cancellation, preserve fractional Android deltas, audit disposal and reject an intentionally wrong scroll checkpoint. Extend preview 57 with EN/PT controls and reviewed videos; reuse the existing native CI group. Rebuild the native app.

- Add optional development interaction traces and controlled-clock replay under `@rafaelaugusto/jolt/testing` and `/testing/native`. Cover interrupted springs and cancelled drags, native presentation tolerances, cleanup, deterministic seeds and failure plots. Preserve incoming spring velocity at the exact handoff instant. Include the 57th bilingual preview, native recordings and a bounded group in the existing native CI.

- Add the optional `@rafaelaugusto/jolt/shared-layout` entry for stable identities within one page: native image/container snapshots, window-relative geometry and corner clips, content crossfades and rapid reversal. Include lifecycle/fallback cleanup, Reduced Motion, the 56th bilingual preview experiment, and real iOS/Android recordings. Rebuild the native app.
- Defer the Android preview’s initial system-appearance lookup until its Application context is available on cold launch.

## 0.1.0-beta.17 (2026-10-24)

- Add the optional `@rafaelaugusto/jolt/bottom-sheet` in-page recipe: native drag/scroll handoff, content and percentage snaps, spring interruption, keyboard following, backdrop/back dismissal, accessibility actions and lifecycle cleanup. Include real iOS/Android recordings and English/Portuguese guides. Native contact callbacks require rebuilding the app.
- Add optional iOS SceneKit environment-intensity and typed shader-modifier uniform adapters. Support scalar/vector schemas, native playback, shared value bindings, per-uniform ownership and source invalidation. Include a real native demo, recording and EN/PT guides; requires rebuilding the matching optional native plugin.

- Add the optional `@rafaelaugusto/jolt/reorder` entry for flat vertical Core ListView lists with variable heights: native long-press snapshots, neighbour springs and edge autoscroll through recycled cells, stable keys and one application-owned commit. Include cancellation/removal/resize handling, Reduced Motion, native accessibility actions, Option/Alt+arrow commands and real iOS/Android recordings. Rebuild the native app.
- Redesign the Jolt preview with an animated splash, 55 examples, English/Portuguese selected from the device or in-app settings, and light/dark/system appearance. Preserve a native root during Android startup.
- Update the iOS CI runner to overlap simulator first boot with setup and compilation, and bound launch diagnostics. Remove the obsolete GitHub Pages deployment workflow.
- Include English/Portuguese guides and reviewed native recordings for the new features, with native validation reports for bottom sheet, SceneKit shader inputs and reordering.

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
