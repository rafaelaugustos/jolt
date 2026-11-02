# Web attachment, collections and horizontal scroll

**Unreleased.** These additions address #334, #336 and #337. Use the experimental `/web` runtime directly or through Vue; framework components do not need their own animation engine.

## Vue and Nuxt: wait for attachment {#nuxt}

Vue `mounted` does not guarantee document insertion. Nuxt out-in transitions and Suspense can mount a branch in a detached container. `createViewportEnterDirective()` observes actual connection before creating the viewport entrance. It uses no fixed delay or frame polling. Create the directive per application/SSR request and use it on plain HTML elements.

```ts
import { createViewportEnterDirective } from '@rafaelaugusto/jolt/web/vue'

export default defineNuxtPlugin((nuxt) => {
  nuxt.vueApp.directive(
    'enter',
    createViewportEnterDirective({
      viewport: {
        keyframes: { opacity: [0, 1], y: [24, 0] },
        transition: { duration: 350 },
      },
    }),
  )
})
```

```vue
<template><section v-enter>Content</section></template>
```

The factory is SSR safe and never emits hidden server styles. `runtime` optionally borrows a host context; `config` configures a self-owned context and `viewport` supplies defaults. A directive binding overrides those defaults. Replace the options object when changing the recipe. Unmount cancels pending attachment; disconnection disposes only this entrance. KeepAlive reactivation rebuilds unfinished/repeat entrances and preserves completed once history. A changed binding resets that history. A known ShadowRoot and its host are observed; arbitrary moves into an unrelated closed shadow tree are outside this adapter contract.

`useWebMotion().use()` and transition enters also wait for real insertion; ref replacement, deactivation, cancellation and scope disposal cancel pending work. Imperative `animate()`, `set()` and `runtime.viewportEnter()` still require mounted targets. Async application setup belongs before the synchronous scope callback.

<Clip name="web-nuxt-attachment-chromium" caption="Chromium on macOS: the actual production Nuxt consumer navigates out-in, returns through browser history, enables KeepAlive and visits an async page. Original-speed recording; no physical-device claim." />

<Clip name="vue-lifecycle-reference-ios" caption="Existing iOS simulator Vue reference: actual native enter/leave and directive behavior in the demo. This reference does not reproduce the DOM-specific Nuxt defect." />

The packed Nuxt 4.6.3/Vue 3.5.44 consumer verifies SSR, history, detached insertion, KeepAlive and reduced motion in Chromium, Firefox and WebKit. Interrupting an async Nuxt route during out-in can strand its page placeholder even with a CSS-only transition; that independent router limitation is not fixed by this adapter. Vue cancellation and pending-resource cleanup are tested separately. See the [validation report](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-attachment/README.md).

## Item identity survives recycled DOM {#items}

`animateItems()` owns entrances for changing rows; it does not virtualize data or perform FLIP reordering. Keys are unique strings, finite numbers or object identities. DOM targets must also be unique and mounted in the runtime document. Validate the complete next collection before replacing ownership. In Vue, call `update()` after `nextTick()` or in a post-flush watcher.

```ts
const rows = runtime.animateItems([{ key: item.id, target: rowElement }], 'fadeInUp', {
  root: scroller,
  once: true,
  duration: 400,
})

// After the renderer has committed the next DOM rows:
rows.update(nextItems.map((item) => ({ key: item.id, target: elements.get(item.id)! })))
rows.forget(item.id)
rows.suspend()
rows.resume()
rows.dispose()
```

The default `once: false` follows native row reentry. With `once: true`, history belongs to the data key: a new key on the same element enters, while a seen key on another element settles at the endpoint. Object history is weak; primitive history lasts until `forget(key)`, `forget()` or disposal. Clear old primitive keys when the application evicts data. Reordering the same key/element preserves in-flight work; removing a row stops only its entrance. `stagger` is rejected because rows enter independently. Use fixed-group `viewportEnter()` for stagger and `animateLayout()` for FLIP.

`pending`, `completed`, `suspended` and `disposed` describe this controller. Empty collections may receive rows later. One observer group serves all rows; completed once observations disconnect. Missing IntersectionObserver, reduced motion and disabled observation keep content readable. Scopes adopt the controller, suspension stops its pending work, and cleanup preserves newer application channels and press feedback.

<Clip name="web-attachment-items-chromium" caption="Chromium on macOS: actual buttons recycle a row, append an item, reorder known identities and reset once history. Row press remains independently active." />

<Clip name="lists-android" caption="Existing native ListView reference: actual rows enter while scrolling on an Android emulator. The Web API accepts explicit keys and DOM rows; it does not implement a virtualizer." />

## Horizontal scroll in LTR and RTL {#horizontal}

```ts
const offset = runtime.scrollValue(rail, { axis: 'x' })
const progress = offset.to([0, 600], [0, 1])
const link = runtime.scrollLinked(
  rail,
  indicator,
  { scaleX: [0.02, 1] },
  {
    axis: 'x',
    range: [0, 600],
    execution: 'auto',
  },
)
// After application geometry changes:
offset.refresh()
link.refresh()
// On teardown:
link.dispose()
progress.dispose()
offset.dispose()
```

The default axis remains `y`. `axis: x` reads normalized CSS pixels from the logical inline start: zero is left in LTR and right in RTL, increasing toward the other end. Negative RTL `scrollLeft` and elastic overscroll are normalized/clamped. Document and element sources use the same contract. Direction/class/style, content, resize and font changes invalidate geometry; use `refresh()` after other application changes.

Eligible playback uses `ScrollTimeline` with the selected axis. `execution: scheduler` forces the shared fallback; supported browsers are checked for equivalent LTR/RTL endpoints and reverse scrolling. Composition, partial replacement, reduced motion and source removal retain the existing scroll ownership rules. No frames remain scheduled at rest. Reversed flex flow on the selected axis and vertical writing modes reject explicitly before taking ownership. Physical CSS pixels, native DIPs and native RTL conventions are not promised to be identical.

<Clip name="web-attachment-horizontal-chromium" caption="Chromium on macOS: real horizontal wheel input moves forward and back in LTR and RTL; the progress bar follows the same logical offset." />

<Clip name="horizontal-scroll-ios" caption="iOS 26.2 simulator: real native horizontal ScrollView gestures drive a bound progress bar. Native axis-x reference; this recording does not validate browser RTL or physical-device performance." />
