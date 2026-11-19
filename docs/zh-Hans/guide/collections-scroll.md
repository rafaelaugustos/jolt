# 集合与连续滚动

**已包含在 0.1.0-rc.16 中（Beta）。** 涵盖 [#495](https://github.com/rafaelaugustos/jolt/issues/495)、[#496](https://github.com/rafaelaugustos/jolt/issues/496) 和 [#510](https://github.com/rafaelaugustos/jolt/issues/510), [#511](https://github.com/rafaelaugustos/jolt/issues/511), [#512](https://github.com/rafaelaugustos/jolt/issues/512), [#513](https://github.com/rafaelaugustos/jolt/issues/513)。请安装版本一致的核心包与原生插件，并在升级后重新构建原生应用。SwiftUI 在 iOS 17+、macOS 14+ 上仍为 Beta。

## CollectionView 适配器 {#collections}

`collectionViewListAdapter` 和 `collectionViewReorderAdapter` 支持可选插件 `@nativescript-community/ui-collectionview`（已测试 6.1.3），要求单列纵向布局、稳定键，不使用反向布局或插件的 `reorderEnabled`。适配器读取实际挂载的原生几何信息，不向 Jolt 引入插件依赖。网格、分区和跨列表移动不在范围内。

`listChanges` 捕获可见行，应用不可变更新，保留首个可见键及行内偏移，再动画呈现新的原生布局。所有结构变更均通过 `update`；不要让其他布局控制器同时操作这些行。回收视图在接收新身份前恢复原状态。退出副本和中断保持现有的有界生命周期。参见[组合值、滚动与列表](./values-scroll-lists)。

Reorder 在原生端完成拾取、预览、边缘滚动和回收单元格恢复。提交包含稳定键和插入位置的键，由应用更新一次数据。Android 上集合必须是 `ReorderSurface` 的唯一子视图。若包含父面板，将该表面放在 `GestureSurface` 内。两个控制器挂载后，为面板声明 `waitFor`：长按识别前移动会正常滚动，识别成功后由 reorder 接管拖动。重新挂载后需重建关系。

```ts
import { collectionViewListAdapter, listChanges } from '@rafaelaugusto/jolt'
import { collectionViewReorderAdapter, reorder } from '@rafaelaugusto/jolt/reorder'
import { gestures, scrollHandoff, gestureRelations } from '@rafaelaugusto/jolt/gestures'

const changes = listChanges(collection, {
  key: (item: Item) => item.id,
  adapter: collectionViewListAdapter<Item>(collection),
})
changes.update(nextItems)
// Dispose changes before switching ownership to interactive reorder.
changes.dispose()
const sorting = reorder(collectionViewReorderAdapter<Item>(collection), {
  key: (item) => item.id,
  onCommit: (move) => commitByKey(move.key, move.beforeKey),
})
const panel = gestures(surface, {
  pan: { axis: 'y', bounds: { top: 0, bottom: 180 } },
  scrollView: scrollHandoff(collection),
})
const links = gestureRelations([{ gesture: panel, other: sorting, relation: 'waitFor' }])
// Teardown: links.dispose(); panel.dispose(); sorting.dispose().
```

## 连续交接 {#handoff}

`scrollHandoff(view, { axis })` 将现有 `gestures(..., { scrollView })` 和 `bottomSheet` 输入约定扩展至 Core ListView、线性 CollectionView 和横向 Core ScrollView。面板与滚动容器必须同轴，滚动容器必须是表面的后代。面板边界以 DIP 显式提供。Core ListView 和 bottom sheet 仍为纵向；CollectionView 要求匹配的线性轴和单列。先展开面板，再滚动内容；反向时先把内容滚回起点，再收起面板。只有最终所有者接收释放速度，单位为 DIP/秒。

替换数据会取消当前接触。改变布局约定会销毁手势控制器；改变方向、列数、行列尺寸或布局样式后需重建。取消、卸载、暂停和销毁会释放原生输入与 delegate 租约，保留应用已有监听器。原生交接和 reorder 不需要逐帧执行应用 JavaScript。自定义滚动控件仍需受支持的原生后端；任意视图并不自动成为可移植适配器。

`JoltBottomSheet` 现在能在 iOS、macOS 上把同一次 SwiftUI 接触连续交接给面板和内容。原模型仍拥有停靠点及有限释放时钟。UIKit pan 与 AppKit 鼠标/滚轮驱动该模型，不重复应用滚轮惯性。内容点击、文本输入、键盘和减少动态效果继续可用。嵌套 UIKit 滚动视图保留自己的输入。场景失活、重新挂载或销毁会取消连接。这是应用内面板，并非系统 sheet；XCTest 滚轮事件不能证明实体触控板手感。

## 横向顺序与滚动值 {#horizontal}

原生已挂载行支持 `axis: 'x'` 和 `direction: 'ltr' | 'rtl'`。数组保持逻辑顺序，实际目标必须按该方向排列且不重叠；宽度可以不同。RTL 不改变纵向索引含义。Web 使用现有 `reorder`、`axis: 'x'` 及容器 CSS `direction`；RTL 预览现在遵循逻辑顺序。边缘滚动、取消和生命周期仍遵循原有约定。

原生 `scrollValue` 支持 Core 横向/纵向滚动和线性 CollectionView。Android 回收列表的 `rowHeight` 表示**实际固定项目步距，单位 DIP**（x 轴使用宽度），包含间距，未必等于插件请求的尺寸。本次请求 64 DIP 的行实际测得 49.524 DIP。iOS 直接读取内容偏移并加上调整后的 inset。原生横向偏移始终以物理左侧为零，即使是 RTL；iOS 回弹可为负，已验证的 Android 范围则受边界限制。这些是滚动单位，不是项目索引。

内部基准以相同的五个绑定属性比较原生与 JavaScript 生产者开销，不含后续图求值、绘制或全应用 CPU/PSS。模拟器时间不能代表实体设备性能。参见[验收报告](https://github.com/rafaelaugustos/jolt/blob/feat/rc16-collections-scroll/benchmarks/collections-scroll/README.md)。

## Web 与生命周期限制 {#web}

复用 Web `listChanges`、显式虚拟化适配器、`scrollValue` 和嵌套滚动手势。执行仍受浏览器调度，不承诺原生线程或相同像素。Reorder 仅操作提供的已挂载窗口；接触期间更换键或 DOM 目标会在过期提交前取消。若虚拟化期间必须连续拖动，请保持该窗口挂载；Jolt 不提供浏览器虚拟列表引擎。现有按钮/键盘替代操作和减少动态效果继续保留，本批次不扩展无障碍工作范围。

## 真实录制 {#evidence}

<Clip name="collection-motion-ios" caption="iPhone 17 Pro · iOS 27 模拟器，真实 XCTest 输入。 集合更新、回收重排、边缘反向与取消。" />

<Clip name="collection-motion-android" caption="Pixel 7 · Android API 36 模拟器，真实系统触摸。 集合更新、回收重排、边缘反向与取消。" />

<Clip name="scroll-handoff-ios" caption="iPhone 17 Pro · iOS 27 模拟器，真实 XCTest 输入。 同次接触展开、滚动并反向，覆盖 ListView、CollectionView 与横向 ScrollView。" />

<Clip name="scroll-handoff-android" caption="Pixel 7 · Android API 36 模拟器，真实系统触摸。 同次接触展开、滚动并反向，覆盖 ListView、CollectionView 与横向 ScrollView。" />

<Clip name="horizontal-reorder-edges-ios" caption="iPhone 17 Pro · iOS 27 模拟器，真实 XCTest 输入。 不同宽度的 LTR/RTL 顺序、两侧边缘、反向、取消与减少动态效果。" />

<Clip name="horizontal-reorder-edges-android" caption="Pixel 7 · Android API 36 模拟器，真实系统触摸。 不同宽度的 LTR/RTL 顺序、两侧边缘、反向、取消与减少动态效果。" />

<Clip name="scroll-source-ios" caption="iPhone 17 Pro · iOS 27 模拟器，真实 XCTest 输入。 五个绑定属性、原生/JS 偏移比较、横向 RTL 与 CollectionView。" />

<Clip name="scroll-source-android" caption="Pixel 7 · Android API 36 模拟器，真实系统触摸。 五个绑定属性、原生/JS 偏移比较、横向 RTL 与 CollectionView。" />

<Clip name="swiftui-sheet-continuity-ios" caption="iOS 27 模拟器: 真实输入：面板与内容连续交接、操作按钮及重新挂载。英文界面，原速。" />

<Clip name="swiftui-sheet-continuity-macos" caption="macOS 原生应用: 真实输入：面板与内容连续交接、操作按钮及重新挂载。英文界面，原速。" />

<Clip name="horizontal-reorder-web" caption="macOS 上的 Chromium：真实鼠标输入展示 LTR/RTL 提交、边缘反向和 Escape 取消。英文界面。" />
