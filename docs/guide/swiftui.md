# Experimental SwiftUI

Use Jolt in an app written in Swift, without JavaScript or NativeScript. The initial Swift Package targets iOS 17+ and macOS 14+. It supports finite state-driven poses and 13 shared presets; it is not the complete Jolt engine. This source candidate is not in RC.12.1.

Use the reviewed source checkout as a local Swift Package in Xcode, or add this dependency and product to your application package. After publication, use a reviewed tag or commit containing Package.swift; older npm releases do not supply this package.

```swift
// Package.swift
.package(path: "../jolt")
// Application target dependencies:
.product(name: "JoltSwiftUI", package: "jolt")
```

```swift
import SwiftUI
import JoltSwiftUI

struct Card: View {
    @State private var moved = false
    private let target = try! JoltPose(x: 80, scale: 1.08, rotate: 12)
    var body: some View {
        Button("Jolt") { moved.toggle() }
            .padding(24)
            .joltMotion(to: moved ? target : .identity,
                        transition: .spring(.smooth))
    }
}
```

```swift
Text("Jolt").joltPreset(.popIn, active: visible)
Card().joltReduceMotion(true)
```

JoltPose is an immutable, validated target: x/y in points, scale/scaleX/scaleY unitless, rotate in degrees and opacity from 0 to 1. Invalid inputs throw before the existing target changes. JoltTransition accepts tween duration in milliseconds, a bounded cubic Bézier curve or a spring with positive mass, stiffness and damping. Named smooth/snappy/bouncy springs and the five basic curves are generated from the existing Jolt definitions.

SwiftUI owns interpolation, view identity, hit testing, interruption and removal. Assign another pose to retarget an existing view. Changing identity creates a new view; removing it ends its lifetime. Jolt creates no frame timer, scope or JavaScript runtime here. Do not animate these same modifiers from a second owner. Background changes are applied without starting a new animation; this API does not offer exact freeze/resume, seek, completion handles or an exit-presence coordinator.

The system Reduce Motion preference is always respected: new transform changes settle immediately; finite opacity transitions remain. `.joltReduceMotion(true)` requests this policy for a subtree and cannot disable the system preference. Changing a toggle is not a general imperative stop API. SwiftUI and browser interpolation need not produce identical pixels or timing.

`active` selects the starting or ending pose; it does not insert or remove a view. Supported names: fadeIn, fadeInUp, fadeInDown, fadeInLeft, fadeInRight, zoomIn, popIn, fadeOut, fadeOutUp, fadeOutDown, fadeOutLeft, fadeOutRight and zoomOut. Arbitrary keyframe sequences, gestures, sensors, drawing, timelines and inspector controls remain outside this first SwiftUI subset.

<Clip name="swiftui-ios" caption="Standalone SwiftUI app on an iPhone 17 Pro / iOS 27.0 simulator, driven by real XCTest touches: motion targets, identity changes, remount, accessibility, background and navigation. English UI; simulator evidence." />

<Clip name="swiftui-macos" caption="Standalone SwiftUI macOS app on this Mac, driven by actual XCTest mouse clicks: target changes, press, identity replacement, remount, Reduced Motion and shared presets. Only the demo window is recorded; no performance benchmark." />

<Clip name="web-preset" caption="Chromium on macOS: the existing Web popIn recipe plays with real browser execution. The Swift Package derives the same recipe definitions; the rendering engines and units differ." />
