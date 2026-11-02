# Web overlays and shared motion

**Development after RC.6**, tracked in #320–#323. These additions are not included in the published RC.6 package. The [scope and input guide](./web-lifecycle) covers #314–#317. Mavis adoption remains a separate integration workstream.

## A rendered geometry boundary {#overlays}

An open modal dialog or popover participates in the browser's top layer. Its DOM ancestors can keep animating without becoming the overlay's coordinate ancestors. Jolt now stops its geometry walk at that rendered root, including Shadow DOM and pending top-layer removal. The root's own transform still matters. Identity transforms are accepted outside overlays as well.

This fixes the upstream failure reproduced by [Mavis #197](https://github.com/getcortexlabs/mavis-ui/issues/197): an identity or moving transform on the Card containing Select must not reject the Sheet's otherwise valid drag surface. The [CSS top-layer model](https://www.w3.org/TR/css-position-4/#top-layer) defines this rendering distinction.

```ts
dialog.showModal() // The application owns focus, selection and dismissal.
const open = runtime.scope()
open.drag(panel, { axis: 'y', snap: { y: [0] } })
dialog.addEventListener('close', () => open.dispose(), { once: true })
```

Ordinary nonmodal descendants of a scaled/rotated/zoomed ancestor still need a coordinate adapter; treating screen deltas as local distances would be incorrect. Jolt rejects such drag spaces before changing touch-action or attaching input. A transformed root _inside_ the modal is also affecting geometry and remains subject to validation. Keep the drag surface's static transform baseline identity. Use a genuine top-layer modal/popover or an untransformed input surface, not a CSS z-index imitation.

Closing a dialog removes rendered surfaces from active ownership. Cancel/dispose is safe even immediately after closing; recreate its input attachments on reopening. This does not change Select selection, modal focus restoration, keyboard dismissal, content scrolling or the application's navigation decision. Failure leaves those host behaviors usable. FLIP and pointer-region geometry use the same rendering boundary.

<Clip name="web-lifecycle-overlay-chromium" :width="900" caption="Chromium on macOS arm64: real clicks open a Select-like modal inside a translating/rotating card, drag its panel, select Porto, reopen and dismiss with Escape. Host controls demonstrate the Jolt boundary; this is not footage of the Mavis component itself." />

<Clip name="bottom-sheet-ios" caption="Existing English NativeScript demo on an iOS 26 simulator: real drag/scroll handoff, content growth, keyboard following and dismissal. Native overlay reference, not a recording of the browser geometry fix." />

## Shared elements {#shared}

`sharedLayout()` connects up to eight nonoverlapping identities inside a declared container. It captures the outgoing visual presentation, runs the application's synchronous change and waits for the destination's next layout. Vue may replace/attach the ref in the resulting microtask. The controller does not navigate or choose the content.

```ts
const shared = owner.sharedLayout(container, { transition: 'smooth' })
const detach = shared.attach(card, 'cover')
const flight = shared.transition(() => {
  card.remove()
  container.append(detail)
  shared.attach(detail, 'cover')
})
const result = await flight.finished
// { status: 'completed' }, or an explicit cancelled/unavailable reason.
```

Attachments can replace an identity during a transition. An old detach callback cannot remove the new attachment. Copies are inert, aria-hidden, stripped of IDs/attributes and event handlers, and have no pointer interaction. They freeze computed presentation rather than duplicate application code. Original surfaces use a private opacity contribution while their copies fly; cleanup removes only that contribution, preserving other motion and newer opacity owners. Focus remains with the application/browser.

A flight crossfades outgoing and incoming copies while translating/scaling to the destination. A reversal captures the currently presented copies before cancelling the old flight. Content is visually scaled; this is different from real text reflow. `cancel()`/`stop()` resolve with a reason, preserve the changed application layout and remove all copies. `pause()`/`suspend()` cancel the current flight and block new transitions until `play()`/`resume()`. Container/target removal, scroll/resize changes and live reduced motion also clean up. Reduced motion still runs the application mutation and leaves final content visible.

`layoutTimeout` defaults to 500 ms (maximum 10 seconds); absent and zero-size destinations report `missing-target` or `layout-timeout`. `maxElements` defaults to 512 copied elements across the operation, including reversal captures (maximum 4096). The result may be `unsupported-target`: static HTML/text and decoded images are supported; form controls, canvas/video, embedded documents, custom elements, Shadow DOM content, generated pseudo-content and rotated/skewed/projective snapshot roots need another capture strategy. Positive axis-aligned geometry is supported. Unsupported capture still runs the synchronous application change and leaves its real content visible. A thrown application mutation cleans up and propagates the error.

The temporary stage uses a manual popover so it renders in viewport coordinates without inheriting a transformed page. An engine without that capability takes the unavailable path. This is a DOM presentation copy, not a screenshot or a performance claim. Applications should load/decode images and fetch data before starting the transition.

<Clip name="web-lifecycle-shared-chromium" :width="900" caption="Chromium on macOS arm64: actual controls switch a card/detail and thumbnail/viewer, reverse mid-flight, cancel and exercise an absent destination. Copies are temporary visuals; the application performs the content change." />

<Clip name="shared-layout-ios" caption="Existing English iOS simulator demo: native shared identities move between parents, expand a player cover and reverse from the current snapshot. Native playback reference; not physical-device or Web evidence." />

## Complete interaction recipes {#recipes}

The [executable recipe source](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-lifecycle/recipes.ts) combines three interactions in one scope:

- `drag()` with bounded input and a spring return; independent `press()` remains available.
- `animateSize(panel, { height: open ? 'auto' : 0 })` for intrinsic expansion. Application code owns `aria-expanded`, inert content and focus when closing.
- `animateLayout(list, mutation)` for a keyed reorder/removal. The application owns the order; Jolt measures and animates the existing element identities.

Rapid toggles and reorder interruptions use existing continuity/ownership rules. There is no example-specific solver or frame loop. The returned scope disposes listeners, controllers and unfinished motion. Semantic buttons work with keyboard input; a Return button accompanies pointer dragging. These recipes complement the existing dynamic/layout APIs rather than claim virtualized drag reordering or a new component framework.

<Clip name="web-lifecycle-recipes-chromium" :width="900" caption="Chromium on macOS arm64: real drag/release, intrinsic panel expansion and reversal, keyed reorder/removal, reduced motion and disposal. The same existing runtime primitives compose all three recipes." />

<Clip name="drag-ios" caption="Existing English iOS simulator demo: actual native drag and release. Native interaction reference; not browser coordinate or touch-device performance evidence." />
<Clip name="size-ios" caption="Existing English iPhone 17 simulator / iOS 26.0 size demo: real layout and interruption. The demo selects 0.25× for its interruption segment; video timing is unchanged." />
<Clip name="layout-ios" caption="Existing English native iOS FLIP demo: layout changes and interruption. This reference demonstrates native playback, not the Web recipe running on a device." />

## Diagnose an integration {#diagnostics}

```ts
const diagnostics = runtime.diagnostics({ development: true, maxEvents: 200 })
console.log(diagnostics.snapshot())
diagnostics.clear()
diagnostics.dispose()
```

Snapshots report logical channels/layers, current animation/value owner IDs, retained rest channels, execution paths and active resource counts. Events identify claims, completion, takeover, explicit stops, target release, reduced motion and scope/runtime lifecycle. IDs are local to that diagnostics session; history contains numbers and enums, not DOM nodes or application values. Partial takeover leaves the untouched channels with their original owner. An animation that lost a channel can resolve false even if its remaining tracks completed.

History is bounded to 1–2000 events (default 200). Diagnostics require `development: true`, one diagnostic owner per runtime, and collect no history before activation or after disposal. `snapshot()` is pull-only; it adds no observer, timer, frame subscription or rendering work. No event callback runs inside animation transactions. Disposing the runtime retains a final serializable snapshot without retaining the document through the diagnostic handle.

A retained surface/rest channel is not an active animation. Compare active values, frame tasks, observers and scope counts against the host's baseline; the host ultimately calls `release(target)` or disposes its runtime. Diagnostics explain integration lifetime and ownership, not GPU execution, presented FPS or input latency.

<Clip name="web-lifecycle-diagnostics-chromium" :width="900" caption="Chromium on macOS arm64: actual controls start x/y, replace only x, inspect the owner/reason history and dispose the screen. The report updates on demand without polling." />

<Clip name="motion-inspector-ios" caption="Existing English iOS simulator inspector demo with actual XCTest input: interruption, tuning, held playback, layers and bindings. Native diagnostic reference; not a physical-display measurement." />

Run `npm run web:lifecycle:test` and the [recording workflow](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-lifecycle.md). The matrix includes Chromium, Firefox and WebKit, actual interaction/presentation, cleanup and packed imperative/Vue/SSR consumers. Native CI protects the existing native execution paths. The full Web/mobile parity issue #236 remains open.
