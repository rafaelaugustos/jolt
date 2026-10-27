# 触觉反馈 {#haptics}

在动画到达时添加效果：

<Clip name="haptics-ios" caption="iOS 模拟器中的到达和弹跳动画。视频无法再现触觉反馈；感觉它需要一个受支持的物理iPhone。" />

<Clip name="haptics-android" caption="Android 15 模拟器上的春季到来、弹跳、交错和播放控制。白色闪烁标志着原生反馈请求，而不是振动证明。视频无法再现触觉反馈。" />

<Clip name="haptics-android-device" caption="在物理 ASUS_Z017DC、Android 8.0 上进行真实触摸，Animator 比例 1 并启用触摸反馈。 White flashes mark requests at the native view;录屏无法再现他们的触觉。" />

```ts
animate(card, { y: 0 }, { type: 'spring', haptic: 'light' })
```

选择 `light`、`medium` 或 `heavy`。在 **iOS 和 Android** 上可选择加入反馈。您需要有受支持的真机才能感受到它。模拟器/仿真器可以验证请求和计时，但无法建立感觉。设备设置和硬件决定是否感受到请求；这些样式不是跨设备校准的强度级别。

## Android 行为 {#android-behavior}

Jolt 调用 [`View.performHapticFeedback()`](https://developer.android.com/develop/ui/views/haptics/haptic-feedback)，无需旁路标志或 `VIBRATE` 权限。它尊重视图的 `hapticFeedbackEnabled` 设置和系统的触摸反馈首选项。被拒绝的请求不会因为更强的振动而重试。

| 风格     | Android 映射             | 旧平台回退     |
| -------- | ------------------------ | -------------- |
| `light`  | `CLOCK_TICK`，API 21+    | `KEYBOARD_TAP` |
| `medium` | `CONTEXT_CLICK`，API 23+ | `KEYBOARD_TAP` |
| `heavy`  | `LONG_PRESS`             | 同样的效果     |

在现代 Android 版本上，即使系统稍后抑制请求，`true` API 结果也可以确认异步调度。它不是振动的证明。

这些是平台反馈类别，而不是自定义波形。 OEM 可以使两个类别感觉相似。触觉不需要可选的原生适配器包。

有关设备设置、记录的请求时间以及平台确认和感受到的反馈之间的区别，请参阅 [原生验证说明](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/haptics.md)。

## 到达 {#arrival}

弹簧在其尾部稳定结束之前在推进序列的同一视觉到达处触发反馈。最后会触发补间。对于多个属性，Jolt 会等待最后一个到达，并在每个视图中触发一个冲击。延迟、财产覆盖和交错都包括在内。

```ts
animate(
  card,
  { x: 160, scale: 1.1 },
  {
    type: 'spring',
    duration: 500,
    haptic: 'medium',
  },
)
```

有限重复触发一次，在最后一次迭代结束时。无限动画没有最终到达，也不产生反馈。空动画、零持续时间变化和固定关键帧也保持沉默。

## 运动过程中的冲击 {#impacts-during-a-movement}

对于特定影响，请使用 `times`。在初始延迟后的完整有限动画上，这些增量点大于 `0` 且最多为 `1`。通过属性覆盖，跨度从最早移动属性的延迟开始，到最后一个属性完成时结束。该范围内包含有限重复；这些点不会自动重复。

`bounce` 预设值达到 60% 和 100%：

```ts
animate(button, 'bounce', {
  haptic: { style: 'light', times: [0.6, 1] },
})
```

点遵循解析的持续时间，而不是应用程序提供的单独的毫秒计时器。它们取代了默认的到达影响。

## 取消和时间安排 {#cancellation-and-timing}

`animation.stop()`、`stop(view)` 和中断取消待处理反馈。接管或停止任何属性都会取消该动画的剩余影响，即使其其他属性继续播放也是如此。同一视图上的独立动画保留自己的反馈。

卸载视图会永久取消其未决影响。如果原生视图被替换、位于窗口之外或应用程序处于非活动状态，反馈也会被跳过。当视图返回时，新的动画可以安排新的反馈。

`pause()` 保留未决影响，`play()` 安排剩余时间。这也适用于 `timeline()` 拥有的动画。寻找跳过交叉撞击点；倒带不会重放消耗的点数。这些是一次性事件，而不是可逆波形。

当播放开始时，Jolt 在 iOS 上准备 `UIImpactFeedbackGenerator`，并在远处撞击前不久再次准备。在 Android 上，离散的原生计时标记遵循 Animator 持续时间尺度，并且影响请求通过 JavaScript 在计划的边界执行。触觉调度程序中的每个动画帧没有 JavaScript 回调。该演示单独选择对其百分比标签进行进度观察。

计时是尽力而为：JavaScript 共享 NativeScript 中的 UI 线程，繁忙的线程可能会延迟请求。晚 **在动画时间里** 超过 100 毫秒的影响将被丢弃而不是重播。及时的平台请求仍然不能保证物理反馈。

## 运动设置 {#motion-settings}

Jolt 慢动作和 Android Animator 持续时间比例会影响播放时的反馈时序。即使 `configure({ reducedMotion: 'never' })` 保留逻辑动画，Android 比例 **0** 也会抑制反馈。将比例更改为零也会使待处理的请求静音。

立即跳跃的简化运动变换不会产生影响。仍然播放的不透明度/颜色动画可以保留其明确请求的反馈，除非 Android 的动画师被禁用。 `haptic: false` 始终禁用呼叫反馈。

自定义预设可以在其过渡中包含 `haptic`。通过 `haptic: false` 禁用它的呼叫：

```ts
animate(card, 'myPreset', { haptic: false })
```
