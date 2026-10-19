# Drag validation

Validation for issue #23, recorded on 2026-10-19 against the implementation based on `9003338` (beta.7 package metadata plus unreleased scopes/states and drag). These are correctness checks, not frame-time or performance benchmarks.

| Layer                     | Environment                                                                      | Result                                                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Unit/type coverage        | Node 22.23.3; 38 test files                                                      | 704 tests passed, including 27 drag tests; typecheck passed                                                                             |
| Native lifecycle/playback | Android 16 / API 36, arm64 emulator, production release build                    | 8 checks passed                                                                                                                         |
| Native lifecycle/playback | iPhone 17 simulator, iOS 26.0, production release build                          | 8 checks passed                                                                                                                         |
| Actual Android gestures   | Normal Vue demo; ADB touch/swipe injection                                       | 6 flows passed                                                                                                                          |
| Actual iOS gestures       | Normal Vue demo under the isolated benchmark app ID; XCTest OS gesture injection | 1 UI test covering both snap directions, hold-before-release/middle snap, pause/resume, bounded card release and unmount/remount passed |

Core was 9.1.3; Android runtime 9.1.1; iOS runtime 9.1.0. The physical ASUS was not connected for this run. No physical iPhone was controlled. Earlier hardware checks for other features do not constitute physical-device drag validation.

## Native lifecycle runner

`drag-lifecycle.ts` injects scripted pan callbacks into the real NativeScript gesture observers and runs the real animation drivers. It reads Android native translations and iOS presentation layers. Actual OS input is tested separately below.

The eight checks cover:

1. Velocity selects a farther snap; native release stays within hard bounds.
2. Grabbing a running native release preserves its visible position and cancels completion.
3. Cancelling rubberbanded contact freezes it without launching a release.
4. Scope suspension cancels release and removes input; resume accepts a fresh pan.
5. Native unload/reload removes and recreates observers while preserving controller reuse.
6. Reduced Motion keeps direct input, then settles immediately.
7. Disposing an older drag preserves a newer animation on the same property.
8. Twenty replacement/disposal cycles restore pan/touch observer counts.

Pose tolerance is 4 DIPs (6 for a sampled in-flight handoff). UIKit model changes are checked after a display transaction. The probe samples hard bounds during release; unit tests also inspect the complete mathematical curve.

From the repository root, build the package, then build the demo with the isolated app ID and runner entry:

```sh
npm run build
cd demo
JOLT_BENCHMARK=1 ns build android --release --env.production --env.dragChecks --no-hmr
# Supply your local signing arguments for an Android release build.
JOLT_BENCHMARK=1 ns build ios --for-device false --release --env.production --env.dragChecks --no-hmr
```

Build platforms sequentially because NativeScript shares generated assets. Install and launch `org.nativescript.jolt.benchmark` on dedicated test devices. The result is saved to the app's Documents directory as `jolt-drag-checks.json`, with platform/build metadata and per-check progress. Android also logs JSON under `JoltDragChecks`. A failed run records its stage and error.

## Actual Android gestures

Build/install the normal demo without `--env.dragChecks` or the benchmark environment. Then:

```sh
python3 benchmarks/drag-demo-check.py YOUR_DEDICATED_ADB_SERIAL
```

The runner launches `--es drag-lab true`, finds controls through UIAutomator, injects real swipes/taps, and checks native accessibility bounds and settled text. It tests bottom/top snapping, pause/resume, Reduced Motion with the middle snap, rubberband recovery at the card's boundary, and Vue unmount/remount followed by another working gesture. Output is a JSON report.

## Actual iOS gestures

Build the normal Vue demo with `JOLT_BENCHMARK=1`, **without** `--env.dragChecks`, and install it on a dedicated simulator. This deliberately uses `org.nativescript.jolt.benchmark` so it cannot replace the user's normal app. Check the built app's `CFBundleIdentifier`: NativeScript can retain an earlier ID in its generated Xcode project when switching environment values; regenerate the iOS platform if needed.

`drag-ios-ui.rb` uses the `xcodeproj` Ruby gem (also used by CocoaPods) to generate a temporary XCTest project from `drag-ios-ui.swift`:

```sh
ruby benchmarks/drag-ios-ui.rb /tmp/jolt-drag-ui
xcodebuild test \
  -project /tmp/jolt-drag-ui/DragTests.xcodeproj \
  -scheme DragTests \
  -destination 'platform=iOS Simulator,id=YOUR_DEDICATED_SIMULATOR_UUID' \
  -parallel-testing-enabled NO \
  -derivedDataPath /tmp/jolt-drag-ui/build \
  -resultBundlePath /tmp/jolt-drag-ui/result.xcresult \
  CODE_SIGNING_ALLOWED=NO
```

Disable parallel testing so XCTest uses the simulator where the demo is installed. The test launches `--drag-lab`, performs real OS gestures, asserts presentation/accessibility frames and settled callbacks, then retains a screenshot. It includes holding stationary before release: UIKit's last movement velocity is discarded when stale, avoiding an unintended fling.

## Remaining coverage

This validates the single-finger API in #23. It does not establish performance targets, transformed-ancestor behavior, nested-scroll arbitration, complex gesture composition, or production bottom-sheet behavior. Those limits are also stated in the public guide; composition/handoff belongs to #51. Android native View playback still shares the UI thread with main-runtime JavaScript.
