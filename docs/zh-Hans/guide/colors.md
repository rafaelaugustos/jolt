# 颜色 {#colors}

背景、边框和文本颜色在 iOS 和 Android 上使用 `animate()`：

<Clip name="colors" caption="在 OKLab 中插值的背景和文本颜色。" />

```ts
animate(
  card,
  {
    backgroundColor: '#263b27',
    borderColor: '#b6ee64',
    color: '#d5ff91',
  },
  { duration: 800 },
)
```

使用 NativeScript 颜色字符串或 `Color` 对象。数组定义关键帧； `null`表示动画开始时可见的颜色：

```ts
animate(
  card,
  {
    backgroundColor: [null, '#38273f', '#21394a'],
  },
  { duration: 1800, times: [0, 0.3, 1] },
)
```

颜色默认为 300 毫秒补间。您可以照常设置每个属性的过渡、弹簧、延迟、重复和交错。春季进度被固定在第一个和最后一个颜色；打包颜色不继承标量速度。 `relative: true` 的颜色值保持绝对值。

## 插值 {#interpolation}

Jolt 使用预乘 Alpha 计算 OKLab 中的中间颜色，将结果剪辑到 sRGB，并将样本提供给原生动画师。这避免了饱和颜色之间的深色 RGB 中点，并防止透明端点将其不可见色调添加到过渡中。每个帧都没有运行 JavaScript。

变换和颜色可以一起运行。新的动画取代了屏幕上的颜色。停止一种颜色，而其余颜色继续播放：

```ts
stop(card, ['backgroundColor'])
```

停止将可见颜色提交给 NativeScript 模型并使用 `false` 解析动画。完成后在模型中留下最终颜色。从外部更改颜色或卸载视图会取消该属性的原生播放。

## 边框和背景 {#borders-and-backgrounds}

`borderColor` 要求所有四个边缘具有相同的起始颜色。支持不同的宽度和角半径。保留渐变、图像、剪辑路径和阴影；他们自己的参数没有被插值。不透明渐变下方的背景颜色仍被其覆盖。在 iOS 上，Core 将图像背景及其颜色一起栅格化：`false` 会跳过这些视图上的背景颜色播放，保留图像和最终模型颜色。

iOS 对现有背景或边框层进行动画处理。 Android 使用小型 Java `ObjectAnimator` 目标来更新 Core 的可绘制对象，而无需替换其几何图形或图像。该目标适应 Core 在播放期间替换可绘制对象。它的兼容性取决于Core原生的drawable字段；如果这些字段不可用，则会跳过播放并保留最终的模型颜色。安装或升级 Jolt 后重新构建 Android 应用程序，以便包含原生目标。

## 文本 {#text}

iOS、`color` 支持标签和按钮。 Jolt 绘制一次 UILabel alpha 蒙版，并通过它对实体层进行动画处理，保留原生换行、字体和字形位置。 Span 和具有自己的显式颜色的格式化字符串保留该颜色。文本和可访问性保留在原始的原生标签上。编辑文本、更改其布局或重新设计文本会取消播放并恢复当前模型文本。启动 `animateText()` 还会释放活动的文本颜色蒙版。

iOS 上将跳过超过 400 万像素的颜色表情符号和一些符号范围、附件、文本阴影和蒙版：应用最终模型颜色，并且 `finished` 解析为 `false`。 iOS 不支持 TextField 和 TextView 颜色动画。没有后备可以对控件的整个屏幕截图进行动画处理。

在 Android 上，`color` 支持 TextBase 控件并使用原生文本颜色设置器。 Android 的显式格式化跨度颜色保持不变。
