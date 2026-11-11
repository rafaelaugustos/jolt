# SwiftUI：数值、交互与编排

**0.1.0-rc.13（测试版）**支持 iOS 17+ 和 macOS 14+，无需 NativeScript 或 JavaScript。从软件包仓库 [`jolt-swift`](https://github.com/rafaelaugustos/jolt-swift) 的标签 `v0.1.0-rc.13` 安装 `JoltSwiftUI` 产品。平台限制请参阅[安装](./swiftui)、[生命周期](./swiftui-motion)和[交互与几何](./swiftui-geometry)。

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

JoltMotionValue 在主 actor 上发布采样值、目标、速度和状态。animate 从当前采样位置及弹簧速度接替；set 跳转并取消。无效目标保留原动画。pause/play 与 suspend/resume 独立；cancel 冻结，dispose 禁止重用。joltBind 支持点单位 x/y、无单位 scale/scaleX/scaleY、角度 rotate/rotateX/rotateY 和 0–1 opacity。同一属性只有一个所有者，不要叠加隐式插值。系统减少动态效果会立即到达目标；应用策略也应传入 reducedMotion。没有独立 RenderThread，也不承诺抵抗 JavaScript 阻塞。

JoltPresence 在退出中保留身份，禁用点击与辅助功能，并在重新进入时取消过期删除。joltPreset 的 active 仅选择端点。JoltPressStyle 保留原生 Button 的键盘、禁用和辅助功能语义。joltPointerFollow 输出局部 −1…1 坐标；放在未变换的区域上，动画作用于子视图。离开、后台和减少动态效果会居中；纯触摸设备保持居中。JoltDragModel 限制直接拖动和吸附目标，弹簧收敛时可能暂时越界。再次拖动从采样位置开始。辅助功能调整动作在吸附点间移动；暂停、挂起和销毁取消手势。

JoltTimeline 用一个时钟订阅运行有限轨道：最多 60 秒、10,000 条轨道和 1,024 个唯一命名事件。同一数值轨道不可重叠。sequence 使用求解时长；stagger 错开起点。属性被替换时取消整个运行。事件可返回 JoltEffect，适配应用的音频、触觉或粒子，并转发暂停、恢复和清理；不会隐式获取硬件。默认跳过迟到超过 50 ms 的事件，catchUp 需显式选择。减少动态效果直接应用目标且跳过副作用；取消后不会再触发事件，包括重入回调。

joltSharedLayout 在同一个 Namespace 内使用稳定 ID；joltLayout(value:) 动画化结构变化。不跨窗口或独立视图树。JoltScrollView 读取真实原生滚动偏移；JoltScrollProgress 可指定点单位范围。joltScrollLinked 直接映射姿态，无第二层插值。它按共享顺序组合（scale、rotateX、rotateY、rotate，最后平移），与 joltMotion 和 Web 一致；0.1.0-rc.13 及之前它先平移再缩放，因此同时带有两者的姿态会移动“平移 × 缩放”的距离。减少动态效果时装饰变换保持 from，透明度仍跟随进度。卸载时移除原生观察。

JoltInspector(development:true, capacity:40) 需要主动启用且仅在 DEBUG 观察。保留 watch 返回的观察对象，释放即解除诊断。JoltInspectorPanel 显示采样值、目标、状态、资源与时钟客户数，并提供 pause/play/cancel。历史限制为 1–4096，无轮询计时器，也不是 GPU 呈现测量。Release 不连接观察者。

NativeScript 与 Web 共享 createPreset(name, parameters)；Apple 的 JoltPreset.recipe 使用生成定义。校验 distance、scale、direction、duration。显式 duration 把通道转换为有限 tween，零立即完成；默认值保留原弹簧。复制定义，不修改全局注册表。15 个可移植名称（含 flipInX 和 flipInY）见安装指南。

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

## 深度与阴影 {#depth-and-shadow}

`JoltPose` 在 `rotate` 之外接受以度为单位的 `rotateX` 和 `rotateY`，校验方式相同（必须为有限值）。每个 Jolt 视图都按 Web 的顺序组合：缩放、rotateX、rotateY、rotate，最后平移，围绕其未变换框架的中心。动画一个轴时保留另一个轴的角度；被中断的轴从采样值继续。`joltBind` 接受 `.rotateX` 和 `.rotateY`；`joltBind([.rotateX: rx, .rotateY: ry])` 在同一个投影下绑定多个值，`scale` 与 `scaleX`/`scaleY` 相乘。请在这一次调用中绑定两个轴：两个独立的深度绑定会投影两次，内层变为正交投影。属性组、状态和关键帧驱动这些绑定值。`JoltPreset.flipInX` 和 `flipInY` 由共享配方生成，Web 和 NativeScript 的 `createPreset` 也以相同参数接受它们。

`.joltPerspective(600)` 声明以点为单位的距离，范围 1–100,000；`JoltPerspective(distance:)` 校验计算得到的值并抛出错误，超出范围的字面量会触发 precondition。该距离作用于其下方最近的、可以绕 X 或 Y 旋转的 Jolt 视图（`joltMotion`、`joltPreset`、`JoltPresence`、`joltScrollLinked`、`joltViewportEnter`、多值 `joltBind`，以及单个或映射的 rotateX/rotateY 绑定）。该视图用它投影，并对自己的内容隐藏它，因此倾斜的子视图在未自行声明时为正交投影。其他绑定，以及姿态中没有 rotateX/rotateY 的 `JoltPressStyle`，会把距离继续向下传递。消失点是每个视图自身未变换框架的中心，与 NativeScript 相同。在 Web 上它是设置了 CSS `perspective` 的容器中心，所以视图在容器中居中时两者重合；平移让表面相对这个固定点移动，与 Web 一致。未声明透视时，rotateX 和 rotateY 为正交投影，与没有 `perspective` 的 Web 相同：rotateY 60° 时视图显示为一半宽度。距离不做动画，修改在下一帧生效。不支持近端边缘到达眼睛位置的表面：CSS 会裁剪它，`JoltProjection.corners` 会抛出错误，Jolt 不定义 SwiftUI 的绘制结果。

JoltCore 根据测得的尺寸计算投影（`JoltProjection.matrix` 和 `JoltProjection.corners`），由 SwiftUI 几何效果应用，不改变布局。用 CSS 变换和透视矩阵生成的测试数据覆盖三种表面、八种姿态、正交投影以及 300/800/2400 点，另有两个越过眼睛位置的表面。Swift 测试把 JoltCore 以及该效果实际返回的变换与这些数据比较，深度实验室的 UI 测试读取每种距离下的投影框架。

命中测试和辅助功能框架都跟随投影后的形状。在 iOS 模拟器上的实验室 UI 测试中，点击布局框架内但在倾斜卡片外的位置没有作用，点击布局框架上方、卡片近端边缘上的位置会按下卡片；辅助功能框架是投影后的外接矩形。`joltSharedLayout`、`joltLayout`、`joltDrag`、`joltDropSource` 和 `joltPointerFollow` 测量的是未变换框架或全局位置，因此不支持用在绕 X 或 Y 旋转的视图上、其下方或已声明透视的区域下方。Web 会在这种情况下拒绝它们；SwiftUI 修饰符不能抛出错误，Jolt 也不检测这种情况。请把它们放在未变换的外层容器上，并倾斜子视图。骨骼绑定和 `JoltGestureModel` 仍是二维的，与共享骨骼通道一致。

`JoltShadow(opacity:radius:x:y:)` 表示一个外阴影：不透明度 0–1，半径 ≥ 0，偏移以点为单位，均为有限值且在 ±10¹² 以内。半径就是 Web 和 iOS 上 NativeScript 所称的 `shadowRadius`；Web 将其绘制为 2 × 半径的 CSS 模糊。颜色固定：`joltMotion(to:shadowColor:)`、`joltScrollLinked`、`joltViewportEnter` 和 `JoltPressStyle` 默认使用黑色，颜色的 alpha 与不透明度相乘。`JoltPose.shadow` 随姿态的变换过渡一起动画，因此 `y` 和阴影共用一个弹簧；没有阴影的姿态从透明、无模糊、无偏移的阴影开始插值。`joltShadow(rest, color:opacity:radius:x:y:)` 可将四个通道中的任意一个绑定到 `JoltMotionValue`。绑定的通道替换静止值，移除绑定后重新显示声明的静止值。绑定采样和弹簧过冲会像共享装饰通道一样被限制：不透明度限制在 0–1，半径 ≥ 0。阴影在视图变换之内绘制，与 CSS box-shadow 相同；SwiftUI 会为内容中每个可见形状绘制阴影，所以请给视图一个不透明的背景形状。预设和 `JoltPresence` 配方不带阴影。请在应用中为各外观选择颜色；实验室检查浅色和深色外观。

减少动态效果会立即让 rotateX、rotateY 和四个阴影通道到达目标，与其他变换相同，而不透明度保留其过渡。这与原生适配器一致：装饰属性直接跳到终点，只有不透明度和颜色继续动画。在 `joltReduceMotion` 下绑定显示目标值；非活动场景会让 `joltMotion` 直接到达目标，scope 会暂停其值。像素并不完全相同：SwiftUI、Core Animation 和浏览器对阴影和投影边缘的光栅化方式不同。

```swift
let rest = try! JoltShadow(opacity: 0.2, radius: 3, y: 2)
let raised = try! JoltShadow(opacity: 0.42, radius: 18, y: 16)
VStack {
    TiltCard()
        .joltBind([.rotateX: model.rotateX, .rotateY: model.rotateY])
    LiftCard()
        .joltMotion(
            to: lifted ? try! JoltPose(y: -18, shadow: raised) : try! JoltPose(shadow: rest),
            transition: .spring(.bouncy))
}
.joltPerspective(600)
```

浏览器中的约定见 [Web 深度通道](./interaction-depth)。

<Clip name="swiftui-depth-ios" caption="iPhone 17 Pro / iOS 27.0 模拟器，原生 SwiftUI：卡片在 300 pt、900 pt 和无透视下绕 X 与 Y 倾斜，一个轴在运动中途回正而另一个轴保持不变，点击检验投影后的命中区域，第二张卡片以同一个弹簧带动 y 和阴影抬起，随后移除阴影绑定，再开启减少动态效果并切换到浅色外观。真实 XCTest 触摸；不是实体设备录制。" />

<Clip name="swiftui-depth-macos" caption="macOS 应用，原生 SwiftUI：用真实鼠标点击展示相同的倾斜、透视、命中测试点击、抬起、减少动态效果和浅色外观。只录制应用窗口。" />

[派生运动与保留式图形](./swiftui-advanced)
