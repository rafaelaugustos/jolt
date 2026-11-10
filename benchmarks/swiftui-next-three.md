# SwiftUI panels and measured geometry

Objective: deliver #467 (bottom sheets, high), #468 (measured reorder, high) and #469 (quadratic/cubic paths, medium) in the existing isolated PR #436. Baseline 4c584e3 has 36 accepted tasks, eight passing checks and 49 reviewed PR video players. Current source and live CI take precedence over recovery notes. Cortex tools are unavailable; this is a repository checkpoint, not a Cortex save.

## Decisions and architecture

Reuse the existing NativeScript/Web bottomSheet, realized reorder and motion-path contracts. Keep numerical policy in JoltCore and compare generated fixtures against src/core/{sheet-geometry,reorder,svg-path}.ts. SwiftUI owns input, rendering, focus and keyboard observation. Do not duplicate Web APIs. Panels use actual host-relative keyboard overlap, bounded snap points and owned sampled motion. Measured reorder retains fixed-height compatibility; a changed row measurement cancels an active drag without committing. Curves use typed line/quadratic/cubic segments and bounded adaptive arc-length sampling, without a full SVG importer or morphing.

## Pending and next steps

Implement panel core/controller/view first, measured reorder next, and curved paths third. Add meaningful unit/differential tests, native and packed-framework demos and actual UI tests. Record and review native/browser playback, document all four languages, audit Mavis implementation/open/closed issues, run required checks, push and verify exact-commit CI. Preserve all 49 existing PR attachments and add reviewed English players. No merge or release is requested.

Source dependencies: packages/swiftui/Sources/{JoltCore,JoltSwiftUI}; src/core/{sheet-geometry,reorder,svg-path}.ts; src/web/{bottom-sheet,reorder,motion-path}.ts; scripts/generate-swiftui-definitions.mjs; benchmarks/swiftui-demo; benchmarks/web-frameworks; test/fixtures/package-consumers/web-frameworks; docs/{,pt-BR/,es/,zh-Hans/}guide.

## Implementation milestone

Implemented bounded sheet geometry/controller/view and host-relative keyboard probe, measured realized reorder and typed adaptive Bézier paths. Shared generated TypeScript fixtures compare sheet release, row centers and curve length/position/tangent. All 64 Swift tests (17 core, 47 ownership) pass in Debug/Release; 1,789 TS tests in 130 files pass. Actual iOS curve/reorder and iOS/macOS panel interactions pass; remaining native/full-browser acceptance and reviewed media are pending.

Browser acceptance exposed an existing Web reorder lifecycle defect after FLIP followed by text-height change. Retain row geometry leases between contacts; release them on row removal/disposal. Add a real repeated-drag/resize/cancellation/keyboard regression through packed consumers. Existing Web APIs remain unchanged. Mac panel handle now explicitly participates in keyboard focus; Escape belongs to the whole component.

Mavis main c4063f57ebf2ece353f4a0d3b07fe26b00d99bf5 and all 250 open/closed issues were inspected. Current Sheet and reorder adapters already exist; updated existing #234/#237/#298 with concrete remaining acceptance and pending Jolt merge/publication dependencies. No duplicate issues or Mavis code. The shared recipe validator still lacks paths.

Next: finish current macOS geometry capture and complete the browser suite; record/review browser/native media; required documentation/media/format/contract checks; append acceptance hashes, commit/push, playable English PR attachments and exact-head CI. No merge/release. Source dependencies now also include src/web/{interaction,runtime}.ts and docs/*/guide/swiftui-geometry.md.

## Reviewable delivery checkpoint

Implementation and local feature acceptance are complete. The four new native UI scenes passed on iOS 27 simulator/macOS 26.6.2, and all 12 iOS regression cases passed. All 147 packed framework cases passed on Chromium/Firefox/WebKit; all 1,789 TS cases and 64 Swift Debug/Release cases passed. Core/SSR/type/capability/format checks, docs media coverage and documentation build passed. Eight new English recordings were decoded and visually reviewed, embedded in EN/PT/ES/ZH and hashed in acceptance.json (46 documentation recordings total).

No new feature work remains. The handoff still requires the full macOS regression/current CI, preservation of the existing 49 PR players plus eight new English players, and live issue/PR acceptance updates. Use GitHub's exact-head checks for readiness; this checkpoint is not a claim that pending CI passed. Merge and publication remain separate. No Cortex tool was available, so no Cortex save is claimed.
