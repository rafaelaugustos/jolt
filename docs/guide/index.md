# What Jolt is

Jolt animates [NativeScript](https://nativescript.org) views: presets, springs, keyframes and stagger, one call each.

```ts
import { animate } from '@rafaelaugusto/jolt'

animate(card, 'fadeInUp')
animate(button, { scale: 1.1 }, 'bouncy')
animate(rows, 'fadeInUp', { stagger: 40 })
```

## Why not `view.animate()`

NativeScript's `view.animate()` covers the basics and stops there: one curve for every property, a `spring` curve with no settings, no keyframes, and a promise that rejects when the animation is cancelled. Anything richer ends up as platform code.

Jolt computes the motion once, in JavaScript, when the animation starts, and hands it to the platform as keyframes: Core Animation on iOS, `ObjectAnimator` on Android. Nothing runs in JavaScript while it plays. Springs follow real physics, and an animation that interrupts another one starts from where the view is, at the speed it was going.

## What it covers

- [25 presets](./presets) to enter, exit and draw attention: `fadeInUp`, `popIn`, `shake`, `heartbeat`...
- [Springs](./transitions#springs) described by feel (`bouncy`), by `bounce` and `duration`, or by stiffness, damping and mass.
- [Keyframes and tweens](./transitions#tweens) with an easing per segment and exact keyframe times.
- [Stagger](./stagger) across several views, from the first, the last or the center.
- [Sequences](./sequences) that start each step once the previous one looks done.
- [Press effects](./press) that follow the finger and let go when a scroll takes over.
- [Vue directives and a transition component](./vue) from the optional `@rafaelaugusto/jolt/vue` entry.
- [Text entrances](./text) by letter or word on iOS and Android, keeping one accessible Label.
- [Interruptions](./interrupting) that pick up the value and velocity on screen, with no jump.
- [Native playback](./how-it-works): Core Animation on iOS, `ObjectAnimator` on Android, nothing in JavaScript while it plays.

## Where to start

1. [Install it](./install).
2. Read [Animating](./animating): what a target is, which properties move, and how keyframes are written.
3. Pick a [transition](./transitions) or a [preset](./presets).

It's in beta, published under the `next` tag. It doesn't depend on a framework: it takes a view, or an element that holds one.
