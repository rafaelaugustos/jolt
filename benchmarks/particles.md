# Native Android particles validation

Issue #183, recorded on 2026-10-22. The existing public `particles()` / `confetti()` API now drives a bundled Java simulation and `Canvas` drawable. Simulation, emission cutoff, expiry, rendering and animator-scale observation do not request JS animation frames. Setup and lifecycle completion still cross the NativeScript bridge.

## Environments

| Environment                               | OS / runtime                                                                | Display / renderer                                   |
| ----------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Physical ASUS_Z017DC (ASUS Z017D)         | Android 8.0.0, API 26, arm64-v8a, build `OPR1.170623.026/15.0410.1806.68-0` | 1080 × 1920, density 3, device renderer              |
| JoltReview emulator, `sdk_gphone64_arm64` | Android 16, API 36, arm64-v8a, build `BP22.250325.006/13344233`             | 1080 × 2400, density 2.625, SwiftShader, 4096 MB RAM |
| iPhone 17 simulator                       | iOS 26.0, NativeScript iOS 9.1.0                                            | XCTest regression and real simulator playback        |

Host: Apple M4 Max, macOS 26.6.2 (25G83). Android app: NativeScript Android 9.1.1, Core 9.1.3, Vue 3.1.2, production webpack bundle in the benchmark-ID debug APK. Measurements used animator scale 1; separate runs exercise 0, 0.5, 2 and a live 1 → 0 change. The runner restores the previous device settings, including a missing/default value. No optional dependency, permission or minimum-runtime change is introduced.

## Results and limits

Both Android environments passed all 11 conformance groups, real background/foreground, each of the three scale runs, the live scale change, and touch interaction. Each JSON run reports **zero JS observer frame requests** and **zero remaining active native emitters**. Every group checks return to the initial emitter count. Twenty repeated scope disposals and target unload/reload cycles exercise cleanup; native completion releases the arrays and settings observer as well as the JS lifecycle listeners. The deterministic Java suite passed **336 assertions**, and the complete JS suite passed **1,043 tests in 61 files**.

Raw reports are committed in [`results/particles/asus`](./results/particles/asus/) and [`results/particles/api36`](./results/particles/api36/). These contain measurements from individual runs, not an averaged device comparison. Random trajectories are deliberately not identical across devices or platforms.

| Case                       | Live / peak / capacity | Callback p50 / p95 / max (ms) | Mean native update / draw CPU (ms) | Frames / draws |
| -------------------------- | ---------------------- | ----------------------------- | ---------------------------------- | -------------- |
| ASUS ordinary snow, ~4 s   | 121 / 121 / 150        | 16.72 / 16.73 / 17.13         | 0.345 / 0.430                      | 242 / 242      |
| API 36 ordinary snow, ~4 s | 121 / 121 / 150        | 16.67 / 16.67 / 16.67         | 0.135 / 0.038                      | 244 / 244      |
| ASUS stress, ~3.5 s        | 10000 / 10000 / 10000  | 100.21 / 167.05 / 167.09      | 0.872 / 10.187                     | 38 / 38        |
| API 36 stress, ~3.5 s      | 10000 / 10000 / 10000  | 33.33 / 33.33 / 66.67         | 0.357 / 1.368                      | 135 / 135      |

Ordinary snow uses 30 births/s, 5000 ms lifetime, 5 DIP size and 45 ± 15 DIP/s downward velocity. Stress uses 10000 births/s, 1000 ms lifetime, 3 DIP size and 100 DIP/s downward velocity. Both use a local overlay; stress intentionally reaches the storage cap and is **not an acceptable frame-rate target for an interactive scene**. Keep populations modest, especially on older hardware.

Pacing is the interval between native Choreographer callback timestamps. CPU costs are elapsed `System.nanoTime()` around native update/draw, divided by their invocation counts. They do not measure GPU completion, final screen presentation or all work done by the UI thread. Samples come from a bounded 512-interval buffer; the measured cases fit in that buffer. Percentiles use the sorted element at `floor(count × percentile)`. No speed changes were applied to the recordings.

NativeScript JavaScript and this Android renderer share the UI thread. A deliberate 750 ms JS busy loop stopped frame delivery on both devices: frame count stayed 8 → 8 on ASUS and 9 → 9 on API 36 during the block. On return, native wall time expired the effect, skipped the 17 already-dead births and released resources, rather than replaying a backlog. This backend does not promise render-thread/GPU independence. The iOS renderer remains `CAEmitterLayer`; its native emission cutoff can run while JS is busy, with final layer cleanup on the JS timer.

## Contract checks

- Real native raster readback checks circles, rings and rectangles, red ARGB color, a transparent ring center, and density conversion. A 16 DIP circle/ring must occupy the expected raster dimensions within 3 pixels for antialiasing; rotated rectangles are checked for nonempty raster and center color. The bitmap fixture is demo-only and is not shipped with Jolt.
- Finite emission at 100/s for 300 ms produces exactly 30 births under the normal test load and frees buffers after their 500 ms lifetime. Sources and resize use native bounds; position is compared with the independent formula `y = origin + velocity × age + gravity × age² / 2`, within 0.1 DIP.
- Confetti captures the center in root-window coordinates, with initial placement within 2 pixels. A new burst after 30 DIP of scrolling, 14 DIP translation and 25° rotation follows the new center within 3 pixels; the existing burst keeps its original origin. Native window identity and detach checks cancel stale effects. Local overlays follow their target; confetti crosses target/parent bounds but stays inside its window.
- A drawable adds neither a View nor an accessibility node. Real ADB taps increment the demo's touch counter through snow, rings and window confetti. The inspected clips show the counter reaching 3. Resize, all source/shape modes, finite emission, stop and reduced motion are included.
- Replacement and repeated cleanup preserve independent particle/confetti ownership. Calls before load/window/nonzero size wait without advancing time; disposal cancels the pending call. Unload, zero size, native detach, backgrounding and reduced motion cancel without automatic replay. Scope subscription factories can explicitly create a fresh effect on resume.
- Animator scale 0 prevents and cancels effects, even when Jolt is configured with `reducedMotion: 'never'`. Positive 0.5 and 2 keep physical units and deadlines in wall time. The scale test uses 400 ms emission plus 300 ms lifetime, with a 650–1100 ms delivery window and 35–40 births to account for scheduling. A live 1 → 0 change exercises the native `ContentObserver`; it releases arrays/observer and cannot restart the emitter.
- The pure-Java tests use a deterministic internal seed and explicit elapsed times: validation, rate/lifetime/count, all sources, resize, directions, velocity variation, spread, gravity, spin, alpha/fade, finite cleanup, bounds and skipping expired births after long stalls. The seed is not part of the public API.

## Storage and packaging

Primitive state uses 36 bytes per slot (one double, six floats, one int): about 352 KiB for 10000 slots. Continuous emitters allocate `ceil(rate × lifetimeSeconds)` slots; finite emitters allocate only the smaller emission/lifetime window. The native simulation independently enforces the 10000 cap, including the special short confetti burst. Arrays, `Paint`, clip path and coordinate buffers are reused; there is no per-particle/per-frame Java object allocation in the animation loop. The fixed diagnostics interval buffer adds 4 KiB per emitter. Cleanup clears particle arrays and drops target, host, drawable callback and JS listener references. This is bounded owned storage, not a process-heap or GPU-memory claim.

In the local Android build, the five new particle class files total 19457 bytes uncompressed, 10065 bytes compressed inside `classes.jar`. The complete bridge `classes.jar` grows from 55245 to 66162 bytes (10917-byte delta); final APK/R8 sizes depend on the consuming app. The backend uses Android platform APIs and Jolt's license, with no added third-party version/license cost. Rebuilding the native app is required to install the Java classes and bridge metadata; a JS-only update is insufficient.

## Recordings and iOS regression

The English and Portuguese particle guides embed all three reviewed clips, preserving the original iOS `particles.mp4`:

- [`particles-android.mp4`](../docs/public/media/particles-android.mp4): API 36 emulator, 26.8 s.
- [`particles-android-device.mp4`](../docs/public/media/particles-android-device.mp4): physical ASUS, 35.7 s.
- [`particles-ios.mp4`](../docs/public/media/particles-ios.mp4): iPhone 17 simulator, 23.03 s.

The new `DocsTests.testParticles` XCTest passed with zero failures (29.383 s), exercising all shapes/sources, finite emission, resize, touch pass-through, live reduced motion and restored confetti. The original iOS rendering remains intact; common lifecycle handling now also cancels on app background and live Jolt configuration changes. Unit tests cover both lifecycle changes. All three encoded H.264 files were fully decoded with FFmpeg without errors and visually inspected. `docs:check-media` passed with 44 guides per language and 85 recordings, and the complete VitePress production build passed.

## Reproduce

From the repository root, with Node 22 and JDK 17 available:

```sh
npm ci
npm run build
npm run typecheck
npm run benchmark:typecheck
npm test
sh benchmarks/android-particle-tests/run.sh
```

Build the normal native demo with its benchmark ID; the runner launches its isolated particle lab. Native builds must run sequentially when sharing the same demo directory.

```sh
cd demo
npm ci
JOLT_BENCHMARK=1 ns build android --env.production --no-hmr
adb -s SERIAL install -r platforms/android/app/build/outputs/apk/debug/app-debug.apk
cd ..
python3 benchmarks/particles-android.py SERIAL /tmp/jolt-particle-results
```

The optional positional modes are `checks background settings record`; omitting them runs all. An assertion failure is reported without a hidden retry. If native class metadata from a prior build is cached, run `./gradlew cleanMdg --console=plain` in `demo/platforms/android` and rebuild before installing.

For iOS, build/install the benchmark-ID demo on an explicitly selected simulator, then run the existing XCTest recorder (Ruby `xcodeproj` gem required):

```sh
cd demo
JOLT_BENCHMARK=1 ns build ios --for-device false --release --env.production --no-hmr
xcrun simctl install SIMULATOR_UUID platforms/ios/build/Release-iphonesimulator/demo.app
cd ..
python3 benchmarks/docs-record-ios.py SIMULATOR_UUID /tmp/jolt-particle-ios testParticles
npm run docs:check-media
npm run docs:build
```
