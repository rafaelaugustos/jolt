# Animating

`animate(target, keyframes, transition?)` takes a view and where to take it:

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

Only transforms and opacity for now. Colors, size and layout changes are [not there yet](./not-there-yet).

## Keyframes

A single value animates from wherever the view is. An array is a list of keyframes, and `null` stands for the current value:

```ts
animate(card, { x: [0, 100] }) // from 0, whatever x is now
animate(card, { x: [null, 20, -20, null] }) // out and back to where it was
```

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

A view that isn't loaded yet takes its first keyframe right away and plays once it's on screen. Calling `animate(title, 'fadeInUp')` in `onMounted` doesn't flash the title before it fades in.

## What you get back

`animate()` returns an animation you can `await`. It resolves with `true` when it played to the end, and `false` when it was stopped or taken over. It never rejects. See [Interrupting and stopping](./interrupting).
