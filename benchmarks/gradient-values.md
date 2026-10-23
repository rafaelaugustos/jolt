# Gradient motion-value bindings — #182

Recorded on 2026-10-22 from `feat/gradient-motion-values`, based on main `afc9001`.
NativeScript Core 9.1.3, production webpack bundle, HMR disabled. Android benchmark
application ID: `org.nativescript.jolt.benchmark`. The iOS build is Release for the
simulator. These checks exercise the real drivers and native presentation state.

| Target                                     | Conformance | Home / foreground | Reduced motion, all three types | JS observer frame requests |
| ------------------------------------------ | ----------- | ----------------- | ------------------------------- | -------------------------- |
| Physical ASUS_Z017DC, Android 8.0 / API 26 | 12 passed   | Passed            | Passed                          | 0                          |
| Android 16 / API 36 arm64 emulator         | 12 passed   | Passed            | Passed                          | 0                          |
| iPhone 17 simulator, iOS 26.0              | 12 passed   | Passed            | Passed                          | 0                          |

Raw results are in [`results/gradient-values`](./results/gradient-values). Android
reads the drawable's native geometry, colors, stops, corner radius and sample count;
iOS reads the CAGradientLayer presentation layer. Values irrelevant to a gradient's
type (for example a radius inferred from a linear start/end pair) are not asserted.

The twelve conformance cases cover mixed scalar/color/alpha values; autonomous
view/gradient synchronization; source pause, seek, rewind and resume; a scalar pulse
over base playback and interruption; component ownership and array replacement;
resizing and corners; scope suspension with an independently running source;
unload/reload plus twenty repeated bind/remove cycles; linear/radial/conic geometry;
playbackProgress; a 220 ms busy UI interval; and playback across the four-second
native-window boundary. Reduced motion separately checks destination geometry while
colors and stops continue animating. Home/foreground uses real platform lifecycle
events and requires zero source listeners while suspended and exactly one after
the view has reloaded. On iOS the view reload can follow the app's resume callback.

The assertions allow 0.08 source units for gradient/clock skew and 0.06 for
gradient/view skew, 0.015 for related center/stop consistency, and 15 degrees for a
moving linear angle. These are conformance tolerances for discrete asynchronous
reads, not a promise of frame-perfect scheduling. Paused holds allow 0.002 units;
seeked playbackProgress checks 0.01 source units and 1 DIP. Color application is
checked against the derived 8-bit ARGB value. No JS observer frames are requested
by the bindings; discrete test timers only read/assert native state.

Native-only here means native interpolation and rendering within the prepared
window. Setup, gesture events, source commands and four-second window rebuilds
still enter JS. Android rendering shares its UI thread; blocking it stalls frames.
An exhausted window holds if JS cannot prepare the next one. The EN/PT guide
documents the 241-sample bound, interpolation approximation and ownership rules.

## Reproduce

Build the library, then build the demo with `JOLT_BENCHMARK=1`, `--env.production`
and `--no-hmr`. Install it on the selected device before running the harness.
After changing Java plugin methods, regenerate NativeScript's Android bridge
metadata as well as the AAR (`./gradlew cleanMdg` in `demo/platforms/android`, then
rebuild); a cached bridge can omit newly compiled methods.

```sh
npm run build
npm run benchmark:typecheck
python3 benchmarks/gradient-values-android.py SERIAL /tmp/gradient-results checks background reduced record
python3 benchmarks/docs-record-ios.py SIMULATOR_UUID /tmp/gradient-ios testGradientValueChecks
```

Use separate iOS runs for `testGradientValueBackground` and
`testGradientValueReduced`; copy `Documents/jolt-gradient-values.json` from the
app data container after each run because the next run overwrites it.
`testGradientValues` records real drag/tap interaction. The existing `testGradients`
and `testGradientDirective` were also executed and their playback inspected as
regression checks for concrete-value APIs.

## Reviewed media and local checks

- `docs/public/media/gradient-values-ios.mp4`: real XCTest drag and taps on the
  iPhone 17 simulator, 16.63 seconds, H.264 at 540 px width / 30 fps.
- `docs/public/media/gradient-values-android.mp4`: real ADB drag and taps on the
  API 36 emulator, 15.07 seconds, same encoding. This is emulator footage, not the
  ASUS physical-device check.
- Both clips show the three gradients following one source, autonomous travel,
  pulse, pause/seek/resume, scope hold/follow, type replacement, rebinding and resize.
  Frames were visually inspected and both compressed files fully decoded without
  errors. EN/PT captions identify the platform and JS gesture/preparation limits.
- Unit suite: 1,032 tests / 60 files; public type checks, library build and benchmark
  type checks pass. Documentation media coverage: 44 guides per language and 82
  recordings. VitePress production build passes.

The artifacts contain no performance ranking or claim of equivalence to worklets.

The ASUS intermittently aborted during cold app startup in Android's RenderThread
with `Failed to choose config, error = EGL_NOT_INITIALIZED`, before drawing. Those
launch attempts did not produce test results. The passing reports above come from
successful launches; this old-device startup limitation is not counted as a passing
check or hidden by automatic retries in the harness.
