# Native capability validation: #297–#300

This change extends four bounded native contracts together. It is development work for the next release; the published `0.1.0-rc.5` package does not include these APIs. No Web entry point or framework adapter changes.

## Scope and evidence

| Issue | Delivered contract                                                                                                                                                                                                                                                    | Evidence                                                                                                                                                                                                             |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #297  | Retained `springValue()` mappings to solid `backgroundColor` and uniform circular `borderRadius`, alongside transform/opacity channels. Premultiplied OKLab color interpolation with exact endpoints, alpha and clamping.                                             | 628 production TypeScript/C/Java color comparisons; native paint reads, rapid retargeting, pause, external ownership, Reduce Motion and node cleanup; binding/reload host regressions.                               |
| #298  | `seekableTimeline()` with explicit finite numeric view/value tracks, nested descriptors and named view layers. Native playback after seeking, partial takeover, coherent delayed/overlapping channels, paused endpoint rewind and terminal completed/stopped handles. | Controlled-clock tests, iOS presentation-layer/Android native getter samples, a deliberately wrong geometry checkpoint, timeScale/repeats and unload cleanup. Actual slider input recordings.                        |
| #299  | Real width/height/auto transitions for direct children of non-wrapping row/column FlexboxLayout. Animated main-axis children opt out of grow/shrink; siblings receive the remaining space. Interruption inherits current curve velocity.                              | Native row/column geometry and sibling allocation, pause/resume, intrinsic text, active parent resize, large text and Reduce Motion; existing 20 size checks remain in Native CI.                                    |
| #300  | Sparse elastic center-to-center body links with stable IDs, explicit rest lengths, mass-aware equal/opposite forces, native damping/guides and replacement/removal.                                                                                                   | 52 compiled C/Java world fixtures including pair momentum, chains, drag/release, anchors, collisions, resize and negative controls. Native three-body input, guide counts, pause/Reduce Motion and endpoint cleanup. |

The public limits and lifecycle policies are in the [live binding](../docs/guide/live-springs.md#live-paint), [scene](../docs/guide/sequences.md#seekable-scenes), [size](../docs/guide/size.md#flexbox-layout) and [body spring](../docs/guide/physics-attachments.md#body-springs) guides. These pages and their recordings are maintained in English, Portuguese, Spanish and Simplified Chinese.

## Environment and retained reports

Validation uses NativeScript Core 9.1.3, iOS runtime 9.1.0 and Android runtime 9.1.1, production JavaScript and no HMR. Devices are a dedicated **iPhone 17 simulator / iOS 26.2** and a dedicated **Android 16 emulator**. Android's debuggable native shell allows `run-as` report extraction; this is not an R8 or signed-release test.

`results/native-capabilities/` contains:

- `ci-{ios,android}-baseline.json`, `ci-{ios,android}-negative-control.json` and `ci-{ios,android}-sizes.json`: full Native CI and its intentional failure. The baseline has 13 groups, including the 20 existing size assertions and 19 additional capability assertions.
- `ios.json` and `android.json`: the initial 17-check standalone demo run, before adding two more Flexbox resize/large-text/Reduce Motion checks to the final CI run. Timestamps distinguish these runs.
- `{ios,android}-input.json`: actual touch sequences from the normal demo. Both show two native drags/releases, two body-link guides during playback and zero guides after disposal. There is no per-frame JavaScript observation in this demo; snapshots are captured only at input/lifecycle boundaries.
- `android-large-text-landscape.json`: the standalone native demo with system font scale 1.5 and landscape rotation on the dedicated Android emulator; all 17 original assertions passed. Settings were restored afterward. The final row/column probes additionally resize the parent during playback with 30-point text.
- `kernels.json`: 52 production C/Java fixture results and negative-control rejection, including missing body-spring force.
- `colors.json`: 628 production core/native color comparisons.
- `media.json`: codec, dimensions, duration and size of the eight reviewed H.264 clips. Every clip was decoded end to end and visually inspected across its duration.

Reports from a dirty development checkout retain the base commit. PR Native CI reruns the same production probes on the submitted revision; local reports are not presented as CI for an untested commit.

## Reproduction

```sh
npm ci
npm run build
npm run typecheck
npm run benchmark:typecheck
npm test
npm run core:check
npm run package:check
python3 benchmarks/verify-live-color.py
python3 benchmarks/verify-circle-math.py
python3 -m unittest discover -s benchmarks -p test_native_ci.py
npm run docs:check-media
npm run docs:build
```

Follow [Native CI](./native-ci.md) to build the isolated fixture and run baseline plus negative control with explicit dedicated simulator/emulator IDs. The new checks are part of the existing workflow; no separate CI device job is needed. Build iOS and Android sequentially because NativeScript shares generated resources.

For visual inspection, build the normal Vue demo with `JOLT_BENCHMARK=1` and no probe entry-point flag. Open **Native motion lab** in the catalog, or use `--native-capabilities=0|1|2|3` on iOS and `--es native-capabilities 0|1|2|3` on Android. The modes are paint, seek, flex and linked bodies. Add `--native-audit` on iOS / `--es native-audit true` on Android to execute the native measurements and write `jolt-native-capabilities.json` in the app's documents/files directory.

```sh
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR_UUID /tmp/JoltNativeClips \
  testNativePaint testNativeSeek testNativeFlex testNativeBodySprings
python3 benchmarks/native-capabilities-android.py emulator-PORT /tmp/JoltNativeClips
# Optional: re-record one Android mode only.
python3 benchmarks/native-capabilities-android.py emulator-PORT /tmp/JoltNativeClips seekable-scene
```

The iOS runner uses XCTest input and simctl capture. Android uses ADB taps/swipes and screenrecord, restores touch indicators and avoids starting slider swipes inside the system-back edge regions. English recordings are reused for all documentation locales and attached as playable PR videos. Clips preserve the source playback timing and show native rendering; none are physical-device captures.

## Practical limits

Live paint and body forces share the platform UI thread with NativeScript JavaScript. They remove the application frame observer; they do not make the UI thread independent of JavaScript. Seekable scenes precompile native tracks and use shared playback controls, while arbitrary callbacks, haptics, live followers and external child controls remain excluded.

Flexbox animation deliberately performs real measurement/layout through JavaScript on the UI thread. The demonstrated workload is one animated text container and one flexible sibling, with row/column variants in the probe. The existing implementation performs two root measurements and one explicit layout per active operation/frame, plus framework passes; larger trees or multiple operations increase cost. No Flexbox throughput, physical-device FPS, 120 Hz, memory-pressure or renderer independence claim is made here.

Body links use the existing bounded 240 Hz fixed step and collision/speed limits, at most 32 links and four per body. Damping is solved along the line between centers. These are elastic forces, not rigid constraints. The compiled fixtures verify numerical behavior, not hardware refresh rate. Removing/reparenting an endpoint disposes its linked world; temporary unload with unchanged membership suspends it. Disposal releases input hooks, guides and native world resources.
