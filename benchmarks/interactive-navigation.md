# Interactive Frame navigation on iOS (#26)

The optional `@rafaelaugusto/jolt/interactive-navigation` entry uses Core's custom Transition hooks. Core still owns the navigation-controller delegate and route queue. A native object implements both UIKit animation and interaction protocols, moves live page views, updates the transition context from an edge recognizer, and settles with `JoltSpringAdvance`. JS runs at lifecycle boundaries, never per gesture sample or display frame.

The original delivery covers whole Frame pages and programmatic/interactive return. Custom full-window NativeScript modals are covered by the additional delivery below. Android predictive back belongs to #25; shared image/card navigation has its own composition and evidence.

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

The two English clips (`interactive-background-ios` and `interactive-rotation-ios`) are embedded with translated captions in all four guides; previous EN/PT recordings are retained. They use the iPhone 17 **simulator**, iOS 26.2, a Release build with HMR disabled, NativeScript Core 9.1.3 and `vue-router-ns` 0.1.0-rc.2. H.264 conversion preserves the original timing at 30 fps. Full-duration frames are reviewed and both files decode without errors. No Android behavior or physical-device performance is claimed for this iOS lifecycle fix. Modal integration is a separate implementation, described next.

## Interactive modals — 2026-10-30

`interactiveModal()` completes #26's modal path for Core's custom full-window presentation. Core retains its transitioning delegate, modal parent and close callback; NativeScript-Vue retains its component and unresolved promise until an actual committed dismissal. The new native animator implements UIKit's [animation and interaction protocols](https://developer.apple.com/documentation/uikit/uiviewcontrollercontexttransitioning), receives a real downward pan and settles the live controller view with `JoltSpringAdvance`. It uses Core's existing [custom modal transition hooks](https://docs.nativescript.org/guide/shared-element-transitions), without replacing delegates or patching Core.

Core's cancellation bookkeeping is essential: `interactiveCancelled` is set before UIKit finishes a cancelled dismissal. The handle waits for Core's completion to clear `interactiveBegan` before allowing another close or releasing the transition registry. This prevents an early callback/unmount and keeps ordinary Core close usable after cancellation. Disposal during a held drag follows the same ordering. A close requested during presentation is queued until `shownModally`; duplicates are ignored. `closedModally` owns final release. Core builds without that lifecycle event return an explicit unsupported result. `animated: false` skips UIKit animator creation and uses ordinary noninteractive close, without installing a Jolt pan.

The source exposes boundary events only. Finger movement, display-link ticks, projected release velocity, the spring and original-transform restoration execute in Objective-C. ScrollView descendants and native controls reject modal gesture ownership; `canBegin()` and Core `cancelable: false` provide additional gates. A held gesture cancels on suspension, while the same modal/owner remains available after resume. A decided release completes its existing result. None of these counters establishes presented FPS, CPU cost or total retained heap.

### Reproduction

Build and install the normal Release demo with `JOLT_BENCHMARK=1` on an assigned simulator. The recorded setup is iPhone 17 / iOS 26.2, Core 9.1.3, NativeScript-Vue 3.1.2, router 0.1.0-rc.2, HMR disabled. No physical device is used. Run each audit separately because a new app launch resets its report:

```sh
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR /tmp/JoltModalChecks testInteractiveModalChecks
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR /tmp/JoltModalLifecycle testInteractiveModalLifecycle
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR /tmp/JoltModalRecording testInteractiveModal
python3 benchmarks/verify-interactive-modal.py benchmarks/results/interactive-modal/2026-10-30-checks-ios.json checks
python3 benchmarks/verify-interactive-modal.py benchmarks/results/interactive-modal/2026-10-30-lifecycle-ios.json lifecycle
python3 -m unittest discover -s benchmarks -p 'test_interactive_modal.py'
```

The runner reads fresh `Documents/jolt-interactive-modal.json` observations and invokes the offline verifier. Native XCTest taps/swipes exercise the actual Vue controls. A test-runner-only vertical pointer path holds OS contact while SpringBoard or rotation interrupts the app; it never enters the shipped library. Opt-in diagnostics capture boundary transforms, modal ownership, Vue unmounts, close callbacks, route identity and native resource counts. The normal showcase recording has no diagnostic controls.

### Observed outcomes

| Check                          | Result                                                                                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Cancel then retry              | Original transform restored; modal remains attached/presented, with no close callback or Vue unmount. A new gesture can commit.          |
| Programmatic cancellation      | A real held pan rolls back through `cancel()`; ordinary Core close still calls back once.                                                |
| Duplicate / early close        | First call accepted, second rejected; one callback after presentation/settlement. Arguments reach the callback.                          |
| Reduce Motion                  | Cancellation and committed dismissal remain usable; programmatic motion/settlement is immediate.                                         |
| Dispose idle / during drag     | Gesture resources release while the modal stays open. Core close remains available; no premature callback.                               |
| `cancelable: false` / app gate | Downward input leaves the modal in place without starting a Jolt transition. The close button still works.                               |
| `animated: false`              | No Jolt recognizer; ordinary close completes and releases the handle.                                                                    |
| Scrolling content              | Real up/down ScrollView input changes its offset without starting modal dismissal.                                                       |
| Home during held drag          | Cancellation restores identity transform; same attached modal and one recognizer survive foreground.                                     |
| Rotation during held drag      | UIKit defers visible rotation until cancellation on this setup; actual landscape/portrait, retained modal and subsequent dismissal pass. |
| Final resources                | All committed exits have zero active modal transitions and recognizers, one callback and one Vue unmount per modal.                      |

[Control audit](results/interactive-modal/2026-10-30-checks-ios.json): nine presentations/close callbacks, four cancelled gestures, ten explicit snapshots and zero final native resources. [Lifecycle audit](results/interactive-modal/2026-10-30-lifecycle-ios.json): two presentations/close callbacks, three cancellations, three explicit snapshots covering foreground/landscape/portrait and zero final native resources. The underlying page and Frame depth stay unchanged.

The 22 new TypeScript tests cover Core state ordering, delayed cancellation completion, close queuing/coalescing, disposal, lifecycle, observer exceptions, physics validation and missing native/Core capabilities. The evidence verifier adds 17 tests, including 25 negative variants: premature/duplicate callbacks, lost modal ownership, wrong transforms/routes, missing scroll/rotation, and leaked native resources cannot pass. It runs in the existing host CI job. The existing native Frame audit and background/rotation audit also pass against the changed demo.

The reviewed English `interactive-modal-ios.mp4` and `interactive-modal-lifecycle-ios.mp4` preserve elapsed playback time and decode fully as H.264 at 30 fps. Both are embedded in all four guide locales with platform/limit captions; existing media is preserved. The lifecycle recording includes the actual Home screen and rotated landscape content.

This supplies the original issue's page and modal interaction paths within documented NativeScript contracts. Modal support is for custom full-window Core presentation, not native sheet detents, popovers, foreign UIKit controllers or scroll-to-dismiss handoff. Frame navigation, ordinary modal close and Android fallback retain their own contracts. Physical-device performance and VoiceOver traversal are not established by these simulator tests.
