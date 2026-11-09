# SwiftUI

面向 iOS 17+ 和 macOS 14+ 的源码候选版，不依赖 NativeScript 或 JavaScript。这些 API 扩展了有限姿态动画，尚未发布到 RC.12.1。

在 Xcode 中把审核后的源码作为本地 Swift Package 添加。发布后选用包含 Package.swift 的已审核标签/提交；旧 npm 包不提供独立包。有限姿态使用 SwiftUI 插值；显式采样值使用按需启动的原生时钟。所有权和平台限制见[数值、交互与编排](./swiftui-motion)。

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

NativeScript 与 Web 共享 createPreset(name, parameters)；Apple 的 JoltPreset.recipe 使用生成定义。校验 distance、scale、direction、duration。显式 duration 把通道转换为有限 tween，零立即完成；默认值保留原弹簧。复制定义，不修改全局注册表。13 个可移植名称见安装指南。

`fadeIn`, `fadeInUp`, `fadeInDown`, `fadeInLeft`, `fadeInRight`, `zoomIn`, `popIn`, `fadeOut`, `fadeOutUp`, `fadeOutDown`, `fadeOutLeft`, `fadeOutRight`, `zoomOut`.

<Clip name="swiftui-ios" caption="iPhone 17 Pro / iOS 27.0 模拟器上的独立 SwiftUI 应用，使用真实 XCTest 触摸：目标变更、身份、重新挂载、无障碍、后台及导航。英文界面，模拟器证据。" />

<Clip name="swiftui-macos" caption="本机独立 SwiftUI macOS 应用，使用真实 XCTest 鼠标点击：目标、按压、身份替换、重新挂载、减少动态效果和共享 preset。仅录制 demo 窗口，不是性能基准。" />

<Clip name="web-preset" caption="macOS Chromium 中真实播放现有 Web popIn 配方。Swift Package 从相同定义生成，渲染引擎和单位仍然不同。" />

[派生运动与保留式图形](./swiftui-advanced)
