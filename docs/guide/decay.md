# Decay

Give a view a velocity and let it slow down, like a card after a fling:

```ts
import { decay } from '@rafaelaugusto/jolt'

decay(card, { x: 600 })
decay(card, { x: -400, y: 200 }, { friction: 0.995 })
```

`x` and `y` are translation velocities in **DIPs per second**, starting from the current position. Omitted axes keep doing what they were doing. A target can be a view, a template ref, an `ElementRef`, or an array of these.

`friction` is the velocity multiplier per millisecond. It defaults to `0.998`; smaller values slow down sooner, values closer to `1` travel farther. It must be finite and strictly between `0` and `1`. The motion follows elapsed time, so changing the display's refresh rate doesn't change the landing.

The complete curve is calculated once and played by Core Animation on iOS or `ObjectAnimator` on Android, with no JavaScript per frame. This uses the existing drivers; native validation for this addition was done on iOS.

## Snap points

```ts
decay(card, { x: 600 }, { snap: [0, 320] })

decay(
  card,
  { x: 600, y: -400 },
  {
    snap: { x: [0, 320], y: [-200, 0] },
  },
)
```

With `snap`, Jolt projects where the decay would stop, picks the closest position and springs there **directly**, preserving the supplied velocity. It uses the default spring. It doesn't wait for the decay to finish before snapping.

An array applies the same stops to each supplied axis. An object sets stops independently; an axis without stops decays freely. Stops can be unsorted, must be finite and each list must contain at least one position. Ties use the first listed stop. Positions are absolute translations in DIPs, rather than offsets from the starting position.

## Interrupting and stopping

```ts
const motion = decay(card, { x: 600 })
motion.stop() // leave the card where it is

stop(card, ['x']) // also stops a decay on this axis

await sequence([
  () => decay(card, { x: 600 }, { snap: [0, 320] }),
  () => animate(card, { opacity: 0 }),
])
```

`decay()` returns the same `Animation` handle as `animate()`: `await` it or read `finished`. It resolves with `true` on completion and `false` if stopped or replaced. A snapped spring can advance a sequence when it visually arrives, like other springs.

`decay()` and `animate()` share property ownership. Each starts from the other's current position; a spring started by `animate()` inherits the decay's current velocity. A new `decay()` uses the velocity passed to it. Calls made before loading wait for the view and read its position then; stopping before load cancels playback.

Velocities must be finite. Inputs whose projection overflows or whose duration exceeds the platform timer range are rejected before taking over an animation. Very long free decays cap their native keyframe count at 6,001.

This provides the motion after release. Gesture tracking, bounds and collision handling are separate.
