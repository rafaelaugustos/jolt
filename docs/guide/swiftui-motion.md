# SwiftUI values, interaction and composition

Available in **0.1.0-rc.13 (Beta)** for iOS 17+ and macOS 14+, without NativeScript or JavaScript. Install the `JoltSwiftUI` product from the repository tag `v0.1.0-rc.13`. See [installation](./swiftui), [ownership](./swiftui-motion) and [interaction/geometry](./swiftui-geometry) for platform limits.

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

JoltMotionValue publishes sampled value, target, velocity and playback state on the main actor. animate replaces from the current position and spring velocity; set jumps and cancels. Invalid targets leave existing playback intact. pause/play and suspend/resume are distinct; cancel freezes, dispose prevents reuse. joltBind supports x/y (points), scale/scaleX/scaleY, rotate (degrees), opacity (0–1). One owner per property; do not layer another implicit animation on a sampled binding. System Reduce Motion settles imperative motion; pass reducedMotion for your application policy too. There is no independent RenderThread or JavaScript-blocking immunity claim.

JoltPresence retains a stable child through exit, disables hit testing/accessibility while leaving and cancels stale removal on reentry. Use the same identity; active in joltPreset only selects an endpoint. JoltPressStyle is a native ButtonStyle and preserves keyboard, disabled and accessibility actions. joltPointerFollow reports local normalized x/y in −1…1; attach it to an untransformed region and animate its child. Hover ends, inactivity and reduced motion reset it. Touch-only devices remain centered. JoltDragModel clamps direct manipulation and snap targets to explicit point bounds; the settling spring can overshoot. New drags begin at the sampled position. Adjustable accessibility actions move between snaps; pause, scene suspension and disposal cancel active gestures.

JoltTimeline owns one clock subscription for finite tracks, with duration ≤60 s, ≤10,000 tracks and ≤1,024 unique named cues. Tracks for one value must not overlap. sequence uses solved durations; stagger offsets starts. A replaced property cancels the coordinated run. A cue can return a JoltEffect wrapping application sound/haptic/particles: pause/resume/cancel are forwarded and cleanup runs on settlement. No audio or haptic device is acquired implicitly. Late cues skip after 50 ms by default; catchUp is explicit. Reduced motion settles targets and skips effects. Cancellation suppresses later cues, including reentrant callbacks.

joltSharedLayout uses stable IDs in one SwiftUI Namespace; joltLayout(value:) animates the structural update. It does not bridge windows or unrelated view trees. JoltScrollView reads actual native scroll offset/extent; JoltScrollProgress optionally maps an explicit point range. joltScrollLinked maps poses without a second interpolation. Reduced motion keeps decorative transforms at from while opacity follows progress. Scroll ownership detaches its native observations on removal.

JoltInspector(development:true, capacity:40) is opt-in and DEBUG-only. Retain watch observations; dropping them detaches diagnostics. JoltInspectorPanel exposes sampled values, targets, state, scope resource count and clock clients, with pause/play/cancel. History is bounded (1–4096); no polling timer or GPU presentation measurement. Release builds do not attach observers.

createPreset(name, parameters) is shared by NativeScript and Web. JoltPreset.recipe uses generated definitions on Apple. distance, scale, direction and duration are validated; an explicit duration converts channels to finite tweens (zero settles immediately), while defaults preserve canonical springs. Definitions are copied, never mutate the global registry. The 13 portable entry/exit names are listed in the installation guide.

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

[Derived motion and retained graphics](./swiftui-advanced)
