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

Physical iOS/Android frame-time percentiles, missed deadlines, input latency and process-memory measurements, with an equivalent `scrollLinked()` baseline, are **not measured here**. Native-source counters and resource disposal are correctness evidence, not that performance comparison. Large-text line sizing, VoiceOver/TalkBack traversal, app-owned extra insets, pull-to-refresh, nested same-axis scroll, paged tabs and other list plugins need their own device matrix. These omissions do not block this simulator/emulator correctness delivery; no physical-device performance claim is made.

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
