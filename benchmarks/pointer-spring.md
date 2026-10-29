# Native pointer spring dragging (#238)

Validated on 2026-10-29 in the ordinary NativeScript-Vue demo, using production
release builds. This is a development addition after 0.1.0-rc.1 and requires a
native rebuild. The existing direct-drag and fixed-attachment contracts remain
available.

## Contract

`CircleBody.drag: { type: 'spring', length?, stiffness?, damping?, line? }` configures
a temporary spring for the native gesture. The same validated spring ranges and
line styles apply as for fixed attachments. Omitting it, or using `'direct'`, keeps
kinematic dragging.

The touch must begin inside the displayed circle. The native handler preserves the
initial center-to-contact offset and converts pointer movement to container-local
DIPs. Its center target is clamped to the board bounds. One pointer/body owns a
gesture per world; multitouch and transformed ancestors are outside the supported
contract. This is a center spring, not an off-center rotating body joint.

While held, the temporary spring takes precedence over a resting attachment or
selected dock, without mutating that configuration. The body keeps its finite mass,
gravity and collision response. A successful release removes the temporary spring
and retains the body's integrated velocity; it does not copy pointer velocity.
Snap selection uses that body position/velocity. Without snap points, the fixed
attachment resumes, or the body continues under the world's normal forces.

Cancellation clears velocity and restores the previous dock without replacing the
last successful release diagnostics. Pause, Reduce Motion, unload, backgrounding,
resize, reset and disposal use the existing native cancellation paths. `attach()`
updates the resting configuration during a gesture; `snapTo()` and `impulse()`
continue to ignore a held body. Pointer and fixed-anchor lines are separate owned
resources; only the applicable line is visible. Disposal removes both.

`held` means input ownership, not infinite mass. The snapshot's `pointer` is the
active temporary anchor/configuration or `null`; `attachment` remains the resting
configuration. The C/Java solvers distinguish kinematic input from dynamic spring
input in integration, wall impulses and pair contact mass.

There is no per-input or per-frame JavaScript callback in the execution path.
Native stepping and drawing still share the UI thread. The existing 1–16 bodies,
40% occupancy, 1/240-second step, 16-step display budget and 1200-DIP/s speed cap
remain unchanged. Holding a pointer keeps the native clock active; settling after
release removes it. At most two optional guide resources are allocated per body.

## Reproduce

Build the normal demo sequentially for each platform with `JOLT_BENCHMARK=1`,
following [CONTRIBUTING.md](../CONTRIBUTING.md). Install it on dedicated simulators
and use the English preview. The new scene is `pointer-spring` (**Follow the
feeling**). The previous `physics-attachments` scene is unchanged by default.

```sh
npm test -- --maxWorkers=4
npm run typecheck
npm run build
npm run benchmark:typecheck
python3 benchmarks/verify-circle-math.py
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR /tmp/JoltPointer \
  testPointerSpringChecks testPointerSpring
python3 benchmarks/pointer-spring-android.py YOUR_EMULATOR /tmp/JoltPointer audit
python3 benchmarks/pointer-spring-android.py YOUR_EMULATOR /tmp/JoltPointer record
python3 benchmarks/verify-pointer-spring.py \
  benchmarks/results/pointer-spring/ios.json \
  benchmarks/results/pointer-spring/android.json
npm run docs:check-media
npm run docs:build
```

The iOS audit is `Documents/pointer-spring-audit.json` inside the demo's data
container. The Android runner copies the report automatically. The audit flag
`--attachment-audit` (Android string extra `attachment-audit=true`) enables fixed
timer samples during real native gestures and an armed pause for cancellation.
These audit-only timers read state; they never inject input or advance the solver.
The ordinary preview installs no JavaScript motion observer.

## Evidence

The compiled production-kernel check passes **40 fixtures** on both C and Java.
The 12 additional cases cover analytical first-step integration, moving targets
without teleportation, body velocity before/after release, finite collision mass,
hanging equilibrium, return to a fixed anchor, cancellation/dock restoration,
velocity-based snap selection, resize and extreme supported parameters. Negative
controls remove pair impulses, spring forces or the finite mass of a spring-held
body; each must fail its analytical oracle.

All **1,437 host tests** pass across 92 files. API tests validate options before native setup, copy configuration, keep direct
dragging/resting springs independent and verify no JavaScript frame scheduling.
The preview-language check includes the 74th scene in all four locales.

The native audit compares solver state to actual view presentation within 0.5 DIP,
checks bounds, separation, speed and stepping budgets, and observes the temporary
anchor while a real gesture is held. It verifies collision response while held,
resting-anchor return, snap choice from release velocity, interrupted dragging,
paused/Reduce Motion stability, resize restoration, background/resume and teardown.
Corrupted kinematic movement and stale pointer ownership must fail the verifier.

| Target                                    | Held samples | Maximum sampled anchor/body separation | Native frames | Drags / releases / cancellations | Remaining worlds / clocks / guides / scope resources |
| ----------------------------------------- | ------------ | -------------------------------------- | ------------- | -------------------------------- | ---------------------------------------------------- |
| iPhone 17, iOS 26.2 simulator             | 12           | 74.51 DIP                              | 1595          | 4 / 3 / 1                        | 0 / 0 / 0 / 0                                        |
| Android 16/API 36 emulator, density 2.625 | 15           | 51.52 DIP                              | 1739          | 4 / 3 / 1                        | 0 / 0 / 0 / 0                                        |

The reviewed English clips are **17.00 seconds at 420 × 914** on iOS and
**15.53 seconds at 420 × 934** on Android, H.264 at original playback timing.
They show the moving anchor/tether, elastic lag, contact, release return/snapping,
pause/resume and Reduce Motion. Both are embedded in all four documentation locales.
The original fixed-attachment recordings are preserved.

The original `testPhysicsAttachmentChecks` and Android attachment audit were also
re-run on these same builds. Their unchanged verifier and corrupted-target negative
control passed: iOS recorded 1,529 frames / 6,099 steps; Android recorded 1,417 frames
/ 5,627 steps. Both exercised four drags, three releases, one cancellation, dock
choices 0 and 2, and zero retained worlds/guides. The original dated #39 evidence
files were not overwritten.

These are simulator/emulator correctness measurements with two bodies, not
physical-device performance, latency, battery or memory measurements. Wider
parameter coverage comes from the compiled kernels. Native lifecycle gestures
exercise cancellation via pause; the other lifecycle boundaries reuse that same
native cancellation path and have separate suspension/resize/teardown checks.
