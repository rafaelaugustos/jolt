# Native device-sensor sources (#114)

The supported first delivery is rotation and gravity on iOS/Android, shared native acquisition, interface/device coordinates, native motion-value bindings, optional live springs, demand/lifecycle ownership and an explicit synthetic-input preview. No workflow or CI timeout is added.

The `device-sensors` preview is **Move the light**. `--sensors-audit` enables snapshot and blocked-JavaScript controls. It writes `sensors-audit.json` under Documents on iOS, or the app's external files directory on Android. These are boundary diagnostics, never the animation driver. Normal UI contains no diagnostic counters.

## Reproduce

Use the normal release demo, with `JOLT_BENCHMARK=1`, and assigned device IDs. Build platforms sequentially (see `CONTRIBUTING.md`). Android's generated app resources are local as in the existing demo setup; retain the Jolt icon and template resources. Set the preview language before Android recordings.

```sh
npm test
npm run typecheck
npm run benchmark:typecheck
npm run build
python3 benchmarks/verify-sensor-math.py
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR /tmp/JoltSensors \
  testDeviceSensorChecks testDeviceSensors testDeviceSensorsPortuguese
python3 benchmarks/device-sensors-android.py YOUR_EMULATOR /tmp/JoltSensors audit
python3 benchmarks/device-sensors-android.py YOUR_EMULATOR /tmp/JoltSensors record en
python3 benchmarks/device-sensors-android.py YOUR_EMULATOR /tmp/JoltSensors record pt-BR
python3 benchmarks/verify-device-sensors.py /tmp/JoltSensors/android.json
npm run docs:check-media
npm run docs:build
```

The C/Java math check compiles the actual native implementations and checks identity, rotation around each axis, all four interface orientations, quaternion normalization/sign continuity, gravity remapping and zero/NaN rejection against canonical expected poses. It requires a C compiler and JDK; it adds no native-device CI job. TypeScript tests cover demand through spring chains, unloaded views, scope subscription recreation, reentrant pause in a state callback, reduced motion, application suspension, unavailable hardware and invalid playback inputs.

XCTest and ADB deliver real OS touches to the installed app. The preview transfers a finite synthetic quaternion/gravity sequence to native code once. Native code uses the same normalization, remapping, coalescing and bindings as the hardware path. Recordings explicitly label these inputs and retain their original timing. They are not real device-motion recordings.

The audit verifier checks nonzero native transforms, many native updates per status callback, no sampling/frame updates or live-value clock during pause or Reduce Motion, successful resumption, shared hardware counts when a second rotation source is attached, and zero sources/native value nodes after leaving. A synchronous JS busy loop is also tested: on these NativeScript runtimes it occupies the UI thread and stalls native display work. This limitation is expected and documented; no claim of immunity to UI-thread blockage is made.

`processingMs` measures only accumulated native commit processing, not sensor fusion, OS delivery, total CPU, end-to-end latency or battery. Hardware listeners are shared by type, with the fastest active requested interval; source delivery coalesces to display frames. Exact duplicate scalar inputs do not wake the native value graph again.

## Physical acceptance remains open

No physical iPhone or Android device was connected during this implementation. Before closing #114, record live motion on both, verify positive axis direction and all interface orientations, reentry/recentering, permission denial and recovery, unsupported hardware fallback, sample intervals, callback counts, frame latency, sampling CPU and listener/node return to baseline. Include repeated navigation and background/foreground changes. iOS Simulator cannot validate Core Motion acquisition. Android emulator sensors exercise the platform API but do not establish physical fusion accuracy or cost.

The initial public sources are only rotation and gravity. Accelerometer (including gravity), linear acceleration, gyroscope and magnetic-field sources remain explicitly deferred in #114. The relative rotation reference is nonmagnetic and can drift; Euler angles are a small-tilt convenience, not a complete arbitrary-rotation interpolator.
