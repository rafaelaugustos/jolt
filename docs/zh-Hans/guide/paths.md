# 沿路径运动 {#motion-along-a-path}

```ts
animate(
  plane,
  { path: 'M0 0 C80 -120 200 -120 280 0', orient: true },
  { duration: 1200, ease: 'linear' },
)
```

<Clip name="paths" caption="一条曲线和一条切线方向的轨道。" />

`path` 提供 **DIPs** 中相对于视图未变换布局位置的平移坐标。正X点向右；正Y点向下。该示例向上呈拱形，并向右结束 280 DIPs。它不会调整视图大小或重排视图，也不会为布局拥有的原生位置设置动画。

## 时机和方向 {#timing-and-orientation}

Jolt 测量沿曲线的距离。线性缓动每单位时间以大约恒定的距离移动；另一种缓动会改变整个路线的进度，而不是在每个几何样本处重新开始。默认为 300 毫秒的缓出补间。在选项中使用 `path` 来与其他属性分开计时：

```ts
animate(
  plane,
  { path: route, orient: true, opacity: [0, 1] },
  {
    duration: 300,
    path: { duration: 1200, ease: 'easeInOut' },
  },
)
```

`orient: true` 将面向 **+X** 的图稿与正切线对齐（以度为单位）。角度在 ±180° 范围内展开，因此圆连续转动。如果省略方向或 `false`，则保留当前旋转；还允许单独的 `rotate` 动画。

弹簧驱动相同的共享 0-1 路径进度：

```ts
animate(plane, { path: route, orient: true }, 'bouncy')
```

0-1 之外的进度被固定到路线端点，因此超调弹簧可以在沿着路径返回之前短暂保持在那里。路径具有明确的起始姿势，并且不会从它们替换的动画中推断出进度速度。 spring 的显式 `velocity` 使用每秒的进度单位。从运行路径接管的普通动画继承其坐标速度。

重复、反向重复、延迟、交错和触觉使用现有的动画时间轴。反转会倒回采样的方向和坐标；它不会添加 180° 旋转以使艺术品面向向后行驶。通过相邻原生样本之间的插值，尖角和尖点可以突然转动。

## 相对路径 {#relative-paths}

```ts
animate(
  plane,
  { path: 'M0 0 Q80 -120 160 0', orient: true },
  {
    duration: 1000,
    relative: true,
  },
)
```

`relative: true` 将视图的起始平移添加到路线，并将其起始旋转添加到定向路线。当目标加载时，基数被捕获一次，如果另一个动画拥有它，则使用当前的值。坐标不会按该基角旋转：起始旋转充当图稿标题偏移。如果没有相对模式，第一个 `M` 显式选择起始翻译。

## 播放、序列和停止 {#playback-sequences-and-stopping}

返回值为通常的[`PlaybackAnimation`](./playback)。暂停、擦洗、继续或停止。路径也适用于 [`sequence()`](./sequences)、[自定义预设](./presets#custom-presets)、[`scrollLinked()`](./scroll-linked) 和 `press()`。

```ts
const flight = animate(plane, { path: route, orient: true }, { duration: 2000 })
flight.pause()
flight.progress = 0.5
flight.play()

stop(plane, ['x', 'y', 'rotate']) // freeze the generated tracks
```

路径拥有 `x` 和 `y`，并且在定向时拥有 `rotate`。在同一调用抛出中为这些坐标提供竞争关键帧或每个属性的计时；请改用共享 `path` 转换。其他财产保持独立。仅停止或替换一个坐标会使其他坐标沿着原来的轨迹运行，因此它们不再一起描述整个路线。没有虚拟 `path` 属性可传递给 `stop()`。

## SVG 数据和限制 {#svg-data-and-limits}

解析器接受一个连续子路径，其中包含单个 `M`/`m`、直线 (`L H V`)、三次和二次贝塞尔曲线 (`C S Q T`)、椭圆弧 (`A`) 和闭合 (`Z`)，绝对或相对形式。支持重复参数组、紧凑数字、指数和压缩弧标志。圆弧转换遵循[SVG 实施说明](https://www.w3.org/TR/SVG/implnote.html#ArcConversionEndpointToCenter)。传递路径数据，而不是 SVG 文档、转换或 URL。

仅移动或零长度路径保留其点并使用零航向。在接管视图之前会抛出多个 `M` 命令、格式错误的数据、冲突的坐标和不受支持的值。持续时间和延迟必须是有限的；重复次数可能是无限的。

输入限制为 100,000 个字符和 1,024 个段。数值大小和几何坐标必须保持在 ±1,000,000 范围内。几何使用自适应细分，具有 0.025 DIP 平坦度目标和有界工作（8,192 个顶点/18 个细分）；无法满足该界限的几何图形将被拒绝。原生计时每个坐标使用最多 6,001 个关键帧，从路线长度和持续时间中选择。距离、航向和本地插值都是近似值，特别是在很长的路线、小环路和尖角上。

## 原生播放 {#native-playback}

JavaScript 每次 `animate()` 调用都会解析并测量一次路由。当第一个目标准备就绪时，定时和坐标样本就会构建一次，并由生成的轨迹和交错目标共享。原生平移和旋转关键帧可在 iOS 和 Android 上播放；没有 JS 框架回调会移动视图。播放命令和中断读取的路线相同。 Android 的 [UI 线程限制](./android-performance) 仍然适用。

游乐场包括弯曲飞行、基于弧线的轨道、方向控制、暂停/恢复和停止。
