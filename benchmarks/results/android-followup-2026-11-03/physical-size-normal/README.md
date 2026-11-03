# Physical Android results

asus ASUS_Z017DC, Android 8.0.0. Release APKs; 5 runs per stack/phase, 30 seconds each, five seconds of warmup. Screen recording was off. Values are **median (minimum–maximum)** of run-level statistics.

| Phase | App | CPU seconds / 30 s | Pre-run PSS (MiB) | Post-run PSS (MiB) | Presentation gap p95 (ms) | Maximum presentation gap (ms) | Frame-ready→present p50 (ms) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| normal | jolt | 7.37 (7.14–7.45) | 89.56 (89.39–89.97) | 79.16 (78.69–79.49) | 16.86 (16.85–16.87) | 50.15 (33.47–50.28) | 30.03 (27.98–32.29) |
| normal | reanimated | 14.70 (14.59–14.72) | 80.42 (80.36–80.84) | 85.96 (85.81–85.99) | 16.87 (16.86–16.88) | 17.06 (17.04–33.66) | 25.31 (25.29–25.33) |

CPU comes from process user+system counters with the device’s reported clock-tick resolution and is normalized by the measured interval. PSS includes the whole process and graphics allocations. SurfaceFlinger actual-present fences establish cadence; frame-ready→present is **not** queue→present, touch-to-pixel, or physical panel scanout. Do not combine these latency numbers with the emulator Perfetto table.

The native probe schedules inputs on the phone and polls presentation history every 500 ms. Every adjacent poll must overlap the previous history; missing history fails validation. Observer work runs outside the measured process but can affect device scheduling. Battery temperature guards and cooldown do not prove the absence of thermal throttling. This is one older physical device, not an Android-wide ranking.

The app-runtime and UI-thread block phases have different meanings across stacks. NativeScript application JS shares the Android UI thread; Reanimated application JS is separate from UI worklets.

Failed/incomplete attempts with a retained failure record: 2. These are not successful timing samples. See `incomplete/` and `summary.json` for their evidence.

Raw probe output, process dumps, device/build identities, collector/probe source, per-run summaries and SHA-256 integrity checks are retained alongside this report. Reproduce with `python3 benchmarks/comparison/report-physical.py RESULTS_DIRECTORY`.
