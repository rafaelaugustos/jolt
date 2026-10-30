# Motion from your phone

`sensor()` supplies rotation and gravity to Jolt's existing native value graph. One source can tilt a card, move its highlight and offset a background, with native springs smoothing the result. Import the optional `@rafaelaugusto/jolt/sensors` entry point. Available since **0.1.0-rc.1**; rebuild the native app.

<Clip name="device-sensors-physical-ios" caption="Physical iPhone 17 Pro, iOS 27.2, Release demo: real Core Motion rotation and gravity drive the card, highlight and parallax with native spring smoothing. English UI, USB screen capture at original speed. This clip shows live response; it does not establish axis accuracy or performance." />

<Clip name="device-sensors-physical-android" caption="Physical ASUS_Z017DC, Android 8 / API 26, English diagnostic screen: real sensor input tilts the native card. Original timing, reused from the manual test. This shows live response; pose labels do not establish a calibrated axis test or performance measurement." />

<Clip name="device-sensors-ios" caption="iOS 26.2 simulator: real native views driven by explicitly simulated sensor inputs, with actual taps to pause, resume, recenter and reduce motion. Original speed. The simulator has no motion hardware; this is not physical-device sensor or performance evidence." />
<Clip name="device-sensors-ios-pt" caption="iOS simulator, Portuguese: the same native input preview and lifecycle controls. The screen identifies the simulated input." />
<Clip name="device-sensors-android" caption="Android 16 emulator: the native card, light and parallax follow explicit test samples. Actual ADB taps exercise pause, resume and Reduce Motion. Original speed; emulated hardware and test samples do not establish physical-device performance." />
<Clip name="device-sensors-android-pt" caption="Android emulator, Portuguese: native playback with visibly labelled simulated inputs and translated controls." />

## Background and screen reentry {#background-and-reentry}

The lifecycle audit exercises five actual Home/foreground cycles across three separately created **Move the light** screens. It verifies unchanged source values and native card/highlight poses at the resume boundary, continued updates afterward, preservation of an explicit pause, and zero sensor registrations, sources and native value nodes after each route is disposed.

The first cycle uses platform acquisition: the Android emulator releases its two sensor registrations in background and restores them on return; iOS Simulator correctly keeps the unavailable-hardware fallback. Subsequent cycles use the clearly labelled native test-input preview. This validates lifecycle behavior, not physical sensor accuracy, latency or battery use. The audit confirmed the existing implementation without changing the public sensor API. See the [trace, verifier and reproduction procedure](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/device-sensors.md#background-and-reentry-audit-2026-10-29).

<Clip name="sensor-lifecycle-ios" caption="iOS 26.2 simulator, English demo: actual Home/foreground, explicit pause and three route entries with native playback of labelled simulated sensor inputs. Original timing. Core Motion acquisition is unavailable in the simulator; this is lifecycle evidence, not physical-device performance." />
<Clip name="sensor-lifecycle-android" caption="Android 16 / API 36 emulator, English demo: actual Home/foreground and repeated navigation. The first cycle checks emulated sensor subscriptions; the moving-card cycles use labelled simulated inputs. Original timing; no physical sensor or performance claim." />

## Physical sampling intervals {#physical-sampling-intervals}

A second physical iPhone audit checks twelve windows: `auto`, 16/33/100 ms, sources with different requested rates, removal of individual bindings and the fastest consumer, reattachment and disposal. One shared acquisition slows from about 66 to 10 samples/s when the fast consumer leaves, and stops when the last binding is removed. All measurement windows have zero JavaScript callbacks. See the [captured rates and reproduction procedure](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/device-sensors.md#physical-sampling-intervals-2026-10-29). These are short correctness checks on one device; native commits are not presented FPS.

<Clip name="sensor-intervals-physical-ios" caption="Physical iPhone 17 Pro, iOS 27.2, Release demo with English diagnostic UI: twelve real Core Motion sampling windows, shared acquisition, binding removal and cleanup. USB recording at original timing; no simulated input or manual tilt required. Counters show sampling and native commits, not presented FPS." />

## Connect a source

```ts
import { bind, motionScope, springValue } from '@rafaelaugusto/jolt'
import { sensor } from '@rafaelaugusto/jolt/sensors'

const scope = motionScope()
const rotation = sensor('rotation', { scope })
const gravity = sensor('gravity', { scope, interval: 'auto' })
const tilt = scope.add(springValue(rotation.y, { stiffness: 155, damping: 23 }))

// use() recreates bindings after suspension; add(cleanup) would remove them permanently.
scope.use(() => bind(card, { rotateY: tilt.to([-0.6, 0.6], [-20, 20]) }))
scope.use(() => bind(highlight, { x: tilt.to([-0.6, 0.6], [-90, 90]) }))
scope.use(() => bind(background, { x: gravity.x.to([-6, 6], [-35, 35]) }))

// Optional explicit actions:
rotation.recenter()
scope.suspend()
scope.resume()
// When the screen is permanently released:
scope.dispose()
```

Sources stay idle until a loaded view binding or an explicit JS subscription needs them. Demand propagates through native spring chains; pausing the last follower, unloading the last bound view or removing its binding stops the hardware subscription. Keep the source in a scope and dispose it when finished. `get()` and `snapshot()` read the last value without starting sampling.

## Values and coordinates

| Source                | Values             | Contract                                                                                                                                                     |
| --------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `rotation`            | `x`, `y`, `z`      | Relative extrinsic XYZ Euler angles, radians; equivalently intrinsic ZYX. Identity is the first valid reading. Map radians to Jolt's rotation degrees.       |
| `rotation.quaternion` | `x`, `y`, `z`, `w` | Normalized Hamilton quaternion, with sign continuity between samples. Relative to the initial device pose, not magnetic north.                               |
| `gravity`             | `x`, `y`, `z`      | Downward gravitational acceleration in m/s². A flat, face-up phone has z approximately −9.80665. This is neither total acceleration nor linear acceleration. |

The default `coordinates: 'interface'` uses x right, y up and z out of the visible screen. Native code remaps the axes after screen rotation. `'device'` keeps the device's hardware axes, independent of interface orientation; on Android these follow the device's natural orientation, including landscape-native tablets. The rotation basis is transformed along with the axes, so changing interface orientation does not turn an identity pose into an artificial 90° rotation.

Rotation uses an arbitrary, nonmagnetic reference: Core Motion's `XArbitraryZVertical` on iOS and `TYPE_GAME_ROTATION_VECTOR` on Android. Yaw can drift. `recenter()` makes the next valid pose the identity. Resuming reanchors relative rotation to preserve its previous pose; gravity resumes the actual measurement. Use `springValue()` for smooth gravity changes. Euler angles have wrapping and gimbal-lock limits: use modest tilt ranges for scalar bindings. Full 3D interpolation needs quaternion-aware interpolation; independently springing four quaternion components is not slerp.

## Sampling and ownership

`interval` accepts `'auto'` (the display's reported interval) or 5–1000 milliseconds. The request respects hardware limits and does not promise an exact cadence. iOS shares one Core Motion subscription; Android shares one native listener per available sensor type. Compatible consumers use the fastest requested interval, with each source coalescing readings to its own interval and display frames. Multiple bindings use the same retained values.

Application backgrounding stops hardware collection natively as well as through Jolt's lifecycle hooks. `pause()` holds values and stops collection for that source; `play()` resumes and retries a failed subscription. `dispose()` is idempotent, disconnects bindings, drops native values and releases subscriptions. Another active source may keep the shared hardware running.

Reduce Motion defaults to `reducedMotion: 'pause'`: decorative sensor collection stops and the current pose stays still. An app that needs readings for a nondecorative function can explicitly select `'continue'`. The **Move the light** demo uses the default and offers pause, recenter and Reduce Motion controls in English, Portuguese, Spanish and Simplified Chinese.

## Availability and configuration

On iOS, add a meaningful `NSMotionUsageDescription` to the app's Info.plist. A missing description produces `error: 'missing-motion-usage-description'` before starting Core Motion. On Android, this implementation caps requests at 200 Hz and requires no high-sampling-rate permission. There is no accelerometer-based fallback masquerading as a gravity or rotation sensor.

`available` reports whether the necessary hardware source exists. `status` distinguishes `idle`, `starting`, `active`, `paused`, `unavailable`, `error`, `replaying` and `disposed`. `snapshot().error` reports access/start failures or `no-data` if no valid measurement arrives for three seconds (or three requested intervals). Invalid values and out-of-order hardware timestamps are ignored. Missing hardware keeps a static zero/identity fallback. The app can offer an ordinary static layout without a motion-dependent action.

`onStatus` is optional and runs only at state boundaries. `snapshot()` returns the last values, hardware timestamp in monotonic milliseconds since boot, received-sample count, committed-frame count, native callback count and accumulated commit-processing milliseconds. It is an explicit diagnostic read, not a subscription or an end-to-end performance measurement. Using `.subscribe()` explicitly opts into JS observation on the frame clock; ordinary `bind()` needs no per-reading JS call.

## Reproducible preview and remaining validation

The demo's **Preview movement** button uses `replaySensor()` from `@rafaelaugusto/jolt/testing`. A finite sequence of canonical quaternion/gravity samples is handed to native code once; hardware collection detaches for the playback, and the same math, coalescing, value graph and springs render it. The screen labels the input as simulated. This is a testing facility, not fake hardware availability.

The native path still needs the platform's UI thread. A synchronous JavaScript task on that thread can stall display updates; avoiding per-sample JS calls does not make the UI immune to blocking.

Physical iPhone and Android audits cover real rotation/gravity, shared acquisition, requested intervals, pause/Reduce Motion, background recovery and disposal. All measured steady windows contain zero sensor JavaScript callbacks. The Android manual demo was confirmed working; native canonical tests cover units and interface remapping. See the [physical acceptance, traces and measured process costs](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/device-sensors.md#physical-acceptance-2026-10-30). Controlled native service failures recover on `play()`; the injected iPhone callback error is not an OS permission-revocation test.

This completes the initial rotation/gravity scope of #114 without changing the production API. Accelerometer including gravity, linear acceleration, gyroscope and magnetic-field sources are tracked in [#256](https://github.com/rafaelaugustos/jolt/issues/256). The short process profiles include diagnostic overhead and do not establish calibrated axis accuracy, presented FPS, input-to-photon latency, battery use or sustained capacity.

Platform contracts: [Apple device motion](https://developer.apple.com/documentation/coremotion/getting-processed-device-motion-data), [Android motion sensors](https://developer.android.com/develop/sensors-and-location/sensors/sensors_motion) and [Android sensor coordinates and limits](https://developer.android.com/develop/sensors-and-location/sensors/sensors_overview).
