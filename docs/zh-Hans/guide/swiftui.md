# SwiftUI

**0.1.0-rc.13（测试版）**支持 iOS 17+ 和 macOS 14+，无需 NativeScript 或 JavaScript。从软件包仓库 [`jolt-swift`](https://github.com/rafaelaugustos/jolt-swift) 的标签 `v0.1.0-rc.13` 安装 `JoltSwiftUI` 产品。平台限制请参阅[安装](./swiftui)、[生命周期](./swiftui-motion)和[交互与几何](./swiftui-geometry)。

在 Xcode 中将 `https://github.com/rafaelaugustos/jolt-swift` 添加为 Swift Package，并选择精确版本 `0.1.0-rc.13`。该仓库只包含 Swift 软件包，每次发布时从 Jolt 仓库生成，因此 SwiftPM 不会下载文档媒体和基准测试结果。已使用 `https://github.com/rafaelaugustos/jolt.git` 的项目仍可解析 `0.1.0-rc.13`，也可使用 Jolt 仓库的本地检出。有限姿态采用 SwiftUI 插值；采样值采用按需运行的原生时钟。

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

NativeScript 与 Web 共享 createPreset(name, parameters)；Apple 的 JoltPreset.recipe 使用生成定义。校验 distance、scale、direction、duration。显式 duration 把通道转换为有限 tween，零立即完成；默认值保留原弹簧。复制定义，不修改全局注册表。13 个可移植名称见安装指南。

`fadeIn`, `fadeInUp`, `fadeInDown`, `fadeInLeft`, `fadeInRight`, `zoomIn`, `popIn`, `fadeOut`, `fadeOutUp`, `fadeOutDown`, `fadeOutLeft`, `fadeOutRight`, `zoomOut`.

<Clip name="swiftui-ios" caption="iPhone 17 Pro / iOS 27.0 模拟器上的独立 SwiftUI 应用，使用真实 XCTest 触摸：目标变更、身份、重新挂载、无障碍、后台及导航。英文界面，模拟器证据。" />

<Clip name="swiftui-macos" caption="本机独立 SwiftUI macOS 应用，使用真实 XCTest 鼠标点击：目标、按压、身份替换、重新挂载、减少动态效果和共享 preset。仅录制 demo 窗口，不是性能基准。" />

<Clip name="web-preset" caption="macOS Chromium 中真实播放现有 Web popIn 配方。Swift Package 从相同定义生成，渲染引擎和单位仍然不同。" />

## 活动状态、挂起与时钟

所有 Jolt 视图和修饰符都读取同一个活动值 `joltActive`。在 iOS 上，场景处于活动状态时它为真。在 macOS 上，承载该视图的窗口在屏幕上时它为真：窗口可见、未最小化、未被完全遮挡，无论它是否为关键窗口、应用是否在最前面。它为假时，运动保持不动，输入接触被取消；它恢复后两者都会继续。在自己的视图中使用 `joltActivity()` 读取同一个值：

```swift
struct Status: View {
    @Environment(\.joltActive) private var active
    var body: some View { Text(active ? "运行中" : "已暂停") }
}
// Container().joltActivity()
```

在 macOS 26.6.2 上用 demo 的活动实验室（`testActivityExpansion`）测得：另一个窗口成为关键窗口时，`WindowGroup` 窗口仍读到 `scenePhase == .active`；由 `NSHostingView` 或 `NSHostingController` 承载的窗口即使可见也读到 `.background`。因此 Mac 不再跟随场景阶段。运动在这些窗口中都会运行，也会在 `Settings` 场景和 `MenuBarExtra` 窗口（`.window` 样式）中运行；窗口被最小化或被其他窗口完全遮挡时保持不动。不在窗口中的 `NSHostingView` 里的视图，或从未显示过的窗口里的视图，不会驱动时钟。

共享的 `JoltClock` 为每个显示着可见 Jolt 窗口的显示器保留一个 display link。位于 120 Hz 显示器上的窗口按该显示器的刷新率推进，移到另一台显示器的窗口会随之切换；demo 在 120 Hz 内建显示器上测得每秒 103–113 次更新，在 iOS 模拟器上为 59 次。所有承载 Jolt 的窗口都隐藏、最小化或被遮挡时，link 停止；在任何 Jolt 视图被承载之前，它使用主显示器。这些检查没有两台不同刷新率的显示器可用，因此显示器选择只由单元测试覆盖。

`joltPointerFollow` 只在应用处于活动状态时接收悬停。在不在最前面的应用的可见窗口中，它保持居中，应用被激活后重新跟随指针；该窗口中的运动继续运行。

[派生运动与保留式图形](./swiftui-advanced)

[SwiftUI · Keyframes / gestures / characters](./swiftui-characters)

[SwiftUI · 文字入场与滚动数字](./swiftui-text)
