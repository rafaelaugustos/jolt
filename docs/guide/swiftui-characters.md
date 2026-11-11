# SwiftUI: keyframes, interaction and characters

Available in **0.1.0-rc.14 (Beta)** for iOS 17+ and macOS 14+, without NativeScript or JavaScript. Install the `JoltSwiftUI` product from the [`jolt-swift`](https://github.com/rafaelaugustos/jolt-swift) package repository, tag `v0.1.0-rc.14`. See [installation](./swiftui), [ownership](./swiftui-motion) and [interaction/geometry](./swiftui-geometry) for platform limits.

## Finite keyframes

`JoltTimeline.keyframes` compiles normalized scalar stops into the existing timeline. Each stop's easing controls the following segment. Require 2–256 strictly increasing stops per channel, starting at 0 and ending at 1. Values must be finite within ±10¹². Use 1–128 distinct channels on the supplied clock, 1–100 passes, at most 10,000 expanded segments and 60,000 milliseconds total. `iterations: 2, autoreverses: true` plays forward then backward; it ends at the initial stop. Reverse passes reverse the easing curve as well. There is no infinite loop.

```swift
let scope = JoltScope()
let x = try scope.value(0)
let scene = try scope.retain(JoltTimeline.keyframes([
    .init(x, [try .init(-100, at: 0, ease: .easeIn),
              try .init(100, at: 0.6, ease: .easeOut),
              try .init(0, at: 1)])
], duration: 1800, iterations: 2, autoreverses: true))
scene.pause()
try scene.seek(to: 0.5) // Pauses; no side effects.
scene.play()
// Bind: Capsule().joltBind(.x, to: x)
```

Validation completes before scalar ownership changes. A new writer interrupts the old timeline; cancel/dispose is terminal. Pause freezes progress, scene suspension preserves manual pause, and reduced motion settles the final pass without a running clock. Pass `reducedMotion:` from the host preference when creating a timeline; the clock also honors system preference. Web reuses `animate(target, {x:[-100,100,0]}, {duration:1800, times:[0,0.6,1], ease:['easeIn','easeOut'], repeat:1, repeatType:'reverse'})`: Web `repeat` counts additional passes.

## Composed gestures

`JoltGestureModel` owns x/y, uniform scale and rotation. `joltGestures` connects actual input, preserves the focal point when scale/rotation change and allows pan contact handoff. Translation uses Apple points; rotation uses degrees; scale is unitless and positive. Choose finite x/y bounds and a scale interval within (0,100]. Bounds intentionally limit focal preservation. Attach to content in an untransformed parent coordinate space; transformed ancestors and perspective are outside this first contract. On iOS, window recognizers filter by the input region rectangle; they do not infer SwiftUI overlay occlusion. Disable the covered gesture region while presenting overlapping content.

```swift
let gesture = try scope.retain(JoltGestureModel(
    bounds: .init(x: -100...100, y: -70...70), scale: 0.6...2
))
// card.joltGestures(gesture)
try gesture.settle(to: .init(), reducedMotion: false)
```

On macOS, recognized drag/pinch/rotation takes priority over a wrapped control’s gesture; ordinary clicks remain available. Direct input interrupts sampled settlement. Cancel keeps the current transform; settle animates a validated target. Disabling, removal and inactive scenes cancel contacts and suspend motion. Manual pause survives resume. The modifier supplies accessibility zoom, rotate and reset actions; applications may expose visible buttons, as in the demo. macOS footage demonstrates mouse drag and buttons, not physical trackpad validation. Web reuses `scope.gestures` with pointer contacts, `settleTo`, bounds and explicit accessible controls; browser input delivery differs.

<Clip name="swiftui-key-gesture-ios" caption="iOS simulator, native SwiftUI: finite keyframes, pause/resume, actual touch drag/pinch/rotation, reset and reduced motion. Not a physical-device recording." />
<Clip name="swiftui-key-gesture-macos" caption="macOS native SwiftUI: keyframes, mouse drag and visible zoom/rotation controls. Physical trackpad gestures are not validated by this recording." />

## Realized reorder and drop zones

`JoltReorderModel` owns up to 1,000 unique stable string IDs (1–128 characters). `JoltReorderList` realizes fixed-height vertical rows: 24–500 points high, with 0–100 points spacing. It is not a virtualizer. Only the handle starts drag; row content retains normal scrolling. Preview leaves committed keys unchanged until release; `onMove` receives the stable key, final index and `beforeKey`. Application persistence remains the caller's responsibility. `replace` validates all keys before cancelling input. Edge scrolling runs only during an active edge drag and stops at the boundary or cancellation.

Fixed height remains the default. Opt into [measured row heights](./swiftui-geometry#realized-rows-with-measured-heights) with `measuresRows: true`; the list is still realized.

```swift
let order = try scope.retain(JoltReorderModel(["one", "two", "three"]) { move in
    // Persist the controlled application order using move.key / move.beforeKey.
})
// JoltReorderList(order) { key in Text(key) }
order.move("one", to: 2)
```

Each row exposes move-up/down accessibility actions and its position. macOS also supports focused arrow commands. Reduced motion disables animated previews while preserving ordering. Pause, disable, background, data replacement and disposal cancel pending input without a commit. Web reuses the existing `scope.reorder` with realized keyed DOM rows, keyboard pickup/commit/cancel and edge scrolling; its variable-size capabilities do not imply SwiftUI virtualization.

`JoltDropZones` registers 1–64 unique target IDs (1–64 characters), finite priority and synchronous acceptance. Higher priority wins, ties preserve declaration order. Center hit testing includes edges; overlap requires positive area. Geometry uses actual view rectangles in a shared global coordinate space; this is in-app drop, not OS drag/file import. Rejected release springs to the origin, or returns immediately under reduced motion. `request(id)` offers a button/accessibility alternative without geometric overlap. Targets must still be mounted.

```swift
let zones = try scope.retain(JoltDropZones([
    .init("basket", label: "Basket"),
    .init("locked", label: "Locked shelf", priority: 10, accepts: { false })
], onDrop: { event in
    // Apply app data; return an optional owned effect.
    JoltEffect { /* cancel that effect */ }
}))
// source.joltDropSource(zones)
// basket.joltDropTarget("basket", in: zones)
try zones.request("basket")
zones.cancel()
```

The next interaction, target removal, pause/background or disposal clears the accepted effect. A callback may cancel or replace the operation; stale cleanup cannot overwrite the replacement. Drop coordinates are limited to ±1,000,000 points with positive dimensions. Do not apply independent source translation while the controller owns it. Web reuses `scope.dropZones`, with shared priority/acceptance/owned-effect policy and browser geometry. Drop zones do not supply reorder edge scrolling.

<Clip name="swiftui-transfer-ios" caption="iOS simulator, native SwiftUI: rejected and accepted touch drops, return/effect cleanup, keyed reorder and edge scrolling in 12 realized rows." />
<Clip name="swiftui-transfer-macos" caption="macOS native SwiftUI: mouse drops, accessible button alternatives, keyed handle reorder and edge scrolling. No virtualized-list claim." />

Since **0.1.0-rc.14** ([PR #488](https://github.com/rafaelaugustos/jolt/pull/488)). For ordered insertion, `joltDropHandle(zones)` puts the drag on a view inside the `joltDropSource` view, such as a grip; the source still moves. While a handle is on screen, the source's own drag is limited to its subviews, so the rest of the source keeps its buttons, gestures and scrolling, and the "Move to …" and "Return to origin" accessibility actions move from the source to the handle. `JoltDropTarget` takes `padding: JoltDropPadding`, which extends the reported frame per edge in points (0–1,000; other values throw before the target exists). Center and overlap both use the padded frame, through the same JoltCore hit test that the generated fixtures check against the TypeScript `dropHits`.

```swift
let board = try scope.retain(JoltDropZones([
    .init("backlog", label: "Backlog", padding: try .init(bottom: 60)),
    .init("done", label: "Done", padding: try .init(bottom: 60)),
], onDrop: { event in
    // Move the card's data into event.id; after this callback, board.cancel() clears the offset.
    nil
}))
// card.joltDropSource(board), with grip.joltDropHandle(board) inside the card
// column.joltDropTarget("done", in: board)
```

The position while moving is already published: `offset`, `hovered` and `dragging` let the application place a gap without a gesture of its own. The source's layout frame is measured outside the drag offset; when it changes during a drag, for example because a gap opens above the source, the offset is compensated so the source stays under the finger or pointer. A source view replaced while its container changes keeps the drop zones live: the newest view owns the frame, and the drop zones suspend only when no source view is visible, enabled and in an active scene. Cancellation returns the offset to zero, and reduced motion returns a rejected release at once. Web and NativeScript use the same contract through `drag.handle`, `onMove` and `padding` in [drop, cues and depth](./interaction-depth).

<Clip name="swiftui-character-handle-ios" caption="iOS simulator, native SwiftUI: actual touch input. The card body keeps its button, the grip drags, a gap opens above the card while it stays under the finger, a release below Done hits its 60 pt padding, the locked target rejects and reduced motion returns at once. Not a physical-device recording." />
<Clip name="swiftui-character-handle-macos" caption="macOS native SwiftUI: the same drop handle board with mouse drags and the Send button, captured from the native window. Physical trackpad gestures are not validated by this recording." />

## Finite particles and articulated rigs

`JoltParticles` is an optional Canvas renderer, with 1–2,000 live particles, 1–32 colors, 1–60,000 ms lifetime and 1–128 point size. `burst` and finite `emit` replace the current emission; rate is at most 1,000/second and emission plus lifetime is at most 60 seconds. Excess live population is rejected before replacement. Speed/range is 0–10,000 points/second, gravity ±10,000 points/second², spin ±3,600 degrees/second and spin range 0–3,600. Shape is circle, rectangle or ring; origin is center/top/bottom. A deterministic seed supports repeatable tests; it does not promise the same random sequence as Web.

```swift
let particles = try scope.retain(JoltParticles(.confetti))
// JoltParticlesView(particles).frame(width: 320, height: 330)
try particles.burst(count: 100, seed: 7)
particles.pause()
particles.play()
particles.cancel()
```

There is no clock before the first emission or after completion/cancel/disposal. Pause freezes particle ages. Resize affects new births while existing particles retain their origin. Late frames skip expired births instead of creating a backlog. System and view-level reduced motion suppress particles and terminate active emission. The Canvas is decorative, ignores hit testing and is hidden from accessibility; keep success/error feedback in semantic content. Return `JoltEffect { particles.cancel() }` from a timeline cue when reusing a borrowed emitter. The timeline must last long enough for the effect; completion also cleans owned effects. Web reuses existing Canvas `particles`/`confetti`, sharing ballistic equations but retaining its own population limits and random source.

`JoltRigDefinition` validates 1–64 parts, acyclic parents, up to 128 poses and 256 sockets. Each part declares fixed dimensions in (0,10,000] points, fractional pivot coordinates within ±10, optional rotation bounds and rest x/y/scaleX/scaleY/rotate. Translation/rotation is bounded to ±1,000,000, scale to ±100, including sampled spring output. Poses contain absolute channel targets; blending weights offset from rest, divide by `max(1, totalWeight)` per supplied channel and use shortest rotation for unbounded joints. Unknown parts, cycles, nonfinite weights and invalid destination matrices reject before animation changes.

```swift
let rig = try scope.retain(JoltRig(.init(
    parts: ["arm": .init(width: 95, height: 28, pivotX: 0, rotation: -90...30)],
    poses: ["rest": [:], "wave": ["arm": .init([.rotate: -65])]],
    sockets: ["hand": .init(part: "arm", x: 0.95, y: 0.5, relative: true)]
)))
try rig.pose("wave")
try rig.blend([.init("wave", weight: 0.5)])
// JoltRigView(rig, accessibilityLabel: "Companion") { name in ... }
// flower.joltRigSocket("hand", in: rig)
```

`JoltRigView` uses one Canvas with SwiftUI symbols. Put accessories in the same untransformed coordinate container; sockets transform through the full parent chain. The rig owns scalar channels/playback, while accessory views remain borrowed. Pause retains the pose; reduced motion settles the requested pose; scope disposal removes observations and clock work. Provide one meaningful accessibility label and separate semantic controls. No per-part hit testing, inverse kinematics, mesh deformation or physics is included. Web reuses `rig2d` and its DOM parent hierarchy: accessories must be direct children of their socket part, unlike the SwiftUI sibling-container placement.

<Clip name="swiftui-character-ios" caption="iOS simulator, native SwiftUI: weighted poses, flower socket attachment, cue-owned confetti, explicit cancellation and reduced motion. Canvas rendering; no physical-device performance claim." />
<Clip name="swiftui-character-macos" caption="macOS native SwiftUI: articulated poses and the same socket/effect lifecycle. Actual application playback, captured from the native window." />

## Browser acceptance

The packed React, Angular, Svelte and Solid consumers use the existing Web APIs under each framework's scope. The recordings show real browser interaction, mouse/keyboard alternatives, pose changes and Canvas particles. Chromium/Firefox/WebKit tests cover behavior and unmount cleanup. These are not NativeScript or physical touchscreen recordings; they establish functional coverage, not equal timing, pixels, memory or CPU across renderers.

<Clip name="web-characters-react" caption="React, Chromium: finite keyframes, mouse/keyboard interaction, rig sockets and cue-owned particles in a packed consumer." />
<Clip name="web-characters-angular" caption="Angular, Chromium: the same public Web capabilities and framework-owned cleanup; actual browser playback." />
<Clip name="web-characters-svelte" caption="Svelte, Chromium: bounded transforms, reorder/drop and character effects; actual browser playback." />
<Clip name="web-characters-solid" caption="Solid, Chromium: shared public Web contracts, accessible alternatives and owned effects; actual browser playback." />
