# SwiftUI：派生运动与保留式图形

面向 iOS 17+、macOS 14+ 的源码候选版。先阅读[安装](./swiftui)和[所有权与交互](./swiftui-motion)。这些功能尚待发布，不包含在 RC.12.1 中，无需 JavaScript runtime。

JoltNumericMap 接受 2–1024 对有限数值，输入必须严格单调；递减输入会反转。默认 clamp，clamp:false 外推端点线段。sample 返回数值与斜率，内部节点使用左导数。JoltMappedValue 借用标量，仅拥有观察：暂停冻结，恢复追上，dispose 解除。溢出令 valid=false 并保留最后有限值，不创建额外时钟。绑定支持 x/y、scale/scaleX/scaleY、rotate、opacity；减少动态效果时装饰变换保持单位状态。

JoltColor 保存 sRGB ARGB 字节。mixed(to:progress:) 和 JoltColorValue 使用带 alpha 的预乘 OKLab，进度限制 0…1，输出裁剪到 sRGB。joltColor 绑定前景或背景。动画由源拥有，销毁颜色不会销毁源。不承诺屏幕色域或字形像素一致。

```swift
let scope = JoltScope()
let progress = try scope.value(0)
let mapped = try scope.retain(JoltMappedValue(progress,
    mapping: JoltNumericMap([0, 0.5, 1], [-100, 0, 100])))
let color = try scope.retain(JoltColorValue(progress,
    from: .init(argb: 0xff7766ff), to: .init(argb: 0xffdbff7a)))
try progress.animate(to: 1, transition: .tween(milliseconds: 1000))
// Text("Jolt").joltBind(.x, to: mapped).joltColor(.background, to: color)
```

JoltPropertyGroup 借用 1–1024 个唯一命名且共享 JoltClock 的标量。先验证全部目标，再取消旧任务并用一个 timeline 启动。未知键、非有限值、已销毁成员不会造成部分修改。替换、取消、挂起共同协调；过期取消回调不能覆盖新任务。允许部分目标字典。组拥有 playback，不拥有数值；每组属性使用单一协调器。

JoltMotionStates 保存命名目标，从当前采样位置替换。JoltBehaviors 增加优先级、when、blocks、同优先级替换策略和显式 rest。更高优先级在未被阻挡时中断，默认拒绝同优先级。request 返回带 status/cancel() 的运行；旧运行不能取消新运行。完成/取消恢复 rest，stop() 不恢复。手动暂停与挂起独立。SwiftUI 子集协调有限属性目标，不执行任意异步业务流程；NativeScript/Web 保留更广的异步上下文。

```swift
let x = try scope.value(0), scale = try scope.value(1)
let group = try scope.retain(JoltPropertyGroup(["x": x, "scale": scale]))
let actions = try scope.retain(JoltBehaviors(group: group, definitions: [
    "rest": .init(["x": 0, "scale": 1]),
    "pet": .init(["x": -70, "scale": 1.1], priority: 1),
    "dress": .init(["x": 70, "scale": 0.9], priority: 2, blocks: ["eat"]),
    "eat": .init(["x": 0, "scale": 1.2], priority: 3)
], rest: "rest"))
let pet = try actions.request("pet")
try actions.request("dress")
// pet.status == .interrupted
```

JoltTimeline.seek(to:) 接受有限 0…1 进度，暂停并清理活跃效果，不触发跨过的命名事件。之后向前播放仅重置新位置之后的事件。移到延迟轨道之前会恢复初始值。已完成 timeline 可以重新 seek，取消/销毁则终止。autoplay:false 在 scope 后台周期后仍暂停。毫秒单位，最长 60 秒，同一标量轨道不可重叠。

```swift
let scene = try scope.retain(JoltTimeline(
    tracks: [.init(x, to: 100, transition: .tween(milliseconds: 1000))],
    autoplay: false
))
try scene.seek(to: 0.5)
scene.play()
let demand = try scope.retain(JoltRenderActivity(JoltRenderAdapter(
    change: { active in /* renderer.setContinuous(active) */ },
    redraw: { /* renderer.drawCommittedValues() */ }
)))
let observation = try demand.track(scene) // Retain with the model.
```

JoltMotionValue.decay 使用共享指数方程，速度为点/秒，friction 为每毫秒保留比例，默认 0.998。在第一个边界停止，最长 60 秒，支持中断、暂停、挂起。JoltDragModel(release:.inertia()) 使用真实手势速度且要求 snaps 为空；默认仍为 .snap。吸附弹簧可暂时越界，直接拖动/decay 受限。不同平台的速度采样不保证一致。

JoltPath 接受 ±1,000,000 内的 2–1024 个点，移除连续重复点，按折线弧长采样，限制进度并展开切线角度。退化路径停在原点且旋转为零。joltPath 借用进度绑定位置与可选方向。首版不解析通用 SVG 曲线，也不做路径 morph；Web 保留更广 SVG 语法。共享 fixtures 验证位置和切线。

折线示例仍然有效。类型化二次/三次曲线及其限制见[测量几何](./swiftui-geometry)。

JoltDrawing 保留最多 1024 个形状与 8192 个点/几何单元。路径、矩形、椭圆使用局部点，fill/stroke 用 JoltColor，线宽 0…1000。整体更新先验证再替换。JoltDrawingView 用一个 Canvas 与借用的描边进度，暂停仍保留填充与几何，dispose 清空。首版共享描边进度，不提供逐项点击、SVG parser 或自动 viewBox 适配；有意义的图形需提供辅助功能标签。

JoltTextPaint 验证 2–8 种颜色、0…1 有序 stops、顺时针角度和 (0,1] 光带宽度。JoltGradientText 保留真正可访问的 Text，把有限可选光带裁剪到字形。应用拥有进度，动画 0→1 或 1→0，并通过 scope 暂停/取消/销毁；不会创建无限循环。减少动态效果或非活跃场景隐藏光带，保留可读渐变文字。字体、换行与光栅化由平台决定。

JoltViewportEntry 观察真实原生滚动/窗口几何交集，而非视图创建。threshold 是 0…1 可见面积比例，零仍需正面积。once 保留控制器历史；once:false 离开后重入重播。移除会取消播放并解除原生观察，重新挂载可保留历史。暂停/挂起延迟进入。考虑祖先裁剪，不检测覆盖窗口、overlay 或视觉遮挡；用于未变换的进入区域。

```swift
let route = try JoltPath([.init(20, 80), .init(100, 20), .init(180, 80)])
let drawing = try scope.retain(JoltDrawing([
    .init(.path(route), stroke: .init(argb: 0xffdbff7a), lineWidth: 4)
]))
// JoltDrawingView(drawing, strokeProgress: progress, accessibilityLabel: "Route")
// Image(systemName: "paperplane.fill").joltPath(route, progress: progress, orient: true)
let entry = try scope.retain(JoltViewportEntry(threshold: 0.5, once: false))
// Text("Arrived").joltViewportEnter(entry)
```

JoltRenderActivity 通过 JoltRenderAdapter 汇总借用标量/timeline 和显式 hold()。子 scope() 共享 renderer 与父生命周期。保留返回观察，销毁只移除需求，不停止借用动画。change(active) 只在合计需求改变时触发；redraw() 读取已提交采样，包括最终帧/seek。暂停/挂起保留手动暂停。无轮询或空闲 display link；最多 4096 观察/token、1024 所有者。适配器负责实际渲染并结合场景策略。

Web 已有数值/颜色 value.to()/scope.map、propertyGroup、motionStates、motionBehaviors、seekableTimeline + withTimelineCues、decay/drag release、SVG 路径、drawBatch/shape、gradientText、viewportEnter、renderActivity。四框架 motion setup 拥有现有资源，不复制 API。状态过渡 handle 不暴露 renderActivity.track 所需时钟；使用显式有限 hold 或受支持 playback。NativeScript/Web 继续遵循已发布生命周期和执行限制。

验证包含 TypeScript core 生成的数值/颜色/decay/path fixtures、确定性资源测试、真实 iOS/macOS XCTest 和 Chromium/Firefox/WebKit 中安装后的 npm 消费者。以下录像展示原速真实交互，不证明 CPU/PSS 优势或物理设备性能。

<Clip name="swiftui-dynamics-ios" caption="iPhone 17 Pro / iOS 27.0 模拟器：真实 XCTest 触摸，映射/颜色、属性组、状态、优先级/rest、seek/渲染需求。英文界面。" />

<Clip name="swiftui-dynamics-macos" caption="本机 macOS 应用：真实点击展示相同动态能力。仅应用窗口；英文界面。" />

<Clip name="swiftui-graphics-ios" caption="iOS 27.0 模拟器：真实绘图/路径、有限字形光带、暂停/恢复、惯性拖动与销毁。英文界面。" />

<Clip name="swiftui-graphics-macos" caption="macOS 应用：真实控制和拖动，保留 Canvas、路径方向、光带和清理。英文界面；非性能基准。" />

<Clip name="swiftui-viewport-ios" caption="iOS 27.0 模拟器：真实滚动展示 once/replay、离开、重入、卸载和重挂载。英文界面。" />

<Clip name="swiftui-viewport-macos" caption="macOS 应用：真实滚轮、50% 阈值、once/replay 与清理。英文界面。" />

<Clip name="web-advanced-react" caption="macOS 上的 Chromium：真实 React 组件拥有映射/颜色、组、状态/行为、seek/事件、绘图、光带、惯性、viewport 与渲染需求。英文界面；使用现有 Web 后端。" />

<Clip name="web-advanced-angular" caption="macOS 上的 Chromium：真实 Angular 组件拥有映射/颜色、组、状态/行为、seek/事件、绘图、光带、惯性、viewport 与渲染需求。英文界面；使用现有 Web 后端。" />

<Clip name="web-advanced-svelte" caption="macOS 上的 Chromium：真实 Svelte 组件拥有映射/颜色、组、状态/行为、seek/事件、绘图、光带、惯性、viewport 与渲染需求。英文界面；使用现有 Web 后端。" />

<Clip name="web-advanced-solid" caption="macOS 上的 Chromium：真实 Solid 组件拥有映射/颜色、组、状态/行为、seek/事件、绘图、光带、惯性、viewport 与渲染需求。英文界面；使用现有 Web 后端。" />
