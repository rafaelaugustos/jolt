# Native animated blur (#33)

The optional `@rafaelaugusto/jolt/blur` entry controls an owned effect on a dedicated content view. A compiled iOS display link scrubs a paused `UIViewPropertyAnimator` that applies `UIBlurEffect`; a compiled Android `ValueAnimator` replaces the view's `RenderEffect`. JavaScript supplies a sampled curve and handles command/lifecycle/completion boundaries. No JavaScript display callback is installed.

## Reproduce

Build the normal Vue demo with `JOLT_BENCHMARK=1` as described in `CONTRIBUTING.md`, sequentially by platform. Open the `blur` example. The `--blur-audit` iOS argument or Android `blur-audit=true` string extra enables boundary-only audit controls. Reports are written to `Documents/blur-audit.json` on iOS and the app's external files directory on Android.

```sh
npm run typecheck
npm run benchmark:typecheck
npm test -- --maxWorkers=4
npm run build
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR /tmp/JoltBlur/ios \
  testBlurChecks testBlur
python3 benchmarks/blur-android.py YOUR_EMULATOR /tmp/JoltBlur/android audit
python3 benchmarks/blur-android.py YOUR_EMULATOR /tmp/JoltBlur/android record
python3 benchmarks/verify-blur.py \
  benchmarks/results/blur/ios.json benchmarks/results/blur/android.json
npm run docs:check-media
npm run docs:build
```

Choose English in the Android preview before capture. XCTest selects English for its recording. Copy the iOS JSON from the simulator app's data container to the capture directory. Android copies it automatically. Captures and screenshot checks use the actual app and real OS touches.

The paused material animator does not satisfy XCTest's animation-idle wait. Only blur tests use the existing test-runner pointer-event infrastructure to deliver ordinary OS taps without waiting for the paused animator to finish. No private test interfaces are linked into Jolt, and production animations stay enabled. The recording runner also supports screenshot cues for clear/half/full checkpoints.

## Results

Captured on 2026-10-26 using an iPhone 17 simulator (iOS 26.2) and an Android API 36 emulator. Committed reports are in `results/blur/`.

| Check                                                                    | iOS                | Android              |
| ------------------------------------------------------------------------ | ------------------ | -------------------- |
| Snapshot checkpoints                                                     | 14                 | 14                   |
| Actual applied amount at paused midpoint                                 | 0.5                | 0.5                  |
| Native update count while paused, including invalid command and resizing | Stable             | Stable               |
| Mid-animation retarget preserves current amount                          | Passed             | Passed               |
| Resize round trip                                                        | 346 → 240 → 346 pt | ~355 → 240 → ~355 dp |
| Pause during delay and reverse-repeat completion                         | Passed             | Passed               |
| Reduce Motion changes during playback and subsequent commands            | Passed             | Passed               |
| Background unload / foreground continuation                              | Passed             | Passed               |
| Effects / active native clocks / scope resources after exit              | 0 / 0 / 0          | 0 / 0 / 0            |
| Negative control with missing applied blur                               | Rejected           | Rejected             |

The checker compares the requested/current amount with the actual animator fraction on iOS and the applied radius fraction on Android. This alone is not proof of rendered blur, so the audit also captures clear/half/full screenshots. With Pillow installed, run the verifier on reports alongside those PNGs to check a fixed interior region of the postcard. Mean adjacent-pixel luminance difference decreased from **5.728 → 0.1405 → 0.0750** on iOS and **5.8125 → 0.2765 → 0.1859** on Android. These are within-platform checks of progressively reduced detail, not an assertion of equal materials across platforms. Raw captures remain in the local capture directories; reviewed English MP4s are committed in `docs/public/media/` and embedded in both guides.

The library suite passed **1,422 tests**, including eight blur lifecycle/ownership/playback cases. Both type checks, package build and both release demo builds passed. Unit coverage includes the no-effect backend; an Android version below API 31 was not run in this native audit. These correctness runs do not measure frame-time, power or memory on physical devices.

## Contract and cost

The iOS amount is progress through a system material, not a public Gaussian radius. The Android effect blurs the target render node's contents, not arbitrary content behind a transparent view. Dedicated background and foreground siblings make this distinction explicit. Android owns the target's RenderEffect slot exclusively and clears it on release. The demo uses a rounded native outline on its separate Android wrapper for clipping.

Radius is limited to 1–64 DIPs; amount is clamped to 0–1 after curve sampling. Android versions below API 31 or views without hardware acceleration get an immediate no-effect fallback, preserving opacity and input. No bitmap capture or new framework/dependency is added. Android allocates a RenderEffect when the radius changes; both backends do native work on the UI thread. The API does not promise zero allocations or motion while that thread is blocked.

No CI jobs or timeouts are changed. The existing native CI compiles the helpers; these local interaction and visual probes remain explicitly reproducible.
