# Jolt Motion Studio

The normal app entry opens the branded showcase: splash, Studio, searchable Collection, and 54 individual experiments. It uses the local Jolt build and `vue-router-ns@0.1.0-rc.2`; no launch argument is needed. The assistant remains an explicit `--screen=home` example and `--playground` preserves the older all-in-one page for probes.

Build the library from the repository root, install `demo` dependencies, and run with NativeScript CLI. iOS resources (display name, icons and launch screen) are tracked. Android template resources are still generated locally, as in the existing demo workflow. Build native platforms sequentially in a shared demo directory.

```sh
npm ci
npm run build
cd demo
npm install
ns run ios
```

The showcase source is in `src/showcase`: `catalog.ts` owns the experiment inventory; the router owns three native page routes; `Showcase.vue` keeps the first page mounted behind the splash. Reusable examples stay in `src/components`. Native route lifecycle stops the home animation scope and unmounts detail experiments on departure.

## Appearance

The ◐ control in the Studio header opens Light, Dark and System options. System is the default; explicit choices persist locally. Navigation chrome, search, typography and experiment controls update without remounting example components. Illustration/animation stages keep their authored colors. iOS theme changes use Jolt’s circular reveal over a temporary snapshot of the outgoing appearance, starting at the selected control (or page center for system changes). Navigation, suspension and replacement transitions clean up the mask and snapshot. Reduced Motion and Android use immediate changes.

Validate the appearance flow on a dedicated simulator with `testShowcaseAppearance` using the recorder below. It also checks relaunch persistence, live system changes and Portuguese labels. Recording handshakes are scoped by simulator UUID, so another worktree can record on a different device.

## Native walkthrough

Build a release simulator app with `JOLT_BENCHMARK=1`, install it on an explicitly selected simulator, then run:

```sh
python3 benchmarks/docs-record-ios.py SIMULATOR_UUID /tmp/jolt-showcase testShowcase
```

The test starts without arguments, records the browsing flow, exercises springs/gestures/SceneKit, and verifies another cold launch. A separate simulator recording captures the splash without XCTest launch synchronization. The reviewed iOS clip is embedded in both demo guides. New shell validation is iOS simulator evidence, not an Android or physical-device performance claim.

## Studio interiors and local review

`MotionStudio.vue` supplies the spring, preset, color and decoration stages. `SceneStudio.vue` shares a native SceneKit stage across camera, lighting and shader examples, with native property adapters and lifecycle disposal. It optionally loads `App_Resources/iOS/preview-car.usdz` from a local authorized copy of the separate `jolt-car` project. That asset is ignored and not redistributed; without it the demo renders a procedural car. Studio lighting is generated in code. The collection’s Maps & 3D camera tab reuses this studio and animates the camera pose; the isolated legacy fixture retains its simpler geometry.

Run the visual checks locally on a dedicated simulator (these are not added to CI):

```sh
python3 benchmarks/docs-record-ios.py SIMULATOR_UUID /tmp/jolt-studio-audit testShowcaseAudit
python3 benchmarks/docs-record-ios.py SIMULATOR_UUID /tmp/jolt-studio-recordings testAtelier testMotionStudio testShowcase testShowcaseIconLaunch testShowcaseInteriors testShowcaseCameraOrbit testShowcaseNativeReentry
```

The audit cold-opens all 54 routes and retains a screenshot per example. `--showcase-audit` writes Vue lifecycle errors to `Documents/jolt-showcase-audit.json`; inspect that report as well as XCTest results. Use `--showcase-example=scene-camera` to open a route directly for review. Normal icon launches still open Studio. Native element registration lives in `src/native-elements.ts` and runs once per process, so reopening routed examples does not register the same view twice. The interaction suite records dedicated detail clips, camera playback, scene reentry, a montage of other interiors, and the walkthrough; captions in both demo guides distinguish the local model and simulator evidence.
