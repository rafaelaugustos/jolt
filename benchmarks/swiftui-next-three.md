# SwiftUI panels, measured geometry and documentation status

Objective: deliver #467 (bottom sheets, high), #468 (measured reorder, high) and #469 (quadratic/cubic paths, medium), plus the requested New/Updated/Beta documentation menu, in isolated PR #436. Baseline 4c584e3 contained 36 tasks and 49 reviewed PR video players. Do not edit the separate user's working checkout. Current source and live CI take precedence over this checkpoint. Cortex tools are unavailable; this is a repository checkpoint, not a Cortex save.

## Architecture and decisions

Reuse existing NativeScript/Web bottomSheet, realized reorder and motion-path contracts. Numerical policy lives in JoltCore; generated fixtures compare src/core/{sheet-geometry,reorder,svg-path}.ts. SwiftUI owns input, rendering, focus and host-relative keyboard observation. Panels bound snap points and sampled motion; retained models suspend on disappearance and resume on remount. Measured rows retain fixed-height compatibility, cancel active drags on geometry changes and do not imply virtualization. Typed quadratic/cubic paths use bounded adaptive arc-length sampling; there is no full SVG importer or morphing.

Browser acceptance found an existing Web reorder ownership defect after FLIP and subsequent text-height changes. Retain row geometry leases between contacts, prune removed rows and release on disposal. Repeated drag/resize/cancel/keyboard acceptance uses actual packed consumers; no duplicate Web API.

The menu follows Mavis's central catalog/status-rendering pattern. A curated localized map renders SSR labels with accessible descriptions and plain previous/next labels. New/Updated expire when the package edition changes; Beta persists until stabilization. Source/published availability is explicit and must be reviewed at release. Site navigation has no native renderer counterpart. Real browser recordings cover desktop/mobile navigation and themes; recordings are English, with localized captions in all four guides.

Mavis main c4063f57ebf2ece353f4a0d3b07fe26b00d99bf5 and all 250 open/closed issues were inspected. Sheet and reorder adapters already exist; existing #234/#237/#298 now carry concrete remaining acceptance and pending Jolt merge/publication dependencies. Shared path recipes remain a real gap. No duplicate issues or Mavis code. Its docs navigation source was also inspected for the menu request; borrowing that existing pattern creates no new Mavis runtime adoption requirement.

## Verified milestone

All 1,789 TS tests in 130 files, 64 Swift Debug/Release cases (17 core, 47 ownership), 147 packed framework cases across Chromium/Firefox/WebKit and all 24 actual native UI regressions (12 iOS, 12 macOS) passed. The new panel remount/suspension case subsequently passed on both platforms and its recordings were refreshed. Core/SSR/type/capability checks passed. All eight CI jobs passed at 879db8b; changes after that commit require current exact-head CI before readiness.

The eight original new native/browser clips were decoded, reviewed and embedded in EN/PT/ES/ZH. PR #436 preserves all previous 49 players plus those eight. The latest two panel recordings supersede documentation files; append reviewed current versions in the PR without deleting prior attachments. Both menu recordings are also reviewed and embedded in all four languages. The acceptance manifest now tracks 48 current documentation recordings. Media coverage (450 recordings), documentation build and formatting passed after the menu addition.

## Pending / next step

Local implementation, acceptance hashes and documentation are complete. The menu also passed all 24 Chromium/Firefox/WebKit locale/viewport combinations, including accessible labels and keyboard navigation; direct checks verified expiration and escaped labels. Commit/push the suspension fix and menu addition; the 61 English PR players are already verified (57 preserved + 4 new). Update issue acceptance and verify exact-head CI before marking the draft ready. Current remote checks take precedence over this pre-push checkpoint. No merge, release or site deployment is requested.

Source dependencies: packages/swiftui/Sources/{JoltCore,JoltSwiftUI}; src/core/{sheet-geometry,reorder,svg-path}.ts; src/web/{bottom-sheet,reorder,motion-path,interaction,runtime}.ts; scripts/generate-swiftui-definitions.mjs; benchmarks/{swiftui-demo,web-frameworks,docs-navigation}; benchmarks/results/web-frameworks-swiftui/acceptance.json; test/fixtures/package-consumers/web-frameworks; docs/.vitepress/{config,navigation-status,theme}; docs/{,pt-BR/,es/,zh-Hans/}guide/{swiftui-geometry,index,paths,reorder}.md; CONTRIBUTING.md.
