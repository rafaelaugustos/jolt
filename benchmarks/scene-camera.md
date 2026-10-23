# SceneKit camera FOV validation

Issue #190, 2026-10-22. `sceneKitFieldOfView(SCNCamera)` extends the existing optional native property registry/player with a spatial scalar adapter. No application polling or JS frame setter is introduced. This report describes correctness checks, not a performance ranking.

## Environment and scope

- iPhone 17 simulator, iOS 26.0, NativeScript Core 9.1.3 / iOS runtime 9.1.0; production webpack bundle, release simulator build, benchmark application ID.
- Host: Apple M4 Max, macOS 26.6.2. A dedicated `JoltFovReview` simulator was used; no physical-iPhone claim.
- Minimum remains NativeScript 8.9 / optional plugin iOS 13. The Objective-C source also passes an explicit arm64 simulator compilation check with the iOS 13 deployment target.
- Android production-bundle/native build passes to check shared imports and the iOS-only demo fallback. No Android FOV/3D backend is added or claimed.
- Existing common registry, playback player, pose and appearance implementations are preserved. The new sink uses weak targets and the existing main-thread display link.

## Native conformance

All **10 conformance groups pass**, with **zero JS observation-frame requests**. Native players and camera sinks return **0 → 0** after every group. Cleanup assertions also check appearance sinks used by the shared-source cases. [Raw results](./results/scene-camera/ios/conformance.json) record observed values and diagnostics.

| Check                              | Native evidence                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Validation before takeover         | Wrong target, nonfinite/out-of-range degrees and malformed native vectors rejected. Invalid replacement leaves the previous player active. Orthographic and custom matrices rejected without mutation, including a custom matrix numerically equal to a standard square projection.                                                                                                 |
| Playback / interruption            | A 70° → 30° degree-linear tween follows native progress; pause holds, 50% seek reads 50°, reverse starts at the latest model angle. No animation keys remain even inside a 2-second outer `SCNTransaction`.                                                                                                                                                                         |
| Visible geometry / viewport        | Projecting the same two fixed world points grows width from about 38.43 to 85.36 in renderer coordinates when FOV changes 70° → 35°. Ratio **2.22077** matches `tan(35°) / tan(17.5°)` within 0.03. Tests verify vertical/horizontal projection matrices and resize the actual NativeScript/SCNView height to 210 DIPs. Horizontal framing holds within 1 renderer coordinate unit. |
| Lens and ownership                 | 36 mm sensor height with 60° FOV yields approximately 31.1769 mm focal length. Explicit stop/lens change supplies the next handoff angle. Replacing an owner and disposing the old wrapper preserves the new animation.                                                                                                                                                             |
| Shared / derived / playback values | Derived numeric FOV, paint and observable playback bindings pause/seek/resume correctly. Invalid future samples are tested against a running source before ownership replacement.                                                                                                                                                                                                   |
| Timeline / independent pose        | FOV and light hold and resume together while camera position remains unchanged.                                                                                                                                                                                                                                                                                                     |
| Configuration invalidation         | Switching an active camera to orthographic/custom projection stops the native player and preserves the new projection and held model angle. Explicit writes through the invalid wrapper fail.                                                                                                                                                                                       |
| Motion policy                      | FOV is spatial and new reduced-motion animations settle immediately; a new source track applies updated policy. `timeScale: 0.5` doubles a 500 ms track. Seeking 41 spring samples in each direction stays within 1–179°.                                                                                                                                                           |
| Lifetime                           | A compiled fixture verifies the sink does not retain its camera. Twenty source/binding suspend-resume-dispose cycles return counts to baseline, including repeated disposal.                                                                                                                                                                                                        |
| Busy JS                            | A deliberate 300 ms main-thread JS loop prevents camera writes; playback catches up to elapsed time afterward, within 2°. This is explicitly not renderer-thread isolation.                                                                                                                                                                                                         |

FOV seek/hold assertions use 0.001° tolerance; matrix/lens checks use 0.0001, live playback allows 2° for asynchronous frame sampling. These are test tolerances, not timing or precision guarantees. `projectPoint` comparisons use SceneKit renderer coordinates and ratios, not physical-display pixel counts.

The first conformance attempt incorrectly expected a paused source to expose future samples for validation. Paused sources intentionally hold one value. The corrected fixture resumes the source before testing an invalid future sample, then pauses/seeks again to verify that the original owner survived. No library behavior was relaxed to make the assertion pass.

## Lifecycle and real UI interaction

The [background test](./results/scene-camera/ios/background.json) presses Home and reactivates the app through XCTest. Scope suspension holds FOV at approximately 57.0833° with **zero writes while suspended**; explicit resume continues to approximately 55.7096°. A wrapper is kept outside the suspendable scope, which owns the handles/binding factories. Raw adapters retain the documented wall-clock policy without automatic background suspension.

The [navigation test](./results/scene-camera/ios/navigation.json) animates, leaves and recreates the actual SceneKit view five times through real button taps. At every destruction boundary, native player, FOV sink and appearance sink counts are all zero. These are owned-resource counters, not total process/GPU memory measurements.

The visual XCTest passes with real touches through zoom-in, pause/resume, reverse, replacement source, child seeking, scene destruction/recreation and a completed zoom. The camera stays fixed; paint follows the FOV source and lighting is a separate timeline participant. The existing SceneKit appearance conformance XCTest also passes as a regression check.

## Media and local checks

- `docs/public/media/scene-camera-ios.mp4`: **22.10 seconds**, H.264, 640 × 1392, 30 fps, 344,603 bytes. Real iOS simulator footage, with unchanged playback timing. Representative frames across the clip were inspected and the entire compressed file decoded without errors. The zoom, reversal, paused state and recreated scene are visible.
- The clip is embedded in both English and Portuguese camera guides. Existing lighting, camera-pose and map recordings are preserved.
- **1,059 JS tests / 63 files pass**, including seven new adapter tests plus public TypeScript acceptance/rejection checks. Root types, benchmark types, library build, formatting and diff checks pass.
- iOS native build and Android production build pass. The iOS fixture/visual/background/navigation tests validate the real native implementation beyond the fake-driver tests.
- Documentation media coverage: **46 guides per language / 87 recordings**. Production VitePress build passes.

## Reproduce

Build the library and normal native demo with Node 22 and the existing native toolchains; build platforms sequentially. Use a dedicated iOS simulator. The XCTest recorder needs Ruby with the CocoaPods `xcodeproj` gem, as described in `CONTRIBUTING.md`.

```sh
npm ci
npm run build
npm run typecheck
npm run benchmark:typecheck
npm test
cd demo
npm ci
JOLT_BENCHMARK=1 ns build ios --for-device false --release --env.production --no-hmr
xcrun simctl install SIMULATOR_UUID platforms/ios/build/Release-iphonesimulator/demo.app
cd ..
python3 benchmarks/docs-record-ios.py SIMULATOR_UUID /tmp/camera-checks testSceneCameraChecks
```

Copy `Documents/jolt-scene-camera.json` from the app data container before running background validation, which writes the same report name:

```sh
python3 benchmarks/docs-record-ios.py SIMULATOR_UUID /tmp/camera-background testSceneCameraBackground
python3 benchmarks/docs-record-ios.py SIMULATOR_UUID /tmp/camera-navigation testSceneCameraNavigation
python3 benchmarks/docs-record-ios.py SIMULATOR_UUID /tmp/camera-video testSceneCamera
python3 benchmarks/docs-record-ios.py SIMULATOR_UUID /tmp/lighting-regression testSceneAppearanceChecks
npm run docs:check-media
npm run docs:build
```

Launch `--scene-camera` for the isolated demo; add `--camera-checks=background` for the lifecycle case. Navigation writes `Documents/jolt-camera-navigation.json`. The app gallery includes **SceneKit camera field of view**. The feature requires matching updated core/native package builds and a native rebuild; published beta.14 binaries do not contain it.
