# Retained native paint: #346

Available since **0.1.0-rc.9**. The retained native spring now drives background, border and plain text color, uniform/individual border widths and circular corner radii. Independent edge keys apply to live spring bindings; finite native animation retains its existing public property set. The four translated live-spring guides document target requirements and shorthand ownership.

The Mavis #191 regression is covered with a root-value border-color binding alongside retained background, asymmetric corners, width, text and scale. Previously unrelated border changes detached background/radius. Style listeners now cancel only the channel they own and reapply retained native paint after Core replaces its background representation. Loaded native targets are preflighted before installation. iOS shares a retained paint surface; Android writes Core's drawable fields through the existing native targets.

## Evidence

- `results/live-paint-346/ios.json`: 24 checks on an iPhone 17 Pro simulator, iOS 26.2.
- `results/live-paint-346/android.json`: the same 24 checks on an Android 16 emulator.
- Five new groups measure actual native layer paths/colors or drawable fields: mixed root/live paint; stale cleanup after replacement; pause and application suspend/resume events; real view removal/reinsertion plus reduced motion; invalid text-target batch preflight.
- Existing native checks cover alpha interpolation, rapid retargeting, native node disposal, scene controls, Flexbox geometry and body springs. The new groups run in Native CI through `runNativeCapabilitiesChecks()`.
- Host tests cover channel isolation, individual edge replacement, shorthand overlap preflight and lifecycle. Three-browser paint checks verify existing Web mapping compatibility.
- `live-paint-extended-ios.mp4` and `live-paint-extended-android.mp4` record real XCTest/ADB taps in the normal native demo. Both were visually reviewed and decoded end to end. English UI is reused in all documentation locales and the PR.

NativeScript Core 9.1.3; iOS runtime 9.1.0; Android runtime 9.1.1. Production JavaScript, no HMR. Android uses a debuggable native shell for report extraction. These are simulator/emulator measurements, not physical-device, R8, 120 Hz or throughput claims. Suspend/resume checks dispatch application lifecycle events; they do not claim physical background endurance coverage.

## Reproduction

Follow CONTRIBUTING.md to build the normal demo with `JOLT_BENCHMARK=1`, using dedicated explicit device IDs. Run `--native-capabilities=0 --native-audit` on iOS or `--es native-capabilities 0 --es native-audit true` on Android. Read `jolt-native-capabilities.json` from the application's documents/files directory.

```sh
npm run build
npm test -- test/live-spring.spec.ts
npm run benchmark:typecheck
python3 benchmarks/docs-record-ios.py SIMULATOR_UUID /tmp/JoltPaint346 testNativePaint346
python3 benchmarks/native-capabilities-android.py emulator-PORT /tmp/JoltPaint346 live-paint-extended
npm run web:visual:test -- --grep 'paint|color|border|radii'
npm run docs:check-media
npm run docs:build
```

Raw recordings retain their original timing. The existing RC.6 recordings remain preserved as historical examples. Current independent-edge behavior has its own recordings.
