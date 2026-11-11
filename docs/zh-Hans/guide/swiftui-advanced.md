# SwiftUI：派生运动与保留式图形

**0.1.0-rc.13（测试版）**支持 iOS 17+ 和 macOS 14+，无需 NativeScript 或 JavaScript。从软件包仓库 [`jolt-swift`](https://github.com/rafaelaugustos/jolt-swift) 的标签 `v0.1.0-rc.13` 安装 `JoltSwiftUI` 产品。平台限制请参阅[安装](./swiftui)、[生命周期](./swiftui-motion)和[交互与几何](./swiftui-geometry)。

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

部分字典中未列出的成员保持其采样值。仅在源码中，0.1.0-rc.13 不包含：当其他写入方接管某个成员（该值自己的 `animate`、`set`、`decay`、`cancel` 或 `dispose`、另一个组或 timeline）时，整个运行会立即取消，暂停中也一样，完成回调只报告一次 `false`。在 0.1.0-rc.13 中，运行中的组要到下一帧才发现，暂停的组要到 `play()` 才发现。完成后再调用 `cancel()` 会保持 `.completed`。NativeScript 与 Web 的组接受 1–64 个成员，并要求每个命令提供全部成员；SwiftUI 组最多接受 1024 个标量值，并允许部分字典。

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

## 微光、加载指示器与圆形揭示 {#shimmer-loaders-and-circular-reveal}

等待 [PR #488](https://github.com/rafaelaugustos/jolt/pull/488) 合并并发布；0.1.0-rc.13 尚未包含。时长与几何来自 NativeScript 和 Web 适配器共用的同一份定义（`src/core/loading.ts`，编译进 `JoltCore`，并用生成的 fixture 校验）。

JoltShimmer(duration:) 接受一个正的有限扫过时长（毫秒），最多 60 000，默认 1500，包含光带进入和离开视图。joltShimmer 绘制 Web 的光带：CSS 角度 100°，在 15、50、85 % 处为不透明度 0、0.55、0 的白色，从视图左侧一个宽度处线性移动到右侧一个宽度处。光带与视图在同一个合成组中合成（`sourceAtop`），因此只在内容不透明的地方绘制，并按其 alpha 加权：半透明的占位符得到较弱的扫光。把它应用到容器上，就能用一条光带扫过所有骨架形状；多个视图可以同步显示同一个微光。请用在占位形状上，而不是正在使用的原生平台视图上，它们会在该合成组内渲染。

JoltLoader(style:color:size:duration:) 绘制 NativeScript iOS 加载指示器的几何。默认值：`.dots`、`#71717a`、48 点、每个周期 1200 ms。尺寸必须在 (0, 16 384] 点内，时长在 (0, 60 000] 毫秒内。JoltLoaderView 居中绘制一个正方形，边长取 `size` 与所给空间中较小者。圆点：三个 0.2 × 边长的圆点，在周期的 0、30、60 % 处缩放 0.35 → 1 → 0.35。条形：五根宽 0.12 × 边长、高 0.75 × 边长的条，按相同关键帧纵向缩放。圆环：十二个 0.16 × 边长的圆点，从 1 淡到 0.2。各副本依次相隔 `duration / 5`（圆点、条形）或 `duration / 12`（圆环）启动。没有 `accessibilityLabel` 时，加载指示器对辅助功能隐藏；请为忙碌中的控件加标签，例如“正在保存”。

两者都是 JoltResource；请用 JoltScope 持有。只有当至少一个视图在活跃场景中（iOS：场景处于活跃状态；macOS：宿主窗口可见）以完整动效显示它们，且未暂停、未挂起时，它们才订阅 JoltClock。没有 TimelineView，也没有空闲定时器。离开屏幕、场景不活跃、`pause()` 或作用域挂起都会保持当前相位；再次显示时继续。减少动态效果时（系统设置或 `joltReduceMotion`），微光光带隐藏，加载副本保持静态姿态：圆点和条形为完整尺寸，圆环圆点不透明度为 0.35。`state` 报告 `running`、`paused`、`suspended`、`idle` 或 `disposed`。释放后会交还时钟，视图不再绘制，之后的调用被忽略；测试会检查时钟的 `activeCount` 回到零。

```swift
let scope = JoltScope()
let shimmer = try scope.retain(JoltShimmer())
let saving = try scope.retain(JoltLoader(.ring, size: 28))
let details = try scope.retain(JoltReveal(revealed: false))
// SkeletonRows().joltShimmer(shimmer)
// Text("Save").opacity(busy ? 0 : 1).overlay { if busy { JoltLoaderView(saving) } }
// Details().joltReveal(details)
try details.reveal(from: JoltPoint(40, 40)) { finished in
    // 在这里把焦点移到详情内容。
}
try details.conceal(to: JoltPoint(40, 40))
```

JoltReveal(revealed:) 在用 joltReveal 显示的一个表面上执行 `reveal(from:duration:reducedMotion:completion:)` 和 `conceal(to:...)`。原点是视图本地空间中的点，从左上角起算，也就是 `.local` 点按手势报告的坐标空间，范围在 ±1 000 000 内。不给原点时，圆以视图为中心；打断时则保留当前圆的圆心。揭示会扩展到最远的角，隐藏会收缩到零，使用 ease-in-out，时长 0 到 60 000 毫秒（默认 400）；为零时立即应用最终状态。新的调用从屏幕上的当前圆开始，所以隐藏可以在中途反转揭示；被替换的调用以 `false` 完成。隐藏一个已隐藏的表面会立即以 `true` 完成。`cancel()` 停止并恢复被打断的这串调用开始前的阶段。尺寸改变时会重新计算最远的角。

揭示结束时会移除圆形裁剪：修饰符保留一个不裁剪的占位，让内容保持其标识与状态，阴影或溢出内容不再被裁剪。隐藏结束时，视图变为透明并保留其布局空间。离开屏幕、场景不活跃、`pause()` 和挂起都会保持圆；再次显示时继续。减少动态效果时，或传入 `reducedMotion: true` 时，立即应用最终状态，完成回调报告 `true`。

只有完全揭示的表面（`interactive == true`，阶段 `.revealed`）才接收点按并对辅助功能可见。揭示中、隐藏中或已隐藏时，内容处于 `accessibilityHidden` 且不参与命中测试，点按会传给它后面的视图。Jolt 从不移动焦点：应用应在揭示完成后把 VoiceOver 或键盘焦点移入内容，并在调用 `conceal` 之前把焦点移出，例如使用 `@AccessibilityFocusState` 或 `@FocusState`。SwiftUI 会暴露显式 `.accessibilityElement(children: .contain)` 容器中被隐藏的后代（在 iOS 27 模拟器上观察到），因此不要用这种容器包裹该表面。

平台差异：NativeScript iOS 的微光会遮罩目标，使光带外的内容变暗到不透明度 0.35，Web 在整个元素盒上绘制光带；SwiftUI 只在不透明内容上绘制 Web 的光带。Web 加载指示器用 CSS 盒绘制，有自己的比例（20 % 的圆点、12 × 65 % 的条形、旋转的 75 % 圆弧）和缓动脉冲，这些数值也保存在同一份共享定义中；SwiftUI 采用原生几何。NativeScript 和 Web 在视图卸载或分离时取消揭示；SwiftUI 在离屏时保持它。没有原点而打断揭示时，Web 以元素中心为圆心；NativeScript 和 SwiftUI 保留当前圆心。NativeScript 在播放期间保留矩形点按区域；SwiftUI 在完全揭示之前忽略点按。这些效果在 NativeScript Android 上仍然没有作用。

## 渐变表面与模糊 {#gradient-surfaces-and-blur}

等待 [PR #488](https://github.com/rafaelaugustos/jolt/pull/488) 合并并发布；0.1.0-rc.13 尚未包含。 JoltGradient(colors:stops:angle:) 以 Web 的限制绘制线性渐变：2–8 种颜色，每种颜色一个色标，常量色标在 0...1 内且有序，有限的 CSS 角度（度；默认 180 从上到下，90 从左到右）。渐变线穿过中心，长度足以让各角得到第一种和最后一种颜色；在任意形状的盒子上，色带都按点坐标与角度保持垂直。每个分量是常量或借用的来源：色标和角度用 `JoltNumberSource.value(JoltMotionValue)`，颜色用 `JoltColorSource.value(JoltColorValue)`。通过为这些值做动画来驱动渐变，可使用它们的过渡、弹簧、打断、暂停和完成回调；渐变自身没有轨道。绑定的色标被限制在 0...1 内并保持顺序，不会重新排列颜色，与可移植的渐变投影一致。`update(colors:stops:angle:)` 会先校验所有分量再替换，并保持颜色数量；要改变数量请创建新的渐变。

`joltGradient(_:in:)` 在视图背后、你传入的形状内绘制渐变（默认 `Rectangle()`）；内容本身不被裁剪。该绘制不参与命中测试，并对辅助功能隐藏。`frame` 保存绘制中的颜色、投影后的色标与角度。

JoltBlur(amount:radius:) 与 Web 含义相同：实际半径为 `amount × radius` 点，`amount` 在 0...1 内（常量，或被限制在 0...1 的绑定值），`radius` 在 1...64 内，默认 24。joltBlur 对视图及其子视图应用 SwiftUI 的 `blur(radius:opaque: false)`，边缘淡入透明。卷积核由 SwiftUI 决定；像素与 CSS `filter: blur()` 并不相同。

渐变与模糊只有在某个视图于活跃场景中显示它们、且未暂停未挂起时才跟随来源。离开屏幕、场景不活跃、`pause()` 或挂起都会保持最后一帧；再次显示或恢复时追上当前值。两者都不订阅 JoltClock；播放由绑定的值负责。减少动态效果时，绑定的角度、色标和模糊量显示其 motion value 的目标值，颜色仍然跟随其值。释放后停止跟随，从所有视图移除绘制，并拒绝之后的更新。来源是借用的，绘制从不释放它们。

```swift
let angle = try scope.value(135), stop = try scope.value(0.3), tone = try scope.value(0)
let tint = try scope.retain(JoltColorValue(tone,
    from: .init(argb: 0xff7766ff), to: .init(argb: 0xffff9dce)))
let aurora = try scope.retain(JoltGradient(
    colors: [.constant(.init(argb: 0xff1b1f3a)), .value(tint), .constant(.init(argb: 0xffdbff7a))],
    stops: [0, .value(stop), 1], angle: .value(angle)))
let focus = try scope.value(0)
let soft = try scope.retain(JoltBlur(amount: .value(focus), radius: 24))
// Card().joltGradient(aurora, in: RoundedRectangle(cornerRadius: 22))
// Photo().joltBlur(soft)
try angle.animate(to: 315, transition: .tween(milliseconds: 1600))
try focus.animate(to: 1, transition: .tween(milliseconds: 700))
```

平台差异：Web 和 NativeScript 的渐变还有带中心与半径的径向、锥形类型，以及各自的 `animate()`、`set()`、`bind()`；SwiftUI 提供线性表面，由绑定值和 `update()` 驱动。减少动态效果时，Web 保持绑定的几何而不显示目标值，NativeScript 让角度跳到终点，颜色和色标仍会渐变。不提供背景（backdrop）模糊：SwiftUI 没有可按半径控制、作用于视图背后内容的滤镜，其材质使用系统定义的模糊与色调，而不是 `amount × radius`。请改为模糊一个专用的背景视图，与 Android 的内容模糊相同。NativeScript iOS 的模糊是 `UIVisualEffectView` 材质，0.5 表示材质过渡的一半；SwiftUI 和 Web 使用半径。

验证包括：由 TypeScript 核心生成的 fixture，覆盖加载指示器几何、微光偏移、揭示半径、缓动与色标投影；关于时钟所有权、挂起、减少动态效果、打断与释放的确定性资源测试；针对渐变角点、微光 alpha 遮罩与揭示裁剪的渲染测试；以及 iOS 和 macOS 上的 XCTest 交互。

<Clip name="swiftui-effects-ios" caption="iOS 模拟器，原生 SwiftUI：XCTest 点按让骨架行扫光，在忙碌按钮中运行圆点、条形和圆环加载指示器，从点按位置揭示表面并在中途隐藏，扫动绑定的渐变，模糊卡片并开启减少动态效果。英文界面。不是实体设备录制。" />

<Clip name="swiftui-effects-macos" caption="macOS 应用，原生 SwiftUI：真实点击操作同一个效果实验页，包括被打断的揭示和减少动态效果。仅应用窗口；英文界面。不涉及性能结论。" />
