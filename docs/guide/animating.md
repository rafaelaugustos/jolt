# Animating

`animate(target, keyframes, transition?)` takes a view and where to take it:

<Clip name="loops" caption="A spinner and a heartbeat on repeat." />

```ts
animate(card, { opacity: 0.5, y: -20 })
```

## Properties

| Property             | Unit                                     |
| -------------------- | ---------------------------------------- |
| `opacity`            |                                          |
| `x`, `y`             | DIPs, same as `translateX`, `translateY` |
| `scale`              | sets `scaleX` and `scaleY` together      |
| `scaleX`, `scaleY`   |                                          |
| `rotate`             | degrees                                  |
| `rotateX`, `rotateY` | degrees, with perspective                |

Background, border and text colors are also supported. See [Colors](./colors). See [corners, borders and shadows](./decorations) for numeric decoration properties. Size and layout changes are [not there yet](./not-there-yet).

Use [`path` and `orient`](./paths) to follow an SVG curve with native translation and optional tangent rotation.

## Android fades

For opacity animations, Jolt temporarily caches containers with children in a hardware layer when hardware acceleration is active. It starts at the end of any delay, keeps the cache across repeats, and restores the original layer on completion, stop, replacement or unload. This can reduce drawing work for static content such as cards with images.

App-configured hardware or software layers are left untouched. Empty containers, views without measured bounds, and containers wider or taller than the display are skipped. The size limit avoids caching entire oversized content trees. Hardware textures use graphics memory; constantly changing content still invalidates its cache. See the [Android fade benchmark](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/android-fade.md).

## 3D perspective

`rotateX`, `rotateY`, `flipInX` and `flipInY` use the view's `perspective` on both platforms. NativeScript defaults to 1000 DIPs; a smaller positive distance gives a stronger perspective:

```ts
card.perspective = 600
animate(card, { rotateY: [-60, 0] })
```

Android converts this distance using the display density before starting the native animator. The perspective stays in place when a rotation finishes or stops at an angle.

## Keyframes

A single value animates from wherever the view is. An array is a list of keyframes, and `null` stands for the current value:

```ts
animate(card, { x: [0, 100] }) // from 0, whatever x is now
animate(card, { x: [null, 20, -20, null] }) // out and back to where it was
```

## Relative keyframes

Set `relative: true` to use the current values as the base:

```ts
animate(card, { x: [0, -10, 10, 0] }, { relative: true })
animate(card, { scale: [1, 1.06, 1] }, { relative: true })
animate(card, { y: 20 }, { relative: true }) // move 20 DIPs from its current y
```

Translation and rotation values are offsets. Scale and opacity values are factors: a scale of `1.06` grows each axis by 6%, preserving any difference between `scaleX` and `scaleY`. A value of `0` means the starting position for an offset, while `1` means the starting value for a factor. `null` always keeps the current value.

Jolt captures the base once when the loaded view's tracks are created, before any delay or stagger. Repeats reuse the resolved keyframes. If another animation owns the property, the base comes from its current position on screen. A relative sequence step resolves when the step starts; it does not change or stop the target while an earlier step is playing.

Relative keyframes work in custom presets too: put `relative: true` in the preset's `transition`. A call can override it with `relative: false`.

## Targets

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

A view that isn't loaded yet takes its first absolute keyframe right away and plays once it's on screen. Calling `animate(title, 'fadeInUp')` in `onMounted` doesn't flash the title before it fades in. Relative animations leave the view's values alone until it loads, then resolve their keyframes from those values.

## What you get back

`animate()` returns an animation you can `await`. It resolves with `true` when it played to the end, and `false` when it was stopped or taken over. It never rejects. See [Interrupting and stopping](./interrupting).
