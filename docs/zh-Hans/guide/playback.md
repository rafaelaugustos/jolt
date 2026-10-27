# 暂停与进度控制 {#pause-play-and-scrub}

## 观察回放 {#observing-playback}

`playbackProgress(animation)` 将现有有限动画的时钟公开为只读 [导出值](./motion-values)。它支持 `get()`、`to()` 和 `subscribe()`，并且可以驱动原生 `bind()` 目标。不需要应用程序计时器和第二个动画：

```ts
const drive = animate(car, { path: route }, { duration: 8000, ease: 'linear' })
const progress = playbackProgress(drive)
const releaseBar = bind(bar, { scaleX: progress })
const releaseNumber = progress.subscribe((p) => {
  remainingMeters.value = Math.ceil(routeMeters * (1 - p))
})
drive.pause() // holds the car, binding and observed value
drive.play()
// At destruction: releaseBar(); releaseNumber(); drive.stop()
```

该距离公式假定恒速路径，如演示中所示。播放进度是经过的时间线时间，而不是缓动位置或地理距离。通过缓动，沿着路径或地理坐标暂停，而是通过路线的实际参数/长度函数来映射进度。

<Clip name="controlled-playback-ios" caption="可观察的距离和条形跟随一辆汽车，而一条时间线暂停汽车、脉冲、波纹和延迟检查点。 iOS模拟器，实时回放。" />
<Clip name="controlled-playback-android" caption="Android 模拟器上的相同进度和联合播放控制。通过实际点击实现真正的原生播放。" />

该值遵循相同的原生时钟，包括延迟、交错、重复/反向、慢动作和 Android 动画师持续时间比例。搜索会更新它，而不改变播放是否暂停。在加载之前，它读取为零，或者挂起的明确请求的进度。完成后读为一；取消保留停止位置。零持续时间完成的动画读取为 1。持续时间仍未知的无限动画和时间线拒绝标准化进度。

原生绑定编译没有 JavaScript 观察帧的轨道。订阅者从动画值中选择共享 JavaScript 通知源；仅当 JavaScript 可以执行、合并更改并在停顿后传递当前值时，回调才会运行。当前值在 `finished` 解析之前可读，但最终订阅通知可以在该承诺之后的下一帧到达。完成后取消订阅；范围可以拥有订阅。暂停或固定的源无法进行连续的观察工作。

`animate(motionValue, ...)` 现在也返回 `PlaybackAnimation`。控件仅影响该通道：暂停基础不会暂停独立的附加层。使用[`timeline()`](./sequences#joint-playback)一起控制它们。停止活动层仍然会消除其贡献；暂停可以保留它。

## 单独控制 {#individual-controls}

`animate()` 和 `decay()` 返回 `PlaybackAnimation`。暂停它，设置其进度，然后继续：

<Clip name="playback" caption="在运行的时间线上播放和暂停。" />

```ts
const animation = animate(card, 'flipInY')
animation.pause()
animation.progress = 0.4
animation.play()
```

`pause()` 仅冻结该动画拥有的属性。同一视图上的另一个动画、对子对象的效果以及原生小部件动画继续运行。 `play()` 从当前位置恢复。两种方法都是幂等的。

## 进展 {#progress}

`progress` 是 **整个有限时间线** 上从 0 到 1 的数字，包括初始延迟、按属性延迟、重复、反向重复和交错。 `duration` 是时间线的长度（以毫秒为单位）； `paused`报告是否举行。

```ts
const animation = animate(
  cards,
  { x: [0, 100], opacity: [0, 1] },
  { duration: 1000, stagger: 200 },
)
animation.pause()
animation.progress = 0.5
```

对于两张卡，该时间线持续 1200 毫秒。在 50% 时，第一张卡的移动率为 60%，第二张卡的移动率为 40%。不同的属性持续时间使用相同的时间范围。

设置进度保留暂停/播放状态。暂停的动画可以达到 1 并向后滑动而不会稳定。正在播放的动画从新位置继续向前并正常完成。 0-1、`NaN` 和无穷大之外的值会在更改播放之前抛出。

无限循环可以暂停和播放，但没有有限的 `progress`：读取或设置它会抛出异常。在视图加载之前，有限持续时间报告为 0；当其轨道准备好时，请求的进度将被记住并应用。小组等待每个目标准备好，然后再应用其请求的进度。

## 手势和滑块 {#gestures-and-sliders}

创建并暂停动画一次。设置进度以响应用户输入：

```ts
const animation = animate(card, { rotateY: [0, 180] }, { duration: 1000 })
animation.pause()

slider.on('valueChange', ({ value }) => {
  animation.progress = value / 100 // slider range: 0–100
})

// Continue from the selected frame.
animation.play()
```

Jolt 不运行 JS 帧循环来保持或继续播放。仅当您设置进度时才会运行清理。 Playground 有“播放”、“暂停”、“停止”和一个滑块，并有一个独立的脉冲来显示其他动画不断移动。

## 中断和生命周期 {#interruption-and-lifecycle}

暂停使 `finished` 待处理。 `stop()` 冻结当前位置并与 `false` 解析；卸载还会停止并释放原生资源。接管的动画读取受控位置。暂停的轨道继承速度为零；恢复的轨迹继承其原始曲线在该位置的速度。

较短的属性和交错视图可以在其包含的动画仍处于活动状态时回退。由另一个动画接管的属性或在完成后更改的属性不会被擦洗回收。已完成和停止的动画仍处于终端状态：控件不会重新启动它们。创建另一个动画以重播。

序列对象保留基本 `Animation` 生命周期。通过保留 `animate()` 或 `decay()` 返回的 `PlaybackAnimation` 来控制特定步骤。在一步到达之前暂停一步，保存下一步；已经发生的到达是无法撤销的。 `animateText()`、`reveal()` 和 `symbolEffect()` 等效果保留其自己记录的控件，并且不公开通用进度。

触觉等待暂停并在剩余时间线中恢复。默默地寻找会跳过它所经过的点；向后寻求永远不会重放已消耗的反馈。

## 原生计时 {#native-timing}

在iOS上，每个`CAAnimation`都有自己的速度和时间偏移。 Jolt 保持层的时序不变，包括 Core 用于颜色和阴影的层。在控制命令期间替换 CA 副本无法通过过时的完成回调来解决原始承诺。

在 Android 上，原生暂停/恢复控制现有动画师。搜索会重新定位其关键帧，包括延迟和重复阶段。活动动画共享一个原生经过时间标记，以遵守系统动画师的持续时间比例。当每个所有者暂停并在恢复时开始新的标记时，Jolt 会删除该标记，从而避免 Android 的暂停时钟校正；它在最后一个所有者安定后被释放。这些标记中没有一个每帧调用 JavaScript。 Android 的 UI 线程限制仍然是 [适用](./android-performance)。

当应用程序在进入后台之前显式暂停时，视图通过 NativeScript 的临时 iOS 根卸载保留该暂停。恢复仍然是明确的。前台导航卸载仍会取消播放。
