# Motion continuity and gesture relationships

**Source candidate, not included in 0.1.0-rc.15.** This batch covers [#497](https://github.com/rafaelaugustos/jolt/issues/497), [#502](https://github.com/rafaelaugustos/jolt/issues/502), [#503](https://github.com/rafaelaugustos/jolt/issues/503), [#504](https://github.com/rafaelaugustos/jolt/issues/504), [#505](https://github.com/rafaelaugustos/jolt/issues/505) and [#508](https://github.com/rafaelaugustos/jolt/issues/508). It does not publish a package or change the version. SwiftUI remains Beta on iOS 17+ and macOS 14+.

## Relationships between controllers {#gesture-relationships}

Create `gestureRelations()` after mounting idle controllers and before contact. `gesture` waits for `other` with `waitFor`; `simultaneous` permits both; `block` lets the target begin while the blocker is still possible, then cancels the target if the blocker recognizes. A blocked contact cannot restart. This makes block useful for cancelling press feedback when a carousel starts moving.

`gestures`, `drag`, `zoomable`, `bottomSheet`, `reorder` and the function returned by `press` expose endpoints. The default kind is `pan`, except `reorder` (`longPress`) and `press` (`tap`). Use `kind`/`otherKind` to select an enabled `pan`, `pinch`, `rotate`, `tap` or `longPress`. A sheet coordinates its internal pan; a zoomable coordinates its pan/pinch/tap. With `dismiss:false`, a photo at minimum scale fails its pan so a waiting sheet can move.

```ts
import { gestureRelations } from '@rafaelaugusto/jolt/web'
// NativeScript: import from '@rafaelaugusto/jolt'.
const links = gestureRelations([
  { gesture: sheet, other: photo, relation: 'waitFor', otherKind: 'pan' },
  { gesture: photo, kind: 'pinch', other: sheet, relation: 'block' },
])
// Before destroying or remounting the participating controllers:
links.dispose()
```

Setup accepts 1–128 links, rejects cycles across groups, self-links, incompatible runtimes, disabled channels, active contacts and simultaneous/ordered contradictions before installing links. Dispose the group to cancel participating input and remove its links. Disposing either controller also removes its relationships; recreate the group after a native unload/remount. Relationships borrow controllers and do not own their values or views.

UIKit uses removable delegate failure requirements and simultaneous-recognition policy, preserving the previous delegate. Android arbitrates in native touch dispatch; JavaScript does not decide recognition per frame. Web coordinates Jolt Pointer Events, fixes `touch-action` before contact and shares pointer capture for nested surfaces. Disposal restores the prior touch policy. Translated ancestors are supported by the composed surface; scaled/rotated/perspective ancestors remain outside its coordinate contract. Browser event timing and native recognizer thresholds can differ.

`nativeGestureRecognizer(native, kind)` is an optional NativeScript entry for an app-owned UIKit recognizer or Android `org.rafaelaugusto.jolt.GesturePeer`. Disposing that handle removes Jolt links without destroying the app's recognizer. It is not a wrapper for arbitrary Android detectors. Coordinate the originating zoom/drag controller for interactive navigation; OS edge-back and predictive-back recognizers are not endpoints of `sharedNavigationEntry()`.

## SwiftUI continuity and retained drawing {#swiftui-contracts}

`JoltTimelineTrack.velocity` accepts a finite override in the value's units/second. The first track at time zero, with implicit `from`, inherits the value's sampled velocity **when the timeline is constructed**. Paused/suspended sources contribute zero; explicit `from`, delayed tracks and later stages start at zero unless overridden. `sequence` uses the same resolved velocity to calculate stage durations. `autoplay:false` retains the construction snapshot. Seeking remains deterministic; cancellation releases ownership and pause/suspension remain independent.

`connectEdgeScroll` gives custom reorder grips the model's existing edge clock. Retain its `JoltObservation`; the callback receives -1/+1 and returns whether scrolling can continue. Supply actual row measurements, pointer/viewport coordinates and current scroll offset through the existing model methods. Replacing/disconnecting a viewport cancels the contact; disposing an older connection cannot detach its replacement. Suspension, item removal and model disposal stop edge work. Row actions can stay outside the grip.

`JoltParticles.emit(duration:nil)` keeps emitting until cancellation/disposal or Reduced Motion settles it. The default remains a finite 2000 ms emission. Rate is particles/second (0,1000], lifetime uses milliseconds and `ceil(rate × lifetime / 1000)` must fit capacity (1–2000). Live storage stays bounded; late frames skip expired births without replaying a backlog. Absolute birth identities remain stable across 60 seconds. Pause/suspension freeze elapsed time independently; `cancel()` clears the field, and disposal releases its clock. Geometry uses local points, velocity points/second, gravity points/second² and spin degrees/second.

`JoltSVGPath` accepts absolute/relative M/L/H/V/C/S/Q/T/A/Z, repeated coordinates and exponents. It normalizes to M/L/C/Q/Z, converts arcs to cubics and preserves subpaths/closure. Limits: 20,000 UTF-8 bytes, 256 normalized commands and coordinates within ±1,000,000. Shared TypeScript/Swift fixtures check normalization. `JoltPath` remains the separate measured movement-path API.

```swift
let replacement = try JoltTimeline(tracks: [
  .init(x, to: 120),                     // inherit current velocity
  .init(y, to: 40, velocity: -80)        // explicit units/second
])
let edge = try model.connectEdgeScroll { direction in
  scrollOneRow(direction)              // return false at the viewport boundary
}
// Retain edge alongside the custom viewport; call edge.dispose() on teardown.
try particles.emit(rate: 12, duration: nil, seed: 1)
let path = try JoltSVGPath("M10 10H90V90H10Z M35 35H65V65H35Z")
let drawing = try JoltDrawing([
  .init(.svg(path), fill: .init(argb: 0xffdbff7a),
        stroke: .init(argb: 0xff7766ff), lineWidth: 3,
        strokeStart: 0.1, strokeEnd: 0.9,
        lineCap: .square, lineJoin: .bevel, fillRule: .evenodd)
])
// JoltDrawingView(drawing, viewBox: try JoltViewBox(0, 0, 100, 100), accessibilityLabel: "Window")
try drawing.morphPath(at: 0, to: anotherCompatiblePath)
```

`JoltDrawingView` renders retained geometry in one Canvas. Fill rule is nonzero/evenodd; caps are butt/round/square and joins miter/round/bevel. Per-shape `strokeStart`/`strokeEnd` and optional view-wide values use 0…1 and intersect; an empty interval hides the stroke, not the fill. Line width uses drawing units, 0…1000. An explicit finite positive `viewBox` scales x/y independently to the viewport; it does not preserve aspect ratio automatically. Without it, coordinates are local points.

One morph runs per drawing. Paths must have the same normalized commands/subpaths; incompatible input rejects before cancelling existing work. Replacement samples the visible path at command time and preserves style. `pause`/`play`, `suspend`/`resume`, cancellation, scene inactivity, Reduced Motion and disposal use the existing clock lifecycle. Cancellation retains sampled geometry; disposal clears it. The previous `strokeProgress` initializer remains valid. No hit testing, arbitrary topology conversion or identical native/browser pixels are promised.

## Paused spring velocity {#paused-velocity}

Web `springValue.getVelocity()` and derivative graphs now report zero immediately while paused or the runtime is hidden, matching the native contract. Resume retains spring momentum; `stop()` clears it. Position stays frozen during pause. The fix also invalidates dependent values without introducing a new frame loop. Native recordings check the existing iOS/Android behavior.

## Platform evidence {#evidence}

Web already supports the equivalent timeline velocity, continuous emitters, SVG styling/morph and keyed reorder autoscroll. This batch reuses those APIs; see [Web orchestration](./web-orchestration), [Web effects](./web-effects) and [Web gestures](./web-gestures). The new Web behavior is cross-controller recognition and paused derivative propagation. Tests cover nested wait directions, press/carousel, swipe/reorder and photo/sheet on iOS, Android and Chromium; mouse policy and pause checks also run on Firefox/WebKit. Trusted multi-touch injection is Chromium-only. Recordings show behavior at original speed, not a hardware performance comparison.

<Clip name="gesture-relations-ios" caption="iPhone 17 Pro, iOS 27 simulator: real XCTest input shows both nested wait directions, press/carousel, swipe/reorder and photo/sheet. English UI." />

<Clip name="gesture-relations-android" caption="Pixel 7, Android API 36 emulator: real OS touch input shows the same recognition cases. Touch dots enabled; English UI." />

<Clip name="gesture-relations-web" caption="Chromium on macOS: actual mouse and trusted touch/pinch input; separate scenarios joined at original speed. English UI." />

<Clip name="spring-velocity-ios" caption="iOS 27 simulator: spring position freezes, direct and derived velocity become zero, then resume restores momentum. English UI." />

<Clip name="spring-velocity-android" caption="Android API 36 emulator: actual pause/resume input with zero paused velocity and derivative. English UI." />

<Clip name="spring-velocity-web" caption="Chromium on macOS: real pause/resume/stop input and derived velocity. English UI." />

<Clip name="swiftui-motion-contracts-ios" caption="iPhone 17 Pro, iOS 27 simulator: velocity replacement, SVG morph/trim, continuous particles past 60 seconds and custom-grip edge scrolling with row actions. Real XCTest input; original speed; English UI." />

<Clip name="swiftui-motion-contracts-macos" caption="macOS native app: actual clicks and drag demonstrate the same SwiftUI contracts, including more than 60 seconds of continuous particles. Original speed; English UI." />
