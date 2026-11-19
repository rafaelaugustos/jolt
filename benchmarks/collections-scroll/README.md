# Collections and scroll acceptance

Source candidate after RC.15, based on `a37b0f5d45812ccd5091c78d5a19d1169c2b4820`; package version remains unchanged. Owns #495, #496 and #510–513. The previous six are in merged PR #509. No release or merge is performed here.

## Scope and devices

- iPhone 17 Pro / iOS 27 simulator, NativeScript Release build with production JavaScript.
- Pixel 7 / Android API 36 emulator, debug APK with production JavaScript. NativeScript Core 9.1.3; community CollectionView pinned at 6.1.3.
- Standalone SwiftUI on the iOS simulator and the native macOS application; real XCTest pointer/keyboard/wheel input.
- Chromium, Firefox and WebKit on macOS. Real browser input, no generated motion frames.

Recordings are original-speed screen captures. Simulator/emulator tests do not establish physical-device CPU/PSS, frame time, thermal behavior, hardware keyboard or physical trackpad feel. New accessibility acceptance remains deferred; existing alternatives and Reduced Motion are preserved.

## Native acceptance

`native.ts` uses actual Core ListView/ScrollView and community CollectionView widgets with production adapters. `NativeTests.swift` and `record-android.py` inject real OS contacts and assert the saved snapshots.

- 200-row prepend/remove/reverse preserves the first-visible key and intra-row position. Recycling uses current item identity, not the previous occupant of the view.
- Recycled reorder keeps a contact down at one edge for six seconds, reverses for two seconds, and commits the original key once. The accepted iOS run moved `row-100` to index 135 after spanning 3,817 DIP; Android moved it to index 145 after spanning 4,933 DIP. Timing-dependent indices are not cross-platform pixel guarantees. Both exceed two viewports and preserve the final committed key.
- Parent handoff waits for the collection's reorder recognizer. Replacement, active-key removal and explicit cancellation produce no commit. Remount restores one functioning controller; ordinary scrolling remains usable. iOS pending-recognizer reset now releases its scroll lease when another controller wins, so it cannot pin a winning reorder's autoscroll.
- Core ListView, CollectionView and horizontal Core ScrollView expand before scrolling; a reverse contact drains content before collapsing. The final owner receives release velocity.
- Horizontal variable-width LTR/RTL reorder reaches both physical scroll edges and reverses within one contact on iOS/Android. Reduced Motion commits; cancellation, active-key removal and geometry changes restore previews without committing stale data.
- Background interruption cancels active horizontal input before any commit on both platforms. Returning and remounting restores a fresh working controller. The fixture resets to Changes on foreground; the runners verify the preceding cancel in its saved event sequence instead of reading reset scene counters.
- Native sources match the JS Core ScrollView offset at 400 DIP and throughout real movement. iOS negative bounce minima match exactly; horizontal RTL and actual CollectionView also reach the expected physical offset. Android fixed stride must be measured, including spacing. Requested 64 DIP rows measured 49.524 DIP in this plugin/environment; no guessed offset is claimed for variable-height Android lists.
- SwiftUI continuous panel/content transfer and reverse input pass on iOS/macOS. Existing panel acceptance also passes on both: text entry, keyboard handling, controls, suspension/remount and Reduced Motion.

The machine-readable [iOS](./acceptance-ios.json) and [Android](./acceptance-android.json) files contain accepted snapshots and bounded raw timing samples. They deliberately identify the candidate rather than attributing new behavior to the published RC.15 baseline.

## Matched producer timing

Each source drives the same five bindings: x, y, rotation, scale and opacity, through the same mapping graph. The fixture displays both variants on the same Core ScrollView. Timing is opt-in and bounded at 256 changed events; there is no profiling allocation in normal native sources. iOS uses `CACurrentMediaTime`, Android `System.nanoTime`, and JS the runtime's monotonic `performance.now`.

The measured region is source offset/velocity production plus `setDataInput` or JS `root.set`. It **does not include later native graph evaluation, drawing or total UI-thread work**. The JS path includes its synchronous propagation. This measures the bridge/source work targeted by #495, not end-to-end frame cost; the old 0.25–0.3 ms observation is context, not an identical historical experiment. Both sources run simultaneously here, so no isolated throughput ratio is claimed. Android remains on the UI thread.

| Platform | Axis     | Changed samples | Native median / p95 (ms) | JS median / p95 (ms) | Native / JS callbacks |
| -------- | -------- | --------------: | -----------------------: | -------------------: | --------------------: |
| ios      | Y source |              94 |        0.00529 / 0.01096 |    0.30750 / 0.50300 |                0 / 96 |
| ios      | X source |              99 |        0.00758 / 0.00946 |    0.36900 / 0.52500 |               0 / 101 |
| android  | Y source |              42 |        0.00158 / 0.00725 |    0.27500 / 7.51000 |                0 / 44 |
| android  | X source |              37 |        0.00175 / 0.00542 |    0.27300 / 3.61100 |                0 / 39 |

Counts include baseline callbacks whose offset did not change, while timing samples include only changed events. One observation per scenario is a reproducible acceptance sample, not a statistical hardware benchmark. The native path records zero per-event JS callbacks.

## Browser reuse and limits

The existing `values-scroll-lists` suite passes 27 cases across all three engines, including the explicit 200-row virtualizer, anchoring and recycling notification. Existing scrollValue/nested-scroll behavior is reused; these native adapters do not create another Web API.

The gestures suite verifies variable-width horizontal LTR/RTL order, both edge directions, Escape and retained input ownership. Changing a DOM target during drag cancels before a stale key commits, then a fresh drag works. Native realized reorder uses explicit logical direction; Web reads the container's CSS direction. A direction change during active Web contact cancels as geometry change.

Web reorder owns the supplied realized rows, not a virtualizer. Pin that window during a continuous drag, or accept cancellation on recycling. Never claim native RecyclerView recycling support for arbitrary changing DOM windows.

## Reproduction and review

Install root, Angular and native fixture dependencies as in [CONTRIBUTING](../../CONTRIBUTING.md), then `npm run build`. Use `--env.production --env.collectionsScroll --no-hmr`, sequential native builds, and dedicated devices. If Java method metadata is stale, clean the generated Gradle build before rebuilding; an existing AAR alone does not prove the installed metadata is current.

```sh
python3 benchmarks/gesture-input/build.py /tmp/jolt-collections-input
python3 benchmarks/collections-scroll/record-ios.py IOS_SIMULATOR_ID OUTPUT
python3 benchmarks/collections-scroll/record-android.py emulator-SERIAL OUTPUT /tmp/jolt-collections-input/gesture-input.jar
python3 benchmarks/collections-scroll/record-android.py emulator-SERIAL EDGE_OUTPUT /tmp/jolt-collections-input/gesture-input.jar edges
python3 benchmarks/swiftui-demo/record.py IOS_SIMULATOR_ID SWIFT_OUTPUT sheet-continuity
python3 benchmarks/swiftui-demo/record.py macos MAC_OUTPUT sheet-continuity
node benchmarks/collections-scroll/record-web.mjs
```

The scripts save capture logs and native result bundles outside Git. Decode complete MP4s and inspect representative frames before uploading. Captions in the four-language [guide](../../docs/guide/collections-scroll.md) identify platforms and limits; English recordings are attached as playable PR videos. No Portuguese PR attachments are produced.

## Validation

TypeScript: 1,884 tests in 142 files pass. Swift: 103 SwiftUI and 39 Core tests pass. Browser gestures: 62 pass and four existing multi-touch injection skips; values/scroll/lists: 27 pass. Packed React/Angular/Svelte/Solid/Vue consumers, strict NodeNext/Bundler declarations, SSR and NativeScript production bundles pass. Core boundaries, Web SSR import graph, generated Swift definitions and the capability matrix pass. Native real-input results and four-language documentation media are reviewed separately.
