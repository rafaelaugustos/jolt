# SwiftUI

Source candidate for iOS 17+ and macOS 14+, without NativeScript or JavaScript. These APIs extend the finite pose modifiers; they are not in RC.12.1.

Use the reviewed source checkout as a local Swift Package in Xcode. After publication, select a reviewed tag/commit containing Package.swift; old npm releases do not supply the standalone package. Finite pose modifiers use SwiftUI interpolation; explicit sampled values use a demand-driven native clock. See [values, interaction and composition](./swiftui-motion) for ownership and platform limits.

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
    var body: some View {
        Button("Jolt") { moved.toggle() }
            .joltMotion(to: moved ? try! JoltPose(x: 80, scale: 1.08) : .identity,
                        transition: .spring(.smooth))
    }
}
```

createPreset(name, parameters) is shared by NativeScript and Web. JoltPreset.recipe uses generated definitions on Apple. distance, scale, direction and duration are validated; an explicit duration converts channels to finite tweens (zero settles immediately), while defaults preserve canonical springs. Definitions are copied, never mutate the global registry. The 13 portable entry/exit names are listed in the installation guide.

`fadeIn`, `fadeInUp`, `fadeInDown`, `fadeInLeft`, `fadeInRight`, `zoomIn`, `popIn`, `fadeOut`, `fadeOutUp`, `fadeOutDown`, `fadeOutLeft`, `fadeOutRight`, `zoomOut`.

<Clip name="swiftui-ios" caption="Standalone SwiftUI app on an iPhone 17 Pro / iOS 27.0 simulator, driven by real XCTest touches: motion targets, identity changes, remount, accessibility, background and navigation. English UI; simulator evidence." />

<Clip name="swiftui-macos" caption="Standalone SwiftUI macOS app on this Mac, driven by actual XCTest mouse clicks: target changes, press, identity replacement, remount, Reduced Motion and shared presets. Only the demo window is recorded; no performance benchmark." />

<Clip name="web-preset" caption="Chromium on macOS: the existing Web popIn recipe plays with real browser execution. The Swift Package derives the same recipe definitions; the rendering engines and units differ." />

[Derived motion and retained graphics](./swiftui-advanced)
