# Performance comparison

The first equivalent scenario is a 48×48 tile moving 240 logical pixels while opacity changes from 1 to 0.4. Each linear leg lasts one second. Start resets playback; Stop holds the current pose. These production builds use the same dedicated Android API 36 emulator.

Normal motion, a 300 ms application-runtime block and a 300 ms platform-UI-thread block are separate phases. NativeScript JavaScript shares the Android UI thread; Reanimated application JavaScript does not. Do not treat those probes as the same thread experiment.

## Jolt / NativeScript

<Clip name="comparison-jolt-android" caption="Actual native app, Android API 36 emulator, English. Real button taps start/restart, block the application runtime, block the UI thread and stop. Original speed; this recording is separate from timing collection." />

## React Native / Reanimated

<Clip name="comparison-reanimated-android" caption="Actual native app, Android API 36 emulator, English. Real button taps start/restart, block the application runtime, block the UI thread and stop. Original speed; this recording is separate from timing collection." />

## Flutter

<Clip name="comparison-flutter-android" caption="Actual native app, Android API 36 emulator, English. Real button taps start/restart, block the application runtime, block the UI thread and stop. Original speed; this recording is separate from timing collection." />

## Measurements and reproduction

[Protocol, pinned versions and source](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/comparison.md).

## Measured baseline

Android API 36 arm64 emulator, release apps, two 30-second runs per phase after five seconds of warmup. Values are the median across runs (minimum–maximum). No recording ran during measurement.

### Normal motion

| Stack               | Presentation gap p95 (ms) |  CPU seconds / 30 s |     Post-run PSS (MiB) |
| ------------------- | ------------------------: | ------------------: | ---------------------: |
| Jolt / NativeScript |       20.83 (18.15–23.51) |   9.75 (7.18–12.33) | 102.89 (102.10–103.68) |
| RN / Reanimated     |       18.44 (18.19–18.69) |    8.91 (7.98–9.84) |    92.20 (91.58–92.81) |
| Flutter             |       24.72 (18.24–31.20) | 15.80 (13.17–18.43) |    93.87 (93.04–94.70) |

### Deliberate 300 ms blocks

| Phase       | Stack               | Maximum presentation gap (ms) | Input acknowledgement p95 (ms) |
| ----------- | ------------------- | ----------------------------: | -----------------------------: |
| App runtime | Jolt / NativeScript |        308.68 (300.55–316.82) |               0.17 (0.13–0.22) |
| App runtime | RN / Reanimated     |           36.81 (36.59–37.03) |               0.66 (0.57–0.76) |
| App runtime | Flutter             |        316.49 (316.26–316.72) |               0.38 (0.34–0.43) |
| Platform UI | Jolt / NativeScript |        302.48 (300.49–304.48) |               0.23 (0.12–0.33) |
| Platform UI | RN / Reanimated     |        301.39 (301.06–301.72) |               3.28 (3.14–3.42) |
| Platform UI | Flutter             |        317.05 (315.91–318.19) |               0.43 (0.40–0.45) |

These results are an exploratory emulator baseline. Host admission rules were corrected during collection because emulator workload was being counted as unrelated interference; prior accepted samples also meet the final rule. The full protocol history and excluded-attempt records are retained. Buffer presentation is not panel latency, and input acknowledgement is not the first visible pixel. NativeScript app JS shares the UI thread; Reanimated app JS and Flutter’s platform thread use different execution paths.

[Full per-run distributions, raw Perfetto traces, hashes, memory, CPU and reproduction](https://github.com/rafaelaugustos/jolt/tree/main/benchmarks/results/comparison-2026-11-03).

One normal Reanimated run contains a 348 ms presentation gap outside the scripted input times; its cause is not isolated. It remains in the dataset. Two repetitions and a shared host do not establish a stable CPU/frame ranking.
