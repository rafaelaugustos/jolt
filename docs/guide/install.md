# Install

```sh
npm install @rafaelaugusto/jolt@next
```

The **0.1.0-rc.4 release candidate** is published under the `next` tag. The 0.1.0 feature scope is frozen while compatibility and release validation continue. Requires `@nativescript/core` 8.9 or later. It doesn't depend on a framework: it takes a view, or an element that holds one, so it works with NativeScript-Vue, Angular, Svelte or plain NativeScript. NativeScript-Vue apps can also import `@rafaelaugusto/jolt/vue` for [directives and a transition component](./vue).

Jolt includes native helpers on iOS and Android. Rebuild the native app after installing or upgrading Jolt; a JavaScript-only update cannot install native code.

The current release candidate is **0.1.0-rc.4**. To pin it, use `npm install @rafaelaugusto/jolt@0.1.0-rc.4`. For [external native property adapters](./native-properties), install matching `@rafaelaugusto/jolt-native@0.1.0-rc.4` and rebuild the native application.

## Experimental Web candidate {#experimental-web-candidate}

The checkout now provides the experimental `@rafaelaugusto/jolt/web` entry. It is **not included in the published 0.1.0-rc.4 release**; validate a locally packed candidate before integrating it into Mavis or another application. No npm release is implied by this packaging work.

```sh
# In this repository:
npm ci
npm run build
npm pack
# In the Web application, install the generated tarball:
npm install /absolute/path/to/rafaelaugusto-jolt-0.1.0-rc.4.tgz
```

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'

// Importing is safe during SSR. Create the context after browser mounting.
const motion = createWebRuntime(document)
const animation = motion.animate(card, { x: 120, opacity: 1 }, 'snappy')
await animation.finished
motion.dispose() // release on application/component teardown
```

| Import                        | Platform and dependencies                                                         |
| ----------------------------- | --------------------------------------------------------------------------------- |
| `@rafaelaugusto/jolt`         | NativeScript; requires `@nativescript/core >=8.9.0`.                              |
| `@rafaelaugusto/jolt/native`  | Native property adapters; requires NativeScript.                                  |
| `@rafaelaugusto/jolt/vue`     | NativeScript-Vue; also requires `nativescript-vue >=3.0.0`.                       |
| `@rafaelaugusto/jolt/web`     | Imperative DOM runtime; no NativeScript, Vue or React installation required.      |
| `@rafaelaugusto/jolt/web/vue` | Optional Vue DOM adapter; requires `vue ^3.5.0`. See [Vue Web motion](./web-vue). |

NativeScript and NativeScript-Vue are optional peers at the package level so the Web consumer does not install them. They remain required when using their respective native entries. Missing peers produce resolver errors naming `@nativescript/core` or `nativescript-vue`; install the named dependency in the native app. A Web app must import `/web`, including during SSR. The root and `/vue` do not automatically switch platforms.

The Web API is experimental: it exposes a document-owned factory, finite controls and types, without driver registration, internal diagnostics or portable component references. `/core`, deep implementation paths and `/web/vue` are not exported. DOM typings are required for the browser API; its reachable declarations do not require native globals. Coordinates use CSS pixels, rotation uses degrees, and scale uses factors. See [finite Web playback](./web-runtime) for capabilities, cleanup and CSS ownership limits.

The [packed consumer checks](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/package-consumers.md) cover Vite development/production, SSR, NodeNext/Bundler types and the existing native entries. The optional Vue Web entry has its own packed consumer, covering declarations, direct/Vite SSR, real enter/leave and press in development and production.

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
