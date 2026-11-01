# Finite Web runtime — #281

This implements the runtime after [#280](./web-composition.md), using the compiler extracted in #279. `src/web/index.ts` is an internal repository entry. Package exports/installation are #282, press event recognition is #283, and framework/Mavis integration remains separate. No public portable-reference API is stabilized here.

## Execution and ownership

- Each `createWebRuntime(document)` owns configuration, custom presets, source clocks, ownership tokens, observers and preference listeners. A weak target registry only rejects simultaneous ownership by different contexts; it does not select a driver or store global settings. Foreign-document targets require their own context.
- Built-in numeric recipes moved unchanged into `src/core/presets.ts`. Native imports retain their names, values and custom registration. Web contexts copy compatible recipes, excluding native 3D properties. Native playback and the existing native solver remain unchanged.
- The existing compiler prepares springs/tweens, authored keyframes, delays, stagger and finite repeats. The Web adapter expands finite repeat offsets and groups transform/opacity into one visual WAAPI effect per surface. One targetless WAAPI clock per call supplies completion and playback anchors.
- All proposals, composition budgets, visual effects and replacement clocks are prepared before committing ownership. Invalid targets, oversized source/composed keyframes and a thrown browser clock-start operation preserve the previous motion. A batch uses one command timestamp for every target.
- `x/y/rotate` contributions add; scale/opacity contributions multiply. Between compiler knots every contribution is linear. Products use an analytical second-derivative bound with the existing adaptive sampler, including opacity clamp crossings. Composition refinement tolerances are 0.0002 for scale and opacity; these are additional to the compiler's existing source-curve tolerances. There is no replacement spring solver.
- Each logical channel has an ownership token. Partial replacement retires only the matching channel/layer. A short channel in an unfinished multi-channel call can still be scrubbed backward. Retired handles cannot restore replaced channels.

## Time policy and live WebKit evidence

The default document timeline and `performance.now()` use the same document time origin ([Web Animations specification](https://www.w3.org/TR/web-animations-1/#document-timelines)). The adapter supports that default timeline, with timeScale compiled into trajectories; it does not expose arbitrary browser playback rates or custom timelines.

At a command, project the resolved WAAPI source `startTime` onto that document's performance clock. Use the resulting local source time to evaluate position/velocity, and anchor the replacement visual effect and source clock at the same command timestamp. Paused/pending sources transfer zero velocity. This avoids treating a cached rendering tick as current event time during a busy input task. It does not try to infer velocity from a CSS matrix.

`clock.spec.ts` starts two surfaces at 2,000 px/s, blocks JavaScript for 55 ms and retargets only one with a spring. The continuing linear WAAPI surface independently supplies presentation time. The test checks the replacement's position against its event-time anchor and inherited velocity against 2,000 px/s. It then samples actual live browser presentation across 12 frames.

Two consecutive WebKit style reads can straddle a millisecond even within one rAF. An initial parallel-suite run observed 1.3254 px raw disagreement from using only the first reference read. The test now brackets the target style read with reference reads before and after, reports the measured time interval separately, and compares the curve's range over that interval. It still requires numerical residual below **0.3 px**; it rejects observation intervals of 10 ms or more. Raw first-read disagreement remains in the evidence. This is an explicit measurement correction, not a wider numerical tolerance. The independently aligned native-baseline tests retain their original property tolerances.

Final local live-clock observations (2026-11-01; milliseconds and CSS pixels):

| Browser  | Stale tick gap | Read interval | Raw first-read error | Curve residual after bracketing |
| -------- | -------------: | ------------: | -------------------: | ------------------------------: |
| Chromium |        55.7 ms |          0 ms |             0.084 px |                        0.084 px |
| Firefox  |       57.64 ms |          0 ms |             0.096 px |                        0.096 px |
| WebKit   |          55 ms |          1 ms |             2.303 px |                        0.063 px |

Event-time anchor error was zero in all three; inherited source velocity was within 0.048 px/s of 2,000 px/s. These are observations from the retained run, not browser-wide performance claims.

The unresolved-clock test temporarily overrides the reported `document.timeline.currentTime` to `null` in a real browser, then restores it. It exercises activation/pause/seek/disposal with real WAAPI objects; it is not evidence that a naturally inactive document was reproduced. Only pending activation requests rAF; ordinary playback does not schedule a library frame loop.

## Controls and resource lifetime

`progress` spans the finite call duration, including delays/repeats. Pause freezes only that call. Seeking to the endpoint while paused remains reversible until resumed. Natural completion resolves `finished` once with `true`; stop, disposal or partial replacement ultimately resolves `false`. Browser cancellation rejections are consumed. Handles that have settled are terminal and release their context reference.

Completed effects and source clocks are cancelled; final inline transform/opacity values remain. Stop holds current sampled values. `release(target)` restores original inline values only where the runtime's last write is still present. `dispose()` releases all surfaces/listeners/observers/pending work. A child-list observer also releases detached targets, including within shadow roots. Framework adapters still own their lifecycle cleanup. This deterministic resource accounting is not a heap/leak profile.

Live reduced-motion activation completes transforms at their final values while allowing opacity to finish. Disabling reduction permits future motion without replaying completed transforms. A context may choose `user`, `always` or `never`; timeScale changes affect future tracks only.

## Bounds

The runtime owns `transform` and `opacity` on mounted transformable HTML boxes. Composition is `static 2D baseline × translate × rotate × scale`, preserving transform-origin. CSS pixels, degrees and scale factors are explicit. Individual CSS transforms, 3D baselines, existing animations/transitions and inline important motion styles are rejected. External CSS changes require release/recreation; arbitrary stylesheet/variable mutations are not observed. SVG, layout, continuous springs, gestures, scroll and native-only properties are outside this slice.

Repeat must be an integer from 0 to 1,000. The prepared keyframe cap defaults to 6,001 per source track/composed surface (configurable 2–60,001). Reaching a budget is a transaction failure, not a silent fallback to per-frame writes. Many targets can still make setup expensive; this work establishes correctness and batching, not a preparation-time or FPS guarantee. WAAPI does not by itself establish compositor acceleration.

## Reproduce and evidence

Node 22; Playwright 1.64.1. Local browsers: Chromium 156.0.8078.4, Firefox 157.0, Playwright WebKit 27.2 on macOS arm64. Playwright WebKit is not a physical Safari/iPhone run.

```sh
npm ci
npx playwright install chromium firefox webkit
npm run build
npm run core:check
npm run web:check
npm run web:runtime:typecheck
npm run web:runtime:test
npm run web:proof:test
npm test
npm run docs:check-media
npm run docs:build
```

The runtime suite has 54 checks across three browsers. Coverage includes 11 existing pre-extraction native compiler cases on real DOM targets, controls, partial replacement, nonlinear scale/opacity products, repeat discontinuities, budget/clock-start rollback, shadow-root removal, isolated documents, live preference changes and actual playback without per-frame writes. Existing composition proof: 42 checks. Existing native/unit suite: 1,586 tests. The CI browser job uploads both reports and failure traces. [Local evidence](./web-runtime/validation.json) retains versions and the final clock samples.

To inspect the interactive fixture, use `npm run web:runtime` at `http://127.0.0.1:4282`. Stop it before tests or recording, which each start their own server.

```sh
node benchmarks/web-runtime/record.mjs
ffmpeg -v error -y -ss 1 -i docs/public/media/web-runtime-chromium.mp4 \
  -frames:v 1 -q:v 3 docs/public/media/web-runtime-chromium.jpg
ffmpeg -v error -i docs/public/media/web-runtime-chromium.mp4 -f null -
```

[Recording provenance](./web-runtime/recording.json) contains source/video hashes, browser version and actual click sequence. The English browser capture plays at real-time speed; it shows finite movement, partial interruption, scale contributions, repeat, controls and reduction. Reviewed native Layers recordings are reused as native composition references because native behavior is unchanged. They are labeled iOS simulator and Android emulator, not physical devices or shared Mavis proof. All three clips appear in EN/PT/ES/zh-Hans guides and as English playable PR attachments. Generated documentation was checked for video loading/playback, language selection on guide/homepage and Chinese searches `有限动画` and `createWebRuntime`.
