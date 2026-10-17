# Time scale

Tuning a spring at full speed is guesswork. Slow everything down instead:

```ts
import { configure } from '@rafaelaugusto/jolt'

configure({ timeScale: 0.2 }) // everything five times slower
configure({ timeScale: 1 }) // back to normal
```

`configure()` changes global settings. Each one applies to animations that start after the call; what is already playing keeps its timing. Invalid values throw before anything changes: the time scale must be a positive finite number.

## What it affects

The scale stretches the whole timeline of every engine animation: durations, delays, stagger, repeats, spring settling time, decay and sequence positions. `animate()`, `decay()`, `sequence()`, `press()`, `scrollLinked()` and `animateText()` all follow it, on iOS and Android alike, because Jolt computes the curve in JavaScript and hands the platform its duration.

```ts
configure({ timeScale: 0.5 })
const animation = animate(card, { x: 100 }, { duration: 300, delay: 100 })
animation.duration // 800: the delay and the motion both doubled
```

The trajectory stays the same, only slower. Keyframes are sampled per second of playback, so a slowed spring keeps its detail near its overshoot. An animation that interrupts a slowed one still starts from the value on screen, at the velocity on screen. `progress` keeps running from 0 to 1; `duration` reports the stretched milliseconds.

Scroll-linked animations set progress from the scroll offset, so their appearance does not change. Haptic points are fractions of the timeline and move with it.

## What it does not affect

Native loops keep their own timing: [shimmer](./shimmer), [loaders](./loaders), [liquid images](./liquid), [particles](./particles), [SF Symbol effects](./symbol-effects) and [circular reveals](./reveal). Platform animations outside Jolt are untouched too.

The iOS Simulator's Slow Animations setting only slows Core Animation, and Android has no per-app equivalent. The time scale is the same on both platforms and works on devices, which is what makes it useful for comparing them.
