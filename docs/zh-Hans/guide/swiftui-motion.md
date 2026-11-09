# SwiftUI：数值、交互与编排

面向 iOS 17+ 和 macOS 14+ 的源码候选版，不依赖 NativeScript 或 JavaScript。这些 API 扩展了有限姿态动画，尚未发布到 RC.12.1。[安装](./swiftui)。

JoltScope 保留其拥有的资源。在一个视图边界上使用 .joltScope(scope)，在离屏或场景不活跃时挂起，恢复时保留手动暂停状态。模型负责 dispose() 销毁；reset() 清空后可重用。每个资源只能有一个 scope 所有者。绑定和跟随器借用数值，销毁跟随器不会销毁源。使用 @StateObject 保存所有者，不要在 body 中创建。

```swift
@MainActor final class CardModel: ObservableObject {
    let scope = JoltScope()
    let x: JoltMotionValue
    init() { x = try! scope.value(0) }
    func move() { try! x.animate(to: 100, transition: .spring(.bouncy)) }
}
struct Card: View {
    @StateObject private var model = CardModel()
    var body: some View {
        Button("Move", action: model.move)
            .joltBind(.x, to: model.x)
            .buttonStyle(JoltPressStyle())
            .joltScope(model.scope)
    }
}
```

JoltMotionValue 在主 actor 上发布采样值、目标、速度和状态。animate 从当前采样位置及弹簧速度接替；set 跳转并取消。无效目标保留原动画。pause/play 与 suspend/resume 独立；cancel 冻结，dispose 禁止重用。joltBind 支持点单位 x/y、无单位 scale/scaleX/scaleY、角度 rotate 和 0–1 opacity。同一属性只有一个所有者，不要叠加隐式插值。系统减少动态效果会立即到达目标；应用策略也应传入 reducedMotion。没有独立 RenderThread，也不承诺抵抗 JavaScript 阻塞。

JoltPresence 在退出中保留身份，禁用点击与辅助功能，并在重新进入时取消过期删除。joltPreset 的 active 仅选择端点。JoltPressStyle 保留原生 Button 的键盘、禁用和辅助功能语义。joltPointerFollow 输出局部 −1…1 坐标；放在未变换的区域上，动画作用于子视图。离开、后台和减少动态效果会居中；纯触摸设备保持居中。JoltDragModel 限制直接拖动和吸附目标，弹簧收敛时可能暂时越界。再次拖动从采样位置开始。辅助功能调整动作在吸附点间移动；暂停、挂起和销毁取消手势。

JoltTimeline 用一个时钟订阅运行有限轨道：最多 60 秒、10,000 条轨道和 1,024 个唯一命名事件。同一数值轨道不可重叠。sequence 使用求解时长；stagger 错开起点。属性被替换时取消整个运行。事件可返回 JoltEffect，适配应用的音频、触觉或粒子，并转发暂停、恢复和清理；不会隐式获取硬件。默认跳过迟到超过 50 ms 的事件，catchUp 需显式选择。减少动态效果直接应用目标且跳过副作用；取消后不会再触发事件，包括重入回调。

joltSharedLayout 在同一个 Namespace 内使用稳定 ID；joltLayout(value:) 动画化结构变化。不跨窗口或独立视图树。JoltScrollView 读取真实原生滚动偏移；JoltScrollProgress 可指定点单位范围。joltScrollLinked 直接映射姿态，无第二层插值。减少动态效果时装饰变换保持 from，透明度仍跟随进度。卸载时移除原生观察。

JoltInspector(development:true, capacity:40) 需要主动启用且仅在 DEBUG 观察。保留 watch 返回的观察对象，释放即解除诊断。JoltInspectorPanel 显示采样值、目标、状态、资源与时钟客户数，并提供 pause/play/cancel。历史限制为 1–4096，无轮询计时器，也不是 GPU 呈现测量。Release 不连接观察者。

NativeScript 与 Web 共享 createPreset(name, parameters)；Apple 的 JoltPreset.recipe 使用生成定义。校验 distance、scale、direction、duration。显式 duration 把通道转换为有限 tween，零立即完成；默认值保留原弹簧。复制定义，不修改全局注册表。13 个可移植名称见安装指南。

```ts
import { createPreset } from '@rafaelaugusto/jolt/web'
const recipe = createPreset('fadeInUp', { distance: 48, duration: 350 })
// runtime.animate(element, recipe.keyframes, recipe.transition)
// NativeScript: import createPreset from '@rafaelaugusto/jolt'.
```

```swift
let recipe = JoltPreset.fadeInUp.recipe(
    try! JoltPresetParameters(distance: 48, duration: 350)
)
JoltPresence(visible, enter: recipe) { Text("Jolt") }
```

Web 已有 motionValue、springValue、map、pointerFollow、drag、scrollLinked、sequence、时间线事件、sharedLayout 与 inspector。新的框架 scope 拥有这些现有资源：React useMotion、Angular JoltMotionDirective、Svelte/Solid motion。见[框架适配](./web-frameworks)。不创建第二套浏览器引擎；数值一致不代表像素、线程或性能一致。

验证包括共享弹簧/配方 fixtures、所有权/中断/事件/诊断测试、iOS/macOS 上的真实 XCTest 操作，以及 Chromium、Firefox、WebKit 中安装包的 SSR/水合交互。CI 运行原生交互测试。物理设备与硬件性能验证仍单独跟踪。

<Clip name="swiftui-interaction-ios" caption="iPhone 17 Pro / iOS 27.0 模拟器：真实 XCTest 触摸展示保留、按压、拖动与减少动态效果。纯触摸无悬停；英文界面。" />

<Clip name="swiftui-interaction-macos" caption="本机 macOS 应用：真实鼠标、悬停、拖动、进出中断与吸附。仅录制应用窗口；英文界面。" />

<Clip name="swiftui-composition-ios" caption="iOS 27.0 模拟器：采样弹簧、序列、错峰、事件/取消、共享布局与诊断。真实 XCTest 操作；英文界面。" />

<Clip name="swiftui-composition-macos" caption="macOS 应用：采样值、事件清理、编排、布局与诊断。真实点击；不是 CPU/GPU 基准。" />

<Clip name="swiftui-scroll-ios" caption="iOS 27.0 模拟器：真实滚动改变进度与标题；减少动态效果稳定装饰变换。英文界面。" />

<Clip name="swiftui-scroll-macos" caption="macOS 应用：真实滚轮与原生偏移观察；减少动态效果稳定标题。英文界面。" />

<Clip name="web-expansion-react" caption="macOS 上的 Chromium / React DOM：真实交互与资源生命周期。同一合同在四个框架中验证。" />
