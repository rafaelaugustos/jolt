# SwiftUI: panels and measured geometry

Available in **0.1.0-rc.13 (Beta)** for iOS 17+ and macOS 14+, without NativeScript or JavaScript. Install the `JoltSwiftUI` product from the repository tag `v0.1.0-rc.13`. See [installation](./swiftui), [ownership](./swiftui-motion) and [interaction/geometry](./swiftui-geometry) for platform limits.

## In-app snap panels

`JoltSheetModel` owns a finite scalar spring and 1–32 unique snap points: `.points` in (0, 1,000,000], `.fraction` in (0, 1], or `.content`. Coordinates use Apple points, velocity points/second; Web uses CSS pixels. Snap heights clamp to the measured usable host. Declaration order breaks equal-distance release ties. Release projection uses 200 ms and velocity bounded to ±4,000; the settling spring retains the actual bounded release velocity.

`JoltBottomSheet` measures its host and content, supplies a handle and a `JoltScrollView`, disables/hides its own background from accessibility while open, and restores caller-owned focus through `returnFocus`. It is an in-app panel, not a system sheet or a window-wide modal/focus trap. Controls outside the component remain the application's responsibility. Do not wrap its content in another vertical scroll view.

```swift
let scope = JoltScope()
let panel = try scope.retain(JoltSheetModel(
    snaps: [.points(230), .fraction(0.85), .content]
))
// Keep the model in @StateObject; restore app focus in returnFocus.
JoltBottomSheet(panel, label: "Details", returnFocus: { openerFocused = true }) {
    Button("Open") { try? panel.open(.points(230)) }
} content: {
    TextField("Note", text: $note)
    Text("Your scrolling content")
}
```

`open`, `snapTo`, `expand`, `collapse` and `dismiss` select logical stops. Open may precede the first layout. Invalid geometry/stops fail before replacement; `dismissible: false` rejects programmatic and gesture dismissal. Handle drag interrupts the sampled spring. The body expands before scrolling; downward contact at the scroll origin hands off to the panel. After a contact changes the panel's stop, lift and start a new contact to scroll. The first adapter does not transfer momentum continuously between the scroll view and the spring.

The handle exposes only applicable Expand/Collapse/Dismiss accessibility actions; macOS supports focused arrows and Escape. iOS observes the actual bottom-edge keyboard overlap in host coordinates, so a host already resized by SwiftUI is not reduced twice. Floating keyboards do not count as bottom overlap; macOS has no soft-keyboard claim. Content, host and keyboard changes cancel an active contact and retarget the logical stop.

Pause freezes motion; scene suspension preserves manual pause. `cancel` freezes the current pose. The view suspends on removal; retain the model to remount it, or own it in `JoltScope` to dispose it with the feature. Reduced motion settles programmatic movement and retains direct input. Dispose removes subscriptions and blocks further opens.

<Clip name="swiftui-panel-ios" caption="iOS simulator: native panel drag, nested scroll, software keyboard, dismissal, reduced motion and remount. Not a physical device." />

<Clip name="swiftui-panel-macos" caption="Native macOS: panel mouse drag, scrolling, text entry and Escape/focus return. No soft-keyboard or trackpad claim." />

## Realized rows with measured heights

Set `measuresRows: true` to measure content rather than use the compatible fixed `rowHeight` contract. Keep up to 1,000 unique stable string IDs, 1–128 characters. The view realizes every row, enforces at least 44 points for its handle, and clips above 10,000 points; model measurements accept 24–10,000 points, spacing 0–100. This is not a virtualizer. Dynamic Type/text/layout can change measurements without rebuilding the API.

Pickup retains the contact's offset inside the measured row. Destination compares the dragged center with other row centers; preview does not commit application keys until release. A measurement change over 0.5 point, viewport resize, replacement, pause/background or removal cancels active input and edge scrolling without a commit. Programmatic moves, row accessibility actions and macOS arrow commands use the same stable-key commit. Reduced motion removes preview animation while preserving reorder. `replace` prunes removed measurements; a new row uses the fallback height until measured. Dispose releases input and edge work.

```swift
let order = try scope.retain(JoltReorderModel(
    ["one", "two", "three"], measuresRows: true
) { move in
    // Persist the controlled application order using move.key / move.beforeKey.
})
JoltReorderList(order) { key in
    Text(descriptions[key] ?? key).padding(12)
}
try order.replace(["three", "one", "two"])
```

## Quadratic and cubic paths

`JoltPath(from:segments:)` supports typed lines, quadratic and cubic Bézier segments, preserving the existing polyline initializer. Coordinates must be finite within ±1,000,000 points; use 1–1,024 segments. Adaptive subdivision is bounded to depth 18 and 8,192 vertices, with a 0.025-point geometric tolerance and tangent checks; an over-budget curve throws. This is approximate arc-length sampling, not exact analytic length, full SVG parsing or arbitrary path morphing.

Progress clamps to [0,1]. `orient: true` uses the curve tangent with continuous angle unwrapping; degenerate tangents use a neighboring chord, and a zero-length path stays still. Points are local offsets from the view's original center. A linear progress transition approximates constant travel speed; other easing intentionally changes speed. Cancellation, interruption, pause and disposal belong to the supplied motion value/scope. Reduced motion uses the target pose without a decorative traversal. Generated fixtures compare length, position and angle against the TypeScript SVG Q/C sampler.

```swift
let path = try JoltPath(from: .init(-125, 40), segments: [
    .quadratic(control: .init(-65, -100), to: .init(0, 0)),
    .cubic(control1: .init(65, 100), control2: .init(70, -100),
           to: .init(125, -40))
])
let progress = try scope.value(0)
// marker.joltPath(path, progress: progress, orient: true)
try progress.animate(to: 1,
    transition: .tween(milliseconds: 2400, ease: .linear),
    reducedMotion: reduceMotion)
// Retarget to 0 to reverse from the sampled position; cancel() freezes it.
```

<Clip name="swiftui-geometry-ios" caption="iOS simulator: quadratic/cubic travel, cancellation/reverse, measured row drag and dynamic text." />

<Clip name="swiftui-geometry-macos" caption="Native macOS: curved travel, measured reorder and dynamic content." />

## Existing Web backends and acceptance

The packed React/Angular/Svelte/Solid consumers use `scope.bottomSheet`, `scope.reorder` and `scope.animate(marker, { path: "M… Q… C…", orient: true }, transition)`. They add no second animation engine. The sheet handle is a focusable slider element; keep buttons/inputs inside the body available to normal interaction. Modal semantics, background inertness and focus placement are caller-owned. Call `remeasure()` when moving an in-page host relative to the viewport. Browser keyboard geometry depends on VirtualKeyboard/VisualViewport; desktop recordings do not establish mobile keyboard acceptance.

Web reorder now retains size/origin observation between drags after a completed FLIP. Changing text then dragging again remains valid; a size change during a drag still cancels without a commit. Removed rows/controller disposal release those geometry leases. Existing transform ownership checks remain in force. Web variable-size rows use the same center-comparison helper as the Swift numerical fixtures.

Actual XCTest interactions cover iOS simulator and native macOS; browser tests cover Chromium, Firefox and WebKit. The recordings show interactions and lifecycle, not physical iPhone/trackpad or performance equivalence. Mavis already has Sheet/reorder adapters; existing adoption [#234](https://github.com/getcortexlabs/mavis-ui/issues/234), [#237](https://github.com/getcortexlabs/mavis-ui/issues/237) and path recipes [#298](https://github.com/getcortexlabs/mavis-ui/issues/298) track the remaining integration/acceptance. SwiftUI is included in v0.1.0-rc.13.

<Clip name="web-geometry-react" caption="Chromium desktop, packed React consumer: panel, nested scroll/focus, Bézier travel and variable-height reorder. Existing Web backends; no mobile keyboard evidence." />

<Clip name="web-geometry-angular" caption="Chromium desktop, packed Angular consumer: panel, nested scroll/focus, Bézier travel and variable-height reorder. Existing Web backends; no mobile keyboard evidence." />

<Clip name="web-geometry-svelte" caption="Chromium desktop, packed Svelte consumer: panel, nested scroll/focus, Bézier travel and variable-height reorder. Existing Web backends; no mobile keyboard evidence." />

<Clip name="web-geometry-solid" caption="Chromium desktop, packed Solid consumer: panel, nested scroll/focus, Bézier travel and variable-height reorder. Existing Web backends; no mobile keyboard evidence." />
