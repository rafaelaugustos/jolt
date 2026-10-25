# Shared navigation (issue #24, first delivery)

Programmatic static Image/plain-card navigation in one Core Frame. The normal preview adds experiment 60 and a detail route using the declared `vue-router-ns@0.1.0-rc.2`. Interactive OS progress/cancellation and recycled/offscreen realization remain outside this delivery; this does not close #24, #25 or #26.

The integration reuses Core `sharedTransitionTag` and Frame navigation events. The navigation callback passes `animated: false`; the route commits through Core/router while a bounded Jolt window overlay hides the two real elements and plays native tracks. It does not install navigation delegates, claim UIKit zoom timing parity or turn snapshots into a navigation system. Missing, duplicate, unsupported and timed-out targets preserve the requested route. Concurrent requests are refused with `busy`, not queued.

The image path holds the decoded native image and interpolates its displayed content rectangle separately from the rounded outer clip. `aspectFill` to `aspectFit` preserves the full image and aspect ratio; it does not stretch a previously cropped thumbnail. Plain card snapshots crossfade at their original text size. Total retained image/snapshot pixels use the existing shared-layout budget. Android must not recycle borrowed ImageView bitmaps during disposal.

## Reproduction

Build the library and normal benchmark-ID demo as described in `CONTRIBUTING.md`; build platforms sequentially. Explicit dedicated simulator/emulator IDs are required.

```sh
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR_UUID /tmp/SharedNavigation \
  testSharedNavigation testSharedNavigationPortuguese
python3 benchmarks/shared-navigation-android.py YOUR_EMULATOR_SERIAL /tmp/SharedNavigationAndroid
```

The iOS tests record English/Portuguese photo and card forward/back, assert visible success, and separately run moved-source, missing-target/source and reduced-motion navigation. The Android script asserts all ten terminal states and native cleanup, then records a fresh run without diagnostics. Input uses XCTest/ADB OS taps, never emitted JavaScript tap events.

`--shared-navigation-audit` writes `jolt-shared-navigation.json` in app Documents and, on Android, external app files. The report records route commitment, terminal result, controller state, native overlay count and visibility of the current real tagged views. These are terminal/lifecycle checks, not a physical-device frame-time or memory benchmark. Android external files use the Application context because the original source view has already unloaded.

## Validated locally

- iOS 26.2 simulator, iPhone 17: both XCTest scenes and fallback checks passed; final `idle`, zero native overlays, real tagged views visible. `results/shared-navigation/ios.json` contains the separate six-operation fallback/moved-source audit.
- Android API 36 emulator: photo/card forward/back, moved return source, missing target/source and reduced motion (ten operations); final `idle`, zero overlays and visible originals. See `results/shared-navigation/android.json`.
- Existing same-page shared-layout native regression tests passed on both platforms, including reversal, explicit cancellation, removal, reduced motion, rotation and background/resume as covered by those runners.
- 1,243 host tests passed (81 files), including new navigation ownership, guards, missing/duplicate/scoped tags, timeout, suspension, cancellation, geometry invalidation and ten-channel image-track checks.
- Library and benchmark typechecks, production inspector tree-shaking, 336 Android particle assertions, five live-spring solver tests, docs media coverage (56 guides/language, 142 clips), docs build and formatting passed.

Three H.264 clips in `docs/public/media/shared-navigation*.mp4` retain original playback timing. Full-duration contact sheets and transition frames were inspected; all compressed files decoded without errors. Native recordings are simulator/emulator evidence, not physical-device sign-off. No workflow or long-running native CI job was added.
