# Native shader inputs, liquid masks, resize and video

Validation for #388, #389, #390 and #391, based on `main` `ab1400b`. The maintainer explicitly accepted **simulator/emulator-only validation** for this PR on 2026-11-03. Nothing here establishes physical-device performance. These capabilities are native iOS/Android additions; the Web API is unchanged.

## Environment and execution

- iOS: dedicated iPhone 17 Pro simulator, iOS 26.2, release NativeScript 9.1.0 app, Core 9.1.3, production JS and no HMR. Metal effects render inside the real native Image. Video is silent local SDR H.264, 640×360 at 24 fps, decoded by AVFoundation. The output Image alternates between 320×260 and 250×210 DIPs.
- Android: dedicated read-only API 36 arm64 emulator instance, NativeScript 9.1.1, Core 9.1.3, debug native build with production JS and no HMR. The shader runs through hardware-accelerated Android Canvas/RuntimeShader, with the emulator's SwiftShader GPU backend. No Android video support is claimed.
- The Swift/XCTest and ADB scripts inject actual OS taps and scroll gestures into the normal demo (`--recipe=shader-textures`). They do not animate through test-only renderers or manufacture video output. Fixtures are licensed Big Buck Bunny excerpts; attribution is in `demo/src/assets/studio/README.md`.

The native renderer accepts named scalar inputs (`progress`, `amplitude`, `radius`, `originX`, `originY`). Live springs reuse the compiled Jolt spring node/binding machinery; native scroll observations go directly to the image renderer. There is no application or library JavaScript setter on each frame. A private demo-only wrapper counts requests to the Jolt JS observation clock. Explicit source changes, reporting buttons and lifecycle boundaries still execute JS. Apps that request their own `subscribe()` or scroll listeners retain those callbacks. Native UI work can still contend with the main thread.

## Instrumented results

The checked reports are in [`results/shader-textures`](./results/shader-textures). Run `python3 benchmarks/verify-shader-textures.py benchmarks/results/shader-textures` to assert them and regenerate `summary.json`.

| Check                                                                   | iOS simulator | Android emulator |
| ----------------------------------------------------------------------- | ------------: | ---------------: |
| JS observation-frame requests during native input checks                |             0 |                0 |
| Native parameter writes in measured input snapshots                     |            84 |               56 |
| JS requests with the explicit observer negative control                 |            68 |               66 |
| Completed resize events (some style/layout updates coalesce separately) |            13 |               15 |
| Paused progress through repeated size/padding/border changes            |           0.5 |              0.5 |
| Owned texture bytes after every stop                                    |             0 |                0 |
| Remaining application-owned spring nodes after effect stop              |             1 |                1 |

The remaining node is the demo's retained application spring, reused by the next effect. The effect's follower node and native bindings are removed. The page disposes its own spring on actual unload. Twelve repeated resize cycles are included on each platform. The iOS video checks also background and reactivate the actual app, resize while paused, resume and replace the source six times.

After pausing, the iOS video remained at **frame 136 / 5.429 seconds** throughout background/foreground and resize. It consumed 459 video frames over the complete measurement run. The paused video regression was detected by the first capture and corrected before the reviewed recordings.

## Video cost and memory

The iOS measurements below come from a separate run **without screen recording**. They include the native interaction runner and emulator host load. Draw intervals retain the most recent 512 active callbacks; they are neither GPU duration nor presentation latency. CPU time includes frame acquisition and command encoding. GPU time comes from completed Metal command buffers in the simulator.

| Metric                                                     |          Observed |
| ---------------------------------------------------------- | ----------------: |
| Draw callbacks                                             |             1,104 |
| Median active draw interval                                |          16.67 ms |
| p95 active draw interval                                   |          16.89 ms |
| Total CPU draw/encoding time                               |         676.50 ms |
| CPU time per draw callback                                 |           0.61 ms |
| Accumulated completed Metal GPU time                       |         132.70 ms |
| Process physical footprint before video                    | 128,425,856 bytes |
| Maximum sampled process footprint during video/replacement | 165,912,616 bytes |
| Process footprint after final stop                         | 140,255,344 bytes |
| Known texture peak estimate                                |   3,916,800 bytes |
| Current video texture (640×360 BGRA)                       |     921,600 bytes |
| Owned texture bytes after stop                             |                 0 |

Process memory remains above the pre-video sample after stop; decoder/framework caches and asynchronous GPU retirement are outside the owned-texture counter. This is not a claim that total process memory returns to baseline, nor a proof of physical-device memory budgets. The video peak is a conservative in-flight texture estimate, not measured total decoder allocation. Both decoded frames and output surfaces have a 4,194,304-pixel guard. Decode allocation itself is managed by AVFoundation.

## Visual inspection

English recordings are embedded in the EN/PT guides (and the existing ES/ZH media parity). The full MP4s decode successfully; representative frame sequences across the clips were inspected. They show smooth reversible fusion, background visible through transparent pixels, preserved paused/progress state during resize, actual decoded video changing under a held ripple, video pause/resume, replacement and restoration. Captures retain original speed. The Android export only removes the idle tail after the last interaction.

- `shader-inputs-liquid-mask-ios.mp4`: iOS simulator, XCTest spring reversal, native scroll, seek, paused/playing resize and stop.
- `shader-inputs-liquid-mask-android.mp4`: API 36 emulator, ADB spring/scroll input, reversible mask, resize and stop.
- `shader-video-ios.mp4`: iOS simulator, real video texture, pause, resize, resume, source replacement and poster restoration.

## Reproduce

Build the library, install the normal demo with `JOLT_BENCHMARK=1` and `--env.production --no-hmr`, and select dedicated device IDs. Build iOS/Android sequentially because NativeScript shares generated assets. Android template resources are generated locally as documented in the existing benchmark setup.

```sh
# iOS recordings, after installing the normal native demo:
python3 benchmarks/docs-record-ios.py SIMULATOR_UUID /tmp/JoltShaderRecordings testShaderTextures

# iOS measurements without recording (generate the project with docs-ios-ui.rb):
xcodebuild test -project /tmp/JoltShaderTests/DocsTests.xcodeproj -scheme DocsTests \
  -destination 'platform=iOS Simulator,id=SIMULATOR_UUID' \
  -parallel-testing-enabled NO -only-testing:DocsTests/DocsTests/testShaderTextureLifecycle \
  CODE_SIGNING_ALLOWED=NO

# Android actual inputs; --record is optional:
python3 benchmarks/shader-textures-android.py EMULATOR_SERIAL /tmp/JoltShaderAndroid --record
```

The iOS report is `Documents/jolt-shader-textures.json` in the simulator app container. Android writes the same filename in its external files directory. Copy the reports as `ios.json`/`android.json` into a results directory, then run the verifier. On iOS, capture measurement reports before launching the recording run, which starts a new session.

Native source references: [AVPlayerItemVideoOutput](https://developer.apple.com/documentation/avfoundation/avplayeritemvideooutput), [CVMetalTextureCache](https://developer.apple.com/documentation/corevideo/cvmetaltexturecache), [AGSL coordinates and uniforms](https://developer.android.com/develop/ui/views/graphics/agsl/agsl-vs-glsl).
