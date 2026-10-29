# 折叠页眉 {#one-scroll-a-complete-page}

`scrollHeader()` 将 Core ListView 连接到测量的英雄、视差图稿、紧凑的工具栏和一个固定部分。在双语预览中打开 **滚动**：八十个循环播放的曲目、带有更高标题的异步加载封面、在视口上方插入和原生滚动到项目控件。

自 **0.1.0-rc.1** 起可用。重建原生应用程序。

<Clip name="scroll-header-ios" caption="iOS 26.2模拟器，英文：真实拖动、过度滚动拉伸、反转、猛击、更高的封面/标题、插入和程序化返回。原速度；模拟器的正确性，而不是真机的性能。" />
<Clip name="scroll-header-ios-pt" caption="iOS 模拟器，葡萄牙语：与实际操作系统输入和翻译控件相同的原生组成。" />
<Clip name="scroll-header-android" caption="Android 16 模拟器，英语：真正滚动循环行、锚定布局更改和原生滚动到项目。此适配器使用普通 Android 过卷，无装饰英雄拉伸。" />
<Clip name="scroll-header-android-pt" caption="Android 模拟器，葡萄牙语：实际输入与葡萄牙语页面相同。触摸指示器显示真实手势；素材未加速。" />
<Clip name="scroll-header-lifecycle-ios" caption="iOS 26.2 模拟器，英文：更高的封面、原生列表卸载与重新加载、横竖屏旋转、惯性滚动中离开及重新进入页面。真实系统输入，原速播放；不代表真机性能。" />
<Clip name="scroll-header-lifecycle-android" caption="Android 16 模拟器，英文：保持滚动位置的封面尺寸变化、卸载与重新加载、旋转、快速滑动后离开及返回后继续滚动。通过 ADB 注入真实输入，原速播放；仅验证模拟器行为。" />

## 构建支持的布局 {#build-the-supported-layout}

使用单个平面 **核心ListView**，使用不可访问的间隔符作为第 0 行，并在其后使用固定高度的数据行。该列表填充有界的 GridLayout。按顺序将保留的英雄、部分和工具栏绘制为兄弟姐妹。美术作品和扩展标题属于英雄；紧凑的标题属于工具栏。不要将此列表包装在垂直的 ScrollView 中。

```ts
import { scrollHeader } from '@rafaelaugusto/jolt'

const page = scrollHeader(list, {
  header,
  artwork,
  title,
  toolbar,
  toolbarTitle,
  section,
  rowHeight: 76, // DIPs; every data row has this height
  setSpacerHeight(height) {
    spacerHeight = height
    list.refresh()
  },
  keys: () => tracks.map((track) => track.id), // excludes the spacer
  parallax: 48,
  titleFade: [0, 0.7], // fractions of the measured collapse range
  toolbarFade: [0.55, 0.95],
  stretch: true, // iOS; Android has a no-stretch fallback
  onState(state) {
    // Phase/layout boundaries, never an animation-frame driver.
    console.log(state.phase)
  },
})

await page.remeasure()
await page.preserveAnchor(() => {
  tracks.unshift(newTrack)
  list.refresh()
})
page.scrollToItem(35, true) // data index, excluding the spacer
page.scrollToTop(true)
// When the screen is no longer owned:
page.dispose()
```

行模板实际上必须强制其大小。当列表具有自动行大小调整功能时，Core 9.1.3 Android 会重置根单元格的 `height`：将根单元格的 **minHeight 和 maxHeight** 设置为固定行高，并将间隔符的最小/最大值设置为 `spacerHeight`。保持 ListView 自己的 `rowHeight` 自动，这样第 0 行可以有不同的高度。不要添加垂直行边距。该适配器在其偏移数学中包括 Android 分隔像素和物理像素舍入。

请参阅完整的 [Vue 屏幕](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/components/ScrollHeaderLab.vue) 和 [回收单元模板](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/showcase/scroll-header-cells.ts)。该组合提供了运动和滚动几何形状；该应用程序拥有数据、模板、图像和路线。覆盖背景应该传递除控件之外的触摸；该参考使用 `isPassThroughParentEnabled` 和非交互式装饰标签。

## 偏移、几何形状和锚点 {#offset-geometry-and-anchors}

布局后测量英雄高度；工具栏提供其最小高度。显式 `expandedHeight` 和 `minimumHeight` 会覆盖这些测量值。折叠范围为`expanded − minimum`，第0行占据`expanded + section`。该部分从英雄的底部移动到工具栏的底部。一旦固定，滚动将继续浏览虚拟列表，而无需第二个滚动所有者。

规范偏移量位于 DIPs 中。 iOS 使用 `contentOffset.y + adjustedContentInset.top`，包括负反弹。 Android 从第一个可见行的索引和顶部、填充、间隔高度和行/分隔符步幅派生。将兄弟覆盖层保留在与列表相同的安全区域调整父级中。第一个适配器不需要在该视口内添加额外的应用程序拥有的顶部内容插入/填充；它不会获取系统栏的所有权或更改列表的插入。

后期标题调整大小将间隔高度差添加到现有偏移量，从而将数据行保持在其屏幕位置。在绝对顶部，它保持为零，因此新的盖子仍然可见。 `preserveAnchor()` 另外遵循固定部分下方第一行的稳定键。如果该键消失，它将使用最近的幸存数据索引。偏移量限制在实际内容范围内；因此，短/空内容可以返回到顶部。变更是序列化的；等待一项更新后再开始另一项更新。对于反应性数据，请在回调内等待框架更新。页面顶部插入有意显示新的第一项。

`remeasure()` 也在相关布局事件上运行，包括环绕和旋转。 `pause()` 断开滚动源； `play()` 对其当前位置进行采样。列表卸载会释放原生侦听器和图表，并且重新加载会附加新的所有者。 `dispose()` 恢复拥有的变换、剪辑、可访问性和委托所有权，以及 `originalSpacerHeight`（默认为零）。当合成拥有这些相同的覆盖属性时，不要从另一个控制器对它们进行动画处理。

`remeasure()` 返回的 Promise 会等待测量期间新请求的布局更新完成。如果列表卸载取消了测量，Promise 会拒绝；列表再次加载时仍会自动重新连接。只有原生滚动位置恢复完成后，`ready` 才为 true。在 iOS 上，适配器还会为此扁平列表禁用分区页眉和页脚的自动高度估算，并在释放时恢复原值；如果应用已更改这些值，则保留应用的设置。

## 原生输入和限制 {#native-inputs-and-limits}

在 iOS 上，KVO 观察涡旋几何形状。每个列表的委托代理提供精确的间隔/数据高度并转发 Core 的其他委托方法，防止估计高度校正在刷新期间移动锚点。如果代理仍然拥有它，则处置将恢复以前的委托。 Android 观察原生滚动/布局更改，而无需替换 Core 的适配器、滚动侦听器或项目回调。这两个平台都没有添加 JS 滚动处理程序。两者都会更新现有的本地实时值图； JS 用于设置、布局/数据更改、生命周期和粗略状态回调。单元实现/绑定仍然正常 Core ListView 工作，并且可能会进入 JS。

`state` 是具有 `offset`、`phase`、原生 `updates`、语义 `callbacks` 和可见/总行数的按需快照。可选的 `diagnostic` 标签显示那些没有 JS 框架更新的原生计数。这是诊断仪器，而不是性能保证。特别是，Android 的 JS 和视图工作共享 UI 线程：此 API 无法使滚动不受 UI 线程阻塞的影响。

Reduce Motion 保持固定和滚动，禁用装饰性视差/拉伸，使用立即标题切换并禁用动画编程滚动。一次只有一个游戏参与辅助功能。固定高度数据模板的大小必须适合应用程序选择的大文本比例；第一个适配器不支持可变高度数据行。

| 组合                                               | 第一份适配器合同                                             |
| -------------------------------------------------- | ------------------------------------------------------------ |
| 核心 9.1.3 扁平 ListView，1 个垫片和固定数据行     | 两个平台都支持参考                                           |
| 短/空数据                                          | 真实内容程度；没有强制幻像滚动空间                           |
| iOS 反弹                                           | 可选的图稿拉伸；原生列表拥有手势                             |
| Android 过度滚动                                   | 平台边缘行为，无装饰英雄拉伸                                 |
| 下拉刷新                                           | 未安装识别器；刷新集成尚未经过验证，并且在此里程碑中不受支持 |
| 核心分段/粘性标题/搜索模式                         | 被拒绝；该组合拥有固定几何体                                 |
| 其他列表插件、可变数据行、嵌套垂直滚动、分页选项卡 | 不支持；没有静默的 JS 回退                                   |

[原生验证和复现说明](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/scroll-header.md) 记录了本次交付所采用的模拟器验证结果。真机性能测量、VoiceOver/TalkBack 遍历和下拉刷新集成不属于本次正确性修复的范围；后续适配器工作由 #116 跟踪。
