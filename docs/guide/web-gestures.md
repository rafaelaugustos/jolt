# Web gestures, zoom and scroll

Unreleased experimental work after **0.1.0-rc.8**, tracked by #340–#345. The six capabilities belong to the same document runtime and resource scopes. NativeScript and framework runtimes are absent from the Web import graph. The existing native implementations remain available; their recordings below are references, not footage of this Web implementation.

Create the runtime after mounting. Coordinates are CSS pixels, rotation is degrees and velocities are units per second. Keep the declared input surface untransformed and animate its child; the existing rendered/top-layer coordinate boundary still applies. The application owns markup, semantics, data and routing.

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'

const motion = createWebRuntime(document)
const scope = motion.scope()
const x = scope.motionValue(0)
```

## Inertial drag and values {#drag}

Opt into `release: "decay"` for the native drag solver: friction, projected snap and bounded edge recovery. `rubberband` resists movement outside bounds. The existing default remains spring return to the attachment position or snap points. Supply `value` with one axis to drive a borrowed motion value; omitting it moves the input element. `dragging`, `settling`, `position`, `animation`, `paused` and `disposed` expose lifecycle. Start/move/release/cancel/settle callbacks belong to this controller. Cancel freezes owned motion; disposing never destroys a borrowed value. Finite element release uses WAAPI.

```ts
const drag = scope.drag(handle, {
  axis: 'x',
  value: x,
  release: 'decay',
  bounds: { left: -200, right: 200 },
  rubberband: true,
  friction: 0.998,
  snap: [-200, 0, 200],
  onRelease: ({ animation }) => animation.finished.then(onFinished),
})
drag.pause()
drag.play()
drag.cancel()
```

<Clip name="web-gestures-drag-chromium" :width="760" caption="Chromium on macOS, real mouse drag/release: bounded inertia, reversal and a borrowed motion value. Original speed; browser footage." />

<Clip name="drag-ios" caption="iOS simulator reference: existing bounded drag, rubberband and snap demo, recorded with real native input. Native playback is unchanged." />

## Composed contacts {#contacts}

Pan, pinch and rotation recognize together. Adding/removing contacts rebases their measurements without a centroid jump. Values remain observable without framework renders; `settleTo`, `jumpTo`, `updateBounds`, pause/play/cancel/dispose control the interaction. Pan accepts axis, threshold, failOffset and bounds; a bounds function can use the current pose. Single tap waits when double tap is enabled. Gesture focal coordinates are viewport CSS coordinates. Only work with active input or settling schedules frames.

```ts
const gesture = scope.gestures(inputSurface, {
  pan: true,
  pinch: { min: 0.5, max: 4 },
  rotate: true,
  onTap: select,
  onDoubleTap: reset,
})
scope.bind(card, {
  x: gesture.x,
  y: gesture.y,
  scale: gesture.scale,
  rotate: gesture.rotate,
})
gesture.settleTo({ x: 0, y: 0, scale: 1, rotate: 0 })
```

<Clip name="web-gestures-gesture-chromium" :width="760" caption="Chromium on macOS: browser-trusted CDP two-contact pinch/rotation, one-contact continuation, mouse pan and double tap. This is browser input automation, not physical touch hardware." />

<Clip name="gesture-composition-ios" caption="iOS simulator reference: existing native simultaneous contact composition and tap demo. Not a physical-device performance measurement." />

## Panel and nested scroll {#scroll}

Declare a bounded single-axis pan and its scroll descendant. Upward movement expands the panel before scrolling; the reverse drains eligible nested content before collapsing. Each delta is consumed once, including direction reversal. Release uses the existing decay solver. Horizontal coordination accounts for browser RTL scroll offsets. Wheel, keyboard and focus scrolling remain browser operations. The coordinated touch axis is controlled by Jolt: Pointer Events resolves touch-action before contact, so changing CSS during a gesture cannot return it to browser panning. Inputs inside the region retain their own interactions.

```ts
const gesture = scope.gestures(inputSurface, {
  pan: { axis: 'y', bounds: { top: 0, bottom: 240 } },
  initial: { y: 240 },
  scroll: { element: content },
})
scope.bind(panel, { y: gesture.y })
```

<Clip name="web-gestures-scroll-chromium" :width="760" caption="Chromium on macOS: one held pointer expands the panel, scrolls content and reverses without lifting, followed by browser wheel scrolling." />

<Clip name="gesture-handoff-ios" caption="iOS simulator reference: existing native panel/content handoff in one contact. Native playback is unchanged." />

## Photo zoom and dismissal {#zoom}

Use a centered image box in its direct viewport parent, normally `width:100%; height:100%; object-fit:contain`. The image receives its own transform contribution. Focal pinch, bounded pan, double tap, wheel zoom, keyboard +/−/0/arrows and Escape share the same controller. Browser page zoom remains available through its own shortcuts. Read `ready`, `error` and `state`; source loading, resize, pause and disposal belong to the controller. Optional backdrop/chrome opacity uses independent contributions. Dismissal is a guarded intent: the app/router decides navigation; obsolete cancel/complete calls return false.

```ts
const photo = scope.zoomable(image, {
  viewport,
  scale: [1, 5],
  doubleTap: 2.5,
  backdrop,
  chrome,
  onDismiss(intent) {
    closeRoute().then(
      (closed) => (closed ? intent.complete() : intent.cancel()),
      () => intent.cancel(),
    )
  },
})
photo.zoomTo(2, { x: 180, y: 120 })
photo.reset()
```

<Clip name="web-gestures-zoom-chromium" :width="760" caption="Chromium on macOS: double tap, pan, browser-trusted pinch, reset, cancelled dismissal and keyboard zoom. Original speed." />

<Clip name="photo-zoom-ios" caption="iOS simulator reference: existing native photo pinch, pan, reset and cancelled dismissal." />

## Header, anchors and refresh {#header}

Declare the cover, optional artwork/titles/pinned section and the actual scrolling container. Jolt owns a removable content spacer and motion contributions. The minimum height can be measured dynamically. `preserveAnchor` records a keyed visible row around synchronous or asynchronous renderer changes; a removed row falls back to its surviving position. `scrollToItem`, `scrollToTop`, remeasure and controls use the same source. Expanded/compact title visibility and focus handoff avoid two simultaneously reachable titles. Refresh is optional: one active promise, pull threshold, cancellation and retry/error. `commit` checks the request before invoking a change and before restoring its anchor. An asynchronous change must check `cancelled` before any writes it performs after awaiting. Cancellation resolves the refresh result immediately.

```ts
const header = scope.scrollHeader(scroller, {
  header: cover,
  artwork,
  title,
  toolbarTitle,
  section,
  expanded: () => cover.offsetHeight,
  minimum: () => toolbar.offsetHeight,
  items: () => rows.map((row) => ({ key: row.id, target: row.element })),
  async onRefresh(context) {
    const next = await fetchRows()
    await context.commit(() => replaceRows(next))
  },
  onRefreshError: showRetry,
})
await header.preserveAnchor(() => insertRows())
header.scrollToItem('album-6')
header.cancelRefresh()
```

<Clip name="web-gestures-header-chromium" :width="760" caption="Chromium on macOS: collapse, anchored insertion, actual pull/release, failure/retry and completion. Revised recording includes the motion-value velocity correction." />

<Clip name="scroll-header-refresh-ios" caption="Physical iPhone 17 Pro / iOS 27.2 reference: existing native pull-to-refresh, failure/retry and anchored updates. Preserved original recording; it does not show the Web implementation." />

## Interactive keyed reorder {#reorder}

The host provides stable string/number keys and realized DOM targets, then commits a keyed move. Jolt previews variable-height neighbors in private layers and uses FLIP for renderer reconciliation. Application transforms and press contributions remain separate. Mouse, touch long press, edge scrolling and keyboard pickup/move/commit/cancel are available. Prefer dedicated handles so other content retains normal browser scrolling. Space/Enter picks up or commits, arrows/Home/End move and Escape cancels. Programmatic move/moveTo/moveUp/moveDown share the same commit. Data, identity, removal, geometry and lifecycle changes cancel stale work. Reorder does not own the data renderer or virtualization.

```ts
const reorder = scope.reorder(list, {
  items: () => rows.map((row) => ({ key: row.id, target: row.element })),
  handle: '[data-reorder-handle]',
  onCommit: ({ key, beforeKey }) => moveItemBefore(key, beforeKey),
  edge: { size: 72, speed: 640 },
})
reorder.moveDown('album-1')
reorder.move('album-1', null)
reorder.refresh()
```

<Clip name="web-gestures-reorder-chromium" :width="760" caption="Chromium on macOS: mouse reorder, keyboard commit, edge scrolling and a programmatic move through real controls." />

<Clip name="reorder-ios" caption="iOS simulator reference: existing native variable-height reorder, buttons and edge scrolling. Preserved original recording." />

## Lifecycle and evidence {#lifecycle}

All controllers support explicit disposal and scoped pause/resume. In Vue, put setup in `useWebMotion(ref).use((scope, element) => ...)` so replacement, KeepAlive and unmount retire the correct resources. Keep input and animated surfaces separate in the component. Reduced motion preserves final state while avoiding optional settling motion; the scheduler becomes idle when there is no work. These APIs do not replace application semantics or establish frame-rate guarantees.

Run `npm run web:gestures:typecheck`, `npm run web:gestures:test` and `npm run web:gestures`. Tests distinguish synthetic recognition conformance from Chromium’s trusted multi-contact injection. See the [evidence report](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-gestures.md). Mavis adoption is tracked separately in [#234](https://github.com/getcortexlabs/mavis-ui/issues/234), [#235](https://github.com/getcortexlabs/mavis-ui/issues/235), [#236](https://github.com/getcortexlabs/mavis-ui/issues/236) and [#237](https://github.com/getcortexlabs/mavis-ui/issues/237).
