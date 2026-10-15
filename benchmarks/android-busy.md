# Android playback during busy JavaScript

The [recorded emulator diagnostic](./results/2026-10-15-android-busy.md) includes all nine reports and native timing samples.

This diagnostic compares the Jolt `spin` preset and the same native rotation through `ViewPropertyAnimator.withLayer()`. A public Android circular reveal runs alongside them as a distinct native effect. Each animation lasts 1800 ms. At 400 ms, the app either waits, blocks main-runtime JavaScript for 300 ms, or runs the same CPU loop in a worker.

Worker startup finishes before animation setup. No JavaScript callback samples or drives frames during playback. Native rotations are read immediately before and after work; the benchmark also records the worker's native thread ID and verifies layer cleanup and cancellation.

## Run

Use the demo's generated `App_Resources`, Android SDK and Java 17 setup. Run the library build first:

```sh
npm ci
npm run build
npm run benchmark:typecheck
cd demo
npm install

# Test signing key only; never use this key to publish an app.
keytool -genkeypair -keystore /tmp/jolt-busy.keystore -alias jolt-benchmark \
  -storepass benchmark -keypass benchmark -dname 'CN=Jolt Benchmark' \
  -keyalg RSA -keysize 2048 -validity 7

JOLT_BENCHMARK=1 ns build android --release --env.production --env.busyBenchmark --no-hmr \
  --key-store-path /tmp/jolt-busy.keystore --key-store-password benchmark \
  --key-store-alias jolt-benchmark --key-store-alias-password benchmark

adb -s DEVICE install -r platforms/android/app/build/outputs/apk/release/app-release.apk
adb -s DEVICE shell am start -n org.nativescript.jolt.benchmark/com.tns.NativeScriptActivity
```

The separate entry requires Android 8+, hardware acceleration and Animator duration scale at 1x. It uses the existing benchmark application ID, `org.nativescript.jolt.benchmark`, and an isolated broadcast receiver. Wait for **Ready**, then from the repository root:

```sh
node benchmarks/android-busy.mjs DEVICE /tmp/jolt-busy-results
```

The collector runs three trials per mode, rotating their order. It saves build/source metadata, raw native frame records, each app report and `summary.json`. It rejects debug/nonproduction builds, failed lifecycle checks, incomplete runs and insufficient frame records. Force-stop and reopen the app before repeating the full collector.

## Interpret

`maxGapAcrossWorkMs` is the largest interval between consecutive recorded **UI-window intended vsyncs** that overlaps the work interval. It is not RenderThread FPS. `maxRecordedFrameMs` is `FrameCompleted - IntendedVsync`; it includes rendering pipeline work and is not pure UI-thread CPU time or presentation latency.

This distinction matters: Android can drop vsyncs while JavaScript blocks, then produce a short frame afterward. Looking only at individual frame duration can hide the pause; the gap and the unchanged native rotation samples expose it.

The report also records the native layer while work runs. `withLayer()` being at layer type 2 proves caching was enabled, not that its animation ran off-thread. Worker results must have a different native thread ID from the main runtime. Layer type must return to its original value after completion or cancellation.

To check the reveal's actual display progression, record a trial separately with `adb shell screenrecord`, broadcast mode `main`, and compare rendered pixels during the stationary rotation interval. Do not infer reveal presentation from `gfxinfo` alone. Screen recording adds overhead; keep it separate from the primary frame collection.

## Scope

The Android source still updates [`ViewPropertyAnimator` properties through `ValueAnimator`](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/core/java/android/view/ViewPropertyAnimator.java); `withLayer()` caches drawing. Switching Jolt's general driver to this API would not remove a main-thread block and would lose its independent property/keyframe behavior.

The practical mitigation is to move suitable computation to a [NativeScript worker](https://docs.nativescript.org/guide/multithreading), leaving views on the UI thread. This benchmark does not replace Jolt's backend or expose hidden RenderThread APIs. Validate a real workload on physical hardware before making performance claims.
