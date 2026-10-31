# Binding and layer measurements (#242)

This audit measures the existing library. It does not change the public API or set universal binding limits. The measurement app has the separate ID `org.nativescript.jolt.bindings` and uses the demo's native dependencies with a production JavaScript bundle and Release native builds.

Captured on 2026-10-30. The iOS source snapshot is `7c30f2d1984aa4238deb42d52c9be2fddc7d8b38`. The initial Android emulator run uses `1af19144212bd47deb30dce684cbc2ac7bb7bbc5`, which replaces intrusive PSS collection with resident-page sampling and extends slow composition-window trials until two boundaries have actually run (subject to a 30-second verifier ceiling). Both were built from clean working trees. The iOS Objective-C probe serializes its physical-device flag as numeric `1`; the verifiers accept only booleans or integer `0`/`1`, and still reject simulators by default. Hardware, OS/build, Jolt, NativeScript Core/runtime versions, power mode, thermal status and raw measurements are stored in each report.

## Coverage and measurement boundaries

The matrix has 22 workloads, seven retained warm preparation samples after two warmups, and three diagnostic playback trials per workload:

- One source bound to 1, 16, 64 or 200 views. One property is x; three properties are x, scaleX and scaleY.
- Two, four or eight named layers above a base, using motion-value composition and direct view-property composition separately.
- Finite 1.8-second playback; two endless 800/1200-ms channels that share a native loop; and 701/709-ms channels that require four-second composition windows. The 8.8-second sampling interval is a minimum; a slow boundary can extend a trial in four-second steps until two actual rebuilds have completed, with a strict 30-second verifier ceiling. Windowed workloads cover 1, 16 and 64 views, with three properties each.
- A separate 64-view, three-property workload with one explicit JavaScript subscriber.
- Nonzero x = 24 DIP and non-unit scale = 1.25 throughout setup. Native samples must show real movement and preserve the scale baseline.
- Idempotent cancellation/disposal, unbinding, unmounting and a quiet interval with zero retained Jolt tracks, bindings, channels, native live nodes, pending frames or timers. The native sampling probe has already stopped during the quiet interval.

Motion-value layers add to the scalar source; direct view scale layers multiply around their neutral value of 1. These paths exercise their respective composition contracts, not numerically identical trajectories.

Preparation samples use the unwrapped driver: binding setup and starting the animation are timed separately, then the run is cancelled outside the timed region. The first sample is labelled **first use of that workload in this process**, not a universally cold cache. Cases run in a fixed order. Use `--case` in a fresh process to examine first use independently. Seven warm samples are enough for a small reproducible audit, not a stable tail-latency estimate; nearest-rank p95 is the maximum of those seven samples.

Playback trials use an opt-in driver wrapper to count submitted tracks, numeric values/key times, JS frame requests, completion callbacks and window timer work. These counts describe submission inputs, **not actual allocator events or retained allocation sizes**. Completion callbacks matter: view layers rebuild their windows from native completion callbacks, whereas a composed motion value uses a boundary timer. The wrapper measures both.

The demo-only native probe samples one representative view without a JavaScript frame callback. It collects native display callback timestamps, pose, process CPU and memory. It uses fixed-capacity buffers and rejects overflow. Its own callback work is reported separately, but is not subtracted from process CPU. Reading process memory every 500 ms is part of that overhead.

- **CPU:** total process CPU time from `getrusage` on iOS and `Process.getElapsedCpuTime` on Android, including Jolt, NativeScript and the diagnostic. It is not pure JavaScript or GPU time. A percentage uses one CPU core as 100%.
- **Memory:** iOS `phys_footprint` and Android resident set size (RSS). They are distinct OS metrics. The sampled peak can miss short allocation spikes. Post-unmount snapshots release tile references but still include runtime caches and retained report data; they do not establish a heap-leak bound or long-term retention budget.
- **Cadence:** CADisplayLink/Choreographer opportunities, not presented FPS. The probe does not force a display rate. The hardware maximum and observed interval distribution are separate fields. Android computes `targetMs` as the supplied frame timestamp plus the current display interval; it is an estimate, not a platform presentation deadline. Choreographer timestamps can repeat in the emulator evidence: raw repeats are retained and counted; callback arrival timestamps must strictly increase. [Apple describes the display-link timestamps](https://developer.apple.com/documentation/quartzcore/cadisplaylink); they do not prove that each app pose reached the display.

Host progress pulls are infrequent (30 seconds) and happen over the existing device connection. There is no per-frame app logging or file output. The recordings are separate runs, explicitly marked `recording: true`; their measurements are not mixed into the unrecorded matrix.

## Captured results

The physical run used an **iPhone 17 Pro (`iPhone18,1`), iOS 27.2 / 24B5099f**, Jolt rc.2, NativeScript Core 9.1.3 and iOS runtime 9.1.0. Power saving and Reduce Motion were off; recorded thermal states were nominal. The display advertises 120 Hz, while this app’s default CADisplayLink intervals were approximately 16.67 ms. This is a roughly 60 Hz callback audit, not 120 Hz acceptance.

Raw evidence: [iPhone matrix](results/binding-budgets/2026-10-30-ios.json.gz), [Android emulator matrix](results/binding-budgets/2026-10-30-android.json.gz). Run the verifier to regenerate every summary from the raw gzip JSON. No trial is removed or averaged away in those files.

### iPhone preparation

Times are milliseconds. `first` means first use of that workload within the fixed-order process. Warm p50/p95 use seven samples, so p95 is the maximum. View-layer rows have no separate binding step.

| Workload            | First bind / start | Warm bind p50 / p95 | Warm start p50 / p95 |
| ------------------- | -----------------: | ------------------: | -------------------: |
| `value-1-x`         |        0.23 / 3.59 |         0.15 / 0.17 |          0.81 / 1.54 |
| `value-16-x`        |        0.44 / 8.17 |         0.39 / 0.43 |          7.03 / 7.73 |
| `value-64-x`        |       1.48 / 20.90 |         1.44 / 1.81 |        22.64 / 23.67 |
| `value-200-x`       |       4.63 / 52.93 |         0.87 / 1.46 |        23.47 / 25.54 |
| `value-16-x-scale`  |       2.21 / 17.33 |         1.10 / 1.26 |        17.51 / 18.04 |
| `value-64-x-scale`  |       4.21 / 49.06 |         1.01 / 1.54 |        23.16 / 25.43 |
| `value-200-x-scale` |       8.78 / 98.91 |         2.69 / 2.92 |        56.13 / 57.26 |
| `value-16-layers-2` |       1.11 / 52.32 |         0.59 / 0.90 |        36.51 / 45.92 |
| `value-16-layers-4` |       1.20 / 65.91 |         0.24 / 0.25 |        31.74 / 35.22 |
| `value-16-layers-8` |      1.20 / 104.09 |         0.22 / 0.24 |        52.38 / 57.49 |
| `view-16-layers-2`  |       0.00 / 67.14 |         0.00 / 0.00 |        31.75 / 35.55 |
| `view-16-layers-4`  |       0.00 / 96.17 |         0.00 / 0.00 |        56.89 / 61.73 |
| `view-16-layers-8`  |      0.00 / 160.94 |         0.00 / 0.00 |      126.48 / 127.44 |
| `value-64-loop`     |       6.80 / 98.13 |         0.72 / 1.05 |        71.09 / 72.90 |
| `value-1-window`    |        0.20 / 8.05 |         0.15 / 0.23 |          7.22 / 7.86 |
| `value-16-window`   |       1.10 / 47.67 |         0.61 / 0.89 |        38.49 / 45.46 |
| `value-64-window`   |      4.11 / 113.90 |         0.72 / 0.88 |        66.05 / 70.46 |
| `view-64-loop`      |      0.00 / 180.05 |         0.00 / 0.00 |      120.83 / 136.26 |
| `view-1-window`     |       0.00 / 13.86 |         0.00 / 0.01 |        12.24 / 13.25 |
| `view-16-window`    |       0.00 / 71.98 |         0.00 / 0.00 |        32.95 / 38.10 |
| `view-64-window`    |      0.00 / 159.15 |         0.00 / 0.00 |      113.74 / 122.54 |
| `value-64-observed` |       6.13 / 47.16 |         1.03 / 1.42 |        23.46 / 26.15 |

### iPhone diagnostic playback

CPU is the median process percentage across three trials (one core = 100%). Gap is the worst **callback** interval over all three trials; peak is the highest sampled process footprint. Submission counts include setup and boundaries for a single trial, not just the finally active tracks. Timing starts before the initial animation submission, so process CPU includes that work.

| Workload            | CPU % | Max callback gap (ms) | Sampled peak (MiB) | Track submissions / numeric values per trial |
| ------------------- | ----: | --------------------: | -----------------: | -------------------------------------------: |
| `value-1-x`         |  1.18 |                 16.85 |              49.47 |                                        1 / 3 |
| `value-16-x`        |  1.51 |                 16.82 |              39.52 |                                      16 / 48 |
| `value-64-x`        |  2.44 |                 16.83 |              49.67 |                                     64 / 192 |
| `value-200-x`       |  4.24 |                 16.85 |              50.14 |                                    200 / 600 |
| `value-16-x-scale`  |  2.30 |                 33.17 |              38.19 |                                     48 / 144 |
| `value-64-x-scale`  |  5.12 |                 33.20 |              38.05 |                                    192 / 576 |
| `value-200-x-scale` |  7.65 |                 65.58 |              41.03 |                                  600 / 1,800 |
| `value-16-layers-2` |  6.67 |                 24.52 |              37.86 |                                 240 / 10,944 |
| `value-16-layers-4` |  6.71 |                 42.39 |              39.24 |                   432 / 21,648; 432 / 21,792 |
| `value-16-layers-8` | 10.29 |                 34.13 |              46.17 |     768 / 42,960; 816 / 43,488; 816 / 43,536 |
| `view-16-layers-2`  | 11.37 |                 16.90 |              41.86 |     312 / 16,174; 316 / 16,231; 324 / 16,132 |
| `view-16-layers-4`  |  9.09 |                 28.36 |              40.36 |     507 / 26,967; 507 / 27,040; 539 / 27,118 |
| `view-16-layers-8`  | 13.60 |                 17.73 |              38.27 |     959 / 49,634; 965 / 49,517; 978 / 49,669 |
| `value-64-loop`     |  3.04 |                 26.19 |              47.58 |                                 384 / 56,064 |
| `value-1-window`    |  1.53 |                 18.52 |              51.60 |                                   12 / 2,178 |
| `value-16-window`   |  2.97 |                 66.53 |              55.97 |                                 192 / 34,848 |
| `value-64-window`   |  5.06 |                116.59 |              43.69 |                                768 / 139,392 |
| `view-64-loop`      |  5.04 |                 50.21 |              53.47 |                                576 / 101,952 |
| `view-1-window`     |  2.10 |                 17.35 |              58.31 |                                   15 / 2,688 |
| `view-16-window`    |  3.57 |                 57.64 |              70.03 |                                 240 / 43,008 |
| `view-64-window`    |  6.42 |                130.13 |              49.80 |                                960 / 172,032 |
| `value-64-observed` |  4.48 |                 17.02 |              52.24 |                                    192 / 576 |

### What these measurements support

- **Prefer compatible periods for repeating composition.** Both 64-view common-loop paths had zero boundary submissions during their 8.8-second playback windows. Initial setup still cost time: warm median start was 71.09 ms for values and 120.83 ms for direct view layers. Native playback does not make starting a large batch free.
- **Keep windowed fan-out small until measured in the target screen.** The composed-value boundary took 6.96–8.28 ms for one view, 37.46–45.61 ms for 16 views and 82.31–95.47 ms for 64 views, each with three properties. One view is the only tested fan-out below a whole 16.67-ms interval in this workload; it is not an endorsed maximum because a real screen shares that interval with layout, input and rendering. The 16/64-view cases already exceed it, so they are unsuitable for an uninterrupted 60 Hz main-thread budget in this configuration.
- **Direct view windows have the same scaling concern.** Their per-property completion callback maximum (5.91/7.11/9.10 ms for 1/16/64 views) is not the cost of the whole boundary. Many callbacks execute together; the corresponding worst display callback gaps were 17.35/57.64/130.13 ms. Do not compare one completion callback with an entire motion-value rebuild.
- **Prepare large finite/layered batches outside latency-sensitive input.** Warm median start was 23.16 ms for 64 views × three properties, 56.13 ms for 200 views × three properties, and 126.48 ms for 16 views with eight direct-view layers. Binding setup alone was much cheaper. More bindings, more properties and more layers are separate dimensions; the small sample and fixed case order do not establish a smooth scaling law.
- **Investigate composition preparation and submission together before moving only numeric evaluation to native.** In the 64-view value case, each boundary resubmitted 192 tracks. Calls into the native driver consumed 27.15–31.53 ms of the 82.31–95.47 ms boundary; the remaining time includes sampling/composition, JS bookkeeping and wrapper overhead. Moving only the evaluator cannot remove all this measured work. Native persistent composition or less rebuilding warrants a separate implementation proposal; the initial audit changed no shipping runtime. The Android follow-up below tests native keyframe construction.
- **Explicit observation changes the JS contract.** The observed workload used JS frame callbacks; all unobserved playback cases used zero JS frame callbacks. Small differences in process CPU between separate trials are not evidence that a subscriber is free.

All 66 iPhone playback trials ended with zero tracked bindings, view channels, active tracks, live native nodes/clocks, frames and timers after disposal, and no new tracked work during the quiet interval. Every case unmounted its tiles before the final snapshot. The matrix is one process, so its memory curve includes accumulated report data and caches; use allocation/heap profiling for a retained-memory budget.

### Android emulator diagnostics: 21 accepted cases, one retained failure

The dedicated Pixel 6 AVD used Android 16 / API 36, build `BP22.250325.006`, an ARM64 image, NativeScript Core 9.1.3 and Android runtime 9.1.1. It advertised approximately 60 Hz, with animator scale 1 and power saving off. The Mac host also had other emulator sessions; this is functional/diagnostic evidence, **not physical Android capacity or a cross-platform performance comparison**.

All 22 cases and 66 trials were saved. The strict case audit passes **21 cases** and rejects `view-16-layers-8`: its first trial spent **33,555 ms** starting the workload, with a **35,763 ms** total native sampling interval, exceeding the 30-second acceptance ceiling. The following start samples were 1,727 and 1,340 ms. The slow trial is retained verbatim; no faster replacement or relaxed ceiling is used to mark the matrix accepted. The cause of the spike is not isolated by this process-level probe.

All 66 Android trials reported zero retained bindings, channels, native live nodes/clocks, active tracks, frames and timers after disposal. That is useful cleanup evidence even though one timing window is rejected. The 21 accepted cases contain 15 repeated Choreographer frame timestamps, preserved and counted separately from strictly increasing callback arrival times. No presented-frame conclusion is drawn from them.

Two exploratory captures were superseded before this final snapshot: intrusive PSS sampling stalled the first probe, and a later capture lost an ADB transfer and exposed that the fixed sampling interval did not always reach two expensive boundaries. The final probe uses RSS and retains extended elapsed time until the second boundary, without discarding the slow work. The complete final matrix still exposes the overload above.

The normal Android verifier **must exit 1** for the committed matrix. `--audit` prints all 21 successful summaries and the failure, also exiting 1. Offline tests require this exact known failure and ensure it cannot disappear silently. An emulator override permits diagnostics, not acceptance of the rejected case:

```sh
python3 benchmarks/verify-binding-budgets.py \
  benchmarks/results/binding-budgets/2026-10-30-android.json.gz --allow-simulator --audit
# Expected: accepted=false; failed.view-16-layers-8; exit status 1.
```

No Android binding limit is proposed from these emulator timings. The physical Android and heavier-case follow-ups below provide separate evidence.

## Real input

XCTest on iOS and ADB on Android deliver three out-and-back gesture pairs per path. The app records native movement and counters at the start, end, disposal and quiet boundaries:

| Path             | Workload                                                                                     | Execution contract                                                    |
| ---------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `drag()`         | One value drives x/scale on 64 views                                                         | JS processes pan input; release can use prepared native playback.     |
| `gestures()`     | Native pan drives x/scale on 64 views                                                        | Native movement/bindings; JS receives start/end/cancel semantics.     |
| `scrollValue()`  | Core ScrollView offset maps to x/scale on 64 views                                           | JS processes each scroll notification.                                |
| `scrollHeader()` | Supported Core ListView recipe with 80 fixed-height rows and retained header/toolbar/section | Native offset/composition; coarse state and layout work can enter JS. |

The two scroll workloads use different supported containers and visual contracts. They are not an equivalent-content speed comparison. Counts of JS move callbacks distinguish the paths, not total application callback counts. The traces confirm sampled native movement and cleanup, **not input-to-photon latency**.

The eight input reports are stored beside the matrix as `2026-10-30-{ios,android}-{drag-js,pan-native,scroll-js,header-native}.json.gz`. Each contains all native frame samples and start/end/disposed/idle snapshots. These are unrecorded, clean Release runs, separate from the videos.

| Platform / path                    | Sampled movement (DIP) | JS move callbacks | Semantic callbacks | Window (ms) | Process CPU (ms) | Sampled peak (MiB) |
| ---------------------------------- | ---------------------: | ----------------: | -----------------: | ----------: | ---------------: | -----------------: |
| iPhone / `drag-js`                 |                  24.00 |               287 |                  0 |       10619 |             3477 |             144.50 |
| iPhone / `pan-native`              |                  24.00 |                 0 |                 12 |       10536 |             2549 |              40.61 |
| iPhone / `scroll-js`               |                  16.43 |              1056 |                  0 |       15637 |             5827 |             120.88 |
| iPhone / `header-native`           |                  55.67 |                 0 |                  9 |       16320 |             1928 |              47.66 |
| Android emulator / `drag-js`       |                  24.00 |               233 |                  0 |        8007 |             1626 |             182.86 |
| Android emulator / `pan-native`    |                  24.00 |                 0 |                 12 |        7988 |              996 |             172.71 |
| Android emulator / `scroll-js`     |                   3.76 |               264 |                  0 |        8057 |             2198 |             184.93 |
| Android emulator / `header-native` |                  55.00 |                 0 |                 12 |        7964 |             1589 |             178.39 |

The sampled movement is the bound output, not finger travel. Gesture distance, inertia and delivered event counts differ between XCTest and ADB; these windows are not matched input-latency or platform speed comparisons. Every path returned to zero tracked native live nodes/clocks, active tracks, pending frames and pending timers, with no new tracked callbacks during the quiet interval. Matrix trials additionally check binding and channel removal.

## Reproduce

Use a dedicated device session, not another recording window's device. Build platforms sequentially because NativeScript shares generated app assets. Start with the normal demo resource setup described in [CONTRIBUTING](../CONTRIBUTING.md) and [layout lifecycle](layout-lifecycle.md); Android launcher/theme resources are generated locally.

```sh
npm ci
npm run build
npm run benchmark:typecheck
cd demo
npm install

# Physical iOS, normal locally configured Apple development signing:
JOLT_BENCHMARK=1 JOLT_BINDING_BENCHMARK=1 ns build ios --for-device --release \
  --env.production --env.bindingBenchmark --no-hmr --team-id YOUR_TEAM

# Android: supply your local test keystore to sign the Release artifact.
JOLT_BENCHMARK=1 JOLT_BINDING_BENCHMARK=1 ns build android --release \
  --env.production --env.bindingBenchmark --no-hmr \
  --key-store-path YOUR_KEYSTORE --key-store-alias YOUR_ALIAS \
  --key-store-password YOUR_PASSWORD --key-store-alias-password YOUR_PASSWORD
```

Install the `.app` extracted from the development IPA with `devicectl device install app`, or the Release APK with `adb -s YOUR_SERIAL install`. The benchmark refuses simulated devices by default. Emulator validation requires the explicit override below and remains labelled simulated in the report.

```sh
# From the repository root, after installation:
python3 benchmarks/run-binding-budgets.py ios YOUR_IPHONE /tmp/bindings-ios.json
python3 benchmarks/run-binding-budgets.py android YOUR_SERIAL /tmp/bindings-android.json --allow-simulator
python3 benchmarks/verify-binding-budgets.py /tmp/bindings-ios.json
python3 benchmarks/verify-binding-budgets.py /tmp/bindings-android.json --allow-simulator

# A fresh-process individual workload; verify the declared subset explicitly:
python3 benchmarks/run-binding-budgets.py ios YOUR_IPHONE /tmp/window.json --case value-16-window
python3 benchmarks/verify-binding-budgets.py /tmp/window.json --case value-16-window
```

For Android below API 29, the platform does not expose the thermal-status API used by the native probe. The report preserves `thermalState: null`, `apiLevel`, and `thermalStatusAvailable: false`; it must never replace the missing measurement with nominal status. The matrix requires an explicit diagnostic opt-in, and offline verification requires the same acknowledgement:

```sh
python3 benchmarks/run-binding-budgets.py android YOUR_SERIAL /tmp/bindings-physical-android.json --allow-unavailable-thermal
python3 benchmarks/verify-binding-budgets.py /tmp/bindings-physical-android.json --allow-unavailable-thermal --audit
python3 benchmarks/verify-binding-input.py /tmp/binding-input-android/pan-native.json --allow-unavailable-thermal
```

This option allows inspecting real-device observations with unavailable thermal telemetry. It does not establish nominal temperature, absence of throttling, or thermally controlled capacity. The default verifier continues to reject these reports. The override cannot accept an unknown status on newer Android/iOS, a reported nonzero thermal state, or power saving. Host battery-temperature snapshots are supplementary context, not a substitute for the missing thermal-status measurement. Existing duration, buffer, cleanup and workload checks retain their thresholds.

The runner refuses to overwrite evidence, rejects stale sessions, has a 15-minute collection ceiling per invocation and preserves partial results on failure. If the app is still running after that ceiling, `--resume` continues collecting the same pending session without relaunching it; previously collected workloads must remain identical. This does not relax the 30-second per-trial verifier ceiling. The default thermal check requires nominal status; the explicit pre-29 diagnostic option above retains an unknown status. Power saving must be off, and the app must stay active. Reports retain failure reasons instead of silently dropping trials. `--allow-dirty` exists for development-only verifier runs; committed acceptance evidence uses a clean build.

For input, generate a signed XCTest runner using `benchmarks/docs-ios-ui.rb` with `benchmarks/binding-budgets-ios.swift`, following [the physical sensor runner setup](device-sensors.md#physical-iphone-audit-2026-10-29). Give its test bundle a distinct identifier if another runner is in use. Execute `DocsTests/testInputWindows`, then copy `Documents/binding-input-{drag-js,pan-native,scroll-js,header-native}.json` from the benchmark app container. Android's runner also copies the fresh per-path files:

```sh
python3 benchmarks/binding-budgets-android.py YOUR_SERIAL /tmp/binding-input-android
python3 benchmarks/verify-binding-input.py /tmp/binding-input-android/pan-native.json --allow-simulator
```

`DocsTests/testMatrixRecording` runs the 64-view composition-window scene with a real tap. `DocsTests/testRecording` runs only the native pan scene with an eight-second capture lead-in and marks it as a recording. Android supports `--case pan-native --recording` for the same purpose. For this iPhone, the `devicectl` screen-record capability was unavailable. Device Hub could mirror the physical screen, so the recording used `screencapture -v -l WINDOW_ID -V 55 /tmp/phone.mov` on that specific window. The clip crops the window chrome and trims launch/idle footage only; elapsed animation time is unchanged. ADB screenrecord records the emulator. The [recording manifest](results/binding-budgets/recordings.json) records source platform, retained frame counts, trims, hashes and timestamp checks. Re-encoding uses `-fps_mode passthrough -enc_time_base 1:1000000`; every retained frame keeps its source-relative timestamp (within one microsecond), without interpolation or speed changes. Both H.264 clips were decoded and visually reviewed. Preserve original elapsed time and inspect the full clips. Do not use screen-capture frame counts as a performance result.

## CI and remaining acceptance

The existing host CI job runs the offline verifiers, captured-trace negative controls and device/recording/overload guards, including the physical Android failures and collector-resumption checks. No physical-device job, benchmark loop, new native workflow or larger native timeout is added.

```sh
python3 -m unittest discover -s benchmarks -p 'test_binding_budgets.py'
npm run docs:check-media
npm run docs:build
```

The initial audit left input latency, allocation/retained memory and the large playback stalls for the follow-ups below. Current results have explicit device, thermal and callback-cadence limits; they do not establish universal capacity or presented-frame acceptance. Broader hardware/refresh-rate coverage is future coverage, not a prerequisite added by this audit. The independent Flutter/Reanimated comparison remains in #65.

## Physical Android follow-up (2026-10-30)

A physical **ASUS_Z017DC / ASUS Z017D, Android 8.0.0 / API 26**, ran all 22 workloads and 66 playback trials automatically, followed by the four real ADB gesture/scroll windows. No manual interaction or recording was required. The clean Release build is `e6bbc755f3064bd56611922ffb7793575c8c5ec9`, based on main after #114 acceptance, with Jolt rc.2, NativeScript Core 9.1.3 and Android runtime 9.1.1. Production JavaScript, no HMR, approximately 60 Hz reported display rate, animator scale 1 and power saving off.

The device was charging. The archived before/after battery snapshots report 30.5°C and 31.0°C, with charge increasing from 73% to 84%. These battery readings do **not** establish CPU/GPU thermal state. API 26 has no thermal-status telemetry through this probe, so every resource snapshot keeps `thermalState: null`; this run explicitly uses `unavailable-android-pre29`. It supplies physical-device observations, not thermally controlled capacity acceptance.

Evidence: [complete physical matrix](results/binding-budgets/2026-10-30-physical-android.json.gz), [device/build/collection conditions and decompressed hashes](results/binding-budgets/2026-10-30-physical-android-conditions.json). The 1,148.3-second matrix remained one app process and one session. The host collector reached its 900-second deadline after saving 18 workloads; `--resume` collected the remaining workloads without relaunching the app. All previously collected cases are unchanged. No trial was restarted or replaced, and the 30-second per-trial verifier limit remains unchanged.

### Twenty verified workloads, two retained sparse-window failures

With the explicit unavailable-thermal acknowledgement, the offline audit verifies **20 workloads** and rejects **two**. The complete matrix remains rejected. Without that acknowledgement, the default verifier rejects the thermal condition before considering workload acceptance.

| Rejected workload   | Trial (zero-based) | Native window | Native display callbacks | Memory samples | Result                |
| ------------------- | -----------------: | ------------: | -----------------------: | -------------: | --------------------- |
| `value-16-layers-2` |                  1 |    3,959.0 ms |                        1 |              3 | Insufficient sampling |
| `view-16-layers-8`  |                  2 |    8,524.8 ms |                        3 |              3 | Insufficient sampling |

The native recorder requires at least four memory samples and more than five display callbacks. Both sparse windows remain verbatim in the raw report. They do not establish a frame-pacing or peak-memory result for those workloads, and these observations do not isolate the cause of the stalls. Other repetitions are not substituted to make the cases pass. Offline tests require both exact failures and retain the earlier emulator's independent overload failure.

All **66 trials**, including the two sparse ones, returned tracked bindings, composition channels, native live nodes/clocks, active tracks, frame requests and timers to zero after disposal. The quiet-period counters did not advance. This establishes the measured cleanup contract, not a retained-heap bound.

```sh
python3 benchmarks/verify-binding-budgets.py   benchmarks/results/binding-budgets/2026-10-30-physical-android.json.gz   --allow-unavailable-thermal --audit
# Expected exit 1: 20 passed workloads; the two sparse-window failures above.
```

### Preparation and composition costs

Milliseconds; warm p50/p95 use seven samples, so p95 is their maximum. The following rows come from workloads whose diagnostic checks passed. First use is within this fixed-order process, not an isolated cold launch.

| Workload            | First start ms | Warm start p50 / p95 ms |
| ------------------- | -------------: | ----------------------: |
| `value-1-x`         |             42 |                  8 / 10 |
| `value-16-x`        |             35 |                 54 / 66 |
| `value-64-x`        |            154 |               114 / 150 |
| `value-200-x`       |            298 |               250 / 259 |
| `value-64-x-scale`  |            230 |               237 / 292 |
| `value-200-x-scale` |            567 |               583 / 611 |
| `value-16-layers-8` |           6798 |             3028 / 3307 |
| `value-64-loop`     |           4235 |             3749 / 3793 |
| `view-64-loop`      |           5780 |             5557 / 5831 |

The composed-value window boundary took **116–130 ms for one view**, **814–885 ms for 16 views**, and **2,907–6,960 ms for 64 views**, each with three properties. Even the smallest tested boundary exceeded a 16.67-ms interval in this run. Windowed composition is therefore a substantial concern for latency-sensitive interaction on this configuration; the trace does not justify a universal binding maximum.

Both 64-view common-loop paths submitted no new boundary tracks during playback. Their startup cost remained large, and direct view looping still had a worst observed display callback gap of **1,864 ms**. Eliminating boundary submissions does not prove smooth presentation. The corresponding windowed paths reached callback gaps of **6,964 ms** for composed values and **5,105 ms** for direct view layers. These are native callback gaps, not presented-frame or input-to-photon measurements.

Whole-process CPU, sampled RSS, probe overhead and submitted-track counts are retained for every trial. RSS reached approximately **736 MiB** in the accepted `view-64-loop` workload, in a process that accumulates report data and runtime caches across the matrix. It is not a retained-view memory budget. The results reinforce the need to investigate composition preparation, native submission and the sparse windows together before moving only the numeric evaluator into native code. They do not identify which stage caused each stall or establish a cross-platform speed ratio.

### Automatic real input

The four fresh-process input runs pass the diagnostic verifier with unavailable thermal status explicitly acknowledged. Each uses three out-and-back gesture pairs delivered by ADB. The raw traces are [drag](results/binding-budgets/2026-10-30-physical-android-drag-js.json.gz), [native pan](results/binding-budgets/2026-10-30-physical-android-pan-native.json.gz), [scroll value](results/binding-budgets/2026-10-30-physical-android-scroll-js.json.gz) and [native header](results/binding-budgets/2026-10-30-physical-android-header-native.json.gz).

| Path            | Sampled output movement DIP | JS move callbacks | Semantic callbacks | Window ms | Process CPU ms | Sampled peak RSS MiB |
| --------------- | --------------------------: | ----------------: | -----------------: | --------: | -------------: | -------------------: |
| `drag-js`       |                       24.00 |               135 |                  0 |     12334 |           2756 |               122.40 |
| `pan-native`    |                       24.00 |                 0 |                 12 |     12256 |           1758 |               113.04 |
| `scroll-js`     |                        3.75 |               268 |                  0 |     12416 |           6240 |               122.49 |
| `header-native` |                       55.00 |                 0 |                  9 |     12127 |           2452 |               119.89 |

Both native paths used zero per-move JS callbacks. All four paths advanced the bound native output and returned tracked live nodes/clocks, active tracks, frames and timers to zero, with unchanged counters during the quiet interval. The two scroll paths use different supported containers and behavior, and delivered event rates differ between gesture paths; these are not matched latency or speed comparisons. No presented-frame or input-to-photon claim is made.

The earlier reviewed English physical-iPhone and Android-emulator clips remain embedded in all four guide languages with their original platform labels. They illustrate the existing workloads; the new physical Android measurements are unrecorded. No new footage or manual repetition was requested. That baseline follow-up changed the diagnostic capability handling, collector, offline evidence and documentation; it did not change the shipping animation runtime or close #242's remaining acceptance items.

## Android keyframe construction in bulk

The follow-up implementation moves **numeric keyframe construction** into `KeyframeFactory.java`. TypeScript still samples and composes the curves, resolves units, and owns playback controls. It passes the offsets and values to Java in one call per track. Java constructs the same float keyframes and `PropertyValuesHolder`, then returns the same kind of `ObjectAnimator`. Translation is multiplied in double precision before conversion to float, matching the old driver. Color, decoration and native live-source implementations are unchanged.

Rebuild the Android app to include the factory and its NativeScript metadata. A binary without the factory keeps the previous numeric construction path. The native regression check compares the old and new interpolators at **192 property/unit/time combinations**: eight properties, three unit scales, irregular offsets, intermediate positions and a backward seek. It also rejects mismatched arrays. The existing native CI suite covers playback, interruption, cancellation, pause/resume and seek; it now runs this equivalence check too.

### Protocol and retained diagnostics

The full comparison uses the same ASUS_Z017DC, API 26, Release native build, production JavaScript, animator scale, workload order, seven warm preparation samples and three playback trials. The optimized source is `dd4bc22f328ae912c79174b969fe4e25c35bf8c7`. The device still cannot report thermal status; the explicit unavailable-thermal diagnostic acknowledgement remains necessary. The native equivalence check runs before the optimized matrix, so its first-use samples are **not cold-start comparisons**. The comparisons below use warm preparation. These are sequential runs, not randomized/interleaved trials or universal speed ratios.

The original full matrix and its two failed sampling windows remain unchanged. An additional [fresh-process legacy diagnostic](results/binding-budgets/2026-10-30-android-baseline-isolated.json.gz) ran `value-16-layers-2` with system tracing enabled. All three sampling windows passed, but one still had an 822-ms callback gap. The [app-only trace](results/binding-budgets/2026-10-30-android-baseline-app.trace.gz) and [projection provenance](results/binding-budgets/2026-10-30-android-baseline-trace.json) retain Jolt process markers without other applications' scheduler activity. The trace includes a concurrent ART collection lasting about 286 ms during that trial and main-thread animation work of roughly 181–200 ms near completion. A concurrent collection's total duration is not its main-thread pause time. These observations do not establish the cause of either original sparse window.

A first incremental build contained the new Java class but omitted its NativeScript metadata. The equivalence check stopped before any workload: [failed report](results/binding-budgets/2026-10-30-android-bulk-stale-metadata.json.gz). A clean rebuild made the class available and passed all 192 comparisons plus the one-view playback check: [smoke report](results/binding-budgets/2026-10-30-android-bulk-smoke.json.gz). The failed attempt is not counted as a performance result.

The Android probe now records [ART runtime allocation/GC counters](<https://developer.android.com/reference/android/os/Debug#getRuntimeStats()>) only at the beginning and end of each playback window. `artDelta` in the offline summary contains approximate Java-heap allocated/freed bytes, GC count/time and blocking-GC count/time. It includes the runtime and diagnostics; it does not measure V8 allocation, GPU memory or retained heap. `probeWorkMs` still measures only the sampler callbacks; boundary counter collection is included in the native window and process CPU. The per-frame sampler and all existing thresholds remain unchanged. Earlier reports lack these counters, so they cannot establish an old/new allocation reduction.

### Results and limits of the optimization

[Full optimized matrix](results/binding-budgets/2026-10-30-android-bulk.json.gz). The run completed all **22 workloads / 66 trials** in one process in 561.5 seconds. Every trial had enough native callback and memory samples and returned tracked resources to zero with unchanged quiet-period counters. The two workloads with sparse windows in the original matrix met these checks in the new run; the original failures remain archived, and this is not proof of their cause.

The stricter audit accepts **19 workloads** and rejects **three** because the new ART allocated-byte counter decreased within a trial:

| Workload           | Trial (zero-based) | Allocated-byte counter before / after |
| ------------------ | -----------------: | ------------------------------------: |
| `value-64-x`       |                  2 |               24,880,056 / 21,955,512 |
| `value-16-x-scale` |                  2 |               34,268,152 / 31,400,952 |
| `value-16-window`  |                  0 |             362,879,712 / 350,186,208 |

The Android API describes these counters as approximate and warns that individual allocations may not be immediately reflected. The decreasing values remain exact in the raw report. The verifier rejects them instead of clamping the delta or claiming negative allocations. **The complete matrix therefore remains rejected.** Preparation times, sampled poses and cleanup are separate observations; none establish a retained-heap budget or an allocation reduction. There is no allocation-counter baseline for the old implementation.

```sh
python3 benchmarks/verify-binding-budgets.py benchmarks/results/binding-budgets/2026-10-30-android-bulk.json.gz --allow-unavailable-thermal --audit
# Expected exit 1: 19 passed workloads; three ART counter regressions retained above.
```

Warm preparation milliseconds, p50 / p95 (seven samples; p95 is the maximum). These selected rows pass the strict diagnostic checks in both full matrices:

| Workload            | Previous construction | Bulk construction |
| ------------------- | --------------------: | ----------------: |
| `value-16-x`        |               54 / 66 |           35 / 37 |
| `value-200-x`       |             250 / 259 |         156 / 184 |
| `value-64-x-scale`  |             237 / 292 |         154 / 176 |
| `value-200-x-scale` |             583 / 611 |         332 / 371 |
| `value-16-layers-4` |         1,539 / 1,629 |         254 / 286 |
| `value-16-layers-8` |         3,028 / 3,307 |         424 / 544 |
| `value-64-loop`     |         3,749 / 3,793 |         390 / 413 |
| `view-64-loop`      |         5,557 / 5,831 |     1,293 / 1,367 |
| `value-1-window`    |             111 / 113 |           23 / 29 |
| `value-64-window`   |         3,127 / 3,232 |         386 / 453 |
| `view-64-window`    |         4,849 / 7,281 |     1,126 / 1,149 |

For composed values, one-view boundary work dropped from **116–130 ms to 13–18 ms**. At 64 views it dropped from **2,907–6,960 ms to 368–670 ms**. The 16-view timing observation was **113–161 ms**, but that workload's allocation audit failed as listed above. Even one view still crossed a 16.67-ms interval in this run. The optimized 64-view windows still had worst native callback gaps of **672.5 ms** (composed values) and **803.1 ms** (direct view layers). The 64-view value common-loop workload had a **1,867.4-ms** gap despite zero boundary submissions. Faster preparation does not establish smooth presentation, and native playback alone does not isolate runtime pauses.

Practical guidance on this measured configuration: prepare large finite batches ahead of interaction; prefer compatible native loops when the movement permits them; keep windowed multi-property composition out of latency-sensitive paths as view counts increase. There is no supported universal binding maximum. Bulk construction removes substantial submission work, but the remaining costs warrant investigating persistent native composition and runtime allocation/GC together, rather than moving only the scalar evaluator. The follow-up below adds native input-onset and bounded retained-memory observations; this comparison retains its hardware, thermal and callback-cadence limits.

The same clean optimized APK then passed four fresh-process automated input windows: [drag](results/binding-budgets/2026-10-30-android-bulk-drag-js.json.gz), [native pan](results/binding-budgets/2026-10-30-android-bulk-pan-native.json.gz), [scroll value](results/binding-budgets/2026-10-30-android-bulk-scroll-js.json.gz) and [native header](results/binding-budgets/2026-10-30-android-bulk-header-native.json.gz). All advanced the native output and cleaned up; native pan/header used zero per-move JS callbacks. These checks do not measure input-to-photon latency. The [conditions and hashes](results/binding-budgets/2026-10-30-android-bulk-conditions.json) identify the clean build, raw reports and reused English emulator layer clip. No new recording was made. The battery snapshot after input was 100% / 28.7°C while charging; no before-run battery snapshot was collected for this optimized run.

## Repeated disposal and native-input onset (2026-10-30)

This follow-up uses the same physical iPhone 17 Pro and ASUS_Z017DC, with Release native builds, production JavaScript and no recording during collection. The clean Android source is `488cdab9019fa7740536397098c5e8712289f7ec`; iOS is `31d4f23fa05aefe68c8de99c88a4629895bb58ab`. The only intervening source change adds the offline Python verifier; the app and native diagnostics are identical. The [conditions manifest](results/binding-budgets/2026-10-30-diagnostics-conditions.json) identifies binaries, sessions, raw-data hashes and limits. iOS thermal snapshots were nominal; Android API 26 still requires the explicit unavailable-thermal acknowledgement.

### Bounded retention

Each process first deliberately retains one detached native view, confirms its weak reference is alive after collection, releases it, and confirms that it disappears. This validates that the weak-view diagnostic detects both retention and release. It then runs **15 mount/animate/dispose/unmount cycles**, each with 64 views, three properties and two motion-value layers. The first three cycles warm up the runtime; the remaining 12 supply the table below. Each cycle observes 250 ms of finite playback, disposes twice, removes the views, and checks 650 ms without new tracked callbacks, frames, timers or submissions. Two explicit JavaScript collection requests follow, with 300 ms after each; Android additionally requests Java GC/finalization. GC requests are not guarantees; the weak references provide the observed outcome.

Both phones released **all 960 watched native views**, and every cycle ended with zero tracked bindings, channels, native live nodes/clocks, tracks, frames and timers. No tracked work advanced in the quiet intervals. The reports retain snapshots while mounted, after disposal before requested collection, and after collection: [iPhone](results/binding-budgets/2026-10-30-retention-ios.json.gz), [Android](results/binding-budgets/2026-10-30-retention-android.json.gz).

Process allocator measurements, in bytes unless stated otherwise. These include the NativeScript runtime, diagnostic and accumulated report data. Ranges cover the 12 measured cycles; they are observations rather than a universal memory allowance.

| Device / allocator metric           | Mounted p50 | Before requested GC p50 |      After GC min–max | After GC first→last |
| ----------------------------------- | ----------: | ----------------------: | --------------------: | ------------------: |
| Android Java used heap              |   5,419,880 |               5,509,992 |   1,905,480–1,921,864 |                   0 |
| Android native allocated bytes      |  33,932,120 |              33,784,104 | 32,800,768–33,729,680 |            −399,648 |
| iPhone malloc bytes in use          |  20,381,824 |              21,884,464 |   9,032,880–9,213,200 |            +180,320 |
| iPhone malloc blocks in use (count) |     263,507 |                 271,160 |         30,533–30,569 |                 +36 |
| iPhone malloc bytes reserved        |  62,914,560 |              62,914,560 | 62,914,560–62,914,560 |                   0 |

Android uses `Runtime.totalMemory() - freeMemory()` and `Debug.getNativeHeapAllocatedSize()`; iOS uses `malloc_zone_statistics(NULL, ...)` across malloc zones. These are current allocator footprints, **not allocation-event counts, Jolt-only costs, total V8/GPU memory, or proof of unbounded leak freedom**. The small iPhone post-collection increase remains visible; there is no arbitrary zero-growth threshold. The earlier approximate ART counter regressions remain archived and rejected; current footprints do not retroactively validate those deltas.

### Input onset procedure

The runners deliver three out-and-back gesture pairs for each of `drag()`, native pan, `scrollValue()` and `scrollHeader()`, with 1.2 seconds between gestures. A demo-only native probe stores the OS event timestamp, arrival at the probe, action and coordinates in a fixed buffer. Android wraps the activity window callback and forwards events unchanged; iOS adds a passive recognizer that neither cancels touches nor prevents other recognizers. Neither sends per-move callbacks into JavaScript. Android event time is quantized to milliseconds; its coordinates are physical pixels, while iOS coordinates are points. The clocks are monotonic uptime within each app, not synchronized across devices.

The verifier starts at the **first displaced MOVE**, requires three stable native output samples before DOWN (within 0.02 DIP), and finds the first subsequent sampled output change above 0.02 DIP. It reports both OS-event→native-pose and probe-arrival→native-pose intervals. Each gesture stays in the summary, including any exclusion reason. The output is sampled through CADisplayLink/Choreographer at roughly 60 Hz here; iPhone hardware advertises 120 Hz but this app does not request it. This measures onset of the sampled native output, including gesture recognition, mapping/clamping and sampling delay. It does not isolate Jolt processing, measure ongoing tracking lag, or measure input-to-photon latency. The native pan and drag routes also receive different event delivery rates; these are not matched cross-path speed comparisons.

The first Android latency launch aborted in `RenderThread` with `EGL_NOT_INITIALIZED`, before Ready or any gesture. The [app-only crash record](results/binding-budgets/2026-10-30-latency-android-launch-failure.log) is preserved. A second launch of the same installed APK completed all four paths; no trial data from the failed launch was replaced.

### Input onset observations

Milliseconds; p50 / p95 uses nearest rank, so p95 is the maximum of six onsets (three for the iPhone header). Each normal run is a fresh app process. The baseline and injected-delay runs are separate; do not mix their samples.

| Device / path           | Valid onsets / gestures | OS event→pose p50 / p95 | Probe arrival→pose p50 / p95 |
| ----------------------- | ----------------------: | ----------------------: | ---------------------------: |
| Android `drag-js`       |                   6 / 6 |           27.22 / 34.71 |                12.69 / 17.15 |
| Android `pan-native`    |                   6 / 6 |           28.71 / 31.39 |                18.54 / 19.38 |
| Android `scroll-js`     |                   6 / 6 |           62.57 / 67.26 |                50.78 / 55.22 |
| Android `header-native` |                   6 / 6 |          45.12 / 212.37 |               33.83 / 200.79 |
| iPhone `drag-js`        |                   6 / 6 |         128.36 / 137.57 |              112.99 / 121.29 |
| iPhone `pan-native`     |                   6 / 6 |           55.08 / 56.88 |                38.59 / 39.16 |
| iPhone `scroll-js`      |                   6 / 6 |           86.37 / 89.32 |                70.70 / 74.80 |
| iPhone `header-native`  |                   3 / 6 |           81.04 / 81.13 |                64.41 / 66.72 |

The header is a clamped mapping, not a one-to-one pointer follower. On iPhone, three return gestures held the sampled artwork at its 55-DIP clamp through the end of the gesture plus the 100-ms search allowance; those rows remain explicitly excluded, not converted to zero latency. The Android header's long return onsets also begin at that clamp. These intervals describe the supported component behavior, not a pure event-dispatch cost. The no-delay native input probe itself accumulated 1.008–1.160 ms of work across 140–249 events per Android run and 0.057–0.253 ms across 162–335 events per iPhone run. Pose sampling and the rest of the process have their own overhead. No overhead is subtracted from the reported response times.

Raw normal input: Android [drag](results/binding-budgets/2026-10-30-latency-android-drag-js.json.gz), [pan](results/binding-budgets/2026-10-30-latency-android-pan-native.json.gz), [scroll](results/binding-budgets/2026-10-30-latency-android-scroll-js.json.gz), [header](results/binding-budgets/2026-10-30-latency-android-header-native.json.gz); iPhone [drag](results/binding-budgets/2026-10-30-latency-ios-drag-js.json.gz), [pan](results/binding-budgets/2026-10-30-latency-ios-pan-native.json.gz), [scroll](results/binding-budgets/2026-10-30-latency-ios-scroll-js.json.gz), [header](results/binding-budgets/2026-10-30-latency-ios-header-native.json.gz).

### Calibration and reproduction

The Android [40-ms control](results/binding-budgets/2026-10-30-latency-android-drag-js-delay-40.json.gz) delays the first displaced MOVE of each gesture before forwarding it. Probe-arrival→pose changed from **12.11–17.15 ms** without delay to **53.07–57.64 ms** with it. The initial iPhone [40-ms control](results/binding-budgets/2026-10-30-latency-ios-drag-js-delay-40.json.gz) was **inconclusive**: its 111.56–121.27-ms onset overlapped the 112.17–121.29-ms normal range. Existing gesture recognition time can absorb a short early delay, so a lower-bound check alone would be misleading. That report is retained and the paired calibration verifier rejects it.

A separate iPhone [200-ms control](results/binding-budgets/2026-10-30-latency-ios-drag-js-delay-200.json.gz) used clean source `90c7ab60c49b1d04a88080edbd0c25cd9c6a164a`. The native diagnostic's allowed-delay assertion and XCTest runner were extended; shipping runtime code and its recorded hash did not change. All six onsets were **252.56–256.77 ms**, above the injected block and the complete baseline range. This detects a known long block; it is not a linear calibration of every millisecond of recognition latency. Normal iPhone captures were not repeated or replaced.

The verifier now requires the entire baseline range to be below the injected block and every delayed response above that block (with a 1-ms timestamp allowance). Offline tests also relabel a no-delay trace as delayed and require rejection. Additional negative controls corrupt clocks, truncate streams, retain a view, introduce late work, remove cycles, falsify thermal state and modify resumed evidence. None of those modified fixtures are saved as device observations.

Build/install the isolated app as above, then use new output paths for each collection:

```sh
python3 benchmarks/run-binding-budgets.py android YOUR_ADB_SERIAL /tmp/retention-android.json --retention --allow-unavailable-thermal
python3 benchmarks/run-binding-budgets.py ios YOUR_IPHONE_UDID /tmp/retention-ios.json --retention
python3 benchmarks/binding-budgets-android.py YOUR_ADB_SERIAL /tmp/input-android
python3 benchmarks/binding-budgets-android.py YOUR_ADB_SERIAL /tmp/input-android-control --case drag-js --delay-ms 40
# iPhone: use the signed XCTest project above, selecting testInputWindows and
# testInputDelay. The latter runs only drag-js with the 200-ms control.
# Pull Documents/binding-input-KIND.json and binding-input-drag-js-delay-200.json
# from the org.nativescript.jolt.bindings app data container with devicectl.
python3 benchmarks/verify-binding-diagnostics.py /tmp/retention-android.json --allow-unavailable-thermal
python3 benchmarks/verify-binding-diagnostics.py /tmp/retention-ios.json
python3 benchmarks/verify-binding-diagnostics.py /tmp/input-android/drag-js.json --allow-unavailable-thermal
python3 benchmarks/verify-binding-diagnostics.py /tmp/input-android-control/drag-js-delay-40.json --baseline /tmp/input-android/drag-js.json --allow-unavailable-thermal
python3 -m unittest discover -s benchmarks -p 'test_binding_*.py'
npm run docs:check-media
npm run docs:build
```

Only acknowledge unavailable thermal telemetry on Android below API 29. The default verifier still rejects it; the flag cannot turn an unknown temperature into nominal-temperature acceptance. `--resume --retention` preserves all previously collected cycles and rejects changes before replacing a pending file. Native diagnostics live in the demo fixture, outside the published library.

### Workload guidance and follow-up decision

The measurement scope of #242 now has physical data for preparation, composition boundaries, keyframe submissions, process allocation observations, native callback cadence, CPU, sampled peak memory, bounded retained memory, input onset and repeated cleanup. Earlier full-matrix failures remain failures; finishing this audit is not a claim that every workload is fast or every allocation metric is reliable.

For these measured configurations:

- **Reserve setup time explicitly.** Warm start for a one-property finite value was 0.81/1.54 ms (p50/p95) for one iPhone view and 7.03/7.73 ms for 16. On this Android with bulk construction, one view was 9/10 ms and 16 were 35/37 ms, before adding binding setup and the rest of the screen. Do not place those larger batches inside a single 16.67-ms input/render interval.
- **Layers need a separate preparation budget.** Sixteen views with two motion-value layers cost 36.51/45.92 ms to start on iPhone and 188/201 ms on Android; eight layers reached 52.38/57.49 ms and 424/544 ms respectively. Prepare or reduce that work before latency-sensitive interaction.
- **Prefer compatible loops for repeated motion.** They avoid boundary reconstruction. They still have setup cost, and the retained Android common-loop stall means zero boundary submissions is not a smoothness guarantee.
- **Avoid large windowed fan-outs on the input path.** One composed-value window took 6.96–8.28 ms on iPhone; 16 views already exceeded an entire 60 Hz interval. The optimized Android one-view case took 13–18 ms, leaving no dependable full-screen headroom even at that smallest measured fan-out. The 64-view boundary costs above justify investigating persistent native composition or reusable tracks.
- **Budget cleanup and memory by the actual screen.** This 64-view/two-layer workload released all watched targets with explicit collection; it does not bound arbitrary retained application references, runtime caches or long-running heaps. Native pan/header avoid per-move JS callbacks, while `drag()`/`scrollValue()` retain their documented JS path; onset traces include recognition and clamps.

[Follow-up #260](https://github.com/rafaelaugustos/jolt/issues/260) owns reducing the measured composition costs and isolating remaining playback/GC stalls. It requires its own before/after physical evidence. The decision is to investigate persistent composition and runtime allocation together, not move only numeric evaluation based on these traces. The independent cross-stack comparison stays in #65.

The reviewed English physical-iPhone and Android-emulator recordings remain embedded in all four guide languages. They demonstrate the existing workloads and composition behavior, with their original platform labels; they are not footage of the new unrecorded latency/retention measurements. No manual device interaction or new recording was required for this follow-up.
