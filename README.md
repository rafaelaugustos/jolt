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
- [Keyframes and tweens](#tweens) with an easing per segment and exact keyframe times.
- [Stagger](#several-views) across several views, from the first, the last or the center.
- [Sequences](#sequences) that start each step once the previous one looks done.
- [Press effects](#press) that follow the finger and let go when a scroll takes over.
- [Interruptions](#interrupting-and-stopping) that pick up the value and velocity on screen, with no jump.
- [Native playback](#how-it-works): Core Animation on iOS, `ObjectAnimator` on Android, nothing in JavaScript while it plays.

## Install

```sh
npm install @rafaelaugusto/jolt@next
```

It's in beta for now, published under the `next` tag. Requires `@nativescript/core` 8.9 or later. It doesn't depend on a framework: it takes a view, or an element that holds one.

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

A single value animates from wherever the view is. An array is a list of keyframes, and `null` stands for the current value:

```ts
animate(card, { x: [0, 100] }) // from 0, whatever x is now
animate(card, { x: [null, 20, -20, null] }) // out and back to where it was
```

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

A view that isn't loaded yet takes its first keyframe right away and plays once it's on screen. Calling `animate(title, 'fadeInUp')` in `onMounted` doesn't flash the title before it fades in.

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

Views in later steps take their first keyframe when the sequence starts, so the title above stays hidden until its turn instead of showing up and disappearing.

## Press

```ts
const remove = press(button) // scales to 0.96 while pressed
press(card, { scale: 0.97, opacity: 0.8 })
press(tile, { scale: 0.9, rotate: -4 }, 'bouncy')
```

Animates to the given values while a finger is down, and back to where the view was once it lifts, or once the touch is cancelled by a scroll taking over. Views with `isEnabled` set to `false` don't react. It returns a function that removes the effect.

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

When an animation starts, Jolt resolves where each property starts from (the value on screen, or the keyframes you gave), and computes the whole curve: easing, keyframes, spring physics. It samples the curve 60 times per second of motion, and keeps keyframe times exact. Linear segments aren't sampled at all.

The samples go to the platform in one go:

- **iOS**: a `CAKeyframeAnimation` per property on the view's layer (`opacity`, `transform.translation.x`, `transform.scale.y`, `transform.rotation.z`...). Core Animation composes them, so `x` and `scale` can belong to different animations, and plays them in the render server.
- **Android**: an `ObjectAnimator` per property with `Keyframe`s and a linear interpolator, on the view's `alpha`, `translationX`, `scaleY`, `rotation`...

Before playing, the final values are set on the NativeScript view, like `view.animate()` does, so `view.translateX` already holds the target while the animation runs. Stopping writes back the values on screen.

Each running property remembers its curve and start time, so Jolt knows the value and velocity of any property at any moment without asking the platform. That's what lets an interruption pick up the motion where it was. On Android, where an animator starts on the next frame, it reads the value on screen instead.

## Not there yet

- Only transforms and opacity. Colors ([#12](https://github.com/rafaelaugustos/jolt/issues/12)), borders and shadows ([#13](https://github.com/rafaelaugustos/jolt/issues/13)), size and layout changes ([#21](https://github.com/rafaelaugustos/jolt/issues/21)) aren't animated yet.
- No gestures: dragging something and letting it fly with its velocity is next ([#23](https://github.com/rafaelaugustos/jolt/issues/23)).
- No layout or shared element transitions ([#21](https://github.com/rafaelaugustos/jolt/issues/21), [#24](https://github.com/rafaelaugustos/jolt/issues/24)).

## API

**Animating**: `animate(target, keyframes | preset, transition?)`, `stop(target, properties?)`, `sequence(steps)`, `press(target, pressed?, transition?)`.

**Animations** returned by them: `await`, `finished`, `stop()`.

**Helpers**: `definePreset`, `presets`, `springs`, `cubicBezier`, plus the types (`Keyframes`, `Transition`, `Spring`, `Tween`, `Preset`, `Presets`, `PresetName`, `SpringName`, `Easing`, `Animation`, `Target`...).

## Demo

[`demo/`](./demo) is a NativeScript-Vue app with every preset, the three springs on a ball you can interrupt, stagger, press effects, loops and a sequence on launch.

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

### Releasing

1. Bump `version` in `package.json` (`npm version <version> --no-git-tag-version`) and move the changes under it in `CHANGELOG.md`.
2. Merge that into `main`.
3. Publish a GitHub release tagged `v<version>`. The [release workflow](./.github/workflows/release.yml) checks the tag against `package.json`, runs the tests and publishes to npm: under `next` when the release is marked as a pre-release, under `latest` otherwise.

Publishing authenticates with the `NPM_TOKEN` secret, or with [trusted publishing](https://docs.npmjs.com/trusted-publishers) once it's set up for the package on npm.

## License

[MIT](./LICENSE)
