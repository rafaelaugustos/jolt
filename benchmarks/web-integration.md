# Web integration, measurements and native layer removal

Tracks #284, #285 and #286 under #236. The candidate adds the optional Vue DOM adapter and fixes Android's presentation after removing a releasing layer. It does not publish a release or complete the downstream Mavis integration.

## Reproduce

Use Node 22, `npm ci`, then `npx playwright install chromium firefox webkit`.

```sh
npm run web:integration:typecheck
npm run web:proof:test
npm run web:runtime:test
npm run web:press:test
npm run web:integration:test
npm run build
npm ci --prefix benchmarks/native-app
npm run package:check
npm run docs:check-media
npm run docs:build
```

CI retains JSON reports, traces and presentation attachments. `web-integration/results/report.json` embeds small measurement attachments as base64. The committed [2026-11-01 observations](./web-integration/evidence/2026-11-01.json) preserve a local run on macOS arm64, Node 22.23.3, Playwright 1.64.1 and Vue 3.5.44. These are desktop correctness and workload observations, not minimum browser versions or mobile performance certification.

## Capability matrix

| Capability                                                                                | Chromium 156.0.8078.4 | Firefox 157.0 | WebKit 27.2  |
| ----------------------------------------------------------------------------------------- | --------------------- | ------------- | ------------ |
| x/y, scaleX/scaleY/scale, rotate, opacity; static 2D CSS baseline                         | Pass                  | Pass          | Pass         |
| Fixed-target springs, tween/keyframes, presets/stagger, partial interruption and velocity | Pass                  | Pass          | Pass         |
| Pause/play/seek, cancellation, live reduced motion, detach cleanup                        | Pass                  | Pass          | Pass         |
| Pointer/keyboard press, base retarget, disabled/loading cancellation                      | Pass                  | Pass          | Pass         |
| Vue v-if/v-show, leave cancellation, replacement, scope disposal                          | Pass                  | Pass          | Pass         |
| 100-card preparation, input timing and 30 lifecycle cycles                                | Pass                  | Pass          | Pass         |
| Actual touch-scroll takeover via CDP                                                      | Pass                  | Not measured  | Not measured |
| Heap sampling/GC and blocked-main-thread presentation trace                               | Pass                  | Not measured  | Not measured |

The four maintained suites passed **203 cases**, with four deliberate skips for CDP-only tests in Firefox/WebKit. The current API is finite, numeric DOM playback. It does not include drag/snap, continuous springs, motion values, scroll timelines, layout, arbitrary 3D/CSS coexistence, or React. Vue is optional; native `/vue` keeps its original meaning. The package consumer validates actual tarball installs and dev/production/SSR behavior; it does not substitute source aliases for a published package.

## Workloads and budgets

100 cards animate x=180, scale=1.2 and opacity=0.5 with the `snappy` trajectory. Each round creates a fresh context and mounted targets; preparation timing surrounds the synchronous `animate` call, activation is awaited, then effects/keyframes and teardown are sampled. One warmup precedes five measured rounds. This includes compilation, CSS reads and effect construction, not just solver math.

| Browser  | Preparation median / max | Teardown max | Keyframes / effects | Pointer handler preparation max |
| -------- | ------------------------ | ------------ | ------------------- | ------------------------------- |
| Chromium | 91.4 / 101.4 ms          | 1.7 ms       | 10,400 / 100        | 1.1 ms                          |
| Firefox  | 86 / 88 ms               | 5 ms         | 10,400 / 100        | 2 ms                            |
| WebKit   | 68 / 70 ms               | 2 ms         | 10,400 / 100        | 2 ms                            |

A batch of 100 new springs exceeds a 16.7 ms frame interval on this machine. Avoid promising that arbitrarily large preparation bursts are free. Established playback does not need a permanent Jolt frame loop. CI ceilings deliberately allow slower shared runners: 1,000 ms preparation, 100 ms teardown, 12,500 keyframes and 200 effects per 100-card batch; 100 ms handler preparation. They catch substantial regressions, not frame-budget violations. Revisit these ceilings using retained reports when workloads or runners change.

Real Playwright pointer input measures event timestamp → capture handler → window bubble handler after Jolt preparation → next rAF callback. The last interval reached 7.2/10/11 ms in Chromium/Firefox/WebKit. This is **not display latency**; browser input timestamp precision and scheduling differ. It is not evidence of compositor smoothness.

Thirty mounted Vue instances start press, retarget application motion, begin leave and unmount. Instrumented motion listeners (including AbortSignal teardown), MutationObservers and active effects return to zero. Runtime diagnostics separately require zero targets/owners/observers and no pending frame after disposal. Existing runtime/press cases cover idle scheduling and stale writes. Chromium's post-GC JS heap grew 810,080 bytes including Vue/JIT/test warmup; the 2 MB ceiling detects runaway retention, not zero allocation. Heap sampling observed about 76.9 MB of allocation across these cycles, including collected objects, Vue and test instrumentation, with a 200 MB regression ceiling. Sampling is approximate and is not a Jolt-only allocation profile. Other engines have no heap claim here.

## Presentation during blocking

The Chromium-only probe animates one white 80×80 box on a black background, with a static `will-change: transform` hint, x=650 over 1,400 ms. After activation and 200 ms of playback, a marked 700 ms busy loop blocks page JavaScript. CDP screencast frames and a browser trace are collected outside the page's JavaScript execution.

The recorded run contained **36 different presentations** strictly inside the blocking interval, excluding 50 ms at either boundary. Reviewed white-box centers progressed from x≈169 to x≈409 in eight sampled images. The maintained test also decodes actual PNG pixels and requires more than 100 px of movement during blocking, so changing encoded metadata is insufficient. Open the `browser-trace` attachment in Chromium Performance/Perfetto and inspect `jolt-block-start` / `jolt-block-end` alongside compositor activity. This tests one eligible scene in Chromium; it does not prove every WAAPI effect is accelerated, establish GPU use, or measure every displayed frame. Firefox/WebKit explicitly skip this CDP probe.

## Native regression and recordings

The Android model can already contain scale 1.2/0.6 when its ObjectAnimator still presents an intermediate release. Rewriting the same model value may skip Core's native setter. `Mix.compose` now invokes an optional driver `commit` for the settled channel after cancellation; Android reapplies only that channel, including DIP conversion. It does not reset unrelated native animators from their model endpoints.

- The isolated regression failed before the fix at native scale 1.16767 instead of 1.2. Unit cases cover normal/reduced policy and a changed Android preference through its stubbed platform setting; unrelated rotation remains at its presented value.
- The real demo audit checks native presentation plus model for interrupted release, late writes, a moving base with another held layer, removal of that layer, already-reduced policy and reduction enabled during release. It uses actual Android getters / iOS presentation layers, never model fallback.
- Android 16 / API 36 emulator and iOS 26.2 simulator both passed. The Android negative control disables only the new commit hook and fails at native 0.95 instead of 1.2. This is a controlled pre-fix path, not a claim of testing a separate old binary.
- Native reduced-policy changes in the demo use `configure`; the unit preference case reads a stubbed Android system setting. The audit does not claim OS Settings interaction or physical-device validation. Existing finite native animations retain their established configuration semantics.
- [Android report](./web-integration/evidence/layer-cleanup-android.json), [negative report](./web-integration/evidence/layer-cleanup-android-negative.json), [iOS report](./web-integration/evidence/layer-cleanup-ios.json). The same check is part of the maintained Native CI app.

Build the native demo with `JOLT_BENCHMARK=1`. Record the dedicated destinations with:

```sh
python3 benchmarks/layer-cleanup-android.py ANDROID_SERIAL OUTPUT
python3 benchmarks/layer-cleanup-android.py ANDROID_SERIAL NEGATIVE_OUTPUT --negative
python3 benchmarks/docs-record-ios.py IOS_SIMULATOR_UUID OUTPUT testLayerCleanup
```

`Move` is tapped through ADB/XCTest to begin the bounded audit. The new native clips are `layer-cleanup-android.mp4` and `layer-cleanup-ios.mp4`. They were inspected across their duration and played in the built documentation; their labels explicitly identify emulator/simulator. Existing media remains intact.

For the browser recording, run `npm run web:integration` and `node benchmarks/web-integration/record.mjs`. Encode the resulting WebM to H.264 without speed changes. `web-vue-chromium.mp4` shows real input, cancelled leave, application retarget during press, replacement, completed hide/show and keyboard press. The four-language Vue Web guide embeds this clip and the native references. PRs attach only the reviewed English clips.

## Downstream work

Mavis [#100](https://github.com/getcortexlabs/mavis-ui/issues/100) / [PR #103](https://github.com/getcortexlabs/mavis-ui/pull/103) contains the original native workaround and reproduction. Shared recipes [#101](https://github.com/getcortexlabs/mavis-ui/issues/101) is closed. Mavis [#32](https://github.com/getcortexlabs/mavis-ui/issues/32) still owns press/reveal migration; [#102](https://github.com/getcortexlabs/mavis-ui/issues/102) still owns the required shared application animation and experimental surface-reference proof. Those remain acceptance work for #236, even after this standalone browser matrix passes.
