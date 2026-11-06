# Pointer, property groups and drawing surfaces

This work targets RC.12. It is not included in RC.11.1. The APIs share ownership and validation rules across NativeScript and the experimental Web runtime; their execution backends differ. Rebuild native applications after installing matching Jolt packages.

## Pointer position and presence

NativeScript gains `pointerFollow`; Web extends its existing implementation with `presence`. Ordinary touch does not synthesize hover. Keep essential actions accessible through buttons, touch and keyboard independently of the pointer effect.

```ts
import { bind, motionScope } from '@rafaelaugusto/jolt'
const scope = motionScope()
const pointer = scope.pointerFollow(region, { spring: false })
scope.use(() => bind(dot, { x: pointer.x.to([-1, 1], [-120, 120]) }))
const stopPresence = scope.use(() =>
  pointer.presence.subscribe((value) => {
    // value is 1 inside the region and 0 outside it.
  }),
)
// Native property bindings can consume these raw values too.
// At permanent teardown:
scope.dispose()
```

On Web, use `runtime.scope().pointerFollow(element, options)` and `scope.bind()`. Both expose `x`, `y`, `presence`, `active`, `available`, `disposed`, `suspended`, `update({ disabled })`, `refresh()`, `suspend()`, `resume()` and `dispose()`. Presence is an immediate numeric value, suitable for subscriptions and bindings. Native `spring: false` exposes raw motion values for compiled custom-property bindings; the default spring follows smoothly but those spring nodes are not accepted by the existing custom-property `bind()` sampler. Use raw values there or an explicitly owned JS subscription.

| Contract    | NativeScript                                                                       | Web                                                                     |
| ----------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Coordinates | Local DIPs, after converting through target transforms                             | CSS pixels in the viewport-aligned bounding rectangle                   |
| Default     | Center origin; normalized −1…1 on each axis                                        | Same normalized mapping                                                 |
| Options     | `axis`, `coordinates`, `range`, `rest`, `spring`, `disabled`                       | Existing options, with the same bounded mapping                         |
| Capability  | iPadOS hover API and Android mouse/hovering stylus; iPhone has no hover            | Pointer Events and the browser's hover capability                       |
| Lifecycle   | Unload/replacement, background, disabled/hidden target and disposal reset presence | Detachment, page visibility, disabled state and disposal reset presence |
| Cost        | One JS callback per delivered native hover event                                   | Coalesced browser pointer updates                                       |

`range` maps normalized input or clamps pixel input; `rest` must lie within an explicitly supplied range. Zero-sized targets produce no active point. Reduce Motion returns the source to rest. Resize is observed; call `refresh()` after application-controlled coordinate changes. `available` describes API support, not a connected accessory. Keep decorative followers non-interactive. Scene projection remains adapter/application policy. Android observes window input while delegating it to the original callback; application overlays can still require their own input-region policy. No input path here promises progress through blocked application JavaScript.

<Clip name="portable-pointer-ipados" :width="720" caption="iPad Pro 11-inch (M4) simulator, iPadOS 26.2, English UI: OS-injected continuous hover drives a native follower and SceneKit uniforms, preserves a tap, then resizes and remounts. Original timing; no physical mouse or iPad was tested." />
<Clip name="portable-pointer-android" caption="Physical ASUS ZenFone 3, Android 8, English UI: injected native mouse events move the follower, exit restores rest, and a real tap remains actionable. Original timing; no physical mouse accessory was tested." />
<Clip name="portable-pointer-chromium" :width="900" caption="Chromium on macOS, English UI: mouse entry/movement/exit, a preserved button click, resize, pause/resume and remount. Real browser interaction at original timing; ordinary touch does not become hover." />

## One operation for related properties

```ts
import { motionScope } from '@rafaelaugusto/jolt'
import { propertyGroup } from '@rafaelaugusto/jolt/native'
const scope = motionScope()
// a, b and c are existing typed NativeProperty adapters.
const group = scope.resource(() => propertyGroup({ a, b, c }))
const motion = group.animate({ a: 0.8, b: 0.4, c: 1 }, { duration: 1800 })
motion.pause()
motion.progress = 0.5
motion.play()
```

The group borrows 1–64 distinct target/channel adapters. Every command supplies exactly the named members. Targets, encoded arity, values and transitions are prepared before valid playback is interrupted. Duplicate channels and mixed native/Web backends are rejected. A group has `get`, `set`, `animate`, `stop`, `suspend`, `resume` and `dispose`; disposing it stops its playback without disposing borrowed properties.

Replacing any member cancels the whole running group, preserving unrelated channels. Retargeting reads current presentation and projects velocity for springs. Completion settles once; cancellation resolves `finished` to `false`. A failing `set()` attempts to restore written values, but does not restart cancelled animations; rollback errors are reported together. A native playback setup failure cancels every player already created. It cannot undo an external renderer's side effects. This is coordinated logical timing, not atomic GPU submission across renderers.

Native groups use one logical clock with compiled member players and require the optional `@rafaelaugusto/jolt-native` plugin. The elapsed position is synchronized after setup. Web uses one scheduler task, writes on the browser main thread, and does not change ordinary WAAPI animation. Create Web adapters explicitly:

```ts
const a = scope.property(target, {
  name: 'scene/glow',
  units: ['intensity'],
  read: (target) => renderer.readGlow(target),
  write: (target, value: number) => renderer.writeGlow(target, value),
  encode: (value) => [value],
  decode: (values) => values[0]!,
  alive: (target) => renderer.contains(target),
})
const group = scope.propertyGroup({ a })
group.animate({ a: 1 }, { duration: 600 })
```

Web adapters may describe `spatial`, `validate` and `interpolate`; they belong to one runtime/document. Use `alive()` for external target destruction and dispose adapters before releasing their resources. DOM targets must remain connected. A spatial member causes its entire group to finish immediately when Reduce Motion becomes active. Scope suspension preserves manual pauses.

Each property accepts at most 64 numeric components. Sampled animations are bounded to 262,144 numeric components per member and 1,048,576 per group; oversized requests fail before interrupting valid playback. These are allocation limits, not a supported-duration guarantee.

<Clip name="portable-groups-ios" caption="iPhone 17 Pro simulator, iOS 26.2, English UI: three compiled UIKit properties and three actual SceneKit material uniforms, coordinated pause/resume, replacement and remount. The demand indicator returns to idle. Original playback timing; not physical-device performance evidence." />
<Clip name="portable-groups-android" caption="Physical ASUS ZenFone 3, Android 8, English UI: three compiled native properties share start, pause/resume, replacement and remount. Real taps, original timing; this Android fixture does not contain SceneKit." />
<Clip name="portable-groups-chromium" :width="900" caption="Chromium on macOS, English UI: three DOM properties and actual WebGL uniforms share group commands. Pause/resume, replacement, idle renderer demand and remount use real browser clicks at original timing." />

## Renderer demand follows ownership

```ts
const activity = scope.renderActivity({
  change(active) {
    renderer.setContinuous(active)
  },
  redraw() {
    renderer.drawFinalFrame()
  },
})
activity.track(motion) // observes playback; does not own or stop it
const child = activity.scope()
const release = child.hold() // explicit application work or continuous input
release()
```

`track()` follows actual playback boundaries, including pending delay, pause, seek, replacement and completion. Delays reserve demand. `hold()` stays active until released. Independent child owners aggregate into one renderer; use `activity.scope()` instead of creating two roots for the same adapter object. At most 4,096 observations/tokens are retained. These APIs add no polling timer or permanent frame loop.

A retained drawing alone creates no render demand. Suspension/background suppresses demand, and `redraw()` delivers final/seeked state while visible. Disposing an activity releases observations without stopping borrowed animation. Integrations must combine Jolt demand with application-owned rendering settings. No global SceneKit policy is installed. The native and Web videos above show this integration; the browser tests additionally verify that the actual WebGL frame counter stays unchanged at idle.

## A bounded retained drawing

```ts
import { drawBatch } from '@rafaelaugusto/jolt/shapes'
const drawing = scope.resource(() =>
  drawBatch(host, {
    viewBox: [0, 0, 760, 300],
    styles: { signal: { fill: '#63e3c2', strokeWidth: 0 } },
    items: [{ id: 'dot', style: 'signal', kind: 'circle', cx: 30, cy: 80, radius: 4 }],
  }),
)
drawing.update([
  { id: 'dot', style: 'signal', kind: 'circle', cx: 40, cy: 80, radius: 8 },
])
```

Use `scope.drawBatch(element, sameOptions)` on Web. Items support circles, rectangles and validated SVG paths. IDs are unique 1–128-character letters/digits/dots/underscores/hyphens. Array order is paint order. `set({ items, styles })` replaces supplied collections; use it to insert, remove or reorder. `update(items)` replaces complete existing items by ID while preserving order. Shared styles use the ordinary shape fill/stroke options; unknown fields are rejected. Complete updates are validated before changing a valid drawing.

The immutable `viewBox` fits proportionally, centers and clips in local host bounds; geometry and stroke widths use viewBox units. Host resize updates that mapping. iOS retains paths in one drawing layer; Android retains geometry in one drawable and uses Canvas primitives for circles/rectangles. Web uses one decorative SVG surface with one path per item, reusing unchanged nodes. Fewer native views does not imply fewer browser DOM nodes or lower CPU.

| Limit                                          |                                   Native and Web |
| ---------------------------------------------- | -----------------------------------------------: |
| Items / shared styles                          |                                       1,024 / 64 |
| Total normalized commands / numeric components |                                   8,192 / 65,536 |
| Per path                                       | Existing 256 commands / 20,000 source characters |
| Serialized update                              |                                            2 MiB |
| Per-item sampled animation                     |     Unsupported; immediate geometry updates only |

`snapshot()` reports counts and numeric geometry bytes, not process memory. Whole-host animation remains independently owned. `suspend()` retains the visible drawing and defers updates until `resume()`; backgrounding follows the same rule. Native unload releases and later restores geometry. `dispose()` removes the surface permanently. Item hit-testing and accessibility labels remain application responsibilities; the surface does not intercept input. Animate meaningful content with the usual reduced-motion-aware host APIs.

<Clip name="portable-drawing-ios" caption="iPhone simulator, iOS 26.2, English UI: 259 dots and a segmented indicator on one retained layer, targeted changes, whole-host motion, deferred edits during pause and remount. Real native interaction, original timing." />
<Clip name="portable-drawing-android" caption="Physical ASUS ZenFone 3, Android 8, English UI: 259 dots, targeted changes, a segmented indicator, pause/resume and remount on one native Canvas surface. Real taps, original timing." />
<Clip name="portable-drawing-chromium" :width="900" caption="Chromium on macOS, English UI: the shared 259-dot recipe and segmented indicator on SVG, targeted changes, pause/resume and remount. Real browser interaction at original timing; SVG retains one path per item." />

## Native regressions covered

The iOS shape renderer now reads local `UIView.bounds` after transformed layout, preventing scale/rotation from changing its internal drawing size. Android and the existing Web shape contract already use local geometry. The iOS press observer no longer forwards native touches a second time, avoiding duplicate button actions; feedback resets on suspension. This reproduces and fixes duplicate taps. The original report of an action firing while already suspended was not independently reproduced.

<Clip name="portable-shape-ios" caption="iPhone simulator, iOS 26.2: a directly transformed drawing and a drawing inside a transformed parent keep matching local geometry under scale, rotation and both together. English UI, real taps, original timing." />
<Clip name="portable-press-ios" caption="iPhone simulator, iOS 26.2: one action per real tap with scoped press feedback, Home/background, foreground and remount. English UI, original timing; this demonstrates tap duplication prevention, not a reproduced action during suspension." />

See the [validation report and raw measurements](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/portable-foundations.md) for device/build identities, repeated workloads, browser costs and limits. These results do not establish lower total application CPU/PSS or superiority over Reanimated.
