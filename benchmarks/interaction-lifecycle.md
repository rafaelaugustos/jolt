# Animated touch geometry validation

Issue #56, checked on 2026-10-19 against changes based on main `753d24f` (the implementation preparing beta.8). Native probes ran with beta.7 metadata before the release-version bump. These are correctness checks, not performance benchmarks.

| Check                     | Environment                                                  | Result                                                                                                          |
| ------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Unit tests                | Node 22.23.3, 39 test files                                  | 712 passed                                                                                                      |
| Native lifecycle/playback | iPhone 17 simulator, iOS 26.0; production release build      | 10 checks passed                                                                                                |
| Native lifecycle/playback | Android 16 / API 36 arm64 emulator; production release build | 9 checks passed                                                                                                 |
| Actual OS taps            | iOS XCTest, real NativeScript Button                         | Complete geometry matrix passed                                                                                 |
| Actual OS taps            | Android ADB input, real NativeScript Button                  | 8 checks passed                                                                                                 |
| Vue drag integration      | iOS XCTest, normal demo with the surface enabled             | Both snap directions, middle snap/Reduced Motion, pause/resume, bounded card release and unmount/remount passed |

The normal Android Vue demo also passed all six OS-gesture regression flows in `drag-demo-check.py` with the surface registration enabled.

NativeScript Core 9.1.3, iOS runtime 9.1.0, Android runtime 9.1.1. Only dedicated emulators/simulators were controlled. The physical ASUS was unavailable; the user's physical iPhone was not used.

## Baseline and implementation choice

The initial iOS probe paused a 0→200 DIP button translation at 50%, then injected taps at the visible center, original center and invisible destination. The visible/old positions delivered no tap, while the destination delivered one. On Android, the same probe delivered exactly one tap at the visible center; old/final positions delivered none.

The iOS model/presentation mismatch was therefore reproduced before changing the driver. Rather than replacing global UIView hit testing or forwarding synthetic touches through proxy controls, `interactionSurface(root)` selects native sampled playback that updates actual transforms/opacity. Normal UIKit hit testing and accessibility bounds now use the displayed geometry. Android keeps its existing native property driver. The tradeoff is iOS UI-thread playback within opted-in subtrees; it is not render-server playback under main-thread blocking.

The final OS-input matrix covers:

- Held midway: exactly one visible-center activation; none at the old or final centers.
- Continuous movement: a tap on the moving button activates it before arrival. Android locates the painted blue button in a screenshot; iOS also checks that its native accessibility frame is between the endpoints.
- Animated ancestor scale and rotation, held midway with the child translation.
- Clipped parent: visible portion activates, clipped portion does not.
- Overlapping sibling controls: only the front button activates.
- Disabled control: taps are ignored; native button identity and label remain.
- `press()` feedback coexists with the motion and subsequent taps.
- Stopping/interruption preserves later activation at the visible position.

Android scenario changes request layout when width, clipping and sibling visibility change. The runner waits 200 ms after selecting a scenario before injecting the next tap; otherwise it can tap while the preceding scenario's clipping still applies. This wait does not pause the continuous-motion test.

NativeScript's `isEnabled` interaction gate does not necessarily change the native accessibility `enabled` flag in these runtime versions. The checks assert actual disabled tap behavior and preserved native button identity/label; this feature does not rewrite NativeScript's accessibility semantics. No manual VoiceOver/TalkBack navigation audit was performed.

## Reproduce OS taps

Build the package, then the isolated probe app:

```sh
npm run build
cd demo
JOLT_BENCHMARK=1 ns build android --release --env.production --env.interactionChecks --no-hmr
# Supply your local signing arguments for Android release builds.
JOLT_BENCHMARK=1 ns build ios --for-device false --release --env.production --env.interactionChecks --no-hmr
```

Build platforms sequentially because NativeScript shares generated assets. Install `org.nativescript.jolt.benchmark` on dedicated test devices. NativeScript can retain an earlier application ID in the generated Xcode project: verify the built CFBundleIdentifier and regenerate the platform if switching IDs.

From the repository root, with Python Pillow installed:

```sh
python3 benchmarks/interaction-android-ui.py YOUR_DEDICATED_ADB_SERIAL
```

For iOS, the Ruby generator uses the `xcodeproj` gem supplied with CocoaPods:

```sh
ruby benchmarks/interaction-ios-ui.rb /tmp/jolt-interaction-ui
xcodebuild test \
  -project /tmp/jolt-interaction-ui/InteractionTests.xcodeproj \
  -scheme InteractionTests \
  -destination 'platform=iOS Simulator,id=YOUR_DEDICATED_SIMULATOR_UUID' \
  -parallel-testing-enabled NO \
  -derivedDataPath /tmp/jolt-interaction-ui/build \
  -resultBundlePath /tmp/jolt-interaction-ui/result.xcresult \
  CODE_SIGNING_ALLOWED=NO
```

Disable parallel testing to use the installed simulator. The XCTest bundle retains a screenshot and checks control frames/status after real OS touch injection. `probeBaseline()` is retained as a diagnostic helper: to repeat the baseline, omit `interactionSurface(stage)` in the probe and run that method as a test. The baseline result is not expected to pass the corrected-geometry assertions.

## Native lifecycle checks

Replace `--env.interactionChecks` with `--env.interactionLifecycle` in the build commands, install and launch the app. It writes `Documents/jolt-interaction-checks.json` with build metadata and per-check progress; Android also logs `JoltInteractionChecks`.

Both platforms exercise live native geometry/natural completion, paused endpoints/scrub/resume, selective interruption preserving another axis, infinite reverse/stop, unload/reload, scope cleanup preserving a newer owner, Reduced Motion, delayed finite reverse, and surface disposal preserving existing playback while excluding future animations. iOS additionally checks that application suspension cancels and commits the live pose, removes native frame work and permits playback after resume. The suspension test dispatches NativeScript's lifecycle event; it is not a physical background/foreground stress test.

Native pose tolerance is 3 DIPs, 5 for in-flight handoff and 7 for comparing iOS model/presentation across a display boundary. iOS `activeCount()` must return zero after finish, pause, stop and unload. The runner uses actual native drivers; it does not substitute a fake animation engine.

The normal Vue drag demo registers its container before its drag controllers. Its iOS OS-gesture test is reproduced using `drag-ios-ui.rb` and the normal demo under the isolated benchmark ID, as described in [drag validation](./drag-lifecycle.md).

## Limits

These results cover ordinary UIKit/Android controls and Jolt numeric transforms/opacity. They do not establish frame-time targets, expand parent touch bounds, migrate already-running Core Animation tracks, validate every third-party control, or implement gesture composition and nested-scroll handoff (#51). Animated ancestors must also belong to the opted-in subtree. The new native iOS helper requires a full rebuild.
