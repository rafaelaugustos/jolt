# SwiftUI: derived motion and retained graphics

Source candidate for iOS 17+ and macOS 14+. Start with [installation](./swiftui) and [ownership and interaction](./swiftui-motion). These additions are pending publication; they are not in RC.12.1. The Swift Package runs without a JavaScript runtime.

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
