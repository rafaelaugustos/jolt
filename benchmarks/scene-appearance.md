# SceneKit appearance adapter validation

Issue #180, 2026-10-22. Five adapters extend the existing optional native registry: light intensity/color, material transparency, and solid-color diffuse/emission contents. No new animation engine, observer API or JS frame setter is introduced. The compiled Objective-C sink writes whole colors inside a SceneKit transaction with implicit actions disabled.

## Environment and evidence

- iPhone 17 simulator, iOS 26.0, on Apple M4 Max/macOS 26.6.2 (25G83).
- NativeScript Core 9.1.3, iOS runtime 9.1.0, Vue 3.1.2. Production webpack bundle, release simulator app, benchmark application ID.
- Minimum runtime contract is unchanged: NativeScript 8.9, optional plugin iOS 13+. The existing SceneKit/MapKit framework linkage is reused; no external renderer dependency or permission is added.
- Raw native results: [`ios/conformance.json`](./results/scene-appearance/ios/conformance.json), [`ios/background.json`](./results/scene-appearance/ios/background.json) and [`ios/navigation.json`](./results/scene-appearance/ios/navigation.json).
- Real SceneKit footage with XCTest interaction is embedded in the EN/PT [lighting guide](../docs/guide/scene-lighting.md). It is simulator footage, not a physical-device recording. Existing camera/map clips are preserved.

## Native conformance

All 12 groups passed. The suite reports **zero JS observation-frame requests**, and both active native players and undisposed appearance sinks return from **0 to 0** after the run and after each group. Discrete JS timers measure state; they do not integrate or paint frames.

| Check                              | Evidence                                                                                                                                                                                                                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Target/content validation          | Wrong native types, image, number, file path, CALayer, nil and pattern colors rejected; original contents preserved.                                                                                                                                                       |
| Scalars and unrelated fields       | Intensity set/read at 0 and 1500; transparency at 0.4 (native float readback 0.400000006); negative/nonfinite/out-of-range values rejected; roughness preserved.                                                                                                           |
| Color conversion and interpolation | Solid grayscale CGColor and Display P3 UIColor convert to sRGB. Diffuse, light color and emission all return the expected premultiplied OKLab midpoint ARGB `3227864770`; tolerance ≤ 1 of 255 per component. Transparent endpoints preserved.                             |
| Interruption and no double easing  | Linear intensity 500 → 1500 reads 750.97 after ~250 ms. Pause is stable, seek to 50% reads 1000, resume advances. Interruption begins at 1111.43 and the new 50% sample is 705.71 toward 300. No competing animation keys remain, even inside an outer 2 s SCNTransaction. |
| Shared material ownership          | Two nodes reference one material. The second wrapper interrupts the first; disposing the old wrapper leaves the replacement running.                                                                                                                                       |
| Binding replacement/invalidation   | Invalid mapped samples do not cancel the previous owner. Replacing color contents with an app texture path stops the native player without overwriting the path.                                                                                                           |
| Derived/shared and playback values | Derived scalar and observable playback drive native intensity/transparency together; pause/seek/resume propagates without JS observation frames.                                                                                                                           |
| Scalar charge layer                | At base progress 0.3012, intensity reaches 1169.13 versus a base-only value of ~801.22. After the pulse, base progress advances to 0.5520 and intensity returns to ~1052.01. The base was not replaced.                                                                    |
| Timeline                           | Light and transparency pause together, hold their values and resume together. Timeline itself does not implement seek; individual finite handles do.                                                                                                                       |
| Reduced motion                     | Non-spatial appearance keeps an 800 ms track; spatial camera pose uses an instant track. Decorative pulse suppression remains an app policy.                                                                                                                               |
| Lifetime                           | Native weak-target fixture confirms target deallocation. Twenty repeated scope/property lifetimes leave zero players/sinks, including pending/active binding cleanup.                                                                                                      |
| Busy JS                            | A deliberate 400 ms main-thread loop produces zero additional native writes during the block. After return, intensity catches up to the common elapsed clock within a 45-unit tolerance.                                                                                   |

The interruption comparison allows 2 intensity units at the immediate boundary; ordinary runtime alignment allows 40 units of a 1000-unit range, and layer/window rebuilding allows 50. These are scheduling tolerances, not a claim that rendered pixels have a presentation API. Deterministic JS tests separately inspect sampled vectors, range clamps and cancellation before ownership changes.

SceneKit exposes `presentationNode`, but no public presentation getter for a standalone light/material. These adapters read the current model value, which is the latest Jolt sample during exclusive ownership. They cannot recover an arbitrary app-owned SceneKit animation's displayed intermediate value. Remove competing SDK animations/constraints and set the intended handoff value first. Native writes run on the main thread, so this does not promise isolation from busy JS or SceneKit render-thread execution.

## Background and navigation

The demo owns playable handles and subscription factories in a motion scope, and keeps property wrappers separately until scene destruction. It suspends on app background and resumes explicitly. The real XCTest Home/activate test passed: intensity stayed at 927.0933 while paused, **zero writes occurred during suspension**, and explicit resume continued without a jump. All players and sinks returned to zero afterward.

An initial background test exposed a demo lifecycle bug: NativeScript re-fired `loaded` on foreground, recreating bindings over the paused value. The demo now retains existing scene ownership across app suspension and guards against duplicate setup. The corrected native test passes. This correction does not change the common property registry or the behavior of unrelated adapters.

The separate navigation XCTest enters, animates, adds a pulse and destroys/recreates the actual SceneKit view five times. Boundary diagnostics record native player/sink counts after each destruction in `navigation.json`; each must be zero. The video additionally includes one destruction/recreation cycle. NativeScript/SceneKit caches and total process memory are outside these ownership counters; the weak-target fixture and explicit view teardown check the owned references.

Raw adapters do not install an automatic background policy. Without scope suspension or stopping handles, elapsed wall time continues while display-link rendering is suspended, and foreground can catch up/finish. This behavior and the scope integration are documented in both languages. A scope that adopts a disposable property wrapper directly will dispose it on suspension; the example deliberately owns only handles and binding factories in its suspendable scope.

## Automated and visual checks

- Full JS suite: **1,052 tests, 62 files**. Nine added appearance tests cover ranges, colors, shared ownership, interruption, derived/playback bindings, scopes, reduced motion and invalidation.
- Library build, root typecheck and benchmark typecheck pass; Objective-C sink compilation checked with the iOS 13 simulator deployment target.
- Native iOS build and the three XCTest paths (conformance, background, visual interaction), plus repeat-navigation validation, pass. An Android production-bundle build checks that the optional iOS registrations do not break shared imports; no Android SceneKit support is implied.
- Visual demo: a Lambert-painted car, PBR floor/glass and two charging panels sharing one emission material. Camera, paint, glass and light color share a scalar source; intensity and emission share a second scalar with an additive charge layer. A timeline controls the two base tracks, and a scope pauses base, pulse and bindings together.
- The 20.63 s reviewed native recording shows base playback, an added/removed pulse, pause/resume, seeks on the base handles, disposal and recreation. H.264 delivery is fully decoded with FFmpeg before embedding; no speed change or manufactured frames. SceneKit is exposed as one descriptive accessibility image, and XCTest taps actual button centers; projected 3D accessibility bounds previously caused ambiguous automated hit points. The corrected visual test passed.

`docs:check-media` passed with 45 guides per language and 86 recordings; the VitePress production build passed.

## Reproduce

Install the root/demo dependencies, the Ruby `xcodeproj` gem, and use Node 22 and Xcode. Build native platforms sequentially when sharing a demo directory.

```sh
npm ci
npm run build
npm run typecheck
npm run benchmark:typecheck
npm test
cd demo
npm ci
JOLT_BENCHMARK=1 ns build ios --for-device false --release --env.production --no-hmr
xcrun simctl install SIMULATOR_UUID platforms/ios/build/Release-iphonesimulator/demo.app
cd ..
python3 benchmarks/docs-record-ios.py SIMULATOR_UUID /tmp/scene-checks testSceneAppearanceChecks
```

Copy `Documents/jolt-scene-appearance.json` from the app's simulator data container **before** running the background case, which writes the same report name:

```sh
python3 benchmarks/docs-record-ios.py SIMULATOR_UUID /tmp/scene-background testSceneAppearanceBackground
python3 benchmarks/docs-record-ios.py SIMULATOR_UUID /tmp/scene-navigation testSceneNavigation
python3 benchmarks/docs-record-ios.py SIMULATOR_UUID /tmp/scene-video testSceneAppearance
npm run docs:check-media
npm run docs:build
```

The visual/navigation tests use real XCTest taps; the recorder synchronizes capture with test cues. Launch `--scene-lighting` for the isolated demo, or choose **SceneKit lighting and materials** in the animation gallery. `--scene-checks=background` selects the real lifecycle case. `jolt-scene-navigation.json` is written only for the isolated demo at destruction boundaries.
