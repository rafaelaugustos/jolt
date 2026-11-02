# Web input, lifecycles and shared interaction evidence

Candidate for #314–#317 and #320–#323, based on main `7535cccd6596fb09a8d1f8276f5f852e831a943a` (merged #318). The branch also incorporates main `a4a3a334517d4e9546f45fa617f39246354e38d9` (showcase #319), preserving its navigation and tests. This is development after published `0.1.0-rc.6`, not evidence that RC.6 contains these APIs. Full Web/mobile parity #236 and Mavis integration remain separate.

## Reproduce

```sh
npm ci
npx playwright install chromium firefox webkit
npm run web:lifecycle:typecheck
npm run web:lifecycle:test
npm test
npm run build
npm run core:check
npm run web:check
npm ci --prefix benchmarks/native-app
npm run package:check
npm run docs:check-media
npm run docs:build
# Interactive fixture, port 4289:
npm run web:lifecycle
# Eight real Chromium recordings, separate port 4290; requires ffmpeg/ffprobe:
node benchmarks/web-lifecycle/record.mjs
```

The fixture bundles the source public entry and Vue adapter without NativeScript shims. Its server checks the import graph. `JOLT_LIFECYCLE_PORT` overrides the fixture port. The packed-consumer check separately installs the actual npm tarball without native peers in Web/Vue/SSR consumers and compiles native iOS/Android production JavaScript. Its report lives under `benchmarks/package-consumers/results/`.

## Local matrix, 2026-11-02

macOS arm64; Node 22.23.3; Playwright 1.64.1. Browser versions: Chromium 156.0.8078.4, Firefox 157.0, WebKit 27.2. These Playwright engines are not physical mobile devices or a Safari release qualification.

| Suite                                                               |  Passed | Skipped |
| ------------------------------------------------------------------- | ------: | ------: |
| New lifecycle/input/overlay/shared-layout/recipe/diagnostic fixture |     126 |       0 |
| Existing composition proof                                          |      42 |       0 |
| Existing finite runtime                                             |      54 |       0 |
| Existing press                                                      |      73 |       2 |
| Existing Vue integration                                            |      34 |       2 |
| Existing dynamic motion                                             |      49 |       2 |
| Existing mappings/geometry/scroll                                   |      49 |       2 |
| Existing visual/layout/scene                                        |      96 |       0 |
| **Browser total**                                                   | **523** |   **8** |

The new fixture contains 42 cases, each run in all three engines; zero flaky/retried cases in this run. The eight skips belong to existing capability-specific tests; this change adds no skip. Unit coverage passes 1,652 tests across 104 files, including seven scope ownership/rollback/suspension tests. Those Web unit tests live in the DOM fixture's type environment so the native compiler does not import DOM types.

Packed consumers verify the new public facade, scoped pointer/viewport/shared-layout cleanup, continuous Vue binding, lazy SSR setup, dev/production browser execution, both TS module resolvers and native declarations/bundles. The existing core check still installs the dependency-free portable compiler separately. Root, Web and benchmark typechecks pass. Native on-device playback regressions run in the PR's native CI; the browser results do not replace them.

## What the assertions establish

- Pointer input uses a stable declared region, cached geometry, explicit normalized/pixel coordinates and existing values/springs/mappings. Mouse and hovering pen do not capture input; touch/contact pen, hidden/disabled/inert state and live reduced motion return to rest. Old input is not replayed after re-enabling. Independent press/pulse and target replacement remain owned separately.
- Viewport observation preserves original group order for stagger, one-shot/repeated modes, final readability, missing capability, external channel takeover and cleanup. An entrance moving its own intersection box does not count as a new user scroll exit. Removing an entering target cannot seek a detached surface.
- Scopes dispose only owned handles, roll back failed setup, retain borrowed sources and independent press, continue cleanup after an error and reject duplicate ownership. Suspension does not resume manually paused work; factories recreate non-playable resources explicitly.
- Vue setup starts after mount, handles null/replaced refs, does not run twice through KeepAlive/post-flush watcher ordering, tears down continuous resources on deactivation, preserves finite leave, and can borrow a host runtime without releasing it. Imports/server setup have no DOM work or shared request state.
- Modal/popover top-layer roots isolate transformed DOM ancestors, including Shadow DOM. Identity, translated/scaled and moving ancestor cases, open/close/reopen, selection/focus/dismissal, actual pointer dragging and rejected affecting transforms are covered. Closing a dialog retires unrendered surfaces safely. The Select-like fixture reproduces the Jolt boundary in Mavis #197; it is not the Mavis component or its downstream acceptance test.
- Shared identities cover card/detail and decoded thumbnail/viewer, reversal from the current presentation, cancel, missing/zero-size destination, mutation failure, reduced motion, geometry invalidation and removal. Copies are temporary inert presentation, without IDs/handlers/focus. Cleanup removes a private opacity contribution rather than clobbering application ownership.
- The complete recipe composes bounded drag/spring return, an intrinsic panel and keyed reorder/removal in one scope, with actual input, rapid reversal, reduced motion and disposal. The application controls order, focus and ARIA; there is no example-specific solver or frame loop.
- Opt-in diagnostics explain partial takeover, explicit stop/release, scope lifetime and final runtime cleanup. IDs are local, history is bounded, snapshots are serializable and pull-only, and diagnostics add no frames/listeners/polling or user callbacks inside animation transactions.

## Recordings and review

Eight new H.264 Chromium clips, 900×700 at original timing, use Playwright's actual pointer/wheel/keyboard/button input. The recorder waits for demo readiness, excludes setup, checks console/page errors, fully decodes each MP4 and records codec/dimensions/duration in `benchmarks/web-lifecycle/captures/report.json`. Timeline contact sheets and final frames were visually reviewed for visible behavior, readable controls and cleanup. Files are embedded in the two new guides in EN/PT-BR/es/zh-Hans:

- `web-lifecycle-pointer-chromium.mp4`: follow, press/pulse, reduced motion, fresh-input restart and disposal.
- `web-lifecycle-viewport-chromium.mp4`: real scroll, ordered entrance, repeat, target removal and reduced motion.
- `web-lifecycle-scopes-chromium.mp4`: independent spring owners and retained host press.
- `web-lifecycle-vue-chromium.mp4`: continuous binding, pulse, KeepAlive, ref replacement and unmount.
- `web-lifecycle-overlay-chromium.mp4`: animated Card ancestor, modal drag, Porto selection, reopen and Escape.
- `web-lifecycle-shared-chromium.mp4`: card/detail, decoded image, reversal, cancellation and missing destination.
- `web-lifecycle-recipes-chromium.mp4`: drag-return, real panel size, keyed reorder/removal and disposal.
- `web-lifecycle-diagnostics-chromium.mp4`: partial ownership/reasons, on-demand inspection and screen disposal.

Applicable existing English native recordings were fully decoded and reviewed across their timelines: `live-springs-ios`, `motion-controllers-ios`, `bottom-sheet-ios`, `shared-layout-ios`, `drag-ios`, `size-ios`, `layout-ios` and `motion-inspector-ios`. They run the real NativeScript demo on iOS simulators. They are native behavioral references, not browser helper demonstrations or physical-device performance measurements. The size demo explicitly selects 0.25× in its interruption segment; footage timing is unchanged.

`vue-lifecycle-reference-ios.mp4` is the existing English native Vue recording from 2.7 seconds onward, omitting only launcher/startup screens; `vue.mp4` is preserved. The retained row entrance/removal interaction was reviewed and fully decoded. Reproduce the excerpt without changing playback timing:

```sh
ffmpeg -ss 2.7 -i docs/public/media/vue.mp4 -c:v libx264 -crf 20 \
  -preset slow -pix_fmt yuv420p -movflags +faststart -an \
  docs/public/media/vue-lifecycle-reference-ios.mp4
```

The PR embeds these reviewed English recordings as uploaded players. Localized documentation reuses them with translated platform/behavior captions. No synthetic animation footage or physical-device claim is made.

## Deliberate boundaries

The scope owns resources, not application visibility or retained surface state. Shared-layout presentation copies support positive axis-aligned static HTML/text/decoded images; interactive form/media/custom/Shadow/pseudo content and projective capture report explicit unavailability while preserving the application mutation. At most eight nonoverlapping identities and a configurable bounded copy budget protect preparation cost. Snapshot scaling is not real text reflow. A manual-popover stage is required.

Nonmodal drag under an affecting transform still requires coordinate adaptation. Pointer input needs a stable region. Mavis must adopt the new capabilities through its declared portable surfaces and test its actual components. This work does not publish stable portable references, add navigation, measure input-to-photon latency, prove compositor execution or establish universal FPS. Browser recording, assertions, packed-consumer checks and native CI answer different questions.
