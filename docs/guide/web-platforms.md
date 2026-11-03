# Web keyboard, sheets, navigation, physics and icons

**Available since 0.1.0-rc.10.** Issues [#366–#371](https://github.com/rafaelaugustos/jolt/issues/366) add six capabilities to the Web runtime and motion scopes. Import `/web` during SSR; create a runtime and its mounted targets on the client.

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'
const motion = createWebRuntime(document)
const scope = motion.scope()
const keyboard = scope.onKeyboard((state) => console.log(state.accuracy, state.height))
scope.followKeyboard(composer, { offset: 12 })
const sheet = scope.bottomSheet(panel, {
  host,
  handle,
  snap: [160, '75%'],
  scrollView: content,
})
sheet.open()
const modal = scope.interactiveModal(dialog, { handle: modalHandle })
modal.open()
const navigation = scope.sharedNavigation(routeHost)
const detach = navigation.attach(card, 'cover')
const flight = navigation.navigate({
  tag: 'cover',
  async navigate({ animated }) {
    await routerCommit({ animated })
    navigation.attach(nextCard, 'cover')
  },
})
const world = scope.physicsWorld(arena, [
  {
    id: 'ball',
    view: ball,
    radius: 24,
    x: 80,
    y: 80,
    drag: { type: 'spring', line: { color: '#8de2ce' } },
  },
])
world.impulse('ball', { x: 200, y: -500 })
scope.symbolEffect(iconWrapper, 'bounce')
// scope.suspend(); scope.resume(); detach(); scope.dispose(); motion.dispose()
```

## Keyboard geometry {#keyboard}

`onKeyboard()` and `followKeyboard()` return callable cleanup handles with `pause/play`, `dispose`, `disposed` and `snapshot()`. Observers are shared within a runtime and released when unused. Following contributes a separate translation layer and removes only that contribution on disposal. Use an axis-aligned target in an untransformed host.

State exposes `visible`, `height`, `rect`, `backend`, `accuracy`, `duration` and `transition`. `height` is the bottom coverage of the **layout viewport in CSS pixels**, not a second subtraction of a resized viewport. A floating VirtualKeyboard can be visible with zero bottom coverage. The [VirtualKeyboard geometry API](https://www.w3.org/TR/virtual-keyboard/) supplies exact reported rectangles when available. Otherwise, focused editable content plus an unscaled VisualViewport reduction greater than 80 px is an **estimate**. Browser chrome, floating keyboards and hardware keyboards limit that estimate. No available geometry reports `accuracy: 'unavailable'`.

Browsers do not expose the native keyboard animation curve: duration is always zero. Jolt does not change the global `overlaysContent` policy. `offset` is a nonnegative gap above the reported keyboard. Applications must avoid combining two keyboard-following owners for the same region.

<Clip name="web-keyboard-platforms-chromium" :width="900" caption="Chromium on macOS, English UI: real focus and typing report desktop geometry. No software keyboard opens here; this recording does not claim mobile keyboard following." />
<Clip name="keyboard-ios" caption="iOS simulator, English native demo: real keyboard opening, composer following, typing and dismissal. Reviewed existing reference; original speed, not a physical-device recording." />

## Bottom sheets {#sheet}

`bottomSheet(panel, options)` requires a direct child of a positioned, clipped `host` and a separate `handle` inside the panel. Snaps accept positive CSS pixels, percentages of usable height, or `'content'` with a separate measured `content` element. Optional `scrollView` enables the existing bounded nested-scroll coordinator. Form controls retain their input. This is an in-page sheet; the application owns modal semantics and background scroll locking.

The controller provides `open`, `snapTo`, `expand`, `collapse`, `dismiss`, `remeasure`, `snapPoint` and `visibleHeight`. It shares native snap/release geometry, keeps velocity on release and follows keyboard coverage unless `keyboard: 'none'`. `safeArea.top/bottom` are explicit CSS pixels supplied by the app. `backdrop` must be a sibling; its opacity and hit testing are owned until disposal. `dismissible: false` blocks user dismissal. `onChange` reports the selected target; `onDismiss` runs once after closing settles. The handle exposes slider semantics and Arrow/Home/End/Escape actions; supply its localized `label` and application labels. `returnFocus` optionally names the trigger.

<Clip name="web-sheet-platforms-chromium" :width="900" caption="Chromium on macOS, English UI: actual clicks, keyboard snap actions, wheel scrolling and handle dragging demonstrate open, expand, collapse and dismissal." />
<Clip name="bottom-sheet-ios" caption="iOS simulator, English native demo: native snaps, scrolling, dragging and dismissal. Reviewed existing reference; original speed, not a physical device." />

## Interactive modal dialogs {#modal}

`interactiveModal()` accepts a mounted, initially closed `HTMLDialogElement`. `open()` uses the browser's [modal top layer, inertness and focus handling](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element). Optional `handle` gates drag initiation; `canBegin` can veto a drag. The browser dialog's close button, `close(returnValue)` and Escape dismiss it; a short drag or `cancel()` returns it to its open position. `state` and `onState` distinguish closed/opening/open/dragging/closing/disposed.

External `dialog.close()` and forms with `method="dialog"` remain valid. Pause freezes owned motion. Disposal removes the enhancement and leaves an open dialog under application ownership. App unmounting must close or remove its dialog. This is a DOM interaction, not an iOS transition delegate or Android predictive-back implementation.

<Clip name="web-modal-platforms-chromium" :width="900" caption="Chromium on macOS, English UI: real dialog opening, typing, short-drag rollback, long-drag dismissal, reopening and Escape. The browser owns modal focus." />
<Clip name="interactive-modal-ios" caption="iOS simulator, English native demo: interactive native modal presentation, return and dismissal. Reviewed existing reference; original speed, not a physical device." />

## Router-owned shared navigation {#navigation}

`sharedNavigation(container)` associates mounted elements with tags through `attach(element, tag)`. `navigate({ tag, navigate, transition })` captures that tag, calls the route callback exactly once with `{ animated: false }`, and waits for its promise and destination attachment. The router still owns history, data, route commitment and stale async requests. Keep the navigation container mounted across routes. Attach the destination before resolving the callback, or within the remaining layout window.

Only one operation runs at a time; another returns `unavailable/busy` without calling its router. `finished` resolves a structured result with status, reason, `navigated` and optional error. Here `navigated` means the callback was invoked, not that an asynchronous router necessarily succeeded. Cancel/dispose ends the visual work without rolling back the route. Rejection becomes `failed`; missing or unsupported content falls back to the committed route. Reduced motion commits without the flight.

`navigationTimeout` defaults to 3000 ms (maximum 10000); the layout preparation window is bounded by that timeout plus `layoutTimeout` (default 500), capped at 10000 ms. Hidden time is excluded by the runtime clock. The existing [shared-layout snapshot limits](./web-interactions#shared) apply: static HTML presentation, up to eight attached layout identities, no live video/canvas/form/custom-element/SVG snapshots. This is not a native screenshot or interactive-back gesture.

<Clip name="web-navigation-platforms-chromium" :width="900" caption="Chromium on macOS, English UI: real clicks run asynchronous route callbacks and shared-card flights in both directions, then dispose the controller." />
<Clip name="shared-navigation-ios" caption="iOS simulator, English native demo: shared card/image navigation between real native pages. Reviewed existing reference; original speed, not a physical device." />

## Circle physics {#physics}

`physicsWorld()` supports 1–16 distinct circular direct children, radius 12–256 CSS px, mass 0.1–100, speed at most 1200 px/s and total area at most 40% of the host. Size each body wrapper to twice its radius before creation. Hosts and ancestors must be untransformed; use dedicated wrappers for body placement. Initial bodies must fit without overlapping. Gravity components are bounded to ±2000; restitution is 0–1 and damping 0–20.

The portable TypeScript kernel is checked against the actual C/iOS and Java/Android kernels in 52 scenarios. It advances at 240 fixed steps/second, with at most 24 catch-up steps per rendered frame; excess time appears in `snapshot().droppedMs`. JavaScript computes Web physics on the main thread. Native performance is not implied.

Bodies can use direct drag, a spring pointer tether, a fixed `attachment`, or 1–8 release `snap.points`. An attachment and snap points are mutually exclusive. Up to 32 named body springs are allowed, with at most four per body; their endpoints cannot have snap points. `attach`, `spring`, `snapTo`, `impulse`, `reset`, `pause/play` and `snapshot` expose controlled operations. Optional `line` guides are decorative. Spring dragging preserves integrated body momentum on release. Cancellation releases pointer ownership; resize rescales positions and clears velocity. Invalid bounds pause until they fit again. Reduced motion pauses by default; `'continue'` is explicit. Sleeping worlds stop requesting frames. Disposal restores owned positioning and releases bindings, listeners and guides.

<Clip name="web-physics-platforms-chromium" :width="900" caption="Chromium on macOS, English UI: actual pointer spring drag and release, body-spring motion, impulse, pause/resume and reset. Main-thread Web simulation; no native performance claim." />
<Clip name="circle-physics-ios" caption="iOS simulator, English native demo: native circle motion, collisions and pointer interaction. Reviewed existing reference; original speed, not a physical device." />
<Clip name="physics-attachments-ios" caption="iOS simulator, English native demo: real attachment springs, drag and release snap behavior. Reviewed existing reference; original speed, not a physical device." />

## Application-owned icons {#symbols}

`symbolEffect(wrapper, effect, { speed, repeat })` animates a dedicated HTML wrapper containing your icon. Bounce, pulse and `variableColor` can repeat; `scale` holds its enlarged presentation until stopped. `variableColor` uses opacity waves on 1–32 explicitly marked `[data-jolt-symbol-layer]` descendants. It does not recolor arbitrary artwork or load SF Symbols.

`{ replace: detachedIconElement }` replaces the wrapper's children with an application-owned decorative HTML/SVG element from the same document. The replacement remains after stop/dispose. Update the accessible name and application state yourself. Repeat and held scale have infinite logical duration and cannot seek; finite effects support progress, pause/play and boolean completion. Reduced motion skips decoration (`false`) while replacement still commits (`true`). Cancelled effects restore their owned animated properties; newer app state remains intact.

<Clip name="web-symbols-platforms-chromium" :width="900" caption="Chromium on macOS, English UI: real clicks show bounce, pulse, per-layer opacity, pause/resume, held scale and retained icon replacement. Application-owned SVG artwork, not SF Symbols." />
<Clip name="symbols-reference-ios" caption="iOS simulator, English native demo: real SF Symbols effects on the native symbol image. Reviewed existing reference; original speed, not a physical device. Web artwork and rendering differ." />

## Lifecycle and validation {#validation}

All factories are available on the runtime and motion scopes, including Vue setup scopes. Suspend/resume pauses owned resources; navigation cancellation preserves the app's route. Disposal and detachment remove owned resources. A controller must be recreated after its target is removed. The shared surface compositor may retain neutral inline transform/opacity serialization after a binding is removed; it preserves other application layers.

Run `npm run web:platforms:typecheck`, `npm run web:platforms:test` and `python3 benchmarks/verify-circle-math.py`. Browser tests use Chromium, Firefox and WebKit, including real pointers, keyboard input, modal focus, cancellation, async routing and actual painted output. Injected keyboard rectangles are test fixtures only; the recordings never fabricate a mobile keyboard. Reproduce Web media with `node benchmarks/web-platforms/record.mjs`. Mavis adoption is tracked in its own issues and is not implemented by this change.
