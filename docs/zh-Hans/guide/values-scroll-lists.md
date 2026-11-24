# 组合数值、滚动与按键更新列表

开发分支还支持 Core ListView 的实测行高及更多集合布局。 [CollectionView / ListView](./collections-scroll#collection-layouts)

**已包含在 0.1.0-rc.15（测试版）。** 更新后请重新编译原生应用。以下视频来自所标注平台的实际交互；模拟器不能作为实体设备性能证明。

2026 年 11 月 20 日，维护者批准 #385、#415 和 #494 使用模拟器验收。iOS 27 模拟器中的真实 VoiceOver 与 Android API 36 模拟器中的真实 TalkBack 均通过退出遍历及 Core ListView/CollectionView 按键保留焦点的检查（#498/#499）。原生焦点修复已包含在 RC.17 中；已发布的 RC.16 构件保持不变。实体指针验收（#492）仍独立跟踪。CollectionView 更新/排序仅支持单列垂直布局；分区、网格、跨列表移动不在适配器范围内，Web 虚拟化仍由应用负责。这些测试不证明实体设备精度、帧耗时或更低的应用 CPU/PSS。 [报告](https://github.com/rafaelaugustos/jolt/tree/main/benchmarks/acceptance-closure).

## 组合数值

```ts
import { animate, bind, motionValue } from '@rafaelaugusto/jolt'
const a = motionValue(0)
const b = motionValue(0)
const x = a.add(b).mul(0.65).clamp(0, 300)
const detach = bind(card, { x })
animate(a, 180, 'snappy')
animate(b, 90, 'smooth')
// 卸载时：detach(); x.dispose(); a.dispose(); b.dispose()
```

Web 使用同一个 runtime 的 `motionValue()`、`bind()` 和 `animate()`；Web binding 通过 `dispose()` 释放，原生 binding 返回清理函数。现有 `.to()` 映射和 spring follower 保持可用。

`add`、`sub`、`mul`、`div`、`min`、`max` 接受数值源或有限常量，另有 `abs`、`clamp`、`sin`、`cos` 和 `velocity`。三角函数使用弧度，速度为输入单位/秒。除零和非有限结果返回零；min/max 平局与 clamp 端点的速度为零。速度节点的导数为零，不估算加速度。不可变图无法形成环；最多 32 层，原生程序最多 1,024 个节点。颜色不参与数值代数。

有限时间轴输入编译为原生 tracks，实时输入由原生求值器处理。Web scheduler 共享源采样。原生图不执行任意逐帧回调。销毁输出不会销毁借用的输入；销毁输入会结束依赖图。所有者卸载时释放 binding、输出和源。这不改变 NativeScript UI 与 JavaScript 共用主线程的架构。

<Clip name="values-scroll-ios" caption="iOS 模拟器：组合两个输入、中断、重新播放，以及真实滚动驱动原生进度条。" />
<Clip name="values-scroll-android" caption="Android 模拟器：组合值和原生滚动。审计只统计 Jolt 回调；Core 仍可能发送自身的 JavaScript 事件。" />
<Clip name="combined-values-web" caption="Chromium：两个动画输入、中断，以及真实浏览器滚动驱动进度条。" />

## 原生滚动源

```ts
const offset = scrollValue(scrollView, { axis: 'y', execution: 'native' })
const detach = bind(meter, { scaleX: offset.to([0, 500], [0, 1]) })
// detach(); offset.dispose()
```

`execution` 接受 `auto`、`native`、`javascript`；返回值报告所选路径。JavaScript 回退支持 Core ScrollView；强制 native 但缺少 bridge 时抛错。`refresh()` 重读几何，`ref(next)` 切换源。卸载、后台和销毁会移除 observer。只有显式 `subscribe()` 才启用 Jolt 通知；单独的原生 binding 不增加逐事件 Jolt JavaScript 调用。Core 自身仍可能发出 JavaScript 滚动事件。

Android 偏移使用 DIP，iOS 使用点。iOS 归一化 adjusted leading inset 并保留负向回弹。Android ListView 要求固定行高，计入分隔线；RecyclerView 仅支持固定 stride 的线性布局，不支持 reverse、stack-from-end、网格和分节。iOS 支持 UIScrollView 子类，包括 table/collection。`scrollLinked()` 将符合条件的 transform、opacity 和绘制属性 keyframes 编译为 binding；其余属性保留原先 scrub 路径。

Web 复用 `runtime.scrollValue()` 与 `scrollLinked()`。共享非负范围的直接、数值、clamped `.to()` binding 可以使用 ScrollTimeline；代数、不同范围、浏览器不支持或非正 scale 端点使用共享 scheduler。浏览器的像素、回弹与线程不保证与原生相同。

## 退场与 Vue 分组

```ts
animateLayout(container, () => container.removeChild(card), {
  duration: 500,
  exit: { opacity: 0, y: 16, scale: 0.92 },
})
// Web: runtime.animateLayout(container, () => card.remove(), options)
```

默认仍立即移除。`exit` 接受 `'fadeOut'`、`false` 或包含 `opacity`、`x`、`y`、正数统一 `scale` 的对象。移动和退场共享有限 transition，`finished` 等待两者。`maxSnapshotPixels` 限制一次操作的副本总像素：默认 800 万，可选 1 到 3,200 万。只捕获在本次变更/下一次 layout 中实际移除的直接子项，不对所有保留项截图。

NativeScript 移除时会拆除 native view，因此使用受预算限制的静态副本。副本不接收点击或无障碍焦点；中断、重新插入、卸载、后台、减少动态效果和销毁都会清理。超预算或不支持的内容立即移除。原生捕获要求完全可见、无旋转、统一缩放的二维内容及不透明祖先；视频、纹理、WebView 和嵌套滚动区域不支持。副本冻结内容，不保留活动编辑器，也不向副本转移焦点。

Web 复制 DOM 呈现，不支持表单、custom elements、canvas/视频、伪元素和旋转/3D 祖先。局部 hooks 覆盖 `removeChild`、`remove`、替换方法及容器文本/HTML 替换；预先缓存的原型方法、隐式移动到另一个父容器无法捕获。浏览器无 popover 支持时立即移除。变更必须同步，目标必须为直接子项。

```vue
<JoltTransitionGroup :enter="true" leave="fadeOut" move="snappy">
  <Label v-for="item in items" :key="item.id" :text="item.title" />
</JoltTransitionGroup>
```

从 `/vue` 导入（默认 StackLayout），或 `/web/vue`（默认 div，可借用 runtime）。`tag` 选择容器；`enter` 控制淡入，`leave` 遵循受限退场契约，`move` 设置 transition。停用/卸载结束操作。SwiftUI 已有 ForEach 和 transitions，不添加重复分组 API。

<Clip name="layout-exits-ios" caption="iOS 模拟器：同一次操作中移除、插入和重排，连续移除、中断、重新插入及减少动态效果。" />
<Clip name="layout-exits-android" caption="Android 模拟器：原生退场副本与邻项移动、取消和重新插入。" />
<Clip name="layout-exits-web" caption="Chromium：DOM 更新与取消，然后展示真实 Vue 分组。退场副本设置 inert 和 aria-hidden。" />

## 按数据键更新回收列表

```ts
const changes = listChanges(listView, {
  key: (item) => item.id,
  rowHeight: 60,
  exit: 'fadeOut',
  move: 'snappy',
})
changes.update(nextItems)
// scope.add(changes)，或所有者销毁时 changes.dispose()
```

首个原生适配器支持平面 Core ListView，要求固定正行高。`rowHeight` 设置 DIP 行高；未传入时读取加载后的属性。更新需要已加载且高度解析完成的列表。通过 `update()` 提交不可变数组，键为唯一字符串或有限数字。diff 检查全部数据，只动画化已实现且可见的行，保留第一可见项的键和行内偏移；该键被删除时采用最近剩余索引。中途更新从屏幕上的当前位置开始；回收仅清理由该操作持有的属性。已有项从屏外出现不播放入场。分节、网格、CollectionView transitions 和跨列表移动不在首版范围内。

`stop()` 取消动画但保留已提交数据；`pause()` 让之后的更新立即完成，直到 `play()`。原生 unload 会销毁控制器，重新加载后需创建新实例。后台/减少动态效果取消装饰性动画。兼容模板中，焦点根据幸存的可见键与子节点路径恢复；已删除/屏外项不强制抢焦点。

Web 使用 `runtime.listChanges(container, { key, scroll, exit, move, adapter })`。适配器提供 `items()`、同步按键保留节点的 `render(next)`、返回 `{ key, target }` 的 `rows()`。Jolt 不负责虚拟化或 framework 渲染。虚拟器必须声明 `virtualized: true`，返回已实现行，提供 `observeRecycling(recycle)` 并在复用元素前通知，同时提供 `anchor(keys)` 返回恢复键/索引与行内偏移的函数。所有者销毁时释放控制器；移除容器也会释放。不要让多个 layout 所有者同时控制相同行。

<Clip name="list-changes-ios" caption="iOS 模拟器，200 行 Core ListView：滚动、保留锚点插入、删除、中断 reverse/filter，以及减少动态效果。" />
<Clip name="list-changes-android" caption="Android 模拟器，200 个固定高度行：原生回收、按键更新、中断和滚动源审计。" />
<Clip name="list-changes-web" caption="Chromium，200 个按键保留的 DOM 行：视口上方插入、删除、reverse/filter 与中断；此演示不是虚拟器。" />

## SwiftUI 结构性滚动与标题栏

```swift
let combined = try a.add(b).mul(0.65)
card.joltBind(.x, to: combined)
let controller = try JoltScrollHeaderController(
  geometry: .init(expanded: 180, minimum: 48, section: 32, parallax: 50)
)
```

`JoltComputedValue` 共享输入的 clock 并参与 JoltScope。速度源称为 `velocityValue()`，因为 `JoltMotionValue.velocity` 已读取数值。SwiftUI 仍负责 view invalidation。

`JoltScrollHeader(controller:artwork:title:toolbar:compactTitle:section:content:)` 提供 spacer、固定 toolbar/section、大/小标题切换及装饰视差。使用 `await controller.preserveAnchor { ... }` 前为行添加 `.joltScrollAnchor(id)`。`scrollTo`、`scrollToTop` 和异步 `remeasure` 使用 iOS/macOS 原生 scroll view。用户输入、pause 和 dispose 取消程序滚动。几何改变会保留内容位置，但更晚的用户/程序操作优先。

`JoltScrollProgress.subrange()` 创建借用源的独立范围，`setRange()` 修改边界。`joltScrollLinked(..., role: .structuralTranslation)` 在减少动态效果时保留 x/y 而禁用装饰通道；`.structuralPose` 显式保留整套 pose。默认 `.decorative` 抑制空间装饰。`@Environment(\.joltEffectiveReduceMotion)` 读取 app 或系统设置。标题栏保留结构性折叠和固定内容，停用视差并直接切换标题；仍可滚动。

<Clip name="swiftui-values-scroll-ios" caption="独立 SwiftUI，iOS 27 模拟器：组合值、程序滚动、按键插入保留锚点、固定标题栏和减少动态效果，无 NativeScript。" />
<Clip name="swiftui-values-scroll-macos" caption="真实 macOS SwiftUI 应用：通过 NSScrollView 展示相同的组合值、标题栏、锚点和减少动态效果契约。" />

[后续报告](https://github.com/rafaelaugustos/jolt/tree/main/benchmarks/acceptance-closure)记录了共享图绑定 16 个原生视图的五次实测，所有终点值均通过验证。维护者批准 #494 使用模拟器证据；这不证明实体帧耗时、总分配成本或优于 Reanimated 的 CPU/PSS。

<Clip name="list-changes-playground-web" caption="Chromium 文档实际 playground：按键列表滚动，上方插入保持锚点，然后删除、反转并中断更新。" />

## 原生屏幕阅读器验收 {#native-reader-acceptance}

修复在中断更新期间保留逻辑行键及其后代焦点。iOS 在运动与清理完成后恢复辅助功能焦点；Android 在布局后恢复。键盘焦点保留原有时序。删除聚焦键或将焦点移至列表外不会强制跳转。卸载、挂起及销毁会使待恢复请求失效。200 行测试覆盖移动、插入、中断、外部焦点、减少动态效果及销毁；退出遍历还检查不可访问的离场副本、取消及重新插入。已有 Web 等效实现在三个浏览器引擎中通过生命周期及焦点测试。

[报告](https://github.com/rafaelaugustos/jolt/tree/main/benchmarks/acceptance-closure).

<Clip :autoplay="false" name="layout-exits-voiceover-ios" caption="iOS 27 模拟器，使用真实 VoiceOver 与 XCTest 交互。可见焦点及遍历断言；无声录像。不证明实体设备行为。 退出副本、取消、重新插入及清理。" />

<Clip :autoplay="false" name="layout-exits-talkback-android" caption="Android API 36 模拟器，使用真实 TalkBack 与原生触摸交互。可见焦点及遍历断言；无声录像。不证明实体设备行为。 退出副本、取消、重新插入及清理。" />

<Clip :autoplay="false" name="list-focus-voiceover-ios" caption="iOS 27 模拟器，使用真实 VoiceOver 与 XCTest 交互。可见焦点及遍历断言；无声录像。不证明实体设备行为。 Core ListView 更新期间按键保留焦点。" />

<Clip :autoplay="false" name="list-focus-talkback-android" caption="Android API 36 模拟器，使用真实 TalkBack 与原生触摸交互。可见焦点及遍历断言；无声录像。不证明实体设备行为。 Core ListView 更新期间按键保留焦点。" />
