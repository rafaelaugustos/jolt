# Motion values and layered motion — RFC #152

The RFC's API and composition decisions are delivered. This report maps the original proposal to the implementation and keeps the remaining physical-device capacity work in [#242](https://github.com/rafaelaugustos/jolt/issues/242). Closing the RFC does not claim those measurements are complete.

## Delivery map

| RFC item                                                         | Current implementation and evidence                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| One value drives a sheet, backdrop and page on a shared timeline | `motionValue()`, `to()`, `bind()`, `useMotionValue()` and `useBinding()` shipped in #153. The four motion-value guides contain real iOS/Android sheet recordings; `test/motion-value.spec.ts` covers shared timing, interruption, ownership and late binding.                                                                                                      |
| Independent base and named property layers                       | Shipped in #154. Translation/rotation add; scale/opacity multiply. `test/layers.spec.ts` covers independent stop, pause, velocity, scope/sequence behavior and the nonzero-base entrance/press/shake case. The original Layers recordings remain in all four guides.                                                                                               |
| Endless periods on one property                                  | The original phase 3 was dropped in the RFC's decision comment. `src/mixer.ts` compiles a common native loop up to 30 seconds and otherwise rebuilds rolling windows. `src/value-track.ts` / `src/motion-value.ts` implement scalar-value composition. Native audit and recordings below cover two named view layers with different periods and a window rollover. |
| Live inputs                                                      | `drag()` and `scrollValue()` retain per-event JavaScript. Native `gestures()`, `springValue()`, sensor bindings and `scrollHeader()` now provide separate supported native paths; their guides describe properties, ownership and thread limits. This does not replace every legacy input path or make UI-thread work immune to a blocked thread.                  |
| Binding/layer limits and busy-screen preparation cost            | Not measured on physical devices in this delivery. #242 preserves that unchecked decision, including raw traces and deriving budgets from measurements. #65 continues to own cross-stack comparisons; #114 tracks real sensor acceptance.                                                                                                                          |

The [scroll](scroll-values.md) and [drag](drag-values.md) event-cost reports are historical debug simulator/emulator diagnostics. [Value consumers](model-motion-values.md) distinguish optional JavaScript observers from native binding playback. The external native-property registry is already delivered; it is documented in `docs/guide/native-properties.md` rather than described as future work.

## Corrections found while checking acceptance

`press(view, ..., { layer })` previously captured the absolute base as its release target. With a moving base from x=20 to x=60, releasing the test's press produced x=96 instead of x=36; a non-unit scale was multiplied again. A dedicated press layer now returns to 0 for additive channels and 1 for multiplicative channels. Removing the effect clears even a completed press contribution. Its name is reserved for that press effect. Ordinary unlayered press behavior is unchanged.

The native Android audit then exposed phase drift: allocating a composite track took time, but playback began at the old sample origin. A common-loop sample differed by about 7.5 DIP, and a rolling-window sample by about 6.7 DIP. The mixer now catches the native handle up after construction, with a generation check so synchronous completion cannot replace a newer handle. A host regression advances time during native allocation; both native platforms are rerun with the correction.

## Reproduce

Build and install the normal benchmark-ID demo in Release mode with production JavaScript and HMR disabled, as described in `CONTRIBUTING.md`. Reserve an explicit simulator/emulator; build the platforms sequentially.

```sh
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR_UUID /tmp/MotionRFC \
  testMotionRfc testValueConsumerChecks
python3 benchmarks/motion-rfc-android.py YOUR_EMULATOR_SERIAL /tmp/MotionRFCAndroid
python3 benchmarks/verify-motion-rfc.py benchmarks/results/motion-rfc/ios.json
python3 benchmarks/verify-motion-rfc.py benchmarks/results/motion-rfc/android.json
```

`--motion-rfc-checks` uses the real Layers demo card and buttons, with an opt-in fixture using public `animate()`, `press()`, `set()` and `stop()` calls. It does not change the ordinary demo controls. XCTest/ADB inject actual taps and a held touch; no application touch handler is invoked synthetically. The fixture changes what the buttons start during this audit, as identified in the captions.

- A four-second entrance starts from x=64 / scale=1.3 and ends at x=24 / scale=1.5. A real held press adds x=8 and multiplies scale by 0.88. The shake is removed during contact: the entrance and press must remain active. Release must restore the current base, then settle at the exact resting geometry.
- Two endless view layers use reversed periods of 900 and 1,600 ms. Their composite runs as one 28,800-ms native loop. A subsequent pair of 701/709-ms reversed periods forces four-second composition windows; native poses are sampled before and after a rollover.
- Each pose is compared with the expected composition (4 DIP translation / 0.035 scale tolerance for native sampling and frame timing). Android reads its last applied pose in a one-shot frame probe; iOS reads the presentation layer directly. Press release additionally uses the independently known base formula. The check requires real down/up boundaries, both endless owners, a second window, no library animation-frame requests, and no active channels/native handles after cleanup.

The frame counter observes animation requests made through Jolt's driver; it excludes the Android audit's one-shot measurement probes and is not a device FPS or compositor measurement. Sampling, file output and composition boundaries execute JavaScript. Native view-layer setup costs are not hidden by a per-frame JavaScript loop.

## Evidence and limits

- [iOS audit](results/motion-rfc/ios.json): iPhone 17 simulator, iOS 26.2, real XCTest input, Release build. [Value-consumer rerun](results/motion-rfc/ios-consumers.json) separately checks native-only binding, optional observers, composition and actual background/resume.
- [Android audit](results/motion-rfc/android.json): Android 16 / API 36 emulator, real ADB input, Release APK. The audit exports to the app's external files directory so `run-as` and a debuggable APK are not required.
- `motion-rfc-ios.mp4` and `motion-rfc-android.mp4` contain the reviewed English audit recordings, embedded in Press and Layers guides in all four locales. Existing motion-value, Layers and EN/PT media are preserved. Recordings retain the original timing and decode as H.264; they do not establish physical-device performance.
- Host tests cover layered release/cancel, interrupted release, removing a settled contribution, and phase catch-up after allocation. Existing motion-value/layer tests and native consumer evidence remain part of the acceptance map.

No new framework, web backend, native sensor type or universal performance threshold is introduced by this consolidation. The open measurement work has explicit ownership in #242.
