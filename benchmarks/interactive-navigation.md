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

This is lifecycle and route-correctness evidence, not physical-device frame-time or memory profiling. Arbitrary action-bar configurations, RTL input, rotation during a held gesture and system suspension during a held gesture have not been exhaustively exercised by these recordings. Native cancellation hooks handle viewport changes and resign-active notifications; host tests also check suspension cleanup. No workflow or long-running CI job was added.
