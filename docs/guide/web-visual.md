# Web colors, layout and scenes

**Available since 0.1.0-rc.7**, delivered by #308–#313. These features extend the experimental `/web` entry without a framework or NativeScript dependency. [Full functional parity](https://github.com/rafaelaugustos/jolt/issues/236) remains the broader goal; this release does not claim every native API is available on Web.

## Colors, borders and live bindings {#paint}

Finite playback now accepts `backgroundColor`, `color`, `borderColor` and its four side colors; `borderWidth` and its four side widths; `borderRadius`, four independent corners and each corner’s `X`/`Y` radii. Explicit longhands override shorthands. Numbers use CSS pixels for lengths and packed ARGB for colors. CSS color/length strings are resolved against the target when the call is prepared; corner shorthand accepts elliptical syntax and percentages.

Colors use the shared premultiplied OKLab compiler and sRGB output. Widths/radii are nonnegative and remain subject to CSS geometry and border-style rules. Jolt does not add a visible border when `border-style` is `none`, replace a background image, or change the outline used for keyboard focus. Paint channels replace independently; named additive/multiplicative layers retain the transform/opacity contract.

A numeric value’s `.to()` also accepts color strings and returns a readonly `WebColorValue`. Apply `springValue()` before the color mapping; colors do not have a scalar velocity. `bind()` accepts these color nodes and numeric decoration nodes, using the existing demand-driven scheduler. Source disposal releases dependents; binding disposal holds the latest paint. A stale handle cannot overwrite a replacement.

Color mappings are target-independent: pass resolved colors rather than target CSS variables or `currentColor`. Finite `animate()` resolves these expressions against its target.

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'
const motion = createWebRuntime(document)
motion.animate(
  card,
  {
    backgroundColor: '#d8f381',
    color: '#15291e',
    borderTopColor: '#dc672a',
    borderRightWidth: 8,
    borderRadius: '42px 12px 56px 20px / 16px 32px 24px 48px',
  },
  'snappy',
)

const input = motion.motionValue(0)
const follower = motion.springValue(input)
const paint = motion.bind(card, {
  backgroundColor: follower.to([0, 1], ['#7655e8', '#ed8b46']),
  borderRadius: follower.to([0, 1], [12, 64]),
})
input.set(1)
```

<Clip name="web-paint-chromium" :width="900" caption="Chromium 156, macOS arm64: real clicks, held press and keyboard range input demonstrate finite color/border/corner playback and continuous color/radius bindings. Original timing; no mobile-device performance claim." />

## Real size and visual layout {#layout}

`animateSize()` changes real `width` and `height`, independently or together, with numeric and `auto` destinations. Text reflows and siblings move through normal layout. Box sizing, min/max, Grid and Flexbox allocation remain authoritative. The flex path interpolates preferred CSS size so grow/shrink are not applied twice. Intrinsic endpoints are remeasured while active; new content can extend completion. Completion restores semantic `auto` or the requested numeric CSS declaration.

The mutation runs synchronously after capture; queued framework microtasks run before measurement. Fetch data first. Async mutations, repeats and seek are invalid for a changing intrinsic endpoint. Replacement carries current value/velocity on shared axes, returns omitted axes to their original declarations and resolves the old operation `false`. Pause removes scheduled size work. `stop()` holds the current size; `stop({ restore: true })`, removal and disposal restore owned declarations without undoing content changes or newer external inline writes.

`animateLayout()` captures the container’s direct HTMLElement children by identity, applies the mutation, then measures on the next frame. It animates inverse position and size through private transform contributions, preserving application/press motion, static 2D transforms and origins. New children can fade in; removed children leave immediately. `size: false` disables size inversion and `enter: false` disables insertion motion. A replacement recaptures the current visual pose. `stop()` removes its inverse transforms and keeps the mutated layout. The handle offers `finished` and `stop()`, not intrinsic-size or playback controls. Projective/singular geometry has no supported 2D inverse.

```ts
const size = motion.animateSize(
  card,
  { width: 420, height: 'auto' },
  () => {
    card.textContent = nextText
  },
  { duration: 400 },
)
size.pause()
size.play()
await size.finished

const layout = motion.animateLayout(
  list,
  () => {
    list.append(list.firstElementChild!)
  },
  { size: 'scale', enter: true, duration: 400 },
)
await layout.finished
```

<Clip name="web-size-chromium" :width="900" caption="Chromium 156 on macOS: actual controls resize width and intrinsic height, pause, resume, reverse and add text. The following row moves through real layout; the footage keeps its original speed." />

<Clip name="web-layout-chromium" :width="900" caption="Chromium 156 on macOS: real clicks reorder, resize, interrupt, insert and remove grid cards. FLIP scales the visual content; it is distinct from real text reflow." />

## Seekable scenes {#scenes}

`seekableTimeline()` coordinates explicit element and mutable numeric-value tracks, nested `steps`, offsets in milliseconds and finite repeats on one playback clock. Use one descriptor per logical channel/layer; combine repeated movements into keyframes. Callbacks, gestures and side effects are not reversible scene descriptors. All targets/values must belong to the same document/runtime.

Pause, resume, stop and `progress` retain the finite playback contract. A paused endpoint can rewind. Replacing one channel or calling `set()` on a numeric value leaves the scene’s other tracks running; its old handle cannot reclaim the replacement and eventually resolves `false`. Numeric-value observation needs the shared scheduler, while eligible element-only scenes retain WAAPI playback.

```ts
const progress = motion.motionValue(0)
const scene = motion.seekableTimeline(
  [
    {
      target: card,
      keyframes: { x: [0, 240], borderRadius: [8, 40] },
      transition: { duration: 1200, ease: 'linear' },
    },
    {
      at: 200,
      steps: [{ value: progress, keyframes: [0, 100], transition: { duration: 1000 } }],
    },
  ],
  { paused: true },
)
scene.progress = 1
scene.progress = 0.3
scene.play()
await scene.finished
```

<Clip name="web-scene-chromium" :width="900" caption="Chromium 156 on macOS: actual play/pause clicks and keyboard range input coordinate two elements and a numeric counter, seek to the paused endpoint, rewind and resume." />

## Lifecycle, cost and integration {#integration}

Live reduced motion settles spatial/decorative tracks and intrinsic size, including paused size operations; color/opacity retain their timing. Release targets and dispose the context with their owner. `useWebMotion()` also exposes `animateSize()` and `animateLayout()` on its declared ref and releases work with the Vue scope.

The [Web surface policy](./web-runtime#surface-policy-and-limits) still applies. Use a dedicated surface without competing CSS transitions/animations. Finite paint uses prepared WAAPI keyframes, but colors can repaint and border widths can trigger layout. Real size performs synchronous layout measurements per active frame; neither path implies compositor acceleration. Keep framework renders out of per-frame motion.

Run `npm run web:visual:typecheck`, `npm run web:visual:test` and `npm run web:visual`; the fixture is on port 4287 with `?demo=paint`, `size`, `layout` or `scene`. [Verification and recording commands](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-visual.md) include real Chromium/Firefox/WebKit and packed imperative/Vue/SSR/native consumers.

Mavis adoption is separate: [choice paint #191](https://github.com/getcortexlabs/mavis-ui/issues/191), [Accordion size #192](https://github.com/getcortexlabs/mavis-ui/issues/192), [shared FLIP #193](https://github.com/getcortexlabs/mavis-ui/issues/193) and [seekable scenes #194](https://github.com/getcortexlabs/mavis-ui/issues/194). These consume Jolt rather than reimplement its motion engine.

## Preserved native references {#native-reference}

These reviewed English recordings show the existing native equivalents. They are not recordings of the Web implementation or evidence of new physical-device performance.

<Clip name="decorations-reference-ios" caption="iOS native demo excerpt: border and corner changes. Trimmed from the existing recording to remove launch screens; original playback timing and original media preserved." />

<Clip name="live-paint-ios" caption="iOS simulator: real taps retarget and pause/resume a retained color/radius spring. Native reference; uniform native corners differ from Web’s independent corners." />

<Clip name="size-ios" caption="iPhone 17 simulator, iOS 26.0: real width/height, intrinsic content, interruption and pause. The demo explicitly selects 0.25× for part of the interaction; video timing is unchanged." />

<Clip name="layout-ios" caption="iOS simulator: insertion, removal, reordering and card resizing in the existing native FLIP demo." />

<Clip name="seekable-scene-ios" caption="iOS simulator: actual slider interaction seeks a native scene, including backward movement from a paused endpoint." />
