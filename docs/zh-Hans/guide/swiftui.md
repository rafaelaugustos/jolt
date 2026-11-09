# 实验性 SwiftUI

在纯 Swift 应用中使用 Jolt，无需 JavaScript 或 NativeScript。首个 Swift Package 支持 iOS 17+ 和 macOS 14+，提供有限状态驱动姿态及 13 个共享 preset，不是完整 Jolt 引擎。此源代码候选版本不在 RC.12.1 中。

在 Xcode 中添加已审查 checkout 作为本地 Swift Package，或使用下列依赖和 product。发布后应固定包含 Package.swift 的已审查标签或 commit；旧 npm 版本不提供此包。

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

JoltPose 是经过验证的不可变目标：x/y 使用点，scale/scaleX/scaleY 无单位，rotate 使用度，opacity 范围为 0–1。无效输入在替换目标前抛错。JoltTransition 支持毫秒 tween、经过验证的三次 Bézier 曲线或质量、刚度、阻尼均为正值的弹簧。smooth/snappy/bouncy 弹簧和五种基本曲线由现有 Jolt 定义生成。

SwiftUI 管理插值、视图身份、命中测试、中断和移除。给现有视图分配另一姿态即可改变目标；改变身份会创建新视图，移除视图会结束其生命周期。此实现不创建帧计时器、scope 或 JavaScript runtime。不要让第二个所有者同时修改这些 modifier。后台状态变更不启动新动画；此 API 不提供精确冻结/继续、seek、完成 handle 或退出 presence 协调。

始终尊重系统减少动态效果设置：新的 transform 变更立即到达目标，透明度仍保留有限过渡。`.joltReduceMotion(true)` 为子树请求相同策略，不能覆盖系统偏好将其关闭。切换该选项不是通用 stop API。SwiftUI 和浏览器的像素与时序可能不同。

`active` 选择起始或结束姿态，不负责插入或移除视图。支持 fadeIn、fadeInUp、fadeInDown、fadeInLeft、fadeInRight、zoomIn、popIn、fadeOut、fadeOutUp、fadeOutDown、fadeOutLeft、fadeOutRight 和 zoomOut。任意多段 keyframes、手势、传感器、绘图、timeline 和 inspector 控制不在首个 SwiftUI 子集中。

<Clip name="swiftui-ios" caption="iPhone 17 Pro / iOS 27.0 模拟器上的独立 SwiftUI 应用，使用真实 XCTest 触摸：目标变更、身份、重新挂载、无障碍、后台及导航。英文界面，模拟器证据。" />

<Clip name="swiftui-macos" caption="本机独立 SwiftUI macOS 应用，使用真实 XCTest 鼠标点击：目标、按压、身份替换、重新挂载、减少动态效果和共享 preset。仅录制 demo 窗口，不是性能基准。" />

<Clip name="web-preset" caption="macOS Chromium 中真实播放现有 Web popIn 配方。Swift Package 从相同定义生成，渲染引擎和单位仍然不同。" />
