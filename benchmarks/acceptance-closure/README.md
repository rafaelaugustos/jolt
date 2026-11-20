# RC.16 acceptance follow-up

This audit starts from published RC.16 (`86826449` on `main`, whose tree matches
the release tag). The maintainer requested completion of #385, #414, #415, #416,
#494, #498 and #499, and selected **simulators and emulators only** for new runs.
On 20 November 2026, the maintainer explicitly approved **closing #385, #415 and
#494 with emulated acceptance**, replacing their former physical-device gate for
this batch. Historical physical measurements remain historical evidence; new
simulated runs cannot establish physical accuracy, frame pacing or device cost.
The new native focus correction is a source follow-up, not part of published RC.16.

## Bounded drawings (#414) and rendering activity (#416)

Both implementations shipped through [PR #421](https://github.com/rafaelaugustos/jolt/pull/421)
in RC.12. Their stale pre-merge issue bodies were reconciled and both issues were closed.
No new implementation or performance claim was needed.

| Acceptance                         | Verified evidence                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native and Web drawing contract    | `src/core/drawing.ts`, `src/shapes/drawing.ts`, `src/shapes/drawing-native.ts` and `src/web/drawing.ts`: bounded geometry, unique IDs, ordered replacement, targeted updates, shared styles, local viewBox and explicit resource ownership.                                                                                                   |
| Drawing correctness and cleanup    | `test/drawing.spec.ts` and `benchmarks/web-portable/portable.spec.ts`: invalid updates preserve existing geometry, item order/identity, suspension, remount and disposal. Native chart and indicator recordings show actual interaction.                                                                                                      |
| Drawing cost, limits and densities | [Original physical Android and browser measurements](../portable-foundations-results.md), five measured repetitions per variant/density at 259/512/1,024 items. Android host/update cost improves while CPU increases. Invalid allocation counters remain unavailable. The API is opt-in, with no claim of universal performance improvement. |
| Activity ownership and lifecycle   | `src/core/render-activity.ts`, native/Web adapters and `test/render-activity.spec.ts`: overlapping child owners, delays, explicit application holds, pause/seek, replacement/completion, visibility, final redraw, disposal from callbacks and borrowed playback. Retention alone creates no demand.                                          |
| Actual renderer integration        | Reviewed iOS simulator SceneKit and Chromium WebGL recordings. The three-engine browser suite checks actual uniform changes and a frame counter that remains unchanged at idle.                                                                                                                                                               |
| Physical activity comparison       | [Original physical Android Canvas measurements](../portable-foundations-results.md): median callbacks 79 → 54 and CPU 672 → 528 ms when removing overrun from a guessed stop timer. This is a policy comparison, not a physical SceneKit benchmark or a general CPU claim.                                                                    |
| Documentation and PR recordings    | Six unchanged published `portable-drawing-*` and `portable-groups-*` clips re-downloaded with manifest SHA-256 checks, fully decoded and visually reviewed. All are embedded in EN/PT-BR/ES/ZH-Hans with accurate platform captions and attached to PR #421.                                                                                  |
| Mavis adoption                     | Existing [Mavis #246](https://github.com/getcortexlabs/mavis-ui/issues/246) records the published drawing dependency and component/lifecycle/performance acceptance. No current custom-renderer consumer required a duplicate activity issue. Mavis implementation remains separate.                                                          |

Current-source validation: root build, 45 selected unit tests across drawing,
activity, exits, list focus, lists and sensors, and all 33 portable browser tests
across Chromium, Firefox and WebKit pass. These reruns do not replace or refresh
the historical physical benchmark samples.

## Android browser delivery (#385)

[Raw acceptance](evidence/android-browser-sensors.json) uses actual Chrome 157
inside an Android API 36 arm64 emulator. The emulator's virtual accelerometer and
gyroscope feed Android and Chrome; the page receives trusted `DeviceMotionEvent`
objects. This run does **not** dispatch DOM events or use CDP sensor overrides.
Loopback is a secure context. Each scoped sensor requests permission from the
same user activation; this browser exposes `DeviceMotionEvent.requestPermission`.

Acceleration and linear acceleration match the browser vectors in m/s². Angular
rate converts the browser's degrees/second to radians/second with the documented
axis order. Magnetic field correctly remains `unavailable / unsupported-kind`.
Explicit suspension holds sample counts, resume advances them, actual Android
Home/foreground holds and restarts delivery, and disposal ends every sensor.
Chromium, Firefox and WebKit also pass the nine deterministic vector-kind,
permission-gesture and missing-API checks. Physical accuracy, hardware rate and
browser delivery on physical hardware remain unmeasured.

## Emulator cost measurements (#415 and #494)

The maintainer approved emulated acceptance for these two issues. The results
provide reproducible diagnostics in that environment, with no physical-device claim.
The inspector baseline shipped in PR #422 / RC.12; portable expected/observed plots
shipped in PR #436 / RC.13. Their four historical native/browser recordings were
SHA-256 checked, fully decoded and visually reviewed without changing their labels.
The Android API 36 `Google sdk_gphone64_arm64` emulator uses production JavaScript
in a debug native package. Both workloads finished without a screen recorder or
another native test running. Source build identity is retained in the combined
report; the source baseline is RC.16 plus this measurement fixture.

| Median of five measured repetitions       | Inspector off | Inspector on | Shared graph, 16 views |
| ----------------------------------------- | ------------: | -----------: | ---------------------: |
| Timed duration (ms)                       |     1,173.329 |    1,174.338 |              4,842.064 |
| Process CPU (ms)                          |           278 |          299 |                  1,276 |
| ART bytes allocated                       |       323,584 |      323,584 |                872,448 |
| Native callback opportunities             |            70 |           70 |                    291 |
| Per-run callback interval p95 (ms)        |        16.667 |       16.667 |                 16.667 |
| Deliberately redundant 750 setters (ms)   |         8.571 |       11.010 |                      — |
| Preparation of five group animations (ms) |         4.677 |        4.390 |                      — |

Inspector collection alternates off/on, with a warmup for each variant and five
measured repetitions each. The same native probe is active in both variants.
Five phases each perform 50 rounds of setters on three compiled properties,
followed by one 180 ms group animation and 40 ms idle. The redundant setters
expose bridge/update work: opt-in inspection adds a median 2.439 ms to those
750 writes in this run. A developer can locate this work in the bounded adapter
history; exporting the snapshot occurs after the timed window. This is a
diagnostic example, not evidence that the inspector reduces CPU or allocations.

The combined workload has one shared `(a + b) * 0.65` graph bound to translation
on 16 native views. Each repetition runs three 1,600 ms phases from two finite
native timelines. No application subscription drives the views. All 16 native
targets are read at phase boundaries and must match each expected endpoint.
There is one warmup and five measured repetitions. Live-input callback acceptance
and cross-runtime vectors remain covered by the original RC.15 delivery report.

**Metric limits:** Choreographer timestamps are callback opportunities, not
presented-frame timestamps or GPU cost. ART counters omit V8, native and GPU
allocations. RSS is not PSS; negative RSS deltas can reflect collection. The
emulator's mostly fixed 16.667 ms opportunities are not a physical frame-pacing
result. Raw outliers, GC and probe work remain in the data; no samples were
removed from the five measured repetitions.

Raw results: [inspector](evidence/inspection-android-emulator.json),
[16-view graph](evidence/combined-android-emulator.json), and
[validated summary](evidence/metrics-summary.json). Recompute with
`python3 benchmarks/acceptance-closure/summarize.py`.

To reproduce, build the root, install demo dependencies and generate its local
Android template resources as described in `demo/README.md`. From `demo`, build
`npx ns build android --env.production --env.acceptanceMetrics --no-hmr`, install
the APK on an explicitly selected emulator and launch `org.nativescript.jolt`.
Do not record or run other native tests during collection. The two
`*-measurements.json` files are written to the app's external-files directory;
both must report `complete: true`. Type-check this separate fixture with
`npx tsc -p benchmarks/acceptance-closure/tsconfig.metrics.json`.

## Native screen readers (#498 and #499)

Actual VoiceOver on the iOS 27 simulator and actual TalkBack on the Android API 36
emulator pass all three native fixture scenes. Each list contains 200 keyed rows;
Core ListView and CollectionView 6.1.3 use their real recycled native cells.

| Scene          | Verified behavior                                                                                                                                               | iOS recording                    | Android recording                   |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ----------------------------------- |
| Exits          | Leaving copy remains inaccessible during a 30-second active exit; cancellation/reinsertion restores one real item; reduced motion and disposal leave no copies. | `layout-exits-voiceover-ios`     | `layout-exits-talkback-android`     |
| Core ListView  | Logical row focus survives move, insertion and interrupted updates; outside focus is respected; reduced motion and disposal complete.                           | `list-focus-voiceover-ios`       | `list-focus-talkback-android`       |
| CollectionView | The same keyed-focus cases on the documented single-column adapter.                                                                                             | `collection-focus-voiceover-ios` | `collection-focus-talkback-android` |

The six English recordings show real native interaction and the OS focus ring.
They were fully decoded and visually reviewed, are published through the media
manifest, and are embedded with translated captions in all four documentation
languages. They are silent simulator/emulator recordings, not physical-device
footage. iOS speech is verified through XCTest's actual VoiceOver service; Android
uses real TalkBack gestures and a read-only accessibility-tree observer.

The reader run exposed two defects: iOS restored focus while recycled rows were
still moving, and the CollectionView adapter lacked the shared focus restoration.
The fix captures the key/descendant before commit and restores iOS accessibility
focus on the native main queue after actual animation completion and cleanup.
A generation token invalidates superseded callbacks; pending logical identity
survives interrupted reloads and asynchronous OS acknowledgment. Android restores
after layout; first-responder timing is unchanged. Removed/offscreen keys and
focus outside the list do not force a jump. Suspension, unload and disposal
invalidate pending restoration. No fixed delay or polling is added to production.

The existing Web adapter needs no new focus backend. Its three-engine suite checks
keyed changes, exit accessibility, interruption, cleanup and application-owned
virtualization. The optional core capture hook is absent for Web.

Raw evidence: [VoiceOver traversal](evidence/voiceover-navigation.txt),
[exits](evidence/voiceover-exits.json), [Core lists](evidence/voiceover-lists.json),
[collections](evidence/voiceover-collections.json), [TalkBack navigation](evidence/talkback-navigation.json),
[exits](evidence/talkback-exits.json), [Core lists](evidence/talkback-lists.json),
and [collections](evidence/talkback-collections.json).
Native boundary reports sample focus shortly after settlement; iOS may acknowledge
a focus notification later. Final XCTest speech/traversal assertions, rather than
a single intermediate snapshot, establish the final focus result.

### Reproduction

Build the root, then build `benchmarks/native-app` with
`npx ns build ios --env.production --env.readerAcceptance --no-hmr --emulator`
or `npx ns build android --env.production --env.readerAcceptance --no-hmr`.
Install `dev.jolt.nativeci` on dedicated devices. Run
`python3 benchmarks/acceptance-closure/run-ios.py SIMULATOR_UUID OUTPUT_DIRECTORY`
with Xcode 27 / iOS 27 VoiceOver service support. For Android, run
`python3 benchmarks/acceptance-closure/readers-android.py SERIAL EMULATOR_PID_INI READER_TOOLS OUTPUT_DIRECTORY`.
Build the read-only observer with `benchmarks/accessibility-input/build.py`; the
Python environment needs grpcio and generated emulator gRPC modules in READER_TOOLS. It uses the emulator's existing private gRPC credentials
without saving them, and a read-only accessibility observer. Both runners restore
the reader settings they change and retain full per-session evidence and clips.
The fixture waits eight seconds after an action is armed to allow actual reader
focus placement; this is test orchestration, not a runtime restoration delay.

For the browser OS sensor route, see the options in `sensors-android.mjs`; run it
against actual Android Chrome with ADB virtual sensors and a secure loopback page.
Do not substitute synthetic DOM dispatch or a CDP sensor override for that check.

## Acceptance scope and adoption

All seven issues have evidence for the agreed scope: #414/#416 retain their
published implementations and historical measurements, #385/#415/#494 use the
explicitly approved emulated acceptance, and #498/#499 add actual native reader
acceptance plus the required focus correction. This does not authorize a release,
change the published RC.16 artifacts, or waive unrelated physical-pointer,
silent-switch, gallery or scroll acceptance.

Mavis main `b95dbe7` was inspected: its native and Web collection-motion modules
currently expose scroll-header/reorder integration, not this list-changes API.
Existing Mavis #185 owns virtualized collection adoption; #193 owns nonvirtualized
exits, #246 drawing and #297 inspector adoption. The Jolt fix is a pending package
dependency for consumers, not a claim that Mavis already uses it. No duplicate
adoption issue or Mavis implementation is required by this native-only correction.

## Final local validation

- 1,894 unit tests across 143 files; root build, benchmark types and the separate metrics fixture type-check pass.
- Browser checks: 27 values/list cases, 75 interaction/inspection cases, 24 plots/replay cases, 33 portable drawing/activity cases and nine sensor contract cases pass across Chromium, Firefox and WebKit.
- Actual native acceptance: all three VoiceOver scenes and all three TalkBack scenes pass. Inspector off/on has ten measured runs plus two warmups; the 16-view graph has five measured runs plus one warmup.
- Formatting, documentation media/playground checks, documentation build and public media verification pass (522 published recordings).

Native runs use dedicated simulator/emulator instances. New screen-reader clips
were recorded separately from the cost measurements. Hosted PR checks are tracked
on the PR; these local results do not substitute for their status.
