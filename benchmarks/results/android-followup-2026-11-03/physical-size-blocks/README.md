# Physical Android results

asus ASUS_Z017DC, Android 8.0.0. Release APKs; 2 runs per stack/phase, 30 seconds each, five seconds of warmup. Screen recording was off. Values are **median (minimum–maximum)** of run-level statistics.

| Phase | App | CPU seconds / 30 s | Pre-run PSS (MiB) | Post-run PSS (MiB) | Presentation gap p95 (ms) | Maximum presentation gap (ms) | Frame-ready→present p50 (ms) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| app-runtime-block-300ms | jolt | 8.13 (8.10–8.17) | 89.74 (89.65–89.83) | 81.50 (81.42–81.59) | 16.86 (16.85–16.87) | 309.13 (300.92–317.35) | 28.36 (28.13–28.58) |
| app-runtime-block-300ms | reanimated | 15.42 (15.18–15.66) | 80.36 (80.34–80.37) | 85.65 (85.58–85.72) | 16.86 (16.86–16.86) | 17.06 (17.02–17.10) | 25.34 (25.32–25.35) |
| ui-thread-block-300ms | jolt | 8.08 (8.01–8.16) | 89.86 (89.82–89.90) | 81.79 (81.77–81.82) | 16.86 (16.85–16.87) | 300.85 (300.85–300.86) | 29.40 (28.31–30.50) |
| ui-thread-block-300ms | reanimated | 14.20 (13.04–15.36) | 80.53 (80.29–80.77) | 85.42 (85.40–85.44) | 16.89 (16.88–16.89) | 300.79 (300.73–300.85) | 17.88 (17.02–18.74) |

CPU comes from process user+system counters with the device’s reported clock-tick resolution and is normalized by the measured interval. PSS includes the whole process and graphics allocations. SurfaceFlinger actual-present fences establish cadence; frame-ready→present is **not** queue→present, touch-to-pixel, or physical panel scanout. Do not combine these latency numbers with the emulator Perfetto table.

The native probe schedules inputs on the phone and polls presentation history every 500 ms. Every adjacent poll must overlap the previous history; missing history fails validation. Observer work runs outside the measured process but can affect device scheduling. Battery temperature guards and cooldown do not prove the absence of thermal throttling. This is one older physical device, not an Android-wide ranking.

The app-runtime and UI-thread block phases have different meanings across stacks. NativeScript application JS shares the Android UI thread; Reanimated application JS is separate from UI worklets.

Failed/incomplete attempts with a retained failure record: 2. These are not successful timing samples. See `incomplete/` and `summary.json` for their evidence.

Raw probe output, process dumps, device/build identities, collector/probe source, per-run summaries and SHA-256 integrity checks are retained alongside this report. Reproduce with `python3 benchmarks/comparison/report-physical.py RESULTS_DIRECTORY`.
