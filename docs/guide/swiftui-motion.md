# SwiftUI values, interaction and composition

Available in **0.1.0-rc.13 (Beta)** for iOS 17+ and macOS 14+, without NativeScript or JavaScript. Install the `JoltSwiftUI` product from the [`jolt-swift`](https://github.com/rafaelaugustos/jolt-swift) package repository, tag `v0.1.0-rc.13`. See [installation](./swiftui), [ownership](./swiftui-motion) and [interaction/geometry](./swiftui-geometry) for platform limits.

JoltScope retains owned resources. Use .joltScope(scope) on one view boundary to suspend while offscreen or inactive, then resume. Suspension preserves manual pause. The model owns disposal: dispose() destroys resources; reset() clears them while leaving the scope reusable. A resource has one scope owner. Bindings and followers borrow their values; disposing a follower never destroys its source. Keep owners in @StateObject, not inside body.

```swift
@MainActor final class CardModel: ObservableObject {
    let scope = JoltScope()
    let x: JoltMotionValue
    init() { x = try! scope.value(0) }
    func move() { try! x.animate(to: 100, transition: .spring(.bouncy)) }
}
struct Card: View {
    @StateObject private var model = CardModel()
    var body: some View {
        Button("Move", action: model.move)
            .joltBind(.x, to: model.x)
            .buttonStyle(JoltPressStyle())
            .joltScope(model.scope)
    }
}
```

JoltMotionValue publishes sampled value, target, velocity and playback state on the main actor. animate replaces from the current position and spring velocity; set jumps and cancels. Invalid targets leave existing playback intact. pause/play and suspend/resume are distinct; cancel freezes, dispose prevents reuse. joltBind supports x/y (points), scale/scaleX/scaleY, rotate/rotateX/rotateY (degrees), opacity (0–1). One owner per property; do not layer another implicit animation on a sampled binding. System Reduce Motion settles imperative motion; pass reducedMotion for your application policy too. There is no independent RenderThread or JavaScript-blocking immunity claim.

JoltPresence retains a stable child through exit, disables hit testing/accessibility while leaving and cancels stale removal on reentry. Use the same identity; active in joltPreset only selects an endpoint. JoltPressStyle is a native ButtonStyle and preserves keyboard, disabled and accessibility actions. joltPointerFollow reports local normalized x/y in −1…1; attach it to an untransformed region and animate its child. Hover ends, inactivity and reduced motion reset it. Touch-only devices remain centered. JoltDragModel clamps direct manipulation and snap targets to explicit point bounds; the settling spring can overshoot. New drags begin at the sampled position. Adjustable accessibility actions move between snaps; pause, scene suspension and disposal cancel active gestures.

JoltTimeline owns one clock subscription for finite tracks, with duration ≤60 s, ≤10,000 tracks and ≤1,024 unique named cues. Tracks for one value must not overlap. sequence uses solved durations; stagger offsets starts. A replaced property cancels the coordinated run. A cue can return a JoltEffect wrapping application sound/haptic/particles: pause/resume/cancel are forwarded and cleanup runs on settlement. No audio or haptic device is acquired implicitly. Late cues skip after 50 ms by default; catchUp is explicit. Reduced motion settles targets and skips effects. Cancellation suppresses later cues, including reentrant callbacks.

joltSharedLayout uses stable IDs in one SwiftUI Namespace; joltLayout(value:) animates the structural update. It does not bridge windows or unrelated view trees. JoltScrollView reads actual native scroll offset/extent; JoltScrollProgress optionally maps an explicit point range. joltScrollLinked maps poses without a second interpolation. It composes in the shared order (scale, rotateX, rotateY, rotate, then translation), like joltMotion and the Web; up to 0.1.0-rc.13 it translated before scaling, so a pose with both moved by translation × scale. Reduced motion keeps decorative transforms at from while opacity follows progress. Scroll ownership detaches its native observations on removal.

JoltInspector(development:true, capacity:40) is opt-in and DEBUG-only. Retain watch observations; dropping them detaches diagnostics. JoltInspectorPanel exposes sampled values, targets, state, scope resource count and clock clients, with pause/play/cancel. History is bounded (1–4096); no polling timer or GPU presentation measurement. Release builds do not attach observers.

createPreset(name, parameters) is shared by NativeScript and Web. JoltPreset.recipe uses generated definitions on Apple. distance, scale, direction and duration are validated; an explicit duration converts channels to finite tweens (zero settles immediately), while defaults preserve canonical springs. Definitions are copied, never mutate the global registry. The 15 portable entry/exit names, including flipInX and flipInY, are listed in the installation guide.

```ts
import { createPreset } from '@rafaelaugusto/jolt/web'
const recipe = createPreset('fadeInUp', { distance: 48, duration: 350 })
// runtime.animate(element, recipe.keyframes, recipe.transition)
// NativeScript: import createPreset from '@rafaelaugusto/jolt'.
```

```swift
let recipe = JoltPreset.fadeInUp.recipe(
    try! JoltPresetParameters(distance: 48, duration: 350)
)
JoltPresence(visible, enter: recipe) { Text("Jolt") }
```

Web already supplies motionValue, springValue, map, pointerFollow, drag, scrollLinked, sequence, timeline cues, sharedLayout and the inspector. The new framework scopes own those existing resources: React useMotion, Angular JoltMotionDirective, Svelte motion and Solid motion. See [framework adapters](./web-frameworks). No second browser animation engine. Numerical conformance does not imply identical pixels, native threads or performance.

Acceptance: shared generated spring/recipe fixtures; ownership, interruption, cue and inspector tests; actual XCTest clicks, drags and scrolling on iOS and macOS; packed SSR/hydration and interactions in Chromium, Firefox and WebKit. CI runs the native interaction suite. Hardware performance and physical-device validation remain separate.

<Clip name="swiftui-interaction-ios" caption="iPhone 17 Pro / iOS 27.0 simulator: actual XCTest touches demonstrate retained presence, press, bounded drag and Reduced Motion. Touch-only pointer fallback; English UI." />

<Clip name="swiftui-interaction-macos" caption="macOS app on this Mac: actual mouse/hover/drag, presence interruption and snap settlement. Only the app window is recorded; English UI." />

<Clip name="swiftui-composition-ios" caption="iOS 27.0 simulator: sampled springs, interruption, sequences, stagger, named cues/cancellation, shared layout and the development inspector. Actual XCTest interaction; English UI." />

<Clip name="swiftui-composition-macos" caption="macOS app: sampled values, cue cleanup, sequential/staggered motion, shared layout and inspector. Actual clicks; no GPU or CPU benchmark." />

<Clip name="swiftui-scroll-ios" caption="iOS 27.0 simulator: real scrolling changes progress/header, then Reduced Motion removes decorative transforms. English UI." />

<Clip name="swiftui-scroll-macos" caption="macOS app: actual scroll-wheel input and native offset observation; Reduced Motion keeps the header stable. English UI." />

<Clip name="web-expansion-react" caption="Chromium on macOS, React DOM: actual pointer, drag, presence, scoped values, cues, layout and scroll. The same resource contract is tested in all four framework adapters." />

## Depth and shadow

Pending merge and publication in [PR #488](https://github.com/rafaelaugustos/jolt/pull/488); not in 0.1.0-rc.13. `JoltPose` takes `rotateX` and `rotateY` in degrees next to `rotate`, validated the same way (finite). Every Jolt view composes in the Web's order: scale, rotateX, rotateY, rotate, then translation, around the centre of its untransformed frame. Animating one axis keeps the other's angle, and an interrupted axis continues from its sampled value. `joltBind` accepts `.rotateX` and `.rotateY`; `joltBind([.rotateX: rx, .rotateY: ry])` binds several values under one projection, with `scale` multiplying `scaleX`/`scaleY`. Bind both axes in that one call: two separate depth bindings project twice and the inner one ends up orthographic. Property groups, states and keyframes drive the bound values. `JoltPreset.flipInX` and `flipInY` are generated from the shared recipes, and `createPreset` on the Web and NativeScript accepts them with the same parameters.

`.joltPerspective(600)` declares a distance in points, 1–100,000; `JoltPerspective(distance:)` validates a computed value and throws, and a literal outside the range stops with a precondition. The distance reaches the nearest Jolt view below it that can rotate on X or Y (`joltMotion`, `joltPreset`, `JoltPresence`, `joltScrollLinked`, `joltViewportEnter`, the multi-value `joltBind`, and a single or mapped rotateX/rotateY binding). That view projects with it and hides it from its own content, so a tilting child is orthographic unless it declares its own. Other bindings, and a `JoltPressStyle` whose poses have no rotateX/rotateY, pass the distance through. The vanishing point is the centre of each view's own untransformed frame, like NativeScript. On the Web it is the centre of the container with CSS `perspective`, so the two coincide when the view is centred in its container; translation moves the surface across that fixed point, as on the Web. Without a declared perspective, rotateX and rotateY are orthographic, like the Web without `perspective`: rotateY 60° shows the view at half its width. The distance is not animated; a change applies on the next frame. A surface whose near edge reaches the eye is not supported: CSS clips it, `JoltProjection.corners` throws for it, and Jolt does not define what SwiftUI draws.

JoltCore computes the projection (`JoltProjection.matrix` and `JoltProjection.corners`) from the measured size, and a SwiftUI geometry effect applies it, so layout does not change. Generated fixtures from the CSS transform and perspective matrices cover three surfaces, eight poses, orthographic and 300/800/2400 points, and two surfaces that pass the eye. The Swift tests compare JoltCore and the transform the effect actually returns against them, and the depth lab's UI test reads the projected frames at each distance.

Hit testing and the accessibility frame follow the projected shape. In the lab's UI test on the iOS simulator, a tap inside the layout frame but outside the tilted card does nothing, and a tap above the layout frame on the card's near edge presses it; the accessibility frame is the projected bounding box. `joltSharedLayout`, `joltLayout`, `joltDrag`, `joltDropSource` and `joltPointerFollow` measure untransformed frames or global positions, so they are not supported on or under a view that rotates on X or Y, or under a declared perspective. The Web rejects them there; SwiftUI modifiers cannot throw, and Jolt does not detect the case. Put them on an untransformed wrapper and tilt a child. Rigs and `JoltGestureModel` stay two-dimensional, like the shared rig channels.

`JoltShadow(opacity:radius:x:y:)` is one outer shadow: opacity 0–1, radius ≥ 0, offsets in points, all finite and within ±10¹². The radius is the number the Web and NativeScript iOS call `shadowRadius`; the Web draws it as a CSS blur of 2 × radius. The colour is fixed: `joltMotion(to:shadowColor:)`, `joltScrollLinked`, `joltViewportEnter` and `JoltPressStyle` default to black, and the colour's alpha multiplies the opacity. `JoltPose.shadow` animates with the pose's transform transition, so `y` and the shadow share one spring; a pose without a shadow interpolates from a transparent one without blur or offset. `joltShadow(rest, color:opacity:radius:x:y:)` binds any of the four channels to a `JoltMotionValue`. A bound channel replaces the rest value, and removing the binding shows the declared rest value again. Bound samples and spring overshoot are clamped like the shared decoration channels: opacity to 0–1, radius to ≥ 0. The shadow is drawn inside the view's transform, like a CSS box-shadow, and SwiftUI draws it for every visible shape of the content, so give the view an opaque background shape. Presets and `JoltPresence` recipes carry no shadow. Pick the colour per appearance in the app; the lab checks light and dark.

Reduce Motion settles rotateX, rotateY and the four shadow channels immediately, like the other transforms, while opacity keeps its transition. This matches the native adapter, where decorations jump to their end and only opacity and colours animate. Bindings show their targets under `joltReduceMotion`; an inactive scene settles `joltMotion`, and a scope suspends its values. Pixels are not identical: SwiftUI, Core Animation and browsers rasterize shadows and projected edges differently.

```swift
let rest = try! JoltShadow(opacity: 0.2, radius: 3, y: 2)
let raised = try! JoltShadow(opacity: 0.42, radius: 18, y: 16)
VStack {
    TiltCard()
        .joltBind([.rotateX: model.rotateX, .rotateY: model.rotateY])
    LiftCard()
        .joltMotion(
            to: lifted ? try! JoltPose(y: -18, shadow: raised) : try! JoltPose(shadow: rest),
            transition: .spring(.bouncy))
}
.joltPerspective(600)
```

See [Web depth channels](./interaction-depth) for the browser contract.

<Clip name="swiftui-depth-ios" caption="iPhone 17 Pro / iOS 27.0 simulator, native SwiftUI: a card tilts on X and Y at 300 pt, 900 pt and without perspective, one axis is levelled mid-flight while the other holds, taps probe the projected hit area, a second card lifts with y and shadow on one spring, its shadow binding is removed, then Reduce Motion and the light appearance. Actual XCTest touches; not a physical-device recording." />

<Clip name="swiftui-depth-macos" caption="macOS app, native SwiftUI: the same tilt, perspective, hit-testing clicks, lift, Reduce Motion and light appearance with actual mouse clicks. Only the app window is recorded." />

[Derived motion and retained graphics](./swiftui-advanced)
