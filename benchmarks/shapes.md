# Native shape drawing and morphing (#28)

The optional shapes entry owns a vector surface over an existing NativeScript view. It uses explicit Core Animation path/trim keyframes on iOS and a compiled drawable with a native `ValueAnimator` on Android. Both consume the same normalized SVG geometry and sampled scalar curve. No JavaScript frame observer or new runtime dependency is added.

## Reproduce

Build the ordinary Vue demo with `JOLT_BENCHMARK=1`, sequentially by platform, following `CONTRIBUTING.md`. Open the `shapes` example. `--shape-audit` on iOS, or the `shape-audit=true` string extra on Android, adds boundary-only Snapshot, Midpoint, Resize, Repeat and Reject controls. The report goes to `Documents/shape-audit.json` on iOS and the app's external files directory on Android.

```sh
npm run typecheck
npm run benchmark:typecheck
npm test -- --maxWorkers=4
npm run build
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR /tmp/JoltShapes \
  testShapeChecks testShapes testShapesMount
python3 benchmarks/shapes-android.py YOUR_EMULATOR /tmp/JoltShapes audit
python3 benchmarks/shapes-android.py YOUR_EMULATOR /tmp/JoltShapes record
python3 benchmarks/shapes-android.py YOUR_EMULATOR /tmp/JoltShapes mount
python3 benchmarks/verify-shapes.py \
  benchmarks/results/shapes/ios.json \
  benchmarks/results/shapes/android.json
npm run docs:check-media
npm run docs:build
```

Choose English through the preview's language picker before Android capture. XCTest chooses English for its recording. After Home, the Android runner waits until the activity reports `state=STOPPED` before bringing it back, so the foreground check always exercises the unload and reload path rather than a still-paused activity. A separate checkpoint pauses a stroke while it is drawing, without leaving the app, and resumes it: the checker takes the progress recorded at `play`, adds the wall-clock time until the next snapshot over the 1,800 ms linear draw and requires the native stroke within 0.08 of that value, with at least one such resume measured while the stroke was still drawing. Before #264 Android failed it: `ShapeLayer.control(time, false)` seeked and then resumed a `ValueAnimator` that was paused while pulsing, and Android shifts its start time by the paused duration on the next frame, so the surface held at zero until the JavaScript clock ended the program (check `strokeEnd` 0.188 paused, 0 at 640 ms after resume on this emulator). `ShapeLayer`, `GradientLayer` and `BlurEffect` now rebuild their animator on resume and seek the new one to the resumed time (gradients keep their remaining start delay); a seek on a running animator still uses `setCurrentPlayTime`. The Android runner reads the report only once it ends with `disposed`, because `cat` can catch the file mid-write. The runners inject actual OS taps; they do not substitute a video renderer for the app. Copy the iOS audit out of the simulator's data container; Android saves its report automatically and restores the original touch-indicator setting. Reuse the reviewed English clips in both documentation languages and attach both directly to the PR.

## Evidence and oracle

The committed reports were captured on 2026-10-31 on an iPhone 17 Pro simulator (iOS 26.0) and an Android 16 (API 36) emulator, with the four surfaces created on mount, before layout (#254) and the mid-flight resume checkpoint (#264). Both passed the same native oracle:

| Check                                                     | iOS                | Android               |
| --------------------------------------------------------- | ------------------ | --------------------- |
| Native surfaces / snapshot checkpoints                    | 4 / 15             | 4 / 15                |
| Created before layout, attached on load                   | 0 → 4 surfaces     | 0 → 4 surfaces        |
| Actual native path bounds at the paused midpoint          | `[34, 25, 41, 50]` | `[34, 25, 41, 50]`    |
| Interrupted morph retains its presentation                | Passed             | Passed                |
| Resize round trip                                         | 150 → 100 → 150 pt | ~150 → ~100 → ~150 dp |
| Delay pause, reverse repeat, Reduce Motion                | Passed             | Passed                |
| Mid-flight pause holds, resume continues from it          | Passed             | Passed                |
| Background unload and foreground continuation             | Passed             | Passed                |
| Surfaces / animation objects / scope resources after exit | 0 / 0 / 0          | 0 / 0 / 0             |
| Corrupted native geometry negative control                | Rejected           | Rejected              |

Android sizes reflect physical-pixel rounding at 2.625 density. The library suite passed 1,477 tests; both type checks, the package build and release demo builds passed. These results describe the local validation, independently of GitHub CI.

The unit suite covers SVG normalization, elliptical-arc conversion, exact endpoints, reflected curve controls, multiple subpaths, invalid input/topology, validation before ownership changes, presentation-based retargeting, delayed/reverse playback, pause/seek, native-view replacement, Reduce Motion, scope disposal and background unload/reload. Existing single-subpath motion-path tests run against the reused scanner/arc implementation.

Native audits operate four real surfaces: a compound filled play/pause icon, a single-contour checkmark, an arc-based ring and a Bézier underline. At the midpoint, the native path bounds must be `[34, 25, 41, 50]` in viewBox units and all three strokes must be 50% drawn. iOS reads the actual presentation path/trim; Android reads its drawable's current geometry and path bounds. The checker compares those bounds with independent expected geometry, then repeats the comparison across pauses, invalid morph rejection and a size round trip.

The audit also interrupts a morph while it is moving, checks continuity across retargeting, pauses a stroke mid-flight and requires the resumed stroke to match the paused progress plus the elapsed time, pauses during a delay, verifies the reverse repeat returns to zero, exercises Reduce Motion and background/foreground continuation, and requires zero native surfaces, playback objects and scope resources after leaving the example. A deliberately corrupted native bounding box must fail the same checker.

`shape()` accepts a view that has not loaded yet (#254). The demo creates its four surfaces in `onMounted`, before layout; the audit records `created` with zero native surfaces and every surface `attached: false`, then `attached` once each host has loaded and measured, before the first snapshot. The checker requires that order, four native surfaces at `attached` and positive host sizes. `testShapesMount` and the Android `mount` mode record the launch itself, so the guide's `shapes-mount-*` clips show the surfaces already drawn when the screen appears, followed by two real Draw again taps. An animation requested before the view loads starts when the surface attaches; the unit suite covers that path, a pause requested before load and an instant animation completing on attach.

Backgrounding can trigger a NativeScript view unload. In that case the surface is released while the paused program retains its position; foreground loading rebuilds the surface and resumes the remaining animation. Ordinary unload/replacement cancels playback and restores the held geometry on load. A dedicated integration regression covers this distinction.

These are simulator/emulator correctness and visual runs, not physical-device frame-time, battery or memory measurements. Native animation-object counts differ by backend: iOS uses path/trim keyframes plus a presentation marker; Android uses one animator per running shape. Counts include retained paused animations, not an assertion that their frames are running.

## Bounded contract

Geometry is limited to 20,000 input characters, 256 normalized commands and ±1,000,000 coordinates. Sampling is capped at 262,144 scalar components per program. Paths normalize once on commands, not per frame. Android reuses its paths, measures and arrays; trim-only playback does not rebuild the full path. The iOS marker is replaced at each new program so immediate consecutive retargets cannot read a previous program's presentation progress.

Morphs require matching normalized topology. Partial trim accepts one contour; compound paths can fill, draw their complete stroke and morph. Styling/viewBox are immutable per handle. The overlay preserves host background, transforms and input, clips to the host and scales uniformly with layout. Pixel deformation does not change hit geometry.

No CI jobs, native frameworks or longer timeouts are introduced. The existing CI builds the helper and runs the unit suite; the native interaction probes remain local and reproducible.
