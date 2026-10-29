# Native attachments and release snapping (#39, third milestone)

Current delivery status and revalidation: [physics completion audit](./physics-completion.md). The dated measurements below remain the original native captures.

The circle world now supports fixed-point springs and velocity-selected release docks. Both use the existing C/Java native solver, collision passes, input handlers and display clock. Optional tether lines use a shape layer on iOS and a drawable on Android. There is no JavaScript frame observer, additional physics dependency, new CI workflow or increased CI timeout.

## Reproduce

Build the ordinary Vue demo with `JOLT_BENCHMARK=1`, sequentially by platform, following `CONTRIBUTING.md`. Open `physics-attachments`. Add `--attachment-audit` on iOS or the string extra `attachment-audit=true` on Android for boundary-only Snapshot, Resize and Cancel drag controls. Reports go to `Documents/attachment-audit.json` on iOS and the app's external files directory on Android. The normal preview does not poll snapshots.

```sh
npm run typecheck
npm run benchmark:typecheck
npm test -- --maxWorkers=4
npm run build
python3 benchmarks/verify-circle-math.py
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR /tmp/JoltAttachments \
  testPhysicsAttachmentChecks testPhysicsAttachments
python3 benchmarks/physics-attachments-android.py YOUR_EMULATOR /tmp/JoltAttachments audit
python3 benchmarks/physics-attachments-android.py YOUR_EMULATOR /tmp/JoltAttachments record
python3 benchmarks/verify-physics-attachments.py \
  benchmarks/results/physics-attachments/ios.json \
  benchmarks/results/physics-attachments/android.json
npm run docs:check-media
npm run docs:build
```

Choose English through the preview language picker before the Android runs. XCTest selects English for recording. Copy the iOS report from the simulator's data container after the checks. The Android runner saves its report automatically and restores the original touch-indicator setting. Both recordings use real OS gestures and source playback timing. English clips are reused in the Portuguese guide.

The cancellation probe arms a two-second pause, then starts a real held drag that overlaps that deadline. It asserts a native cancellation without a native release and restoration of the previously selected dock. The timer only pauses the world; it does not synthesize touch input or move bodies.

## Evidence

`verify-circle-math.py` compiles the production C header and Java class. Its 28 fixtures include the prior 12 collision cases plus attachment return/sleep, gravitational stretch, tangential settling of a hanging spring, retarget velocity preservation, spring suspension while held, release return, velocity-based dock choice, nearest-point/tie behavior, release momentum, gravity-free docking, cancellation, resize without clamping drift, weak springs, occupied docks and the maximum stiffness/minimum mass combination. The long 16-body collision stress case verifies bounds independently on each port; all other cases compare numerical results. Negative controls remove pair impulses or spring forces and must fail their analytical oracles.

The integration suite has 1,404 passing tests. The added API cases cover validation before native mutation, input copying/defaults, paused commands, invalid retargeting, disposal and the absence of a JavaScript frame driver. All existing ownership, layout and lifecycle tests remain in place.

Native audit evidence and counts are stored beside this guide in `results/physics-attachments/`. The verifier checks:

- Native presentation within 0.5 DIP of solver coordinates, bounds, separation, speed and the existing per-frame work budget.
- Initial sleep; return to the hanging spring's gravity equilibrium after a real drag; both a slow release and a fast release whose velocity changes the selected dock.
- Anchor retargeting, cancellation restoring the prior dock, unchanged coordinates/frame counts while paused or under Reduce Motion, and layout shrinking and returning to its original size.
- Background suspension and foreground continuation, followed by zero retained worlds, clocks, scope resources or native tether guides after leaving the screen.
- Rejection of a deliberately corrupted native dock selection.

Recorded on 2026-10-25:

| Target                                    | Native frames / substeps | Real drags / releases / cancellations | Worlds / clocks / guides after exit |
| ----------------------------------------- | ------------------------ | ------------------------------------- | ----------------------------------- |
| iPhone 17, iOS 26.2 simulator             | 1529 / 6112              | 4 / 3 / 1                             | 0 / 0 / 0                           |
| Android 16/API 36 emulator, density 2.625 | 1354 / 5703              | 4 / 3 / 1                             | 0 / 0 / 0                           |

Accumulated native processing time was 311.175 ms for the iOS run and 146.960 ms for Android. Both selected docks 0 and 2 from the two real releases; in each run at least one release selected a different dock than position alone would select. The reviewed English H.264 clips are 17.2 seconds at 420 × 914 on iOS and 13.3 seconds at 420 × 934 on Android, with original playback timing.

These are simulator/emulator correctness runs with two bodies, not physical-device latency, battery or frame-time measurements. The screenshots and clips demonstrate native appearance and actual interaction; they do not establish performance on physical hardware.

## Contract and limits

Springs use elastic rest lengths and implicit viscous damping. Without contacts, a hanging attachment sleeps within 0.25 DIP of its gravity equilibrium; in zero gravity, its resting distance is the configured length. Contacts may instead support a body and stop it before that destination. A selected snap suppresses gravity and latches at its target only when sufficiently close, slow and unoccupied.

Anchors and snap points retain normalized coordinates across layout changes; circle radius and spring rest length remain fixed in DIPs. A cancelled drag restores its previous dock and does not select a new one from velocity. `attach()` replaces the complete attachment and clears the selected dock; `reset()` retains configurations but clears selected docks and release diagnostics.

The existing 16-body/40%-occupancy contract, fixed 1/240-second step, maximum 16 substeps per display tick, eight contact passes, 1200-DIP/s cap and bounded resize separation remain unchanged. Each body has at most eight configured snap points. Sleep removes the clock, and disposal removes the native guides as well as input and lifecycle hooks. NativeScript JavaScript still shares the UI thread with this work.

This milestone adds fixed-point springs and release docks, not body-to-body joints, rigid constraints or a general dynamics engine. Native interaction coverage uses the two-body preview; the compiled kernel cases cover broader parameter combinations. Physical-device acceptance, continuous multitouch and exhaustive layouts remain outside this evidence. The native interaction probes stay local and reproducible; ordinary CI continues to provide regression coverage.
