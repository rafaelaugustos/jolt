# SwiftUI interaction and character expansion

Objective: deliver the six authorized capabilities in the existing isolated PR #436. Base: 77750a3; the previous 30 tasks passed CI and have 38 reviewed PR players. Current source takes precedence over historical checkpoints. Cortex tools are unavailable; this is a repository checkpoint, not a Cortex save.

- #461 (high): Add declarative SwiftUI keyframes with finite repetition and autoreverse
- #462 (high): Compose SwiftUI pan, pinch and rotation around a preserved focal point
- #463 (high): Add accessible SwiftUI reorder for realized nonvirtualized lists
- #464 (medium): Add owned SwiftUI drop zones with acceptance and return motion
- #465 (medium): Add bounded SwiftUI particle emitters and confetti
- #466 (medium): Add articulated SwiftUI 2D rigs with pose blending and sockets

## Architecture and decisions

Keep platform-independent validation and numerical policy in JoltCore, with generated differential fixtures from src/core. SwiftUI owns actual gestures, rendering and accessibility. Reuse the sampled clock, value leases, timelines, scopes and Canvas; do not add idle clocks. Reuse existing Web gestures, reorder, dropZones, particles/confetti and rig through installed framework consumers. Keyframes compile finite segment tracks into the existing timeline; repetition is bounded, not an unbounded background loop. Lists are initially nonvirtualized. Units remain Apple points/native DIP/Web CSS pixels.

Source dependencies: packages/swiftui/Sources/JoltCore and JoltSwiftUI; src/core/{gesture-math,reorder,drop,rig}.ts; src/web/{gestures,reorder,drop-zones,particles,rig}.ts; scripts/generate-swiftui-definitions.mjs; benchmarks/swiftui-demo and web-frameworks; test/fixtures/package-consumers/web-frameworks; four-language guides.

## Verified acceptance

All six capabilities are implemented and validated locally. Swift: 53 tests (13 core, 40 adapter), Debug and Release. TypeScript: 1,787 tests in 129 files. Packed framework browsers: 123 tests in Chromium, Firefox and WebKit. Actual standalone UI: 20 tests, ten on iOS 27 simulator and ten on macOS 26.6.2. Build, generated definitions, type checks, portable core, capability inventory, packed declarations/SSR/NativeScript bundles, Nuxt, formatting, media and documentation build passed.

Ten reviewed English-UI recordings demonstrate the new native/browser behavior in all four documentation languages. Actual iOS pinch/rotation uses region-filtered UIKit recognizers and preserves taps. macOS validates mouse and buttons, not physical trackpad input. Window region filtering does not infer overlay occlusion; covered gesture regions must be disabled. Lists are fixed-height and nonvirtualized. No physical-device performance or Reanimated superiority claim.

Mavis main c4063f57ebf2ece353f4a0d3b07fe26b00d99bf5 and open/closed issues were inspected. Existing MParticleField/MConfetti implementations are reused. Adoption #235/#237/#296/#244/#42 now document pending SwiftUI merge/publication and shared app/lifecycle acceptance. No Mavis implementation or duplicate component issues.

## XCTest compatibility

The first CI run for d4b8edf passed seven jobs but iOS XCTest could not compute an accessibility hit point for the gesture card after reset. Drag, pinch and rotation had already passed. The test now touches the visible center and still asserts actual Button delivery before and after remount. This targeted interaction passed on a dedicated iOS 18.6 simulator. Runtime, rendered behavior and reviewed recordings are unchanged; the updated commit must pass CI.

## Handoff

Evidence and video hashes: benchmarks/results/web-frameworks-swiftui/acceptance.json. Guides: docs/{,pt-BR/,es/,zh-Hans/}guide/swiftui-characters.md. Delivery remains in PR #436 with closing references #461–#466. PR readiness requires the committed source to pass CI and all ten new English recordings to render as players while preserving the earlier 38 attachments; verify live PR status for those final checks. Merge and publication remain pending; RC.12.1 does not include these Swift additions. No merge or release is requested.
