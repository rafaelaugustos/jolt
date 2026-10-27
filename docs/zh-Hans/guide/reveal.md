# 圆形揭示 {#circular-reveal}

从一个点显示内容，或以相反的效果隐藏它：

<Clip name="reveal" caption="圆形显示和隐藏。" />

```ts
import { reveal, conceal } from '@rafaelaugusto/jolt'

await reveal(details, { from: { x: 40, y: 40 }, duration: 500 })
await conceal(details, { to: { x: 40, y: 40 }, duration: 500 })
```

这两个函数都接受视图或持有视图的引用。在 iOS 上，临时 `CAShapeLayer` 蒙版在 Core Animation 中为其圆形路径设置动画，每帧无需 JavaScript 工作。圆圈增长得足以覆盖每个角落，包括视图之外的原点。

## 选项 {#options}

| 选项                 | 默认  | 含义                                                 |
| -------------------- | ----- | ---------------------------------------------------- |
| `from` 在 `reveal()` | 中心  | 圆原点，从目标左上角起，DIPs 内有有限的 `x` 和 `y`。 |
| `to` 在 `conceal()`  | 中心  | 在相同的坐标中，圆收缩的方向。                       |
| `duration`           | `400` | 非负有限毫秒。零立即改变可见性。                     |

曲线是缓入缓出的。当中断活动的显示或隐藏时，省略该点将保留当前圆的中心。这些功能目前支持圆形蒙版；不包括擦拭巾和其他形状。

## 可见性和布局 {#visibility-and-layout}

`reveal()` 使目标在扩展遮罩后面可见。 `conceal()` 以 `view.visibility = 'hidden'` 结尾，因此它保留其布局空间并且不再接收触摸。隐藏已经隐藏或折叠的目标会使其可见性保持不变。

遮罩不会调整视图大小或重新定位视图。现有蒙版（包括 Core 的剪切路径和不均匀的圆形边框）保留在临时蒙版内，并在之后恢复。保留不透明度和变换。

已卸载的视图等待加载、窗口和非零边界。首先显示折叠的目标将其更改为 `hidden`，以便可以对其进行测量。当其空间应该已被保留时，首选最初隐藏的目标。

如果应用程序状态也控制`visibility`，请使其与效果保持同步。在播放期间，遮罩仅剪辑渲染；视图的矩形触摸区域在隐藏完成之前保持不变。在视图自己的图层之外绘制的阴影不包含在圆形遮罩中。

## 中断和清理 {#interruption-and-cleanup}

结果有 `finished`、`stop()` 和 `then()`，如 `animate()`：

```ts
const opening = reveal(details, { duration: 800 })
// A later action can reverse from the circle currently on screen.
const closing = conceal(details)

await opening // false: superseded
await closing // true if it reached the hidden state
```

原生完成解析为 `true`。停止、取代、卸载或原生取消通过 `false` 解决。替换运行效果之前抛出无效选项。使用返回的句柄； `stop(view)` 控制 `animate()` 轨道。

`animation.stop()` 移除临时遮罩并恢复中断的显示/隐藏链之前的可见性。它不会留下冻结的部分掩模。外部可见性更改会取消动画，同时保留应用程序的新值。

更改边界、原生视图、背景或剪辑样式会取消效果并恢复之前的可见性。布局/样式更改完成后启动新效果。卸载取消，重新加载时不会重播。完成和取消删除原生动画、遮罩、侦听器和减少运动观察者。保留手柄并在处置所属组件时将其停止。

将此效果与另一个主动管理蒙版的效果（例如 `shimmer()`）组合时，请使用单独的包装视图。

## Reduce Motion and platforms {#reduce-motion-and-platforms}

启用“减少运动”后，将立即应用最终可见性，结果为 `true`。在播放期间启用它也会立即完成效果，如果稍后禁用它，则不会重播。

这个实现是**仅 iOS**。 Android 调用可通过 `false` 进行解析，而无需更改视图。
