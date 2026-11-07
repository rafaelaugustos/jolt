# Portable composition delivery plan

Base: `v0.1.0-rc.12` (`f1f2ec2`). Branch: `feat/portable-composition`.
All six capabilities are implemented in this candidate. Local acceptance is recorded below; physical browser sensor acceptance remains pending in #385. This work does not publish a release.

| Capability                               | Issue                          | Native acceptance                                                          | Web acceptance                                                                              |
| ---------------------------------------- | ------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Retained resources / Vue shape ownership | #424 (native predecessor #410) | Retained static drawing, pause, KeepAlive, actual unmount, ref replacement | Existing scope/shape renderer, retained ownership, Vue lifecycle, SSR                       |
| Behavior coordination                    | #425 (native predecessor #407) | Shared policy regression and interrupt/block/rest demo                     | Same policy with scoped browser playback, visibility and late callbacks                     |
| Gradient text / sheen                    | #426 (native predecessor #409) | Existing glyph-clipped demo and lifecycle regression                       | Actual text accessibility, gradient reuse, styling ownership, forced colors, interruption   |
| Articulated 2D rigs                      | #427 (native predecessor #408) | Shared definitions/math, bounded pose blend and sockets                    | DOM adapter, hierarchy/geometry limits, interruption and cleanup                            |
| Helpers / reduced-motion observation     | #386                           | Preserve existing helpers and preference observers                         | Shared helpers, runtime-specific observers, override/OS changes, Vue/SSR                    |
| Vector sensors                           | #385                           | Existing vector sensor emulator demo                                       | Supported event/API mapping, unavailable/denied fallback and deterministic browser fixtures |

The maintainer selected **emulator/simulator only** for this round. Physical sensor and accessory acceptance stays explicitly pending. Injected browser readings and emulator sensor input are labeled as such; no hardware accuracy, total CPU/PSS or rendering-isolation claims follow from these checks. Do not use the old physical Android for stress collection.

## Acceptance checklist

- [x] Share portable definitions/policy/math; preserve native API behavior.
- [x] Focused unit/native regressions and Chromium/Firefox/WebKit contracts, including cleanup, interruption and accessibility.
- [x] Build, core/package/SSR consumers, declarations, formatting and capability/playground inventory.
- [x] Real native and browser recordings, inspected and embedded in EN/PT/ES/ZH guides with platform/limits captions.
- [x] `npm run docs:check-media` and `npm run docs:build`.
- [x] Inspect current Mavis implementation and open/closed issues; update concrete adoption work with upstream state and dependencies.
Delivery PR attachment/player verification and CI are recorded in the owning issues after the PR is created.

## Evidence

See the validation and media sections below. Delivery PR/CI evidence will be linked in the owning issues; physical browser sensor checks remain pending.

## Implemented contract and validation

The six candidate APIs are implemented. Five capabilities have local native/browser acceptance; #385 remains open for physical browser sensor delivery/accuracy. No version/tag/package was published. The native API history in RC.11.1/RC.12 remains unchanged.

- Retained Web scopes and Vue shape refs reuse the existing SVG renderer and ownership boundary. Transient `add()` behavior stays compatible; cached shapes opt into retained detachment.
- Behavior coordination, gradient-text definitions, rig validation/pose math and rotation bounds are shared with native. Browser execution uses existing runtime scopes, playback and DOM adapters.
- Browser preferences are document/runtime scoped; the standalone helpers re-export the existing compiler inputs. SSR imports perform no platform reads or scheduling.
- Three additional DeviceMotion vectors share one event acquisition with gravity. Values use native-compatible units; magneticField reports an explicit unavailable fallback. No browser API can manufacture a missing physical sensor.

Local results: **1,780 unit tests / 127 files**; **44 new browser checks passed, one WebKit forced-colors emulation check skipped**; existing parity (96), effects (63), portable foundations (21) and lifecycle (132) browser checks passed. Type checks, build, core isolation, actual tarball consumers and Nuxt hydration/KeepAlive/navigation passed. The capability matrix covers 161 exports and 71 Web methods; all methods have playground coverage. All playground experiments and actual gesture/shell checks passed in Chromium and WebKit.

The real iOS Release demo ran on a dedicated iPhone 17 Pro simulator with iOS 26.2. The Android debug APK used production JavaScript on a dedicated API 36 arm64 emulator with copy-on-write data. Four bounded probes passed on both platforms: 12 drawing cache/unmount cycles, 30 behavior cancellation cycles, 30 bounded pose transitions with paused sockets, and 24 text creation/playback/disposal cycles. Android text helpers stayed at one while attached and returned to zero on disposal. The probes and summaries are in [results/portable-composition](./results/portable-composition/acceptance.json). Setup timings are raw observations only, not a performance comparison.

Android's first build lacked the repository-ignored stock demo resources; copied the existing stock resources from the earlier isolated native-motion worktree. The first install encountered the seed AVD's different signing key; uninstalled only that seed app in the new copy-on-write emulator before installing the current APK. Neither attempt counts as passing evidence. No physical phone or other worktree/device was modified.

## Reviewed media

Eleven new H.264 recordings live in `docs/public/media/composition-*.mp4` and are embedded in EN/PT/ES/ZH. Native clips use actual XCTest interaction, with simulator labels; browser clips use actual Playwright clicks and browser playback. Sensor clips explicitly show preview/injected input. Full streams decoded successfully and representative frames across every clip were inspected for the visible effect, controls and teardown. Browser captures preserve the full original playback timing, including initial activation. Existing published media is preserved. [media.json](./results/portable-composition/media.json) records dimensions, duration, platform and SHA-256.

Reproduce browser capture with `node benchmarks/web-composition-portable/record.mjs OUTPUT_DIRECTORY`. For native capture, install the normal demo on an explicitly reserved simulator, then run `python3 benchmarks/docs-record-ios.py SIMULATOR_UUID OUTPUT_DIRECTORY testNativeMotion testVectorSensors`. Run the bounded probes separately with `benchmarks/native-motion-probes.py PLATFORM DEVICE OUTPUT --modes resources behaviors rig text`.

## Mavis adoption audit

Audited current main `e46d2bd6a6d0cad17c425dd6cb6b12d0905eaf3e`, shared experimental region/surface definitions, Web/native motion adapters, ChartPlot, animated-number and creative text implementation, plus all 248 open/closed issues. Updated existing [#246](https://github.com/getcortexlabs/mavis-ui/issues/246) for retained drawings, [#242](https://github.com/getcortexlabs/mavis-ui/issues/242) for glyph gradients and [#256](https://github.com/getcortexlabs/mavis-ui/issues/256) for vectors/availability. Created [#306](https://github.com/getcortexlabs/mavis-ui/issues/306) for replacing OS-only observation with the effective borrowed runtime preference in actual chart/number owners. All explicitly depend on the containing Jolt candidate/release and retain native/Web, SSR and lifecycle acceptance.

No current articulated-parts consumer or exclusive priority/block/rest policy requirement was found in Mavis components/shared recipes. Existing states/timelines remain useful; no speculative rig or behavior wrapper issue was added. Mavis implementation remains separate. Closed #33/#205 remain closed, and previous published upstream history is preserved.
