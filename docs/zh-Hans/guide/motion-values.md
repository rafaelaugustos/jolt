# 动画值 {#motion-values}

对于跟随变化值的保持弹簧，请参见 [`springValue()`](./live-springs)。

动画值是一个数字，它本身具有动画效果并驱动与其绑定的每个视图属性。一个值可以移动一张纸、使背景变暗并缩小其后面的页面，所有这些都在一个本地时钟上完成：

```ts
import { animate, bind, motionValue } from '@rafaelaugusto/jolt'

const progress = motionValue(0)
bind(page, { scale: progress.to([0, 1], [1, 0.92]) })
bind(backdrop, { opacity: progress.to([0, 1], [0, 0.45]) })
bind(sheet, { y: progress.to([0, 1], [200, 0]) })

animate(progress, 1, 'snappy')
```

<Clip name="motion-values-ios" caption="在 iOS 模拟器上，一个动画值可打开和关闭一张纸、使背景变暗并缩小页面。实时播放。" />

## 映射 {#mapping}

`to(input, output)` 通过输入和输出范围映射值，如 React Native 的 `interpolate`：分段线性，端点输出保持在输入范围之外。通过 `{ clamp: false }` 来延长端点段，从而实现弹簧的超调。输入可以增加或减少，但不能改变方向。它们必须是有限的，每个输入至少有两个输入和一个输出。

```ts
const y = progress.to([0, 0.4, 1], [600, 120, 0])
const tint = progress.to([0, 1], ['#18181B', '#FACC15']) // colors mix in OKLab
const bounce = progress.to([0, 1], [0, 300], { clamp: false })
```

对于偏移量从 `closed` 到 `0` 的图纸，直接映射该方向。每个输出与其输入保持配对，包括颜色：

```ts
const closed = 380
const offset = motionValue(closed)
const open = offset.to([closed, 0], [0, 1])
bind(sheet, { y: offset })
bind(page, { scale: open.to([0, 1], [1, 0.9]) })
bind(backdrop, { opacity: open.to([0, 1], [0, 0.5]) })
animate(offset, 0, 'snappy')
```

这给出了与 `offset.to([0, closed], [1, 0])` 相同的结果，而不改变你的数组。数值外推法在两个方向上都有效；颜色总是固定的。调用 `to()` 时会抛出无效范围，例如 `[0, 1, 0]`。

<Clip name="descending-values-ios" caption="在 iOS 模拟器上，递减的偏移范围驱动纸张的背景和页面比例，包括链接映射、拖动和弹簧释放。实时播放。" />

<Clip name="descending-values-android" caption="Android 模拟器上的降序范围、链式映射和真实的纸张手势。实时播放。" />

在将对按升序排序后，重复输入保留其现有的步骤行为：在内部重复停止处，下部段的输出获胜；就在其上方，该停止处的最后一个输出获胜。在端点处夹紧优先。全等范围将其第一个输出保持在止损点或以下，并将最后一个输出保持在止损点之上；对于`clamp: false`，精确停止时的输出改为第二个输出。

已映射的号码可以再次映射。颜色输出绑定到 `backgroundColor`、`borderColor` 和 `color`； number 输出绑定到 `animate()` 所采用的其他所有内容，`scale` 设置两个轴。也可以按如下方式绑定值：`bind(dot, { x: offset })`。

## 动画和设置 {#animating-and-setting}

`animate(value, to, transition)` 采用数字或关键帧以及与 `animate()` 相同的过渡：补间、弹簧、`repeat`、`repeatType`、`repeatDelay`、`delay` 和 `easeTrack`。它返回 [`PlaybackAnimation`](./playback)，包括暂停、播放和有限进度。 Jolt 对值的曲线进行一次采样，将其映射到每个绑定，并为每个绑定属性播放一个原生轨道，所有这些都是一起开始的。原生绑定不需要每帧 JavaScript 回调。

```ts
animate(progress, 1, 'snappy')
animate(progress, [0, 1, 0.6], { duration: 700, times: [0, 0.5, 1] })
animate(pulse, 1, { duration: 900, repeat: Infinity, repeatType: 'reverse' })
```

中断另一个动画的动画从屏幕上的值及其速度开始，因此每个绑定视图都会一起旋转。 `set(value, number)` 立即将值应用于每个绑定视图。 `stop(value)` 保留值及其视图。 `value.get()` 现在读取该值，同时它也会显示动画。

使用 [减少运动](./configure#reduced-motion)，绑定变换会跳转到其末尾，同时不透明度和颜色仍然具有动画效果。 [时间尺度](./configure#time-scale) 对值的曲线应用一次。

## 观察外部景观 {#observing-outside-views}

`value.subscribe((value, time) => ...)` 遵循 JavaScript 的值，包括数字和颜色推导以及滚动值。它立即传递当前值并返回幂等取消订阅函数。传递 `{ immediate: false }` 仅接收后续更改。

```ts
const release = progress.subscribe((value, time) => {
  // For example, update a SceneKit pose or a custom native renderer.
  stage.setProgress(value)
})
const releaseColor = progress.to([0, 1], ['black', 'white']).subscribe((color) => {
  stage.setTint(color)
})

// Ownership, including scope suspension/resume:
scope.use(() => progress.subscribe((value) => stage.setProgress(value)))
release()
releaseColor()
```

更新共享由 NativeScript 的 CADisplayLink/Choreographer 调度支持的帧源。每个通知批次在调用侦听器之前捕获所有观察到的源，并提供相同的原生时钟时间戳（以毫秒为单位）。在帧合并到最新值之前重复调用 `set()`；未更改的映射输出不会通知。如果最终值发生变化，则完成并停止在下一帧上传递最终值。回调内进行的写入属于下一批。

回调在 JavaScript 中执行；该线程被阻塞时，回调也必须等待。对于支持的外部原生目标，可选的[原生属性适配器](./native-properties)提供编译后的播放与绑定。普通视图绑定无需订阅回调，但仍受平台执行限制。

取消订阅即使在传送过程中也会生效，并且不会停止动画。在观察到的源稳定并传递挂起的写入后，帧源变为空闲。当应用程序在后台运行时，递送会停止；恢复对当前值进行采样，而不重播丢失的帧。侦听器错误会转到 NativeScript 的错误跟踪，并且不会停止其他侦听器。使用`scope.use()`或者消费者销毁时调用返回的函数。

减少运动可保持标量轨迹的定时；绑定变换可能已经结束，而订阅者和绑定颜色仍然遵循标量。外部消费者在应用空间运动时应尊重 `reducedMotion()` 本身。 Android 系统动画器持续时间比例仍然适用于原生时钟，包括禁用动画器时。

<Clip name="value-observers-ios" caption="绑定视图和外部CALayer遵循一个值；在 iOS 模拟器上分离并重新附加订阅者。回调在 JavaScript 中运行。实时播放。" />

<Clip name="value-observers-android" caption="在 Android 模拟器上，绑定视图和原始 Android 视图遵循一个值，具有分离、重新附加和停止功能。回调在 JavaScript 中运行。实时播放。" />

## 值上的图层 {#layers-on-a-value}

命名层将标量偏移添加到其映射的动画值**之前**。基本动画保持自己的时间和速度，同时充电脉冲一起改变每个消费者：

```ts
const charge = motionValue(0)
bind(car, {
  y: charge.to([0, 1], [0, -20]),
  scale: charge.to([0, 1], [1, 1.08]),
  backgroundColor: charge.to([0, 1], ['#14b8a6', '#6366f1']),
})
animate(charge, 1, { duration: 4000 })
animate(charge, [0, 0.12, -0.12, 0], {
  duration: 1200,
  repeat: Infinity,
  layer: 'pulse',
})
```

值图层始终会添加，包括当绑定将结果映射到比例、不透明度或颜色时。他们的中立价值是 `0`。这不同于 [视图属性层](./layers)，它会倍增比例和不透明度。钳位、分段映射和颜色混合看到组合标量； `get()` 和 `subscribe()` 看到同样的构图。

<Clip name="value-layers-ios" caption="当底座不断移动时，电荷脉冲会增加位置、比例和颜色；在 iOS 模拟器上重新定位、移除脉冲并重置。灰点仅显示底座。实时播放。" />

每个名称都有其动画和速度。重新定位该名称只会替换该层；没有 `layer` 的动画仅替换底座。完成的层将保留其最终贡献，直到被移除。返回的 `PlaybackAnimation` 还支持该通道的暂停、播放和有限进度；暂停保持其贡献，而其他渠道继续。停止活动层的句柄会消除其贡献；停止底座手柄可保持底座并让层继续运行。固定的手柄没有任何作用。

```ts
stop(charge, { layer: 'pulse' }) // removes even a completed contribution
// Or ease the contribution back to zero first:
await animate(charge, 0, { duration: 250, layer: 'pulse' })
stop(charge, { layer: 'pulse' })
stop(charge) // freezes the combined value as the new base, clears all layers
set(charge, 0) // cancels all channels and replaces the value
```

拖动动画值仅更改其基础。边界、捕捉点、控制器位置和拖动事件使用基本单位；附加层可以使组合结果超出这些范围。拖动和释放期间图层会继续播放。滚动值仍然是只读输入，并且不公开动画层。

绑定播放已编译的原生组合。它是根据通道更改和拖动输入重建的，而不是在每个帧上重建的。无限的整数毫秒周期使用最多 30 秒的常见原生循环；较长或分数组合，以及长度超过四秒的有限组合，使用在其边界处重建的窗口。原生时钟保持每个通道的相位。选择加入 `subscribe()` 还会额外安排 JavaScript 通知。

<Clip name="value-layers-android" caption="Android 仿真器上的相同基础脉冲和附加脉冲，具有重定向和清理功能。灰点仅显示底座。实时播放。" />

## 绑定 {#binding}

`bind(views, bindings)` 立即为视图提供值的当前状态并使其保持跟随。它返回一个清理函数：之后，视图保持在原来的位置。 `motionScope().use(() => bind(...))` 将绑定绑定到范围。

价值观比其观点更长久。尚未加载的视图在加载时获取其值，并在其到达的点加入正在进行的动画。绑定属性上的常规 `animate()` 或 `set()` 会以其当前值和速度接管该属性；该值不断驱动其其他绑定。 `stop(view)` 停止屏幕上的运动但保持绑定。

## Vue {#vue}

`useMotionValue()` 创建一个在组件卸载时停止的值。 `useBinding()` 返回一个在安装时绑定并在卸载时释放的模板引用，因此由 `v-if` 重新创建的元素会再次选取该值：

```vue
<script setup lang="ts">
import { animate } from '@rafaelaugusto/jolt'
import { useBinding, useMotionValue } from '@rafaelaugusto/jolt/vue'

const progress = useMotionValue(0)
const sheet = useBinding({ y: progress.to([0, 1], [200, 0]) })
const toggle = (open: boolean) => animate(progress, open ? 1 : 0, 'snappy')
</script>

<template>
  <GridLayout :ref="sheet" />
</template>
```

<Clip name="motion-values-android" caption="Android 模拟器上的同一张表，包括中间的一个点击，可将所有三个视图一起旋转。实时播放。" />

## 滚动偏移 {#scroll-offsets}

`scrollValue(scrollView)` 是 ScrollView 在 DIPs 中的偏移量。像任何动画值一样绑定它；每个滚动事件直接写入绑定属性，中间没有动画：

```ts
import { bind, scrollValue } from '@rafaelaugusto/jolt'

const offset = scrollValue(scroll)
bind(header, { y: offset.to([0, 90], [0, -64]) })
bind(title, { scale: offset.to([0, 90], [1, 0.72]), y: offset.to([0, 90], [0, 30]) })
bind(subtitle, { opacity: offset.to([0, 50], [1, 0]) })
bind(progress, { scaleX: offset.to([0, 700], [0, 1]) })
```

<Clip name="scroll-values-ios" caption="在 iOS 模拟器上滚动列表会折叠标题、缩小标题、淡化字幕并填充进度条。实时播放。" />

`{ axis: 'x' }` 遵循水平偏移。该值从当前偏移量开始，`offset.ref(scrollView)` 跟随另一个 ScrollView，或者没有 `null`。 `offset.dispose()` 停止跟随并将绑定视图保留在原处。在 Vue 中，`useScrollValue()` 返回一个值，其 `ref` 继续到 ScrollView 的模板引用，并以组件停止：

```vue
<script setup lang="ts">
const offset = useScrollValue()
const header = useBinding({ y: offset.to([0, 90], [0, -64]) })
</script>

<template>
  <ScrollView :ref="offset.ref">...</ScrollView>
  <GridLayout :ref="header" />
</template>
```

滚动事件到达JavaScript，对于[`scrollLinked()`](./scroll-linked)。对于五个绑定属性，一个事件在 iOS 模拟器和 Android 模拟器上花费约 0.25 至 0.3 毫秒，大约是 Android 上等效 `scrollLinked()` 设置的一半；请参阅 [测量](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/scroll-values.md)。

<Clip name="scroll-values-android" caption="Android 模拟器上的列表后面有相同的标头。实时播放。" />

## 拖动 {#dragging}

`drag(view, { axis, value })` 将手指的位置写入一个值，而不是移动视图，然后在该值上播放释放。与它绑定的所有东西都跟随手指和投掷一起。手势会在您经过的视图上被读取；如果视图应该移动，也绑定该视图：

```ts
import { bind, drag, motionValue } from '@rafaelaugusto/jolt'

const closed = 380
const y = motionValue(closed)
bind(sheet, { y })
bind(page, { scale: y.to([0, closed], [0.9, 1]) })
bind(backdrop, { opacity: y.to([0, closed], [0.5, 0]) })
bind(hint, { opacity: y.to([closed / 2, closed], [0, 1]) })

drag(sheet, {
  axis: 'y',
  value: y,
  bounds: { top: 0, bottom: closed },
  snap: [0, closed / 2, closed],
  rubberband: true,
})
```

<Clip name="drag-values-ios" caption="在 iOS 模拟器上，一张可拖动的工作表驱动一个动画值，该值可缩放页面、使背景变暗并淡化提示，并通过按钮动画化捕捉点、橡皮筋和相同的值。实时播放。" />

`axis` 是 `'x'` 或 `'y'`。事件中的边界、捕捉点和拖动轴均以值的单位表示；另一个轴读数为 0。其他一切都与 [`drag()`](./drag) 中一样工作：橡皮筋、摩擦力、回调和控制器。释放是相同的曲线，采样一次并由每个绑定属性本地播放，直到结束之前 JavaScript 中没有任何内容。 `onRelease` 收到 [`Animation`](./api#animations) 而不是 `PlaybackAnimation`。在释放期间或 `animate(value, ...)` 期间触摸视图，会将值停止在其所在位置，并且手势会从那里继续。

每个平移事件直接写入绑定属性。对于六个绑定属性，一个事件的成本与在 `onMove` 中手工编写它们的成本大致相同：在 iOS 模拟器上大约 0.8 毫秒，在 Android 模拟器上大约 0.25 到 0.35 毫秒；请参阅 [测量](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/drag-values.md)。在 Vue 中，从 `onMounted` 中的 `useMotionScope()` 开始拖动，就像演示的 **拖动值** 屏幕一样。

<Clip name="drag-values-android" caption="Android 模拟器上的同一张纸，在按钮动画仍在运行时在两个方向上都有真实的投掷和抓取。实时播放。" />

## 执行路径 {#what-comes-next}

值层可以与[视图属性层](./layers)组合。最初的 [RFC #152](https://github.com/rafaelaugustos/jolt/issues/152) 已形成不同的执行路径：

| 输入                                                                                                        | 执行方式                                                                  |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 时间线驱动的值与层                                                                                          | TypeScript 准备曲线和组合；原生轨道在状态变化和组合窗口边界之间播放。     |
| `drag()` 与 `scrollValue()`                                                                                 | JavaScript 处理每个输入事件并更新绑定；拖动释放后使用预先准备的原生曲线。 |
| [原生手势](./gestures)、[连续弹簧](./live-springs)、[传感器](./device-sensors)与[滚动页头](./scroll-header) | 支持的输入和绑定由原生代码计算；JavaScript 负责设置和生命周期边界。       |
| `subscribe()`                                                                                               | 通过共享帧源显式使用 JavaScript 观察值。                                  |

原生连续数据源不会将普通的 `drag()` 或 `scrollValue()` 自动变为原生事件路径。各指南说明了支持的属性和生命周期契约。真机上的绑定/层数量预算及复杂界面的测量仍由 [#242](https://github.com/rafaelaugustos/jolt/issues/242) 跟踪。
