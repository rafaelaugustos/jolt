# First comparison results

Android API 36 arm64 emulator; release builds; no screen recording during measurement. Each cell is the **median of two runs (minimum–maximum)**. Each run has five seconds of warmup and a 30-second trace. These are emulator baselines, not physical-device rankings.

The collection protocol changed from five to three, then two complete repetitions at the maintainer’s request. Host admission rules were corrected during collection so the measured emulator’s own CPU load is not treated as unrelated contention. Earlier accepted runs also satisfy the final rule; rejected attempts were not promoted. The full history is in metadata.json. Treat this shared-host run as an exploratory baseline, not a controlled hardware ranking.

| Phase                   | Stack      | Presentation gap p95 (ms) |       Maximum gap (ms) | Queue→present p95 (ms) | Input acknowledgement p95 (ms) |  CPU seconds / 30 s |     Post-run PSS (MiB) |
| ----------------------- | ---------- | ------------------------: | ---------------------: | ---------------------: | -----------------------------: | ------------------: | ---------------------: |
| normal                  | jolt       |       20.83 (18.15–23.51) |    34.64 (22.42–46.86) |    39.19 (34.65–43.73) |               0.39 (0.35–0.43) |   9.75 (7.18–12.33) | 102.89 (102.10–103.68) |
| normal                  | reanimated |       18.44 (18.19–18.69) |  192.03 (35.80–348.27) |    25.77 (17.74–33.81) |               1.82 (0.57–3.07) |    8.91 (7.98–9.84) |    92.20 (91.58–92.81) |
| normal                  | flutter    |       24.72 (18.24–31.20) |    40.78 (32.74–48.81) |    45.24 (33.63–56.86) |               0.50 (0.33–0.67) | 15.80 (13.17–18.43) |    93.87 (93.04–94.70) |
| app-runtime-block-300ms | jolt       |       18.01 (17.93–18.08) | 308.68 (300.55–316.82) |    33.44 (33.29–33.60) |               0.17 (0.13–0.22) |    8.21 (7.91–8.51) | 105.24 (105.03–105.44) |
| app-runtime-block-300ms | reanimated |       17.89 (17.83–17.96) |    36.81 (36.59–37.03) |    18.42 (17.42–19.43) |               0.66 (0.57–0.76) |    9.23 (8.93–9.52) |    91.41 (90.88–91.93) |
| app-runtime-block-300ms | flutter    |       18.44 (18.43–18.45) | 316.49 (316.26–316.72) |    33.45 (33.16–33.74) |               0.38 (0.34–0.43) | 13.23 (13.07–13.38) |    93.59 (92.94–94.25) |
| ui-thread-block-300ms   | jolt       |       18.12 (17.81–18.42) | 302.48 (300.49–304.48) |    33.27 (33.24–33.29) |               0.23 (0.12–0.33) |    7.84 (7.78–7.90) | 105.08 (105.08–105.08) |
| ui-thread-block-300ms   | reanimated |       18.17 (18.04–18.31) | 301.39 (301.06–301.72) |    25.61 (17.68–33.53) |               3.28 (3.14–3.42) |   9.67 (8.58–10.76) |    91.97 (91.96–91.98) |
| ui-thread-block-300ms   | flutter    |       18.53 (18.53–18.53) | 317.05 (315.91–318.19) |    25.47 (18.14–32.81) |               0.43 (0.40–0.45) | 13.78 (12.67–14.89) |    94.00 (93.97–94.03) |

Presentation is a SurfaceFlinger buffer fence on an emulated display. Queue→present is buffer latency; input acknowledgement is handling latency. Neither identifies the first changed tile pixel or physical input-to-photon response. Missing input/frame associations stay unavailable in the JSON. Optional app FrameTimeline intervals and deadline classifications are retained separately; the tested Flutter SurfaceView does not provide those app records, so they cannot support a cross-stack missed-deadline ranking.

NativeScript application JS shares Android’s main thread; Reanimated application JS is separate from UI worklets. Flutter’s Dart UI isolate and Android main thread are also separate. Read the two blocking phases as distinct experiments. Static controls exclude ripple/elevation animations that could keep submitting buffers while the tile stalls.

Raw traces, hashes, configuration, package/APK metadata, source pins, input actions, frame/input/memory CSV and pre/post process dumps accompany these summaries. See `metadata.json`, each run directory and `summary.json`. Startup files retain `am start -W` activity timing; they do not measure first meaningful content. Process PSS includes runtime and caches; it is not texture memory. No regression budget is inferred from this single host/emulator baseline.
