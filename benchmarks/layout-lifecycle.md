# Layout animation validation

Issue #21, recorded on 2026-10-19 against the implementation based on beta.8 merge `20beefe`. These are correctness checks, not frame-time benchmarks.

| Layer                     | Environment                                                  | Result                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit/type coverage        | Node 22.23.3, 41 test files                                  | 750 tests, including 32 layout and 6 platform-boundary tests                                                                                   |
| Native lifecycle/geometry | iPhone 17 simulator, iOS 26.0, production release build      | 12 checks passed                                                                                                                               |
| Native lifecycle/geometry | Android 16 / API 36 arm64 emulator, production release build | 12 checks passed                                                                                                                               |
| Actual iOS touches        | Normal Vue demo, XCTest OS input                             | One test covering insert/remove, expansion, moving-card activation/interruption, cancellation, size policy, Reduced Motion and unmount/remount |
| Actual Android touches    | Normal Vue demo, ADB OS input and painted-card detection     | 7 flows passed                                                                                                                                 |

Core 9.1.3, iOS runtime 9.1.0, Android runtime 9.1.1. Dedicated simulators/emulators only; the physical ASUS was unavailable and the user's physical iPhone was not controlled. Native control identity and touch geometry were checked; this is not a manual VoiceOver/TalkBack navigation audit.

## Design and native alternatives

The implementation uses a one-shot FLIP transaction: capture direct-child view instances, execute the mutation, request layout, read the new native geometry and apply inverse translations/scales before drawing. Curves use the existing Jolt engine and ownership rules. The optional scale-based size interpolation stretches content; `size: false` applies size immediately while moving surviving children.

The platform contracts were reviewed: Android's [TransitionManager.beginDelayedTransition](<https://developer.android.com/reference/android/transition/TransitionManager#beginDelayedTransition(android.view.ViewGroup,%20android.transition.Transition)>) captures scene changes between a call and the next frame; UIKit's [layoutIfNeeded](<https://developer.apple.com/documentation/uikit/uiview/layoutifneeded()>) forces pending subtree layout. Neither alternative was performance-benchmarked here. FLIP was chosen to retain Jolt's springs, native curve playback, Reduced Motion, timeScale, property ownership and common cancellation semantics across platforms. NativeScript's UIKit layout assigns frames itself rather than expressing the scene as an Auto Layout constraint transaction.

Two NativeScript integration details were verified in source and native probes:

- iOS `_getCurrentLayoutBounds()` reads `UIView.frame`, which includes model transforms. Measuring that would double-count translations/scales. The iOS driver instead reads untransformed layer position, anchor and bounds; Android reads native left/top/width/height in DIPs.
- Interactive iOS playback may animate a real transform toward an identity JS destination. NativeScript's cached `_isTransformed` flag can then be false while the native transform is nonidentity. A per-instance frame-assignment hook checks the actual native transform before Core sets a new frame. Reference-counted hooks disappear when the interactive tracks finish. There is no global UIView patch or JavaScript callback per animation frame.

Android starts from a one-shot pre-draw listener. iOS uses the end of the container's NativeScript layout method. A requested no-op layout completes without a fixed 40 ms timer. Layout tracks opt into interactive geometry when started, so touch targets move with the visible cards.

## Native geometry/lifecycle runner

`layout-lifecycle.ts` runs real native layout and animation drivers. It reads actual transformed UIKit frames and Android native geometry; it does not substitute a fake engine. A deliberate start delay holds inverse geometry long enough to verify that the first native pose matches the old position/size.

The twelve checks cover:

1. Insertion keeps existing children at their visible old positions before moving.
2. Reordering existing native children preserves their initial visible positions.
3. Resize respects a noncentral origin and existing application translation/scale.
4. A second resize/position change during playback starts from the current native pose, including an identity destination on iOS.
5. Unload/reinsert during keyed reorder restores the resting transform rather than committing a temporary inverse offset.
6. Stop settles temporary geometry and removes native instance hooks/frame work.
7. Cleanup preserves a newer explicit animation owner.
8. Host unload cancels a pending request; reload accepts a new operation.
9. Scope disposal and twenty pending replacements clean up; only the last pending request completes.
10. Reduced Motion applies final geometry without a native frame loop.
11. A no-op requests a pass and resolves.
12. App suspension cancels a pending hook; playback works after resume.

Native pose tolerance is 4 DIPs, 8 for a moving handoff sampled across frame boundaries. iOS native active-track count must return to zero after cleanup. Suspension is tested by dispatching NativeScript lifecycle events, not by a physical background/foreground stress test.

```sh
npm run build
cd demo
JOLT_BENCHMARK=1 ns build android --release --env.production --env.layoutChecks --no-hmr
# Supply your local signing arguments for Android release builds.
JOLT_BENCHMARK=1 ns build ios --for-device false --release --env.production --env.layoutChecks --no-hmr
```

Build platforms sequentially: NativeScript shares generated assets. Install/launch `org.nativescript.jolt.benchmark` on a dedicated test device. Results and build metadata are saved to `Documents/jolt-layout-checks.json`; Android also logs `JoltLayoutChecks`. Failures record their stage/error, and the runner has a watchdog for a missing layout callback.

## Actual OS input and Vue

Build the normal demo with `JOLT_BENCHMARK=1`, without `--env.layoutChecks`, and install it on dedicated test devices. Verify the built application ID; NativeScript may retain an earlier ID in the generated Xcode project when switching environment values. Regenerate the platform if needed.

Android, from the repository root, with Python Pillow installed:

```sh
python3 benchmarks/layout-android-ui.py YOUR_DEDICATED_ADB_SERIAL
```

The runner opens `--es layout-lab true`. It uses native control bounds for settled geometry and finds the blue card's painted position in a screenshot during slow reorder, then injects a coordinate tap there. That tap must expand Card 1 and interrupt the preceding reorder. It also checks cancellation, both size policies, Reduced Motion and Vue unmount/remount.

For iOS, the Ruby generator uses CocoaPods' `xcodeproj` gem:

```sh
ruby benchmarks/layout-ios-ui.rb /tmp/jolt-layout-ui
xcodebuild test \
  -project /tmp/jolt-layout-ui/LayoutTests.xcodeproj \
  -scheme LayoutTests \
  -destination 'platform=iOS Simulator,id=YOUR_DEDICATED_SIMULATOR_UUID' \
  -parallel-testing-enabled NO \
  -derivedDataPath /tmp/jolt-layout-ui/build \
  -resultBundlePath /tmp/jolt-layout-ui/result.xcresult \
  CODE_SIGNING_ALLOWED=NO
```

The test launches `--layout-lab`, verifies the moving card's native frame is between endpoints, injects a coordinate tap during motion, and asserts the correct card expands. It covers the same normal-demo controls and retains a screenshot. Parallel testing is disabled so XCTest uses the simulator where the demo is installed.

## Deliberate limits

This API animates one layout pass of direct children in ordinary containers. It does not provide persistent observation, recycled-list integration, retained exit overlays, nested gesture arbitration, real-size text reflow or shared-element navigation. Origin/rotation changes in the same mutation and X/Y 3D rotation skip inversion. Zero-sized/collapsed children are not measured. Animated ancestors outside the operation require their own interaction surface for touch alignment. iOS interactive playback and Android View animation both use the UI thread; main-thread JavaScript can stall them.
