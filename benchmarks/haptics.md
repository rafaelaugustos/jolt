# Android haptics validation

Issue [#184](https://github.com/rafaelaugustos/jolt/issues/184), validated on 2026-10-22, based on beta.13 (`0a0a175`). These are behavioral and native-request checks, not motor measurements or frame-time benchmarks.

## Physical device

ASUS_Z017DC, Android 8.0.0 / API 26, display density 3. The device reports a vibrator. The normal recording uses Animator duration scale 1 and `haptic_feedback_enabled = 1`.

The device owner manually tried `light`, `medium` and `heavy` after the automated checks and reported: **“Sinto nos três, parecem iguais.”** All three were felt; no perceptible distinction was reported on this device. This is a human tactile observation, separate from the `true` results returned by `performHapticFeedback()`. It does not establish intensity parity with iPhones or other Android models.

The [raw ASUS results](./results/haptics-android/asus/conformance.json) contain native uptime timestamps, effect IDs, the raw API boolean (`accepted`) and translation in physical pixels. For the explicit points, compare `xPixels / density` against 24 and 64 DIPs (30% and 80% of an 80 DIP movement). The fixture asserts a 12 DIP position tolerance and 130 ms timing tolerance in animation time. These are test tolerances, not public latency guarantees.

| Check                           | Physical ASUS result                            |
| ------------------------------- | ----------------------------------------------- |
| Normal playback                 | 12 checks passed                                |
| Real Home/background/foreground | No feedback while inactive                      |
| Animator scale 0                | No requests, including forced normal motion     |
| Animator scales 0.5 and 2       | 12 checks passed at each scale                  |
| System touch feedback disabled  | 12 checks passed; every native request declined |
| View feedback disabled          | Request declined, no forced fallback            |
| Tactile observation             | All three styles felt; reported as similar      |

Device settings are restored by the runner, including when a check fails. A missing vibrator is covered at the unit boundary; the ASUS and emulator both report a vibrator. The emulator cannot verify tactile feedback.

## Modern Android

Android 16 / API 36 emulator also passes the same 50 checks, including scale 0.5 and native service suppression. [API 36 results](./results/haptics-android/api36/conformance.json) and [disabled-system service decisions](./results/haptics-android/api36/system-haptics-disabled-service.txt) are included. The pause/seek fixture waits for the native request before rewinding, instead of assuming first-frame startup fits a fixed wall-clock margin; it also asserts playback has not completed. Timing/position tolerances remain unchanged.

Android 15 / API 35 emulator, Google `sdk_gphone64_arm64`, density 2.625: all 50 native checks pass across normal playback, background, scales 0/0.5/2 and disabled touch feedback. [Raw results](./results/haptics-android/api35/conformance.json) use the same position and timing assertions as the physical device.

The fixture's `accepted` field is the raw return value of `performHapticFeedback()`, not confirmation that the motor ran. [Android 15 ViewRootImpl](https://android.googlesource.com/platform/frameworks/base/+/refs/tags/android-15.0.0_r1/core/java/android/view/ViewRootImpl.java) dispatches haptic requests asynchronously and can return `true` even when the service suppresses them. For the disabled-system run, the runner sets both `haptic_feedback_enabled` and `haptic_feedback_intensity` to zero, then verifies that every new app TOUCH record in `VibratorManager` reports `ignored_for_settings`. The [focused service log](./results/haptics-android/api35/system-haptics-disabled-service.txt) records this independently of the View API boolean. View-level disabling still returns `false`. All changed settings are restored.

## Coverage and implementation

The native suite covers style mapping, single tween arrival, explicit points versus actual position, spring arrival before settling, pause/resume, one-shot seek/rewind, timeline active and pending participants, replacement ownership, scope cleanup, view/system refusal, silent animations, slow motion, deliberate UI-thread blocking, unload/reload and twenty cancellations. Each settings run reopens the native demo. The fixture uses an actual Android View subclass and the real Jolt driver, with a bounded log of requests; it does not substitute a fake animation engine.

Native completion confirms the final point even when a scaled or resumed clock sample is one frame behind; earlier stale points still drop. Visual animators register before the feedback markers, so Android updates the pose before dispatching a haptic boundary in that frame. Pending Android markers start together, so later impacts do not acquire another native first-frame startup delay. Pause and seek rebuild only the unconsumed points. Synchronously completed playback cannot leave a feedback marker behind, and sub-millisecond remaining times cannot recurse through a zero-duration native marker.

Unit coverage: 1,016 tests in 59 files, including 32 Android haptic cases and the 23 existing iOS cases. Fallback tests emulate missing API 21/23 constants, so no unavailable constant is read. Validation, preset overrides and iOS preparation retain the existing shared contract. Root and benchmark TypeScript checks, library/native builds and formatting pass. Documentation media validation passes for 80 recordings and 44 guides per language; the VitePress production build passes.

iOS regression: iPhone 17 simulator, iOS 26.0, NativeScript release build. XCTest uses actual OS touches for the three spring styles, bounce, tween, pause, seek/rewind, resume, stagger and disabled feedback. It asserts that progress holds while paused and playback finishes after resume. This simulator run does not establish iPhone tactile behavior.

The library delegates feedback to Android `View.performHapticFeedback(effect)` without ignore-setting flags or a new permission: light → `CLOCK_TICK` (API 21+, otherwise `KEYBOARD_TAP`), medium → `CONTEXT_CLICK` (API 23+, otherwise `KEYBOARD_TAP`), heavy → `LONG_PRESS`. A refused request is not retried. See the [Android platform guidance](https://developer.android.com/develop/ui/views/haptics/haptic-feedback).

Haptic scheduling shares the existing playback clock and uses discrete native Animator timing markers. Their boundary callbacks request feedback through JavaScript. There is no JavaScript frame loop in the haptic scheduler. The demo separately subscribes to playback progress for its percentage label. NativeScript JavaScript shares the UI thread: contention can delay or suppress impacts, and the scheduler drops events over 100 logical animation milliseconds late. This is best-effort timing, not an audio-grade synchronization guarantee.

## Recordings and reproduction

`haptics-android-device.mp4` is screen capture from the physical ASUS with real ADB touch input. `haptics-android.mp4` is screen capture from the Android 15 emulator with real ADB touches. `haptics-ios.mp4` is screen capture from the iOS simulator with XCTest touch input. White flashes in the Android demo mark requests recorded by its native fixture; they do not prove that vibration was felt. Human confirmation is recorded above. The videos are embedded in both language guides and inspected for visible animation and valid playback.

Build the normal demo with the benchmark application ID; native platforms must build sequentially:

```sh
npm ci
npm run build
cd demo
npm install
JOLT_BENCHMARK=1 ns build android --env.production --no-hmr
JOLT_BENCHMARK=1 ns build ios --for-device false --release --env.production --no-hmr
```

Install `org.nativescript.jolt.benchmark` on explicitly selected devices, then run from the repository root:

```sh
python3 benchmarks/haptics-android.py YOUR_ADB_SERIAL /tmp/jolt-haptics-results
python3 benchmarks/docs-record-ios.py YOUR_IOS_SIMULATOR /tmp/jolt-haptics-ios testHaptics
```

The Android runner accepts `checks`, `background`, `settings`, `disabled` and `record` as optional trailing selectors. It opens `--es haptics-lab true`, which renders the same Haptics component in isolation from the playground's other ongoing animations. Results are written to the app's `files/jolt-haptics.json` and pulled into the requested output directory. The iOS runner requires the local CocoaPods Ruby and `xcodeproj` gem, as described in `CONTRIBUTING.md`.
