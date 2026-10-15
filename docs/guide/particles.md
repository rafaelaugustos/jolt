# Particles and confetti

## Confetti

```ts
import { confetti } from '@rafaelaugusto/jolt'

const stopConfetti = confetti(button, {
  count: 80,
  colors: ['#facc15', '#ef4444', '#3b82f6'],
})
```

Confetti bursts upward from the center of the target, then falls under gravity. It renders in the target's window, so the button's rounded corners and parent clipping do not cut it off. It adds no interactive view and leaves the target's appearance, masks and hit testing unchanged.

The origin is captured when the burst starts. Moving or scrolling the button afterward does not move particles that are already flying. `count` is an approximate emission count, not a promise of an exact number of visible particles: Core Animation controls emission and visibility. The default is `80`, with a five-color palette.

Emission lasts 200 ms and particles live for 2200 ms. The layer is removed automatically after they expire. Call `stopConfetti()` to remove it immediately.

## Continuous emitters

`particles()` attaches an emitter to the target's own layer. It follows that view's transforms and clipping, and resizes its emission source with layout changes.

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

Add `duration` to stop emission after a finite number of milliseconds. Existing particles finish their lifetimes before the layer is removed. The emission cutoff runs in Core Animation even if JavaScript is busy; the final resource cleanup may wait for JavaScript to become responsive.

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

Calls made before loading wait for a window and a nonzero layout. Unloading, changing native views/windows or resizing an active target to zero removes the effect. Unloading includes backgrounding the app. Effects do not replay automatically on reload; start a new one when appropriate. Keep the cleanup function and call it when your component is disposed.

This implementation is **iOS only**, using `CAEmitterLayer` with no JavaScript callback per frame. Android returns a no-op cleanup function. Reduce Motion skips effects; enabling it while an emitter is active removes that emitter without replaying it later.
