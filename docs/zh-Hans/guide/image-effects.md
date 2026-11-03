# 图像效果 {#image-effects}

实验性 Web 对应 API：[粒子、表面与图像](./web-surfaces)。自 RC.10 起可用。

`imageEffect()` 在 NativeScript `Image` 上添加了波纹、触摸失真和溶解。这些 API 需要在安装包后进行原生重建。支持已加载的光栅图片，并可在 iOS 上使用本地视频纹理；不支持任意视图树、SVG 或动画图片。

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

卸载、隐藏、更改活动源/拉伸/色调会停止效果并释放其资源。尚未加载的源等待加载和积极布局。后台暂停原生播放；仅当用户没有暂停时才返回恢复。在 iOS 上观察到操作系统减少运动变化。效果启动时读取全局 `configure()` 首选项；更改它们后停止并重新创建连续效果。

`diagnostics` 报告所选后端、帧计数、拥有的纹理字节、峰值拥有的纹理字节、准备时间（以毫秒为单位）以及观察到的最长绘制间隔。这些是调试测量，而不是 GPU 分析器或帧速率目标的承诺。已完成/已停止的句柄所拥有的资源报告零纹理字节；平台可能会异步取消 GPU 分配。表面像素上限是保守的分配保护，而不是测量的性能保证。

更改尺寸、填充、边框或圆角会更新表面和裁剪，并保留进度、暂停、方向及绑定。先准备新纹理再切换；超过像素预算时安全停止并恢复原图。边框和背景位于置换纹理之外。

[演示](./demo) 图像实验室包括点击原点、原生拖动、播放、反向、擦洗、恢复、四种拉伸模式、圆形边框和简化运动控件。风景源溶解成带有透明角的肖像艺术品。

<Clip name="web-image-surfaces-chromium" :width="900" caption="macOS 上的 Chromium，英文界面：真实点击展示播放、暂停/恢复、替换、减少动态效果和清理，保持原速。浏览器录制，不代表真机性能。" />

## 渲染范围与原生测量

后端支持静态图片及 iOS 本地视频纹理。应用生成的一次性快照保持冻结；此 API 不提供实时子树、连续快照、背景采样、相机/WebView 或托管 SwiftUI 滤镜。[渲染报告](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/image-renderer.md)说明坐标、资源所有权、回退、绘制流程和复现方法。`diagnostics.frameIntervalsMs` 最多保留 512 个活动原生绘制回调间隔，单位毫秒，排除暂停空隙。它不测量 GPU 或实际呈现时间。

<Clip name="image-profile-ios" caption="iPhone 17 模拟器，iOS 26.2，英文界面。实际点击触发涟漪、两个并发溶解和取消。原速录像；计时使用单独的不录屏运行，不代表物理设备性能。" />

## 原生输入、液态遮罩与视频

`effect.bind('progress', spring)` 将 Jolt 数值和 `springValue()` 直接绑定到原生渲染器，不需要每帧 JavaScript 订阅。`effect.bindScroll('progress', scroll, { range: [0, 240] })` 直接读取原生滚动偏移（DIP）。类型化参数包括 `progress`（0–1）、`amplitude`（0–64 DIP）、`radius`（正数）、`originX` 和 `originY`。`set()` 替换该参数的绑定，旧清理函数不会影响新绑定。应用显式添加的监听器仍会运行。`stop()` 释放全部绑定；`pause()` 只暂停有限时间线，不暂停原生输入源。

`imageEffect(photo, 'liquid-mask', { mask: { blend: 22, shapes } })` 支持 1–8 个圆或圆角矩形。每个形状具有 `kind: 'circle' | 'rectangle'` 及 `from`/`to` 姿态。姿态包含 `x`、`y`、`radius`；矩形还包含 `width`、`height`。中心和尺寸相对于目标宽高，半径相对于较短边。`blend` 为 0–128 DIP。平滑并集通过可逆进度连续融合/分离，并保留预乘透明度。遮罩在端点保留渲染器；`finish()` 保留端点，`finished` 在 stop/替换前保持等待。遮罩不改变命中测试。

<Clip name="shader-inputs-liquid-mask-ios" caption="iPhone 17 Pro 模拟器，iOS 26.2，英文界面。真实 XCTest 点击与滚动演示原生输入、融合/分离、透明度、尺寸变化和清理。原速；不是实体设备录像。" />

<Clip name="shader-inputs-liquid-mask-android" caption="Android API 36 模拟器，英文界面。真实 ADB 点击与滑动通过 AGSL 演示原生弹簧/滚动、液态遮罩、尺寸变化和清理。原速；不代表实体设备性能。" />

iOS 的 `video: { src: absoluteLocalPath, loop: true }` 接受无声本地视频。Image 必须有已加载的光栅海报。`pauseVideo()`/`playVideo()` 独立于效果时间线；`setVideo({ src, paused: true })` 替换视频源，`setVideo(null)` 恢复海报纹理。暂停帧在 resize 后保持不变。进入后台暂停视频及渲染；stop/unload 释放 player、output、cache 和纹理。不支持 dissolve 目标、流媒体、DRM、相机、HDR 保证或 Android/Web 视频。测试使用 640×360 SDR H.264 MP4。

`nativeParameterWrites`、`resizeCount`、`videoFrames` 和 `videoTime` 提供状态计数。iOS 的 `renderCpuMs`/`renderGpuMs` 累计 CPU 编码和已完成 Metal 命令缓冲的 GPU 时间，不是呈现延迟。纹理字节不含解码器和 drawable；视频峰值为保守估计。参见[完整示例](../../guide/image-effects#native-shader-parameters)及[验证报告](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/shader-textures.md)。

<Clip name="shader-video-ios" caption="iPhone 17 Pro 模拟器，iOS 26.2，英文界面。真实点击演示经过波纹着色器的 Big Buck Bunny 视频、暂停/恢复、resize、换源和恢复海报。原速；已获准使用模拟器验收，不是实体设备录像。" />
