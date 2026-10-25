# Shared layout validation

Issue #57 adds the optional **@rafaelaugusto/jolt/shared-layout** entry. The initial adapter moves static images and plain container snapshots between layouts in one page/window. It is a development preview for beta.18; beta.17 packages do not contain it.

Production demo builds were exercised on a dedicated iOS 26 simulator and Android API 36 emulator on 2026-10-25. These are native simulator/emulator checks, not physical-device performance measurements or a full VoiceOver/TalkBack audit.

## Coverage

The fixture replaces the tab underline between three parents and replaces a 70-DIP mini-player cover with a 195-DIP expanded cover. The embedded collection uses a smaller cover to fit below its navigation header.

- Actual XCTest/ADB taps move tabs, expand/collapse the player, and reverse after 140 ms. Completed native callbacks are required; a fallback that merely changes the UI does not pass.
- While a deliberately slow flight is active, a separate control remains tappable and reports two native overlays. After completion, overlays are zero and the destination views are visible.
- Explicit cancellation, missing destination, Reduced Motion, rotation during flight, and background/resume restore the current app layout and remove overlays. Each checks the specific completion reason.
- The Portuguese embedded route demonstrates localization and page chrome separately from the isolated English fixtures.
- Controller tests cover identity replacement, stale detachers, source unload, duplicate/overlapping identities, a missing layout deadline, partial capture cleanup, failed layout scheduling, invalid physics, interruption velocity, aggregate completion and manual pause across suspension.

Native results are in **results/shared-layout/**. Safe-area and density conversion are exercised by these fixtures. Scroll offsets and uniform ancestor transforms are handled by native window-coordinate conversion; arbitrary scroll hierarchies, accessibility traversal and transform combinations have not been exhaustively tested.

## Native boundary and limitations

JavaScript owns registration, app mutation, layout coordination and curve sampling. UIKit CALayer snapshots/window views and Android bitmap/ViewGroupOverlay snapshots own capture and rendering. CADisplayLink/Choreographer evaluate the prepared tracks and inspect destination geometry without JavaScript calls per display frame. Setup and snapshots still cost UI-thread time, and blocking NativeScript's UI thread can delay native playback.

Container snapshots crossfade at their original content size; image snapshots scale uniformly. The blend uses an isolated additive composite so opacity does not dip while the two captures overlap. Original views are hidden during playback. Visibility leases are restored once on disposal; replica views cannot consume input or accessibility focus.

Endpoints must be fully visible, opaque, axis-aligned and in one window. Positive uniform scale and translation are supported. Rotation, skew, perspective, nonuniform/negative scale, partially clipped endpoints, native blur, scroll/list containers as captured content and unsupported video/camera/GPU surfaces fall back to the application layout. Snapshot storage has an aggregate pixel budget and a maximum of eight identities. Content remains frozen during playback.

## Reproduce

Build/install the normal Vue demo sequentially with **JOLT_BENCHMARK=1**, as described in CONTRIBUTING.md. Select dedicated devices explicitly:

```sh
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR_UUID /tmp/JoltSharedIOS testSharedLayout testSharedLayoutChecks testSharedLayoutPortuguese
python3 benchmarks/shared-layout-android.py YOUR_ADB_SERIAL /tmp/JoltSharedAndroid
```

**--shared-layout** selects the isolated demo. **--shared-layout-checks** adds native lifecycle probes, while **--shared-layout-audit** writes reports without visible controls. Android uses equivalent string intent extras. Reports are written only with these explicit fixture flags: iOS Documents and Android app-private/external-files directories. No public Jolt API writes audit files.

The iOS runner retains XCTest logs and its result bundle. Android stores per-case JSON and restores rotation/touch-indicator settings. The exported H.264 clips preserve the capture timing, were decoded successfully, and were reviewed across the entire interaction and during the moving cover/underline. Both language guides embed all three recordings. No GitHub workflow or native CI job is added or expanded.
