# 形状绘制与变形 {#shapes-draw-and-morph}

绘制复选标记、显示圆环或将播放符号变成暂停条。可选的 `@rafaelaugusto/jolt/shapes` 条目在 NativeScript 视图上绘制拥有的矢量曲面。其 `shape()` 手柄遵循与渐变相同的创建/动画模式。自 **0.1.0-rc.1** 起可用；重建 Android 以包含原生渲染器。

<Clip name="shapes-ios" caption="iOS 模拟器：真实的点击绘制复选标记、圆环和下划线、中断播放/暂停变形、暂停/恢复绘制以及在“减少运动”下切换形状。英文界面；原始播放时序。" />
<Clip name="shapes-android" caption="Android 模拟器：通过真实的 ADB 敲击进行相同的矢量绘制和变形，包括中断、暂停/恢复和减少运动。英文界面；原始播放时序，而不是真机性能测量。" />

## 绘制路径 {#draw-a-path}

使用专用的空视图。形状可以在视图加载之前创建，例如在 Vue 的 `onMounted` 中：它会在视图加载时附加，并保留当前的 `strokeStart`/`strokeEnd`；在此之前请求的动画会在附加后开始。视图提供大小、可访问性和输入；渲染器不会安装手势处理程序或更改视图的点击几何形状。

<Clip name="shapes-mount-ios" caption="iOS 模拟器：实验室在 onMounted 中、布局之前创建四个形状，因此启动后屏幕出现时它们已经绘制完成；随后两次真实点击 Draw again 为描边制作动画。英文界面；原始时序，包含启动过程。" />
<Clip name="shapes-mount-android" caption="Android 模拟器：同样在挂载时创建的形状在启动闪屏之后随屏幕一起出现；两次真实的 ADB 点击 Draw again 重新绘制描边。英文界面；原始时序，而不是真机性能测量。" />

```ts
import { shape } from '@rafaelaugusto/jolt/shapes'
import { motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
const check = scope.add(
  shape(checkView, {
    d: 'M22 51 L43 71 L79 28',
    viewBox: [0, 0, 100, 100],
    stroke: '#C8E4CF',
    strokeWidth: 5,
    lineCap: 'round',
    strokeEnd: 0,
  }),
)

const drawing = check.animate({ strokeEnd: 1 }, { duration: 900, ease: 'easeInOut' })
drawing.pause()
drawing.progress = 0.5
drawing.play()
// At permanent teardown:
scope.dispose()
```

`viewBox` 是 `[minX, minY, width, height]`，具有正尺寸。路径按比例拟合并在视图内居中；笔划宽度使用 viewBox 单位并随几何形状缩放。绘图被剪裁到主机的边界。调整大小会更新此映射，而无需重建运行路径动画。

静态选项为 `stroke`（默认 `#202630`）、`fill`（透明）、`strokeWidth`（0–1000，默认 2）、`lineCap`（`butt`、`round`、 `square`；默认 `round`)、`lineJoin`（`miter`、`round`、`bevel`；默认 `round`）和 `fillRule`（`nonzero` 或 `evenodd`；默认`nonzero`）。处置/重新创建以更改样式或 viewBox。表面保留原始背景，完整地进行变换和触摸处理，并覆盖现有内容。

`strokeStart` 和 `strokeEnd` 选择 0–1 范围内的分数。如果start大于或等于end，则笔划为空；填充始终是完整的。部分笔画绘制需要一个连续的子路径。复合路径支持填充、全描边和变形；当每个轮廓需要自己的绘制进度时，请使用单独的形状视图。

## 变形匹配几何体 {#morph-matching-geometry}

```ts
const icon = shape(iconView, {
  d: 'M20 25 L80 50 L20 75 Z',
  viewBox: [0, 0, 100, 100],
  fill: '#F4B992',
  strokeWidth: 0,
})
icon.animate({ d: 'M20 25 L80 25 L50 80 Z' }, 'snappy')
// Retargeting starts from the native presentation, even during an unfinished morph.
icon.animate({ d: 'M20 25 L80 50 L20 75 Z' }, 'snappy')
```

支持 SVG `M/L/H/V/C/S/Q/T/A/Z`、相对形式、隐式重复和多个子路径。设置标准化速记和相对坐标；椭圆弧变成最多 90 度的三次贝塞尔线段。变形需要相同的标准化命令、子路径和控制点计数。没有自动拓扑匹配。不同的弧扫描可以归一化为不同的立方数，因此是不兼容的。

不兼容的目标在中断现有工作之前抛出异常。使用 `set({ d: newPath, strokeStart: 0, strokeEnd: 1 })` 立即更改拓扑。输入限制为 20,000 个字符、256 个标准化命令和 ±1,000,000 以内的坐标。一个采样动画有 262,144 个组件预算；在替换当前动画之前，过于复杂的路径/曲线组合将被拒绝。

## 播放和所有权 {#playback-and-ownership}

`animate({ d?, strokeStart?, strokeEnd? }, transition?)` 接受目标和现有的补间/弹簧名称、缓动、延迟和重复控件。使用 `set()` 后跟 `animate()` 进行明确的开始/结束绘图。一种形状拥有一种组合的几何/修剪动画；重定向中省略的属性将保留其当前的呈现形式。命名附加图层和形状关键帧数组不属于此 API 的一部分。

返回的句柄公开 `finished`、`pause()`、`play()`、`stop()` 和有限的 `progress`。弹簧将中断的矢量速度投射到新的目的地。修剪保持在 0-1 范围内，而几何体可能会超调。 `shape.stop()` 主持本次演示； `set()` 立即停止并更换。 `snapshot()` 按需读取当前路径/修剪和原生边界/动画计数；它不安装观察者。

后台暂停当前工作。如果 NativeScript 在后台卸载视图，则原生表面将被释放，并且暂停的程序在前台加载时将恢复。常规卸载或原生视图替换会取消播放，释放旧表面并恢复加载时保留的几何图形。明确暂停的工作将保持暂停状态。 `dispose()` 永久删除形状及其侦听器，并且是幂等的。一个视图一次只能拥有一个形状。

减少运动立即应用新的目的地。在播放期间启用它会停止该句柄（`finished` 解析 `false`）并应用其请求的目标，而无需进一步的动画。范围可以拥有用于清理的形状或拥有用于暂停的单独播放手柄；独立所有者之间不共享一种形状。

## 原生渲染 {#native-rendering}

iOS 使用显式 `CAShapeLayer` 关键帧进行路径和修剪，并使用原生演示标记进行中断。 Apple 需要兼容的路径段/控制点结构来进行路径插值。 [CAShapeLayer 路径文档](https://developer.apple.com/documentation/quartzcore/cashapelayer/path)。

Android 使用已编译的可绘制对象 `Path`/`PathMeasure` 和 `ValueAnimator`。路径和缓冲区被重用；原生代码中的变形坐标和修剪更新。部分绘图采用`PathMeasure.getSegment()`。 [Android PathMeasure 文档](https://developer.android.com/reference/android/graphics/PathMeasure)。

JavaScript 解析几何图形并在设置/命令时准备曲线，然后处理生命周期和完成边界。它不会每帧绘制或更新路径。 Android绘图和NativeScript JavaScript仍然共享UI线程。这些 API 并不意味着单独的渲染线程或真机性能保证。

四语言 **由运动/线条制成** 预览是第 71 个示例。参见 [验证和复制](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/shapes.md)。
