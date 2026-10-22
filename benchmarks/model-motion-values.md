# Motion value gaps from the model projects

Validation for #172–175, based on beta.12 (`8e665db`). This change adds subscriptions, additive value layers and descending mappings. The excessive rolling height report was traced to the model's grid constraints; no rolling engine change is needed for that height problem.

## Environments

- iPhone 17 simulator, iOS 26.0, dedicated `Jolt Drag Validation` device. NativeScript iOS 9.1.0, core 9.1.3; release build with production webpack and no HMR.
- Dedicated `JoltReview` Android 16 / API 36 emulator, 4 GB RAM. NativeScript Android 9.1.1, core 9.1.3; debug APK with production webpack and no HMR. These are correctness checks, not physical-device performance claims.
- Node 22.23.3. `org.nativescript.jolt.benchmark` application ID. The user's model and active devices were left untouched; model investigation used a separate copy and application ID.

## Automated coverage

`npm test`: 957 tests, 55 files, passing in 2.80s with the default timeout. Type checking and library build pass. During concurrent native builds, the unrelated CPU-heavy liquid field test exceeded its 5s timeout; a run with a 15s timeout and the final default run both passed without relaxing assertions.

New tests cover ascending/descending equivalence, duplicate stops, colors, chains, clamping/extrapolation, native track mappings, one shared subscription frame source, coalescing, reentrant writes, exceptions, unsubscribe during delivery, app/scope lifecycle, no idle frames, reduced motion and native playback clocks with system duration scaling. Value layer tests cover independent interruption/velocity, composition before nonlinear/clamped mappings, held contributions, stop/set, scope disposal, drag base ownership, infinite periods and fractional/long composition windows.

The native probe caught phase drift while Android allocated a composite track. Bindings now catch up to the source clock **after** creating native keyframes. A fake-driver regression test advances time during native construction and verifies that successive bindings join at the current phase.

Native interaction runners:

```sh
python3 benchmarks/docs-record-ios.py SIMULATOR_UUID /tmp/JoltModelRecordings \
  testDragValues testValueObservers testValueLayers testRollingLayout
python3 benchmarks/value-ranges-android.py EMULATOR_SERIAL /tmp/descending-values-android.mp4
python3 benchmarks/motion-values-android.py EMULATOR_SERIAL /tmp/JoltModelRecordings
```

The observer scene uses a manually created CALayer on iOS and a raw `android.view.View` on Android. Neither is a NativeScript view binding. A bound NativeScript view and that external object follow the same scalar; detach freezes only the external object, reattach catches up, and stop holds both. JavaScript listeners are opt-in and do not run while JavaScript is blocked.

The layer scene compares a base reference with a value driving position, scale and color. It starts and removes a charge pulse while the base continues, retargets the base with the pulse active, and resets both values. Native composition uses a common loop up to 30 seconds for integer periods; longer/fractional combinations rebuild windows at their boundaries. These rebuilds are JavaScript work, without a per-frame JS mixer.

## Observer cost and native lifecycle

`benchmarks/value-consumers.ts` runs only with the normal demo's `--value-observer-checks` launch flag. It wraps the shared frame callback to time the whole notification batch, including sampling/mapping and trivial listeners. This is observation overhead, not rendering cost or a frame-rate benchmark. It compares a native-only bound value with 1, 8 and 32 independently observed sources; cleanup must leave no frame callbacks. Values use repeats, and each measured phase lasts 500 ms. The first phase includes cold bridge/JIT work. Emulator/simulator results should not be treated as physical-device budgets.

The probe also compares composed native translation with `get()` during a finite base plus an infinite layer, after base completion, and before/after a four-second composition window. Its tolerance is 4 DIP to allow native frame sampling versus command-time reads. Real Home/background/foreground actions verify that callback counts stay unchanged in the background and increase again after resume. Final unsubscribe must stop scheduling.

```sh
python3 benchmarks/docs-record-ios.py SIMULATOR_UUID /tmp/JoltValueChecks testValueConsumerChecks
python3 benchmarks/value-consumers-android.py EMULATOR_SERIAL /tmp/android-consumers.json
```

The native-only baseline scheduled **zero observation frames** on both platforms. Raw measurements and lifecycle results are under [`model-motion-values/`](./model-motion-values/). The checks passed with no callback in the background: iOS stayed at 28 callbacks and Android at 15. All four composition samples were within 0.04 DIP on iOS and 2 DIP on Android. Costs vary with emulator load; report batch cost separately from application callback work.

## Rolling height investigation

The original report was 595 pt. In an isolated copy of the current car model, removing its fixed `height="52"` reproduced the same failure class at **554 pt**. The layout has an outer StackLayout, a GridLayout with `columns="*, auto"` and no explicit rows, a horizontal StackLayout for the range and unit, and an energy indicator in the second column. Font: bundled InterDisplay-Light, 40 pt, weight 300, letter spacing -0.04. The label initially held `300`; calling `rollTo(..., 312)` forced an actual text change.

| Configuration                                 | Before `rollTo()` |   During |    After |
| --------------------------------------------- | ----------------: | -------: | -------: |
| Implicit grid row, no fixed height            |            554 pt |   554 pt |   554 pt |
| Same grid with `rows="auto"`, no fixed height |          48.67 pt | 48.67 pt | 48.67 pt |

The native font line height was 48.398 pt in both cases. The inflated size existed at the first layout and before Jolt was called. Adding `rows="auto"` alone restored natural height. Temporary CALayer glyphs do not participate in NativeScript child measurement. The model copy was checked with beta.12 itself, so the conclusion does not depend on the new motion value implementation.

The normal demo now contains **Rolling auto size**, with animated and static labels under the same explicit auto row constraints. It checks 40 and 64 DIP font sizes and values 312, 999, 1000 and 7, then cancels another change to 42. Both rows have a 180 DIP minimum width to accommodate old/new digits; neither has a fixed height. Eighteen measurements compare heights within 2 DIP. iOS additionally checks a live rolling overlay during playback and no retained overlay afterward. Results are written to `Documents/jolt-roll-layout-checks.json`.

An earlier natural-width fixture displayed the final text without an overlay: the old/new glyphs did not both fit the current width. This is the existing documented truncation fallback, distinct from the reported height problem. The width reservation makes the recording exercise real rolling instead of silently passing a static fallback. The larger-font check verifies natural height growth, rather than hiding it behind a fixed height. It is not a claim of exhaustive system accessibility-font coverage.

## Media

Recordings in `docs/public/media/` cover descending mappings, external observation, value layers and auto-height rolling on both platforms. They use real native playback and actual XCTest/ADB input, are inspected across the clip, and retain source timing at 30 fps in H.264. EN/PT guides include the same media with platform captions.
