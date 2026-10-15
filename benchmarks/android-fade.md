# Android fade layers

The first [emulator diagnostic](./results/2026-10-15-android-fade.md) includes the measured frame intervals and native cleanup checks. Physical-device performance remains unmeasured.

Compares a static card with three bitmap images and six text/value rows, using the same native opacity keyframes in two modes:

- **Baseline:** an `ObjectAnimator` with no explicit hardware layer, matching the driver before #10.
- **Hardware:** `animate(card, { opacity: [1, 0.25, 1] }, { duration: 1200, ease: 'linear', repeat: 5 })` with the temporary layer.

The baseline has the same property values, key times, duration, repeats and linear interpolation. It bypasses engine setup, so this measures playback, not the synchronous cost of `animate()`. No JavaScript runs per frame in either case. The images and text stay unchanged while fading.

The app first checks delayed activation, stopping, replacement, preservation of an explicit software layer and unloading. It reports Ready only after those checks pass. The benchmark requires Android 8+ and the system Animator duration scale at 1x.

## Build and run

Install the Android SDK, NativeScript CLI and Java 17, and configure the demo's generated `App_Resources` as for a normal Android app. The benchmark is a separate entry point guarded by `JOLT_BENCHMARK=1`; it uses `org.nativescript.jolt.benchmark` and does not change the normal demo.

```sh
npm ci
npm run build
npm run benchmark:typecheck
cd demo
npm install

# A local signing key just for the benchmark; do not use it to publish apps.
keytool -genkeypair -keystore /tmp/jolt-fade.keystore -alias jolt-benchmark \
  -storepass benchmark -keypass benchmark -dname 'CN=Jolt Benchmark' \
  -keyalg RSA -keysize 2048 -validity 7

JOLT_BENCHMARK=1 ns build android --release --env.production --env.fadeBenchmark --no-hmr \
  --key-store-path /tmp/jolt-fade.keystore --key-store-password benchmark \
  --key-store-alias jolt-benchmark --key-store-alias-password benchmark

adb -s DEVICE install -r platforms/android/app/build/outputs/apk/release/app-release.apk
adb -s DEVICE shell am start -n org.nativescript.jolt.benchmark/com.tns.NativeScriptActivity
```

Keep the app in the foreground, let the device cool and wait for **Ready**. From the repository root:

```sh
node benchmarks/android-fade.mjs DEVICE /tmp/jolt-fade-results
```

The collector targets that device explicitly and runs six cases in ABBAAB order, three per mode. It collects activation frames after 1.5 seconds, resets `gfxinfo` after warmup, and collects the recent frame buffer once the fade finishes. It also saves a memory snapshot while each fade is active, source/build metadata, device details and native layer assertions. The app exports these diagnostics only in this benchmark build through its external app files directory and a benchmark broadcast receiver.

Each run lasts about eight seconds. The collector rejects debug/nonproduction builds, failed lifecycle checks, unfinished runs, a layer left enabled and fewer than 30 recent displayed frames. The app rejects runs that leave the foreground. To repeat the whole collection, force-stop and reopen the benchmark, then wait for Ready again.

## Reading the report

`summary.json` reports midpoint medians and nearest-rank p95 values, in milliseconds, for flags-zero frames:

- **Frame:** `FrameCompleted - IntendedVsync`, as reported by Android.
- **Draw:** `SyncQueued - DrawStart`, the UI drawing/recording interval.
- **Commands:** `SwapBuffers - IssueDrawCommandsStart`, a rendering-command interval, not a measurement of GPU busy time.
- **Missed deadlines:** frames whose completion exceeds their recorded deadline.

The steady report uses the recent `framestats` ring buffer, which may be shorter than the entire sampling interval. Raw `gfxinfo` text includes the cumulative histogram since reset as well. Activation and steady results are kept separate so a warm cache does not hide the cost of enabling it. These numbers are not presentation latency, a native GPU trace or a measurement of every animation in the app.

Hardware layers trade graphics memory for cached content. The layer's width × height × 4 is a rough RGBA surface-size estimate, not a measurement of actual GPU allocation. Android may pool resources after the layer is removed. Dynamic content invalidates the cache and can change the tradeoff; use a physical device and a representative workload before drawing performance conclusions.

The native implementation follows Android's [hardware-layer guidance](https://developer.android.com/topic/performance/hardware-accel#layers). Frame collection uses [`dumpsys gfxinfo`](https://developer.android.com/tools/dumpsys#gfxinfo).
