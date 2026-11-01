# Web 组合实验

这个内部 [#280 实验](https://github.com/rafaelaugustos/jolt/issues/280) 使用可移植编译器，通过 Web Animations API 直接在 DOM 元素上播放变换，不依赖框架。公开实验性 [Web 运行时](./web-runtime) 自 **0.1.0-rc.5** 起可用。Mavis press/reveal 迁移及共享应用动画示例仍属于 [#236](https://github.com/rafaelaugustos/jolt/issues/236) 的独立工作。

<Clip name="web-composition-chromium" :width="720" caption="macOS arm64 上的 Chromium 156，实际浏览器播放，保持正常速度。按钮依次启动 x/y、改变 x 的目标、将应用缩放设为 1.1、施加 0.96 的按压贡献、将基础缩放改为 1.2，然后释放并保留 1.2。按钮用于验证组合；完整的指针和键盘按压识别属于后续工作。" />

## 实验证明了什么 {#what-the-proof-establishes}

一个可见的 `transform` 效果组合多个通道，每个通道都有独立的浏览器时钟。替换 `x` 会保留 `y` 和缩放的时钟。中断时使用原始曲线提供位置和速度；所有权令牌防止旧回调修改替代动画。暂停、恢复、seek、delay 和清理分别接受验证。

应用缩放与按压贡献相乘：`1.1 × 0.96 = 1.056`。按压期间修改基础缩放得到 `1.2 × 0.96 = 1.152`；只释放按压贡献会保留 `1.2`。两个采用替换方式的独立 `translate` 效果会丢失一个轴。测试浏览器支持叠加缩放，但叠加变换列表需要明确顺序。组合效果是本实验的初始选择，并不意味着其他方案都不可用。

42 项检查运行于 Chromium、Firefox 和 Playwright WebKit。显式本地时间采样分别检查位置、缩放误差和原始曲线速度。另一个播放检查确认动画无需 JavaScript 逐帧写入样式即可推进。这些是行为检查，不是 FPS 或合成器加速测量。WebKit 播放期间读取的样式可能与时间线时刻不同；精确误差断言采用显式对齐的时间。版本和限制见[决策与证据](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-composition.md)。

## 初始 CSS 策略 {#initial-css-policy}

表面以固定顺序 `baseline × translate × rotate × scale` 控制 `transform`，保留原始 `transform-origin`。基础变换可以是静态二维矩阵。不支持独立 CSS `translate`、`rotate`、`scale`，三维变换，已有动画/过渡，以及带 `!important` 的内联变换。外部 CSS 修改需要清理并重新创建表面；不会监控任意样式表或 CSS 变量变化。

此有限示例支持 `x`、`y`、`rotate`、`scaleX`、`scaleY`，两种贡献，以及最长 15 秒的有限轨迹。公开控制接口、无障碍偏好、任意关键帧、透明度、打包和框架生命周期集成属于后续运行时工作。这里没有改变任何原生执行路径。

## 原生组合参考 {#native-composition-reference}

现有原生演示展示了指导浏览器工作的组合行为。这些经过检查的视频保持不变；它们不展示共享 Mavis 页面，也不是 Web 示例在原生环境中的运行。

<Clip name="layers-ios" caption="iOS 模拟器中的现有英文原生 Layers 演示。位移和反馈层在卡片上共存。这是原生组合参考视频，不是实体设备录像，也不是新的 Web 示例。" />

<Clip name="layers-android" caption="Android 模拟器中的现有英文原生 Layers 演示。位移和反馈层在卡片上共存。这是原生组合参考视频，不是实体设备录像，也不是新的 Web 示例。" />

## 运行实验 {#run-the-experiment}

在仓库中使用 Node 22：

```sh
npm ci
npx playwright install chromium firefox webkit
npm run web:proof:typecheck
npm run web:proof:test
npm run web:proof
```

打开 `http://127.0.0.1:4280`。运行测试前先停止该服务器，因为测试会启动自己的服务器。代码和录制说明位于 `benchmarks/web-composition/`。
