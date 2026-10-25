# Finite gravity trajectories (#39)

This delivery adds analytic fall/bounce against one fixed scalar boundary through `animate(..., { type: 'gravity' })`. It reuses native keyframe playback. It does not add per-frame JS physics, a new native CI job or a longer timeout. Interactive bodies, moving collision geometry, attachments and pushes remain outside this milestone.

The **A softer landing** preview uses one physical motion value for the orb's translation/rotation and the shadow's width/opacity. UI is available in EN/PT/ES/zh-Hans. The same reviewed English recordings are embedded in both guides and attached to the PR.

## Reproduce

Build the normal Vue preview with `JOLT_BENCHMARK=1`, using assigned device IDs and sequential iOS/Android builds as described in `CONTRIBUTING.md`. Open the `gravity` example. `--gravity-audit` adds a Snapshot control and writes boundary-only diagnostics to `Documents/gravity-audit.json` on iOS, or the app's external files directory on Android. No polling drives the animation.

```sh
npm test
npm run typecheck
npm run benchmark:typecheck
npm run build
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR /tmp/JoltGravity \
  testGravityChecks testGravity
python3 benchmarks/gravity-android.py YOUR_EMULATOR /tmp/JoltGravity audit
python3 benchmarks/gravity-android.py YOUR_EMULATOR /tmp/JoltGravity record
python3 benchmarks/verify-gravity.py benchmarks/results/gravity/ios.json \
  benchmarks/results/gravity/android.json
npm run docs:check-media
npm run docs:build
```

Select English before Android recording. XCTest/ADB sends actual OS input. No application-generated gesture trace is substituted for these touches. Recordings retain original timing; they show simulator/emulator rendering, not physical-device performance.

## Evidence and boundaries

The host tests compare the solver with closed-form ballistic positions, velocities and impact times, check restitution-squared rebound heights, negative direction, upward launch, zero-energy contact, exact seams and dense reconstruction of native samples. Integration covers interruption velocity, motion-value units, pause/seek/resume, scope disposal, reduced motion, stagger/reverse playback, transition overrides, speed scaling and rejection before replacing existing property ownership.

Native audits check an actual presented translation during a paused fall, stable progress and position while held, successful continuation, spring return to the top, zero-restitution landing, immediate reduced-motion settlement, background suspension/resumption and zero retained scope resources after leaving. A deliberately corrupted native position must fail the verifier. Reports are correctness evidence; scope-resource counts are not process-memory measurements.

No physical-device latency, battery or comparative frame-time claim is made. The implementation uses the existing players and their UI-thread constraints. Use the ordinary Native CI for driver regression coverage; these focused interactive checks remain locally reproducible without adding a long-running workflow.
