# Performance, in the open

The [homepage performance panel](/#performance) visualizes a fixed research snapshot from [PR #395](https://github.com/rafaelaugustos/jolt/pull/395), open when inspected on 3 November 2026. The data is pinned to commit `c15b7f0da59168bcf1baa187daa7a622e9e5c19b`. This is an exploratory study, not a new engine optimization or a change to Jolt’s defaults. The animated bars use Jolt Web to display stored measurements; they do not run a benchmark in the browser.

## What was measured

Physical ASUS ZenFone 3 (ASUS_Z017DC), Android 8.0.0, arm64 release applications. One 48 × 48 logical-pixel tile translates 240 units while opacity changes from 1 to 0.4. Each linear leg takes one second. Five alternating pairs per configuration ran for 30 seconds after five seconds of warmup. The test resets playback at 5, 15 and 25 seconds. No screen recording ran during measurement.

The homepage’s three metrics all use the **default configuration cohort**:

| Metric                                 | NativeScript + Jolt | React Native + Reanimated |
| -------------------------------------- | ------------------: | ------------------------: |
| Process CPU, seconds per 30-second run |                6.79 |                     14.63 |
| Post-run PSS, MiB                      |               88.27 |                     85.65 |
| Frame-ready → present p50, ms          |               32.43 |                     25.28 |

Values are medians across five runs. CPU includes all application threads, normalized to 30 seconds. The CPU ranges were 6.74–7.27 s and 14.53–14.68 s. The 53.6% reduction is calculated from the two CPU medians; it is not animation speed, battery savings or an isolated library comparison. PSS is a snapshot after each run, not peak memory. The presentation value is the median of each run’s p50, not touch latency or panel scanout.

## Trade-offs and incomplete results

Default Jolt used 2.62 MiB more post-run PSS and had 7.15 ms more frame-ready → present waiting in this scenario. This study does not establish a ranking for complete applications, lists, gestures, other phones or Android generally.

The separate, **explicit V8 size-profile cohort** measured 7.37 vs 14.70 CPU seconds and 79.16 vs 85.96 MiB post-run PSS. Its median maximum frame gaps were 50.15 vs 17.06 ms. Jolt’s pre-window PSS still exceeded its control, 89.56 vs 80.42 MiB. The profile reduced post-run memory but cost CPU and longer gaps; a separate JSON allocation workload was also slower. Default and size cohorts were sequential, not profile-randomized. This is an opt-in application-runtime experiment, not a Jolt library default.

Two further runs per blocking phase used the size-profile Jolt APK. With three deliberate 300 ms application-JavaScript blocks per run, the median of the maximum presentation gaps was **309.13 ms for Jolt vs 17.06 ms for Reanimated**. NativeScript application JavaScript shares the UI thread; Reanimated application JavaScript does not. Blocking the UI thread gave 300.85 vs 300.79 ms. The experiments use different thread paths and are not interchangeable.

Four Jolt cold launches failed with `EGL_NOT_INITIALIZED`; one more incomplete attempt was obscured by a prior crash dialog. Those attempts are preserved outside the successful timing samples. The cause is unresolved, and the collection does not establish a general crash rate. The on-device observer and thermal conditions are additional limits.

[Read all samples, ranges, failed attempts and source identities](https://github.com/rafaelaugustos/jolt/blob/c15b7f0da59168bcf1baa187daa7a622e9e5c19b/benchmarks/results/android-followup-2026-11-03/README.md) · [Protocol and reproduction](https://github.com/rafaelaugustos/jolt/blob/c15b7f0da59168bcf1baa187daa7a622e9e5c19b/benchmarks/comparison.md). Emulator measurements are separate and are not mixed into the homepage panel.

## Real native recordings

These are the reviewed English recordings from the pinned PR, copied without modifying their frames or timing. They show the controls and blocking probes, **not the primary timing samples**. The Jolt recording uses the size profile; the homepage panel uses the default cohort.

<Clip name="comparison-jolt-physical-android" caption="Physical ASUS ZenFone 3 / Android 8.0.0, English: Jolt with the explicit V8 size profile. Actual Start/restart, application-JS block, UI-thread block and Stop interactions. Original speed, recorded separately from measurements. This is not the default-cohort run shown in the homepage chart." />

<Clip name="comparison-reanimated-physical-android" caption="Physical ASUS ZenFone 3 / Android 8.0.0, English: React Native + Reanimated with actual start/restart, application-JS block, UI-thread block and stop interactions. Original speed, recorded separately from measurements. A video does not establish CPU, memory or timing results." />

## Website walkthrough

<Clip name="motion-site-chromium" :width="960" caption="Chromium on macOS arm64: actual pointer and keyboard interaction with the Jolt site, including metric selection and the revised footer. The animated chart displays stored physical-device measurements. This browser capture is not native-performance evidence; the native recordings embedded in the site are labeled separately." />
