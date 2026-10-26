# Install

```sh
npm install @rafaelaugusto/jolt@next
```

The **0.1.0-rc.1 release candidate** is published under the `next` tag. The 0.1.0 feature scope is frozen while compatibility and release validation continue. Requires `@nativescript/core` 8.9 or later. It doesn't depend on a framework: it takes a view, or an element that holds one, so it works with NativeScript-Vue, Angular, Svelte or plain NativeScript. NativeScript-Vue apps can also import `@rafaelaugusto/jolt/vue` for [directives and a transition component](./vue).

Jolt includes native helpers on iOS and Android. Rebuild the native app after installing or upgrading Jolt; a JavaScript-only update cannot install native code.

The current release candidate is **0.1.0-rc.1**. To pin it, use `npm install @rafaelaugusto/jolt@0.1.0-rc.1`. For [external native property adapters](./native-properties), install matching `@rafaelaugusto/jolt-native@0.1.0-rc.1` and rebuild the native application.

## ProMotion on iOS

On iOS 15 and later, Jolt requests up to 120 Hz for its native animations, capped by the view's screen. To allow rates above 60 Hz on an iPhone, add this inside the root `<dict>` of `App_Resources/iOS/Info.plist` and rebuild the app:

```xml
<key>CADisableMinimumFrameDurationOnPhone</key>
<true/>
```

This is a preference, not a fixed frame rate. iOS can choose a lower rate for power, thermal, or accessibility reasons. Older iOS versions keep the existing behavior, and 60 Hz screens receive a 60 Hz preference. See [Apple's ProMotion guide](https://developer.apple.com/documentation/quartzcore/optimizing-iphone-and-ipad-apps-to-support-promotion-displays).

Curve samples and display frames are separate: Core Animation interpolates between Jolt's samples at the display's chosen rate. More samples are not required simply to render at 120 Hz.

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
