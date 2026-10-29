# Circle physics

Let a handful of views bump into each other, bounce off their container and follow a finger. `physicsWorld()` is an optional entry available since **0.1.0-rc.1**. Rebuild the native app after upgrading.

<Clip name="circle-physics-ios" caption="iOS simulator: Bump Club with real native drag/release, circle and wall collisions, impulses, pause/resume and Reduce Motion. English UI, original speed." />
<Clip name="circle-physics-android" caption="Android emulator: the same native interaction, using actual ADB touches. English UI, original speed; simulator/emulator recordings are not physical-device performance measurements." />

Create the world **after layout**, using a dedicated `AbsoluteLayout` and square direct children. Each view's width and height must equal its circle's diameter. Positions are centers in container-local DIPs, with x right and y down.

```ts
import { physicsWorld } from '@rafaelaugusto/jolt/physics'
import { motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
// board is at least 240 × 300; red and blue are 48 × 48 direct children.
const world = physicsWorld(
  board,
  [
    { id: 'red', view: red, radius: 24, x: 70, y: 60 },
    { id: 'blue', view: blue, radius: 24, x: 170, y: 80, mass: 2 },
  ],
  { scope, restitution: 0.7 },
)

world.impulse('blue', { x: 180, y: -700 })
world.pause()
world.play()
world.reset()
// Read diagnostics on demand; no observer is required.
console.log(world.snapshot())
// On permanent screen teardown:
scope.dispose()
```

## Bodies and options

| Input           | Contract                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Bodies          | 1–16 nonoverlapping circles, unique nonempty IDs, radius 12–256 DIPs, mass 0.1–100 (default 1). All must start inside the container. |
| Area            | Combined circle area is at most 40% of container area. Every diameter must fit both dimensions.                                      |
| `velocity`      | Initial `{ x, y }` in DIPs/s, default zero; magnitude at most 1200.                                                                  |
| `gravity`       | `{ x: 0, y: 750 }` DIPs/s² by default; each component between −2000 and 2000.                                                        |
| `restitution`   | 0–1, default 0.65. Normal contacts below 40 DIPs/s settle without a bounce.                                                          |
| `damping`       | Exponential velocity damping per second, 0–20; default 0.5.                                                                          |
| `reducedMotion` | `'pause'` by default. `'continue'` is an explicit opt-in for essential interaction.                                                  |
| `scope`         | Optional active motion scope; suspension pauses, resumption restores prior playback and disposal removes the world.                  |

`impulse(id, {x,y})` uses mass × DIPs/s and adds impulse/mass to velocity. Components are bounded to ±120000; resulting speed is capped at 1200. Paused, detached, reduced and held bodies ignore impulses. `reset()` restores initial positions proportionally to current bounds and initial velocities, including while paused. `paused` reports explicit pause; `snapshot().status` also reports automatic suspension, sleeping and invalid bounds.

## Native interaction and ownership

The production C kernel on iOS and Java kernel on Android perform fixed 1/240-second steps. Native display callbacks advance physics and write native view translations; native pan/touch handlers drive dragging and release velocity. There is no JavaScript callback for each frame, pointer movement or collision. JavaScript creates the scene, sends commands, handles layout/lifecycle boundaries and reads optional snapshots. NativeScript shares its UI thread with JavaScript; this API does **not** promise motion through a blocked UI thread.

A held circle acts as a kinematic body and pushes other circles. One pointer/body may be held at a time; cancellation releases it with zero velocity. Release uses the platform's pointer velocity, capped at 1200 DIPs/s. Bodies have no rotation, friction, joints, arbitrary shapes, continuous collision detection or contact callbacks. This is a small UI playground solver, not a general rigid-body engine or Box2D integration.

Give the world exclusive ownership of its container and body views. Do not animate/bind their transforms, attach other gestures/native touch listeners, reparent bodies, or transform/scroll their coordinate space while it is active. Existing NativeScript gesture observers, initial transforms and duplicate world ownership are rejected. Keep decorative children noninteractive. Disposal removes native input/lifecycle hooks, stops its clock and restores the original translations and interaction flags.

## Bounds, rest and lifecycle

Resizing scales centers into the new bounds, cancels a drag, clears velocity and separates contacts. A container too small for its circles pauses the native clock until it fits again. Dense or adversarial arrangements are outside the sparse-circle contract; the bounded iterative solver is approximate.

Pause, app backgrounding, unload and Reduce Motion stop updates and cancel an active drag. Remaining dynamic velocities are retained for resumption. A world at rest sleeps and removes its display callback; touching a circle or applying an impulse wakes it. Each display frame runs at most 16 substeps (1/15 second). Time beyond that limit is discarded and reported as `droppedMs`, preventing unbounded catch-up work after a UI stall.

The **Better together** preview, branded Bump Club, has English, Portuguese, Spanish and Simplified Chinese controls. Native circle collisions and fixed-point [attachments and snapping](./physics-attachments) are both available in **0.1.0-rc.1**, alongside finite [gravity and bounce](./gravity). Together they form the delivered scope of [#39](https://github.com/rafaelaugustos/jolt/issues/39). A pointer-driven spring anchor is tracked in [#238](https://github.com/rafaelaugustos/jolt/issues/238); direct native dragging remains kinematic. General constraints and arbitrary shapes are outside the circle-world contract. See [native validation](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/circle-physics.md) and the [delivery audit](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/physics-completion.md).

If NativeScript rebuilds the native views, the world disposes automatically. Create a new world after the new layout. Unload/load that preserves the same native views only suspends and resumes.
