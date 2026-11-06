# Deferred Android performance investigation

**Stopped at the user's request on 2026-11-06.** #405 and #406 remain open as technical debt, without an RC.12 delivery commitment. This branch preserves an experimental implementation and diagnostic evidence; it is **not ready to merge or release**. The five native composition features are delivered separately in PR #418.

## Presentation latency (#405)

Five rotating triplets used the retained RC.11-equivalent Jolt diagnostic APK, its direct Android ObjectAnimator control, and the pinned Reanimated reference on the physical ASUS ZenFone 3 / Android 8. Each fresh process had a 30-second window, five-second warmup and ten-second cooldown. No recording ran during collection. All 15 observations completed; there is no optimized latency candidate in this dataset.

| Condition               | Median process CPU / 30 s | Median post-window PSS | Median of frame-ready→present p50 |
| ----------------------- | ------------------------: | ---------------------: | --------------------------------: |
| Jolt                    |                    7.42 s |              88.27 MiB |                          27.99 ms |
| Direct Android animator |                    7.02 s |              88.15 MiB |                          32.43 ms |
| Reanimated              |                   15.17 s |              86.03 MiB |                          25.30 ms |

The direct control retains the same NativeScript view tree and Jolt imports. It isolates active playback construction, not the library import or runtime baseline. Waiting also occurs with direct Android playback. Its exact cause has not been localized; these observations do not establish that it belongs outside Jolt. The first Jolt and Reanimated PSS observations were higher than subsequent runs and remain included.

These are SurfaceFlinger frame-ready/presentation fences, **not input-to-photon latency**. Per-run distributions, including p95/p99 and worst gaps, raw probe output, source snapshots and build identities are in [controls](results/deferred-android-2026-11-06/controls/). The new collection did not repeat JS-blocking tests. No change solves the shared UI/JavaScript thread limitation.

Resume by localizing scheduling/rendering/presentation in a trace before selecting an optimization. A baseline/candidate comparison with the existing pinned Reanimated control and declared tolerances is still required.

## Settled-view ownership and PSS (#406)

The experimental change in `src/engine.ts` clears a settled `ViewAnimation`'s strong target reference. Active, paused and held animations continue to own their target. Existing promise and clock behavior is preserved in the checks run so far. The host retention regression keeps 1,000 completed/cancelled animation handles: the base retained 1,000 distinct shim Views, and the candidate retained zero. Both released sampled tracks. This is host evidence, not Android PSS.

The separate native fixture creates 16 real Labels, each with the existing 4,000-record JSON model as its binding context. Eight animations complete and eight are cancelled. The Labels are detached while their public animation handles survive. JavaScript and Java collections are explicitly requested outside the workload timing window, identically for both builds. These diagnostic collections are not a proposed production policy.

The initial native checkpoint retained 16 Views in both builds. A second checkpoint after additional event-loop turns and collection requests retained 16 in the base and zero in the candidate. In this **single pilot pair**, PSS was 91,612 KiB versus 86,864 KiB at that second checkpoint, approximately 4.6 MiB lower. Workload CPU was 2,620 ms versus 2,939 ms, so this pilot does not establish an acceptable performance tradeoff. It is not evidence that the candidate beats Reanimated or lowers the normal single-tile application's PSS.

The subsequent baseline calibration completed only two runs. Its third launch aborted in Android RenderThread with `EGL_NOT_INITIALIZED`, before measurement; the launch timeout and crash log are preserved. The same signature existed in earlier independent base-app captures. Its root cause is unknown. No complete five-pair retention study, calibrated acceptance decision or normal-playback candidate comparison was completed before the user deferred the work.

Evidence is retained under [the result directory](results/deferred-android-2026-11-06/). The v1 and v2 pilot protocols remain separate; v2 adds four alternating collection passes and a second held checkpoint. The final harness source is committed on this branch. APK pairs differ only in `assets/app/bundle.mjs`; build identities record hashes. Text dumps and probe output are losslessly gzip-compressed; decompress them before running the original report validator. Full APKs remain in `/private/tmp/jolt-rc12-retention-apks`, `/private/tmp/jolt-rc12-retention-apks-v2` and `/private/tmp/jolt-rc12-motion-apks`; they are not committed. Retained and baseline JavaScript modules were compiled with the same TypeScript 6 transpilation options when preparing the v2 pairs.

Checks completed for the experimental source: 1,696 unit tests, typecheck, library build, the host collectability regression and the two Android pilot pairs. These checks are insufficient to mark #406 complete. Further native lifecycle validation and iOS validation of the shared engine change remain outstanding. No new public API or visible behavior is intended, and no performance claim is ready for publication.

Resume with the existing acceptance criteria in #406: finish baseline variability, declare tolerances before the confirmatory comparison, run at least five alternating baseline/candidate pairs, and verify normal CPU, frame cadence, representative allocation cost and lifecycle behavior. `physical-paired.py` is prepared but has not been executed. Retain failures and distinguish garbage collection timing, object collectability and whole-process residency.
