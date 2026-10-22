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

**A tween takes 300 ms with `easeOut` unless told otherwise.** That's shorter than React Native's `Animated.timing` (500 ms, ease in and out) and starts faster than CSS's `ease`, so pass both when a port has to match.

`ease` takes `linear`, `ease`, `easeIn`, `easeOut`, `easeInOut`, `circIn`, `circOut`, `circInOut`, `backIn`, `backOut`, `backInOut`, `anticipate`, the `quad`, `cubic`, `quart`, `quint`, `sine` and `expo` curves with `In`, `Out` or `InOut` (`'cubicOut'`), a cubic bezier (`[0.2, 0, 0, 1]`) or any function from 0..1 to a value. With keyframes, pass one per segment. `times` places each keyframe between 0 and 1.

<Clip name="easing-curves-ios" caption="Six named curves over 900 ms, and a logo whose opacity sets only times and keeps the main duration and easing, on the iOS simulator. Real-time playback." />

With `easeTrack: true`, one `ease` runs over the whole track instead, and the value moves in straight lines between keyframes, the way React Native's `interpolate` places its output range on an eased value:

```ts
animate(
  spark,
  { y: [0, -30, -12, 0] },
  { duration: 900, ease: 'easeOut', easeTrack: true, times: [0, 0.4, 0.7, 1] },
)
```

<Clip name="ease-track-ios" caption="On the iOS simulator, the same keyframes and times with easeOut on each segment (left) and over the whole track (right). Real-time playback." />

An easing that overshoots, like `backOut`, extends the first or last segment, as `interpolate` does with `extrapolate: 'extend'`. `easeTrack` takes a single `ease` and applies to tweens only.

Custom easing functions run once, when the animation starts, like springs do. They don't cost anything per frame.

## Per property

```ts
animate(
  logo,
  { scale: [0.6, 1.08, 1], opacity: [0, 1, 1] },
  { duration: 900, ease: 'easeInOut', opacity: { times: [0, 0.3, 1] } },
)
animate(
  card,
  { y: 0, opacity: 1 },
  { type: 'spring', bounce: 0.3, opacity: { duration: 150 } },
)
```

Over a tween, a property's transition changes only what it sets: the logo's opacity keeps the 900 ms `easeInOut` and only places its keyframes. Over a spring, or when it is a spring itself, it replaces the curve, so the card's opacity gets a 150 ms tween. Either way, it keeps the timing (`delay`, `repeat`) of the main one unless it sets its own. `times` and per-segment easings taken from the main transition are left out when they don't fit the property's keyframes. Options passed to a [preset](./presets) merge the same way, so `animate(card, 'heartbeat', { duration: 1600 })` keeps the beat's rhythm.

<Clip name="easing-curves-android" caption="The same curves and logo on the Android emulator. Real-time playback." />

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

<Clip name="repeat-delay-ios" caption="On the iOS simulator, each z rests 900 ms between floats and the ball waits 700 ms at both ends of a reversed loop. Real-time playback." />

The wait is part of the native keyframes, so it costs no JavaScript while it plays. Stopping during the wait leaves the view at the held value.

A range, `repeatDelay: [min, max]`, draws a new wait before each repeat, so an idle loop like a blink doesn't land on a beat:

```ts
animate(
  eyes,
  { scaleY: [1, 0.1, 1] },
  { duration: 160, repeat: Infinity, repeatDelay: [1000, 4000] },
)
```

<Clip name="random-pauses-ios" caption="On the iOS simulator, the left mascot blinks and glances after the same pause every time, and the right one after pauses drawn between 1 and 4 seconds. Real-time playback." />

The waits are drawn when the animation starts and built into the native keyframes. A finite `repeat` draws one per repeat. An endless loop draws sixteen cycles and loops them natively, so the pattern repeats only after those sixteen, with no JavaScript between repeats. All the properties and views of one `animate()` call share the same waits, so `scaleX` and `scaleY`, or both eyes, stay together. Separate calls draw their own.

<Clip name="random-pauses-android" caption="The same two mascots on the Android emulator. Real-time playback." />
