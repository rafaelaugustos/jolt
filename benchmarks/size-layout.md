# Real dimension animation validation

Issue #181, 2026-10-23. `animateSize()` changes actual NativeScript width/height declarations through temporary animation overrides. It measures and lays out the live tree; it does not scale a snapshot, duplicate a view or animate only a drawing layer. Existing `animateLayout()` behavior is unchanged.

## Execution and measurement

NativeScript's [layout process](https://docs.nativescript.org/guide/advanced/the-layout-process) includes recursive measurement and layout. Changing only a UIView frame or Android drawing transform would not provide the required NativeScript text reflow, sibling placement and semantic `auto` ownership. This implementation deliberately runs library-owned frame callbacks and NativeScript layout on the UI thread in JavaScript. It makes no zero-JS or render-server claim.

Each active operation probes its complete destination (both axes together), restores its temporary current size, and lays out the real tree before drawing. It uses the existing root's constraints rather than an unconstrained cloned label. Destination probing only measures; no speculative frame is drawn. Frame callbacks use NativeScript's CADisplayLink/Choreographer scheduler; Android curve time uses the existing native animator clock. A paused or completed operation has no queued frame callback. A no-op settles after its first measurement.

The first implementation intentionally measures intrinsic destinations every frame to notice content/font/image/parent changes. Expect two root measurement calls and one explicit layout call per operation/frame, plus framework passes. A parent/content retarget restarts from current untransformed native bounds. Root layout allocation uses a valid Core cache, falling back to native bounds if the Android cache is still zero. Unit regression coverage protects this fallback and interrupted ownership during measurement.

## Environments and checks

| Layer                            | Environment                                                                | Result                                                                                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Library unit/type suite          | Node 22.23.3                                                               | 1,080 tests; library and benchmark type checks pass                                                                                                             |
| Vue fixture                      | vue-tsc with TypeScript 5.9.3                                              | SizeLab.vue type check passes; the repository uses TypeScript 7 for its main checks                                                                             |
| Existing native regression check | Java particle simulation                                                   | 336 deterministic assertions pass                                                                                                                               |
| Native iOS tree                  | Dedicated iPhone 17 simulator, iOS 26.0; release build with production JS  | 20 named checks plus existing-transform preservation; normal and extra-extra-extra-large content-size settings                                                  |
| Native Android tree              | Dedicated Android 16 / API 36 arm64 emulator; debug APK with production JS | 20 named checks plus existing-transform preservation at font scales 1.0/1.3 and animator scales 1/2                                                             |
| Disabled Android animations      | System animator scale 0, normal demo                                       | Expand settles at semantic auto                                                                                                                                 |
| iOS OS input                     | XCTest against the normal Vue demo                                         | Expansion, width/reflow, content growth/shrink, pause/resume, following-row hit at intermediate bounds, interrupted reversal, GridLayout and orientation change |
| Android OS input                 | ADB taps against the normal Vue demo                                       | Same main scene; following-row activation at intermediate paused bounds; GridLayout completion; landscape/portrait round trip                                   |

Core 9.1.3, iOS runtime 9.1.0, Android runtime 9.1.1. No physical-device performance claim and no manual VoiceOver/TalkBack navigation audit. Native hit bounds and control activation are checked; screenshot appearance alone is not the assertion. The vertical StackLayout and auto-row GridLayout fixtures run nested inside the demo's real ScrollView. Fixed/star Grid tracks retain their allocation, and virtualized/custom-layout trees are outside the support contract.

The native runner checks ten groups for each parent:

1. Intermediate native width/height, unchanged scale, moving sibling position and native hit bounds.
2. Fixed → auto and auto → new auto after a synchronous content mutation.
3. Interrupted reversal from current bounds and combined width/height.
4. Late text and font-size changes, stable semantic auto after completion.
5. Parent-width changes during an active intrinsic transition.
6. Pause/resume with stable real bounds while paused.
7. Holding on stop, restoring original declarations and a newer explicit property write taking ownership.
8. Scope pause/resume, native unload/reinsert and Reduced Motion.
9. Zero size and minimum/maximum constraints.
10. Bounded spring overshoot; subsequent width/height changes preserve an existing scale transform.

The tests choose a distinct destination for the ownership check so an already-completed no-op cannot be mistaken for active cancellation. Their timers sample actual native behavior; timers do not drive the library's animation. Unit tests additionally cover invalid input before replacement, async mutation rejection, scope disposal, app suspension, CSS/local declaration restoration and reentrant cleanup preserving a newer animation.

## Cost observations

The runner wraps the root's `measure()` and `layout()` methods with `performance.now()`. These are **individual call costs in this small fixture**, not complete frame latency, a smoothness guarantee, or a comparison between devices. The measurement includes calls initiated by both Jolt and the framework, and the instrumentation itself adds overhead. It does not isolate GPU drawing or unrelated JS work.

| Run                        | Root measure p50 / p95 (ms) | Root layout p50 / p95 (ms) |
| -------------------------- | --------------------------- | -------------------------- |
| iOS, normal font           | 0.343 / 0.743               | 0.318 / 1.321              |
| iOS, XXXL setting          | 0.339 / 0.760               | 0.297 / 1.191              |
| Android, 1×                | 0.071 / 0.308               | 0.053 / 0.211              |
| Android, font scale 1.3    | 0.075 / 0.313               | 0.054 / 0.187              |
| Android, animator scale 2× | 0.071 / 0.330               | 0.053 / 0.238              |

Raw measurements and native intermediate bounds are in [`results/size/`](./results/size/). Larger or deeper trees, several simultaneous operations and main-thread JS work increase cost. Both axes share the operation's passes; separate operations currently perform their own measurement/layout. Use FLIP when continuous text reflow is not needed.

## Reproduce

Build the normal Vue demo with `JOLT_BENCHMARK=1`, production JS and `--no-hmr`. Build platforms sequentially because NativeScript shares generated assets. See [the existing native setup](./layout-lifecycle.md) for SDK/signing details. The package ID is `org.nativescript.jolt.benchmark`; leave the user's main demo and other running devices alone.

Launch `--size-lab` on iOS or `--es size-lab true` on Android. **Run size checks** executes `size-checks.ts` and saves `Documents/jolt-size-checks.json` (Android's application files directory). The UI reports PASS or the failing stage. Font/scale settings in the dedicated Android emulator are restored by the settings runner.

```sh
python3 benchmarks/docs-record-ios.py SIMULATOR_UUID /tmp/JoltSizeIOS testSize testSizeChecks testSizeRotation
python3 benchmarks/size-android-ui.py EMULATOR_SERIAL /tmp/JoltSizeAndroid
python3 benchmarks/size-android-settings.py EMULATOR_SERIAL /tmp/JoltSizeSettings
```

The iOS XCTest fixture and Android runner use actual OS touches. Both videos include an explicitly selected 0.25× segment to inspect pause and reversal. Source playback timing is preserved when compressing to H.264. The clips are embedded in English and Portuguese; representative frames across their full duration, width reflow, the paused tap and the final Grid state were inspected. `ffmpeg` fully decodes both outputs. Native test JSON and recording checks supplement the videos.
