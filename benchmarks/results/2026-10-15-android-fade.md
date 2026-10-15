# Android fade layers: emulator diagnostic

Collected on 2026-10-15 with an Android 15 / API 35 ARM64 emulator, density 2.625, using SwiftShader through ANGLE. The benchmark was signed and built in Release with a production bundle, Core 9.1.3 and NativeScript Android 9.1.1. This is emulator evidence; physical-device performance has not been measured.

The build was a working tree based on `3fa78119273aea10edba025bb9aebd5ba88020e1`. Its driver SHA-256 was `4772f8e8c93a6cb098942d80d83feabd5d38d4f1c2ce3977970bec0cc01bdc46`, recorded in the build metadata. The [collector and workload](../android-fade.md) describe the procedure. Build metadata, per-run summaries and native assertions are in [the JSON report](./2026-10-15-android-fade.json); the [CSV](./2026-10-15-android-fade.csv) retains the per-frame intervals used to calculate them.

## Workload and results

A 320 × 360 DIP static card contained three bitmap images and six text/value rows. Both modes played opacity keyframes `[1, 0.25, 1]` over 1200 ms, repeated five more times. Cases ran in ABBAAB order, with a separate activation capture and a warmed sampling interval. Each steady capture retained 120 flags-zero frames from Android's recent frame buffer.

| Run | Mode     | Steady frame median | Steady frame p95 | Command median | Missed deadlines / 120 |
| --- | -------- | ------------------: | ---------------: | -------------: | ---------------------: |
| 1   | Baseline |           45.119 ms |        72.729 ms |       7.231 ms |                      9 |
| 2   | Hardware |           42.725 ms |        59.417 ms |       6.565 ms |                      3 |
| 3   | Hardware |           42.961 ms |        58.753 ms |       6.503 ms |                      3 |
| 4   | Baseline |           43.456 ms |        59.521 ms |       6.212 ms |                      5 |
| 5   | Baseline |           46.042 ms |       104.186 ms |       6.925 ms |                     20 |
| 6   | Hardware |           26.792 ms |        85.025 ms |       6.320 ms |                     15 |

Hardware-mode frame medians were lower in these runs, while tail latency and activation measurements varied substantially. Run 6 had a lower median with a higher p95 than runs 2 and 3. The data supports keeping a repeatable device benchmark; it does not establish a general speedup or a stable regression budget. Frame completion intervals include Android's pipeline scheduling, and the command interval is not GPU busy time.

The cache surface was 840 × 945 pixels, about 3.03 MiB as an RGBA-size estimate. The emulator's `meminfo` graphics field reported zero, so it cannot quantify GPU memory here. Actual resource allocation and pooling need a physical-device measurement.

## Correctness

The Release app passed checks for delayed layer activation, stopping, replacing a fade, preserving an explicit software layer and unloading. All six measurement runs completed: the baseline stayed at layer type 0, hardware mode used type 2 during playback, and every run ended at type 0.

The collection used a dedicated emulator and retained the foreground throughout. The harness rejects backgrounded runs and missing displayed frames. The card layout was visually checked before collecting the recorded results.
