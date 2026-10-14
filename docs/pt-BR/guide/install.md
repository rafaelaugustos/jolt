# Instalação

```sh
npm install @rafaelaugusto/jolt@next
```

Por enquanto está em beta, publicado sob a tag `next`. Requer `@nativescript/core` 8.9 ou mais novo. Não depende de framework: recebe uma view, ou um elemento que contém uma, então funciona com NativeScript-Vue, Angular, Svelte ou NativeScript puro.

## Primeira animação

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

## O app de demonstração

O repositório traz um app NativeScript-Vue em [`demo/`](https://github.com/rafaelaugustos/jolt/tree/main/demo) com todos os presets, os três springs numa bola que você pode interromper, stagger, efeitos de press, loops e uma sequência na abertura.

Com o [NativeScript CLI](https://docs.nativescript.org/setup/) instalado:

```sh
npm install
npm run dev        # compila o Jolt em modo watch

cd demo
npm install
ns run ios         # ou: ns run android
```
