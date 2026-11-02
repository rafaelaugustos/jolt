# Web lifecycles and input

Available since RC.8: [Vue/Nuxt attachment, keyed item entrances and horizontal LTR/RTL scroll](./web-collections).

**Available since 0.1.0-rc.7.** Issues #314–#317 add child scopes, pointer following, viewport entrance and continuous Vue setup to the experimental `/web` runtime. They reuse its existing values, springs, finite playback and scheduler. [Overlays, shared elements and interaction recipes](./web-interactions) build on this ownership model.

## Own one interaction {#scopes}

```ts
const owner = runtime.scope()
const input = owner.motionValue(0)
const spring = owner.springValue(input)
owner.bind(card, { x: spring, rotate: owner.map(spring, [0, 100], [0, 8]) })
input.set(100)
owner.dispose()
```

Factory methods adopt their results. `add(handle)` adopts an existing resource once; `borrow(handle)` leaves its lifetime with its original owner. Passing an existing source to `springValue`, `map` or `bind` does not adopt that source. `map()` owns the resulting numeric/color mapping, and `subscribe()` owns only its subscription. A resource cannot belong to two scopes in the same runtime. Disposing a scope stops only its owned handles and bindings, including nested scopes; it does not call `runtime.release(target)` or dispose a borrowed runtime/source. Newer channel owners and independent press contributions survive.

`scope(setup)` and `use(setup)` roll back resources created through the supplied scope if synchronous setup fails. Use synchronous functions; await application data beforehand. A completed animation is removed from the owner's entry count. `reset()` cancels current resources and keeps the scope usable. `dispose()` is permanent and idempotent. Registration after disposal throws; an externally created resource rejected by `add()` remains the caller's responsibility. Cleanup attempts every resource even if one cleanup throws.

`suspend()` pauses playing finite handles/followers, retains numeric inputs and mappings created by the scope, and suspends controllers that support it. It does not resume handles already paused by the application. Non-playable resources, such as a direct binding or press attachment, are disposed. For a binding, observer or subscription that should return, register a factory with `use()`: it receives a child scope, is disposed on suspension and is rerun on `resume()`.

```ts
owner.use((active) => {
  active.bind(card, { x: spring })
  active.observeGeometry(card)
  active.press(card)
})
```

The runtime still owns a surface's retained rest state until the host releases that surface. Scope disposal preserves that state; it is not an instruction to remove application content or restore another owner's CSS. The document scheduler keeps its existing hidden-time behavior. Do not manually restart resources while their owner is suspended.

<Clip name="web-lifecycle-scopes-chromium" :width="900" caption="Chromium on macOS arm64: actual controls retarget two springs, dispose the first owner and keep the second moving. Host-owned press remains available. Original-speed browser recording." />

## Follow a pointer region {#pointer}

```ts
const follow = owner.pointerFollow(region, {
  range: { x: [-90, 90], y: [-45, 45] },
  spring: { stiffness: 150, damping: 18 },
})
owner.bind(icon, { x: follow.x, y: follow.y })
owner.press(icon)
// Product events can independently start a finite scale effect.
owner.animate(icon, 'pulse')
```

Use a stable input region separate from the moving surface. Default coordinates are centered `[-1, 1]`; `range` maps them to finite output bounds. `coordinates: 'pixels'` instead returns viewport CSS pixels from the center, clamped to any supplied range. `axis`, `rest`, `spring: false` and `disabled` are explicit options. Rest defaults to zero and must lie inside supplied bounds. `x`/`y` are readonly outputs; arbitrary rotation, color or scale mappings use `owner.map()`.

Mouse movement and hovering pen input update the latest input without pointer capture or preventing default actions. Touch and pen contact do not simulate hover. Leave/cancel returns to rest; blur, hidden documents, disabled/inert surfaces and live reduced motion settle immediately. Restoring motion waits for fresh pointer input. `update({ disabled })`, `refresh()`, `suspend()`, `resume()` and `dispose()` manage the controller.

Geometry is cached and invalidated by resize, captured scroll, ancestor class/style changes, DOM layout mutations and font loading. `refresh()` handles application layout changes not covered by those signals. No layout read runs on every pointer event. The input rectangle supports positive axis-aligned translation/scale; rotated, skewed, mirrored and perspective input spaces reject with an actionable error. Use an untransformed wrapper. Continuously animating the region itself is not a stable coordinate source. Top-layer ancestors are handled at their actual rendering boundary.

<Clip name="web-lifecycle-pointer-chromium" :width="900" caption="Chromium on macOS arm64: real pointer movement drives a spring follower, with independent press/pulse, live reduced motion, fresh-input restart and disposal. Original timing; no physical-device latency claim." />

## Enter the viewport {#viewport}

```ts
const entrance = owner.viewportEnter(cards, {
  root: scroller,
  threshold: 0.2,
  rootMargin: '0px',
  once: false,
  keyframes: { opacity: [0, 1], y: [24, 0] },
  transition: { duration: 400, stagger: 80 },
})
```

The default recipe is `fadeInUp`, with one-shot playback. Targets form a fixed group with unique identities; stagger uses the supplied group order even when observations arrive separately. Replacing the group means disposing its controller and creating another. `root`, `rootMargin`, `threshold`, `once` and `disabled` configure observation. Existing presets, finite keyframes, spring/tween transitions and their delays remain authoritative. No application timer is needed.

Content is never hidden before setup or during SSR. Unsupported IntersectionObserver leaves content readable. Reduced motion skips decorative entrance and settles any active owned channels at their final values, including opacity. A changed application visibility state is not overwritten. Leaving during playback cancels pending work and finishes only the channels still owned by that entrance; replacing a channel preserves the newer owner. The entrance's own transform crossing a threshold is not treated as a new scroll exit. Real scroll/resize/layout changes and `refresh()` invalidate that guard.

Completed one-shot observations disconnect; repeat mode rearms after exit. Removal, disposal, disable, document hiding and suspension invalidate queued callbacks. Re-enabling/restarting observes current geometry. `refresh()` re-observes after an external change. Jolt does not change focus, tab order, router state or application visibility. Competing CSS animations need a separate wrapper or an explicit owner.

<Clip name="web-lifecycle-viewport-chromium" :width="900" caption="Chromium on macOS arm64: real wheel scrolling triggers ordered entrances, reentry, removal and reduced-motion behavior. The observer never requires permanently hidden application CSS." />

## Continuous Vue setup {#vue}

```ts
import { shallowRef } from 'vue'
import { useWebMotion } from '@rafaelaugusto/jolt/web/vue'

const target = shallowRef<HTMLElement | null>(null)
const motion = useWebMotion(target)
motion.use((scope, element) => {
  const pointer = scope.pointerFollow(element.parentElement!)
  scope.bind(element, { x: scope.map(pointer.x, [-1, 1], [-40, 40]) })
  scope.observeGeometry(element)
  scope.press(element)
})
```

Call `useWebMotion` during setup. `use()` registers synchronous setup without accessing the DOM until mounting. The callback receives all scope factories, including values, mappings, followers, bindings, geometry/scroll controllers, pointer/viewport helpers and shared layouts. It runs once for the mounted ref, tears down on null/replacement/deactivation, and runs again for the current ref on KeepAlive activation. Continuous state created inside the callback is recreated; retain application state outside it when it must survive caching. Its returned remover unregisters and disposes only that setup.

Animation values write outside Vue's render cycle. Use an explicit subscription only when a reactive readout is needed. Finite enter/leave behavior remains unchanged; an active leave can retain its surface after the ref becomes null, while continuous input is detached immediately. Imperative `animate`, `set`, `press` and size/layout calls still require a mounted ref.

To integrate a host-declared surface, pass `useWebMotion(target, { runtime: hostRuntime })`. The host supplies both the ref and its compatible runtime; no `$el` discovery or second context claims the element. This adapter disposes its own resources, never the borrowed runtime or host press. Borrowed `stop()` affects the adapter's own finite handles; retained continuous resources belong to `use()` cleanup. Configure a borrowed runtime through its host. `WebAnimation.stop(properties, { layer })` can cancel selected channels still owned by that handle.

Imports and server setup schedule no browser work and create no process-global application state. Native `/vue` retains its existing contract. Mavis adapts its portable surface separately.

<Clip name="web-lifecycle-vue-chromium" :width="900" caption="Chromium on macOS arm64: actual Vue controls retarget a spring, pulse, deactivate/reactivate KeepAlive, replace the ref and unmount. Continuous writes do not require a Vue render each frame." />

## Native references and verification {#verification}

These existing native demos show the corresponding spring/lifecycle/entrance behavior. They do not run browser pointer or IntersectionObserver APIs.

<Clip name="live-springs-ios" caption="Existing English NativeScript demo on an iOS simulator: retained springs follow changing targets. Native spring reference; not a browser-hover or physical-device recording." />
<Clip name="motion-controllers-ios" caption="Existing English iOS simulator demo: state transitions, scope controls and unmount/remount. Native lifecycle reference; no physical-device performance claim." />
<Clip name="vue-lifecycle-reference-ios" caption="Excerpt of the existing English NativeScript Vue demo on an iOS simulator: finite row entrance and removal. Launch screens omitted; original playback timing. Native reference, not browser viewport observation." />

Run `npm run web:lifecycle:test`, `npm run web:lifecycle:typecheck`, `npm run package:check`, `npm run docs:check-media` and `npm run docs:build`. The [evidence report](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-lifecycle.md) records engine versions and reproduction. Functional checks and recordings do not establish universal compositor acceleration, mobile FPS or input-to-photon latency.
