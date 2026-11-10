# SwiftUI

**0.1.0-rc.13（测试版）**支持 iOS 17+ 和 macOS 14+，无需 NativeScript 或 JavaScript。从仓库标签 `v0.1.0-rc.13` 安装 `JoltSwiftUI` 产品。平台限制请参阅[安装](./swiftui)、[生命周期](./swiftui-motion)和[交互与几何](./swiftui-geometry)。

在 Xcode 中将仓库添加为 Swift Package，并选择精确版本 `0.1.0-rc.13`。也可使用本地检出。有限姿态采用 SwiftUI 插值；采样值采用按需运行的原生时钟。

```swift
// Package.swift
.package(url: "https://github.com/rafaelaugustos/jolt.git", exact: "0.1.0-rc.13")
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

NativeScript 与 Web 共享 createPreset(name, parameters)；Apple 的 JoltPreset.recipe 使用生成定义。校验 distance、scale、direction、duration。显式 duration 把通道转换为有限 tween，零立即完成；默认值保留原弹簧。复制定义，不修改全局注册表。13 个可移植名称见安装指南。

`fadeIn`, `fadeInUp`, `fadeInDown`, `fadeInLeft`, `fadeInRight`, `zoomIn`, `popIn`, `fadeOut`, `fadeOutUp`, `fadeOutDown`, `fadeOutLeft`, `fadeOutRight`, `zoomOut`.

<Clip name="swiftui-ios" caption="iPhone 17 Pro / iOS 27.0 模拟器上的独立 SwiftUI 应用，使用真实 XCTest 触摸：目标变更、身份、重新挂载、无障碍、后台及导航。英文界面，模拟器证据。" />

<Clip name="swiftui-macos" caption="本机独立 SwiftUI macOS 应用，使用真实 XCTest 鼠标点击：目标、按压、身份替换、重新挂载、减少动态效果和共享 preset。仅录制 demo 窗口，不是性能基准。" />

<Clip name="web-preset" caption="macOS Chromium 中真实播放现有 Web popIn 配方。Swift Package 从相同定义生成，渲染引擎和单位仍然不同。" />

[派生运动与保留式图形](./swiftui-advanced)

[SwiftUI · Keyframes / gestures / characters](./swiftui-characters)
