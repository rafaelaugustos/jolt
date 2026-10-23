# SceneKit environment and uniform validation

Issue #200, 2026-10-23. Two optional `/native` adapters reuse the external-property player and ownership map. `sceneKitEnvironmentIntensity` writes the scene environment multiplier; `sceneKitUniform` writes one declared Metal scalar/vector input atomically. Compiled Objective-C performs playback writes on the main thread with implicit SceneKit actions disabled.

## Backend and scope

The motivating car consumer uses a fragment `shaderModifiers` scalar named `cabinView`, initialized with numeric KVC, rather than a custom `SCNProgram`. Its JavaScript `inside` subscription also sets environment intensity from 1.6 to 0.45. The EN/PT guides show that migration with a continuous cabin blend. The original threshold toggle is intentionally not presented as equivalent to a sampled continuous mapping. Airflow emission/transparency already use other adapters.

The supported schema is a literal `float`, `float2`, `float3` or `float4` declaration under `#pragma arguments` on `SCNMaterial`/`SCNGeometry`. Applications supply finite ranges, units, Reduced Motion policy and initial values. Arbitrary KVC, macros/conditional schemas, custom programs, textures, matrices and structs are excluded. Ordinary motion values, numeric derivations and playback progress are supported. Retained live springs/gesture sources reject explicitly; no observer fallback is installed.

## Native evidence

Release simulator app, NativeScript Core 9.1.3 / iOS runtime 9.1.0, iOS 26.0. These are simulator correctness checks, not physical-device frame-rate measurements. The plugin baseline remains iOS 13+; app/runtime requirements may be higher.

[`ios.json`](./results/scene-shaders/ios.json) records all 11 conformance groups passing with **zero JS observation-frame requests**. Every group checks active native players and undisposed sinks against its initial zero baseline. JS timers sample results; they do not write frames.

- Real environment image plus physically based material: multipliers 0, 0.45, 1.6 and 4 produce mean rendered luminance 0.0499, 0.1510, 0.2448 and 0.3509. This establishes visible behavior above one on this runtime, not calibrated HDR units.
- Shared source: native environment, scalar and float3 tracks advance together. Paused midpoint reads 1.025, 0.5 and `[0.5, 0.5, 0.5]`; resume advances and native write instrumentation increases without observation frames.
- Invalid targets, names, schemas and values reject before taking over a valid owner. Different uniforms remain independent; replacing one wrapper preserves continuity and older disposal cannot stop the replacement.
- SCNGeometry float2/float4 round-trip coherently. SceneKit may internally box SCNVector3/4 as CGRect, so reads use SceneKit vector accessors after validating the declared arity. Float-vector boundary rounding is tolerated and normalized.
- Changed shader source invalidates playback; a new initialized adapter works. Missing initialization, out-of-range native values, conditional schemas and an actual native custom-program target reject.
- Environment image replacement/removal preserves multiplier ownership. Derived/playback-progress sources work; retained live sources reject without replacing the valid binding.
- Native-only fixtures release the scene/material while retaining sinks; both sinks become dead after flushing SceneKit transactions and allowing a run-loop turn.
- Explicit spatial/appearance Reduced Motion policies and time scale are exercised.

Actual home/foreground navigation passes in [`ios-background.json`](./results/scene-shaders/ios-background.json): scope suspension holds the environment value and native write count, then explicit resume advances it; observer frames remain zero and resources return to baseline. The demo ignores a repeated `loaded` event for the same view on foregrounding, preserving its existing bindings.

The visual test plus four additional scene recreation cycles pass; [`ios-navigation.json`](./results/scene-shaders/ios-navigation.json) records **0 players and 0 sinks** after final teardown. Local validation also passed 1,109 unit tests, core/benchmark typechecks, the library and release iOS app builds, formatting, media coverage (50 guides per language, 99 recordings) and the production docs build.

## Recording and reproduction

The 22.37-second H.264 [recording](../docs/public/media/scene-shaders-ios.mp4) uses real XCTest button taps: cabin/studio playback, pause, midpoint seek, resume, environment image swap and scene recreation. Inspected frames show the environment brightness, cabin blend and signal vector changing. Playback speed is unchanged; the complete delivered video decodes with FFmpeg. Both language guides embed it.

Build the root and release simulator demo with Node 22 and Xcode, then install the app on an explicitly selected simulator:

```sh
npm ci
npm run build
cd demo
npm ci
JOLT_BENCHMARK=1 ns build ios --for-device false --release --env.production --no-hmr
xcrun simctl install SIMULATOR_UUID platforms/ios/build/Release-iphonesimulator/demo.app
cd ..
python3 benchmarks/docs-record-ios.py SIMULATOR_UUID /tmp/shader-checks testSceneShaderChecks
```

Copy `Documents/jolt-scene-shader.json` from the app container before running background validation, which replaces that report:

```sh
python3 benchmarks/docs-record-ios.py SIMULATOR_UUID /tmp/shader-background testSceneShaderBackground
python3 benchmarks/docs-record-ios.py SIMULATOR_UUID /tmp/shader-video testSceneShader
npm run docs:check-media
npm run docs:build
```

The recording test also repeats scene destruction/recreation four more times and checks cleanup after every destruction. The final `Documents/jolt-shader-navigation.json` records zero native players/sinks. The isolated gallery entry is **SceneKit environment and shaders**, or launch with `--scene-shader`; `--shader-checks=all` and `--shader-checks=background` select probes.
