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

## Initial rotation/gravity acceptance

The [2026-10-30 physical acceptance](#physical-acceptance-2026-10-30) completes the initial rotation/gravity scope of #114. It combines real iPhone/Android input and lifecycle evidence, native canonical axis/unit tests, the user's manual functional confirmation, controlled failure/recovery, and measured sampling/commit/process costs. No production sensor/runtime change was required.

Accelerometer including gravity, linear acceleration, gyroscope and magnetic-field sources are explicitly deferred to [#256](https://github.com/rafaelaugustos/jolt/issues/256), as allowed by #114's acceptance criteria. The relative rotation reference is nonmagnetic and can drift; Euler angles are a small-tilt convenience. Calibrated physical fusion accuracy, presented-frame/input latency, battery and sustained capacity are not established by these audits. Broader performance work remains in #242 and #65.

The dated sections below preserve the earlier evidence and its limits; the final section records the additional physical acceptance.

## Background and reentry audit (2026-10-29)

The existing sensor implementation passed a dedicated lifecycle audit on iOS 26.2 Simulator and Android 16 / API 36 emulator, using the Release demo, production JavaScript without HMR, NativeScript Core 9.1.3 and vue-router-ns 0.1.0-rc.2 (base `bf7078723887fc26779c9a9e53d7b443a1a5d7ba`). No production sensor/runtime change was required.

The earlier runners visited Home, but their verifier only asserted the pause button's resume. The new `--sensors-lifecycle` opt-in diagnostic retains a single trace across separately mounted screens and records application background/foreground separately from button pause/resume. iOS's initial activation is labelled separately. The Android runner preserves diagnostic Intent extras when bringing the existing task forward. Neither runner invokes an app lifecycle handler to imitate OS suspension.

| Check                                                                                     | iOS Simulator                                                    | Android emulator                                                      |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| Initial platform source                                                                   | Hardware unavailable; static fallback remains valid after return | Two native sensor registrations; zero in background, two after return |
| Actual Home/foreground cycles                                                             | 5                                                                | 5                                                                     |
| Separately created screens                                                                | 3                                                                | 3                                                                     |
| Source samples/frames during suspension                                                   | Unchanged between background and foreground observations         | Same                                                                  |
| Rotation/gravity values and native card/highlight/glow pose at resume boundary            | Unchanged within 0.000001                                        | Same                                                                  |
| Playback after resume                                                                     | New source frames and changed native card pose                   | Same                                                                  |
| Explicit pause through background                                                         | Still paused; no resumed frame clock until the user resumes      | Same                                                                  |
| Registrations, sources, native value nodes and live-value clock after each route disposal | 0                                                                | 0                                                                     |

The first cycle checks platform availability/acquisition. Remaining cycles use the existing, explicitly labelled synthetic quaternion/gravity preview so the same native normalization, bindings and springs can be tested deterministically on both platforms. iOS has no motion acquisition in this simulator. Android's virtual sensor registration does not prove physical fusion accuracy or sampling cost.

Reproduce after installing the normal Release demo on dedicated devices (build platforms sequentially):

```sh
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR /tmp/JoltSensorLifecycleIOS testSensorLifecycle
python3 benchmarks/sensor-lifecycle-android.py YOUR_EMULATOR /tmp/JoltSensorLifecycleAndroid
python3 benchmarks/verify-sensor-lifecycle.py benchmarks/results/device-sensors/2026-10-29-lifecycle-ios.json
python3 benchmarks/verify-sensor-lifecycle.py benchmarks/results/device-sensors/2026-10-29-lifecycle-android.json
python3 -m unittest discover -s benchmarks -p test_sensor_lifecycle.py -v
```

The Android runner uses the reviewed 1080×2400 English layout and actual ADB taps, including collection search and repeated route opening. It restores touch indicators and pulls the recording even on failure. The iOS runner uses XCTest touches and validates the report's session against the current run. Raw observations: [iOS](results/device-sensors/2026-10-29-lifecycle-ios.json), [Android](results/device-sensors/2026-10-29-lifecycle-android.json).

The verifier rejects missing/duplicated lifecycle observations, stale sessions, sampling or frame progress during suspension, changed source/native poses at the resume boundary, stalled resumption, lost explicit pause, hardware registrations or value nodes retained, and missing route recreation. Its 13 negative controls are exercised against each of the two captured traces.

Reviewed English recordings `sensor-lifecycle-ios.mp4` (46.5 s) and `sensor-lifecycle-android.mp4` (54.7 s) preserve original timing, show actual Home screens and end in the collection. Both are embedded with translated captions in all four guides. Native counters and sampled boundary poses are correctness evidence; they do not measure total heap retention, frame pacing, battery or every frame of the resume transition. At this stage, physical-device acquisition, axis accuracy, access failures and performance were still pending; see the final acceptance below.

## Physical iPhone audit (2026-10-29)

An iPhone 17 Pro running iOS 27.2 (24B5099f), connected by USB, ran the normal Release demo built from `5442fa8`, with production JavaScript and no HMR. NativeScript Core 9.1.3 and iOS runtime 9.1.0. Both sources used real Core Motion data throughout this audit; no `replaySensor()` or simulated motion was used. No production sensor/runtime change was required.

The signed XCTest runner passed in 114.8 seconds. Its four scripted Home/foreground cycles produced five actual suspension/activation pairs, including an additional cycle while manually paused. The verifier checks every observed pair, requires the scripted minimum, and rejects missing, duplicated or out-of-order boundaries. It does not discard the extra cycle.

| Check                            | Physical iPhone result                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Live rotation and gravity        | Available and active, finite values, normalized quaternion, gravity magnitude approximately 9.80665 m/s²                 |
| Compatible subscriptions         | One Core Motion acquisition shared by both sources and a temporary third rotation source                                 |
| Real suspension/foreground       | Five observed pairs; samples and commits stopped while suspended                                                         |
| Resume boundary                  | Source values and card/highlight/glow poses preserved within 0.000001 before subsequent readings                         |
| Explicit pause and Reduce Motion | Acquisition and the live-value clock stopped; explicit pause survived foreground; both resumed when requested            |
| Recenter                         | Acquisition and bindings continued after recenter; absolute axis accuracy is a separate pending check                    |
| Recreated screens                | Three independently created screens, each returning registrations, sources, value nodes and the live-value clock to zero |

Three acquisition windows had only boundary snapshots, with no per-reading JavaScript subscription:

| Window | Duration | Requested interval | Samples/s per source | Commits/s per source | JS callbacks during window | Rotation ms/commit | Gravity ms/commit |
| ------ | -------- | ------------------ | -------------------- | -------------------- | -------------------------- | ------------------ | ----------------- |
| 1      | 7.223 s  | auto: 8.333 ms     | 99.82                | 59.95                | 0                          | 0.0448             | 0.0131            |
| 2      | 7.257 s  | auto: 8.333 ms     | 99.77                | 59.94                | 0                          | 0.0408             | 0.0129            |
| 3      | 7.243 s  | auto: 8.333 ms     | 99.82                | 60.06                | 0                          | 0.0439             | 0.0127            |

The requested interval is a hint; this run delivered roughly 100 hardware samples/s and coalesced them to roughly 60 native commits/s. These commit counts are not a measurement of presented FPS. `processingMs` measures only native source commit work, excluding Core Motion fusion/delivery, other animation work, overall CPU, presentation latency and battery. This is one short correctness/counter audit on one device, not a performance guarantee.

The reviewed English recording `device-sensors-physical-ios.mp4` shows real tilt driving the card, highlight and parallax. It is a USB screen recording at original timing, trimmed to the demo and resized for documentation. It is embedded in all four guides. Its manual session is separate from the automated trace; the video demonstrates live response, not a calibrated axis test or a measurement of latency.

Raw automated observations: [physical iPhone trace](results/device-sensors/2026-10-29-physical-ios.json). The offline verifier has 16 negative controls covering fake hardware/preview input, JS callbacks, stalled acquisition, invalid values, retained resources, lifecycle boundaries and pause/Reduce Motion failures.

Reproduce with an unlocked physical iPhone and the normal Release demo installed as `org.nativescript.jolt.benchmark`. Supply the local Apple signing team; no physical-device job is added to CI:

```sh
ruby benchmarks/docs-ios-ui.rb /tmp/JoltSensorsPhysical benchmarks/sensors-physical-ios.swift
xcodebuild build-for-testing -project /tmp/JoltSensorsPhysical/DocsTests.xcodeproj \
  -scheme DocsTests -destination 'generic/platform=iOS' \
  -derivedDataPath /tmp/JoltSensorsPhysical/build -allowProvisioningUpdates \
  CODE_SIGNING_ALLOWED=YES CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM=YOUR_TEAM
xcodebuild test-without-building -project /tmp/JoltSensorsPhysical/DocsTests.xcodeproj \
  -scheme DocsTests -destination 'platform=iOS,id=YOUR_IPHONE' \
  -derivedDataPath /tmp/JoltSensorsPhysical/build -parallel-testing-enabled NO \
  -only-testing:DocsTests/DocsTests/testHardwareLifecycle
xcrun devicectl device copy from --device YOUR_IPHONE \
  --source Documents/sensors-audit.json --domain-type appDataContainer \
  --domain-identifier org.nativescript.jolt.benchmark --destination /tmp/physical-ios.json
python3 benchmarks/verify-sensors-physical-ios.py /tmp/physical-ios.json
python3 -m unittest discover -s benchmarks -p 'test_sensor_*.py'
```

The following audit adds physical iPhone sampling-interval coverage. At this stage, physical Android evidence, axis/interface-orientation checks, access-failure/recovery and process profiling were still pending; see the final acceptance below. Battery and long-running memory behavior were not measured. Deferred accelerometer, linear-acceleration, gyroscope and magnetic-field sources retain their existing scope.

## Physical sampling intervals (2026-10-29)

The same physical iPhone 17 Pro, iOS 27.2 (24B5099f), ran a Release demo based on `ca8eed1`, with production JavaScript and no HMR. The opt-in `--sensors-intervals` diagnostic binds real Core Motion rotation/gravity directly to native views. It never subscribes to readings in JavaScript or uses preview inputs. The signed `testSamplingIntervals` XCTest passed twice; the second run supplies the committed [43-event trace](results/device-sensors/2026-10-29-intervals-ios.json) and recording. No production sensor/runtime change was needed.

Each of twelve windows settles for 1.5 seconds before taking boundary snapshots. Active windows measure about four seconds; stopped windows measure about two. Rates use the native monotonic clock. Both sources share one acquisition, but each source commits according to its own requested interval and the display clock.

| Requested interval, both sources | Samples/s per source | Native commits/s per source |
| -------------------------------- | -------------------- | --------------------------- |
| `auto` (8.333 ms requested)      | 99.82                | 58.14                       |
| 16 ms                            | 66.38                | 57.65                       |
| 33 ms                            | 28.45                | 28.45                       |
| 100 ms                           | 9.96                 | 9.96                        |

The remaining eight windows exercise demand and arbitration between a slow rotation source (100 ms) and a fast gravity source (16 ms):

| Window                        | Hardware samples/s | Slow / fast commits/s | Result                                                                      |
| ----------------------------- | ------------------ | --------------------- | --------------------------------------------------------------------------- |
| Both sources unbound          | 0                  | 0 / 0                 | Creating sources starts no acquisition                                      |
| Slow source with two bindings | 9.98               | 9.98 / 0              | An idle fast source does not increase sampling                              |
| Fast source attached          | 66.66              | 9.99 / 57.93          | One shared acquisition; the slow source still coalesces to its own interval |
| One slow binding removed      | 66.40              | 9.98 / 56.91          | The other binding keeps its source alive                                    |
| Fast source removed           | 9.98               | 9.98 / 0              | Sampling slows without recreating the remaining source                      |
| Last binding removed          | 0                  | 0 / 0                 | Acquisition and live-value clock stop, including after demand-free `play()` |
| Slow binding reattached       | 9.99               | 9.99 / 0              | Acquisition resumes on the retained source                                  |
| All sources disposed twice    | 0                  | 0 / 0                 | Zero registrations, sources, native value nodes and live-value clock        |

All twelve measurement windows had zero JavaScript callbacks. The verifier checks finite values, normalized quaternion/gravity magnitude, shared acquisition, per-source commit limits, idle counters, resumption and cleanup after route exit. It compares cadence within a run instead of requiring exact hardware rates. At a window boundary, one already-buffered sample may commit after the start snapshot: the bound permits one extra commit relative to the window's sample delta while requiring cumulative samples to cover cumulative commits. Its 22 negative controls run in the existing offline CI suite.

The reviewed English `sensor-intervals-physical-ios.mp4` is a 79.98-second USB recording of this automated run, embedded with translated captions in all four guides. It shows the actual diagnostic phases, counter summaries and completed cleanup. No manual device movement is needed for this frequency audit. The capture helper uses host monotonic arrival timestamps for real USB screen frames; dropped frames keep their elapsed-time gaps. A preliminary capture using source timestamps compressed elapsed time and was rejected. The published clip is trimmed and resized, with no speed change or generated frames.

Reproduce after installing the normal Release demo and building the signed runner as in the preceding section:

```sh
xcodebuild test-without-building -project /tmp/JoltSensorsPhysical/DocsTests.xcodeproj \
  -scheme DocsTests -destination 'platform=iOS,id=YOUR_IPHONE' \
  -derivedDataPath /tmp/JoltSensorsPhysical/build -parallel-testing-enabled NO \
  -only-testing:DocsTests/DocsTests/testSamplingIntervals
xcrun devicectl device copy from --device YOUR_IPHONE \
  --source Documents/sensor-intervals.json --domain-type appDataContainer \
  --domain-identifier org.nativescript.jolt.benchmark --destination /tmp/intervals-ios.json
python3 benchmarks/verify-sensor-intervals.py /tmp/intervals-ios.json
python3 -m unittest discover -s benchmarks -p 'test_sensor_*.py'
```

Check that the pulled report's `session` belongs to the current run. To record, compile the [USB capture helper](record-iphone.swift), then start it in a second terminal when XCTest finds the run button; the test allows ten seconds before tapping:

```sh
swiftc benchmarks/record-iphone.swift -o /tmp/jolt-record-iphone
/tmp/jolt-record-iphone 'YOUR EXACT IPHONE NAME' /tmp/intervals-ios.mp4 100
```

Keep the phone unlocked and in one orientation. The helper captures only the named USB screen source and no audio, refuses to overwrite files, and finalizes on Ctrl-C. Inspect the full recording and compare its elapsed time with the test before trimming or compressing it. Host frame-arrival timestamps are for playback timing, not a sensor-to-display latency measurement.

These short windows on one physical iPhone establish interval/demand correctness. Native commits are not presented FPS. This audit does not measure overall CPU, presentation latency, battery, long-running retention or physical Android behavior; the additional physical evidence is recorded below.

## Physical acceptance (2026-10-30)

Release demos based on `3e69e70` used production JavaScript without HMR, NativeScript Core 9.1.3, Android runtime 9.1.1 and iOS runtime 9.1.0. The devices were a physical ASUS_Z017DC, Android 8.0.0 / API 26 (reported display rate approximately 60 Hz), and an iPhone 17 Pro, iOS 27.2 (24B5099f, reported maximum 120 Hz). The iPhone was connected through Xcode's local-network device tunnel; Android used USB. Low Power Mode was off. iOS reported nominal thermal state; this Android version does not expose the probe's thermal-status API. The Android device was charging. These are short observed runs, with instrumentation, not isolated laboratory benchmarks.

### Acceptance evidence

| Requirement                                          | Evidence                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real rotation/gravity and multiple native consumers  | Earlier physical iPhone demo/lifecycle trace plus the new Android trace and manual live-input video. No synthetic preview in the physical traces.                                                                                                                                                     |
| Coordinates, units and recorded inputs               | Existing C/Java native tests pass 14 canonical cases per platform, covering axes, all interface orientations, normalized quaternions, gravity remapping and invalid inputs. The user confirmed the Android manual demo works. This is functional acceptance, not calibrated physical fusion accuracy. |
| Availability and failure handling                    | Existing static-unavailable/missing-configuration tests; new physical service-dropout/retry tests on both devices, plus an injected Core Motion error callback on iPhone.                                                                                                                             |
| Interval and shared acquisition                      | Twelve windows per device: auto, 16/33/100 ms, mixed consumers, binding removal, reacquisition and idempotent disposal. All steady windows have zero sensor JavaScript callbacks.                                                                                                                     |
| Pause, Reduce Motion, background, recenter, disposal | Android: three separately mounted screens, four actual Home/foreground cycles including explicit pause, held values at resume, and zero native resources after each disposal. Earlier physical iPhone trace covers three screens and five observed cycles.                                            |
| Sampling cost                                        | Native commit processing in the lifecycle traces; whole-process CPU, sampled memory and native display callback observations in both new interval traces. These measurements include demo/probe/automation costs.                                                                                     |

The five manually labelled Android snapshots did not establish the numerical orientation matrix: the interface remained portrait-locked and the original delayed capture allowed movement before the snapshot. They are **not** presented as a passing axis trace. The reviewed video demonstrates live native response, and the user's manual functional confirmation is recorded separately. The diagnostic now captures immediately and guards the requested pose, but that manual sequence was not rerun at the user's request. The recovery-only runs below are independent, verified evidence and claim zero physical poses.

### Physical Android lifecycle

The [55-event trace](results/device-sensors/2026-10-30-physical-android.json) passes the hardware-only verifier: three screen instances, four background/foreground pairs, shared acquisition, pause/Reduce Motion/recenter, zero sensor JS callbacks in three steady acquisition windows, and all registrations/sources/value nodes/clocks released. Android has two registrations for rotation plus gravity; adding another rotation consumer retains two. The [device metadata](results/device-sensors/2026-10-30-android-device.json) records the model, OS and build without a device identifier.

### Sampling and process cost

Raw interval/profile traces: [Android](results/device-sensors/2026-10-30-intervals-android.json), [iPhone](results/device-sensors/2026-10-30-intervals-ios.json). Each active profile lasts approximately four seconds, after settling. The table reports rotation; gravity followed the same rounded rates in these runs.

| Device / requested interval | Samples/s | Native commits/s | Whole-process CPU ms / window | Sampled peak memory MiB | Native display callbacks |
| --------------------------- | --------: | ---------------: | ----------------------------: | ----------------------: | -----------------------: |
| Android auto                |     100.3 |             59.2 |                          3377 |               141.2 RSS |                      240 |
| Android 16 ms               |     100.3 |             59.2 |                          3402 |               147.5 RSS |                      239 |
| Android 33 ms               |      62.6 |             29.7 |                          2018 |               149.9 RSS |                      240 |
| Android 100 ms              |      20.0 |              9.9 |                           978 |               152.8 RSS |                      240 |
| iPhone auto                 |      99.7 |             58.8 |                         562.0 |          55.0 footprint |                      236 |
| iPhone 16 ms                |      66.3 |             55.9 |                         546.2 |          49.7 footprint |                      231 |
| iPhone 33 ms                |      28.4 |             28.4 |                         645.8 |          48.8 footprint |                      238 |
| iPhone 100 ms               |      10.0 |             10.0 |                         530.8 |          48.7 footprint |                      232 |

Android hardware delivers faster than requested; each source still limits its commits. The mixed test uses two rotation consumers on Android because acquisition is shared per sensor type; iOS uses rotation and gravity sharing Core Motion. Adding the fast consumer increases acquisition from about 20 to 100 samples/s on Android and 10 to 66 on iPhone. The slow consumer stays near 10 commits/s. Removing the fast consumer restores the slow acquisition rate; removing the last binding stops sensor work and the live-value clock. Reattachment resumes it. All twelve windows on each device have zero sensor JS callbacks.

Whole-process CPU includes native bindings, demo rendering, the recorder and test automation; it does not isolate sensor fusion or subtract an idle control. Android's sampling workload has a substantial cost on this older phone. The roughly two-second unbound window consumed 150 ms process CPU on Android and 242 ms on iPhone, with the diagnostic display recorder still active. Across all windows, the probe itself recorded 98–184 ms work on Android and 0.8–2.3 ms on iPhone. Memory is sampled RSS on Android and `phys_footprint` on iOS, so the figures are not equivalent heap measurements or proof of long-term leak freedom.

The recorder uses Choreographer/CADisplayLink and observes native display callback opportunities, **not presented frames or input-to-photon latency**. Its callbacks continue during idle diagnostic windows even though Jolt's sensor/live-value clocks stop. No presented FPS, battery, sustained-load or calibrated latency claim is made. CPU results should not be compared as an OS or framework benchmark. The offline profile verifier rejects missing windows, invalid/negative costs, inconsistent memory metrics, buffer overflow and nonmonotonic callback traces.

### Controlled failure and real recovery

[Android recovery](results/device-sensors/2026-10-30-recovery-android.json) and [iPhone recovery](results/device-sensors/2026-10-30-recovery-ios.json) each bind four real sources: rotation/gravity in interface/device coordinates. A **demo-only** fixture stops actual OS delivery without changing Jolt state. The production watchdog reports `no-data`, releases acquisition and the live-value clock, and holds samples/values through the error window. Calling `play()` reconnects to real hardware and advances frames/timestamps. Disposal returns all native counts to zero.

The iPhone fixture additionally invokes the captured Core Motion handler with `demo-injected-access-failure`; the source surfaces that error and recovers on `play()`. This is an injected native callback error, **not** a user revoking an OS permission. Android's tested rotation/gravity sources have no runtime permission prompt at the requested rates; its fixture unregisters the actual listener. Missing configuration/hardware paths retain their existing automated coverage. Neither fixture ships in the library packages.

The signed iPhone interval/recovery XCTest run passed both tests in 109.4 seconds. The Android lifecycle, intervals and recovery reports pass their respective offline verifiers. Meaningful negative controls run in the existing CI sensor suite against both platforms' captures, including missing recovery, continued work while failed, malformed quaternion/gravity, retained resources and corrupted profiles.

### Reproduce and recordings

Install the Release diagnostic demo on dedicated physical devices. Build platforms sequentially. The Android runner uses the reviewed ASUS 1080×1920 portrait layout, refuses emulators, restores the previous stay-awake setting and reports failed app starts without automatically retrying them:

```sh
python3 benchmarks/sensors-physical-android.py YOUR_SERIAL /tmp/SensorsAndroidLifecycle lifecycle
python3 benchmarks/sensors-physical-android.py YOUR_SERIAL /tmp/SensorsAndroidIntervals intervals
python3 benchmarks/sensors-physical-android.py YOUR_SERIAL /tmp/SensorsAndroidRecovery recovery
python3 benchmarks/verify-sensor-intervals.py benchmarks/results/device-sensors/2026-10-30-intervals-android.json --profiles
python3 benchmarks/verify-sensor-intervals.py benchmarks/results/device-sensors/2026-10-30-intervals-ios.json --profiles
python3 benchmarks/verify-sensor-acceptance.py benchmarks/results/device-sensors/2026-10-30-recovery-android.json
python3 benchmarks/verify-sensor-acceptance.py benchmarks/results/device-sensors/2026-10-30-recovery-ios.json
python3 -m unittest discover -s benchmarks -p 'test_sensor_*.py'
```

For iPhone, use the signed physical XCTest setup above with `testSamplingIntervals` and `testSensorRecovery`, then pull `Documents/sensor-intervals.json` and `Documents/sensor-acceptance.json`. The new automated runs require no manual poses or recording. Check session IDs on the device; the Android wall clock differed from the host, so host timestamps alone are not a valid freshness comparison.

An earlier Android cold launch failed in RenderThread with `EGL_NOT_INITIALIZED`, consistent with the previously documented ASUS startup limitation in [gradient values](gradient-values.md). That attempt supplied no passing evidence. A subsequent launch and the final runs succeeded. Earlier host automation also observed an in-progress JSON write and a disposal boundary too soon; the runner now bounds retries for incomplete JSON and waits for disposal. The committed interval report is complete and includes route disposal; no partial run is treated as acceptance.

The reviewed English `device-sensors-physical-android.mp4` reuses the existing manual capture, trimmed to 31.0 seconds and resized to 540×960 without changing timing. It shows a real native card responding to physical sensor input; the pose labels are instructions, not proof that a calibrated matrix passed. The prior reviewed physical iPhone clip is retained. Both clips are embedded in all four guide languages with translated captions. No additional recording was requested after the user's functional confirmation.
