# Vue Web motion

**Also in development after RC.6:** [resource scopes, pointer/viewport helpers and continuous Vue setup](./web-lifecycle), plus [overlay geometry, shared elements, complete recipes and diagnostics](./web-interactions). These additions are not in the published RC.6 package.

**Development after RC.6:** [colors, borders, continuous paint, real size, FLIP and seekable scenes](./web-visual) extend this runtime. They are not included in the published RC.6 package. Full parity remains tracked in [#236](https://github.com/rafaelaugustos/jolt/issues/236).

The experimental `@rafaelaugusto/jolt/web/vue` entry ships in **0.1.0-rc.5** and connects a declared DOM ref to the [Web runtime](./web-runtime). Install Vue 3.5 separately. Native `/vue` retains its NativeScript meaning; the imperative `/web` entry does not install Vue. See [installation](./install#experimental-web-candidate).

<Clip name="web-vue-chromium" :width="720" caption="Chromium 156 on macOS arm64: real pointer and keyboard input reverses a leave, presses the card, retargets application scale while held, replaces the surface and completes hide/show. Original-speed browser capture; not physical-device performance evidence." />

## A declared DOM surface {#declared-surface}

```vue
<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import { useWebMotion } from '@rafaelaugusto/jolt/web/vue'

const visible = ref(true)
const surface = shallowRef<HTMLElement | null>(null)
const motion = useWebMotion(surface, {
  initial: { opacity: 0, y: 24 },
  enter: { keyframes: { opacity: 1, y: 0 }, transition: { duration: 220 } },
  leave: { keyframes: { opacity: 0, y: -12 }, transition: { duration: 160 } },
})
</script>

<template>
  <button @click="visible = !visible">Toggle</button>
  <Transition v-bind="motion.transition" appear>
    <div v-if="visible" ref="surface">Content</div>
  </Transition>
</template>
```

Call the composable synchronously in `setup`. It creates a runtime lazily for the target's document. Imports and SSR rendering do not require browser globals. `animate`, `set`, `press` and `stop` operate on the current mounted DOM ref; calling them before mounting or after scope disposal throws. `configure` uses the Web runtime policy. Framework component instances, `$el` discovery and generic compound-component refs are outside this experimental contract.

The returned `transition` object supplies `css: false`, enter/leave and cancellation hooks. Bind it to Vue's `Transition`; retain application hooks such as `@before-leave` and `@after-leave`. Recipes use the same keyframes and transitions as the imperative runtime and must have finite duration. The adapter has no solver or frame loop of its own.

## Lifecycle and composition {#lifecycle}

- `initial` applies once per entering element, after insertion and before playback. Reentry on the same `v-show` surface continues from its current state.
- A `v-if` ref can become null while the leaving element remains in the DOM. The current leave retains that element until its playback settles. An interrupted playback settles too; it cannot retain the element forever.
- Vue cancellation invalidates that transition generation before stopping its motion. Old promise completions cannot finish a newer leave or remove a reentered element. `v-if` replacement gets a new surface; `v-show` can reuse its surface.
- Replacing a ref releases the old surface, except while its leave is current. Scope disposal cancels all pending work, detaches press listeners, releases effects and suppresses stale completions.
- Application motion and press share the same context: base scale 1.1 × feedback 0.96 = 1.056. Retargeting the base to 1.2 while held produces 1.152; release restores 1.2. Create a new press binding for a replacement DOM element.
- Live reduced-motion changes follow the runtime: transforms settle at their destinations, while opacity keeps its finite timeline. The same CSS surface limits apply; do not compete for owned motion styles.

The component/application owns focus, `inert`, `aria-hidden`, activation policy and trigger restoration. Use Vue's lifecycle hooks for those changes; Jolt neither moves focus nor supplies accessibility semantics. This adapter is a foundation for Mavis Reveal; the Mavis migration and a portable application ref API remain separate work.

## Verification and limits {#verification}

`npm run web:integration:test` covers interruption, controls, replacement, reduced motion, press composition and repeated teardown in Chromium, Firefox and WebKit. `npm run package:check` installs the actual tarball into imperative and optional Vue consumers, checks strict declarations, runs direct/Vite SSR and real browser playback, and preserves native production bundling.

The [integration report](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-integration.md) records versions, workloads and regression budgets. Preparing 100 spring-driven cards is a measurable burst of main-thread work; this suite does not establish mobile frame-rate or input-latency guarantees. Its Chromium-only blocking probe uses captured presentation frames and a browser trace, not rAF counts, to examine compositor progress.

Native `/vue` behavior is preserved. This existing recording is its reference, not evidence that Web code ran natively:

<Clip name="vue" caption="Existing English NativeScript Vue demo on an iOS simulator: JoltTransition removes and restores a row. Native playback reference; not a physical-device recording or a shared Mavis screen." />

The same batch fixes Android's settled-layer presentation and verifies iOS remains consistent:

<Clip name="layer-cleanup-android" caption="Android 16 / API 36 emulator, English Layers audit started by an actual ADB tap: removing feedback during release restores the non-unit base; a moving base, another layer and reduced motion remain correct. Native presentation getters are checked. Original speed; emulator correctness evidence." />
<Clip name="layer-cleanup-ios" caption="iOS 26.2 simulator, English Layers audit started by an actual XCTest tap: the same removal, composition and reduced-motion checks read Core Animation presentation values. Original speed; not a physical iPhone recording." />
