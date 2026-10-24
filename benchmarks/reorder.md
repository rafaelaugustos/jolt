# Reorder validation

Issue #58 adds the optional `@rafaelaugusto/jolt/reorder` entry point. The initial adapter is a flat vertical Core ListView with variable row heights. The app applies one `{ key, beforeKey }` move after a changed drop. It does not receive Jolt pointer/display-frame callbacks.

The production demo was built locally for the dedicated iOS 26 simulator and Android API 36 emulator on 2026-10-24. These are simulator/emulator checks, not physical-device performance results or a full VoiceOver/TalkBack navigation audit. Native accessibility actions are invoked through their installed native handlers; keyboard checks inject actual Option/Alt+Down input.

## Coverage

The 200-item playlist uses stable identities and 100/120-DIP row extents (including spacing). Native measurements and commit/cancellation reports are in `results/reorder/`.

- Drag a row through unequal heights and emit one committed move.
- Hold at the bottom edge until the original cell has left the recycled viewport, then reverse quickly toward the upper edge. The snapshot follows the finger and realized cells restore their opacity/translation.
- Cancel explicitly, remove the dragged identity, and resize the viewport during a held gesture. Each retains the existing application order and emits no stale commit; removal retains 199 unique items.
- Send Android `ACTION_CANCEL` during a drag.
- Repeat native Move down accessibility actions and keyboard commands; both moves must refer to the original stable key after the list rebinds.
- Reduced Motion preserves direct drag and scrolling while suppressing spring/drop transitions.
- Open the normal Android studio and its embedded reorder route; run the Portuguese embedded route on iOS. The preview has 55 localized experiments.

The controller's unit tests also cover filtering, forgotten plain-array refresh at commit, mutation from `onStart`, append/before-key math, unchanged drops, invalid/duplicate keys, ownership, pause/resume, background cancellation and unload/reload/disposal. Native tests cover the cases listed above; they do not establish support for grids, horizontal/cross-list dragging, sections or third-party collection plugins.

## Native implementation

UIKit owns the long-press recognizer, window snapshot, CADisplayLink edge scrolling and Core Animation neighbour springs. The neighbour displacement uses the content layer’s sublayer transform, preserving UIKit-managed cell/content-view frames during height estimation and recycling; native probes compare actual cell frames with table row rectangles. Android owns touch dispatch above recycling (`ReorderSurface`), the bitmap overlay, Choreographer scrolling and damped springs. The JavaScript controller owns keys, lifecycle decisions, accessibility/keyboard commits and application callbacks. Core still binds/creates cells in JavaScript. After a commit, the adapter resolves the key again and reveals/focuses the moved row once; this prevents estimated iOS heights from leaving it outside the viewport after reloadData.

Android needs the list to be the only direct child of `ReorderSurface`. `ReorderHandle` is a focusable native button. The adapter contract is explicit instead of accepting arbitrary list views. Drag snapshots are still images; live video/camera/GPU-backed previews are not supported.

## Reproduce

Build/install the normal Vue demo sequentially for each platform with `JOLT_BENCHMARK=1` (see `CONTRIBUTING.md`). Use dedicated devices and explicit IDs:

```sh
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR_UUID /tmp/JoltReorderIOS testReorder testReorderCancellation testReorderActions testReorderFast testReorderPortuguese
python3 benchmarks/gesture-input/build.py /tmp/JoltReorderInput
python3 benchmarks/docs-record-reorder-android.py YOUR_ADB_SERIAL /tmp/JoltReorderAndroid /tmp/JoltReorderInput/gesture-input.jar
```

`--reorder-lab` selects the isolated English demo, `--reorder-checks` adds cancellation/native-action probes, and `--reorder-audit` writes geometry/identity reports without adding controls. Android uses equivalent string intent extras. Audit files exist only with those explicit flags: iOS Documents, Android app-private files and the app's external-files directory. No production Jolt API writes these reports.

The shell-only Android input helper is not packaged in the library. Its runner restores touch indicators and bounds individual ADB commands. The local iOS capture runner keeps XCTest logs/result bundles and skips the automatic verbose sysdiagnose collection, which otherwise took several minutes after an assertion failure. No GitHub workflow or native CI job is added or expanded.

Recordings in both language guides use real OS input and original playback timing. H.264 exports are reviewed across the full interaction and decoded before delivery. The Portuguese preview clip demonstrates the embedded presentation separately from the isolated fixtures.
