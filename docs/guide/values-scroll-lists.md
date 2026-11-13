# Combined values, scroll and keyed updates

**Source candidate for the next RC; not published in RC.14.** This work covers #494, #495, #498, #499, #500 and #501. Rebuild native applications after upgrading. The recordings below show actual interaction; simulators and the emulator are not physical-device performance evidence.

## Combine numeric values

```ts
import { animate, bind, motionValue } from '@rafaelaugusto/jolt'

const a = motionValue(0)
const b = motionValue(0)
const x = a.add(b).mul(0.65).clamp(0, 300)
const detach = bind(card, { x })
animate(a, 180, 'snappy')
animate(b, 90, 'smooth')
// Teardown: detach(); x.dispose(); a.dispose(); b.dispose()
```

On Web, create both inputs with one `runtime.motionValue()` context and use `runtime.bind()` / `runtime.animate()`. A binding has `dispose()`; the native binding returns a cleanup function. Existing `.to()` mappings and spring followers remain available.

`add`, `sub`, `mul`, `div`, `min` and `max` accept another numeric value or a finite number. `clamp(min, max)`, `abs()`, `sin()`, `cos()` and `velocity()` return derived values; trigonometric inputs are **radians**. Values have no implicit unit conversion. Velocity uses input units per second, multiplication/division use the chain rule, and the velocity node itself has zero derivative. Ties, clamped endpoints and zero denominators produce zero velocity; nonfinite arithmetic results settle to zero. Bounds must be finite and ordered. Colors are not scalar operands. Graph depth is limited to 32 and native programs to 1,024 instructions.

Derived values borrow their inputs. Disposing an input disposes dependent graphs; disposing a graph leaves its inputs alive. Use `getVelocity()` for a read, and subscribe only when application code needs notifications. Finite native inputs compile to native tracks; live input graphs run in Java/Objective-C evaluators with preallocated instruction slots. Web algebra uses the shared frame scheduler. None of these APIs moves NativeScript's application runtime off the main thread or promises RenderThread playback.

<Clip name="values-scroll-ios" caption="iOS 27 simulator: two numeric inputs drive one native card; real gestures drive a native scroll progress binding. No physical-device performance claim." />
<Clip name="values-scroll-android" caption="Android 16 emulator: combined values, interruption and a native ScrollView source. The audit counts Jolt callbacks separately from NativeScript Core callbacks." />
<Clip name="combined-values-web" caption="Chromium on macOS: combined inputs, interruption and real wheel scrolling. Browser playback, not a native threading or performance comparison." />

## Native scroll sources

```ts
const offset = scrollValue(scrollView, { execution: 'native' })
const detach = bind(progressBar, { scaleX: offset.to([0, 500], [0, 1]) })
// Core ListView / a supported Android linear collection:
const listOffset = scrollValue(list, { execution: 'native', rowHeight: 60 })
```

`execution` is `auto` (default), `native` or `javascript`. Auto uses rebuilt native classes; the JavaScript fallback supports Core ScrollView. Forced native mode reports an unavailable bridge instead of silently falling back. `refresh()` rereads geometry; `ref(next)` replaces the source. Unload, background and disposal detach listeners. Explicit subscribers opt into Jolt notifications; native bindings alone do not add per-scroll Jolt JavaScript calls. Core may still emit its own JavaScript scroll events.

Offsets use DIPs on Android and points on iOS. iOS normalizes the adjusted leading inset and preserves negative bounce. Android lists require fixed rows, include divider spacing and support ordinary vertical ListView or a linear RecyclerView layout; reversed, stacked-from-end, grid and sectioned layouts are outside this contract. iOS accepts UIScrollView subclasses, including table and collection views. Native `scrollLinked()` compiles eligible transform/opacity/paint keyframes into native bindings; unsupported properties retain the existing scrubbing path.

Web reuses `runtime.scrollValue()` and `scrollLinked()`. A direct clamped numeric `.to()` binding with a shared nonnegative range can use ScrollTimeline where supported. Algebra, mixed ranges, unsupported browser features and nonpositive scale endpoints use the shared scheduler. Browser offsets, clipping, overscroll and hardware behavior need not match native pixels.

## Exits and Vue groups

```ts
animateLayout(
  container,
  () => {
    container.removeChild(card)
  },
  { duration: 500, exit: { opacity: 0, y: 16, scale: 0.92 } },
)
// Web: runtime.animateLayout(container, () => card.remove(), sameOptions)
```

The default still removes immediately. Opt into `exit: 'fadeOut'`, `false`, or an object with `opacity`, `x`, `y`, and uniform positive `scale`. The same finite layout transition drives moves and exits. `maxSnapshotPixels` defaults to 8,000,000 and accepts 1–32,000,000 pixels shared by concurrent copies in that operation. Only children actually removed during the mutation/next layout pass are copied; surviving children are not snapshotted. The completion promise waits for exits and moves.

NativeScript tears down native views during removal, so exits use bounded static presentation copies. Copies ignore input and accessibility, and disappear on interruption, reinsertion, unload, background, reduced-motion changes or disposal. Unsupported or over-budget views leave immediately. Native capture requires fully visible, unrotated, uniformly scaled 2D content with opaque ancestors; video/texture/WebView and nested scrolling surfaces are unsupported. The copy is frozen, including text and image content. This does not retain live editors or transfer their focus to an overlay.

Web copies computed DOM presentation. Forms, custom elements, canvas/video, pseudo-element content and rotated/3D ancestors are unsupported. The scoped removal hooks cover ordinary `removeChild`, `remove`, replacement methods and container text/HTML replacement; calls through cached prototype methods or implicit moves to another parent cannot be captured. A browser without popovers removes immediately. Keep mutations synchronous and children directly owned by the container.

```vue
<JoltTransitionGroup :enter="true" leave="fadeOut" move="snappy">
  <Label v-for="item in items" :key="item.id" :text="item.title" />
</JoltTransitionGroup>
```

Import from `/vue` for NativeScript (default `StackLayout`) or `/web/vue` for Web (default `div`, optional borrowed `runtime`). `tag` chooses the container. `enter` controls a fade, `leave` follows the restricted exit contract, and `move` takes the layout transition. Deactivation/unmount stops the operation. SwiftUI already provides keyed `ForEach`/transition composition; no duplicate group abstraction is added.

<Clip name="layout-exits-ios" caption="iOS simulator: mixed removal/insertion/reorder, successive removals, cancellation, reinsertion and reduced motion. Static leaving copies remain outside accessibility." />
<Clip name="layout-exits-android" caption="Android emulator: native exit snapshots and neighboring moves, interrupted and reinserted items, then reduced motion." />
<Clip name="layout-exits-web" caption="Chromium: mixed DOM updates and cancellation, followed by the actual Vue transition group. Leaving copies are inert and aria-hidden." />

## Keyed recycled lists

```ts
const changes = listChanges(listView, {
  key: (item) => item.id,
  rowHeight: 60,
  exit: 'fadeOut',
  move: 'snappy',
})
const animation = changes.update(nextItems)
// scope.add(changes), or changes.dispose() when the owner is destroyed
```

The first native adapter is a flat Core ListView with fixed positive row height. The `rowHeight` option sets that property in DIPs; otherwise it is read after the list loads. Data updates require a loaded list with a resolved fixed height. Commit immutable arrays through `update()`; keys are unique strings or finite numbers. Diff all keys, animate only realized visible rows, and preserve the first visible key's intra-row offset. If that key was removed, use the nearest remaining index. New updates start from displayed positions; recycling resets only properties owned by this operation. Off-screen existing keys do not play entrances. Sections, grids, CollectionView transitions and cross-list moves remain outside this first adapter.

`stop()` cancels current motion and settles into the committed data. `pause()` makes subsequent updates immediate until `play()`; it does not roll data back. Unload disposes the native controller, so create a new owner on a later load. Background/reduced motion cancels active decorative transitions. Focus restoration follows a surviving visible key and its descendant path where the native template stays compatible; removed/off-screen keys do not force a focus jump.

```ts
const changes = runtime.listChanges(container, {
  key: (item) => item.id,
  scroll: viewport,
  exit: 'fadeOut',
  move: 'snappy',
  adapter: {
    items: () => items,
    render(next) {
      items = [...next]
      reconcileKeyedDOM(items)
    },
    rows: () => items.map((item) => ({ key: item.id, target: elements.get(item.id)! })),
  },
})
changes.update(nextItems)
```

Web does not virtualize data or render framework children itself. The adapter commits keyed DOM synchronously and retains surviving nodes, preserving focused descendants. A virtualizer must set `virtualized: true`, return realized rows implement `observeRecycling(recycle)` to notify before reusing a row, and implement `anchor(keys)`, returning a callback that restores key/index and intra-row offset after the next data commit. Dispose the controller when its owner goes away; detaching the container also disposes it. Do not mix this controller with another layout owner on the same rows.

<Clip name="list-changes-ios" caption="iOS simulator, 200 Core ListView rows: scroll, preserve the anchor on insertion, remove, reverse/filter with interruption and settle reduced motion." />
<Clip name="list-changes-android" caption="Android emulator, 200 fixed-height Core ListView rows: native recycling, keyed updates, interruption and list scroll-source audit." />
<Clip name="list-changes-web" caption="Chromium, 200 retained keyed DOM rows: scroll and insert above the viewport, delete, reverse/filter and interrupt. This fixture is not a virtualizer." />

## SwiftUI structural scroll and headers

```swift
let combined = try a.add(b).mul(0.65)
card.joltBind(.x, to: combined)
let controller = try JoltScrollHeaderController(
  geometry: .init(expanded: 180, minimum: 48, section: 32, parallax: 50)
)
```

Swift scalar graphs use `JoltComputedValue`, share their inputs' clock, and participate in `JoltScope`. The velocity source is named `velocityValue()` because `JoltMotionValue.velocity` already reads a scalar. SwiftUI owns view invalidation; this is not a promise of zero view updates or native-platform pixel parity.

`JoltScrollHeader(controller:artwork:title:toolbar:compactTitle:section:content:)` retains one content spacer, pinned toolbar/section, title handoff and decorative parallax. Mark rows with `.joltScrollAnchor(id)` before using `await controller.preserveAnchor { ... }`. `scrollTo`, `scrollToTop` and asynchronous `remeasure` use the attached native scroll view on iOS/macOS; user input, pause and disposal cancel programmatic motion. Geometry changes preserve content position unless a newer user/programmatic operation takes over.

`JoltScrollProgress.subrange()` creates borrowed independently mapped ranges; `setRange()` replaces bounds. `joltScrollLinked(..., role: .structuralTranslation)` preserves x/y positioning under reduced motion while dropping decorative channels. `.structuralPose` explicitly preserves the complete pose; the default `.decorative` suppresses spatial decoration. Read `@Environment(\.joltEffectiveReduceMotion)` for the app-or-system setting. Headers keep structural collapse and pinned content while disabling parallax and stepping the title handoff; scrolling itself remains available.

<Clip name="swiftui-values-scroll-ios" caption="Standalone SwiftUI on the iOS 27 simulator: combined inputs, programmatic scroll, keyed prepend, pinned header/title handoff and reduced motion. No NativeScript dependency." />
<Clip name="swiftui-values-scroll-macos" caption="Standalone SwiftUI on macOS: the same values/header controller with wheel input, anchor preservation and reduced motion. Desktop capture, not an iPhone performance result." />

The validation fixtures live in `benchmarks/values-scroll-lists` and `benchmarks/swiftui-demo`. The physical Android allocation/frame-time measurement required by #494 is still pending: the user authorized emulator-only validation for this batch. Host evaluator vectors, tests and simulator recordings do not establish lower application CPU/PSS than Reanimated.

<Clip name="list-changes-playground-web" caption="Chromium, actual documentation playground: scroll the keyed list, preserve the anchor while inserting above, then remove, reverse and interrupt updates." />
