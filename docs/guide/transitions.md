# Springs and tweens

The third argument of `animate()` says how to get there. Without one, transforms move with a spring and `opacity` eases over 300ms. Keyframes tween.

<Clip name="springs" caption="The three named springs on an interruptible ball." />

## Springs

```ts
animate(card, { scale: 1.2 }, 'bouncy')
animate(card, { y: 0 }, { bounce: 0.3, duration: 600 })
animate(card, { y: 0 }, { stiffness: 300, damping: 20, mass: 1 })
```

| Spring   | Feel                                  |
| -------- | ------------------------------------- |
| `smooth` | no overshoot                          |
| `snappy` | quick, barely overshoots. The default |
| `bouncy` | overshoots and settles with a bounce  |

`bounce` goes from -1 to 1: 0 settles without overshooting, higher values bounce more, negative values settle more slowly. `duration` is how long the spring feels, the same model as SwiftUI. Or describe it with `stiffness`, `damping` and `mass`. A spring starts with the velocity of the animation it interrupts, unless you pass `velocity` (units per second).

## Tweens

```ts
animate(card, { opacity: 0 }, { duration: 200, ease: 'easeIn' })
animate(
  card,
  { x: [0, 100, 50] },
  { duration: 600, ease: ['easeOut', 'easeIn'], times: [0, 0.3, 1] },
)
```

Tweens take 300ms and `easeOut` unless told otherwise. `ease` takes `linear`, `ease`, `easeIn`, `easeOut`, `easeInOut`, `circIn`, `circOut`, `circInOut`, `backIn`, `backOut`, `backInOut`, `anticipate`, a cubic bezier (`[0.2, 0, 0, 1]`) or any function from 0..1 to a value. With keyframes, pass one per segment. `times` places each keyframe between 0 and 1.

With `easeTrack: true`, one `ease` runs over the whole track instead, and the value moves in straight lines between keyframes, the way React Native's `interpolate` places its output range on an eased value:

```ts
animate(
  spark,
  { y: [0, -30, -12, 0] },
  { duration: 900, ease: 'easeOut', easeTrack: true, times: [0, 0.4, 0.7, 1] },
)
```

An easing that overshoots, like `backOut`, extends the first or last segment, as `interpolate` does with `extrapolate: 'extend'`. `easeTrack` takes a single `ease` and applies to tweens only.

Custom easing functions run once, when the animation starts, like springs do. They don't cost anything per frame.

## Per property

```ts
animate(
  card,
  { y: 0, opacity: 1 },
  { type: 'spring', bounce: 0.3, opacity: { duration: 150 } },
)
```

A property's transition replaces the curve, and keeps the timing (`delay`, `repeat`) of the main one unless it sets its own.

## Timing

```ts
animate(
  badge,
  { scale: [1, 1.2] },
  { delay: 300, repeat: Infinity, repeatType: 'reverse' },
)
```

`delay` is in milliseconds, and the view takes the first keyframe during it. `repeat` is how many more times to play, `Infinity` until stopped. `repeatType: 'reverse'` plays every other repeat backwards. Repeats play natively too.

`repeatDelay` holds the end value for that many milliseconds before each repeat. The first play doesn't wait, and neither does the end of the last one. With `'reverse'` it waits at both ends:

```ts
animate(
  z,
  { y: [0, -40], opacity: [0, 1] },
  { duration: 1200, repeat: Infinity, repeatDelay: 1800 },
)
```

The wait is part of the native keyframes, so it costs no JavaScript while it plays. Stopping during the wait leaves the view at the held value.
