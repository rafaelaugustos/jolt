# SwiftUI: derived motion and retained graphics

Source candidate: see [combined values, native scroll, layout exits and keyed lists](./values-scroll-lists) for the next-RC additions and platform limits.

The remaining examples on this page describe the published RC.14 baseline unless explicitly marked as source candidates.

Available in **0.1.0-rc.14 (Beta)** for iOS 17+ and macOS 14+, without NativeScript or JavaScript. Install the `JoltSwiftUI` product from the [`jolt-swift`](https://github.com/rafaelaugustos/jolt-swift) package repository, tag `v0.1.0-rc.14`. See [installation](./swiftui), [ownership](./swiftui-motion) and [interaction/geometry](./swiftui-geometry) for platform limits.

JoltNumericMap accepts 2–1024 finite pairs with strictly monotonic input. Descending inputs are reversed. Clamp is the default; clamp:false extends the endpoint segments. sample returns value and slope, using the left derivative at an interior knot. JoltMappedValue borrows a scalar source and owns only its observation; pause freezes it, resume catches up, disposal detaches. Overflow marks valid=false and preserves the last finite output. No extra frame clock is created. The mapped view binding supports x/y, scale/scaleX/scaleY, rotate and opacity; decorative transforms remain at identity under Reduced Motion.

JoltColor stores sRGB ARGB bytes. mixed(to:progress:) and JoltColorValue use premultiplied OKLab with alpha, clamp progress to 0…1 and clip output to sRGB. Bind foreground or background with joltColor. The source owns animation; color disposal never destroys it. This is numerical color conformance, not a promise of identical display gamut or glyph pixels.

```swift
let scope = JoltScope()
let progress = try scope.value(0)
let mapped = try scope.retain(JoltMappedValue(progress,
    mapping: JoltNumericMap([0, 0.5, 1], [-100, 0, 100])))
let color = try scope.retain(JoltColorValue(progress,
    from: .init(argb: 0xff7766ff), to: .init(argb: 0xffdbff7a)))
try progress.animate(to: 1, transition: .tween(milliseconds: 1000))
// Text("Jolt").joltBind(.x, to: mapped).joltColor(.background, to: color)
```

JoltPropertyGroup borrows 1–1024 uniquely named scalar values on the same JoltClock. It validates the whole target dictionary before cancelling prior work, then starts the properties on one timeline. Unknown keys, non-finite values and disposed members reject without partial mutation. Replacement, cancellation and suspension coordinate the group; cancellation callbacks cannot overwrite a newer run. Partial target dictionaries are allowed. The group owns its playback, not its values. Use one coordinator per property lane.

Members left out of a partial dictionary keep their sampled value. Since 0.1.0-rc.14: when another writer takes a member (its own `animate`, `set`, `decay`, `cancel` or `dispose`, another group or a timeline), the whole run is cancelled at once, also while it is paused, and its completion reports `false` once. In 0.1.0-rc.13 a running group noticed on its next frame and a paused group only on `play()`. `cancel()` after completion keeps `.completed`. NativeScript and Web groups take 1–64 members and require every member in each command; SwiftUI groups take up to 1024 scalar values and accept partial dictionaries.

JoltMotionStates stores validated named target dictionaries and replaces transitions from sampled positions. JoltBehaviors adds finite property actions with priority, when, blocks, equal-priority replacement policy and an explicit rest action. Higher priority interrupts unless blocked; by default equal priority is rejected. Each request returns a run with status and cancel(). A stale run cannot cancel a replacement. Completion/cancel restores rest; stop() suppresses restoration; suspension and manual pause remain independent. This SwiftUI subset coordinates finite property targets, not arbitrary async application workflows. NativeScript/Web retain their broader guarded async behavior contexts.

```swift
let x = try scope.value(0), scale = try scope.value(1)
let group = try scope.retain(JoltPropertyGroup(["x": x, "scale": scale]))
let actions = try scope.retain(JoltBehaviors(group: group, definitions: [
    "rest": .init(["x": 0, "scale": 1]),
    "pet": .init(["x": -70, "scale": 1.1], priority: 1),
    "dress": .init(["x": 70, "scale": 0.9], priority: 2, blocks: ["eat"]),
    "eat": .init(["x": 0, "scale": 1.2], priority: 3)
], rest: "rest"))
let pet = try actions.request("pet")
try actions.request("dress")
// pet.status == .interrupted
```

JoltTimeline.seek(to:) accepts finite progress in 0…1, pauses playback, releases active effects and samples every owned channel without firing crossed cues. Later forward playback rearms cues after the new position. Seeking before a delayed track restores its initial value. A completed timeline may be sought again; cancellation/disposal is terminal. autoplay:false remains paused through a scope background cycle. Durations use milliseconds and remain bounded to 60 seconds; overlap on the same scalar is rejected.

```swift
let scene = try scope.retain(JoltTimeline(
    tracks: [.init(x, to: 100, transition: .tween(milliseconds: 1000))],
    autoplay: false
))
try scene.seek(to: 0.5)
scene.play()
let demand = try scope.retain(JoltRenderActivity(JoltRenderAdapter(
    change: { active in /* renderer.setContinuous(active) */ },
    redraw: { /* renderer.drawCommittedValues() */ }
)))
let observation = try demand.track(scene) // Retain with the model.
```

JoltMotionValue.decay uses the shared exponential velocity-retention equation, with velocity in points/second and friction per millisecond (default 0.998). It stops at the first finite bound, has a 60-second cap and supports interruption/pause/suspension. JoltDragModel(release:.inertia()) uses real gesture velocity and requires empty snaps; .snap remains the default. Bounds clamp direct manipulation and decay; the existing snap spring may overshoot. Event sampling differs from Web/native, so gesture release timing need not match exactly.

JoltPath accepts 2–1024 validated points within ±1,000,000. It removes consecutive duplicates, samples a polyline by arc length, clamps normalized progress and unwraps tangent degrees. A degenerate path stays at its point with zero rotation. joltPath binds position and optional orientation to a borrowed progress value. This adapter does not parse arbitrary SVG curves or morph paths; supply a finite polyline. The existing Web SVG path engine supports a broader grammar. Shared polyline fixtures verify positions and headings.

This polyline example remains supported. For typed quadratic/cubic segments and their bounds, see [measured geometry](./swiftui-geometry#quadratic-and-cubic-paths).

JoltDrawing retains up to 1024 vector shapes and 8192 geometry points/primitive units. Paths, rectangles and ellipses use local points; fill/stroke use JoltColor and line width is 0…1000. An entire update validates before replacement. JoltDrawingView uses one Canvas and a borrowed stroke-progress value; fills and geometry remain when animation pauses. dispose clears drawing resources; scope pause does not erase the drawing. This first adapter has one shared stroke progress, no per-item hit testing, SVG parser or automatic viewBox fitting. Provide an accessibility label for meaningful artwork.

JoltTextPaint validates 2–8 colors, matching ordered stops in 0…1, a clockwise angle and sheen width in (0,1]. JoltGradientText lays out real accessible Text and clips a finite optional sheen to its glyphs. The caller owns the progress value: animate 0→1 or 1→0, pause/cancel or dispose through a scope. There is no automatic infinite loop. Reduced Motion and inactive scenes hide sheen while preserving readable gradient text. Static gradient rasterization, font metrics and line wrapping remain platform-owned.

JoltViewportEntry observes actual native scroll/window intersection, not view construction. threshold is a visible-area fraction in 0…1 (zero still requires positive intersection). once preserves entry history for that controller; once:false replays after leaving and entering. Removal cancels playback and detaches native observers; remount may reuse history. Manual pause and scene suspension defer entry. Geometry checks account for native clipping ancestors but do not detect overlapping windows, overlays or visual occlusion; attach the modifier to an untransformed entrance region.

```swift
let route = try JoltPath([.init(20, 80), .init(100, 20), .init(180, 80)])
let drawing = try scope.retain(JoltDrawing([
    .init(.path(route), stroke: .init(argb: 0xffdbff7a), lineWidth: 4)
]))
// JoltDrawingView(drawing, strokeProgress: progress, accessibilityLabel: "Route")
// Image(systemName: "paperplane.fill").joltPath(route, progress: progress, orient: true)
let entry = try scope.retain(JoltViewportEntry(threshold: 0.5, once: false))
// Text("Arrived").joltViewportEnter(entry)
```

JoltRenderActivity combines borrowed scalar/timeline playback and explicit hold() tokens through a JoltRenderAdapter. A child scope() shares the renderer and parent lifetime. Retain returned observations; disposing one removes demand without stopping borrowed animation. change(active) toggles only when aggregate demand changes; redraw() receives committed sampled/seeked values, including a final frame. Pause/suspension suppress demand and preserve manual pause. There is no polling or idle display-link subscription. Limits: 4096 observations/tokens and 1024 owners. The adapter owns actual rendering and combines demand with its own scene policy.

The Web equivalents already exist: value.to()/scope.map for numbers/colors, propertyGroup, motionStates, motionBehaviors, seekableTimeline + withTimelineCues, decay/drag release, SVG motion paths, drawBatch/shape, gradientText, viewportEnter and renderActivity. The React/Angular/Svelte/Solid motion setup owns these existing resources; no duplicate browser APIs were added. A state transition handle does not expose a playback clock for renderActivity.track; use an explicit bounded hold when integrating an adapter, or track a supported playback handle. Native/Web APIs retain their published lifecycle contracts and documented execution limits.

Validation includes generated numeric/color/decay/path fixtures from the existing TypeScript core, deterministic resource tests, actual XCTest interaction on iOS/macOS, and the installed npm consumer in Chromium/Firefox/WebKit. Recordings below show actual controls at original speed. They establish behavior, not CPU/PSS superiority or physical-device performance.

<Clip name="swiftui-dynamics-ios" caption="iPhone 17 Pro / iOS 27.0 simulator: actual XCTest touches. Mapping/color, property groups, states, behavior priority/rest and seek/render demand; English UI." />

<Clip name="swiftui-dynamics-macos" caption="macOS app on this Mac: real clicks demonstrate the same dynamics. Only the app window; English UI." />

<Clip name="swiftui-graphics-ios" caption="iOS 27.0 simulator: real drawing/path playback, finite text sheen, pause/resume, inertial drag and drawing disposal. English UI." />

<Clip name="swiftui-graphics-macos" caption="macOS app: actual controls and drag; retained Canvas, path orientation, glyph sheen and disposal. English UI; no performance benchmark." />

<Clip name="swiftui-viewport-ios" caption="iOS 27.0 simulator: actual scroll enters once/replay cards, exits, reenters and removes/remounts. English UI." />

<Clip name="swiftui-viewport-macos" caption="macOS app: actual scroll-wheel input, 50% entry threshold, once/replay and cleanup. English UI." />

<Clip name="web-advanced-react" caption="Chromium on macOS: actual React component owns mappings/color, groups, states/behaviors, seek/cues, drawing, sheen, inertia, viewport and rendering activity. English UI; existing Web backends." />

<Clip name="web-advanced-angular" caption="Chromium on macOS: actual Angular component owns mappings/color, groups, states/behaviors, seek/cues, drawing, sheen, inertia, viewport and rendering activity. English UI; existing Web backends." />

<Clip name="web-advanced-svelte" caption="Chromium on macOS: actual Svelte component owns mappings/color, groups, states/behaviors, seek/cues, drawing, sheen, inertia, viewport and rendering activity. English UI; existing Web backends." />

<Clip name="web-advanced-solid" caption="Chromium on macOS: actual Solid component owns mappings/color, groups, states/behaviors, seek/cues, drawing, sheen, inertia, viewport and rendering activity. English UI; existing Web backends." />

## Shimmer, loaders and circular reveal

Since **0.1.0-rc.14** ([PR #488](https://github.com/rafaelaugustos/jolt/pull/488)). Durations and geometry come from the same shared definition as the NativeScript and Web adapters (`src/core/loading.ts`, compiled into `JoltCore` and checked with generated fixtures).

JoltShimmer(duration:) takes a positive finite sweep in milliseconds, at most 60 000, default 1500, including the band entering and leaving the view. joltShimmer paints the Web's band: CSS angle 100°, white at opacity 0, 0.55 and 0 at 15, 50 and 85 %, moving linearly from one width left of the view to one width right. The band is composited with the view in one compositing group (`sourceAtop`), so it paints only where the content is opaque and is weighted by its alpha: translucent placeholders get a weaker sweep. Apply it to a container to sweep all of its skeleton shapes with one band; several views can show one shimmer in step. Use it on placeholder shapes rather than live platform views, which render inside that group.

JoltLoader(style:color:size:duration:) draws the geometry of the NativeScript iOS loader. Defaults: `.dots`, `#71717a`, 48 points, 1200 ms per cycle. Size must be in (0, 16 384] points and duration in (0, 60 000] milliseconds. JoltLoaderView centres a square whose side is the smaller of `size` and the space it is offered. Dots: three dots of 0.2 × side scaling 0.35 → 1 → 0.35 at 0, 30 and 60 % of the cycle. Bars: five bars 0.12 × side wide and 0.75 × side high, scaling vertically on the same keys. Ring: twelve dots of 0.16 × side fading from 1 to 0.2. Copies start `duration / 5` apart (dots, bars) or `duration / 12` (ring). Without `accessibilityLabel`, the loader is hidden from accessibility; label the busy control instead, for example "Saving".

Both are JoltResource objects; retain them in a JoltScope. They subscribe to JoltClock only while at least one view shows them in an active scene (iOS: the scene is active; macOS: the hosting window is visible) with full motion, and while neither paused nor suspended. There is no TimelineView and no idle timer. Leaving the screen, an inactive scene, `pause()` or scope suspension hold the current phase; showing it again continues. Under reduced motion (the system setting or `joltReduceMotion`) the shimmer band is hidden and loader copies keep a static pose: full-size dots and bars, ring dots at opacity 0.35. `state` reports `running`, `paused`, `suspended`, `idle` or `disposed`. Disposal releases the clock, the views draw nothing and later calls are ignored; tests check that the clock's `activeCount` returns to zero.

```swift
let scope = JoltScope()
let shimmer = try scope.retain(JoltShimmer())
let saving = try scope.retain(JoltLoader(.ring, size: 28))
let details = try scope.retain(JoltReveal(revealed: false))
// SkeletonRows().joltShimmer(shimmer)
// Text("Save").opacity(busy ? 0 : 1).overlay { if busy { JoltLoaderView(saving) } }
// Details().joltReveal(details)
try details.reveal(from: JoltPoint(40, 40)) { finished in
    // Move focus into the details here.
}
try details.conceal(to: JoltPoint(40, 40))
```

JoltReveal(revealed:) runs `reveal(from:duration:reducedMotion:completion:)` and `conceal(to:...)` on one surface shown with joltReveal. Origins are points in the view's local space from its top-left corner, the space a `.local` tap gesture reports, within ±1 000 000. Without an origin the circle is centred on the view, or keeps the current circle's centre while interrupting. A reveal grows to the farthest corner and a conceal shrinks to zero, ease-in-out over 0 to 60 000 milliseconds (default 400); zero applies the end state at once. A new call starts from the circle on screen, so a conceal can reverse a reveal mid-way; the replaced call completes with `false`. Concealing a concealed surface completes with `true` at once. `cancel()` stops and restores the phase from before the interrupted chain. A resize retargets the farthest corner.

When a reveal ends, the circular clip is removed: the modifier keeps a non-clipping placeholder so the content keeps its identity and state, and shadows or overflow are no longer clipped. When a conceal ends, the view becomes transparent and keeps its layout space. Leaving the screen, an inactive scene, `pause()` and suspension hold the circle; showing it again continues. Under reduced motion, or with `reducedMotion: true`, the end state applies immediately and completion reports `true`.

Only a fully revealed surface (`interactive == true`, phase `.revealed`) receives hits and appears to accessibility. While revealing, concealing or concealed, the content is `accessibilityHidden` and not hit-testable, so taps reach the views behind it. Jolt never moves focus: the application moves VoiceOver or keyboard focus into the content after a reveal completes, and out of it before calling `conceal`, for example with `@AccessibilityFocusState` or `@FocusState`. SwiftUI exposes hidden descendants of an explicit `.accessibilityElement(children: .contain)` container (observed on the iOS 27 simulator), so do not wrap the surface in one.

Platform differences: the NativeScript iOS shimmer masks the target so content outside the band dims to opacity 0.35, and the Web paints its band over the whole element box; SwiftUI paints the Web's band over opaque content only. The Web loader draws CSS boxes with its own proportions (dots 20 %, bars 12 × 65 %, a rotating 75 % arc) and an eased pulse, kept in the same shared definition; SwiftUI follows the native geometry. NativeScript and Web cancel a reveal when the view unloads or detaches; SwiftUI holds it off screen. The Web centres an interrupting reveal without an origin on the element; NativeScript and SwiftUI keep the current centre. NativeScript keeps the rectangular touch area during playback; SwiftUI ignores hits until fully revealed. These effects remain no-ops on NativeScript Android.

## Gradient surfaces and blur

Since **0.1.0-rc.14** ([PR #488](https://github.com/rafaelaugustos/jolt/pull/488)). JoltGradient(colors:stops:angle:) paints a linear gradient with the Web's limits: 2–8 colours, one stop per colour, constant stops in 0...1 and in order, a finite CSS angle in degrees (default 180 runs top to bottom, 90 left to right). The line crosses the centre and is long enough for the corners to receive the first and last colours; bands stay square to the angle in points on boxes of any shape. Each component is a constant or a borrowed source: `JoltNumberSource.value(JoltMotionValue)` for stops and the angle, `JoltColorSource.value(JoltColorValue)` for colours. Animate the gradient by animating those values, with their transitions, springs, interruption, pause and completion; the gradient has no tracks of its own. Bound stops are clamped to 0...1 and kept in order without reordering colours, like the portable gradient projection. `update(colors:stops:angle:)` validates every component before replacing any and keeps the colour count; create a new gradient to change it.

`joltGradient(_:in:)` paints the gradient behind the view inside the shape you pass (default `Rectangle()`); the content itself is not clipped. The paint is not hit-testable and is hidden from accessibility. `frame` holds the painted colours, projected stops and angle.

JoltBlur(amount:radius:) has the Web's meaning: the applied radius is `amount × radius` points, with `amount` in 0...1 (a constant, or a bound value clamped to 0...1) and `radius` in 1...64, default 24. joltBlur applies SwiftUI's `blur(radius:opaque: false)` to the view and its descendants, so edges fade into transparency. SwiftUI owns the kernel; pixels are not identical to CSS `filter: blur()`.

Gradients and blur follow their sources only while a view shows them in an active scene and neither is paused or suspended. Leaving the screen, an inactive scene, `pause()` or suspension hold the last frame; showing or resuming catches up. Neither subscribes to JoltClock; the bound values own their playback. Under reduced motion, bound angles, stops and blur amounts show their motion value's target, while colours keep following their values. Disposal stops following, removes the paint from every view and rejects later updates. Sources are borrowed and never disposed by the paint.

```swift
let angle = try scope.value(135), stop = try scope.value(0.3), tone = try scope.value(0)
let tint = try scope.retain(JoltColorValue(tone,
    from: .init(argb: 0xff7766ff), to: .init(argb: 0xffff9dce)))
let aurora = try scope.retain(JoltGradient(
    colors: [.constant(.init(argb: 0xff1b1f3a)), .value(tint), .constant(.init(argb: 0xffdbff7a))],
    stops: [0, .value(stop), 1], angle: .value(angle)))
let focus = try scope.value(0)
let soft = try scope.retain(JoltBlur(amount: .value(focus), radius: 24))
// Card().joltGradient(aurora, in: RoundedRectangle(cornerRadius: 22))
// Photo().joltBlur(soft)
try angle.animate(to: 315, transition: .tween(milliseconds: 1600))
try focus.animate(to: 1, transition: .tween(milliseconds: 700))
```

Platform differences: the Web and NativeScript gradients also have radial and conic types with a centre and radius, and their own `animate()`, `set()` and `bind()`; SwiftUI provides the linear surface, driven by bound values and `update()`. Under reduced motion the Web holds bound geometry instead of showing its target, and NativeScript jumps the angle to its end while colours and stops still fade. Backdrop blur is not provided: SwiftUI has no radius-controlled filter over the content behind a view, and its materials apply a system-defined blur and tint rather than `amount × radius`. Blur a dedicated background view instead, as with Android's content blur. The NativeScript iOS blur is a `UIVisualEffectView` material where 0.5 is half of the material transition; SwiftUI and the Web use a radius.

Validation includes fixtures generated from the TypeScript core for loader geometry, shimmer offsets, reveal radii, easing and stop projection; deterministic resource tests for clock ownership, suspension, reduced motion, interruption and disposal; rendering tests for the gradient corners, the shimmer's alpha mask and the reveal clip; and XCTest interaction on iOS and macOS.

<Clip name="swiftui-effects-ios" caption="iOS simulator, native SwiftUI: XCTest taps sweep skeleton rows, run dots, bars and ring loaders in busy buttons, reveal a surface from tapped points and conceal it mid-way, sweep a bound gradient, blur a card and switch on reduced motion. English UI. Not a physical-device recording." />

<Clip name="swiftui-effects-macos" caption="macOS app, native SwiftUI: real clicks drive the same effects lab, including the interrupted reveal and reduced motion. Only the app window; English UI. No performance claim." />
