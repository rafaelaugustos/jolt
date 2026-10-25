# Interactive shared image/card navigation (#24, stage 2)

`sharedNavigationEntry` composes the existing native iOS page transition and Android predictive-back driver with the native shared-layout flight. Only setup, lifecycle and application routing cross the JS bridge; native gesture progress and spring frames drive both the image/card and page presentation. This stage covers stable retained pages. It does not close #24: recycled/offscreen resolution and gallery coordination remain follow-ups.

## Reproduce

Build the library and normal release preview with `JOLT_BENCHMARK=1`, `--env.production` and `--no-hmr`; install only on explicitly assigned devices. Build platforms sequentially. See `CONTRIBUTING.md` for signing, Ruby and recording setup.

```sh
python3 benchmarks/docs-record-ios.py YOUR_ASSIGNED_SIMULATOR /tmp/JoltSharedEntry \
  testSharedEntry testSharedEntryPortuguese testSharedEntryChecks
ANDROID_HOME=/path/to/sdk python3 benchmarks/gesture-input/build.py /tmp/JoltInput
adb -s YOUR_ASSIGNED_EMULATOR push /tmp/JoltInput/gesture-input.jar /data/local/tmp/jolt-predictive-input.jar
python3 benchmarks/shared-entry-android.py YOUR_ASSIGNED_EMULATOR /tmp/JoltSharedEntry audit
python3 benchmarks/shared-entry-android.py YOUR_ASSIGNED_EMULATOR /tmp/JoltSharedEntry record en
```

Android requires API 34+, system gesture navigation and the manifest predictive-back opt-in already tracked in the demo. Select English or Português through the real preview language settings before recording; pass `pt-BR` for the Portuguese output name. Restore the previous language preference afterwards. The recorder restores touch indicators. The input helper injects actual OS input and is never packaged in the app. iOS XCTest likewise injects real taps and edge drags; neither runner invokes app gesture handlers directly.

## Evidence

- iPhone 17, iOS 26.2 **simulator**; Android 16 / API 36, 1080 × 2400 **emulator**. NativeScript Core 9.1.3, vue-router-ns 0.1.0-rc.2, Release/HMR off.
- Four H.264 EN/PT recordings under `docs/public/media/shared-entry*.mp4`, embedded in both language guides and attached to the PR. They show image entry, partial return/cancellation, committed return, card entry/cancellation and the accessible back button. Original playback timing; full-duration contact sheets and intermediate morph frames inspected.
- [iOS audit](results/shared-entry/ios.json): live route identity/depth, shared-pair availability, hidden/visible sources, native flights, active transitions, recognizer count and preserved Core delegate. XCTest checks cancelled and committed image/card returns, page swipe blocking, explicit cancellation during a held gesture, moved source, missing target, reduced motion and disposal followed by ordinary back.
- [Android audit](results/shared-entry/android.json): both-edge cancellation, right-edge completion, card cancellation/button return, a real router guard rejecting, explicit cancellation while held, changed static source fallback, missing target, reduced motion, disposal and application suspension. A ready shared gesture has an active native flight and hidden real detail image. Cancel restores all views and removes the flight while retaining the bounded source scene. Terminal disposal frees retained snapshots and callbacks; all counters return to zero.

The iOS audit's final row is explicit disposal on the still-visible detail page. XCTest then uses ordinary router back and asserts the source exists; that pop has no Jolt owner to emit another audit row. Android suspension likewise disposes the shared owner; after resuming, the ordinary back button returns. Source-page detachment while covered is expected on Android: native children may be rebuilt, so the wrapper validates stable JS identity/content/layout at gesture boundaries and the native scene validates the viewport. A changed source falls back rather than using a new offscreen resolution policy.

## Bounds and regression checks

The shared-entry host suite covers route/setup ordering, synchronous Core navigation, repeated/queued back, one guarded commit, native cancellation, source changes, missing targets, native capture failure, snapshot budget composition, owned versus borrowed programmatic controllers, observer failure, validation, timeout/late completion and lifecycle disposal. The iOS adapter tests check native pair setup, image mismatch and geometry fallback.

Validation: 1,326 host tests in 84 files; library/benchmark typechecks and package build; production inspector exclusion; 336 deterministic Java assertions and five shared spring solver checks; native release builds; both real OS-input audits; documentation media and build checks. No new CI job or workflow.

This is correctness and lifecycle evidence, not physical-device frame-time or total memory profiling. The pixel budget counts retained source content plus flight content and permits conservative fallback. Android uses a static return background; keep that source static while covered. Recycled cells, offscreen targets, live surfaces, native modals, rotation/RTL gesture matrices and hardware performance are not claimed. Application promises remain application-owned; timeout cleanup cannot cancel late navigation.
