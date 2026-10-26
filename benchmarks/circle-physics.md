# Native circle collisions (#39, second milestone)

The optional physics entry owns a sparse board of 1–16 circular views. It adds actual native circle/wall collision stepping and direct OS drag/release to the finite gravity curves delivered previously. It uses a small C kernel on iOS and its Java port on Android, rather than introducing UIKit Dynamics on one platform and a different solver on the other. Both kernels are compiled and compared against analytical collision cases. No Box2D dependency, Kotlin toolchain, new CI workflow or increased timeout is introduced.

## Reproduce

Build the ordinary Vue demo with `JOLT_BENCHMARK=1`, sequentially by platform, as in `CONTRIBUTING.md`. Open `circle-physics`. The `--circle-audit` iOS argument / Android string extra adds boundary-only Snapshot and Resize controls. Reports go to `Documents/circle-audit.json` on iOS and the app's external files directory on Android. The normal experience never polls snapshots.

```sh
npm run typecheck
npm run benchmark:typecheck
npm test
npm run build
python3 benchmarks/verify-circle-math.py
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR /tmp/JoltCircles \
  testCirclePhysicsChecks testCirclePhysics
python3 benchmarks/circle-physics-android.py YOUR_EMULATOR /tmp/JoltCircles audit
python3 benchmarks/circle-physics-android.py YOUR_EMULATOR /tmp/JoltCircles record
python3 benchmarks/verify-circle-physics.py \
  benchmarks/results/circle-physics/ios.json \
  benchmarks/results/circle-physics/android.json
npm run docs:check-media
npm run docs:build
```

Choose English before the Android recording. XCTest selects English through the real language picker. All touches and drags are injected by XCTest/ADB into the actual native app. The English recordings are reused in the Portuguese documentation. Review the complete clips, not only the diagnostic report.

## Evidence

The host physics test compiles the **production** C header with clang and Java class with a JDK. Twelve fixtures check equal and unequal mass impulses, momentum/energy in elastic collisions, inelastic restitution, rest against all four gravity directions, a falling pile, kinematic pushing, release/speed limiting, resize/cancellation and a 16-body stress run. The analytical fixtures compare the two ports numerically. The long chaotic 16-body run checks physical bounds independently on each port; bitwise trajectory/contact-count parity is not claimed. A build with pair impulses deliberately disabled must fail the elastic oracle.

The TS integration tests cover validation before native mutation, exclusive ownership, failed setup, explicit/scope pause, backgrounding, Reduce Motion, unload/load, native-view replacement, commands and listener cleanup. No JS display callback is installed.

Recorded native audit results on 2026-10-25:

| Target                                    | Bodies | Native frames / substeps | Native drag starts / ends | Retained worlds / clocks after exit |
| ----------------------------------------- | ------ | ------------------------ | ------------------------- | ----------------------------------- |
| iPhone 17, iOS 26.2 simulator             | 6      | 617 / 2475               | 1 / 1                     | 0 / 0                               |
| Android 16/API 36 emulator, density 2.625 | 6      | 579 / 2289               | 1 / 1                     | 0 / 0                               |

Both reports show sleep removing the native display callback, real dragging and continued release motion, contacts after dragging, stable native coordinates/frame counts while paused, ignored impulses under Reduce Motion, native geometry matching the solver within 0.5 DIP, containment/separation after resize, background suspension/foreground continuation and cleanup on navigation away. A deliberately corrupted 10-DIP native position must fail the audit checker. `contacts` counts solver impulse resolutions (potentially several per pair/frame), not unique user-visible collision events.

Accumulated native processing time was 101.890 ms over the iOS audit and 58.689 ms over the Android audit. These are development-machine correctness/diagnostic runs with six circles, not physical-device latency, frame-time, battery, memory or comparative performance measurements. The 16-circle limit is covered by the compiled kernel stress test; native gestures/appearance were exercised with the six-circle preview. Continuous multitouch, physical-device acceptance and exhaustive layout/input combinations are not claimed.

## Bounded work and lifecycle

Each native display tick consumes at most 16 fixed 1/240-second substeps, with eight contact relaxation passes per substep and a 1200-DIP/s speed ceiling. Excess wall time is discarded rather than accumulated. Sleep stops the clock. Layout changes perform at most 64 contact-separation passes, cancel the held body and clear velocities; insufficient space pauses the world. The fixed body cap and sparse-board validation bound the quadratic pair loop.

The world is a dedicated UI surface: circle diameters stay fixed; the container/ancestors are not transformed or scrolled; body transforms and touch handlers are not shared with other animation/gesture owners. Native disposal restores the original translations/interaction flags and removes platform frame/input/lifecycle hooks. If NativeScript recreates a native view, the TS owner disposes the old world and requires creation after the new layout.

Rotation, friction, shapes other than circles, continuous collision detection, attachments, constraints, scene-wide collisions and a general push behavior API remain outside this milestone. The native loop uses the UI thread and does not promise immunity to a JS stall. The ordinary existing CI provides regression coverage; these native interaction probes remain local and reproducible.
