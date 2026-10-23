# iOS SVG opacity and rotation investigation

Issue: [#134](https://github.com/rafaelaugustos/jolt/issues/134).

**Status: not reproduced on the iOS 26.0 simulator. No library fix claimed. Physical-device reproduction is still pending.** Keep #134 open: a passing reconstruction cannot establish that the original rendering defect was fixed.

The original report combines opacity and rotation on a container with overflowing children and a neighboring image. A previous plain-view attempt did not reproduce it. This probe adds the missing `@nativescript-community/ui-svg` renderer and radial SVGs similar to those used for the original halo, flash and ember heads. It uses an asymmetric blue PNG as the stationary sibling so a copied image is distinguishable from the orange animation. It does not copy the original application's artwork.

## Scene and controls

Launch the normal demo with `--opacity-rotation`. The scene contains four 126 × 126 pt `AbsoluteLayout` orbits with `clipToBounds=false`, each containing an SVG directly, without an intervening wrapper. The largest head is 30 pt wide and lies halfway beyond the right edge. A 228 pt halo and a 48 pt expanding flash are SVG siblings. The blue image is 90 × 90 pt.

- **Play orbit:** rotation `[0, 360]`, linear, 1,600 ms, repeated forever. Opacity `[0, 1, 0.35, 1]`, 960 ms, also repeated forever. Both tracks are submitted in one `animate()` call per container, with 26 ms staggering between orbits.
- **Fade child / Fade container:** compare the original same-layer configuration with the reported workaround. In child mode, each SVG fades and its parent only rotates.
- **Use plain views / Use SVG views:** rebuild the content with plain `ContentView`s or actual `SVGView`s. Stop resets all animation handles before switching.
- **Slow motion / Normal speed:** start the scene with `configure({ timeScale: 0.2 })` or `1`. The slow recording is explicitly labeled `Playing at 0.2x`.
- **Replay splash:** a 480 ms cubic-in-out sweep from 115° to −90°, fading at `[0, 0.08, 0.85, 1]`, followed by a 340 ms expanding flash. The automated test replays it ten times.
- `--ghost-pattern=fade` selects one 960 ms fade-in while rotation continues forever. The test restarts this five times.

The probe respects the OS Reduce Motion preference; make sure it is off when investigating continuous rotation. It records container clipping, rasterization, group-opacity flags and active animation keys into `Documents/opacity-rotation-{pulse,fade,slow,splash}.json`. The report names describe the selected test; they are not pass/fail assertions. The component restores playback speed to 1 when unmounted.

## Run on a dedicated simulator

Use an explicit simulator UUID; do not take over another running simulator. Install the demo dependencies after checking out this change:

```sh
npm ci
npm run build
cd demo
npm install
JOLT_BENCHMARK=1 ns build ios --for-device false --release --env.production --no-hmr
cd ..
xcrun simctl install YOUR_SIMULATOR_UUID demo/platforms/ios/build/Release-iphonesimulator/demo.app
xcrun simctl launch YOUR_SIMULATOR_UUID org.nativescript.jolt.benchmark --opacity-rotation
```

Capture all six comparisons with real XCTest taps and real-time `simctl` recording:

```sh
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR_UUID /tmp/JoltOpacityRotation \
  testOpacityRotation testOpacityRotationFade testOpacityRotationSplash testOpacityRotationSlow
python3 benchmarks/ios-opacity-rotation.py --scale 3 /tmp/JoltOpacityRotation/*.mov
```

The analyzer requires NumPy and FFmpeg. It decodes every encoded frame without temporal resampling, verifies the initial marker is 90 pt at the supplied display scale, and counts blue pixels outside its stationary bounds. A three-pixel border and up to five isolated pixels tolerate H.264 ringing. A built-in positive control verifies that a faint displaced blue copy is detected. A nonzero exit identifies footage that needs inspection, or a decode/calibration failure.

This detector is deliberately narrow: it can miss copies fully inside the original marker, very faint artifacts below its color threshold, or non-blue rendering defects. It does not prove correct animation, timing or absence of all artifacts. Inspect the video, including whether the SVGs actually move, as well as the report. Analyze original unscaled footage; the compact documentation video has a different pixel scale.

## Physical device follow-up

Build a signed device variant of the demo under the same benchmark bundle ID using the project's usual signing setup. After installation, launch it explicitly:

```sh
xcrun devicectl device process launch --device YOUR_DEVICE_ID --terminate-existing \
  org.nativescript.jolt.benchmark --opacity-rotation
```

Repeat the same normal-speed, child-fade, plain-view, splash and slow-motion comparisons and record the device model, iOS build and footage. No physical iPhone was connected for this investigation. If it fails, preserve the original video and scene before changing `shouldRasterize` or `allowsGroupOpacity`; compare a direct Core Animation implementation to Jolt, then reduce the failing case. Changing those flags without a failure to compare against would not establish a fix.

## Recorded result — 2026-10-22

Environment: iPhone 17 simulator, iOS 26.0, 1206 × 2622 px at 3×; Xcode 27.0; Jolt beta.14 / base `64c7c7e`; NativeScript Core 9.1.3 and iOS runtime 9.1.0; `@nativescript-community/ui-svg` 0.2.28 and `ui-canvas` 4.6.57. SVGKit 3.1.1 resolved to Akylas/SVGKit commit `58e603a5a3e6e937ff4c8c0f33c0c5a6b3bbdf5b`. This SVG plugin is a demo dependency, not a Jolt library dependency.

| Configuration                              | Frames inspected | Duration | Copies detected |
| ------------------------------------------ | ---------------: | -------: | --------------- |
| SVG, container pulse, normal speed         |              808 |  14.07 s | None            |
| SVG, child pulse, normal speed             |              565 |   9.99 s | None            |
| Plain views, container pulse, normal speed |              566 |  10.04 s | None            |
| SVG, single fade-in, five restarts         |              659 |  11.46 s | None            |
| SVG, ten splash replays                    |              762 |  17.57 s | None            |
| SVG, container pulse, 0.2× speed           |              689 |  12.02 s | None            |

All four XCTest methods passed. Every one of the **4,049 encoded frames** was inspected by the marker detector; visual contact sheets were also reviewed. This is a negative reproduction result, not a before/after fix comparison.

The [native observations](./results/opacity-rotation/ios/opacity-rotation-pulse.json) show `clips=false`, `rasterize=false`, `groupOpacity=true`; parent mode has both `jolt:rotate` and `jolt:opacity`, and child mode only has `jolt:rotate` on the container. No group-opacity or rasterization override was needed to obtain these recordings. These observations do not rule out an OS, plugin, or application-specific compositing problem.

[Frame results and original recording hashes](./results/opacity-rotation/ios/frames.json) are committed. Original `.mov` files remain in the local capture directory; the [normal-speed documentation clip](../docs/public/media/opacity-rotation-ios.mp4) is a 14.07 s H.264 recording, 640 × 1392, embedded in both language versions of the animation guide. Its controls and effect were inspected and it was fully decoded with FFmpeg.
