# Native scope/state lifecycle checks

`motion-lifecycle.ts` exercises the actual Jolt drivers and reads Android native translation getters / iOS presentation-layer transforms. It runs a separate `org.nativescript.jolt.benchmark` app; it does not replace the normal demo app.

Build the package (`npm run build`) and then one platform at a time:

```sh
cd demo
JOLT_BENCHMARK=1 ns build android --env.production --env.motionChecks --no-hmr
# Or a local simulator build:
JOLT_BENCHMARK=1 ns build ios --for-device false --release --env.production --env.motionChecks --no-hmr
```

For a production Android build, also supply the usual signing options. Validation uses a release build signed with the local debug key. Install and launch `org.nativescript.jolt.benchmark` on a reserved device/simulator. The checks start automatically after layout and should display `PASS 8 native checks`. The final JSON report is saved in the app's Documents directory as `jolt-motion-checks.json`; Android also logs it under `JoltMotionChecks`.

Coverage:

1. Scope disposal freezes its current native pose while another scope continues.
2. Suspension freezes native playback; resume reaches the original endpoint.
3. Named-state interruption preserves presentation at the handoff and reaches the new multi-view endpoints.
4. Rapid state changes under reduced motion cancel stale completion and settle the latest state.
5. Disposing a state controller before target load removes its pending loaded listener.
6. Twenty recycle/reset/dispose cycles return scope and touch-observer counts to baseline.
7. Removing/reinserting an actual native view cancels its animation while keeping the scope usable.
8. Disposing an older scope leaves a newer animation on the same property running.

Pose comparisons use 3 DIPs of tolerance (5 at a spring handoff). Unit tests separately check numerical velocity transfer, deferred sequences, cleanup errors/reentrancy, inferred types and Vue lifecycle hooks. The native probe uses programmatic transitions, not synthetic OS gestures, and is not a performance benchmark or exhaustive physical-device matrix.

The normal playground's **Motion states & scopes** demo exercises upload/cancel/retry/success/error, pause/resume and actual Vue unmount/remount. Launch it with `--playground --section=motion` on iOS, or string extras `playground=true` and `section=motion` on Android. The global reduced-motion control also applies to these states.

For the real Android demo controls, after launching the section with motion enabled:

```sh
python3 benchmarks/motion-demo-check.py SERIAL
```

This checks seven UI paths: upload/cancel, retry/success, error, suspend, resume, actual Vue unmount during playback, and remount/retry. The device must be reserved for the run, with the whole card and controls visible and no other application taking focus.

## Recorded validation — 2026-10-19

| Check                                        | Result                                                                  |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| Unit suite                                   | 677 tests / 37 files passed, plus compile-time API checks.              |
| API 36 Android emulator, release build       | All 8 native lifecycle/presentation checks passed.                      |
| iOS 26 simulator, release build              | All 8 native lifecycle/presentation checks passed.                      |
| Android normal Vue playground, release build | All 7 real-tap demo checks passed, including unmount/remount and retry. |

No additional physical-device or frame-rate claim is implied by this matrix. The new controllers reuse the existing native playback; the tests cover their new ownership/lifecycle behavior.
