# Instalação

```sh
npm install @rafaelaugusto/jolt@next
```

Por enquanto está em beta, publicado sob a tag `next`. Requer `@nativescript/core` 8.9 ou mais novo. Não depende de framework: recebe uma view, ou um elemento que contém uma, então funciona com NativeScript-Vue, Angular, Svelte ou NativeScript puro.

## ProMotion no iOS

No iOS 15 ou mais novo, o Jolt solicita até 120 Hz para suas animações nativas, respeitando o limite da tela da view. Para permitir taxas acima de 60 Hz no iPhone, adicione isto dentro do `<dict>` principal de `App_Resources/iOS/Info.plist` e recompile o app:

```xml
<key>CADisableMinimumFrameDurationOnPhone</key>
<true/>
```

É uma preferência, não uma taxa fixa. O iOS pode escolher uma taxa menor por economia de energia, temperatura ou ajustes de acessibilidade. Versões anteriores do iOS mantêm o comportamento existente, e telas de 60 Hz recebem uma preferência de 60 Hz. Veja o [guia de ProMotion da Apple](https://developer.apple.com/documentation/quartzcore/optimizing-iphone-and-ipad-apps-to-support-promotion-displays).

Amostras da curva e frames da tela são coisas diferentes: o Core Animation interpola entre as amostras do Jolt na taxa escolhida pela tela. Renderizar a 120 Hz, por si só, não exige mais amostras.

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
