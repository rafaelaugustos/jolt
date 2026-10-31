# Scoped playback across app background (#273)

A normal NativeScript-Vue component owns its animations through `useMotionScope()` and creates them once in `onMounted`. The original engine cancelled ordinary playback when NativeScript unloaded the background root. Those handles settled `false`, so returning to the app could not resume them.

`motionScope()` now observes application suspend/resume while it owns resources. It pauses before root unload and resumes the same handles on foreground. App suspension and explicit/KeepAlive suspension are independent. Already-paused handles stay paused; stop, reset, disposal and ordinary view removal remain terminal. The existing suspension policy also detaches/recreates subscriptions and cancels non-playable resources such as sequences. No per-frame scheduler was added.

## Reproduction

Build the normal Vue demo, not the dedicated `--env.motionChecks` entry. Use a reserved simulator/emulator and `JOLT_BENCHMARK=1` to keep the benchmark app separate from the normal installed demo.

```sh
npm ci
npm run build
cd demo
npm install
JOLT_BENCHMARK=1 ns build ios --for-device false --release --env.production --no-hmr
# Or Android, with the project's usual release signing arguments:
JOLT_BENCHMARK=1 ns build android --release --env.production --no-hmr
```

Install the resulting `org.nativescript.jolt.benchmark` app. From the repository root:

```sh
python3 benchmarks/background-playback-check.py ios IOS_SIMULATOR_UUID /tmp/jolt-background-ios --record
python3 benchmarks/background-playback-check.py android ANDROID_SERIAL /tmp/jolt-background-android --record
```

The runner uses real Home actions, app activation and button taps. iOS requires `idb`; Android uses ADB. Infinite native animations can prevent UIAutomator from reaching idle. In that case inspect the screen and pass the button centers in **screen pixels**, for example `--android-pause 300,1615 --android-stop 780,1615` on the tested 1080 × 2400 emulator. These coordinates are not portable to arbitrary screen sizes.

`--background-playback` selects the scene manually (`background-playback=true` as an Android string extra). `--background-probe` additionally samples native presentation at 5 Hz and records lifecycle boundaries; it never drives animation or recreates handles. It writes `background-playback.json` into iOS Documents or Android's app-specific external files directory. The runner copies snapshots and its summary into the requested output directory. The recording covers the first background/foreground cycle.

Coverage:

- Endless SVG path with scale/opacity, three-view stagger, reverse scale/opacity, and two independently timed layers on the same translation channel.
- Real background intervals of approximately 3, 20 and 3 seconds; six original handles remain owned and none settles during these cycles.
- Native poses preserved at the background/foreground boundary, within 5 points/pixels for translation and 0.05 for scale/opacity. All moving targets visibly advance afterward.
- A separately paused handle remains still throughout.
- Real taps pause the scope, return from background without restarting it, resume it, then stop all work. Another app return leaves zero owned handles and all stopped poses unchanged.
- Unit coverage additionally checks finite delays, replacement ownership, pending lifecycle work, subscription teardown, listener release and overlapping app/manual/KeepAlive suspension.

## Results — 2026-10-31

[Machine-readable results](./results/background-playback/2026-10-31.json) include native movement ranges, boundary pose differences and source trace hashes. Both builds used the real native drivers and production bundles without HMR.

| Platform                                 | rc.4 negative control                                                                                                           | Fixed behavior                                                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| iPhone 17 Pro simulator, iOS 26.2        | Path, stagger, reverse and both layered handles settled `false` on background unload; only the manually paused handle survived. | All three return cycles, manual pause/resume and stop passed. Maximum boundary translation difference: 0.276 points.          |
| JoltReview emulator, Android 16 / API 36 | The same five handles settled `false`; only the manually paused handle survived.                                                | All three return cycles, manual pause/resume and stop passed. Maximum boundary translation difference: 1.955 physical pixels. |

The negative control uses `motion-scope.ts` from main `4363c59968fc13bdb68994fea9ddf927a3b5e867` (rc.4) with the same new demo scene. The Android negative control includes a 3-second background interval; the initial iOS reproduction stayed out for about 36 seconds. `--baseline` makes the runner require reproduction of the regression. The unit suite passes **1,497 tests across 96 files**; the three app-lifecycle regression tests failed before the fix.

Reviewed recordings are embedded in the English, Portuguese, Spanish and Simplified Chinese motion-controller guides: `background-playback-ios.mp4` (12.38 s) and `background-playback-android.mp4` (15.96 s). They show actual native playback and OS app switching at normal speed, with English UI. Full decoding and representative frames across both clips were checked.

These are simulator/emulator checks, not physical-device or frame-pacing claims. Presentation sampling is opt-in diagnostic work. The visible orbit uses a 6-second period instead of the issue's 30-second period; both use endless playback. Process termination and OS state restoration are outside this change. Unscoped animations keep their existing lifecycle behavior.
