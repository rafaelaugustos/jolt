# Web frameworks and standalone SwiftUI delivery

Base: main `b3a37d0` / published RC.12.1. Branch: `feat/web-frameworks-swiftui`.
Objective: deliver the six authorized Web/tooling tasks and start experimental SwiftUI support for apps written in Swift without NativeScript. No merge or release is implied by this implementation task.

| Capability               | Issue | Acceptance                                                                                              |
| ------------------------ | ----- | ------------------------------------------------------------------------------------------------------- |
| React DOM hooks          | #430  | Real Strict Mode, SSR/hydration, refs, interruption, teardown                                           |
| Angular DOM directives   | #431  | Render-phase attachment, retained exit, SSR/hydration, partial compilation                              |
| Svelte DOM actions       | #432  | Real compiled component, reactive update, SSR, destruction                                              |
| Solid DOM directives     | #433  | Real JSX, signal tracking, server/client resolution, cleanup                                            |
| Portable inspector plots | #415  | Bounded expected/observed data, explicit unavailable gaps and source labels                             |
| Browser sensor replay    | #434  | Shared canonical validation, isolated hardware detachment, orientation, pause/cancel/dispose            |
| SwiftUI initial backend  | #435  | Standalone SPM consumer, finite pose transitions, shared definitions, native interaction, Reduce Motion |

## Decisions and source boundaries

- Existing native framework entries retain their meanings. New DOM entries live under `/web/react`, `/web/angular`, `/web/svelte`, `/web/solid`.
- Reuse `src/web/public.ts`, `src/web/scope.ts` and connection observation from `src/web/vue/attachment.ts`. Frameworks supply lifecycle; they do not create another animation engine. Existing Vue remains supported.
- Reuse `src/core/interaction-replay.ts`, `src/web/testing.ts`, `src/web/sensors.ts`, `src/testing/sensors.ts`, `src/inspector/plot.ts` and `src/web/inspector.ts`; keep injected samples distinct from hardware availability. #385 remains open.
- SwiftUI uses a real Swift Package and SwiftUI execution, with portable recipe/curve definitions from `src/core/presets.ts` and `src/core/transition.ts` where supported. It does not embed JavaScript or NativeScript and does not promise identical timing/pixels or full engine parity.
- Build/SSR imports must remain lazy and optional-peer safe. Add real packed consumers to `scripts/check-package-consumers.mjs`; compile Angular with its pinned partial-library toolchain.
- Cortex tools are unavailable in this session. This file is a repository delivery plan, not a successfully saved Cortex checkpoint.

## Pending delivery gates

- [x] Implement shared Web bindings and all four framework adapters.
- [x] Implement bounded plots and deterministic sensor replay with native regression coverage.
- [x] Implement the initial Swift Package and standalone iOS/macOS demos.
- [x] Validate actual packed/SSR consumers, framework hydration/lifecycle and supported browser engines.
- [x] Validate native references and actual SwiftUI interactions on a dedicated simulator and this Mac; no old-phone stress collection.
- [ ] Inspect real native/browser recordings; embed in EN/PT/ES/ZH and playable English PR attachments.
- [ ] Build/core/parity, package/Nuxt, unit, media/docs and appropriate native checks.
- [ ] Audit current Mavis main and all open/closed issues; update concrete downstream work without implementing Mavis.
- [ ] Open reviewable PR(s), verify video players and CI, update issue evidence. Keep incomplete acceptance open.

## Implementation checkpoint (unverified delivery)

The shared DOM binding owner and four adapters exist under `src/web/frameworks`, `src/web/react`, `src/web/angular`, `src/web/svelte` and `src/web/solid`. They pass TypeScript and Angular partial compilation; real packed consumer acceptance is still in progress. Framework fixtures use React 19.3.1, Angular 22.2.4, Svelte 5.57.3 and Solid 1.9.18. Native React 16/18 compatibility remains separately bounded by its renderer.

Portable plots and sensor replay are implemented in `src/core/inspection-plot.ts`, `src/core/sensor-replay.ts`, `src/web/inspector.ts` and the sensor/replay files. Focused native sensor/inspector and plot tests passed (34 tests). Browser replay/plot conformance has not yet been run; no feature completion follows from this checkpoint.

`Package.swift` builds standalone `JoltCore` and `JoltSwiftUI`; three initial Swift unit tests passed. `scripts/generate-swiftui-definitions.mjs` derives supported recipes, standard curves and physical spring parameters from compiled shared core. The initial API supports immutable poses and a bounded preset subset; no imperative timeline/sensor/layout engine or JS bridge is claimed. The real SwiftUI app and XCTest fixture are in `benchmarks/swiftui-demo`; native acceptance and recordings are pending.

Next steps: finish packed framework hydration/lifecycle tests; add real browser replay/plot conformance; build/run the standalone SwiftUI demo; then review media, translated docs, capability inventory, Mavis audit and PR evidence. All delivery gates above remain pending until their actual evidence is inspected.

## Reviewed acceptance — 2026-11-09

- Standalone package: generated definitions match the shared core; 3 Swift tests pass. The iOS 27.0 iPhone 17 Pro simulator application and macOS 26.6.2 application pass actual XCTest interaction. The native app imports only the local Swift Package. macOS was added after the maintainer explicitly confirmed that expectation.
- Packed DOM consumers: NodeNext/Bundler declarations, real SSR/hydration and all four framework lifecycle fixtures pass. The expanded Chromium/Firefox/WebKit suite passed 48 tests, including Angular interrupted-exit identity retention. Native packed declarations/bundles and the actual Nuxt consumer also pass.
- Existing native/shared regressions: 128 unit files / 1783 tests pass; existing browser sensor suite passes 9 tests. These are correctness results, not CPU/PSS benchmarks.
- New real recordings: `swiftui-ios`, `swiftui-macos`, `web-react`, `web-angular`, `web-svelte`, `web-solid`, `web-tools`, `web-preset`. H.264 files decode fully. Reviewed representative frames across playback, motion targets, visible controls and ownership transitions. macOS capture is restricted to the demo window; iOS is clearly labeled a simulator. Existing native framework/inspector/sensor reference recordings were decoded and visually reviewed again. All are embedded in EN/PT/ES/ZH guides.
- Media check passes for 105 guides and a homepage in four languages. Documentation build and final integration/CI review remain in progress.
- Mavis audit: current main `c4063f57ebf2ece353f4a0d3b07fe26b00d99bf5`; inspected package baseline, shared motion, Web runtime owner/diagnostics and all open/closed adoption issues. Current implementation still uses Vue and Jolt RC.12.1. Reuse adoption issues #145/#152/#153/#154 for future framework ownership, #297 for plots, #256 for synthetic sensor conformance. No duplicate issue or Mavis implementation is needed; updates will identify this Jolt candidate as pending merge/publication.

Remaining: final interrupted-exit check, formatter/core/parity/docs checks, update issue evidence, create PR with direct English video players, verify CI and published attachments. #415 physical overhead and #385 physical browser sensor acceptance stay open. No release or merge is authorized by this work.
