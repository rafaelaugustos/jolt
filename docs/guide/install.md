# Install

```sh
npm install @rafaelaugusto/jolt@next
```

RC.6 includes [continuous Web motion](./web-dynamic), with values, followers and drag/snap, plus [numeric mappings, geometry refresh and vertical scroll](./web-support). The Web APIs remain experimental.

The **0.1.0-rc.14 release candidate** is published under the `next` tag. The native 0.1.0 feature scope is frozen while compatibility and release validation continue. NativeScript consumers require `@nativescript/core` 8.9 or later. It doesn't depend on a framework: it takes a view, or an element that holds one, so it works with NativeScript-Vue, Angular, Svelte or plain NativeScript. NativeScript-Vue apps can also import `@rafaelaugusto/jolt/vue` for [directives and a transition component](./vue).

Jolt includes native helpers on iOS and Android. Rebuild the native app after installing or upgrading Jolt; a JavaScript-only update cannot install native code.

The current release candidate is **0.1.0-rc.14**. To pin it, use `npm install @rafaelaugusto/jolt@0.1.0-rc.14`. For [external native property adapters](./native-properties), install matching `@rafaelaugusto/jolt-native@0.1.0-rc.14` and rebuild the native application.

## Experimental Web entries {#experimental-web-candidate}

Starting with **0.1.0-rc.5**, the package includes experimental `/web` and `/web/vue` entries. Install the published candidate directly; add Vue only when using the Vue DOM adapter. The root import and `/vue` remain native entries.

```sh
npm install @rafaelaugusto/jolt@0.1.0-rc.14
# Only for the optional Vue DOM adapter:
npm install vue@^3.5.0
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

The Web API is experimental: it exposes a document-owned runtime with finite playback, continuous motion, scroll and types, without driver registration, internal diagnostics or portable component references. `/core`, deep implementation paths and `/web/react` are not exported. DOM typings are required for the browser API; its reachable declarations do not require native globals. Coordinates use CSS pixels, rotation uses degrees, and scale uses factors. See [finite Web playback](./web-runtime) for capabilities, cleanup and CSS ownership limits.

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
