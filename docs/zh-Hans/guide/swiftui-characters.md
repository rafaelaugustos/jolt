# SwiftUI：关键帧、交互与角色

**0.1.0-rc.13（测试版）**支持 iOS 17+ 和 macOS 14+，无需 NativeScript 或 JavaScript。从软件包仓库 [`jolt-swift`](https://github.com/rafaelaugustos/jolt-swift) 的标签 `v0.1.0-rc.13` 安装 `JoltSwiftUI` 产品。平台限制请参阅[安装](./swiftui)、[生命周期](./swiftui-motion)和[交互与几何](./swiftui-geometry)。

## 有限关键帧

JoltTimeline.keyframes 将标准化关键帧编译为现有时间线；每个关键帧的 easing 控制下一段。每个通道需要 2–256 个严格递增的时间点，首尾为 0 和 1，数值有限且不超过 ±10¹²。支持同一时钟的 1–128 个独立通道、1–100 遍、最多 10,000 个展开片段和总计 60,000 毫秒。iterations:2 与 autoreverses:true 表示先正放再倒放，并反转缓动曲线，最终回到起点；不提供无限循环。

先完整验证，再取得数值所有权。新写入者中断旧时间线；cancel/dispose 为终止操作。pause 冻结进度，场景挂起保留手动暂停。reducedMotion 直接设置最后一遍的终点，不保持时钟；创建时传入宿主偏好，时钟还遵守系统偏好。Web 复用 animate：x:[-100,100,0]、times:[0,0.6,1]、ease:["easeIn","easeOut"]、duration:1800、repeat:1、repeatType:"reverse"。Web repeat 计算额外遍数。

```swift
let scope = JoltScope()
let x = try scope.value(0)
let scene = try scope.retain(JoltTimeline.keyframes([
    .init(x, [try .init(-100, at: 0, ease: .easeIn),
              try .init(100, at: 0.6, ease: .easeOut),
              try .init(0, at: 1)])
], duration: 1800, iterations: 2, autoreverses: true))
scene.pause()
try scene.seek(to: 0.5) // Pauses; no side effects.
scene.play()
// Bind: Capsule().joltBind(.x, to: x)
```

## 组合手势

JoltGestureModel 拥有 x/y、统一缩放和旋转；joltGestures 连接真实输入，缩放/旋转保持焦点，并处理接触切换。平移单位是 Apple 点，旋转为度，缩放为无单位正数。使用有限 x/y 边界以及 (0,100] 内的缩放范围。边界可能限制焦点保持。父坐标空间必须未变换；当前不支持变换祖先或透视。 iOS 的窗口识别器按输入矩形过滤，不会推断 SwiftUI 叠层遮挡。显示重叠内容时，请禁用被覆盖的手势区域。

在 macOS 上，识别到的拖动、缩放和旋转优先于被包装控件的手势；普通点击仍可用。直接输入从当前采样位置中断回弹；cancel 保留变换，settle 动画到已验证目标。禁用、移除、后台会取消接触并挂起运动；恢复不会清除手动暂停。提供无障碍缩放、旋转、重置动作，也可使用示例中的可见按钮。macOS 视频验证鼠标与按钮，不代表实体触控板验证。Web 复用 scope.gestures、指针接触、settleTo 和明确的无障碍控件。

```swift
let gesture = try scope.retain(JoltGestureModel(
    bounds: .init(x: -100...100, y: -70...70), scale: 0.6...2
))
// card.joltGestures(gesture)
try gesture.settle(to: .init(), reducedMotion: false)
```

<Clip name="swiftui-key-gesture-ios" caption="iOS 模拟器，原生 SwiftUI：有限关键帧、暂停/恢复、实际触摸拖动/缩放/旋转、重置及减少动态效果。非实体设备录像。" />

<Clip name="swiftui-key-gesture-macos" caption="macOS 原生 SwiftUI：关键帧、鼠标拖动与缩放/旋转按钮；不验证实体触控板。" />

## 已实例化列表重排

JoltReorderModel 拥有最多 1,000 个唯一稳定字符串 ID，长度 1–128。JoltReorderList 实例化固定高度的竖直行：24–500 点，间距 0–100；不提供虚拟列表。只有拖柄启动拖动，行内容仍可滚动。预览直到释放才提交 keys；onMove 返回稳定 key、最终索引及 beforeKey，数据持久化由应用负责。replace 先验证所有 ID 再取消输入。边缘滚动仅在有效拖动期间工作，到达边界或取消时停止。

固定高度仍为默认值。使用 `measuresRows: true` 启用[测量行高](./swiftui-geometry)，列表仍实现所有行。

每行提供位置说明和上移/下移无障碍动作；macOS 聚焦行也支持方向键。减少动态效果仅取消预览动画，不阻止重排。暂停、禁用、后台、替换数据和销毁均取消且不提交。Web 复用 scope.reorder、已实例化 DOM 行、键盘拾取/提交/取消及边缘滚动；Web 可变行尺寸不代表 SwiftUI 虚拟化。

```swift
let order = try scope.retain(JoltReorderModel(["one", "two", "three"]) { move in
    // Persist the controlled application order using move.key / move.beforeKey.
})
// JoltReorderList(order) { key in Text(key) }
order.move("one", to: 2)
```

## 放置区域

JoltDropZones 注册 1–64 个目标，ID 唯一且长 1–64，优先级有限，接受判断同步执行。高优先级优先，相同则按声明顺序。中心命中包含边界；overlap 必须有正面积。使用实际视图在同一全局空间的矩形，仅为应用内放置，不是系统拖放或文件导入。拒绝后弹回原点；减少动态效果时立即返回。request(id) 提供无需重叠的按钮/无障碍替代，但目标必须仍挂载。

下一次交互、目标移除、暂停/后台或销毁会清理已接受效果。回调可以取消或替换操作，旧清理不能覆盖新操作。坐标和尺寸最多 ±1,000,000 点，尺寸必须为正。控制器拥有源平移时不要再独立修改它。Web 复用 scope.dropZones 与共享优先级、接受判断、效果所有权；放置区域不提供 reorder 的边缘滚动。

```swift
let zones = try scope.retain(JoltDropZones([
    .init("basket", label: "Basket"),
    .init("locked", label: "Locked shelf", priority: 10, accepts: { false })
], onDrop: { event in
    // Apply app data; return an optional owned effect.
    JoltEffect { /* cancel that effect */ }
}))
// source.joltDropSource(zones)
// basket.joltDropTarget("basket", in: zones)
try zones.request("basket")
zones.cancel()
```

<Clip name="swiftui-transfer-ios" caption="iOS 模拟器，原生 SwiftUI：接受/拒绝放置、返回与效果清理、12 个已实例化行重排及边缘滚动。" />

<Clip name="swiftui-transfer-macos" caption="macOS 原生 SwiftUI：鼠标放置、按钮替代、拖柄重排及边缘滚动；不包含虚拟列表。" />

等待 [PR #488](https://github.com/rafaelaugustos/jolt/pull/488) 合并并发布；0.1.0-rc.13 尚未包含。 用于有序插入时，`joltDropHandle(zones)` 把拖动放到 `joltDropSource` 视图内部的某个视图上（例如拖柄），移动的仍是源。拖柄在屏幕上时，源自身的拖动只作用于子视图，因此源的其余部分保留按钮、手势和滚动，“Move to …”与“Return to origin”无障碍操作也从源移到拖柄。`JoltDropTarget` 接受 `padding: JoltDropPadding`，按边以点为单位扩大上报的 frame（0–1,000；其他值会在创建目标前抛出错误）。中心与 overlap 都使用扩大后的 frame，所用的 JoltCore 命中测试与生成的 fixtures 中 TypeScript `dropHits` 的结果一致。

```swift
let board = try scope.retain(JoltDropZones([
    .init("backlog", label: "Backlog", padding: try .init(bottom: 60)),
    .init("done", label: "Done", padding: try .init(bottom: 60)),
], onDrop: { event in
    // 把卡片数据移到 event.id；此回调之后调用 board.cancel() 将 offset 归零。
    nil
}))
// card.joltDropSource(board), with grip.joltDropHandle(board) inside the card
// column.joltDropTarget("done", in: board)
```

移动中的位置本已发布：应用可借助 `offset`、`hovered` 和 `dragging` 放置空位，无需自己的手势。源的布局 frame 在拖动 offset 之外测量；拖动期间它发生变化时（例如源上方打开空位），会补偿 offset，使源留在手指或指针下。源视图因更换容器而被替换时，放置区域保持可用：最新的视图拥有 frame，只有当没有任何源视图可见、启用且处于活动场景时才会挂起。取消会把 offset 归零；减少动态效果时，被拒绝的松手立即返回。Web 与 NativeScript 通过 `drag.handle`、`onMove` 和 `padding` 使用相同契约，见[放置目标、音频提示与深度](./interaction-depth)。

<Clip name="swiftui-character-handle-ios" caption="iOS 模拟器，原生 SwiftUI：真实触摸输入。卡片主体保留按钮，拖柄负责拖动，卡片上方打开空位时卡片仍在手指下，在 Done 下方松手命中 60 pt 内边距，锁定目标拒绝，减少动态效果时立即返回。非实体设备录制。" />

<Clip name="swiftui-character-handle-macos" caption="macOS 原生 SwiftUI：同一拖柄看板，使用鼠标拖动和 Send 按钮，从原生窗口捕获。此录制不验证实体触控板手势。" />

## 有限粒子

JoltParticles 是可选 Canvas 渲染器：1–2,000 个存活粒子、1–32 色、寿命 1–60,000 毫秒、尺寸 1–128 点。burst 与有限 emit 替换当前发射；最高 1,000 个/秒，发射时间加寿命最多 60 秒。超过存活预算会在替换前拒绝。速度及变化范围 0–10,000 点/秒，重力 ±10,000 点/秒²，旋转速度 ±3,600 度/秒，旋转变化范围 0–3,600。形状为圆、矩形、环；起点为中心、顶部、底部。seed 可重复测试，但不保证与 Web 相同随机序列。

首次发射前以及完成/取消/销毁后无时钟。暂停冻结粒子年龄；resize 影响新粒子，现有粒子保留出生位置。迟到帧跳过已过期出生，不积累工作。系统或视图减少动态效果会抑制粒子并结束活动发射。Canvas 为装饰，不拦截输入，也不进入无障碍树；成功/错误仍应保留语义反馈。时间线事件返回 JoltEffect { particles.cancel() } 可复用借用的发射器；时间线必须足够长，完成也会清理效果。Web 复用 particles/confetti 和共享弹道方程，保留自己的容量与随机源。

```swift
let particles = try scope.retain(JoltParticles(.confetti))
// JoltParticlesView(particles).frame(width: 320, height: 330)
try particles.burst(count: 100, seed: 7)
particles.pause()
particles.play()
particles.cancel()
```

## 关节角色

JoltRigDefinition 验证 1–64 部件、无环父层级、最多 128 姿态及 256 socket。固定尺寸为 (0,10,000] 点；相对枢轴在 ±10 内；通道为 x/y/scaleX/scaleY/rotate，可指定旋转限制。平移/角度在 ±1,000,000 内，缩放在 ±100 内，包括弹簧超调采样。姿态指定绝对目标，混合计算相对静止姿态的加权偏移，每通道除以 max(1,总权重)，无角度限制的关节走最短旋转路径。未知部件、循环、非有限权重和无效目标矩阵在修改动画前拒绝。

JoltRigView 用一个 Canvas 绘制 SwiftUI 符号；附件放在相同未变换容器，socket 沿完整父链计算。rig 拥有通道与播放，附件视图为借用。暂停保留姿态，减少动态效果直接设置目标；scope 销毁观察与时钟工作。提供有意义的整体无障碍标签及独立语义控件。不包含逐部件命中、逆向运动学、网格变形或物理。Web 复用 rig2d 与 DOM 层级，附件必须是 socket 部件的直接子元素，与 SwiftUI 同级容器放置不同。

```swift
let rig = try scope.retain(JoltRig(.init(
    parts: ["arm": .init(width: 95, height: 28, pivotX: 0, rotation: -90...30)],
    poses: ["rest": [:], "wave": ["arm": .init([.rotate: -65])]],
    sockets: ["hand": .init(part: "arm", x: 0.95, y: 0.5, relative: true)]
)))
try rig.pose("wave")
try rig.blend([.init("wave", weight: 0.5)])
// JoltRigView(rig, accessibilityLabel: "Companion") { name in ... }
// flower.joltRigSocket("hand", in: rig)
```

<Clip name="swiftui-character-ios" caption="iOS 模拟器，原生 SwiftUI：加权姿态、手部 socket 花朵、时间线彩纸、取消及减少动态效果；不主张实体设备性能。" />

<Clip name="swiftui-character-macos" caption="macOS 原生 SwiftUI：关节姿态与相同 socket/效果生命周期，直接录制原生窗口。" />

## Web

打包后的 React、Angular、Svelte、Solid 消费者在各框架 scope 下复用已有 Web API。录像包含真实鼠标/键盘、姿态变化和 Canvas 粒子；Chromium/Firefox/WebKit 测试验证行为及卸载清理。这些不是 NativeScript 或实体触屏录像，也不承诺各渲染器像素、时序、内存或 CPU 相同。

<Clip name="web-characters-react" caption="React · Chromium：打包消费者中的关键帧、真实鼠标/键盘、socket 与时间线粒子。" />

<Clip name="web-characters-angular" caption="Angular · Chromium：打包消费者中的关键帧、真实鼠标/键盘、socket 与时间线粒子。" />

<Clip name="web-characters-svelte" caption="Svelte · Chromium：打包消费者中的关键帧、真实鼠标/键盘、socket 与时间线粒子。" />

<Clip name="web-characters-solid" caption="Solid · Chromium：打包消费者中的关键帧、真实鼠标/键盘、socket 与时间线粒子。" />
