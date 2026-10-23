# Time scale and reduced motion

`configure()` changes global settings. Each one applies to animations that start after the call; what is already playing keeps its timing. Invalid values throw before anything changes.

<Clip name="tuning" caption="The playground at one fifth of the speed." />

```ts
import { configure } from '@rafaelaugusto/jolt'

configure({ timeScale: 0.2 }) // everything five times slower
configure({ reducedMotion: 'always' }) // transforms jump, opacity still fades
```

## Time scale

Tuning a spring at full speed is guesswork. Slow everything down instead:

```ts
configure({ timeScale: 0.2 })
configure({ timeScale: 1 }) // back to normal
```

The time scale must be a positive finite number. It stretches the whole timeline of every engine animation: durations, delays, stagger, repeats, spring settling time, decay and sequence positions. `animate()`, `decay()`, `sequence()`, `press()`, `scrollLinked()` and `animateText()` all follow it, on iOS and Android alike, because Jolt computes the curve in JavaScript and hands the platform its duration.

```ts
configure({ timeScale: 0.5 })
const animation = animate(card, { x: 100 }, { duration: 300, delay: 100 })
animation.duration // 800: the delay and the motion both doubled
```

The trajectory stays the same, only slower. Keyframes are sampled per second of playback, so a slowed spring keeps its detail near its overshoot. An animation that interrupts a slowed one still starts from the value on screen, at the velocity on screen. `progress` keeps running from 0 to 1; `duration` reports the stretched milliseconds.

Scroll-linked animations set progress from the scroll offset, so their appearance does not change. Haptic points are fractions of the timeline and move with it.

Native loops keep their own timing: [shimmer](./shimmer), [loaders](./loaders), [liquid images](./liquid), [particles](./particles), [SF Symbol effects](./symbol-effects) and [circular reveals](./reveal). Platform animations outside Jolt are untouched too.

The iOS Simulator's Slow Animations setting only slows Core Animation, and Android has no per-app equivalent. The time scale is the same on both platforms and works on devices, which is what makes it useful for comparing them.

## Reduced motion

iOS has Reduce Motion and Android has Remove animations. Jolt follows them by default:

```ts
configure({ reducedMotion: 'user' }) // the default: follow the platform setting
configure({ reducedMotion: 'always' }) // reduce regardless, to check the result
configure({ reducedMotion: 'never' }) // play everything
```

With reduced motion, translation, scale, rotation, [motion paths](./paths), [corners, borders and shadows](./decorations) and [decay](./decay) jump to their end values instead of animating. Opacity and [colors](./colors) still animate, the way Framer Motion handles it, so content keeps fading in and out. Nothing about the API changes: `finished` resolves with `true`, a sequence moves on to its next step at once, `press()` snaps, and a staggered group lands together.

```ts
await animate(card, 'fadeInUp') // the card is in place, the fade still plays
```

Infinite repeats and the attention presets stay at rest instead of looping. The preference is read when each animation starts, so a change applies from the next one. Effects that check the platform on their own follow the same preference, including `always` and `never`: [text](./text), [shimmer](./shimmer), [loaders](./loaders), [liquid images](./liquid), [particles](./particles), [SF Symbol effects](./symbol-effects) and [circular reveals](./reveal).

On iOS the setting comes from `UIAccessibilityIsReduceMotionEnabled()`. On Android, Remove animations sets the animator duration scale to zero, which Jolt reads through `ValueAnimator.areAnimatorsEnabled()` on Android 8 and later, and from the global setting before that.

## Reading the preference

A screen can do more than skip motion: show a still illustration, or drop a splash entirely. Read the same preference Jolt uses:

```ts
import { onReducedMotion, reducedMotion } from '@rafaelaugusto/jolt'

reducedMotion() // true or false, right now
const off = onReducedMotion((reduced) => {
  // called with the new value when it changes
})
off()
```

`reducedMotion()` reports what Jolt applies: the platform setting with `user`, `true` with `always`, `false` with `never`. `onReducedMotion()` calls back only when that value changes, from `configure()` or from the platform. On iOS the change arrives right away, through Reduce Motion's notification, including toggles from Control Center. The general Android observer checks again when the app returns to the foreground. [Particles](./particles#platforms-and-timing) also observe animator scale natively: changing it to zero cancels active effects immediately, including when Jolt's preference is `never`.

In Vue, [`useReducedMotion()`](./vue#reduced-motion) gives a ref that stays up to date until the component unmounts.

To play everything and still decide yourself, choose `never` and read the platform setting in the app.
