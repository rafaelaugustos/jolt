# Playback progress, controlled timelines and native adapters

Validated on 2026-10-22 for #177, #178 and #62. These are simulator/emulator checks, not physical-device measurements.

## Native environment and results

| Target                                                               | Result                                                                                           |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| iPhone 17, iOS 26 simulator, NativeScript iOS 9.1.0                  | 10/10 native conformance checks; background/pause/resume; three recorded scenes                  |
| JoltReview emulator, Android 16 / API 36, NativeScript Android 9.1.1 | 10/10 native conformance checks; background/pause/resume; two recorded scenes                    |
| Android Animator duration scale 0, 0.5, 2                            | Native property progress, controls, completion and positioned timeline checks pass at each scale |
| Core Jolt npm pack                                                   | No optional property helper native sources or MapKit/SceneKit linkage                            |
| Optional `@rafaelaugusto/jolt-native` npm pack                       | Compiled helper sources included; no MapLibre SDK or generated AAR included                      |

The reference map integrations use system MapKit on iOS and MapLibre Android 11.8.0 with OpenStreetMap raster tiles. The 3D reference is a real SceneKit camera node. No Android 3D adapter is claimed. The normal demo uses NativeScript Core 9.1 and a separate local development plugin for the `reveal` custom view and the MapLibre dependency.

Raw results: [iOS](./results/playback-adapters-2026-10-22/ios.json), [Android](./results/playback-adapters-2026-10-22/android.json), and Android scales [0](./results/playback-adapters-2026-10-22/android-scale-0.json), [0.5](./results/playback-adapters-2026-10-22/android-scale-0.5.json), [2](./results/playback-adapters-2026-10-22/android-scale-2.json).

The suite exercises native tween/spring playback, pause, endpoint seek and rewind, resume, interruption, motion-value bindings and scalar layers, source observation, delayed timeline starts, slow motion, spatial reduced motion, scope disposal, unrelated property ownership, native sink invalidation, repeated cleanup and active-player counts returning to zero. Native-only bindings request **zero JavaScript observer frames**. Custom mapping calls occur at setup and source boundaries.

The background test caught NativeScript's iOS root-view unload cancelling a paused scene. Explicitly paused view/image owners now survive that temporary background unload; foreground navigation unloads still cancel. XCTest verifies the resumed scene finishes at 100%, and unit tests cover both lifecycle paths. The demo pauses on app suspension and requires an explicit resume.

## Measurement limits

The 180–181 ms busy-JavaScript probe held the native `reveal` value unchanged on both platforms while the main thread was blocked. Native setters remove per-frame JavaScript work; they do not create a separate UI thread. The final slow-motion snapshots lagged the logical clock by about 4.5 ms on iOS and 16 ms on Android. Earlier Android runs during build/accessibility load had larger presentation lag and failed a raw-value/clock equality check. The suite now records that lag separately, verifies native movement, and checks phase equality at pause/seek boundaries, where playback synchronously applies the current sample. It does not claim a frame-rate or latency guarantee under load.

Sink invalidation tests native target-loss handling deterministically. SDK objects still require disposal before their own destruction; this is not a garbage-collection stress test of every SDK. Twenty repeated start/stop operations check player counts; the recording runs also recreate their native screens. General multi-finger input, Android 3D renderers and arbitrary timeline scrubbing are outside this delivery.

## Reproduce

At the root run `npm install` and `npm run build`, then `npm install` in `demo`. The demo's two local plugin dependencies supply the optional native runtime and development fixture; no manual MapLibre edit to ignored App_Resources is needed. Generate/configure standard NativeScript App_Resources as for the existing demo. Build platforms sequentially with `JOLT_BENCHMARK=1`, production webpack and HMR disabled.

```sh
JOLT_BENCHMARK=1 ns build ios --for-device false --release --env.production --no-hmr
JOLT_BENCHMARK=1 ns build android --env.production --no-hmr
```

Install `org.nativescript.jolt.benchmark` on dedicated devices. From the repository root:

```sh
python3 benchmarks/docs-record-ios.py IOS_UUID /tmp/JoltPlayback \
  testControlledBackground testNativePropertyChecks \
  testControlledPlayback testNativeMap testNativeCamera
python3 benchmarks/playback-adapters-android.py ANDROID_SERIAL /tmp/JoltPlaybackAndroid
```

The Android runner restores touch indicators and Animator duration scale. Optional trailing selectors are `checks`, `background`, `record` and `settings`. Both runners use actual device input. The reusable TypeScript suite is `benchmarks/playback-adapters.ts`; adapter authors can substitute their property definition and native fixture target. `demo/native-fixture` supplies compiled UIKit/Canvas `reveal` views rather than a JavaScript setter.

The five inspected H.264 clips are `controlled-playback-{ios,android}`, `native-map-{ios,android}` and `native-camera-ios`. They preserve capture timing and are embedded in the English and Portuguese playback, timeline and native-property guides. Media coverage and VitePress production builds pass.
