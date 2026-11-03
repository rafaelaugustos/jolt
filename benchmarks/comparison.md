# First cross-stack comparison

The first scenario is `linear-ping-pong-v1`: one 48 × 48 logical-pixel tile translates 240 units and changes opacity from 1 to 0.4, with 1000 ms linear legs, reversing indefinitely. Start resets it; Stop holds its current pose. The motion is deliberately simple enough to match across engines. It does not establish gallery, list or gesture performance.

The user selected **simulators/emulators only** for this delivery. Results must identify that environment; they are not physical-device rankings, power measurements or panel input-to-photon latency. The same English native recordings are embedded in the translated documentation.

## Pinned apps and builds

[`comparison/scenario.json`](./comparison/scenario.json) records versions, visible content and collection settings. Sources and lockfiles live beside it. The Jolt app uses the current locally built candidate. React Native uses Fabric/Hermes and Reanimated worklets; Flutter uses its release engine. No debug app belongs in the primary comparison.

After the root build, prepare with Node 22 and the exact Flutter revision in the scenario:

```sh
python3 benchmarks/comparison/prepare.py /absolute/path/to/flutter
```

Build from each project directory, with `ANDROID_HOME` set to the Android SDK:

```sh
# .local/comparison/flutter
flutter build apk --release --target-platform android-arm64

# .local/comparison/react-native/android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a --max-workers=2

# benchmarks/comparison/jolt — this key is only a local benchmark test key.
npx ns build android --release --env.production --no-hmr \
  --key-store-path ../../../.local/comparison/react-native/android/app/debug.keystore \
  --key-store-password android --key-store-alias androiddebugkey --key-store-alias-password android
```

Install the three APKs on the same selected Android emulator. Keep OS animation scales at 1× and touch overlays off. Pause other builds, recordings and device automation during primary collection. The collector checks emulator selection and rejects debuggable packages.

```sh
python3 benchmarks/comparison/android.py emulator-5590 /tmp/jolt-comparison /absolute/path/to/trace_processor
```

The collector admits a run only when the one-minute host load is at most 0.75 × logical CPU count before launching the app. Aggregate sampled compiler CPU must stay at most 25% of total logical CPU capacity (100% CPU means one logical CPU; compiler processes below 10% are ignored). During playback the load average is diagnostic, not a rejection criterion: it includes the measured emulator's own workload. Samples cover admission, three input boundaries and the end. Rejected attempts and protocol changes are retained separately. This is a coarse shared-host guard, not an exclusive-host or thermal guarantee.

The collector rotates stack and phase order for two repetitions, warms each animation for five seconds and records a 30-second Perfetto window. At 5, 15 and 25 seconds it taps Start in the normal phase (a reset), or the phase's 300 ms blocking button. UI coordinates come from actual native accessibility bounds. Test controls have static backgrounds and no ripple/elevation animations: a RenderThread button effect can keep submitting buffers while the measured tile is stalled. The Jolt workload uses Android uptime milliseconds and logs its measured duration at each boundary. Startup/automation/recording overhead is excluded from the measured motion window. `--app`, `--seconds` and `--repetitions` are available for smoke checks; label such checks separately from the full protocol.

## What each blocking probe means

| Stack                     | App-runtime probe                                           | Platform UI-thread probe                            |
| ------------------------- | ----------------------------------------------------------- | --------------------------------------------------- |
| Jolt / NativeScript       | Busy application JavaScript; shares the Android main thread | The same thread and workload                        |
| React Native / Reanimated | Busy application JavaScript; separate from UI worklets      | Busy Reanimated UI worklet                          |
| Flutter                   | Busy Dart UI isolate                                        | Busy Android main thread through a platform channel |

These are separate experiments. Running native code is not evidence that a view keeps updating through a blocked thread. The Flutter handler uses the default platform channel task queue, on the platform main thread ([Flutter channel threading](https://docs.flutter.dev/platform-integration/platform-channels)). Reanimated's worklet transform uses the installed [Worklets Babel plugin](https://docs.swmansion.com/react-native-reanimated/docs/guides/migration-from-3.x/).

## Application integration

| Stack                     | Motion and lifecycle supplied by the app                                                                              | Additional setup in this fixture                                                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Jolt / NativeScript       | One `animate` handle, public `set` for restart and `stop` on page unload. Keyframes/loop timing are compiled by Jolt. | Normal NativeScript platform build plus the local Jolt package/native plugin. The two blocking buttons execute on the same Android main thread. |
| React Native / Reanimated | A shared progress value, one animated style, repeating timing and `cancelAnimation` during replacement/unmount.       | Fabric/Hermes release app and the Worklets Babel plugin. A separate UI worklet implements the UI-thread probe.                                  |
| Flutter                   | An `AnimationController`, `AnimatedBuilder`, transform/opacity widgets and controller disposal.                       | Standard release Flutter build. A small Android MethodChannel handler exists only for the platform-thread blocking probe.                       |

Each app includes labelled accessible controls, explicit stop/restart and the same animated tile/trajectory. Reduce Motion is deliberately disabled for this performance configuration; this is not an accessibility-default recommendation. The comparison keeps source/setup requirements visible instead of treating line counts as developer effort. App controls use static, platform-specific styling; their ripple/elevation animations are disabled to keep the measured presentation signal attributable to the tile.

## Read the measurements

- `presentationGapMs` uses actual `PresentFenceSignaled` events from the app’s dominant SurfaceFlinger layer. `queueToPresentMs` joins its buffer `Queue` and presentation events by layer/frame number. These common metrics work across all three apps; they measure emulated buffer presentation, not physical scanout or input latency. Invalid and unmatched timestamps are excluded, and raw rows are retained.
- `appFrameTimelineDurationMs` is an optional rendering interval ending at GPU completion/posting, not presentation. The tested Flutter SurfaceView has no app FrameTimeline records, so those fields remain unavailable. Do not compare this optional interval against another stack’s presentation fences.
- `appDeadlineMissed` counts the specific app deadline classification. Do not relabel every late emulator presentation as an application failure. See [FrameTimeline](https://perfetto.dev/docs/data-sources/frametimeline).
- `inputHandlingMs` measures input received → acknowledgement sent. `inputAssociatedPresentMs` uses Perfetto's input/frame association when available. Null is unavailable, not zero. The associated frame can contain button feedback; it does not identify the first changed tile pixel or physical panel response. See [Perfetto input tables](https://perfetto.dev/docs/analysis/stdlib-docs).
- Process CPU comes from scheduler slices; memory includes pre/post PSS dumps and sampled process RSS. Sampled RSS is not continuous peak texture memory. `am start -W` startup output is retained as Android activity timing, not mislabeled first meaningful content.
- Full traces are gzip-compressed without altering timestamps. The report records hashes, trace-health warnings, raw frame/input/memory rows, package flags, device/display configuration and tool versions. Screen recordings are separate visual evidence, not primary performance samples.

Compare per-run distributions and variability before setting budgets. A single average or one stack's best run is insufficient. Future scenarios include interruptible springs, stagger, scrolling headers, sheets, image effects and the recycled gallery. Reanimated's experimental platform CSS transition path must be a separate configuration when a transition scenario is added; this first scenario uses a repeating timing animation, not CSS transitions.

## Recorded baseline

The [complete results and raw traces](results/comparison-2026-11-03/README.md) contain all 18 accepted runs and per-run variability. Reproduce the summary with `python3 benchmarks/comparison/report.py benchmarks/results/comparison-2026-11-03`. The protocol history explicitly records repetition and host-guard changes; this is an exploratory shared-host emulator baseline. Rejected-attempt records are included, with their raw traces retained separately in the task workspace.
