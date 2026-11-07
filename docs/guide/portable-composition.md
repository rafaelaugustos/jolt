# Portable composition

Available in `0.1.0-rc.12.1`, from [PR #428](https://github.com/rafaelaugustos/jolt/pull/428) (#424–#427, #386 and #385). Existing native contracts share definitions, policy and lifecycle with browser adapters. Install matching package versions and rebuild native apps. Web APIs remain experimental; physical browser sensor delivery and accuracy remain pending in #385.

## Retained ownership {#lifecycle}

`retain(resource)` and `resource(factory)` keep resources until release, reset or disposal, including settled playback. `release(resource)` destroys only resources owned by that scope. Suspension pauses capable resources and preserves a pre-existing manual pause; static retained resources survive. `add()` keeps its existing transient lifetime and is idempotent for resources already retained by that scope. Changing a transient owner to retained is rejected; choose the lifetime when adopting. Factories clean newly created resources if adoption fails.

Vue `useShape` uses the existing SVG shape adapter. `.current` becomes available after mount; the callback ref also accepts a component with one root HTMLElement. KeepAlive pauses and retains the drawing; actual unmount or ref replacement disposes it. An optional `{ runtime }` is borrowed. `useWebMotion(ref).resource(setup)` provides the same retained setup lifetime; ordinary `.use(setup)` still recreates on activation. `unload: 'pause'` retains a detached shape in the same document; ordinary `motion.shape` defaults to disposal on removal. Explicit runtime release/disposal always destroys it.

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'
const motion = createWebRuntime(document)
const scope = motion.scope()
const drawing = scope.resource(() =>
  motion.shape(host, {
    d: 'M10 50 L50 10 L90 50 Z',
    viewBox: [0, 0, 100, 100],
    stroke: '#7858db',
    unload: 'pause',
  }),
)
scope.suspend()
scope.resume()
scope.release(drawing)
scope.dispose()
```

```vue
<script setup lang="ts">
import { useShape } from '@rafaelaugusto/jolt/web/vue'
const drawing = useShape({
  d: 'M10 50 L50 10 L90 50 Z',
  viewBox: [0, 0, 100, 100],
  stroke: '#7858db',
})
</script>
<template><div :ref="drawing.ref" style="width: 120px; height: 120px" /></template>
```

<Clip name="composition-lifecycle-web" :width="900" caption="Retained ownership: Chromium on macOS: real controls and browser playback." />

<Clip name="composition-resources-ios" caption="Retained ownership: iOS 26.2 simulator: real native demo and XCTest interaction." />

## Behavior coordination {#behaviors}

Native and Web use the same exclusive-lane policy: priority, `when`, `blocks`, equal-priority reject/replace and an explicit rest action. Higher priority interrupts unless the current action blocks it; unrelated coordinators remain independent. Each run owns a child scope. Use `wait`, `checkpoint` and `guard` around asynchronous work so cancellation prevents late changes. An arbitrary Promise cannot be forcibly cancelled. Background visibility and manual pause suspend owned playback; completion/cancel restores rest, `stop()` cancels without restoring, and disposal prevents further requests. Application domain state stays in the application.

```ts
const actions = scope.motionBehaviors(
  {
    rest: { priority: -1, run: ({ scope }) => scope.animate(card, { x: 0 }).finished },
    touch: {
      run: async ({ scope, wait }) => {
        await wait(scope.animate(card, { x: -70 }, { duration: 2000 }).finished)
      },
    },
    dress: { priority: 2, run: ({ scope }) => scope.animate(card, { x: 70 }).finished },
    eat: {
      priority: 3,
      blocks: ['touch', 'dress'],
      run: ({ scope }) => scope.animate(card, { scale: [1, 1.2, 1] }).finished,
    },
  },
  { rest: 'rest' },
)
actions.request('touch')
actions.request('dress')
```

<Clip name="composition-behaviors-web" :width="900" caption="Behavior coordination: Chromium on macOS: real controls and browser playback." />

<Clip name="composition-behaviors-ios" caption="Behavior coordination: iOS 26.2 simulator: real native demo and XCTest interaction." />

## Gradient text {#gradient-text}

Both platforms accept 2–8 colors, ordered stops in 0..1, clockwise angle in degrees from left-to-right, and a sheen width in (0,1]. Native accepts ColorValue; Web accepts CSS color strings. `play()` returns playback with interruption, pause and cancellation; `stop()` removes the moving sheen while keeping the static fill. Reduced motion keeps the static fill.

The browser paints the original, selectable text with CSS background clipping; it accepts a plain-text HTMLElement without child elements. It preserves its accessible name and restores owned styles without overwriting newer application changes. Forced colors or missing clipping support use ordinary readable text and cancel the decorative sheen. Do not combine background gradients and gradient text on the same target. Native uses real glyph painting; browser masking, repaint cost and pixels differ.

```ts
const title = scope.gradientText(heading, {
  colors: ['#7858db', '#197a88'],
  angle: 10,
  sheen: { color: '#ffffffbf', width: 0.3, direction: 'right' },
})
const playback = title.play({ duration: 1800, ease: 'linear' })
title.suspend()
title.resume()
title.stop()
```

<Clip name="composition-text-web" :width="900" caption="Gradient text: Chromium on macOS: real controls and browser playback." />

<Clip name="composition-text-ios" caption="Gradient text: iOS 26.2 simulator: real native demo and XCTest interaction." />

## Articulated 2D rigs {#rig}

The shared definition supports 1–64 parts and `x`, `y`, `scaleX`, `scaleY`, `rotate`; rotations use degrees, translation uses native DIPs or browser CSS pixels. Pivots are fractions of the border box. Sockets accept relative fractions or local logical units (`dip` retains its native spelling on Web). Blending is rest-relative; weights above a total of one normalize. Unbounded rotation takes the shortest path, while limits clamp spring samples, including overshoot.

Web parts must be connected 2D boxes in their declared direct DOM hierarchy with positioned parents as `offsetParent`; CSS zoom, perspective, 3D and individual transform properties are rejected. Accessories are unowned direct children of the socket part. Native parent transforms and browser DOM transforms carry them. `point()` returns a socket in the root parent’s border-box coordinates; use `refresh()` after changing layout offsets. Resize updates socket placement. `attach` replaces parts; Web poses share a playback group, so releasing a part cancels that group. Teardown restores only channels still owned by the rig. Preserve semantic labels for meaningful artwork; rigs do not provide hit testing or accessibility semantics.

```ts
const character = scope.rig2d(
  {
    parts: {
      body: { rest: { rotate: 0 } },
      hand: {
        parent: 'body',
        pivot: { x: 0.5, y: 0.1 },
        rest: { rotate: 0 },
        rotation: [-70, 70],
      },
    },
    poses: {
      rest: {},
      wave: { hand: { rotate: -55 } },
      reach: { hand: { rotate: 110 } },
    },
    sockets: { grip: { part: 'hand', x: 0.5, y: 0.85, units: 'relative' } },
  },
  { body, hand },
)
character.accessory('grip', flower)
character.to('wave', 'bouncy')
character.blend([
  { pose: 'wave', weight: 0.5 },
  { pose: 'reach', weight: 0.5 },
])
```

<Clip name="composition-rig-web" :width="900" caption="Articulated 2D rigs: Chromium on macOS: real controls and browser playback." />

<Clip name="composition-rig-ios" caption="Articulated 2D rigs: iOS 26.2 simulator: real native demo and XCTest interaction." />

## Helpers and motion preferences {#preferences}

The Web entry re-exports the existing `cubicBezier`, `origamiSpring`, `springs` and `presets`; no second solver is introduced. `motion.reducedMotion()` reads the effective preference of that document/runtime, including `user`, `always` and `never` configuration. `onReducedMotion()` observes changes without polling or an initial callback and returns an unsubscribe function. Runtime disposal ends observation.

Vue `useReducedMotion(runtime?)` returns a readonly ref. With no runtime it starts at false during SSR, then subscribes after mount; with a borrowed runtime it reads that runtime. KeepAlive unsubscribes while inactive and resynchronizes on activation. It only disposes a runtime it created. There is no cross-request preference singleton. Prefer the runtime observer when application configuration can override the OS.

```ts
import { cubicBezier, origamiSpring, springs, presets } from '@rafaelaugusto/jolt/web'
const current = motion.reducedMotion()
const unsubscribe = motion.onReducedMotion((reduced) => updatePreference(reduced))
scope.retain(unsubscribe)
scope.animate(
  card,
  { x: [0, 70, 0] },
  { duration: 1200, ease: cubicBezier(0.25, 0.1, 0.25, 1) },
)
// Vue: import { useReducedMotion } from '@rafaelaugusto/jolt/web/vue'
// const reduced = useReducedMotion(motion)
```

<Clip name="composition-preferences-web" :width="900" caption="Helpers and motion preferences: Chromium on macOS: real controls and browser playback." />

<Clip name="composition-text-ios" caption="Helpers and motion preferences: iOS 26.2 simulator: real native demo and XCTest interaction." />

## Vector sensors {#sensors}

All six canonical names are accepted. `rotation` is relative radians plus quaternion; `acceleration` is proper acceleration including gravity (m/s², about +9.8 on face-up Z), `linearAcceleration` excludes gravity (m/s²), `gravity` is downward acceleration (linear minus proper), and `gyroscope` is right-handed radians/s mapped from beta/gamma/alpha. `magneticField` retains the µT unit but reports `unavailable`, backend `none`, reason `unsupported-kind`; DeviceMotion supplies no magnetic vector. It does not infer one from orientation.

A secure context, browser/device support and applicable permission policy are required. Permission prompts occur only in explicit `requestPermission()` calls from user input. Availability requires a complete finite sample for that kind; null/partial values do not become zeros. Missing APIs, denial and no-data timeouts remain visible in `snapshot()`. Sources share one listener per hardware event/document and run only while demanded, visible and unpaused. Interface coordinates remap on screen rotation; device coordinates remain canonical. `interval` throttles delivered readings (5–1000 ms or `auto`), not the hardware rate. Event timestamps are browser monotonic timestamps, not native hardware timestamps.

This round validates real browser rendering with **injected events**, plus the native simulator preview. Real browser sensor delivery and accuracy on a physical device remain pending in #385. See the [Device Orientation and Motion specification](https://www.w3.org/TR/orientation-event/) and [Magnetometer availability limits](https://www.w3.org/TR/magnetometer/).

```ts
const sensor = scope.sensor('gyroscope', { coordinates: 'interface', interval: 50 })
// Invoke directly from a click/tap handler:
await sensor.requestPermission()
scope.bind(card, { rotate: scope.map(sensor.z, [-Math.PI, Math.PI], [-45, 45]) })
console.log(sensor.snapshot())
```

<Clip name="composition-sensors-web" :width="900" caption="Chromium on macOS: explicitly injected DeviceMotion events, pause/resume and magnetic unavailability. No physical sensor measurement." />

<Clip name="composition-sensors-ios" caption="iOS 26.2 simulator: native vector preview and lifecycle controls. Preview data does not establish physical sensor availability." />

The recordings are functional evidence. They do not establish lower CPU/PSS, hardware accuracy or JavaScript-independent rendering. [Native contracts](./native-composition) remain supported; [validation and reproduction](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/portable-composition.md) track acceptance and remaining limits.
