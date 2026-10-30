# Native scroll composition: first Core ListView adapter

Simulator/emulator validation is accepted for this delivery; broader adapter work is tracked in #116. This milestone is a flat Core 9.1.3 ListView with one non-accessible spacer and fixed-height data rows, plus retained overlay siblings. The reference is preview 66, **Made to scroll**, available in English, Portuguese, Spanish and Simplified Chinese. The library API is renderer-independent TypeScript; the Vue screen supplies templates/data and the locale picker.

## Reproduce

Build the normal demo in release mode with `JOLT_BENCHMARK=1`; the app is `org.nativescript.jolt.benchmark`. See [layout build/signing setup](./layout-lifecycle.md). Build iOS and Android sequentially. Use dedicated, explicitly assigned devices. No workflow or CI timeout was added for these local interactive checks.

```sh
# XCTest injects real drag, reversal, fling, taps and lifecycle input.
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR_UUID /tmp/JoltScroll \
  testScrollHeaderChecks testScrollHeader testScrollHeaderPortuguese \
  testShowcaseExtraLanguageChecks testShowcaseExtraLanguages
# Copy Documents/jolt-scroll-header.json from the app container to /tmp/ios.json.
python3 benchmarks/verify-scroll-header.py /tmp/ios.json

# ADB injects actual OS touch/scroll input. Select the intended language first.
python3 benchmarks/scroll-header-android.py YOUR_EMULATOR /tmp/JoltScroll audit
python3 benchmarks/verify-scroll-header.py /tmp/JoltScroll/android.json
python3 benchmarks/scroll-header-android.py YOUR_EMULATOR /tmp/JoltScroll record en
# Select Português in the preview, then:
python3 benchmarks/scroll-header-android.py YOUR_EMULATOR /tmp/JoltScroll record pt-BR
```

The audit launch flag (`--scroll-header-audit` on iOS; string intent extra on Android) exposes snapshot/Reduce Motion/short/empty controls and writes boundary diagnostics. It does not drive the gesture or call app handlers from the test. Normal recordings omit this flag. Real input sequences are replayable in the checked-in XCTest and Android runner; the JSON artifacts are observations, not synthetic performance traces from the general gesture recorder.

## Observed results, 2026-10-25

Release builds, iOS 26.2 iPhone 17 simulator and Android 16 / API 36 emulator. Files in [results/scroll-header](./results/scroll-header) contain actual row rectangles, native presentation transforms and boundary counters.

| Check                                                      | iOS simulator                                                                             | Android emulator                               |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Drag, reversal and fling                                   | Passed; minimum observed offset −41 DIP                                                   | Passed; ordinary no-stretch edge behavior      |
| Async cover + multiline title while scrolled               | Same realized keys retain their screen coordinates within 1 DIP                           | Same assertion passed                          |
| Insert one row above the viewport                          | Offset advances by one row stride; same keys stay in place                                | Includes rounded row pixels and native divider |
| Native scroll-to-item and recycled tap                     | Data index 35 aligns below toolbar/section; tap resolves stable `song-35` after insertion | Same assertion passed                          |
| Virtualization at long scroll                              | First native row >20; fewer than 15 visible rows out of 82                                | Same bounds                                    |
| Updates / semantic phase callbacks at long-scroll snapshot | 324 / 3                                                                                   | 188 / 3                                        |
| Short/empty + Reduce Motion                                | 3 / 1 native rows including spacer; parallax/stretch off; real content bounds             | Same assertions                                |
| Rotation / suspension                                      | Portrait → landscape → portrait, then Home/activate                                       | Home/activate; rotation not exercised          |
| Leaving the screen                                         | Native source count 0; live node count 0                                                  | Native source count 0; live node count 0       |

The native graph updates without a JS scroll callback. Layout/data changes, cell realization, lifecycle and coarse state callbacks still enter JS. Counters measure this adapter's source and phase callback, not every callback in Core or the app. The verifier checks actual recycled row positions against the pinned geometry, not only the formula used by the controller. Host tests cover invalid owners/geometry, anchors, reload, suspension and layout cancellation.

The recordings are original-speed H.264 captures inspected across their duration. They show simulator/emulator behavior only. Native theme/language changes and physical-pixel differences can change the exact counters and offsets while the invariants remain the same.

## Why a spacer and a delegate proxy

Android Core `ListView.refresh()` expects its own adapter, and its item indices assume no native `addHeaderView` wrapper. A real spacer row keeps the adapter and indices consistent. Root cell `height` alone is reset in Core's automatic sizing mode, so the recipe fixes min/max height. The adapter includes row rounding and divider pixels. Native `ViewTreeObserver` scroll/layout observation preserves Core listeners and callbacks.

iOS automatic estimates changed the apparent scroll anchor after `reloadData` in the first prototype. The per-list delegate proxy now returns exact spacer/data heights and forwards other delegate methods. KVO supplies canonical offset input; the list's data source and insets stay owned by Core. Disposal restores the prior delegate only when this proxy still owns it. This avoids both a separate scroll container and per-frame layout writes. Variable-height data rows need a different adapter; this implementation does not claim general sliver/reflow support.

## Remaining acceptance

Physical iOS/Android frame-time percentiles, missed deadlines, input latency and process-memory measurements, with an equivalent `scrollLinked()` baseline, are **not measured here**. Native-source counters and resource disposal are correctness evidence, not that performance comparison. The large-text settings validated below cover a bounded part of line sizing. Other text scales, VoiceOver/TalkBack traversal, app-owned extra insets, pull-to-refresh, nested same-axis scroll, paged tabs and other list plugins need their own device matrix. These omissions do not block this simulator/emulator correctness delivery; no physical-device performance claim is made.

## Resize and lifecycle regression checks, 2026-10-29

The same release-mode demo now exercises a native list removal/reinsertion while
`remeasure()` is pending, portrait → landscape → portrait on both platforms, and
navigation immediately after a fling followed by reopening the screen. The
additional English recordings are embedded in all four guide locales; the
original recordings remain available.

The controller retains layout invalidations received during a pending measurement,
waits for anchor restoration before publishing `ready`, and preserves the intended
offset if unloading interrupts Android's asynchronous selection. Geometry is only
committed after the new spacer has been laid out. On iOS, automatic section
header/footer estimates caused a reproducible 20-DIP drift on rotation even with
exact row heights. Disabling those estimates for this flat list removes the drift;
the adapter restores their prior values when disposed unless the app changed them.

| Check                                         | iOS 26.2 / iPhone 17 simulator                    | Android 16 / API 36 emulator                      |
| --------------------------------------------- | ------------------------------------------------- | ------------------------------------------------- |
| Native unload/load during pending measurement | Reconnects; offset 3003.33 DIP before and after   | Reconnects; offset 3020.95 DIP before and after   |
| Landscape spacer / offset change              | Both −173.33 DIP; same realized rows within 1 DIP | Both −188.57 DIP; same realized rows within 1 DIP |
| Return to portrait                            | Original offset and row positions restored        | Original offset and row positions restored        |
| Exit after fling                              | Zero native sources and live nodes after disposal | Zero native sources and live nodes after disposal |
| Reopen and scroll                             | One source, one live node, positive scroll offset | One source, one live node, positive scroll offset |

The iOS input trace releases a moving touch at 165 ms and presses Back at 220 ms,
without XCTest's animation-idle wait between them. Android caches the Back button's
bounds before the gesture and submits a swipe followed immediately by a tap in the
same ADB shell command. These are real OS inputs. They do not establish physical
device latency or frame-time results. Vue's unmount hook can run after the native
list is gone, so the optional `decelerating` diagnostic may be absent at disposal.

Reproduce the additional checks after installing the normal release demo:

```sh
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR_UUID /tmp/JoltScrollChecks testScrollHeaderChecks
# Save Documents/jolt-scroll-header.json as /tmp/JoltScrollChecks/ios.json before the next launch.
python3 benchmarks/verify-scroll-header.py /tmp/JoltScrollChecks/ios.json
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR_UUID /tmp/JoltScrollLifecycle testScrollHeaderLifecycle
# Save Documents/jolt-scroll-header-disposed.json as lifecycle-ios.json and
# Documents/jolt-scroll-header.json as reentry-ios.json in /tmp/JoltScrollLifecycle.
python3 benchmarks/verify-scroll-header.py /tmp/JoltScrollLifecycle/lifecycle-ios.json \
  --lifecycle /tmp/JoltScrollLifecycle/reentry-ios.json

python3 benchmarks/scroll-header-android.py YOUR_EMULATOR /tmp/JoltScrollChecks audit
python3 benchmarks/verify-scroll-header.py /tmp/JoltScrollChecks/android.json
python3 benchmarks/scroll-header-android.py YOUR_EMULATOR /tmp/JoltScrollLifecycle lifecycle
python3 benchmarks/verify-scroll-header.py /tmp/JoltScrollLifecycle/lifecycle-android.json \
  --lifecycle /tmp/JoltScrollLifecycle/reentry-android.json
```

The lifecycle recordings intentionally expose the audit-only **Reload** control.
It removes and reinserts the real native ListView; it does not synthesize an app
lifecycle event. The Android runner restores the original rotation and touch
indicator settings. Artifacts prefixed `2026-10-29-` in
[results/scroll-header](./results/scroll-header) preserve the final observations.
These checks complete the resize/lifecycle correction with simulator/emulator
acceptance. Broader adapter and accessibility work remains tracked in #116.

## Large system text and long titles, 2026-10-29

Release builds on the dedicated iPhone 17 / iOS 26.2 simulator and Pixel 6 / Android
16 (API 36) emulator change the **actual OS font setting while the page is open**.
iOS uses `large` → `accessibility-medium` → `large`; Android uses `font_scale`
1 → 2 → 1. Both runners save and restore the original setting, reject stale
reports and run `verify-scroll-header-text.py` after capture.

The previous resize policy preserved absolute row coordinates, allowing a growing
compact toolbar to cover the current row. Collapsed resizing now preserves the
row's distance from the bottom of the pinned toolbar/section, using the change in
collapse range. Partially expanded resizing retains the spacer-delta policy; the
top remains zero. A negative-control run of the new host regression against the
old formula moved the row 80 DIPs behind the pinned edge.

The native checks also exposed two platform details. Core's default `clipToBounds`
can report true while its plain iOS UIView still has clipping disabled; the owner
now explicitly applies and restores that native clip. Android `smoothScrollBy`
stopped short of the requested long-distance target in the first captured run;
the driver now uses `smoothScrollToPositionFromTop` with the exact item and offset.
The regression checks below exercise both return-to-top and data index 35.

The demo opts into iOS Dynamic Type. Its Android Activity handles `fontScale`, and
a screen-scoped listener reapplies retained Label sizes in SP on the next turn,
after the Activity's resources update. Recycled cells receive the current SP size.
Android retains its nonlinear scaling; no multiplier is imposed by Jolt. The
listener and pending update are removed on unmount. The intrinsic-height hero can
exceed the viewport, which clips it while the ListView spacer supplies the scroll
extent. Hero descendants do not reapply the iOS safe area already owned by the
parent. The compact title wraps; controls and number/duration columns size to text.

| Observation                                                   | iOS simulator                                         | Android emulator                                  |
| ------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------- |
| Expanded title native font, normal → enlarged                 | 45 → 90 pt                                            | 45 → 51.29 DIP after SP conversion                |
| Compact title native font                                     | 20 → 40 pt                                            | 20 → 34 DIP after SP conversion                   |
| Compact toolbar, normal / enlarged / long enlarged / restored | 64 / 68 / 115.67 / 64 DIP                             | 64 / 65.90 / 99.81 / 64 DIP                       |
| Expanded long header                                          | 782 DIP, including the complete measured title        | 468.57 DIP, including the complete measured title |
| Collapsed anchor across font/title/restoration changes        | `song-36`, within 1 DIP of the pinned bottom          | Same                                              |
| Top / actual drag / native jump / recycled tap                | Offset zero / positive offset / `song-36` / `song-36` | Same                                              |
| Disposal                                                      | Zero native sources and nodes                         | Same                                              |

Each trace has eight explicit snapshots. The verifier reads native text sizing and
realized row rectangles, requires genuine font growth/restoration and no title
ellipsis or intrinsic clipping, checks native iOS viewport clipping, and rejects
screen recreation. Thirteen offline test cases run in CI, including 23 negative
variations across the two captured reports. The existing native audit and lifecycle
sequences are rerun on both platforms; their new observations are stored alongside
the large-text traces. The lifecycle XCTest now snapshots landscape explicitly:
a correctly unbounded hero can retain its height after rotation, so a geometry
change callback alone is not evidence that landscape was captured. The Android
runner retries a transient null accessibility root instead of reusing stale
coordinates from before rotation.

```sh
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR_UUID /tmp/JoltLargeTextIOS testScrollHeaderLargeText
python3 benchmarks/scroll-header-android.py YOUR_EMULATOR /tmp/JoltLargeTextAndroid large-text
python3 -m unittest discover -s benchmarks -p 'test_scroll_header_text.py'
```

The reviewed English recordings, embedded in all four guide locales, retain
original timing: 28.8 seconds on iOS and 47.6 seconds on Android. They show the
same row before and after font/title changes, return to the top, real scrolling,
native jump/tap, restoration and navigation. Both decode as H.264 MP4; this is
simulator/emulator correctness evidence. Fixed 76-DIP data rows still use one-line
ellipsis for long track names and expose the full name in accessibility labels.
Other text scales, variable-height rows, VoiceOver/TalkBack traversal and the
physical-device performance matrix remain outside this slice of #116.
