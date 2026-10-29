# Attachments and snap points

Give a circle somewhere to return to, or let a release choose its next resting point. Attachments and snapping extend the native [`physicsWorld()`](./circle-physics) entry in **0.1.0-rc.1**. Rebuild the native app.

<Clip name="physics-attachments-ios" caption="iOS simulator: actual dragging stretches the copper tether; slow and fast releases move the lilac circle between docks. Native line drawing, anchor retargeting, pause/resume and Reduce Motion. English UI, recorded source timing." />
<Clip name="physics-attachments-android" caption="Android emulator: the same interactions with real ADB gestures, native spring/collision stepping and native tether drawing. English UI, recorded source timing; not a physical-device performance measurement." />

Create the world after layout. The dedicated container, square circle views, ownership, density and body limits from [circle physics](./circle-physics) still apply.

```ts
import { physicsWorld } from '@rafaelaugusto/jolt/physics'

// board is 320 × 360; copper is 56 × 56 and lilac is 52 × 52.
const world = physicsWorld(board, [
  {
    id: 'copper',
    view: copper,
    radius: 28,
    x: 160,
    y: 130,
    attachment: {
      anchor: { x: 160, y: 50 },
      length: 72,
      stiffness: 180,
      damping: 14,
      line: { color: '#DBB994', width: 1.5 },
    },
  },
  {
    id: 'lilac',
    view: lilac,
    radius: 26,
    x: 160,
    y: 280,
    snap: {
      points: [
        { x: 64, y: 280 },
        { x: 160, y: 280 },
        { x: 256, y: 280 },
      ],
      stiffness: 220,
      damping: 25,
      projection: 0.12,
    },
  },
])
world.snapTo('lilac', 1) // Optional initial dock; release selection is automatic.
// Later, retarget without resetting the current velocity:
world.attach('copper', { anchor: { x: 100, y: 50 }, length: 72 })
world.snapTo('lilac', 2)
// Remove the anchor spring and any selected snap:
world.attach('copper', null)
// On permanent teardown (or use an owning motionScope):
world.dispose()
```

## Anchor spring

An `attachment` connects a body center to a fixed point in the container. `anchor` uses local DIPs and must start inside the board. `length` is the spring's rest length, 0–10000 DIPs (default 0). It is an elastic distance, not a hard rope limit. A hanging body's equilibrium includes gravitational stretch: in a vertical configuration, the extra distance is `mass * gravity / stiffness`.

`stiffness` is force per DIP, 1–1000 (default 180). `damping` is viscous damping, 0–120 (default 24), distinct from the world's exponential velocity damping. Existing body mass affects the response. The native fixed-step integrator applies spring force and implicit viscous damping together with collisions and the existing speed cap.

Optional `line` draws the connection from the anchor to the circle edge. Its color is `#RRGGBB`; width is 0.5–6 DIPs (default 1.5). iOS uses a shape layer and Android a drawable. The existing native world tick updates the line; there is no extra display clock or JavaScript observer. Retargeting replaces the whole attachment configuration, including line styling. Omitting `line` removes the old line.

## Release snapping

`snap.points` contains 1–8 distinct, valid circle centers. The circle starts without a selected dock; use `snapTo(id, index)` if it should start attached to one. On native release, Jolt caps the incoming pointer speed, projects the body's release position by `velocity * projection`, then selects the closest point. `projection` is 0–0.3 seconds (default 0.12); zero chooses by current position. Equal-distance ties choose the first configured point.

The snap spring preserves the release velocity and settles toward the selected center. Gravity is suppressed for that body's selected snap so it does not settle below the dock. Collision resolution still applies: an occupied dock can prevent arrival. `snapshot().bodies[i].snap` reports the chosen index/point and whether the circle is within 0.25 DIP at low speed; it does not promise exclusive reservation. The native `release` diagnostic records position and capped velocity before snap selection/integration.

Snap stiffness/damping use the same ranges/defaults as attachment springs. One body may configure both behaviors: the selected snap takes precedence; a new drag suspends spring forces, and its release chooses again. The optional line then points to the effective spring target.

## Commands, cancellation and layout

- `attach(id, options | null)` replaces/removes the anchor, clears the selected snap and preserves velocity. It accepts changes while paused, but invalid bounds must fit the circles before retargeting.
- `snapTo(id, index)` selects a configured target, including while paused. It ignores a body currently being dragged. Provide accessible buttons for this command alongside direct manipulation.
- Native dragging is kinematic. Cancellation, pause, unload, backgrounding and Reduce Motion release the held body with zero velocity and restore its previous selected snap; they do not choose a new dock from a cancelled gesture.
- `reset()` restores initial positions/velocities, clears selected docks and release diagnostics, and keeps the current attachment/point configurations. Call `snapTo()` again to select an initial dock.
- Anchors and points scale with container bounds using stored normalized coordinates; points clamp to valid circle centers without accumulating resize drift. Circle radius and attachment rest length stay fixed in DIPs. Resize cancels a held body and clears velocities as before.

Pause/Reduce Motion stop the existing native clock. A settled spring sleeps; an impulse, retarget or new gesture wakes it. Disposal removes native guides along with the world's existing input/lifecycle resources. Input changes and lifecycle boundaries cross JavaScript; forces, target selection, contacts, drawing and per-frame view updates stay native. The UI thread is still shared with NativeScript JavaScript.

The four-language **A place to return / Equilibrium** preview demonstrates both behaviors. Fixed-point springs and release docks are the third delivered part of [#39](https://github.com/rafaelaugustos/jolt/issues/39), available in **0.1.0-rc.1**. Default direct dragging suspends spring forces. The development build adds the opt-in pointer spring mode from [#238](https://github.com/rafaelaugustos/jolt/issues/238), documented below. Body-to-body joints, rigid constraints, arbitrary shapes and a general dynamics engine remain outside this contract. See [validation and reproduction](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/physics-attachments.md) and the [delivery audit](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/physics-completion.md).

## Pointer spring dragging (development build)

This addition is in the development build after RC.1; rebuild the native app. Set `CircleBody.drag` to `{ type: 'spring' }` to move a temporary anchor with native pointer input. The circle remains dynamic: gravity, mass and contacts keep acting while it follows the spring. Omitting `drag`, or using `'direct'`, preserves direct kinematic dragging.

<Clip name="pointer-spring-ios" caption="iOS simulator: real XCTest drags move a temporary spring anchor, with visible lag, contact response, return and snapping on release, pause/resume and Reduce Motion. English UI, original playback timing; simulator correctness, not physical-device performance." />
<Clip name="pointer-spring-android" caption="Android emulator: actual ADB drags show the moving spring tether, collision response and release to the resting spring or dock. Pause/resume and Reduce Motion; English UI, original timing, not physical-device performance." />

```ts
const world = physicsWorld(board, [
  {
    id: 'orb',
    view: orb,
    radius: 28,
    x: 160,
    y: 130,
    drag: {
      type: 'spring',
      length: 45,
      stiffness: 140,
      damping: 12,
      line: { color: '#FFE1A6', width: 2 },
    },
    attachment: { anchor: { x: 160, y: 50 }, length: 72 },
  },
])
```

`length` is the elastic rest length in DIPs (0–10000, default 0), `stiffness` is 1–1000 (default 180), and `damping` is 0–120 (default 24). Optional `line` uses `#RRGGBB` and a width of 0.5–6 DIPs (default 1.5). These options are copied at creation. The pointer tether is visible only while held; an existing fixed-anchor tether resumes afterward.

The gesture must start inside the currently displayed circle. One pointer owns one body per world. The center-to-contact offset is preserved: the temporary target is pointer position plus that initial offset, clamped to the container's local bounds. It is not a point joint on the body surface; circles do not rotate. Simultaneous multitouch and transformed ancestors remain unsupported.

A successful release removes the temporary anchor and preserves the **body's simulated velocity**, rather than replacing it with finger velocity. Configured snap points choose their dock from that position/velocity; otherwise the fixed attachment resumes, or a body without one continues freely. Cancellation removes pointer ownership, clears velocity and restores the previously selected dock without recording a release. Pause, Reduce Motion, unload, backgrounding, resize, reset and disposal cancel the gesture. `attach()` changes the resting spring; it does not retarget the active pointer spring. `snapTo()` and `impulse()` continue to ignore a held body.

`snapshot().bodies[i].held` reports input ownership in both modes. `pointer` describes the active temporary anchor and spring, or is `null`; `attachment` keeps describing the resting anchor. Native input, integration and tether drawing use the existing bounded native clock, with no JavaScript callback per movement or frame. This still shares the UI thread. See [native checks and limits](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/pointer-spring.md).
