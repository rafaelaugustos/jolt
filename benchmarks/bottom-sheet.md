# Bottom-sheet validation

The optional in-page recipe for #59 is intended for beta.17. These results use the normal Vue demo built with production JavaScript and the native code in this branch, not the published beta.16 runtime.

## Native checks

On 2026-10-23, all ten checks passed on the dedicated iOS 26.0 simulator and Android emulator. The reports in `results/bottom-sheet/` contain native presentation positions, expected geometry and tolerances (DIPs).

- Opening to a percentage snap and resolving a short content snap to its intrinsic height.
- Reopening during a close without resetting the visible position.
- Growing content while retaining the logical snap and current position.
- Resizing the usable host, then restoring its size.
- Showing the software keyboard without losing input focus/text or covering the field.
- Hiding the keyboard and restoring the selected snap.
- Invoking native accessibility Expand and Collapse actions.
- Reduced Motion.
- Unloading/reloading with exactly one gesture session; disposal returns the native node count to baseline and preserves existing ScrollView listeners.

A short list exposed a stretched-content measurement problem during video review. The recipe now owns/restores top alignment for the content snap. Both native reports include the short-list regression.

Android custom actions also required installing the AndroidX delegate after NativeScript's deferred accessibility update. The recipe wraps the existing delegate, reserves unused custom-action IDs, and removes only its own actions.

## Real input and recordings

`DocsTests.testBottomSheet` injects XCTest input on iOS. `docs-record-bottom-sheet-android.py` injects Android OS input through ADB. Both exercise content growth, panel-to-list dragging and return, a fast release interrupted by a stationary touch, keyboard editing, dismissal, and portrait/landscape rotation. The Android recording also uses Back to hide the keyboard and then dismiss the panel. Rotation assertions run after the recorded portrait interval.

The test-only pointer helpers are never packaged in Jolt. The iOS helper uses XCTest's private event-path interfaces to deliver the precisely timed second contact; Android uses a shell-only input injector.

The English and Portuguese guides embed the native recordings. Compression preserves playback timing. These are simulator/emulator demonstrations, not physical-device performance or full VoiceOver/TalkBack audits. Programmatic native accessibility checks do not establish complete screen-reader navigation coverage.

## Reproduce

Build and install the normal demo sequentially for each platform with `JOLT_BENCHMARK=1`, as described in `CONTRIBUTING.md`. Launch it with `--bottom-sheet --bottom-sheet-checks --sheet-run-id=YOUR_ID` on iOS; use equivalent `am start --es` extras on Android. Read `bottom-sheet-checks.json` from the application's Documents/files directory and check its run ID.

```sh
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR_UUID /tmp/JoltSheetIOS testBottomSheet
python3 benchmarks/gesture-input/build.py /tmp/JoltSheetInput
python3 benchmarks/docs-record-bottom-sheet-android.py YOUR_ADB_SERIAL /tmp/JoltSheetAndroid /tmp/JoltSheetInput/gesture-input.jar
npm test
npm run typecheck
npm run build
npm run benchmark:typecheck
npm run docs:check-media
npm run docs:build
```

The Android input build needs `ANDROID_HOME`, Java 17 and SDK/build-tools 36. The recording script restores touch indicators and rotation settings on completion or failure.

Native modal presentation and virtualized-list integrations remain outside this recipe. The separate native CI optimization in PR #201 is deferred; it is not part of this change.
