# 工作原理 {#how-it-works}

当动画开始时，Jolt 解析起始值并计算源曲线。数字弹簧、衰减和补间使用 [自适应关键帧](./transitions#adaptive-keyframes)，将细节集中在线性插值需要的地方。创作的关键帧时间保持精确，直线数字段仅保留其端点。春季结算、中断速度和序列到达保留了之前的计时合同。颜色混合和组合动画值映射保持其单独的采样策略。

样本一口气上平台：

- **iOS**：视图图层上的每个属性一个 `CAKeyframeAnimation`（`opacity`、`transform.translation.x`、`transform.scale.y`、`transform.rotation.z` ...）。 Core Animation 组合它们，因此 `x` 和 `scale` 可以属于不同的动画，并在渲染服务器中播放它们。
- **Android**：在视图的 `alpha`、`translationX`、`scaleY`、`rotation` 上，每个属性有一个 `ObjectAnimator`，带有 `Keyframe` 和线性插值器...

Solid [颜色](./colors) 在 iOS 上使用 CGColor 关键帧，并通过 Android 上的原生 Java 目标使用 int 关键帧。 iOS 文本使用 UILabel Alpha 遮罩，因此在颜色层动画时字形位置保持固定。

播放前，会像 `view.animate()` 一样先将最终值写入 NativeScript 视图，因此动画运行时，`view.translateX` 已经保存目标值。停止时则写回屏幕上当前显示的值。

每个运行属性都会记住其曲线和开始时间。在 Android 上，中断读取显示值和动画师的当前播放时间，因此继承的速度遵循系统的动画师持续时间比例。早春到来使用仅带有完成回调的原生计时标记；其他序列在原生完成的基础上前进。延迟、重复和禁用动画遵循相同的平台时钟，无需每帧运行 JavaScript。

[`animateSize()`](./size) 具有不同的执行路径：实际尺寸和文本回流需要 NativeScript 每帧在 UI 线程上进行测量/布局。其库拥有的帧回调运行 JavaScript；它不是渲染服务器播放。 `animateLayout()` 仍然测量一次并使用原生变换轨道。选择加入动画值订阅者、滚动输入和时间线回调激活也保留其记录的 JS 成本。

[`springValue()`](./live-springs) 使用单独的实时路径：持久 C/Java spring 状态、共享原生显示回调和原生映射/层组合。它不会在每次目标更新时重建关键帧动画。这些回调共享 UI 线程；它们不是与繁忙的 JavaScript 渲染服务器隔离。固定目标动画保留上述采样路径。

可选的 [`gestures()`](./gestures) 条目可识别平移/收缩/旋转并以原生代码协调 ScrollView。保留的输出驱动绑定，无需每次移动的 JS 回调；请求的回调和现有的 Core 侦听器仍然执行 JavaScript。识别和实时弹簧共享 UI 线程。

## 测试 {#tests}

测试使用自己的时钟针对假平台驱动程序 ([`test/helpers.ts`](https://github.com/rafaelaugustos/jolt/blob/main/test/helpers.ts)) 运行引擎：它记录它将播放的关键帧，并在时钟结束时结束它们。 iOS 和 Android 驱动程序根据平台类型进行类型检查。

原生 CI 装置还读取 iOS 和 Android 上的表示层/视图值，检查实际尺寸和实时跟随者生命周期，并验证故意的几何故障。 C 和 Java spring 内核在确定性轨迹测试中进行编译和比较。
