# Android performance follow-up — 2026-11-03

The physical phone confirms lower process CPU for this Jolt animation. An explicit V8 size profile also lowers **post-run** process PSS below the paired Reanimated control, but costs CPU relative to default Jolt and introduces longer frame gaps. It does not establish better latency or blocked-JS playback. No Jolt engine/default change is included.

## Physical motion

ASUS ZenFone 3 (ASUS_Z017DC), Android 8.0.0, arm64, approximately 60 Hz. The fixture uses one 48×48 tile, translation and opacity, with a reset at 5, 15 and 25 seconds. Five seconds of warmup precedes each 30-second window. Each group has five fresh-process runs per app with rotating app order. Default and size-profile groups were sequential, not profile-randomized; Reanimated provides a control in each group. No recording ran during measurement.

| Cohort / app         | CPU s / 30 s, median (range) | PSS before → after, medians (MiB) | Gap p95, median (ms) | Maximum gap, median (range), ms | Ready→present p50, median (ms) |
| -------------------- | ---------------------------: | --------------------------------: | -------------------: | ------------------------------: | -----------------------------: |
| Default / Jolt       |             6.79 (6.74–7.27) |                     96.82 → 88.27 |                16.85 |             17.04 (16.99–31.02) |                          32.43 |
| Default / Reanimated |          14.63 (14.53–14.68) |                     79.86 → 85.65 |                16.87 |             17.25 (17.08–17.72) |                          25.28 |
| Size / Jolt          |             7.37 (7.14–7.45) |                     89.56 → 79.16 |                16.86 |             50.15 (33.47–50.28) |                          30.03 |
| Size / Reanimated    |          14.70 (14.59–14.72) |                     80.42 → 85.96 |                16.87 |             17.06 (17.04–33.66) |                          25.31 |

PSS is a process snapshot, not peak memory. The size profile does **not** beat the control’s pre-window PSS. Its larger frame gaps occur around 20–21 seconds into these runs, away from the scripted resets; their cause is not isolated. The two cohorts cannot separate every time/temperature effect. Battery guard thresholds are recorded; they do not prove absence of throttling. These results describe one old phone and one animation, not application-wide superiority, battery efficiency or all Android devices.

[Default raw samples and ranges](physical-normal/README.md) · [size-profile raw samples and ranges](physical-size-normal/README.md). Physical reports can be revalidated with:

```sh
python3 benchmarks/comparison/report-physical.py benchmarks/results/android-followup-2026-11-03/physical-normal
python3 benchmarks/comparison/report-physical.py benchmarks/results/android-followup-2026-11-03/physical-size-normal
```

The default and size motion APKs have identical entries except `assets/app/package.json`. `--expose_gc --optimize_for_size` is an **application runtime experiment**, not a Jolt default or library optimization. Source patches are against `86ba72b59cbfe06062e3175e5708d5b11f4a4b0b`, before this PR. The build JSON files retain exact APK and source-patch hashes; package dumps retain release flags. NativeScript core 9.1.3, Android runtime 9.1.1, V8 14.9.207.39. The Reanimated reference APK is unchanged from the earlier comparison. The original emulator reference Jolt APK and new diagnostic Jolt APK have separate identities.

## Physical blocking phases

Two 30-second runs per stack/phase, using the **size-profile Jolt APK** and the same Reanimated reference. Three deliberate 300 ms blocks per run. Values are the median (minimum–maximum) of each run’s maximum presentation gap.

| Phase                       |              Jolt (ms) |        Reanimated (ms) |
| --------------------------- | ---------------------: | ---------------------: |
| Application runtime blocked | 309.13 (300.92–317.35) |    17.06 (17.02–17.10) |
| Platform UI thread blocked  | 300.85 (300.85–300.86) | 300.79 (300.73–300.85) |

[Raw samples and complete distributions](physical-size-blocks/README.md). Revalidate with `python3 benchmarks/comparison/report-physical.py benchmarks/results/android-followup-2026-11-03/physical-size-blocks`. The normal cohorts used the original probe; the blocking cohort used a portability fix that tries executable `input` first and falls back to Android 8’s shell script on `ENOEXEC`. Both use the same shell input path on this phone. Exact probe sources and hashes are retained in each cohort.

Across these three physical motion collections, four pre-measurement Jolt launches failed with `EGL_NOT_INITIALIZED`. A fifth incomplete attempt had a prior crash dialog covering the controls. All five records are retained. These are not successful timing runs and are not silently discarded. No root cause or general crash rate is established by this collection.

## JavaScript allocation tradeoff

A separate NativeScript entry/app ID round-trips the same 4,000 records through JSON ten times per batch and verifies a checksum. Each fresh process runs six batches; the first is excluded. Two runs per profile, with default/size then size/default order. This is a targeted allocation workload, not a Reanimated comparison. The two APKs differ only in `assets/app/package.json`.

| Profile / run | Median measured batch wall time (ms) | Median measured batch process CPU (ms) | Post-workload PSS (MiB) |
| ------------- | -----------------------------------: | -------------------------------------: | ----------------------: |
| Default / 1   |                               421.61 |                                    426 |                  120.57 |
| Size / 1      |                               592.38 |                                    743 |                  102.51 |
| Size / 2      |                               591.06 |                                    742 |                  102.06 |
| Default / 2   |                               417.33 |                                    420 |                  121.15 |

The size flag reduced memory in this workload but made the batches slower and increased process CPU substantially. This is why the profile remains **explicit and experimental**, with no change to the library/runtime default. The workload does not exhaust possible JavaScript behavior. Raw batch results, source snapshots, APK identities and memory/battery dumps are in [js-profiles](js-profiles/summary.json). All 24 batches completed with the expected checksum; only 20 post-warmup batches contribute to these four process-level medians. No recording ran during collection.

## Emulator latency investigation

Five normal 30-second reference pairs on the dedicated API 36 emulator gave median queue→present p50 of **32.92 ms for Jolt and 16.28 ms for Reanimated**, with CPU medians of 10.09 and 10.95 seconds. Reanimated’s fifth run also developed buffering. These emulator queue timestamps are not the physical phone’s frame-ready timestamps or touch-to-pixel latency.

Four controls plus default Jolt ran twice in rotated order, 12 seconds each, using one diagnostic APK. `native` uses one Android ObjectAnimator; `layout` changes the tile class; `hardware` requests a cached hardware layer; `vsync` delays initial start to one Choreographer callback. Every control preserves the motion values; defaults preserve the original fixture. These are exploratory diagnostics, not substitute headline benchmarks.

| Round / variant | CPU seconds / 12 s | Queue→present p50 (ms) | Presentation gap p95 (ms) |
| --------------- | -----------------: | ---------------------: | ------------------------: |
| 1-hardware      |               2.76 |                  32.98 |                     18.06 |
| 1-jolt          |               2.85 |                  32.95 |                     17.66 |
| 1-layout        |               2.72 |                  32.96 |                     17.60 |
| 1-native        |               2.75 |                  32.97 |                     17.89 |
| 1-vsync         |               4.92 |                  32.96 |                     25.55 |
| 2-hardware      |               5.24 |                  32.74 |                     18.16 |
| 2-jolt          |               7.36 |                  59.68 |                     92.07 |
| 2-layout        |               3.73 |                  32.84 |                     17.80 |
| 2-native        |               2.83 |                  32.88 |                     17.81 |
| 2-vsync         |               6.22 |                  33.03 |                     24.57 |

No control consistently removed the wait. The second default Jolt diagnostic had severe gaps and remains in the table. Earlier exploration hit extreme host contention, including a load average above 80, and is excluded from this table. A second attempt produced a truncated trace despite a successful `exec-out cat` exit; the collector now verifies `adb pull` against the device SHA-256 and retries failed transfers. The refined host guard also rejects window load above twice the logical CPU count. All ten accepted reference runs also satisfy this newer ceiling; their historical metadata is unchanged.

## Retained evidence and limits

Physical raw probe output (lossless `probe.txt.gz`), pre/post memory, battery, launch output, failed attempts, source snapshots and identities are included. CPU uses all process user+system ticks (10 ms resolution on this phone), normalized by the observed interval. Frame cadence uses actual-present fences; ready→present is not queue→present, input latency or panel scanout. The on-device observer can influence scheduling. Adjacent SurfaceFlinger polls must share history; gaps fail validation.

Emulator per-run summaries, host samples, memory dumps, trace-health rows and CSV exports are included under `emulator-reference/` and `emulator-diagnostics/`. CSV files are losslessly gzip-compressed. **Full Perfetto traces and APK binaries are retained in the task workspace, not committed here**; trace hashes and build hashes identify them. Decompress CSV files to inspect individual events. Re-running the Perfetto SQL requires the retained trace or a fresh collection; the committed exports alone do not recreate a trace.

The initial unsuccessful diagnostic passes remain in the task workspace. Their protocol history is in `diagnostic-plan.json`; they are not quietly substituted for accepted samples. Successful timing samples exclude failed cold launches, whose records remain under physical `incomplete/` folders. Jolt experienced repeated RenderThread `EGL_NOT_INITIALIZED` failures before animation start. This affects reliability and must not be hidden behind timing medians; the root cause is not established.

[Protocol, source and reproduction](../../comparison.md#physical-follow-up-and-runtime-memory-profile). Actual English native phone recordings are embedded in all four comparison guides and attached to the PR, separately from timed samples.
