# 实际尺寸 {#real-dimensions}

`animateSize()` 更改视图的实际 `width` 和 `height`，包括与 `auto` 之间的转换。文本重排，图标保留其比例，兄弟姐妹在普通 NativeScript 布局中移动。用它来扩展卡片和手风琴。

自 **0.1.0-beta.15** 起在核心包中可用。不需要可选的原生属性插件。

<Clip name="size-ios" caption="iPhone 17 模拟器、iOS 26.0 中的实际宽度/高度、内在内容更改、暂停、反转和可点击的下一行。控件明确为中断段选择0.25×速度； video timing is unchanged." />
<Clip name="size-android" caption="原生 Android 16 模拟器演示：宽度和高度回流、内容驱动的自动调整大小、暂停/恢复、中断和 GridLayout。在应用程序中选择慢动作；这些是真正的 ADB 触摸。" />

```ts
import { animateSize } from '@rafaelaugusto/jolt'

await animateSize(card, { height: 'auto' }, 'snappy')
await animateSize(card, { height: 80 }, { duration: 300 })
await animateSize(card, { width: 240, height: 'auto' }, 'smooth')

// Capture the current bounds BEFORE changing content.
await animateSize(
  card,
  { height: 'auto' },
  () => {
    description.text = longerDescription
  },
  { duration: 350 },
)
```

这与 [`animateLayout()`](./layout) 是分开的。 FLIP 测量一次最终布局，然后进行动画变换；它的大小模式可以缩放内容。 `animateSize()` 在播放过程中进行测量和实际布局。这两个 API 都不是共享元素导航转换。 `animate()` 关键帧继续排除宽度/高度。

## 目的地和集装箱 {#destinations-and-containers}

通过一维或两个维度。目的地是有限的非负 DIP 编号或 `'auto'`；在替换现有尺寸动画之前，数组、百分比字符串、单位对象和未知属性将被拒绝。现有的 NativeScript 数字、DIP/px 声明和 `auto` 可以作为起点；动画轴上的百分比声明被拒绝。祖先百分比可以在布局树中正常解析。

`auto` 遵循视图的 **现有对齐和父约束**。这是父母允许的内在尺寸；拉伸的横轴可以填充可用的槽。当您需要约束轴的固有尺寸时，请设置 `horizontalAlignment="left"` 或 `verticalAlignment="top"`。 Jolt 不会更改对齐方式、填充、边距或剪裁。如果在关闭时应隐藏溢出的子项，请在手风琴上设置 `clipToBounds="true"`。

| 容器或分配                                                    | 合同                                                                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 垂直/水平 StackLayout 的直接子级                              | 支持；以下兄弟姐妹参与每个布局。                                                                                   |
| GridLayout 的直接子代                                         | 支持； `auto` 行/列随内容增长。固定轨道或 `*` 轨道保留其自己的分配，因此调整内部视图的大小不会为轨道定义设置动画。 |
| 嵌套在 ScrollView 内的堆栈/网格                               | 支持；真实内容边界更新滚动。不要使用此 API 对 ScrollView 的内容偏移进行动画处理。                                  |
| 宽度和高度                                                    | 在目的地宽度处一起测量；文本在每个中间宽度处换行。还通过 `height: 'auto'` 来动画改变高度包络线。                   |
| FlexboxLayout、WrapLayout、AbsoluteLayout、自定义直接父级     | 被拒绝。布局策略需要单独验证。                                                                                     |
| 回收的 ListView/CollectionView 单元、虚拟化或自定义测量的后代 | 不支持；没有回收电池所有权或测量合同。                                                                             |

家长分配仍然具有权威性。值和弹簧超调被限制为零和最小/最大约束；如果 min 超过 max，则 max 获胜。最小/最大之外的数字目标将设置为固定数字。 `auto` 目标恢复 **语义自动**，允许以后的内容更改正常调整大小。

## 内容、中断和控制 {#content-interruption-and-controls}

可选的更改回调在捕获旧边界后同步运行。 Vue 的排队视图更新可以在第一次测量之前运行。调用前获取数据；异步回调被拒绝。播放期间的文本、图像、字体和父级约束更改将在后续动画帧上重新测量。更改的端点从当前实际边界开始，携带当前曲线速度并降低原始延迟。因此，不断变化的内容可以延长完成时间。完成后Jolt停止观察；再次调用以动画稍后的更改。

一个操作拥有所请求的视图轴。该视图上的第二个 `animateSize()` 替换整个旧操作，将其解析为 `false`，并从当前边界开始；新请求省略的任何先前拥有的轴都会返回到其原始声明。其他变换/不透明度轨道保持独立。

```ts
const animation = animateSize(card, { height: 'auto' })
animation.pause() // hold actual bounds, no pending frame callback
animation.play() // remeasure on resume
animation.stop() // keep current size as local numeric declarations
// Alternatively: animation.stop({ restore: true })
// releases the temporary overrides, revealing the original local/CSS declarations.
const completed = await animation.finished
```

完成解析 `true`；更换、停止、卸载和后台暂停解决`false`。卸载/折叠的视图或没有初始布局分配的树会应用目标而不保留播放并解析 `false`。卸载/后台恢复原始声明，因此回收或重新加载的视图不会滞留在中间尺寸。清理后，意外的测量错误拒绝 `finished`。

对拥有的维度进行显式本地或 CSS 写入会取消操作并取得所有权，包括隐藏在其临时覆盖下的写入。无主维度将被保留。 Jolt 拒绝替换现有尺寸的 CSS 关键帧动画。内容突变永远不会因取消而撤销。

使用`motionScope().animateSize()`或Vue的`useMotionScope().animateSize()`。作用域暂停暂停；简历继续；重置/处置停止并保持当前的数字大小。减少运动到达目的地，包括暂停时的偏好变化。全球`timeScale`适用； Android 播放使用系统动画时钟。支持补间/弹簧、缓动和延迟。故意不支持重复、任意关键帧时间和搜索，因为内在端点可能会发生变化；这是 `SizeAnimation`，而不是 `PlaybackAnimation`。

## 执行和成本 {#execution-and-cost}

**此 API 在每个动画帧的 UI 线程上运行 JavaScript 和 NativeScript 布局。** 库拥有的 CADisplayLink/Choreographer 回调对曲线进行采样，探测现有树中的目标，恢复当前尺寸并在绘制之前布置树。它不会创建重复/可访问性视图，并且从不绘制推测端点。两个轴共享一个测量通道；没有应用程序计时器。默认变换动画保留其现有的原生播放路径。

初始实现每帧探测目的地以检测内在变化。预计每个活动操作/框架有两个根测量调用和一个显式布局，以及框架传递。多个动画视图和深树会增加成本；这不是渲染线程独立性。主线程 JS 停止该动画。当不需要回流焊时，首选基于变换的 `animateLayout()`。

在playground中打开**Real dimensions**，或者在iOS上启动`--size-lab` /在Android上启动`--es size-lab true`。 [原生验证报告](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/size-layout.md) 记录容器覆盖范围、运行时版本、实际边界/命中测试和测量的布局成本。模拟器/仿真器结果并不是设备性能的保证。
