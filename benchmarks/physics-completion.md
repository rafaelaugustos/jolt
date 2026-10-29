# Physics delivery audit (#39)

Reviewed on **2026-10-29**, against `main` at `a0c244a`.

Subsequent development: [pointer spring dragging](./pointer-spring.md) implements
the separate #238 follow-up. The scope table below records the earlier audit of
the RC.1 delivery, before that addition.

[#39](https://github.com/rafaelaugustos/jolt/issues/39) proposed two execution paths:
precomputed fall/bounce and interactive native simulation. The delivered work spans
three merged PRs, available in **0.1.0-rc.1**. This audit consolidates that delivery
and separates the unimplemented pointer-following spring anchor into
[#238](https://github.com/rafaelaugustos/jolt/issues/238).

## Scope and disposition

| Original intent                                             | Delivered API / behavior                                                                                                      | Evidence                                                                                                   |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Precompute falling and bouncing, then play native keyframes | `animate(..., { type: 'gravity' })`, finite ballistic tracks, exact impact seams, pause/seek/resume and interruption velocity | [#226](https://github.com/rafaelaugustos/jolt/pull/226), [gravity validation](./gravity.md)                |
| Views collide with each other and their bounds              | `physicsWorld()`, 1–16 circles, native pair/wall contacts, drag/release, bounded stepping and sleep                           | [#227](https://github.com/rafaelaugustos/jolt/pull/227), [circle validation](./circle-physics.md)          |
| Push a body and preserve release momentum                   | `world.impulse()` adds instantaneous momentum; native dragging uses a kinematic body that can push other circles              | [circle tests and captures](./circle-physics.md)                                                           |
| Attach a body to an anchor and return after release         | Fixed-point spring attachment, elastic rest length, `attach()` retargeting and optional native tether                         | [#228](https://github.com/rafaelaugustos/jolt/pull/228), [attachment validation](./physics-attachments.md) |
| Snap to a resting point                                     | Native velocity-projected release choice and explicit `snapTo()`, with cancellation restoring the previous dock               | [attachment validation](./physics-attachments.md)                                                          |
| A dynamic body hangs from an anchor that follows the finger | **Not implemented.** The current drag directly controls body position and suspends spring forces while held                   | Dedicated follow-up [#238](https://github.com/rafaelaugustos/jolt/issues/238)                              |

The original issue suggested UIKit Dynamics on iOS and Kotlin on Android. The
implementation instead uses a shared C algorithm on iOS and a Java port on Android,
with matching analytical tests. Both native wrappers own input, simulation clocks
and view writes. JS handles setup, commands and lifecycle boundaries. The native
loop shares the UI thread with NativeScript; it does not promise progress through
a blocked UI thread.

The umbrella delivery can be closed with the pointer-anchor behavior explicitly
tracked in #238. This does not claim a general UIKit Dynamics replacement.
Body-to-body joints, rigid constraints, arbitrary shapes, rotation/friction,
continuous forces and continuous multitouch are outside the published circle-world
contract. `world.impulse()` is an instantaneous impulse, not a continuous-force API.

## Revalidation

The physics implementation, the three demo components and the six MP4 files have
not changed since #228 (`a036ecf`). This review changes documentation and issue
tracking. Existing media and native reports are preserved.

Checks executed again on 2026-10-29:

- **29 host tests** in `test/gravity.spec.ts` and `test/physics.spec.ts` passed.
- **28 fixtures** compiled the current production C and Java kernels and passed
  analytical checks, port comparisons and the bounded 16-body stress case. Negative
  controls that remove pair impulses or spring forces were rejected.
- The gravity, circle and attachment report verifiers passed for **all six archived
  native reports**, including their deliberately corrupted presentation/target
  negative controls.
- All six H.264 recordings decoded without errors and were visually inspected
  across their duration. Falling/bouncing, drag/release and collision responses,
  tether stretching/return, slow/fast snap choice and playback controls are visible.
- `npm run docs:check-media` and `npm run docs:build` validate the four-language
  documentation. The same English clips remain embedded in each locale.

The native reports are the original simulator/emulator observations documented in
#226–#228 and their validation notes, not new device measurements from this review.
They include pause/Reduce Motion, resize, background/resume and cleanup. Gravity
exits with zero scope resources; circles exit with zero worlds/clocks/resources;
attachments additionally release all tether guides. Simulator/emulator correctness
is accepted for this delivery. Physical-device performance, battery use and process
memory are not measured here.

| Recording                         | Duration | Dimensions | Platform         |
| --------------------------------- | -------- | ---------- | ---------------- |
| `gravity-ios.mp4`                 | 17.70 s  | 420 × 914  | iOS simulator    |
| `gravity-android.mp4`             | 11.77 s  | 420 × 934  | Android emulator |
| `circle-physics-ios.mp4`          | 15.93 s  | 420 × 914  | iOS simulator    |
| `circle-physics-android.mp4`      | 10.47 s  | 420 × 934  | Android emulator |
| `physics-attachments-ios.mp4`     | 17.20 s  | 420 × 914  | iOS simulator    |
| `physics-attachments-android.mp4` | 13.30 s  | 420 × 934  | Android emulator |

## Reproduce this audit

```sh
npm test -- test/gravity.spec.ts test/physics.spec.ts
python3 benchmarks/verify-circle-math.py
python3 benchmarks/verify-gravity.py benchmarks/results/gravity/ios.json \
  benchmarks/results/gravity/android.json
python3 benchmarks/verify-circle-physics.py benchmarks/results/circle-physics/ios.json \
  benchmarks/results/circle-physics/android.json
python3 benchmarks/verify-physics-attachments.py benchmarks/results/physics-attachments/ios.json \
  benchmarks/results/physics-attachments/android.json
npm run docs:check-media
npm run docs:build
```

The C/Java check requires clang and a JDK. For fresh native interactions, use the
XCTest/ADB procedures in the three linked validation guides and
[CONTRIBUTING.md](../CONTRIBUTING.md). The existing recordings remain the visual
reference for the delivered behavior; a future behavior change needs its own
reviewed native recording.
