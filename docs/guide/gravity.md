# Gravity and bounce

Give a card a fixed landing position and let it fall and bounce. `{ type: 'gravity' }` is available since **0.1.0-rc.1** through the existing `animate()` API.

<Clip name="gravity-ios" caption="iOS simulator: the real native preview, with actual taps to drop, toss, pause/resume, return, change restitution and reduce motion. English UI; original speed." />
<Clip name="gravity-android" caption="Android emulator: the same ballistic motion and controls, rendered by native views and exercised with ADB taps. English UI; original speed. These recordings are not physical-device performance measurements." />

```ts
import { animate } from '@rafaelaugusto/jolt'

const falling = animate(
  card,
  { y: 280 },
  {
    type: 'gravity',
    acceleration: 1800,
    restitution: 0.55,
  },
)

falling.pause()
falling.play()
// Interrupt the fall and preserve its current position and velocity:
animate(card, { y: 0 }, 'smooth')
```

The endpoint is a boundary in the property's translation coordinates, not a detected floor or another view. If the card's untransformed top is 20 DIPs and its height is 100, a floor at 400 needs `y: 280`. Measure your own layout. The fixed trajectory does not respond to obstacles or a moving floor; retarget after layout changes.

## Physical parameters

| Option         | Default   | Meaning                                                                                                                                                  |
| -------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `acceleration` | `1800`    | Finite positive magnitude in units/second², directed from the starting value toward the endpoint. For view translations, units are DIPs.                 |
| `restitution`  | `0.55`    | Fraction of impact speed retained, from `0` inclusive to `1` exclusive. `0` lands without bouncing; each rebound's height scales by restitution squared. |
| `velocity`     | inherited | Signed units/second along the property axis. An explicit value overrides the interrupted animation's velocity; a resting view starts at zero.            |

Only `x`, `y` and numeric motion values support this curve. Supply a current/explicit start and one endpoint, not a multisegment keyframe list. Negative endpoints work: acceleration points toward the endpoint while velocity retains the axis's sign. When start and endpoint coincide, the boundary faces the positive axis; a negative velocity tosses away from it. Incoming positive velocity at that boundary reflects immediately.

The duration follows the physics. Do not combine gravity with `duration`, easing or spring parameters. `delay`, stagger, repeats, reverse playback, named layers, scopes, pause/resume and progress seeking use the existing animation contracts. Reverse playback reverses the recorded trajectory; it is not a new physical simulation. `finished` waits until the final bounce, so sequences do not advance at the first contact.

## One source, several views

```ts
import { animate, bind, motionScope, motionValue } from '@rafaelaugusto/jolt'

const scope = motionScope()
const height = motionValue(0)
scope.use(() => bind(ball, { y: height }))
scope.use(() =>
  bind(shadow, {
    scaleX: height.to([0, 280], [0.35, 1]),
    opacity: height.to([0, 280], [0.08, 0.4]),
  }),
)
scope.animate(height, 280, { type: 'gravity', restitution: 0.7 })
// Suspend on temporary inactivity; dispose when the screen is released.
```

Motion values retain their original units for acceleration and velocity. The **A softer landing** preview uses one value for the orb and shadow, with English, Portuguese, Spanish and Simplified Chinese controls. It also shows a toss and a spring interruption.

## Execution and limits

Jolt solves constant-acceleration flights analytically during setup. Exact contact and apex times are kept when sampling, and native players interpolate the samples. There is no JavaScript physics loop or per-frame application callback. This reuses Core Animation on iOS and the existing Android animation driver. NativeScript JavaScript shares the UI thread; native execution does not guarantee that every platform or binding path continues through a blocked UI thread.

Tracks settle at the boundary when the next rebound is within both position and speed tolerances. Translation/motion-value sampling uses a 0.25-unit interpolation tolerance; the shared sampler reports when extreme cases need its bounded-work fallback. Setup rejects trajectories exceeding 60 seconds or 512 flights, and nonfinite/overflowing inputs. Perfectly elastic endless bouncing is outside this finite curve's contract.

Reduce Motion goes directly to the resting endpoint through the existing configuration. The preview stops the running fall immediately when its Reduce Motion control is selected. Unloading/disposal releases bindings and owned animations; temporary backgrounding suspends the preview's scope.

Finite gravity, native [circle collisions](./circle-physics) and fixed-point [attachments and snapping](./physics-attachments) are the three delivered parts of [#39](https://github.com/rafaelaugustos/jolt/issues/39), available since **0.1.0-rc.1**. The optional circle world also supports one-shot impulses through `world.impulse()`. A spring anchor that follows the pointer is tracked separately in [#238](https://github.com/rafaelaugustos/jolt/issues/238); the current native drag is kinematic. Existing [decay snap points](./decay) and [live springs](./live-springs) retain their own contracts. See [validation](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/gravity.md) and the [delivery audit](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/physics-completion.md).
