# Install

```sh
npm install @rafaelaugusto/jolt@next
```

It's in beta for now, published under the `next` tag. Requires `@nativescript/core` 8.9 or later. It doesn't depend on a framework: it takes a view, or an element that holds one, so it works with NativeScript-Vue, Angular, Svelte or plain NativeScript.

## First animation

```vue
<script setup lang="ts">
import { ref } from 'nativescript-vue'
import { animate } from '@rafaelaugusto/jolt'

const card = ref()
const open = () => animate(card.value, 'popIn')
</script>

<template>
  <GridLayout ref="card" @tap="open" />
</template>
```

## The demo app

The repository ships a NativeScript-Vue app in [`demo/`](https://github.com/rafaelaugustos/jolt/tree/main/demo) with every preset, the three springs on a ball you can interrupt, stagger, press effects, loops and a sequence on launch.

With the [NativeScript CLI](https://docs.nativescript.org/setup/) installed:

```sh
npm install
npm run dev        # builds Jolt in watch mode

cd demo
npm install
ns run ios         # or: ns run android
```
