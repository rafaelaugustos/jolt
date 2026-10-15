<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/rafaelaugustos/jolt/main/.github/assets/logo-dark.png">
    <img src="https://raw.githubusercontent.com/rafaelaugustos/jolt/main/.github/assets/logo.png" alt="Jolt" width="280">
  </picture>
</p>

<p align="center">
  Native animations for <a href="https://nativescript.org">NativeScript</a>: presets, springs, keyframes and stagger, one call each.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rafaelaugusto/jolt"><img src="https://img.shields.io/npm/v/@rafaelaugusto/jolt/next?label=npm%40next" alt="npm"></a>
  <a href="https://github.com/rafaelaugustos/jolt/actions/workflows/ci.yml"><img src="https://github.com/rafaelaugustos/jolt/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/rafaelaugustos/jolt/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@rafaelaugusto/jolt" alt="MIT license"></a>
</p>

<p align="center">
  <a href="https://jolt.rafaelaugusto.dev">Documentation</a> · <a href="https://jolt.rafaelaugusto.dev/pt-BR/">Documentação em português</a>
</p>

```ts
import { animate } from '@rafaelaugusto/jolt'

animate(card, 'fadeInUp')
animate(button, { scale: 1.1 }, 'bouncy')
animate(rows, 'fadeInUp', { stagger: 40 })
```

NativeScript's `view.animate()` covers the basics and stops there: one curve for every property, a `spring` curve with no settings, no keyframes, and a promise that rejects when the animation is cancelled. Anything richer ends up as platform code.

Jolt computes the motion once, in JavaScript, when the animation starts, and hands it to the platform as keyframes: Core Animation on iOS, `ObjectAnimator` on Android. Nothing runs in JavaScript while it plays. Springs follow real physics, and an animation that interrupts another one starts from where the view is, at the speed it was going.

## Features

- [25 presets](#presets) to enter, exit and draw attention: `fadeInUp`, `popIn`, `shake`, `heartbeat`...
- [Springs](#springs) described by feel (`bouncy`), by `bounce` and `duration`, or by stiffness, damping and mass.
- [Decay](#decay) from a release velocity, with optional snap points.
- [Keyframes and tweens](#tweens) with an easing per segment and exact keyframe times.
- [Stagger](#several-views) across several views, from the first, the last or the center.
- [Sequences](#sequences) that start each step once the previous one looks done.
- [Press effects](#press) that follow the finger and let go when a scroll takes over.
- [Text entrances](#text) by letter or word on iOS, preserving the Label’s layout and accessibility.
- [SF Symbol effects](#sf-symbols) and animated icon replacement on iOS 17+.
- [Shimmer](#shimmer) for loading placeholders on iOS.
- [Loaders](#loaders) with dots, bars and ring styles on iOS.
- [Circular reveal](#circular-reveal) to show or hide content from a point on iOS.
- [Haptics](#haptics) at arrival or at marked points in an animation on iOS.
- [Particles and confetti](#particles-and-confetti) on iOS.
- [Interruptions](#interrupting-and-stopping) that pick up the value and velocity on screen, with no jump.
- [Native playback](#how-it-works): Core Animation on iOS, `ObjectAnimator` on Android, nothing in JavaScript while it plays.

## Install

```sh
npm install @rafaelaugusto/jolt@next
```

It's in beta for now, published under the `next` tag. Requires `@nativescript/core` 8.9 or later. It doesn't depend on a framework: it takes a view, or an element that holds one.

On iOS 15+, Jolt requests up to 120 Hz on ProMotion displays. Set `CADisableMinimumFrameDurationOnPhone` to `true` in the app's `App_Resources/iOS/Info.plist` and rebuild to enable higher rates on iPhone. See the [iOS setup](https://jolt.rafaelaugusto.dev/guide/install#promotion-on-ios); the system still chooses the actual refresh rate.

## Animating

`animate(target, keyframes, transition?)` takes a view and where to take it:

```ts
animate(card, { opacity: 0.5, y: -20 })
```

| Property             | Unit                                     |
| -------------------- | ---------------------------------------- |
| `opacity`            |                                          |
| `x`, `y`             | DIPs, same as `translateX`, `translateY` |
| `scale`              | sets `scaleX` and `scaleY` together      |
| `scaleX`, `scaleY`   |                                          |
| `rotate`             | degrees                                  |
| `rotateX`, `rotateY` | degrees, with perspective                |

3D rotations and flip presets use the view's `perspective` on both platforms (NativeScript defaults to 1000 DIPs). Set `card.perspective = 600` for stronger depth. Android applies the display density when configuring its camera distance; it keeps the perspective when a rotation ends or stops at an angle.

A single value animates from wherever the view is. An array is a list of keyframes, and `null` stands for the current value:

```ts
animate(card, { x: [0, 100] }) // from 0, whatever x is now
animate(card, { x: [null, 20, -20, null] }) // out and back to where it was
```

With `relative: true`, translation and rotation keyframes are offsets from the current value. Scale and opacity keyframes multiply it instead. Each scale axis keeps its own base, and `null` still means the current value.

```ts
animate(card, { x: [0, -10, 10, 0] }, { relative: true }) // shake around its current x
animate(card, { scale: [1, 1.06, 1] }, { relative: true }) // grow by 6% and return
```

The base is captured once when the view is ready and its tracks are created, before any delay or stagger. Repeats reuse that base. A relative step in a sequence resolves when the step starts; an unloaded view waits until it loads.

The target can be a view, or anything that holds one: a NativeScript-Vue template ref, an Angular `ElementRef`.

```vue
<script setup lang="ts">
const card = ref()
const open = () => animate(card.value, 'popIn')
</script>

<template>
  <GridLayout ref="card" @tap="open" />
</template>
```

A view that isn't loaded yet takes its first absolute keyframe right away and plays once it's on screen. Calling `animate(title, 'fadeInUp')` in `onMounted` doesn't flash the title before it fades in. Relative animations leave the view's values alone until it loads.

## Transitions

The third argument says how to get there. Without one, transforms move with a spring and `opacity` eases over 300ms. Keyframes tween.

### Springs

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

### Tweens

```ts
animate(card, { opacity: 0 }, { duration: 200, ease: 'easeIn' })
animate(
  card,
  { x: [0, 100, 50] },
  { duration: 600, ease: ['easeOut', 'easeIn'], times: [0, 0.3, 1] },
)
```

Tweens take 300ms and `easeOut` unless told otherwise. `ease` takes `linear`, `ease`, `easeIn`, `easeOut`, `easeInOut`, `circIn`, `circOut`, `circInOut`, `backIn`, `backOut`, `backInOut`, `anticipate`, a cubic bezier (`[0.2, 0, 0, 1]`) or any function from 0..1 to a value. With keyframes, pass one per segment. `times` places each keyframe between 0 and 1.

Custom easing functions run once, when the animation starts, like springs do. They don't cost anything per frame.

### Per property

```ts
animate(
  card,
  { y: 0, opacity: 1 },
  { type: 'spring', bounce: 0.3, opacity: { duration: 150 } },
)
```

A property's transition replaces the curve, and keeps the timing (`delay`, `repeat`) of the main one unless it sets its own.

### Timing

```ts
animate(
  badge,
  { scale: [1, 1.2] },
  { delay: 300, repeat: Infinity, repeatType: 'reverse' },
)
```

`delay` is in milliseconds, and the view takes the first keyframe during it. `repeat` is how many more times to play, `Infinity` until stopped. `repeatType: 'reverse'` plays every other repeat backwards. Repeats play natively too.

## Decay

```ts
import { decay } from '@rafaelaugusto/jolt'

decay(card, { x: 600 }) // DIPs per second
decay(card, { x: 600 }, { friction: 0.998, snap: [0, 320] })
```

Starts from the current translation and slows down exponentially. `friction` multiplies velocity per millisecond; smaller values stop sooner. `snap` projects the landing and springs directly to the closest stop, preserving the supplied velocity. Use `{ snap: { x: [0, 320], y: [-200, 0] } }` for independent axes.

Shares interruption, `stop()` and awaitable completion with `animate()`. Both platforms use native keyframes with no JavaScript per frame. See the [decay guide](https://jolt.rafaelaugusto.dev/guide/decay).

## Presets

```ts
animate(card, 'popIn')
animate(card, 'shake', { delay: 200 })
animate(spinner, 'spin', { repeat: Infinity })
```

|           |                                                                                                          |
| --------- | -------------------------------------------------------------------------------------------------------- |
| Enter     | `fadeIn`, `fadeInUp`, `fadeInDown`, `fadeInLeft`, `fadeInRight`, `zoomIn`, `popIn`, `flipInX`, `flipInY` |
| Exit      | `fadeOut`, `fadeOutUp`, `fadeOutDown`, `fadeOutLeft`, `fadeOutRight`, `zoomOut`, `popOut`                |
| Attention | `pulse`, `bounce`, `shake`, `wiggle`, `heartbeat`, `jelly`, `flash`, `tada`, `spin`                      |

Directions follow animate.css: `fadeInUp` comes up from below, `fadeOutUp` leaves upwards. Each built-in preset is plain keyframes and a transition, listed in [`src/presets.ts`](./src/presets.ts) and exported as `presets`.

Attention presets use `relative: true`: `shake` around `x: 40` returns to 40, `pulse` preserves the current scale, and `flash` returns to the current opacity. `spin` adds a full turn to the current rotation. Pass `{ relative: false }` to use their absolute keyframes instead. Enter and exit presets remain absolute.

Options with timing only (`delay`, `repeat`, `stagger`) keep the preset's curves. Options with a curve (`duration`, `ease`, a spring) replace them:

```ts
animate(card, 'fadeInUp', { delay: 100 }) // the preset's spring, 100ms later
animate(card, 'fadeInUp', { duration: 600 }) // a 600ms tween instead
animate(card, 'fadeInUp', 'bouncy') // a bouncy spring instead
```

Register your own keyframes and transition with `definePreset`:

```ts
import { animate, definePreset } from '@rafaelaugusto/jolt'

declare module '@rafaelaugusto/jolt' {
  interface Presets {
    cardIn: true
  }
}

definePreset('cardIn', {
  keyframes: { opacity: [0, 1], y: [40, 0] },
  transition: { type: 'spring', bounce: 0.2, opacity: { duration: 150 } },
})

animate(card, 'cardIn')
```

Register presets during app startup, before using them in `animate()` or `sequence()`. The `Presets` declaration adds the name to TypeScript; it does not register anything at runtime. Custom presets follow the same timing and curve overrides as built-ins, including per-property options and `stagger`.

Registering a custom name again replaces its definition for future animations. Built-in names cannot be replaced through `definePreset`, and the exported `presets` object continues to contain only the built-ins.

## Several views

Pass an array to animate them together, and `stagger` to start them one after another:

```ts
animate(rows, 'fadeInUp', { stagger: 40 })
animate(tiles, 'popIn', { stagger: { each: 30, from: 'center' } })
```

`from` is `'first'` (the default), `'last'`, `'center'` or an index.

## Sequences

```ts
await sequence([
  [logo, 'popIn'],
  [[title, subtitle], 'fadeInUp', { stagger: 80 }],
  () => animate(button, 'fadeIn'),
])
```

Each step takes the same arguments as `animate`, or is a function that starts an animation. A step starts once the previous one looks done: a spring that's close to its target and staying there counts, even if it's still settling, so steps don't wait on the last pixel. The whole sequence finishes once every step has.

Views in later steps take their first absolute keyframe when the sequence starts, so the title above stays hidden until its turn instead of showing up and disappearing. Relative steps and `null` keyframes wait until their step starts to read the current value.

## Press

```ts
const remove = press(button) // scales to 0.96 while pressed
press(card, { scale: 0.97, opacity: 0.8 })
press(tile, { scale: 0.9, rotate: -4 }, 'bouncy')
```

Animates to the given values while a finger is down, and back to where the view was once it lifts, or once the touch is cancelled by a scroll taking over. Views with `isEnabled` set to `false` don't react. It returns a function that removes the effect.

## SF Symbols

```ts
import { symbolEffect } from '@rafaelaugusto/jolt'

symbolEffect(bell, 'bounce')
symbolEffect(favorite, { replace: 'sys://heart.fill' })
```

Takes a NativeScript `Image` with a `sys://` source, or a ref holding one. Supports `bounce`, `pulse`, `scale` and `variableColor`, with native playback, completion and cancellation. Replacement keeps the Image's source in sync. Scale holds until stopped; bounce, pulse and variable color can repeat with `{ repeat: true }`.

Effects require iOS 17+. Earlier iOS versions and Reduce Motion skip decorative effects and replace icons immediately. Android calls resolve with `false` without changing the image. See [SF Symbol effects](https://jolt.rafaelaugusto.dev/guide/symbol-effects) for options and lifecycle behavior.

## Shimmer

```ts
import { shimmer } from '@rafaelaugusto/jolt'

const stopShimmer = shimmer(placeholder, { duration: 1500 })
stopShimmer() // when the content is ready
```

A native gradient mask sweeps across the placeholder and its children. It follows layout changes, preserves existing masks and releases native resources while the view is unloaded, resuming on load. Reduce Motion keeps the placeholder static. iOS only for now; Android calls return a no-op cleanup function. See the [shimmer guide](https://jolt.rafaelaugusto.dev/guide/shimmer).

## Loaders

```ts
import { loader } from '@rafaelaugusto/jolt'

const stopLoading = loader(slot, { style: 'dots', color: '#71717a', size: 48 })
stopLoading() // when the content is ready
```

Choose `dots`, `bars` or `ring`. Each indicator uses one native animation replicated across a layer, fits inside its target and stays centered as the target resizes. Reduce Motion shows a static indicator. Unloading releases native resources; loading resumes until explicitly stopped. iOS only for now. See the [loaders guide](https://jolt.rafaelaugusto.dev/guide/loaders).

## Circular reveal

```ts
import { reveal, conceal } from '@rafaelaugusto/jolt'

await reveal(details, { from: { x: 40, y: 40 }, duration: 500 })
await conceal(details, { to: { x: 40, y: 40 } })
```

A native circle reveals the view's content or contracts to hide it. Reversing continues from the circle on screen. Existing masks are restored when the effect ends; conceal finishes with `visibility = 'hidden'`, preserving layout space. Reduce Motion applies the final visibility immediately. iOS only for now. See the [circular reveal guide](https://jolt.rafaelaugusto.dev/guide/reveal) for cancellation and layout behavior.

## Text

```ts
import { animateText } from '@rafaelaugusto/jolt'

await animateText(title)
await animateText(title, { by: 'word', stagger: 100 })
```

Reveal an iOS Label letter by letter or a word at a time. TextKit keeps the complete text layout, including wrapped lines, attributed styles and composed emoji. Core Animation plays temporary glyph images while the original Label remains the single accessibility element. Stop restores the full text; Reduce Motion skips the entrance. See the [text guide](https://jolt.rafaelaugusto.dev/guide/text) for options and limits.

## Haptics

```ts
animate(card, { y: 0 }, { type: 'spring', haptic: 'light' })
animate(button, 'bounce', { haptic: { style: 'light', times: [0.6, 1] } })
```

Choose `light`, `medium` or `heavy`. By default, one impact fires when the animation visually arrives. Explicit points can mark each landing of a bounce. Delays and stagger follow the animation; interruptions, stopping and unloading cancel pending feedback. iOS only for now. See the [haptics guide](https://jolt.rafaelaugusto.dev/guide/haptics) for timing and device behavior.

## Particles and confetti

```ts
import { confetti, particles } from '@rafaelaugusto/jolt'

confetti(button, { count: 80, colors: ['#facc15', '#ef4444', '#3b82f6'] })
const stopSnow = particles(scene, { source: 'top', angle: 90, velocity: 45 })
stopSnow() // remove the emitter and its particles
```

Confetti bursts into the target's window and cleans itself up. `particles()` adds an emitter to the view for snow, sparks, bubbles or other effects. Both use Core Animation without JavaScript per frame, respect Reduce Motion and stop on unload. iOS only for now. See the [particles guide](https://jolt.rafaelaugusto.dev/guide/particles).

## Interrupting and stopping

Starting an animation on a property that's already animating takes it over: the new one starts from the value on screen, with the same velocity, so a card can change its mind halfway without a jump. Other properties of the previous animation keep going.

`animate()` returns an animation you can `await`. It resolves with `true` when it played to the end, and `false` when it was stopped or taken over. It never rejects.

```ts
const animation = animate(card, { x: 300 })
animation.stop() // the card stays where it is

stop(card) // stops everything running on the card
stop(card, ['x', 'scale']) // stops translation on x and both scale axes
```

Selected properties stay at their current values; the others keep animating. `scaleX` and `scaleY` can also be stopped separately. Pass an empty array to stop nothing, or omit it to stop everything. This works with arrays of targets too.

If part of an animation is stopped, its `finished` promise resolves with `false` once its remaining properties finish.

## How it works

When an animation starts, Jolt resolves where each property starts from (the value on screen, or the keyframes you gave), and computes the whole curve: easing, keyframes, spring physics and exponential decay. It samples the curve 60 times per second of motion, and keeps keyframe times exact. Linear segments aren't sampled at all. Very long free decays cap sampling at 6,001 keyframes.

The samples go to the platform in one go:

- **iOS**: a `CAKeyframeAnimation` per property on the view's layer (`opacity`, `transform.translation.x`, `transform.scale.y`, `transform.rotation.z`...). Core Animation composes them, so `x` and `scale` can belong to different animations, and plays them in the render server.
- **Android**: an `ObjectAnimator` per property with `Keyframe`s and a linear interpolator, on the view's `alpha`, `translationX`, `scaleY`, `rotation`...

Before playing, the final values are set on the NativeScript view, like `view.animate()` does, so `view.translateX` already holds the target while the animation runs. Stopping writes back the values on screen.

On Android, opacity animations temporarily cache hardware-accelerated containers with children in a hardware layer. Jolt waits for the fade to start and restores the layer on completion, stop, replacement or unload. Existing app-configured layers are preserved; empty, unmeasured and larger-than-screen containers are skipped. See the [fade-layer benchmark](./benchmarks/android-fade.md) for measurement and memory tradeoffs.

Each running property remembers its curve and start time. On Android, interruptions read the displayed value and the animator's current play time, so inherited velocity follows the system's animator duration scale. Early spring arrivals use a native timing marker with completion callbacks only; other sequences advance on native completion. Delays, repeats and disabled animations follow the same platform clock, without JavaScript running per frame.

## Not there yet

- `animate()` covers transforms and opacity. Colors ([#12](https://github.com/rafaelaugustos/jolt/issues/12)), borders and shadows ([#13](https://github.com/rafaelaugustos/jolt/issues/13)), size and layout changes ([#21](https://github.com/rafaelaugustos/jolt/issues/21)) aren't animated yet.
- Gesture tracking and drag constraints are next ([#23](https://github.com/rafaelaugustos/jolt/issues/23)); `decay()` supplies the motion after release.
- No layout or shared element transitions ([#21](https://github.com/rafaelaugustos/jolt/issues/21), [#24](https://github.com/rafaelaugustos/jolt/issues/24)).

## API

**Animating**: `animate(target, keyframes | preset, transition?)`, `decay(target, velocity, options?)`, `stop(target, properties?)`, `sequence(steps)`, `press(target, pressed?, transition?)`, `symbolEffect(image, effect, options?)`, `shimmer(target, options?)`, `loader(target, options?)`, `reveal(target, options?)`, `conceal(target, options?)`, `confetti(target, options?)`, `particles(target, options?)`.

**Animations** from `animate()`, `decay()`, `sequence()`, `symbolEffect()`, `reveal()` and `conceal()`: `await`, `finished`, `stop()`. `press()`, `shimmer()`, `loader()`, `confetti()` and `particles()` return cleanup functions.

**Helpers**: `definePreset`, `presets`, `springs`, `cubicBezier`, plus the types (`Keyframes`, `Transition`, `Spring`, `Tween`, `Preset`, `Presets`, `PresetName`, `SpringName`, `Easing`, `Animation`, `Target`...).

## Demo

[`demo/`](./demo) is a NativeScript-Vue app with every preset, the three springs on a ball you can interrupt, decay and snapping, stagger, press effects, SF Symbols, shimmer, loaders, circular reveals, haptics and particles on iOS, loops and a sequence on launch.

With the [NativeScript CLI](https://docs.nativescript.org/setup/) installed:

```sh
npm install
npm run dev        # builds Jolt in watch mode

cd demo
npm install
ns run ios         # or: ns run android
```

## Development

```sh
npm test           # unit tests
npm run typecheck  # including the iOS and Android drivers, against the platform typings
npm run build
```

The tests run the engine against a fake platform driver ([`test/helpers.ts`](./test/helpers.ts)) with its own clock: it records the keyframes it would play and ends them when the clock passes their end.

For on-device measurements, see the [iOS animation startup benchmark](./benchmarks/README.md).

### Releasing

1. Bump `version` in `package.json` (`npm version <version> --no-git-tag-version`) and move the changes under it in `CHANGELOG.md`.
2. Merge that into `main`.
3. Publish a GitHub release tagged `v<version>`. The [release workflow](./.github/workflows/release.yml) checks the tag against `package.json`, runs the tests and publishes to npm: under `next` when the release is marked as a pre-release, under `latest` otherwise.

Publishing authenticates with the `NPM_TOKEN` secret, or with [trusted publishing](https://docs.npmjs.com/trusted-publishers) once it's set up for the package on npm.

## License

[MIT](./LICENSE). Maintained by Rafael Augusto and [Cortex Labs](https://getcortexlabs.com/).
