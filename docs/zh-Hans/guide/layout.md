# 布局变化 {#layout-changes}

`animateLayout(container)` 对容器的直接子级的下一个布局更改进行动画处理。新行会腾出空间，移除卡片会缩小间隙，对现有视图重新排序会将它们移动到新位置。在 beta.9 中添加。

<Clip name="layout-ios" caption="在 iOS 模拟器中插入、移除、重新排序和扩展原生卡。" />

```ts
import { animateLayout } from '@rafaelaugusto/jolt'

animateLayout(list, () => rows.value.splice(1, 0, newRow))
animateLayout(list, () => rows.value.reverse(), 'snappy')
animateLayout(list, () => {
  expanded.value = !expanded.value
})
```

Vue 子视图使用稳定的钥匙。此 API 跟踪 **查看实例**，而不是数据 ID。支持StackLayout、GridLayout、WrapLayout等普通容器。回收的 ListView/CollectionView 行需要自己的项目动画集成；它们在这个 API 之外。

## 捕获、更改、动画 {#capture-change-animate}

通过回调，Jolt 捕获当前几何图形，同步执行突变，请求布局并在下一次绘制之前应用逆变换。 Vue 的排队 DOM 更新可能发生在突变和布局传递之间。

没有回调，调用后立即更改布局：

```ts
const animation = animateLayout(list, { duration: 350, ease: 'easeOut' })
rows.value.push(newRow)
await animation
```

一次调用涵盖一次布局过程；它不是常驻观察员。调用它获取或等待数据 **之前**。异步回调被拒绝。无操作仍然请求布局传递并在没有固定延迟回退的情况下解析。卸载或折叠的容器会立即应用突变并进行解析，而不会保留在稍后加载时进行动画处理的工作。

只跟踪直接子视图。若容器变大时需要推动相邻视图，应在其父容器上调用 `animateLayout`。嵌套变化可分别在各自的容器上调用。被删除的视图立即移除，其余视图通过动画填补空位；此 API 不会保留已删除的视图来播放退场动画。

## 大小和内容 {#size-and-content}

对于实际宽度/高度更改、固有 `auto` 尺寸和连续文本重排，请使用 [`animateSize()`](./size)。它的每帧布局和取消契约与此 FLIP API 不同。

默认 `size: 'scale'` 从旧尺寸缩放到新尺寸，尊重视图的现有平移、比例和原点。布局本身计算一次其最终尺寸。缩放会暂时拉伸文本、角点和其他内容；它不是连续的文本重排。

使用 `size: false` 在位置变化动画时立即应用新尺寸：

```ts
animateLayout(
  list,
  () => {
    expanded.value = !expanded.value
  },
  {
    size: false,
    duration: 300,
  },
)
```

不测量具有零/非有限维度或折叠可见性的视图。一个变得可衡量的子视图被视为新的。在同一突变中进行原点或旋转更改，并且子级使用 X/Y 3D 旋转，跳过平移/尺度反转；相反，明确地为这些变换设置动画。祖先视图的变换不属于此局部布局计算的范围。

## 选项 {#options}

第三个参数（或没有回调的第二个参数）接受 `'smooth'`、`'snappy'`、`'bouncy'` 或 `LayoutOptions` 对象：

| 选项           | 行为                                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 补间或弹簧设置 | `duration`、`ease`、`times`、`type`、`bounce`、`stiffness`、`damping`、`mass`、`velocity`、 `delay`;与 `animate()` 相同的单位 |
| `size`         | `'scale'`（默认）或 `false`                                                                                                   |
| `enter`        | `true`（默认）将新子项淡入其配置的不透明度； `false` 立即显示它们                                                             |

设置统一应用于子项。持续时间/延迟必须是有限且非负的；物理刚度/质量必须为正，阻尼为非负，弹跳范围为 -1 到 1。基于持续时间的弹簧需要正持续时间；使用零持续时间补间以获得即时结果。重复、相对框架、每个属性覆盖和交错不是布局选项。在突变运行或取消较早的请求之前，无效选项将被拒绝。

全局`timeScale`适用于播放。减少运动使几何体立即稳定并保持可选的不透明度入口，遵循 Jolt 的正常减少运动行为。

## 中断和所有权 {#interruptions-and-ownership}

布局之前的第二个请求将替换待处理的请求。在播放期间，新的更改会在下一个布局过程中读取旧动画的实时姿势，并在取消旧手柄之前开始替换轨道。现有的应用程序翻译/比例保持静止值；他们不会被迫为零/一。

捕获后开始的显式动画保留其属性的所有权。几何播放根据需要和输入子项的不透明度拥有`x`、`y`、`scaleX`、`scaleY`。不相交的属性通常继续存在。

返回的 `Animation` 是可等待的，暴露 `finished`，并且有 `stop()`。完成解析 `true`；更换或取消解决 `false`。 **停止将此操作的临时偏移设置到最终布局中**，而不是将卡片留在其布局位置之间。清理保留了新的动画所有者。它不会撤消数据突变。此聚合句柄不会公开暂停或清理。

原生卸载和应用程序暂停取消请求/播放并删除侦听器。使用组件所有权范围：

```ts
const scope = motionScope() // or useMotionScope() in Vue setup
const animation = scope.animateLayout(list, () => rows.value.reverse())
// scope.reset(), scope.suspend() and scope.dispose() cancel owned layout work.
```

清理后同步重新抛出突变异常。停止部分开始的工作后，准备原生播放时出现意外错误拒绝 `finished`。

## 原生绘图和触摸几何 {#native-drawing-and-touch-geometry}

Jolt 读取父 DIPs 中未转换的原生边​​界。 Android 从一次性预绘制侦听器开始播放。 iOS 等待容器的 NativeScript 布局方法完成，然后在绘制之前写入逆变换。在JavaScript中进行一次测量和反演；之后曲线会自然播放。

布局轨道自动选择 iOS 上的 [交互式几何驱动程序](./interaction-surface)，以便移动控件在其可见位置保持可点击状态。仅选择这些新曲目；这不会迁移不相关的现有动画。布局操作之外的动画祖先仍然需要自己的交互界面。 iOS 播放使用原生 UI 线程，因此繁重的主线程 JavaScript 会延迟它。 iOS 集成还可以处理 NativeScript 的缓存变换标志，同时交互式轨道分配新的原生帧；钩子是受影响实例的本地钩子，并在完成/取消时被删除。

在 Playground 中打开 **布局更改**，或者在 iOS 上启动 `--layout-lab` / 在 Android 上启动 `--es layout-lab true`。该演示包括插入/删除、重新排序、扩展、慢动作、大小策略、停止、减速运动和卸载/重新安装。请参阅 [验证报告](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/layout-lifecycle.md) 了解原生和操作系统输入覆盖范围。
