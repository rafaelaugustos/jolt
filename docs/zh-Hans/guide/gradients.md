# 渐变 {#gradients}

NativeScript的CSS只有一个静态的`linear-gradient`。 `gradient()` 在布局的子项后面绘制原生线性、径向或圆锥渐变，并为其颜色、色标、角度、中心和半径设置动画：

```ts
import { gradient } from '@rafaelaugusto/jolt'

const glow = gradient(card, {
  type: 'radial',
  colors: ['#A78BFA', '#0F172A'],
  center: { x: 0.3, y: 0.3 },
  radius: 0.45,
})

glow.animate({ center: { x: 0.7, y: 0.7 }, radius: 0.9 }, { duration: 1400 })
```

<Clip name="gradients-ios" caption="在 iOS 模拟器上，线性角度、移动径向光、旋转圆锥扫描和宽视图上的线性带，然后交换线性颜色。实时播放。" />

## 类型和值 {#types-and-values}

| 值       | 含义                                                                                                           |
| -------- | -------------------------------------------------------------------------------------------------------------- |
| `colors` | 两到八种颜色，作为字符串或 `Color`                                                                             |
| `stops`  | 每种颜色所在的位置，从 0 到 1，不返回；默认均匀分布                                                            |
| `angle`  | 度，如 CSS。 `linear` 是这样指出的：从上到下为 180，从左到右为 90。 `conic` 从这里开始：0 向上，颜色顺时针旋转 |
| `center` | `radial` 和 `conic`：视图宽度和高度的分数；默认为`{ x: 0.5, y: 0.5 }`                                          |
| `radius` | `radial`：视图短边的一小部分；默认情况下 0.5 到达较近的边缘                                                    |

线性渐变穿过中心，并且足够长，可以让角获得第一个和最后一个颜色，如 CSS 中一样。在两个平台上，它的带子在任何形状的视图中都保持直角。类型不使用的值将被保留。直接 API 的 `type` 是不可变的：删除它并创建另一个渐变来更改类型。 `v-gradient` 为您处理更换事宜。

## 动画 {#animating}

`animate(values, transition)` 从屏幕上的渐变开始并返回 [`Animation`](./api#animations)。它采用与 `animate()` 相同的过渡：补间、弹簧、`repeat`、`repeatType`、`repeatDelay` 和 `delay`，并遵循 [时间尺度](./configure#time-scale)。

```ts
const sweep = gradient(loader, {
  type: 'conic',
  colors: ['#22D3EE', '#A855F7', '#22D3EE'],
})
sweep.animate({ angle: 360 }, { duration: 2000, ease: 'linear', repeat: Infinity })
```

颜色在 OKLab 中混合，如 [彩色动画](./colors)，并在动画时保持其计数； `set()` 改变它。在弹簧上，角度、中心和半径遵循超调，而颜色和色标保留在其末端之间。渐变一次播放一个动画：新的 `animate()` 接管前一个动画的位置。 `stop()` 保存当前帧，`set(values)` 立即应用值。使用 [减少运动](./configure#reduced-motion)，角度、中心和半径跳到终点，而颜色和色标仍然褪色。

`remove()` 将渐变从视图中移除。卸载视图会停止正在进行的动画。

## 范围和 Vue {#scopes-and-vue}

`motionScope().gradient(target, options)` 返回相同的 `Gradient` 并在范围被释放时将其删除。暂停范围会停止正在进行的动画并保持渐变。在 Vue 中，`useMotionScope()` 将其绑定到组件：

```ts
const scope = useMotionScope()
onMounted(() => scope.gradient(card.value, { type: 'linear', colors: warm, angle: 135 }))
```

`v-gradient` 指令在模板中执行相同的操作。它在元素安装时绘制渐变，在新值发生变化时以动画方式显示，并在卸载时将其删除。将选项与转换或弹簧名称配对以计时更改：

```vue
<GridLayout v-gradient="{ type: 'linear', colors: ['#18181B', '#3F3F46'], angle: 135 }" />
<GridLayout
  v-gradient="[
    { type: 'linear', colors: mood.colors, angle: mood.angle },
    { duration: 700 },
  ]"
/>
```

<Clip name="gradient-directive-ios" caption="在 iOS 模拟器上，一个 v 渐变横幅随着其值的变化而动画化其颜色和角度。实时播放。" />

颜色数量的变化会立即应用，因为渐变在动画时会保持其颜色计数。 `type` 的更改替换了渐变。值是按内容进行比较的，因此模板中写入的对象不会在每次渲染时重新启动动画。

<Clip name="gradient-directive-android" caption="Android 模拟器上的相同横幅。实时播放。" />

## 平台 {#platforms}

在 iOS 上，渐变是视图图层后面的 `CAGradientLayer`，其颜色、位置和点具有 Core Animation 关键帧。在 Android 上，它是堆叠在视图自己的背景上的可绘制对象，并且原生动画师对采样帧进行插值。每帧没有 JavaScript 绘制回调。升级后重新构建 Android 应用程序，以便包含原生类及其桥元数据。

渐变覆盖视图的背景颜色并遵循统一的 `borderRadius`。它位于布局的子项后面。在绘制自己内容的视图（例如 `Label`）上，它会覆盖该内容：将渐变放在其周围的布局上。

<Clip name="gradients-android" caption="Android 模拟器上的相同渐变和颜色交换。实时播放。" />

## 跟随动画值 {#following-motion-values}

将数字运动/派生值传递给 `angle`、`center` 组件、`radius` 或单个 `stops`，并将派生颜色传递给单个 `colors`。静态组件和绑定组件可以共存。 `GradientBindings` 导出用于类型化配置。一个源还可以驱动视图属性、降序映射、外推法和 [标量层](./motion-values)：

```ts
import { animate, bind, gradient, motionValue } from '@rafaelaugusto/jolt'

const offset = motionValue(0)
const progress = offset.to([0, 220], [0, 1], { clamp: false })
const releaseView = bind(thumb, { x: offset, opacity: progress.to([0, 1], [0.5, 1]) })
const glow = gradient(card, {
  type: 'radial',
  colors: [progress.to([0, 1], ['#ed4b82', '#45c8f5']), 'rgba(16,23,43,0)'],
  center: {
    x: progress.to([0, 1], [0.15, 0.85]),
    y: progress.to([1, 0], [0.2, 0.8]),
  },
  radius: progress.to([0, 1], [0.35, 0.9]),
  stops: [0, progress.to([0, 1], [0.45, 1])],
})

const travel = animate(offset, 220, { duration: 3000 })
// travel.pause(), travel.play(), and travel.progress = 0.7 also control the gradient.
animate(offset, [0, 35, 0], { duration: 900, layer: 'pulse' })
// At teardown: glow.remove(); releaseView(); stop(offset).
```

同一合约接受来自 `playbackProgress(animation)` 的映射：例如，`angle: playbackProgress(travel).to([0, 1], [0, 360])` 表示二次曲线梯度。不需要定时器或`subscribe()`。直接将 `value.subscribe(v => glow.set(...))` 替换为源或其 `.to()` 映射，并删除旧的订阅。

<Clip name="gradient-values-ios" caption="iPhone 17 模拟器，iOS 26：实际拖动和按钮交互，然后是自主播放、分层脉冲、暂停/搜索、范围保持、类型替换和调整大小。即时的;手势事件和绑定重建仍然进入 JavaScript。" />

### 所有权和生命周期 {#ownership-and-lifecycle}

| 操作                                  | 结果                                                                                                 |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `glow.bind({ center: { x: value } })` | 仅替换中心 x；返回一个清理函数。                                                                     |
| 绑定清理                              | 保存它仍然拥有的组件的当前值。不恢复旧的绑定或删除新的所有者。                                       |
| `glow.set(...)` / `glow.animate(...)` | 仅分离所提供组件的绑定。其他绑定继续。新的具体动画取代了之前的具体动画。 `set()`取消那个具体的动画。 |
| 具体动画期间的 `glow.bind(...)`       | 接管所提供的组件；该动画中未受影响的部分将继续。                                                     |
| `glow.stop()`                         | 保留当前帧，停止具体播放并分离所有渐变绑定。源头和其他消费者继续。                                   |
| `glow.suspend()` / `glow.resume()`    | 暂时保留并取消订阅，然后追上源。读取 `glow.suspended` 以获取显式保留。不暂停独立拥有的源。           |
| `glow.remove()`                       | 分离订阅、计时器、原生动画、图层/可绘制对象和视图/应用程序侦听器。可以安全再次致电。                 |

`motionScope().gradient()` 和 `useMotionScope().gradient()` 拥有相同的控制器。作用域挂起保持绑定； resume 再次跟随源，不会重复订阅。手动暂停的梯度在作用域暂停/恢复期间保持保持。如果源动画也属于该范围，则应用其正常作用域暂停/恢复规则。具体渐变动画在暂停时停止；它们不会重新启动。

卸载会删除原生层和订阅，同时保留绑定定义。重新加载会在源的当前位置附加一次。应用程序后台同样保留/取消订阅；前景赶上。范围处置和 Vue 卸载会删除所有内容。

颜色计数是结构化的：`bind()`/`set()` 可以立即替换整个颜色数组，删除不兼容的颜色/停止绑定，同时保留几何绑定。在没有 `stops` 的情况下提供 `colors` 会将色标重置为均匀间距，如具体 API 中所示。 `animate()` 需要相同的计数。需要两到八种颜色，每种颜色需要一站。

### Vue 绑定 {#vue-bindings}

在设置中创建一次源。该指令通过身份比较动画值，在删除工作梯度之前验证替换，并释放其保持值的省略绑定。不同的类型取代了原生层。转换元组控制具体选项；绑定组件遵循其自己的源时序。

```vue
<script setup lang="ts">
import { motionValue } from '@rafaelaugusto/jolt'

const progress = motionValue(0)
const angle = progress.to([0, 1], [0, 360])
const tint = progress.to([0, 1], ['#ed4b82', '#45c8f5'])
</script>

<template>
  <GridLayout v-gradient="{ type: 'conic', colors: [tint, '#20233c', tint], angle }" />
</template>
```

### 有效范围和原生执行 {#valid-ranges-and-native-execution}

角度使用上述单位/方向，并且可能超过 360°。中心可能会在视图之外进行推断。在替换工作绑定之前，会抛出静态负半径、非有限数、无效颜色和无序/超出范围的静态停止。约束半径超调被钳位为零。绑定止损被钳位到 `[0, 1]`，然后每个止损至少提升到前一个止损；颜色永远不会被排序或交换。超调可以合并停靠点。稍后产生非有限结果的映射保留最后一个有效的编译帧，分离该渐变的绑定并写入 NativeScript 跟踪错误；其他消费者仍然依恋。使用有效值重新绑定以恢复。

派生颜色使用 Jolt 的 OKLab 插值并保留 alpha。原生样本使用 8 位颜色通道；平台在样本之间插入这些颜色。通过减少运动，绑定几何体使用源的目标，同时颜色和色标继续插值。

所有组件均准备为来自每个源的一个快照的连贯帧。移动绑定使用最多 **4秒** 的窗口，其中 **最多 241 个样本**，在源播放时间中间隔不超过 **16.7 毫秒**。原生播放与现有源时钟对齐；绑定不会创建第二个播放时钟。 iOS 上的原生点/颜色和 Android 上的数字通道在这些样本之间进行插值。这是一个采样近似值：对于任意锐映射或重复不连续性，不存在通用视觉误差界限。突然的变化可能会在一个样本间隔内混合；让重要的转变比该间隔更宽。对于速率受 L 个单位/毫秒限制的线性插值数字通道，在原生浮点舍入和显示调度之前，插值最多会产生 L × Δ / 2 误差 (Δ ≤ 16.7 ms)。不连续映射不满足该界限。

JavaScript 在准备、源命令、手势事件和长窗口边界时运行。窗口内的自主播放请求 **零JS观察者框架** 并且没有每帧 `set()`/绘画循环。长时间运行/无限源需要每四秒重建一次；如果 JS 无法运行，则渐变将保留其最后准备的帧，直到它可以重新加入源。在iOS上，提交的Core Animation帧在JS争用期间可以继续播放。 Android 的动画器和绘图仍然依赖于其 UI 线程，因此阻止它会导致渲染停止。频繁的拖拽更新仍然通过JS重建绑定；此 API 不会将手势处理移至工作集。

<Clip name="gradient-values-android" caption="Android 16 / API 36 模拟器：使用相同的三个渐变和控件进行实际拖动和点击。即时的;原生动画播放，JavaScript 用于手势事件和准备。" />
