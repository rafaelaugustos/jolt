# 滚动联动动画 {#scroll-linked-animations}

构建一次动画，然后让 `ScrollView` 选择其框架：

<Clip name="scroll-linked-ios" caption="真正的滚动会折叠大标题并显示紧凑标题，然后将其恢复。 iOS simulator." />

```ts
import { scrollLinked } from '@rafaelaugusto/jolt'

const unlink = scrollLinked(
  scrollView,
  header,
  { y: [0, -60], opacity: [1, 0] },
  { range: [0, 120] },
)
```

在偏移量 0 处，标头从 `y: 0` 开始，不透明度为 1。在 60 DIPs 处，它到达 `y: -30`，不透明度为 0.5。在 120 DIPs 处，它保存着最后一帧。向后滚动会反转它，包括到达任一端点后。过卷被夹紧。

插值是线性的，具有等间隔的关键帧。 [`animate()`](./animating) 支持的所有属性均可用，包括其平台限制内的 [颜色](./colors) 和 [装饰品](./decorations)。标量值或 `null` 捕获目标加载时的起始值。

## 范围和轴 {#range-and-axis}

`range` 是 DIPs 中一对不同的有限偏移。降序范围反转映射：

```ts
scrollLinked(scrollView, badge, { opacity: [0, 1] }, { range: [120, 0] })
```

默认轴为 `y`。对于水平 ScrollView，选择 `x`：

```ts
scrollLinked(
  carousel,
  artwork,
  { rotateY: [-15, 15] },
  {
    range: [0, 300],
    axis: 'x',
  },
)
```

两个参数都接受原生视图或框架包装器，就像 `animate()` 一样。源必须持有 NativeScript `ScrollView`；此助手不附加到 ListView 或自定义原生滚动条。当前偏移量会立即应用并在加载时刷新，因此恢复的滚动位置不需要新的手势来更新目标。在目标加载之前进行的调用会记住最新的进度。

## 清理和中断 {#cleanup-and-interruption}

返回值是幂等清理函数：

```ts
unlink() // remove the binding and freeze the properties at their current frame
```

卸载任一视图也会删除绑定并释放其动画。重用已卸载的屏幕时创建新的绑定。停止或替换每个链接的属性也会删除侦听器。仅替换一个属性可以让其余属性跟随滚动，而无需收回替换的属性。其他动画和滚动侦听器保持独立。

动画在整个绑定过程中保持暂停状态，包括在进度 1 时。它不会仅仅因为用户到达范围的末尾而结束。如果视图应继续自行移动，则在取消链接后单独使用 `animate()`。

## 时间和成本 {#timing-and-cost}

每个滚动事件都会在暂停的动画上同步设置一个 `progress` 值。重复的值（包括固定的过度滚动）将被跳过。每个事件没有计时器、动画帧回调、新曲线计算或调用 `animate()`。

播放驱动程序仍然寻找它们拥有的每个属性：这不是对任意数量的属性的单个原生桥调用。 iOS 应用相应的暂停的 Core Animation 副本； Android 重新定位原生动画师。滚动传递和进度更新需要在主线程上使用JavaScript。这不是一个可以在 JavaScript 被阻止时继续跟踪输入的原生滚动时间线； Android 的 [UI 线程限制](./android-performance) 仍然适用。

游乐场使用主 ScrollView 来移动和淡出大标题，同时显示固定的紧凑标题。两个方向都使用这个公共 API。

要从一个偏移驱动多个视图，或通过每个属性的范围映射它，请将 [`scrollValue()`](./motion-values#scroll-offsets) 与 `bind()` 结合使用。它直接写入绑定属性，并且每个事件的成本大约是 Android 上的一半。
