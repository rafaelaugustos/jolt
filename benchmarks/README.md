# iOS animation startup

Measures the synchronous cost of `animate(rows, 'fadeInUp', { stagger: 30 })` on 50 and 200 loaded rows. This is the workload from [#11](https://github.com/rafaelaugustos/jolt/issues/11). `fadeInUp` uses two tracks per row: opacity and vertical translation.

The first [device results](./results/2026-10-14-ios-startup.md) show medians of about 21 ms for 50 rows and 53–54 ms for 200 rows on an iPhone 17 Pro.

## Run on a device

Use a Mac with the NativeScript CLI, Xcode, an iPhone with Developer Mode enabled, and a development signing team. The demo must have its `App_Resources` configured, as for a normal iOS build. If missing, copy `App_Resources` from a fresh `ns create` TypeScript app; this repository does not track those generated resources.

```sh
# Repository root
npm ci
npm run build
npm run benchmark:typecheck
cd demo
npm install
JOLT_BENCHMARK=1 ns build ios --for-device --release --env.production --env.benchmark --no-hmr --team-id YOUR_TEAM_ID
```

The benchmark uses `org.nativescript.jolt.benchmark`, so it can coexist with the demo. Extract the exported development IPA and install its `.app` using `devicectl` (commands below run from `demo/`):

```sh
xcrun devicectl list devices
unzip -o platforms/ios/build/Release-iphoneos/demo.ipa -d /tmp/jolt-startup-app
xcrun devicectl device install app --device YOUR_DEVICE_ID /tmp/jolt-startup-app/Payload/demo.app
xcrun devicectl device process launch --device YOUR_DEVICE_ID --terminate-existing --environment-variables '{"JOLT_BENCHMARK_AUTORUN":"1"}' org.nativescript.jolt.benchmark
```

Alternatively, open the app and tap **Run benchmark**. Leave it in the foreground for about a minute, without a debugger. Disable Low Power Mode and let the phone cool first. A run fails if the device is not in a nominal thermal state, the app is inactive, rows have not loaded, or a full stagger fails to finish.

When the app says **Done**, copy its report:

```sh
xcrun devicectl device copy from --device YOUR_DEVICE_ID \
  --domain-type appDataContainer --domain-identifier org.nativescript.jolt.benchmark \
  --source Documents/jolt-startup.json --destination /tmp/jolt-startup.json
```

Reports contain the source commit, dirty state, bundle mode, package versions, device model and OS, thermal state, all samples, and summaries. Check `completed: true` and `simulator: false` before using a result. Run the same build more than once to check variability. Simulator timings are useful for checking the harness, not for judging device performance.

## What is timed

Each case creates exactly 50 or 200 `Label` rows in a `StackLayout` inside a `ScrollView`, including attached offscreen rows. This is intentionally non-virtualized. View construction, loading, layout, resets, and cancellations are outside the timed interval.

- **Plain:** elapsed time from entering `animate()` to receiving its handle, using `CACurrentMediaTime()`. Five warmups, then 30 retained samples, with 150 ms between starts. This is the primary result.
- **Diagnostic:** the same workload, warmups, and sample count, with an internal driver wrapper timing each `play()` call. This includes `CAKeyframeAnimation` creation, JS-to-native array conversion, property setters, completion blocks, and layer submission. The rest includes track preparation, view property writes, promises, scheduling, and wrapper overhead. It is not a pure JavaScript measurement.
- **Workload inspection:** a separate untimed pass counts tracks, values, key times, repeated arrays, and layer submissions. The current iOS driver constructs two native arrays per track. Counts describe inputs to the bridge, not measured memory allocations.

Each timed animation is stopped immediately after its handle is returned, then the harness yields before the next sample. One additional stagger per size runs to completion as a correctness check. Logging and file output happen after measurements. The diagnostic wrapper is only bundled into this app; the published driver is unchanged.

The report uses a midpoint median and nearest-rank p95. Compare diagnostic totals with plain totals before interpreting the breakdown: clock calls and the wrapper add overhead, and the two phases can differ due to runtime or device noise. The phases always run plain first, diagnostic second; they are not a randomized A/B test.

These numbers measure a warmed synchronous call, not app startup, the first visible frame, transaction flushing after the call, GPU time, memory usage, or sustained frame rate. A call longer than one refresh interval consumes that much main-thread time; the benchmark does not count dropped frames. Do not generalize one phone's results to older devices or Android.

## Checking changes

```sh
npm run build
npm run benchmark:typecheck
```

CI checks the harness types after building Jolt. Device measurements remain manual. After benchmarking, omit both `JOLT_BENCHMARK` and `--env.benchmark` to build the regular demo again.
