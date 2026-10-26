# Native Liquid Glass (#34)

The optional `@rafaelaugusto/jolt/glass` entry adds two NativeScript layouts. On iOS 26, their native views use `UIGlassContainerEffect` and `UIGlassEffect`; existing Jolt transform playback moves the surfaces and UIKit blends their geometry. JavaScript configures the material and handles command/lifecycle boundaries. No new display callback, native helper, dependency or CI job is added.

## Reproduce

Build the normal Vue demo with `JOLT_BENCHMARK=1` as described in `CONTRIBUTING.md`, sequentially by platform. Open `glass`. The iOS `--glass-audit` argument or Android `glass-audit=true` extra enables boundary-only audit controls. Reports are written to `Documents/glass-audit.json` on iOS and the app's external files directory on Android.

```sh
npm run typecheck
npm run benchmark:typecheck
npm test -- --maxWorkers=4
npm run build
python3 benchmarks/docs-record-ios.py YOUR_IOS_26_SIMULATOR /tmp/JoltGlass/ios26 \
  testGlassChecks testGlass
python3 benchmarks/docs-record-ios.py YOUR_OLDER_IOS_SIMULATOR /tmp/JoltGlass/ios18 \
  testGlassChecks testGlass
python3 benchmarks/glass-android.py YOUR_EMULATOR /tmp/JoltGlass/android audit
python3 benchmarks/glass-android.py YOUR_EMULATOR /tmp/JoltGlass/android record
python3 benchmarks/verify-glass.py \
  benchmarks/results/glass/ios26.json benchmarks/results/glass/ios18.json \
  benchmarks/results/glass/android.json
npm run docs:check-media
npm run docs:build
```

Select English in the Android preview before recording. XCTest selects English. Copy iOS reports from each simulator's app data container; Android copies its report automatically. XCTest uses the existing native pointer-event test helper to avoid waiting for UIKit's material animator to become idle. It still delivers actual OS touches; that helper is not part of the production library.

## Evidence

Real interactions were run on an iPhone 17 simulator with iOS 26.2, an iPhone 16 simulator with iOS 18.6, and an Android API 36 emulator. Raw boundary reports and the checker output live in `results/glass/`. The English recordings are embedded in both language guides.

| Check                                        | iOS 26.2                | iOS 18.6           | Android API 36       |
| -------------------------------------------- | ----------------------- | ------------------ | -------------------- |
| Native material                              | Glass + glass container | Ordinary blur      | No effect            |
| Snapshot checkpoints                         | 15                      | 15                 | 15                   |
| Native X at paused midpoint                  | −78 / 0 / 78            | −78 / 0 / 78       | −78 / 0 / 78         |
| Resize round trip                            | 346 → 300 → 346 pt      | 337 → 300 → 337 pt | ~355 → 300 → ~355 dp |
| Content ownership and tap while gathered     | Passed                  | Passed             | Passed               |
| Invalid spacing preserves state              | Passed                  | Passed             | Passed               |
| Retarget keeps native presentation           | Passed                  | Passed             | Passed               |
| Pause during delay, reverse repeat, resume   | Passed                  | Passed             | Passed               |
| Background pause and foreground continuation | Passed                  | Passed             | Passed               |
| Effects / scope resources after exit         | 0 / 0                   | 0 / 0              | 0 / 0                |

The checker reads native presentation-layer transforms on iOS and native view translations on Android. It verifies actual UIKit effect classes and `contentView` ownership on iOS, NativeScript ownership on Android, paused checkpoints, input, resize, interruption, repeat completion and teardown. Negative controls remove a native transform or break child ownership and must fail. Backend metadata and geometry alone do not prove rendered fusion: the iOS 26 recording and joined screenshot show the connected material; the legacy and Android recordings show distinct overlapping cards.

The library suite passed **1,429 tests**, including seven material availability, validation, child routing, legacy corner redraw, unload/reload and Android fallback cases. Both type checks, package build and both release demo builds passed. The native legacy recording caught Core's background redraw overriding the fallback's corner radius; the layout now restores its material corners after that redraw, with regression coverage.

The preview's Reduce Motion button stops its current handles and applies the selected layout through reduced-motion playback. Application suspend/resume explicitly suspends/resumes its motion scope. Effects clear on unload and restore on load; permanent exit disposes animations and removes listeners.

These are correctness checks and simulator/emulator recordings, not frame-time, power or memory measurements on physical devices. iOS 26 glass needs matching UIKit metadata. Android has no glass shader and no blur fallback; its normal layouts retain content and use explicit classic styling in the preview. Existing `liquid()` image deformation and SVG `shape()` morphing are separate features.
