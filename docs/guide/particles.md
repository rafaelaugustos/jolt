# Particles and confetti

## Confetti

<Clip name="particles" caption="The original iOS confetti demonstration, emitted from a point." />

```ts
import { confetti } from '@rafaelaugusto/jolt'

const stopConfetti = confetti(button, {
  count: 80,
  colors: ['#facc15', '#ef4444', '#3b82f6'],
})
```

Confetti bursts upward from the center of the target, then falls under gravity. It renders in the target's window, so the button's rounded corners and parent clipping do not cut it off. It adds no interactive view and leaves the target's appearance, masks and hit testing unchanged.

The origin is captured when the burst starts, in window coordinates. Moving or scrolling the button afterward does not move particles that are already flying. A new burst captures the new position, including scrolling and transforms. `count` is an approximate emission count, not a promise of an exact number of visible particles: clipping, native scheduling and lifetime affect visibility. The default is `80`, with a five-color palette. Random trajectories may differ between platforms.

Emission lasts 200 ms and particles live for 2200 ms. The layer is removed automatically after they expire. Call `stopConfetti()` to remove it immediately.

## Continuous emitters

`particles()` attaches an emitter above the target's content: a layer on iOS, a drawable in its `ViewOverlay` on Android. It follows the target's transforms and scroll position, and resizes the source for new births without restarting existing particles. Android clips the drawable to the target's bounds and uniform `borderRadius`; iOS follows the host layer's clipping. Use a layout as the target when particles should cover a scene rather than a single control.

Confetti uses the window's top-level layer/overlay, so it can cross the button and its parent layouts. It remains bounded by that window, below separate system windows. Neither backend adds a touch target or accessibility element; controls beneath the effect remain usable.

```ts
import { particles } from '@rafaelaugusto/jolt'

const stopSnow = particles(scene, {
  source: 'top',
  angle: 90,
  rate: 30,
  velocity: 45,
  velocityRange: 15,
  spread: 30,
  size: 5,
  lifetime: 5000,
})

// Remove the emitter and its particles:
stopSnow()
```

Sparks emit in all directions from the center:

```ts
particles(scene, {
  colors: ['#facc15', '#fb923c'],
  velocity: 120,
  velocityRange: 50,
  spread: 360,
  rate: 70,
  size: 3,
  lifetime: 1000,
})
```

Bubbles rise from the bottom:

```ts
particles(scene, {
  shape: 'ring',
  source: 'bottom',
  colors: ['#67e8f9', '#a5f3fc'],
  velocity: 40,
  spread: 20,
  rate: 14,
  size: 18,
  lifetime: 5000,
})
```

Add `duration` to stop emission after a finite number of milliseconds. Existing particles finish their lifetimes before native resources are removed:

```ts
particles(scene, {
  shape: 'rectangle',
  colors: ['#facc15', '#fb923c'],
  rate: 90,
  duration: 700,
  lifetime: 1400,
  velocity: 100,
  gravity: 130,
  spinRange: 240,
})
```

The cutoff is native on both platforms. iOS uses Core Animation and a final JS cleanup timer. Android uses a monotonic native clock and native cleanup; blocking its UI thread delays drawing and callback delivery, but does not extend emission/lifetimes. On return it skips already-expired births and removes completed effects. Effects cancelled by backgrounding never accumulate a backlog.

<Clip name="particles-android" caption="Android 16 / API 36 emulator: real taps through snow, rings and window confetti; sparks, finite rectangles, resize and reduced motion. Real-time native UI-thread drawing, which can stall when that thread is busy." />

| Option                       | Default       | Meaning                                                                              |
| ---------------------------- | ------------- | ------------------------------------------------------------------------------------ |
| `colors`                     | `['#ffffff']` | NativeScript color strings, shared equally by emission rate.                         |
| `shape`                      | `'circle'`    | `'circle'`, `'rectangle'` or `'ring'`.                                               |
| `source`                     | `'center'`    | A center point, or a line across the `'top'` or `'bottom'`.                          |
| `rate`                       | `20`          | Total particles per second, across all colors.                                       |
| `lifetime`                   | `3000`        | Milliseconds each particle lives.                                                    |
| `size`                       | `6`           | Longest side in DIPs.                                                                |
| `velocity` / `velocityRange` | `60` / `0`    | Initial speed and native random variation, in DIPs per second.                       |
| `angle` / `spread`           | `-90` / `30`  | Direction and emission cone in degrees. Right is `0`, down is `90`, up is `-90`.     |
| `gravity`                    | `0`           | Downward acceleration in DIPs per second squared; negative values accelerate upward. |
| `spin` / `spinRange`         | `0` / `0`     | Rotation and native random variation, in degrees per second.                         |
| `fadeOut`                    | `true`        | Fade particles over their lifetimes.                                                 |
| `duration`                   | Omitted       | Milliseconds of emission; omitted means continuous.                                  |

Values must be finite. Limits are 1–32 colors, 1–128 DIP size, 1–60000 ms lifetime, 0–10000 particles per second, and an estimated live population (`rate × lifetime / 1000`) of at most 10000. Velocity and its variation are 0–10000, gravity is −10000–10000, angle is −360–360, spread is 0–360, spin is −3600–3600 and its variation is 0–3600. A finite duration must be positive and leave room for lifetime plus 50 ms within a 32-bit timer. Confetti accepts an integer count from 0 to 10000. Zero count or rate removes the previous matching effect without starting another.

## Cleanup and compatibility

Both functions accept a view or a ref holding one and return an idempotent cleanup function. One confetti burst and one particle emitter may coexist on a view. Starting another of the same kind replaces the previous one; an old cleanup function cannot remove its replacement. `stop(view)` controls `animate()` tracks; use the returned function for particles.

Calls made before loading wait for a window and a nonzero layout; their emission clock starts only when attached. Unloading, changing native views/windows, detaching a native Android target, or resizing an active target to zero removes the effect. App backgrounding explicitly cancels both effects. They do not replay automatically on reload or foregrounding. Keep the cleanup function and call it when your component is disposed.

Use an existing motion scope to own the cleanup:

```ts
const scope = motionScope() // useMotionScope() in Vue
const remove = scope.use(() => particles(scene, { source: 'top', angle: 90 }))
// remove() or scope.dispose() removes the emitter immediately.
```

`scope.use()` is a subscription factory: suspension removes its effect, and an explicit scope resume invokes the factory to create a fresh one. It does not resume the old particles. In Vue, create it after the ref is mounted and let `useMotionScope()` dispose it on unmount.

## Platforms and timing

| Capability                                                    | iOS                          | Android                                      |
| ------------------------------------------------------------- | ---------------------------- | -------------------------------------------- |
| Circles, rectangles, rings; center/top/bottom sources         | Native `CAEmitterLayer`      | Native Java simulation and `Canvas` drawable |
| Continuous, finite and confetti emission                      | Supported                    | Supported                                    |
| Colors/alpha, size, velocity/range, gravity, spin/range, fade | Supported                    | Supported                                    |
| Window confetti and touch pass-through                        | Supported                    | Supported                                    |
| JS simulation or paint callback per frame                     | None                         | None                                         |
| Background/unload cleanup, live reduced-motion changes        | Cancels; no automatic replay | Cancels; no automatic replay                 |

The Android backend is bundled with Jolt, uses platform APIs, and adds no optional plugin, third-party dependency or permission. Rebuild the Android app after upgrading; a JS-only update cannot install the Java classes or their bridge metadata. The existing NativeScript requirements are unchanged.

Reduce Motion skips effects; enabling it through `configure()` while an effect runs removes it. Android also watches the platform animator scale natively: **scale 0 cancels/skips effects even with `reducedMotion: 'never'`**. Positive scales such as **0.5 and 2 keep particle durations and physical units in wall time**, like `timeScale`, which does not retime this effect. A setting change cannot leave an endless finite emitter. Restoring motion requires a new call.

Android preallocates at most 10,000 particle slots per emitter, reusing arrays and paint/path resources. Continuous emitters allocate `ceil(rate × lifetime / 1000)` slots; finite emitters need only the smaller emission/lifetime window. A slot uses 36 bytes of primitive state, about 352 KiB at the limit, plus small fixed native objects and diagnostics buffers. The animation loop does not create a JS callback or a Java object for each particle/frame. Cleanup releases the arrays, drawable, frame/deadline callbacks and settings observer.

This is native **UI-thread** drawing. On the physical ASUS API 26, ordinary snowfall (30 births/s, peak 121 during the measured four seconds) had a 16.73 ms p95 callback interval; the 10,000-particle stress case reached 167.05 ms. The API 36 emulator measured 16.67 ms and 33.33 ms respectively. These are observed Choreographer intervals, not GPU/presentation guarantees or device rankings. Keep populations modest for interactive scenes; the 10,000 cap bounds storage. Exact environments, CPU draw costs, tolerances and raw results are in [the validation report](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/particles.md).

<Clip name="particles-android-device" caption="Physical ASUS_Z017DC, Android 8 / API 26: real taps through active effects, continuous and finite emission, resize and reduced motion. Native UI-thread playback at real time; stress measurements are separate from this ordinary demo." />

<Clip name="particles-ios" caption="iPhone 17 simulator, iOS 26: the unchanged particle API, all shapes/source modes, touch pass-through, resize and live reduced motion, exercised with XCTest taps. Existing iOS footage is preserved above." />
