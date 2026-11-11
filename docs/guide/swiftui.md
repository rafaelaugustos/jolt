# SwiftUI

Available in **0.1.0-rc.14 (Beta)** for iOS 17+ and macOS 14+, without NativeScript or JavaScript. Install the `JoltSwiftUI` product from the [`jolt-swift`](https://github.com/rafaelaugustos/jolt-swift) package repository, tag `v0.1.0-rc.14`. See [installation](./swiftui), [ownership](./swiftui-motion) and [interaction/geometry](./swiftui-geometry) for platform limits.

Add `https://github.com/rafaelaugustos/jolt-swift` as a Swift Package in Xcode and select exact version `0.1.0-rc.14`. It contains only the Swift package, generated from the Jolt repository at each release, so SwiftPM does not download the documentation media and benchmark results. Projects that already use `https://github.com/rafaelaugustos/jolt.git` keep resolving the same release tags, and a local checkout of the Jolt repository also works. Finite poses use SwiftUI interpolation; sampled values use a native clock activated on demand.

```swift
// Package.swift
.package(url: "https://github.com/rafaelaugustos/jolt-swift.git", exact: "0.1.0-rc.14")
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

## Activity, suspension and the clock

Since **0.1.0-rc.14** ([PR #488](https://github.com/rafaelaugustos/jolt/pull/488)). Every Jolt view and modifier reads one activity value, `joltActive`. On iOS it is true while the scene is active. On macOS it is true while the window that hosts the view is on screen: visible, not minimized and not fully covered, whether or not it is key and whether or not the app is frontmost. While it is false, motion holds and input contacts cancel; both resume when it returns. Apply `joltActivity()` to read the same value in your own views:

```swift
struct Status: View {
    @Environment(\.joltActive) private var active
    var body: some View { Text(active ? "Running" : "Held") }
}
// Container().joltActivity()
```

Measured on macOS 26.6.2 with the demo's activity lab (`testActivityExpansion`): a `WindowGroup` window keeps reading `scenePhase == .active` while another window is key, and windows hosted by `NSHostingView` or `NSHostingController` read `.background` while they are visible. That is why the Mac no longer follows the scene phase. Motion runs in all of them, in a `Settings` scene and in a `MenuBarExtra` window (`.window` style), and holds when the window is minimized or fully covered by another window. A view in an `NSHostingView` that is not in a window, or in a window that was never shown, does not run the clock.

The shared `JoltClock` keeps one display link per display that shows a visible Jolt window. A window on a 120 Hz display ticks at that display's rate, and a window moved to another display follows it; the demo measured 103–113 updates per second on a 120 Hz built-in display and 59 on the iOS simulator. The link stops while every window that hosts Jolt is hidden, minimized or covered, and before any Jolt view is hosted it uses the main display. Two displays with different rates were not available for these checks, so the display selection is covered by unit tests only.

`joltPointerFollow` receives hover only while the app is active. In a visible window of an app that is not frontmost it stays centred, and it follows the pointer again once the app is activated; motion keeps running in that window.

<Clip name="swiftui-activity-macos" caption="macOS 26.6.2, native SwiftUI, driven by XCTest: the main window keeps animating while a second window, NSHostingView and NSHostingController windows, Settings and a MenuBarExtra window take focus; the log records each window holding when minimized or covered and resuming. Only the main window is recorded." />

[Derived motion and retained graphics](./swiftui-advanced)

[SwiftUI · Keyframes / gestures / characters](./swiftui-characters)

[SwiftUI · Text entrance and rolling numbers](./swiftui-text)
