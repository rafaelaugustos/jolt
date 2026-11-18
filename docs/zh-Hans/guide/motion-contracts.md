# 动效连续性与手势关系

**源码候选，尚未包含在 0.1.0-rc.15 中。** 本批次涵盖 [#497](https://github.com/rafaelaugustos/jolt/issues/497)、[#502](https://github.com/rafaelaugustos/jolt/issues/502)、[#503](https://github.com/rafaelaugustos/jolt/issues/503)、[#504](https://github.com/rafaelaugustos/jolt/issues/504)、[#505](https://github.com/rafaelaugustos/jolt/issues/505) 和 [#508](https://github.com/rafaelaugustos/jolt/issues/508)。不会发布软件包或更改版本。SwiftUI 在 iOS 17+ 和 macOS 14+ 上仍为测试版。

## 控制器之间的关系 {#gesture-relationships}

在控制器挂载且空闲时、接触开始前创建 `gestureRelations()`。`waitFor` 让 `gesture` 等待 `other` 失败；`simultaneous` 允许两者同时识别；`block` 在阻止方仍处于可能状态时允许目标开始，但在阻止方识别成功时取消目标。被阻止的接触不能重新启动。因此，轮播开始移动时可以取消 press 反馈。

`gestures`、`drag`、`zoomable`、`bottomSheet`、`reorder` 及 `press` 返回的函数提供端点。默认类型为 `pan`，但 `reorder` 为 `longPress`，`press` 为 `tap`。通过 `kind`/`otherKind` 选择已启用的 `pan`、`pinch`、`rotate`、`tap` 或 `longPress`。sheet 协调其内部 pan；zoomable 协调 pan/pinch/tap。当 `dismiss:false` 且照片处于最小缩放比例时，其 pan 失败，让正在等待的 sheet 移动。

```ts
import { gestureRelations } from '@rafaelaugusto/jolt/web'
// NativeScript: import from '@rafaelaugusto/jolt'.
const links = gestureRelations([
  { gesture: sheet, other: photo, relation: 'waitFor', otherKind: 'pan' },
  { gesture: photo, kind: 'pinch', other: sheet, relation: 'block' },
])
// Before destroying or remounting the participating controllers:
links.dispose()
```

配置接受 1–128 条关系，在安装前拒绝跨组循环、自关联、不兼容的运行时、禁用的通道、活动接触及同时识别与顺序要求的冲突。释放组会取消参与的输入并移除关系。释放任一控制器也会移除其关系；原生 unload/重新挂载后需重建关系组。关系借用控制器，不拥有其值或视图。

UIKit 使用可移除的 delegate 失败要求和同时识别策略，并保留原 delegate。Android 在原生触摸分发中仲裁，无需逐帧 JavaScript 决策。Web 协调 Jolt Pointer Events，在接触前固定 `touch-action`，并在嵌套表面间共享 pointer capture；释放后恢复原策略。组合表面支持平移祖先，祖先的缩放、旋转和透视不在坐标约定内。浏览器事件时序与原生识别阈值可能不同。

`nativeGestureRecognizer(native, kind)` 是可选的 NativeScript 入口，接受应用拥有的 UIKit 识别器或 Android `org.rafaelaugusto.jolt.GesturePeer`。释放此 handle 只移除 Jolt 关系，不销毁应用识别器。它不能包装任意 Android 检测器。交互式导航应协调发起操作的 zoom/drag 控制器；系统边缘返回和 predictive-back 不是 `sharedNavigationEntry()` 的端点。

## SwiftUI 连续性与保留绘图 {#swiftui-contracts}

`JoltTimelineTrack.velocity` 接受有限的初速度覆盖值，单位为值单位/秒。时间零处、使用隐式 `from` 的第一条轨道继承**构建 timeline 时**采样的速度。暂停/挂起的来源贡献零；显式 `from`、延迟轨道和后续阶段默认从零开始，除非显式覆盖。`sequence` 使用同一解析速度计算阶段时长。`autoplay:false` 保留构建时快照。Seek 保持确定性；取消释放所有权，暂停与挂起相互独立。

`connectEdgeScroll` 让自定义 reorder 拖柄使用模型现有的边缘时钟。保留其 `JoltObservation`；回调接收 -1/+1，返回是否还能继续滚动。通过现有方法提供实际行尺寸、指针/viewport 坐标和当前滚动偏移。替换或断开 viewport 会取消接触；释放旧连接不会断开新连接。挂起、删除项目和释放模型会停止边缘工作。行操作可保留在拖柄之外。

`JoltParticles.emit(duration:nil)` 持续发射，直到取消、释放或 Reduced Motion 结束效果。默认仍为有限的 2000 ms。速率为粒子/秒 (0,1000]，lifetime 单位为毫秒，`ceil(rate × lifetime / 1000)` 必须不超过容量 (1–2000)。存储保持有界；延迟帧跳过已过期的出生事件，不积累待处理工作。出生标识在 60 秒之后保持稳定。暂停和挂起分别冻结时间；`cancel()` 清空粒子，释放会移除时钟订阅。几何使用局部点，速度为点/秒，重力为点/秒²，自转为度/秒。

`JoltSVGPath` 接受绝对/相对 M/L/H/V/C/S/Q/T/A/Z、重复坐标及指数。它规范化为 M/L/C/Q/Z，将圆弧转换为三次曲线，并保留子路径和闭合。限制为 20,000 UTF-8 字节、256 个规范化命令及 ±1,000,000 坐标。共享 TypeScript/Swift fixtures 检查规范化结果。`JoltPath` 仍是独立的测量移动路径 API。

```swift
let replacement = try JoltTimeline(tracks: [
  .init(x, to: 120),                     // inherit current velocity
  .init(y, to: 40, velocity: -80)        // explicit units/second
])
let edge = try model.connectEdgeScroll { direction in
  scrollOneRow(direction)              // return false at the viewport boundary
}
// Retain edge alongside the custom viewport; call edge.dispose() on teardown.
try particles.emit(rate: 12, duration: nil, seed: 1)
let path = try JoltSVGPath("M10 10H90V90H10Z M35 35H65V65H35Z")
let drawing = try JoltDrawing([
  .init(.svg(path), fill: .init(argb: 0xffdbff7a),
        stroke: .init(argb: 0xff7766ff), lineWidth: 3,
        strokeStart: 0.1, strokeEnd: 0.9,
        lineCap: .square, lineJoin: .bevel, fillRule: .evenodd)
])
// JoltDrawingView(drawing, viewBox: try JoltViewBox(0, 0, 100, 100), accessibilityLabel: "Window")
try drawing.morphPath(at: 0, to: anotherCompatiblePath)
```

`JoltDrawingView` 在单个 Canvas 中渲染保留的几何。填充规则为 nonzero/evenodd；端点样式为 butt/round/square，连接样式为 miter/round/bevel。每个形状的 `strokeStart`/`strokeEnd` 与可选的视图级值均使用 0…1，并取交集；空区间隐藏描边，保留填充。线宽使用绘图单位，范围为 0…1000。显式、有限且宽高为正的 `viewBox` 独立缩放 x/y 以适配 viewport，不会自动保持宽高比；未提供时使用局部点。

每个 drawing 同时运行一个 morph。路径必须具有相同的规范化命令/子路径；不兼容输入在取消当前工作前被拒绝。替换在命令时刻采样可见路径并保留样式。`pause`/`play`、`suspend`/`resume`、取消、场景不活跃、Reduced Motion 和释放均使用现有时钟生命周期。取消保留采样几何，释放清空绘图。原有 `strokeProgress` 初始化器仍有效。不承诺命中测试、任意拓扑转换或原生与浏览器像素一致。

## 暂停弹簧的速度 {#paused-velocity}

Web 的 `springValue.getVelocity()` 和导数图在暂停或运行时隐藏时立即返回零，与原生约定一致。恢复保留弹簧动量；`stop()` 清除动量。暂停时位置保持不变。修复会通知依赖值重新计算，不增加帧循环。原生录像验证 iOS/Android 已有的行为。

## 各平台证据 {#evidence}

Web 已支持对应的 timeline 速度、持续发射、SVG 样式/morph 和按键 reorder 自动滚动。本批次复用这些 API；参见 [Web 编排](./web-orchestration)、[Web 效果](./web-effects) 和 [Web 手势](./web-gestures)。Web 新增行为是跨控制器识别与暂停导数传播。测试在 iOS、Android 和 Chromium 上覆盖双向嵌套等待、press/轮播、swipe/reorder 和照片/sheet；鼠标策略及暂停检查也在 Firefox/WebKit 运行。可信多点触控注入仅覆盖 Chromium。录像保持原速，不用于硬件性能比较。

<Clip name="gesture-relations-ios" caption="iPhone 17 Pro，iOS 27 模拟器：真实 XCTest 输入演示双向嵌套等待、press/轮播、swipe/reorder 和照片/sheet。英文界面。" />

<Clip name="gesture-relations-android" caption="Pixel 7，Android API 36 模拟器：真实系统触摸输入演示相同识别场景。启用触摸指示点；英文界面。" />

<Clip name="gesture-relations-web" caption="macOS 上的 Chromium：真实鼠标及可信触摸/pinch 输入；独立场景按原速拼接。英文界面。" />

<Clip name="spring-velocity-ios" caption="iOS 27 模拟器：位置冻结，直接速度及导数为零，恢复后保留动量。英文界面。" />

<Clip name="spring-velocity-android" caption="Android API 36 模拟器：真实暂停/恢复输入，暂停时速度和导数为零。英文界面。" />

<Clip name="spring-velocity-web" caption="macOS 上的 Chromium：真实暂停、恢复及 stop 操作与速度导数。英文界面。" />

<Clip name="swiftui-motion-contracts-ios" caption="iPhone 17 Pro，iOS 27 模拟器：速度继承替换、SVG morph/trim、超过 60 秒的持续粒子，以及自定义拖柄边缘滚动与行操作。真实 XCTest 输入；原速；英文界面。" />

<Clip name="swiftui-motion-contracts-macos" caption="macOS 原生应用：真实点击与拖动演示相同 SwiftUI 约定，包括超过 60 秒的持续粒子。原速；英文界面。" />
