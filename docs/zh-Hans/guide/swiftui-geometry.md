# SwiftUI：面板与测量几何

**0.1.0-rc.13（测试版）**支持 iOS 17+ 和 macOS 14+，无需 NativeScript 或 JavaScript。从软件包仓库 [`jolt-swift`](https://github.com/rafaelaugustos/jolt-swift) 的标签 `v0.1.0-rc.13` 安装 `JoltSwiftUI` 产品。平台限制请参阅[安装](./swiftui)、[生命周期](./swiftui-motion)和[交互与几何](./swiftui-geometry)。

## 应用内停靠面板

`JoltSheetModel` 管理有限弹簧和 1–32 个唯一停靠点：`.points` 范围 (0, 1,000,000]、`.fraction` 范围 (0, 1]，或 `.content`。单位为 Apple 点和点/秒，Web 为 CSS 像素。高度限制在测量后的可用区域。释放投影为 200 ms，速度限制为 ±4,000 并保留给弹簧；距离相同时选择后声明的停靠点。

`JoltBottomSheet` 测量容器和内容，提供手柄与 `JoltScrollView`，打开时禁用自身背景并从辅助功能隐藏，通过 `returnFocus` 恢复调用方焦点。这是应用内面板，不是系统模态窗口或整个窗口的焦点陷阱。外部控件由应用负责；内容中不要嵌套另一个垂直滚动视图。

```swift
let scope = JoltScope()
let panel = try scope.retain(JoltSheetModel(
    snaps: [.points(230), .fraction(0.85), .content]
))
// Keep the model in @StateObject; restore app focus in returnFocus.
JoltBottomSheet(panel, label: "Details", returnFocus: { openerFocused = true }) {
    Button("Open") { try? panel.open(.points(230)) }
} content: {
    TextField("Note", text: $note)
    Text("Your scrolling content")
}
```

`open`、`snapTo`、`expand`、`collapse`、`dismiss` 选择逻辑停靠点；首次布局前也可请求打开。无效输入在替换动画前报错。`dismissible: false` 禁止程序和手势关闭。拖动中断当前采样弹簧；内容先展开面板再滚动，从滚动起点向下拖动会交给面板。改变停靠点后，请抬手并开始新接触来滚动。暂不支持滚动与弹簧之间连续传递惯性。

手柄仅提供当前可用的辅助功能操作；macOS 支持聚焦后的方向键和 Escape。iOS 在容器坐标中测量底边键盘遮挡，避免 SwiftUI 已缩小容器时重复扣除。浮动键盘不算底部遮挡；不承诺 macOS 软键盘行为。内容、容器或键盘变化取消接触并保持逻辑停靠点。

手动暂停在场景挂起后保留；`cancel` 冻结当前位置。移除视图会挂起，保留模型可重新挂载，也可用 `JoltScope` 随功能销毁。减少动态效果会直接到达程序目标，同时保留直接输入。`dispose` 清理订阅并禁止再次打开。

<Clip name="swiftui-panel-ios" caption="iOS 模拟器：原生面板拖动、内部滚动、软键盘、关闭、减少动态效果和重新挂载。不是实体设备。" />

<Clip name="swiftui-panel-macos" caption="原生 macOS：鼠标拖动、滚动、文本输入、Escape 和焦点恢复；不包含软键盘或触控板验证。" />

## 已实现行的测量高度

`measuresRows: true` 启用测量，原有固定 `rowHeight` 仍兼容。最多 1,000 个唯一稳定字符串 ID，长度 1–128。视图实现所有行，手柄至少 44 点，超过 10,000 点裁剪；模型接受 24–10,000 点测量和 0–100 点间距。没有虚拟化。文本、Dynamic Type 和布局均可更新测量。

拾取保留接触在行内的偏移，目标比较各行中心；预览只在释放后提交顺序。超过 0.5 点的测量变化、视口变化、替换、暂停/后台或移除都会取消接触和边缘滚动，不提交。程序操作、辅助功能和 macOS 方向键使用相同的稳定 ID 提交。减少动态效果移除预览动画。`replace` 删除旧测量，新行在测量前使用备用高度。销毁会释放输入和滚动任务。

```swift
let order = try scope.retain(JoltReorderModel(
    ["one", "two", "three"], measuresRows: true
) { move in
    // Persist the controlled application order using move.key / move.beforeKey.
})
JoltReorderList(order) { key in
    Text(descriptions[key] ?? key).padding(12)
}
try order.replace(["three", "one", "two"])
```

## 二次与三次曲线

`JoltPath(from:segments:)` 支持直线、二次和三次 Bézier，保留原有折线初始化器。坐标为 ±1,000,000 内有限值，1–1,024 段；自适应细分深度最多 18，顶点最多 8,192，几何容差 0.025 点并检查切线。超出预算抛出错误。这是近似弧长采样，不是完整 SVG 导入或任意路径变形。

进度限制 [0,1]；`orient: true` 使用连续展开的切线角度。退化切线使用附近弦方向，零长度保持静止。坐标相对视图原始中心。线性进度近似恒速，其他缓动会改变速度。取消、中断、暂停和销毁归输入值/scope 管理。减少动态效果直接使用目标姿态。生成的 fixtures 与 TypeScript Q/C 采样器比较长度、位置和角度。

```swift
let path = try JoltPath(from: .init(-125, 40), segments: [
    .quadratic(control: .init(-65, -100), to: .init(0, 0)),
    .cubic(control1: .init(65, 100), control2: .init(70, -100),
           to: .init(125, -40))
])
let progress = try scope.value(0)
// marker.joltPath(path, progress: progress, orient: true)
try progress.animate(to: 1,
    transition: .tween(milliseconds: 2400, ease: .linear),
    reducedMotion: reduceMotion)
// Retarget to 0 to reverse from the sampled position; cancel() freezes it.
```

<Clip name="swiftui-geometry-ios" caption="iOS 模拟器：二次/三次曲线、取消/反向、测量行拖动和动态文本。" />

<Clip name="swiftui-geometry-macos" caption="原生 macOS：曲线移动、测量排序和动态内容。" />

## 现有 Web 后端与验证

打包的 React/Angular/Svelte/Solid 复用 `scope.bottomSheet`、`scope.reorder` 和 `scope.animate(marker, {path: "M… Q… C…", orient: true}, transition)`。Web 手柄为可聚焦 slider，按钮和输入保持正常交互。模态语义、背景 inert 和焦点由应用负责。容器相对视口移动后调用 `remeasure()`。浏览器键盘取决于 VirtualKeyboard/VisualViewport；桌面录制不证明移动软键盘行为。

Web reorder 在 FLIP 完成后的空闲期保留尺寸/原点观察，因此改变文本后可再次拖动；拖动时改变高度仍会取消且不提交。删除行或销毁控制器释放观察，外部 transform 所有权检查保持不变。中心比较与 Swift fixtures 共用规则。

XCTest 验证 iOS 模拟器和原生 macOS，Web 验证 Chromium、Firefox、WebKit。录制不证明实体 iPhone/触控板或性能等价。Mavis 已有 Sheet/reorder 适配器；现有 [#234](https://github.com/getcortexlabs/mavis-ui/issues/234)、[#237](https://github.com/getcortexlabs/mavis-ui/issues/237)、[#298](https://github.com/getcortexlabs/mavis-ui/issues/298) 跟踪集成与验收。SwiftUI 包含在 v0.1.0-rc.13 中。

<Clip name="web-geometry-react" caption="桌面 Chromium，打包的 React：面板、滚动/焦点、曲线与不同行高排序。复用 Web 后端，不验证移动键盘。" />

<Clip name="web-geometry-angular" caption="桌面 Chromium，打包的 Angular：面板、滚动/焦点、曲线与不同行高排序。复用 Web 后端，不验证移动键盘。" />

<Clip name="web-geometry-svelte" caption="桌面 Chromium，打包的 Svelte：面板、滚动/焦点、曲线与不同行高排序。复用 Web 后端，不验证移动键盘。" />

<Clip name="web-geometry-solid" caption="桌面 Chromium，打包的 Solid：面板、滚动/焦点、曲线与不同行高排序。复用 Web 后端，不验证移动键盘。" />
