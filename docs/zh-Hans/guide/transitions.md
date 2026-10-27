# 弹簧与补间动画 {#springs-and-tweens}

`animate()` 的第三个参数说明如何到达那里。如果没有，则通过弹簧进行变换移动，`opacity` 可以减轻超过 300 毫秒的时间。补间关键帧。

<Clip name="springs" caption="可中断球上的三个指定弹簧。" />

## 弹簧 {#springs}

```ts
animate(card, { scale: 1.2 }, 'bouncy')
animate(card, { y: 0 }, { bounce: 0.3, duration: 600 })
animate(card, { y: 0 }, { stiffness: 300, damping: 20, mass: 1 })
```

| 弹簧     | 感觉                   |
| -------- | ---------------------- |
| `smooth` | 无超调                 |
| `snappy` | 快，几乎没有超调。默认 |
| `bouncy` | 过冲并以弹跳稳定       |

`bounce` 从 -1 到 1：0 稳定而不会超调，较高的值反弹更多，负值稳定更慢。 `duration`是弹簧感觉有多长，与SwiftUI同型号。或者用`stiffness`、`damping`、`mass`来描述。弹簧以其中断的动画速度开始，除非您传递 `velocity`（每秒单位数）。

## 补间 {#tweens}

```ts
animate(card, { opacity: 0 }, { duration: 200, ease: 'easeIn' })
animate(
  card,
  { x: [0, 100, 50] },
  { duration: 600, ease: ['easeOut', 'easeIn'], times: [0, 0.3, 1] },
)
```

**除非另有说明，`easeOut` 的补间需要 300 毫秒。** 这比 React Native 的 `Animated.timing` 短（500 毫秒，缓入和缓出），并且启动速度比 CSS 的 `ease` 更快，因此当端口必须匹配时，请同时传递两者。

`ease` 取 `linear`、`ease`、`easeIn`、`easeOut`、`easeInOut`、`circIn`、`circOut`、`circInOut`、 `backIn`、`backOut`、`backInOut`、`anticipate`、`quad`、`cubic`、`quart`、`quint`、`sine` 和 `expo` 曲线`In`、`Out` 或 `InOut` (`'cubicOut'`)、三次贝塞尔曲线 (`[0.2, 0, 0, 1]`) 或从 0..1 到某个值的任何函数。对于关键帧，每个片段传递一个。 `times` 将每个关键帧置于 0 和 1 之间。

<Clip name="easing-curves-ios" caption="iOS 模拟器上有六条超过 900 毫秒的命名曲线，以及一个其不透明度仅设置时间并保留主要持续时间和缓动的徽标。实时播放。" />

使用 `easeTrack: true`，一个 `ease` 会在整个轨道上运行，并且该值在关键帧之间以直线移动，就像 React Native 的 `interpolate` 将其输出范围置于缓和值上一样：

```ts
animate(
  spark,
  { y: [0, -30, -12, 0] },
  { duration: 900, ease: 'easeOut', easeTrack: true, times: [0, 0.4, 0.7, 1] },
)
```

<Clip name="ease-track-ios" caption="在 iOS 模拟器上，每个段（左）和整个轨道（右）上的关键帧和时间与 easeOut 相同。实时播放。" />

过冲的缓动（如 `backOut`）会延长第一个或最后一个段，如 `interpolate` 对 `extrapolate: 'extend'` 所做的那样。 `easeTrack` 采用单个 `ease` 并且仅适用于补间。

自定义缓动函数在动画开始时运行一次，就像弹簧一样。它们每帧不花费任何费用。

## 自适应关键帧 {#adaptive-keyframes}

数字曲线将原生关键帧集中在弯曲的地方，而不是在各处使用固定的每秒 60 个样本。缓慢的四秒缓动可以使用 41 点而不是 241；快速 300-DIP 弹簧需要更多细节，将其测得的插值误差从约 6.79 DIP 减少到 0.24 DIP。这些是数字比较，而不是帧速率声明。序列使用的源速度、沉降持续时间和到达保持不变。

<Clip name="curve-sampling-ios" caption="iOS 模拟器，真实的 XCTest 点按：自适应和固定速率点集都通过原生驱动程序播放。快速弹簧比较故意慢四倍；长滑行以原始速度播放。数字显示 DIP 中的采样曲线误差，而不是 FPS 测量的屏幕。" />

<Clip name="curve-sampling-android" caption="Android 模拟器，真实的 ADB 丝锥：相同的本地比较，快速弹簧以四分之一速度，长滑行以原始速度。点数和数值误差描述了准备好的曲线。没有真机刷新率测量。" />

翻译使用 **0.25 DIP** 错误预算；比例使用 **0.001**、不透明度/阴影不透明度 **0.002**、旋转 **0.1°** 和其他数字装饰 **0.1 DIP**。将 DIP 误差乘以物理像素的屏幕密度：0.25 DIP 在 3 倍时等于 0.75 像素。旋转和缩放具有依赖于几何形状的像素效果。线性线段保留其精确的端点；保留编写的补间时间和全轨缓动接缝。

弹簧和自由指数衰减使用分析曲率边界，包括最终的沉降捕捉。其他曲线使用三个具有安全裕度的内部探头。未知的缓动回调还保留 120 Hz 种子网格。 **没有有限采样策略可以保证任意回调：** 狭窄的尖峰或额外的交叉可能仍然不可见。颜色混合、派生映射和保留的活动弹簧具有单独的执行路径。

播放间隔最多为 100 毫秒。每个采样段都有 6,000 个间隔限制、24,000 个评估细化预算和 24 深度限制。如果细化不能满足其预算，Jolt 会回退到旧的上限统一表示，并且不保证精度。强制接缝、创作片段、颜色和扩展重复可以添加超出每个片段上限的分数。这限制了设置工作；困难的曲线会增加准备成本和内存。改进之处在于所需的精度以及用于平滑曲线的更小的原生有效负载，而不是通用的 CPU 减少。

实验**58 — 曲线精度**包括比较探针和天然探针。探头以 60/120 Hz 逻辑时间戳检查原始位置； Android 寻道使用整数毫秒，与请求时间分开记录。这并不保证物理 120 Hz 渲染。参见 [测量、限制和再现](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/curve-sampling.md)。

原生探针在每个时间戳处暂停，等待超出 NativeScript 的初始调度任务和两次显示回调，然后将读取的一个演示文稿与曲线进行比较。它保持 0.28-DIP 容差和有限的超时；它不会重试错误的值，直到它通过为止。失败的 CI 报告包括搜索阶段、时钟和最近的原生观察结果。

## 每个属性 {#per-property}

```ts
animate(
  logo,
  { scale: [0.6, 1.08, 1], opacity: [0, 1, 1] },
  { duration: 900, ease: 'easeInOut', opacity: { times: [0, 0.3, 1] } },
)
animate(
  card,
  { y: 0, opacity: 1 },
  { type: 'spring', bounce: 0.3, opacity: { duration: 150 } },
)
```

在补间中，属性的过渡仅更改其设置的内容：徽标的不透明度保持 900 毫秒 `easeInOut` 并且仅放置其关键帧。在弹簧上方，或者当它本身就是弹簧时，它会替换曲线，因此卡片的不透明度会得到 150 毫秒的补间。无论哪种方式，它都会保留主时钟的时序（`delay`、`repeat`），除非它设置自己的时序。当 `times` 和从主过渡中获取的每段缓动不适合属性的关键帧时，它们将被忽略。传递到 [预设](./presets) 的选项以相同的方式合并，因此 `animate(card, 'heartbeat', { duration: 1600 })` 保持节拍的节奏。

<Clip name="easing-curves-android" caption="Android模拟器上的相同曲线和标志。实时播放。" />

## 时序 {#timing}

```ts
animate(
  badge,
  { scale: [1, 1.2] },
  { delay: 300, repeat: Infinity, repeatType: 'reverse' },
)
```

`delay` 以毫秒为单位，视图在此期间获取第一个关键帧。 `repeat` 又玩了多少次，`Infinity` 直到停止。 `repeatType: 'reverse'` 每隔一个重复播放一次。也可以本地重复播放。

`repeatDelay` 在每次重复之前保留那么多毫秒的最终值。第一场戏不会等，最后一场戏的结局也不会等。对于 `'reverse'`，它在两端等待：

```ts
animate(
  z,
  { y: [0, -40], opacity: [0, 1] },
  { duration: 1200, repeat: Infinity, repeatDelay: 1800 },
)
```

<Clip name="repeat-delay-ios" caption="在 iOS 模拟器上，每个 z 在浮动之间休息 900 毫秒，并且球在反向循环的两端等待 700 毫秒。实时播放。" />

等待是原生关键帧的一部分，因此播放时不会花费 JavaScript。在等待期间停止会使视图保持保持值。

范围 `repeatDelay: [min, max]` 在每次重复之前绘制一个新的等待，因此像眨眼这样的空闲循环不会落在节拍上：

```ts
animate(
  eyes,
  { scaleY: [1, 0.1, 1] },
  { duration: 160, repeat: Infinity, repeatDelay: [1000, 4000] },
)
```

<Clip name="random-pauses-ios" caption="在 iOS 模拟器上，左侧吉祥物每次都会在相同的暂停后闪烁并扫视，而右侧吉祥物则在 1 到 4 秒之间绘制暂停后。实时播放。" />

等待在动画开始时绘制并内置到原生关键帧中。有限的 `repeat` 每次重复绘制一个。无限循环绘制 16 个周期并在原生循环它们，因此该模式仅在这 16 个周期之后重复，重复之间没有 JavaScript。一个 `animate()` 调用的所有属性和视图共享相同的等待，因此 `scaleX` 和 `scaleY` 或两只眼睛保持在一起。单独的调用会产生自己的调用。

<Clip name="random-pauses-android" caption="Android模拟器上的两个吉祥物相同。实时播放。" />
