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

## Safe areas on iOS (#267, 2026-10-31)

Core reports `getSafeAreaInsets()` in device pixels on iOS; the recipe treated them as DIPs, so a full-window host on an iPhone 17 Pro simulator (402×874 pt, 3×) received `{ top: 186, bottom: 102 }` instead of 62 and 34, sized the panel to 586 and started it 186 pt down. Core also lays a layout's children out inside its own insets, so adding the top inset as a panel margin moved the panel down twice. `hostInsets()` now converts the insets, the top inset only positions the panel beyond what the host already applies, and a `safeArea.top` override can only add to that placement. The panel ignores Core's safe-area adjustments itself (`iosIgnoreSafeArea`, restored on disposal) so its frame stays where the geometry puts it. When the host leaves the bottom edge reachable (no inset of its own, as with an edge-to-edge host that passes the page insets through `safeArea`), the panel grows by the bottom inset and receives that much bottom padding, so it reaches the window edge while its rows stay above the home indicator; a keyboard overlap replaces that extension. A host whose children Core keeps inside the safe area still ends at its bottom inset, because Core clamps a child's height to that box.

The demo gains two launch variants of the same Layers card: `--sheet-safe-area=inset` mounts the host over the whole page with Core's default inset handling and no `safeArea` override, and `--sheet-safe-area` (edge to edge) gives the host `iosIgnoreSafeArea` with negative margins equal to the window insets and passes those insets as `safeArea`, the configuration an app uses to cover the home indicator. Both use a `100%` snap. The checks measure the presented panel frame: the content snap starts at the host bottom minus the bottom inset minus the content height, the full snap starts at the top inset, the panel's frame reaches the window edge (edge to edge) or the host's bottom inset (default host), the list's bottom stays above the inset, and with the keyboard shown the panel bottom meets the keyboard top in window coordinates; each run records the measured insets, the panel frame, its padding and the keyboard height.

| Variant (iOS 26.0 simulator, iPhone 17 Pro)                  | Insets top / bottom | Content snap panel top | Full snap panel top / height | Keyboard panel height | Result |
| ------------------------------------------------------------ | ------------------: | ---------------------: | ---------------------------: | --------------------: | ------ |
| [`inset-host`](results/bottom-sheet/ios.json)                |               0 / 0 |                      — |                            — |                     — | 10/10  |
| [`full-window`](results/bottom-sheet/ios-full-window.json)   |             62 / 34 |                    460 |                     62 / 778 |                   467 | 5/5    |
| [`edge-to-edge`](results/bottom-sheet/ios-edge-to-edge.json) |             62 / 34 |                    460 |                     62 / 812 |                   467 | 5/5    |

Android reports zero insets and keeps the page inside the system bars, so the three variants coincide; the [inset-host](results/bottom-sheet/android.json), [full-window](results/bottom-sheet/android-full-window.json) and [edge-to-edge](results/bottom-sheet/android-edge-to-edge.json) reports from the Android 16 / API 36 emulator pass the same checks with a window of 914 dp, a host 52 dp below the window top and a 336 dp keyboard. The unit suite covers the pixel conversion, the placement against the host's own inset, the extension and its removal under the keyboard, and the content measurement without the extension padding. The new iOS recording in the guide (`bottom-sheet-safe-area-ios`) shows the edge-to-edge variant with real XCTest taps; Android is unchanged and keeps its existing clip.

## Reproduce

Build and install the normal demo sequentially for each platform with `JOLT_BENCHMARK=1`, as described in `CONTRIBUTING.md`. Launch it with `--bottom-sheet --bottom-sheet-checks --sheet-run-id=YOUR_ID` on iOS; use equivalent `am start --es` extras on Android. Read `bottom-sheet-checks.json` from the application's Documents/files directory and check its run ID.

```sh
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR_UUID /tmp/JoltSheetIOS testBottomSheet
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR_UUID /tmp/JoltSheetIOS testBottomSheetSafeArea
# Safe-area checks: add --sheet-safe-area=inset or --sheet-safe-area to the launch
# arguments above (string extras on Android) and read the same report.
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

## Handle actions follow the stops (#268, 2026-10-31)

`sheetActions()` installed Expand, Collapse and Dismiss on every handle. With `snap: ['content']` Expand did nothing and Collapse dismissed, so screen readers announced two actions that duplicated Dismiss or were inert, and the spoken value was the raw stop name or the English word `Closed`. The handle now offers Expand only where a larger stop exists and Collapse only where a smaller one exists, re-installing the set when the selected stop or the stops change; Dismiss stays while the sheet is dismissible, so a single-snap dismissible sheet keeps only Dismiss and a non-dismissible one exposes no custom action. `accessibility.value(point)` formats the spoken value per stop, with `null` when closed; without it the stop name is spoken and nothing for a single stop. The native accessibility stage of the checks now reads the handle's custom actions on both platforms and requires `Expand, Collapse, Dismiss` at `50%`, `Collapse, Dismiss` at `90%` and `Expand, Dismiss` at `content`, where the spoken value must be `content`. Reports: [iOS](results/bottom-sheet/ios-actions.json), [Android](results/bottom-sheet/android-actions.json). The unit suite covers the single-snap sets, the per-stop updates and the value formatter. No recording accompanies this change: the action set is a screen-reader contract with no on-screen counterpart, and the demo's visible behavior is unchanged.
