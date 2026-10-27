# Android 上的 JavaScript 繁忙场景 {#busy-javascript-on-android}

Jolt 计算一次关键帧并在原生播放它们。这会从每个动画帧中删除 JavaScript 的工作，但 Android 的 `ObjectAnimator` 仍会更新 UI 线程上的 View 属性。在正常的 NativeScript 应用程序中，主运行时 JavaScript 共享该线程。长同步任务可以停止变换、不透明度和颜色播放，直到任务返回。

<Clip name="android-performance" caption="正常播放，300 ms JavaScript 块，并且在 Android 16 模拟器上的工作人员中进行相同的工作。视觉诊断，而不是设备性能保证。" />

`ViewPropertyAnimator.withLayer()` 不会将此工作移至 RenderThread。它将视图的绘图缓存在硬件层中，然后恢复前一层，并且仍然使用 `ValueAnimator` 来更新属性。 Jolt现有的不透明层缓存减少了绘图工作；它无法使阻塞的 UI 线程做出响应。请参阅 [`withLayer()` and property updates](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/core/java/android/view/ViewPropertyAnimator.java) 的 Android 源。

## 尝试一下 {#try-it}

Android 游乐场包括 **忙 JavaScript**，具有三个控件：

- Jolt `spin` 预设。
- 通过原生 `ViewPropertyAnimator.withLayer()` 进行相同的旋转。
- 原生圆形显示为单独的效果进行比较。

**播放** 无需额外工作即可运行。 **块 JS** 在动画开始后运行同步 300 ms CPU 循环。 **工人** 在另一个线程上运行相同的循环。工作器在播放开始之前已准备就绪，因此此比较不包括工作器启动。

原生显示是诊断控件，而不是 Jolt 的 `reveal()` API 的 Android 实现。支持 RenderThread 的效果是特定平台效果；它们不为任意 Jolt 关键帧或弹簧提供通用后端。

[可重复基准](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/android-busy.md) 记录原生属性样本、工作线程 ID 和 `gfxinfo` 帧间隙。它将 UI 窗口框架记录与实际屏幕呈现区分开来。记录的模拟器结果是诊断结果，而不是真机性能保证。

## 让 CPU 工作远离 UI 线程 {#keep-cpu-work-off-the-ui-thread}

使用 [NativeScript 工人](https://docs.nativescript.org/guide/multithreading) 进行数据准备、解析或其他可返回小型可串行结果的 CPU 工作。视图和 UI 更新保留在主线程上：

```ts
// In the app, not in Jolt.
const worker = new Worker('./prepare.worker.ts')
worker.onmessage = ({ data }) => {
  applyResult(data)
  worker.terminate()
}
worker.postMessage(input)
```

```ts
// prepare.worker.ts
import '@nativescript/core/globals'

self.onmessage = ({ data }) => {
  self.postMessage(prepareData(data))
}
```

处理工作人员错误并在其屏幕被处置时终止挂起的工作；该演示同时实现了这两点。 Worker 无法直接操作 NativeScript 视图。将计算移出线程也不会使大型列表协调或布局传递变得免费：小批量应用结果并避免运动期间昂贵的视图更改。

如果工作无法移动到工作人员，请将其拆分为有界任务，这些任务会产生原生事件循环，或者在开始动画之前完成它。 `Promise.resolve()` 只屈服于微任务；将长任务包装在 `setTimeout()` 中只会延迟相同的 UI 线程块。

在 iOS 上，Jolt 提交的 Core Animation 轨道可以在 JavaScript 块期间在渲染服务器中继续播放，但输入、新动画设置和 JavaScript 完成回调仍然等待主线程。
