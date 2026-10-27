# 图像效果 {#image-effects}

`imageEffect()` 在 NativeScript `Image` 上添加了波纹、触摸失真和溶解。这些 API 需要在安装包后进行原生重建。它们对加载的光栅图像进行操作，而不是对任意视图树、SVG、视频或动画图像进行操作。

<Clip name="image-effects-ios" caption="在 iOS 模拟器中使用 Metal 在光栅夹具上产生波纹、触摸失真和溶解。" />

```ts
import { imageEffect } from '@rafaelaugusto/jolt'

const ripple = imageEffect(photo, 'ripple', {
  origin: { x: 80, y: 120 }, // Image-local DIPs
  amplitude: 12,
  radius: 96,
  duration: 700,
})
await ripple.finished // true on completion, false on stop/replacement
```

## 预设和播放 {#presets-and-playback}

| 预设         | 输入                                  | 结果                               |
| ------------ | ------------------------------------- | ---------------------------------- |
| `ripple`     | 局部原点、半径、振幅                  | 返回原始图像的行波                 |
| `distortion` | 原生指针移动                          | 触摸周围的有限位移，释放时稳定下来 |
| `dissolve`   | 加载`to: ImageSource`，可选整数`seed` | 两幅图像之间的确定性噪声过渡       |

原点、半径和幅度位于图像局部坐标系中的 DIPs 中。默认原点是中心。半径默认为96；幅度默认为 8 并接受 0–64；持续时间默认为 650 毫秒；种子默认为 1 并接受 0–65535 之间的整数。

```ts
const transition = imageEffect(photo, 'dissolve', {
  to: nextImageSource,
  seed: 42,
  duration: 900,
  paused: true,
})
transition.progress = 0.4
transition.play()
transition.pause()
transition.reverse() // reverses and plays from the current progress
transition.finish() // completes at the current direction's endpoint
```

有限效果公开从 0 到 1 的进度。`progress = value` 保留暂停/运行状态；首先致电 `pause()` 进行静态预览。成功的前向溶解将 `to` 提交给 `photo.imageSource`。反向完成保留原始来源。 `stop()` 恢复原始像素并解析 `false`。已完成或停止的句柄无法重新启动。

失真持续直至停止。它支持暂停/播放，但拒绝进度查找和倒退。其 `finish()` 的行为类似于 `stop()`。触摸处理和稳定自然发生； JavaScript 未接收到指针或帧回调。

## 平台和后备 {#platforms-and-fallback}

| 平台                                                 | 渲染器                       |
| ---------------------------------------------------- | ---------------------------- |
| iOS 带金属支架                                       | 现有图像视图内的金属纹理渲染 |
| Android 13 / API 33+，硬件加速                       | AGSL `RuntimeShader`         |
| 较旧的 Android、渲染器不可用、图像不受支持或运动减少 | 显式后备                     |

回退保留原始图像以实现装饰效果并解析 `false`。 Dissolve 立即提交其目标并解析 `true`，包括在请求暂停时。这保证了当动画不可用时内容更新不会丢失。如果应用程序需要解释或选择其他演示，请检查`effect.diagnostics.backend`和`reason`。原生设置错误还可能提供 `detail` 进行调试。

输出表面的上限为 4,194,304 个物理像素。透明像素和图像的拉伸模式将被保留。渲染器不会对布局进行动画处理或替换导航。应用程序仍应以适当的显示尺寸对大源图像进行解码。

## 所有权和生命周期 {#ownership-and-lifecycle}

映像具有一个活动的 `imageEffect()`、`liquid()` 或 `zoomable()` 控制器。开始另一个会停止前一个。普通的外视图动画可以与图像效果一起运行；避免自己替换其可绘制/原生图像。

卸载、隐藏、更改活动源/拉伸/色调或更改图像的布局大小会停止效果并释放其资源。尚未加载的源等待加载和积极布局。后台暂停原生播放；仅当用户没有暂停时才返回恢复。在 iOS 上观察到操作系统减少运动变化。效果启动时读取全局 `configure()` 首选项；更改它们后停止并重新创建连续效果。

`diagnostics` 报告所选后端、帧计数、拥有的纹理字节、峰值拥有的纹理字节、准备时间（以毫秒为单位）以及观察到的最长绘制间隔。这些是调试测量，而不是 GPU 分析器或帧速率目标的承诺。已完成/已停止的句柄所拥有的资源报告零纹理字节；平台可能会异步取消 GPU 分配。表面像素上限是保守的分配保护，而不是测量的性能保证。

更改填充、边框宽度或角半径也会停止活动效果，因此其表面无法保留陈旧的剪切几何形状。边框和背景位于置换纹理之外。

[演示](./demo) 图像实验室包括点击原点、原生拖动、播放、反向、擦洗、恢复、四种拉伸模式、圆形边框和简化运动控件。风景源溶解成带有透明角的肖像艺术品。
