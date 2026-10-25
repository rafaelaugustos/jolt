# Native scroll composition: first Core ListView adapter

Issue #116 remains open for physical-device acceptance. This milestone is a flat Core 9.1.3 ListView with one non-accessible spacer and fixed-height data rows, plus retained overlay siblings. The reference is preview 66, **Made to scroll**, available in English, Portuguese, Spanish and Simplified Chinese. The library API is renderer-independent TypeScript; the Vue screen supplies templates/data and the locale picker.

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

Physical iOS/Android frame-time percentiles, missed deadlines, input latency and process-memory measurements, with an equivalent `scrollLinked()` baseline, are **not measured here**. Native-source counters and resource disposal are correctness evidence, not that performance comparison. Large-text line sizing, VoiceOver/TalkBack traversal, app-owned extra insets, pull-to-refresh, nested same-axis scroll, paged tabs and other list plugins need their own device matrix. Do not close #116 or label its physical-device acceptance complete from this PR.
