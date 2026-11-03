# Physical Android results

asus ASUS_Z017DC, Android 8.0.0. Release APKs; 5 runs per stack/phase, 30 seconds each, five seconds of warmup. Screen recording was off. Values are **median (minimum–maximum)** of run-level statistics.

| Phase | App | CPU seconds / 30 s | Pre-run PSS (MiB) | Post-run PSS (MiB) | Presentation gap p95 (ms) | Maximum presentation gap (ms) | Frame-ready→present p50 (ms) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| normal | jolt | 6.79 (6.74–7.27) | 96.82 (96.51–97.12) | 88.27 (87.98–88.55) | 16.85 (16.84–16.87) | 17.04 (16.99–31.02) | 32.43 (27.77–32.45) |
| normal | reanimated | 14.63 (14.53–14.68) | 79.86 (79.44–80.01) | 85.65 (85.37–85.85) | 16.87 (16.85–16.88) | 17.25 (17.08–17.72) | 25.28 (16.53–25.35) |

CPU comes from process user+system counters with the device’s reported clock-tick resolution and is normalized by the measured interval. PSS includes the whole process and graphics allocations. SurfaceFlinger actual-present fences establish cadence; frame-ready→present is **not** queue→present, touch-to-pixel, or physical panel scanout. Do not combine these latency numbers with the emulator Perfetto table.

The native probe schedules inputs on the phone and polls presentation history every 500 ms. Every adjacent poll must overlap the previous history; missing history fails validation. Observer work runs outside the measured process but can affect device scheduling. Battery temperature guards and cooldown do not prove the absence of thermal throttling. This is one older physical device, not an Android-wide ranking.

The app-runtime and UI-thread block phases have different meanings across stacks. NativeScript application JS shares the Android UI thread; Reanimated application JS is separate from UI worklets.

Failed/incomplete attempts with a retained failure record: 1. These are not successful timing samples. See `incomplete/` and `summary.json` for their evidence.

Raw probe output, process dumps, device/build identities, collector/probe source, per-run summaries and SHA-256 integrity checks are retained alongside this report. Reproduce with `python3 benchmarks/comparison/report-physical.py RESULTS_DIRECTORY`.
