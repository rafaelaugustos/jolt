# Web mappings, geometry and scroll {#web-support}

**Since RC.7:** [colors, borders, continuous paint, real size, FLIP and seekable scenes](./web-visual) extend this runtime. The Web APIs remain experimental; full parity is tracked in [#236](https://github.com/rafaelaugustos/jolt/issues/236).

Since **0.1.0-rc.6**, `@rafaelaugusto/jolt/web` includes numeric mappings, geometry refresh and vertical scroll (#302–#304). The APIs remain experimental. Native APIs and framework adapters keep their existing contracts; Mavis adoption is separate.

<Clip name="web-support-chromium" caption="Chromium desktop, English UI, original speed: real slider, keyboard, press and wheel input demonstrates numeric mappings, a resized label without resetting motion, scroll reversal and disposal. Browser recording; no physical-device or compositor performance claim." />

## Numeric mappings {#mappings}

```ts
const motion = createWebRuntime(document)
const input = motion.motionValue(0)
const mapped = input.to([0, 100], [0, 200])
const follower = motion.springValue(mapped)
const binding = motion.bind(card, {
  x: follower,
  scale: input.to([0, 100], [1, 1.2]),
  opacity: input.to([0, 100], [0.4, 1]),
})
motion.press(card)
input.set(50) // Application scale 1.1; held default press multiplies it by 0.96.
```

`.to(input, output, { clamp: true })` accepts 2–1024 finite numeric pairs. Inputs must be strictly ascending or descending; duplicate stops are rejected. Outputs may reverse direction. Clamp is the default; `{ clamp: false }` extrapolates the first/last segment. The configuration is copied. Callback transforms, multi-input graphs and cycles remain unsupported. RC.7 also supports [color-output mappings](./web-visual#paint). A chain may contain at most 32 mapping/follower levels.

Mappings are readonly: `get()`, `getVelocity()`, `subscribe()`, `dispose()` and another `.to()` are available, but `set()` is not. Velocity is source velocity multiplied by the selected segment's slope. Clamped endpoints/outside values have zero velocity; an interior knot uses the left derivative in ascending input order. Invalid/overflowing maps fail explicitly. All values must belong to the same runtime.

Unobserved maps read lazily. Active dependencies use the existing scheduler; mapping creates no independent frame loop. A mapped value can feed a spring or another mapping. Disposing a mapping closes its descendants and bindings while preserving unrelated siblings and its source. Disposing the source closes all descendants. Bindings hold their last value when disposed; release the surface to restore its original owned styles.

## Geometry without restarting playback {#geometry}

```ts
motion.set(card, { scale: 1.1 }) // Claim the mounted, transformable surface first.
const geometry = motion.observeGeometry(card)
// Or, after a synchronous size / 2D transform-origin change:
motion.refresh(card)
// Teardown: geometry.dispose(); motion.release(card)
```

`refresh()` accepts the new box and computed 2D `transform-origin`. The browser applies the pivot to the same transform effect: no channel replacement, new keyframes, clock restart or completion notification. Logical position/velocity, paused progress, finite tracks, live bindings and the press multiplier remain intact. A pivot change can move visual pixels as geometry changes; this is not FLIP, size interpolation or a pixel-position lock.

`observeGeometry()` shares one ResizeObserver per claimed surface. Size changes from responsive layout, labels and font metrics are batched by the browser. An origin-only style change with no resize needs explicit `refresh()`. Dispose observation leases separately; release/detachment disposes all of them. Stale leases cannot affect a replacement surface. Invalid automatic updates release the surface and report an error; a rejected explicit refresh does not replace its ownership.

The static CSS baseline remains fixed. Class replacement, external transform/opacity writers, individual CSS transforms, 3D origins, transitions and `display: none/contents/inline` are unsupported. Keep using release/recreate for those changes. Targets must already be mounted and claimed. Drag still cancels on scroll/resize; refreshing geometry does not extend its coordinate-space contract.

## Vertical scroll {#scroll}

```ts
const linked = motion.scrollLinked(
  scroller,
  card,
  {
    y: [0, -60],
    scale: [1, 0.9],
    opacity: [1, 0.4],
  },
  { range: [0, 400] },
)
// linked.execution: 'scroll-timeline' | 'scheduler' | 'released'
// linked.refresh(); linked.dispose()

const scroll = motion.scrollValue(scroller) // Omit for this runtime's Document.
const progress = scroll.to([0, 400], [0, 1])
// Binding/observing progress uses the scheduler. It may also feed springValue().
// scroll.refresh(); scroll.dispose()
```

Sources are a mounted HTMLElement or this runtime's Document. The readonly value reports vertical CSS pixels, bounded to the available scroll extent. Velocity is sampled input, not an analytic browser trajectory, and expires after 100 ms without a change. `range` must increase within 0–1e9 pixels; declarative playback clamps before/after it and reverses when scrolling back. Explicit finite numeric arrays support x/y/rotate/scale/scaleX/scaleY/opacity. Optional `times` must strictly increase from 0 to 1 and match each array. Empty/non-scrollable content stays at the start.

Automatic playback uses [ScrollTimeline](https://www.w3.org/TR/scroll-animations-1/) with pixel animation ranges when supported. `{ execution: 'scheduler' }` explicitly chooses fallback. A compatible surface has channels from one scroll link, plus static or paused contributions. Active finite motion (including press transitions), generic live bindings or independent links temporarily require shared scheduler composition on that surface. When those contributions settle, eligible scroll playback returns to its timeline. Ownership and range semantics remain the same. Unrelated surfaces keep their execution path. Subscribing to a separate scroll value does not force a native scroll effect into JavaScript playback.

Scroll/resize/text/font events invalidate sampled geometry; there is no continuous measurement or idle frame loop. Observers cover the source and its direct children, text/content mutations and font completion. For deeper overflow changes that do not resize an observed box, call `refresh()`. `linked.refresh()` also validates the target geometry. Reduced motion fixes spatial channels at their last keyframe while opacity still follows scroll; restoring the preference restores scroll mapping. Hidden fallback work resumes from the current offset, without simulating hidden scrolling.

Disposing/replacing the last owned channel or detaching source/target releases the link's listeners, values and observers. Partial channel takeover preserves its other channels; stale disposal cannot overwrite a newer animation. `scrollValue()` has independent lifetime and needs disposal. Horizontal/RTL normalization, reversed flow, vertical writing modes, ViewTimeline intersections, pinning, virtualized headers and nested-scroll handoff are outside this scope. These methods do not provide a `scrollHeader()` equivalent or a universal off-main-thread guarantee.

## Native references and verification {#verification}

The reviewed native demos below exercise existing mappings and scroll composition. Native implementation is unchanged; these are references, not recordings of the Web backend or Mavis integration.

<Clip name="descending-values-ios" caption="Existing iOS simulator demo, original speed: descending/chained mappings follow real sheet gestures. Native reference, not a physical-device recording." />
<Clip name="scroll-values-android" caption="Existing Android emulator demo, original speed: actual list scrolling drives header translation, scale, opacity and progress. Native reference." />

Run `npm run web:support:typecheck` and `npm run web:support:test`. The suite checks actual CSS presentation in Chromium, Firefox and WebKit, auto and forced fallback, press composition, geometry, lifecycle, idle frames, keyboard/wheel input and Chromium touch injection. Hidden-time tests control the visibility/scheduler signal rather than mobile backgrounding. Packed Web/Vue/SSR/native consumers and the existing suites remain required. See the [validation report](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-support.md).
