# Springs that follow a moving target

`springValue()` retains a native spring's position and velocity while its target changes. Retargeting updates the existing node; it does not rebuild a keyframe animation. A follower can drive another follower without a JavaScript subscription between them.

```ts
import { bind, motionScope, motionValue, set, springValue } from '@rafaelaugusto/jolt'

const scope = motionScope()
const pointer = motionValue(0)
const first = scope.add(springValue(pointer, { stiffness: 260, damping: 24 }))
const second = scope.add(springValue(first, { stiffness: 260, damping: 24 }))
scope.use(() => bind(cursor, { x: first }))
scope.use(() => bind(trailingCursor, { x: second }))

set(pointer, 180)
set(pointer, -40) // preserves each follower's position and velocity
// On page/component disposal:
scope.dispose()
```

<Clip name="live-springs-ios" caption="Three native followers on an iOS simulator: target reversals, real touch drags, an additive shake and reduced motion. Real-time playback; this recording does not demonstrate physical-device 120 Hz performance." />

<Clip name="live-springs-android" caption="The same follower chain on an Android emulator, driven by real taps and swipes. The last follower also receives a shake layer; reduced motion moves the chain directly to its target." />

## Sources and bindings

The source can be a motion value, a numeric mapping, or another spring value. `animate(pointer, ...)` sends a sampled source track at playback boundaries, so the follower can also follow a native timeline. Numeric `to()` mappings, including descending ranges, repeated stops and extrapolation, execute natively for follower chains and bindings.

Bind the result to `x`, `y`, `scale`, `scaleX`, `scaleY`, `rotate`, `rotateX`, `rotateY` or `opacity`. Colors, decorations and compound native adapters are not supported by this live path yet. The spring value is read-only: update its source instead of passing the follower to `animate()` or `set()`.

Named transform and opacity layers still compose with the bound base:

```ts
bind(card, { x: first })
animate(card, { x: [0, -12, 12, 0] }, { layer: 'feedback', duration: 500 })
```

The native mixer adds translation/rotation layers and multiplies scale/opacity layers. Pausing or stopping a layer leaves the follower running. Replacing a live binding with a regular animation detaches it and commits its current base position; the follower keeps driving its other bindings.

## Configuration and lifetime

Options accept `stiffness`, `damping`, `mass`, or the existing `duration`/`bounce` spring parameterization. `initial` selects a starting position; otherwise the follower starts at its source's current value. `duration: 0` follows immediately. The global time scale is captured when the follower is created.

`restDelta` defaults to **0.001 source units** and `restSpeed` to **0.01 source units per second**. Both must be positive. A resting spring holds its target exactly and stops requesting frames when no other native follower or layer needs them. It wakes on the next target change. Rest is not disposal: the subscription remains owned by its scope until `dispose()`.

`get()` and `getVelocity()` read the native state. `moving` reports spring motion, independently of any layer. `subscribe()` explicitly opts into JavaScript observation; plain bindings and follower chains require no per-frame JS callbacks. Unloading a bound view removes its native binding, and loading it again uses the follower's current state.

`pause()` holds position and velocity; `play()` resumes toward the current target. A motion scope pauses retained springs during suspension and resumes them without creating new nodes. A manually paused spring remains paused across app background/resume. In Vue, use `useMotionScope().add(springValue(source, options))` with `useBinding()` to own the follower through cached-component activation and actual unmount.

Reduced motion updates the chain directly to its current target. App suspension holds spring state; resume follows the current source again. The live scheduler uses bounded substeps of at most 1/240 second and integrates at most 64 ms after a delayed frame, avoiding a large catch-up jump. Fixed-target `animate()` calls retain their existing Core Animation / Android playback paths.

The demo's touch events currently update the source from JavaScript. Native gesture input and scroll handoff are separate work; `springValue()` does not make the gesture recognizer itself native. The C and Java spring kernels have matching trajectory tests, including 60/120 Hz time-step partitioning and delayed frames. Those tests do not replace performance measurements on physical devices.
