# SwiftUI and portable framework expansion

Objective: implement the 24 additional capabilities authorized by the maintainer in the existing PR #436, isolated in `feat/web-frameworks-swiftui`. No release or merge is requested.

Status: all 24 implementations and their native/Web demonstrations are present. Local package/docs/native checks pass. All 38 published PR players and 30 closing references were verified; hosted CI is being verified before review handoff. Cortex tools are unavailable; this is a repository delivery checkpoint, not a Cortex save.

| Capability                                                             | Issue | Priority |
| ---------------------------------------------------------------------- | ----- | -------- |
| Presence with interruptible enter/exit in SwiftUI and DOM frameworks   | #437  | high     |
| Add accessible SwiftUI press and hover feedback                        | #438  | high     |
| Add SwiftUI pointer follow and framework-owned Web pointer resources   | #439  | high     |
| Add reactive SwiftUI motion values and springs with portable ownership | #440  | high     |
| Parameterize shared motion recipes across native, Web and SwiftUI      | #441  | high     |
| Run standalone SwiftUI interaction and portable contracts in CI        | #442  | high     |
| Add bounded SwiftUI drag with snapping and interruption                | #443  | high     |
| Add SwiftUI scroll-linked progress and portable framework ownership    | #444  | medium   |
| Add cancellable SwiftUI sequences and staggered motion                 | #445  | medium   |
| Add named SwiftUI timeline cues with cancellable effect adapters       | #446  | medium   |
| Add SwiftUI shared layout transitions with stable identities           | #447  | medium   |
| Add opt-in SwiftUI motion inspection with bounded diagnostics          | #448  | medium   |

## Decisions and dependencies

Reuse existing Web runtime and native portable contracts. Framework adapters own resources; platform execution stays in adapters. Apple supports iOS 17/macOS 14 with physical units in points. Shared recipe definitions and numerical fixtures are generated from `src/core`; no JS runtime in Swift apps. Never imply identical pixels, hardware capabilities or frame performance.

Source dependencies: `packages/swiftui`, `src/core`, `src/web/frameworks`, DOM framework entries, `benchmarks/swiftui-demo`, `benchmarks/web-frameworks`, real packed framework consumers, CI and four-language guides.

Next: shared parameter recipes, scalar sampling and resource ownership; then interactive SwiftUI primitives and framework bindings; then scheduling/layout/inspector; finally real interaction, recordings, Mavis follow-ups and PR acceptance. All twelve remain pending until tested and demonstrated.

## Checkpoint — scalar and ownership foundations

All twelve owning issues exist (#437–#448). Source implementations now include shared `createPreset`, Swift scalar sampling/recipes, demand-driven/manual clocks, scoped sampled values, finite timelines/cues, presence, native button feedback, pointer, drag, scroll, shared layout modifiers and opt-in inspector. DOM entries have scoped `motion` setup and new React/Svelte/Solid presence owners. These are implementation candidates; visible acceptance and media are still pending, so no task is complete.

Verified so far: core boundary check; Web typecheck; full TypeScript/Angular library build; 4 parameter-recipe tests including actual native registry/driver; 15 Swift tests including shared generated endpoint/numerical fixtures, pause/suspension, cancellation/replacement, follower cleanup, snap interruption, sequence timing and inspector bounds. SwiftUI interactions have not yet been run for these new APIs. The prior PR's recordings do not establish this expansion's acceptance.

Next: integrate these capabilities in the actual standalone app and packed DOM framework fixtures; exercise real interactions on iOS/macOS/three browsers. Add CI interactions, all-language docs, reviewed footage, Mavis follow-ups and expanded PR closing references. Recheck source/tests after any subsequent fix.

## Second expansion authorized by the maintainer

The maintainer requested twelve more tasks after the first twelve, all in PR #436. Total expansion scope is now 24 new tasks. Continue the first batch through native acceptance/media, then implement this dependent batch; no new permission or release is requested. These additional tasks are all pending.

| Capability                                                         | Issue | Priority |
| ------------------------------------------------------------------ | ----- | -------- |
| Map and derive SwiftUI motion values with shared numeric contracts | #449  | high     |
| Add reactive SwiftUI color values and property bindings            | #450  | high     |
| Coordinate SwiftUI property groups atomically                      | #451  | high     |
| Add named SwiftUI motion states with interruption                  | #452  | high     |
| Coordinate SwiftUI behaviors with priority and restoration         | #453  | high     |
| Add seekable SwiftUI playback and explicit timeline progress       | #454  | medium   |
| Add finite SwiftUI inertial decay and bounded release              | #455  | medium   |
| Add SwiftUI motion paths and tangent orientation                   | #456  | medium   |
| Add retained SwiftUI vector drawing and stroke progress            | #457  | medium   |
| Add SwiftUI gradient text and glyph-clipped sheen                  | #458  | medium   |
| Add SwiftUI viewport entry with bounded replay and cleanup         | #459  | medium   |
| Integrate SwiftUI rendering activity with resource scopes          | #460  | medium   |

Shared boundaries: build on sampled values, scopes, timelines and the existing portable core. Native/Web implementations already exist for several capabilities; extend only missing SwiftUI/framework ownership and conformance. Rendering stays platform-owned. Every new visible behavior still needs actual native and browser recordings before completion.

## Checkpoint — first twelve accepted locally

Source and actual interaction now cover #437–#448. Local evidence: 1,787 TypeScript tests; 75 packed framework tests across Chromium/Firefox/WebKit; 18 Swift tests in Debug and Release (Debug repeated after system accessibility reconciliation); packed consumers/SSR/types/native production bundles; iOS 27.0 simulator and macOS interaction, composition and scrolling. Tests exposed an inert-document Solid remount issue, a reduced-motion event race and a real native scroll observation bug; those are fixed in source. No physical-device performance claim.

Six native and four Chromium recordings were fully decoded and visually reviewed, then embedded in all four languages. `docs:check-media` and `docs:build` pass. Mavis main at c4063f57ebf2ece353f4a0d3b07fe26b00d99bf5 and 250 open/closed issues (excluding pull requests) were inspected; existing adoption #145/#152/#153/#154/#298/#306 updated with pending merge/publication dependencies. Initial PR attachments are preserved.

Remaining: upload these English recordings to PR #436, validate published players and CI; finish #449–#460 (numeric/color/path foundations are source candidates only), their tests, demonstrations, docs and adoption review. No issue is manually closed before merge; PR remains draft during the second expansion. Current files take precedence over this checkpoint.

## Checkpoint — all 24 implemented and demonstrated

The second batch (#449–#460) now includes numeric/OKLab mappings, atomic property groups, named states, bounded priority behaviors/restoration, seek without side effects, inertial decay, polyline paths, retained Canvas drawing, gradient text/sheen, actual viewport entry and explicit renderer demand. Existing Web backends are reused inside all four framework owners. No new parallel browser API was introduced.

Current evidence: 37 Swift tests pass in Debug and Release; 99 installed-consumer browser tests pass in Chromium, Firefox and WebKit. All seven iOS and all seven macOS interaction tests pass. Six advanced native recordings and four advanced browser recordings were fully decoded and visually reviewed. Four updated browser interaction clips preserve the same behavior with a longer cue-cancellation window. EN/PT/ES/ZH guides embed the reviewed clips.

Review exposed and fixed reentrant timeline ownership, final-frame renderer delivery, paused timeline background behavior, scope readoption before deferred cleanup, and shared native observer lifetime. CI unit clocks now inject accessibility policy deterministically while production clocks still respect the system. The disposable CI runner explicitly enables full-motion interaction because runner images ship with Reduce Motion enabled; separate tests cover reduced motion.

Mavis main remains c4063f57ebf2ece353f4a0d3b07fe26b00d99bf5. The 250 open/closed issues were checked again; existing #145/#152/#153/#154 adoption issues now cover these contracts and pending merge/publication dependencies. Existing seek/drawing/path adoption issues are linked, with no duplicate issues or Mavis implementation in this PR.

Local validation now also passes all 1,787 TypeScript tests, packed/native production consumers, Nuxt across three browser engines, formatting, parity, generated Swift definitions, media coverage and docs build. PR #436 contains 38 verified English video players and 30 closing references (initial six plus these 24).

Next: verify hosted CI and update each owning issue with acceptance. No merge, tag, npm publication or release is authorized by this task. Current source and execution results take precedence over this recovery note. Cortex remains unavailable.

Hosted CI confirmed the 37 Swift tests, 99 framework tests, package/Nuxt consumers, documentation/playground and Android native checks. The Xcode 16.4 / Swift 6.1.2 demo build exposed a compiler crash lowering a throwing StateObject initializer. Nonthrowing lazy factory functions now contain that validated demo setup; execution and recordings are unchanged. Native interaction and the remaining hosted gates are being revalidated on the final PR commit.
