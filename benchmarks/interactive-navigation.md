# Interactive Frame navigation on iOS (#26)

The optional `@rafaelaugusto/jolt/interactive-navigation` entry uses Core's custom Transition hooks. Core still owns the navigation-controller delegate and route queue. A native object implements both UIKit animation and interaction protocols, moves live page views, updates the transition context from an edge recognizer, and settles with `JoltSpringAdvance`. JS runs at lifecycle boundaries, never per gesture sample or display frame.

This delivery covers whole Frame pages and programmatic/interactive return. It does not turn the separate programmatic shared-image/card overlay from #24 into an interactive morph, implement arbitrary modal dismissal, or implement Android predictive back (#25).

## Reproduce

Build the library and normal benchmark-ID Vue demo using `CONTRIBUTING.md`. Install on an explicitly assigned simulator. Build iOS and Android sequentially.

```sh
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR_UUID /tmp/InteractiveNavigation \
  testInteractiveNavigation testInteractiveNavigationPortuguese \
  testInteractiveNavigationChecks
```

The fast-release audit establishes edge recognition, then accelerates and lifts while still moving. It uses a test-runner-only XCTest pointer path; this private test interface is never linked into Jolt or the demo. Public XCTest drag helpers decelerate at their endpoint and did not exercise a moving release.

The first two tests record actual XCTest taps and edge swipes: forward navigation, a partial cancelled return, a committed return, then programmatic back. The separate audit uses `--showcase-example=interactive-navigation --interactive-navigation-audit` and writes `Documents/jolt-interactive-navigation.json`.

The audit checks repeated cancellations, page-level swipe blocking, explicit cancellation while the OS gesture is still held, two nested entries (cancel then pop one at a time), a quick release before halfway, programmatic back, reduced motion, and disposal followed by the default back transition. The release events include measured progress/velocity. Native lifecycle snapshots record page identity, stack depth, page transform, active transition count and installed recognizer count. No synthetic JS tap/pan notifications are used.

Two integration details have explicit coverage: UIKit can supply its interactive context after the recognizer begins, and NativeScript can drain JS microtasks inside `completeTransition`. The owner remains alive until the native terminal callback, so the completion outcome is not lost to early route cleanup. The source demo retains its content while in the back stack; it is visible before `navigatedTo` commits a pop.

## Evidence and limits

- iOS 26.2, iPhone 17 **simulator**, NativeScript Core 9.1.3, `vue-router-ns` 0.1.0-rc.2. Real input, Release build, HMR disabled.
- EN/PT recordings are H.264, 420 × 914, 30 fps, approximately 10.6 seconds each. Original playback timing is preserved. Full-duration contact sheets and intermediate transition frames were inspected; both compressed files decode without errors.
- Audit: see `results/interactive-navigation/ios.json`. Cancelled returns preserve depth and identity; settled page matrices are identity. Nested owners go from two recognizers to one to zero. The Core delegate is preserved; final native transition and recognizer counts are zero.
- Android API 36 emulator: the production demo builds, launches, and shows the localized iOS-only availability screen for this experiment. No Android gesture support is claimed.
- 1,258 host tests (82 files), library/benchmark typechecks, production inspector exclusion, formatting, documentation media coverage and documentation build pass. The 14 new host cases cover ownership, Core state ordering, guards, reduced motion, route removal, disposal, missing native code, and invalid options.

The audit's last native snapshot is taken when the visible detail entry is explicitly disposed. XCTest subsequently presses the regular back button and asserts the source page is visible; that default UIKit pop has no remaining Jolt owner to emit another snapshot.

This is lifecycle and route-correctness evidence, not physical-device frame-time or memory profiling. Arbitrary action-bar configurations and RTL input remain outside the recordings. Native cancellation hooks handle viewport changes and resign-active notifications. No workflow or long-running CI job was added.

## Background ownership and rotation regression — 2026-10-29

The original implementation cancelled a held gesture correctly on suspension, but then disposed its owner when Core temporarily unloaded the root Frame. On resume, an ordinary UIKit back swipe could still succeed, hiding the loss of Jolt's transition. The fix distinguishes suspension from foreground removal, retains the entry across Core's reload, and rechecks Frame/route ownership after resume. A removed Frame or route, explicit disposal, and a completed pop still release the controller. A second suspension clears pending resume work.

```sh
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR_UUID /tmp/InteractiveLifecycle \
  testInteractiveNavigationLifecycle testInteractiveNavigationChecks
# Also verify a saved report independently:
python3 benchmarks/verify-interactive-lifecycle.py \
  benchmarks/results/interactive-navigation/2026-10-29-lifecycle-ios.json
```

The lifecycle test uses a test-runner-only pointer path that moves for 0.8 seconds, holds, and lifts at 3.1 seconds. At 1.4 seconds XCTest requests device rotation or activates SpringBoard. Activation switches the real app to the background without trying to inject a second concurrent gesture. The audit records actual recognizer state, device/interface orientation, Frame loading, page identities, Core/UIKit history, page transforms and native resource counts. It adds no input simulation to the demo and no per-frame JS to the library.

- Suspension happens with the edge recognizer in its changed state and one active native transition. Cancellation completes before the scheduled finger lift. Foreground restores the same page/history with one Jolt recognizer; the next gesture must emit Jolt's drag, release and completed events. A successful default UIKit swipe alone cannot pass.
- Device orientation really changes while the finger is held. On this iOS 26.2 configuration UIKit defers the **interface** rotation until the partial return cancels and settles. The audit verifies landscape/portrait geometry and the subsequent Jolt pop. This is not evidence of immediate viewport cancellation during a drag.
- The final fresh push/button return works. Settled page transforms are identity, Core retains its navigation delegate, and final active-transition/recognizer counts are zero. UIKit's provisional stack during a drag is checked against Core only after settlement.
- Evidence: [lifecycle audit](results/interactive-navigation/2026-10-29-lifecycle-ios.json) and [existing regression rerun](results/interactive-navigation/2026-10-29-regression-ios.json). The verifier rejects the pre-fix background report and deliberate owner, history, transform and resource corruptions.
- Five additional host cases cover temporary unload/reload, removal of the Frame or route, repeated suspension, and pending-work/subscription cleanup. All 1,442 tests in 92 files pass, including 24 interactive-navigation cases. Library and benchmark typechecks, production inspector exclusion, documentation media checks and documentation build pass.

The two English clips (`interactive-background-ios` and `interactive-rotation-ios`) are embedded with translated captions in all four guides; previous EN/PT recordings are retained. They use the iPhone 17 **simulator**, iOS 26.2, a Release build with HMR disabled, NativeScript Core 9.1.3 and `vue-router-ns` 0.1.0-rc.2. H.264 conversion preserves the original timing at 30 fps. Full-duration frames are reviewed and both files decode without errors. No Android behavior or physical-device performance is claimed for this iOS lifecycle fix. Arbitrary modal dismissal remains outside this slice of #26.
