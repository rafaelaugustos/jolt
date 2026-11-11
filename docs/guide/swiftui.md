# SwiftUI

Available in **0.1.0-rc.13 (Beta)** for iOS 17+ and macOS 14+, without NativeScript or JavaScript. Install the `JoltSwiftUI` product from the [`jolt-swift`](https://github.com/rafaelaugustos/jolt-swift) package repository, tag `v0.1.0-rc.13`. See [installation](./swiftui), [ownership](./swiftui-motion) and [interaction/geometry](./swiftui-geometry) for platform limits.

Add `https://github.com/rafaelaugustos/jolt-swift` as a Swift Package in Xcode and select exact version `0.1.0-rc.13`. It contains only the Swift package, generated from the Jolt repository at each release, so SwiftPM does not download the documentation media and benchmark results. Projects that already use `https://github.com/rafaelaugustos/jolt.git` keep resolving `0.1.0-rc.13`, and a local checkout of the Jolt repository also works. Finite poses use SwiftUI interpolation; sampled values use a native clock activated on demand.

```swift
// Package.swift
.package(url: "https://github.com/rafaelaugustos/jolt-swift.git", exact: "0.1.0-rc.13")
// Application target dependencies:
.product(name: "JoltSwiftUI", package: "jolt-swift")
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

createPreset(name, parameters) is shared by NativeScript and Web. JoltPreset.recipe uses generated definitions on Apple. distance, scale, direction and duration are validated; an explicit duration converts channels to finite tweens (zero settles immediately), while defaults preserve canonical springs. Definitions are copied, never mutate the global registry. The 15 portable entry/exit names are listed in the installation guide.

`fadeIn`, `fadeInUp`, `fadeInDown`, `fadeInLeft`, `fadeInRight`, `zoomIn`, `popIn`, `flipInX`, `flipInY`, `fadeOut`, `fadeOutUp`, `fadeOutDown`, `fadeOutLeft`, `fadeOutRight`, `zoomOut`.

<Clip name="swiftui-ios" caption="Standalone SwiftUI app on an iPhone 17 Pro / iOS 27.0 simulator, driven by real XCTest touches: motion targets, identity changes, remount, accessibility, background and navigation. English UI; simulator evidence." />

<Clip name="swiftui-macos" caption="Standalone SwiftUI macOS app on this Mac, driven by actual XCTest mouse clicks: target changes, press, identity replacement, remount, Reduced Motion and shared presets. Only the demo window is recorded; no performance benchmark." />

<Clip name="web-preset" caption="Chromium on macOS: the existing Web popIn recipe plays with real browser execution. The Swift Package derives the same recipe definitions; the rendering engines and units differ." />

[Derived motion and retained graphics](./swiftui-advanced)

[SwiftUI · Keyframes / gestures / characters](./swiftui-characters)
