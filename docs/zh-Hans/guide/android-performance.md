# Android 上的 JavaScript 繁忙场景 {#busy-javascript-on-android}

Jolt 计算一次关键帧并在原生播放它们。这会从每个动画帧中删除 JavaScript 的工作，但 Android 的 `ObjectAnimator` 仍会更新 UI 线程上的 View 属性。在正常的 NativeScript 应用程序中，主运行时 JavaScript 共享该线程。长同步任务可以停止变换、不透明度和颜色播放，直到任务返回。

<Clip name="android-performance-compact" caption="正常播放，300 ms JavaScript 块，并且在 Android 15 模拟器上的工作人员中进行相同的工作。视觉诊断，而不是设备性能保证。" />

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

## 实测示例：导出报告 {#a-measured-example-exporting-reports}

播放审计现在每次向临时 worker 发送一条记录，并等待确认。worker 保存不断累积的报告，解析原生帧样本，序列化 JSON 并写入文件。UI 运行时保留动画控制，只接收简短的确认消息。启动或写入错误、取消操作以及离开页面都会终止 worker；上一次写入未完成时，不允许提交下一次写入。

<Clip name="report-export-android" caption="Android 15 / API 35 ARM64 模拟器，release 构建。通过真实点击，分别在 UI 线程和 worker 中将同一份实测报告导出 20 次，随后取消另一次运行。批量操作让停顿可见；worker 在播放前启动。保留原始时间，不代表实体设备性能。" />

这是应用和工具层的改动，不会自动把任意 Jolt 回调转移到其他线程。worker 有独立的运行时，也会消耗内存。[CPU/PSS 调查](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/android-resource-profile.md) 分别测量启动时间、主线程 CPU、进程 CPU 和内存，同时检查空闲、播放、原生线程活动、保留句柄和重复释放。UI 线程 CPU 降低并不证明总 CPU 或 PSS 降低。

## 紧凑播放与已结束的动画

Android 的数值变换和透明度现在用原生 float 数组保存采样曲线，并在原生代码中插值。求解器、采样点、时间和每个属性的独立控制保持不变。只有两个点的曲线以及旧版应用二进制文件继续使用原有路径。颜色、装饰属性和 live springs 使用各自的驱动。

<Clip name="playback-efficiency-android" caption="Android 15 / API 35 ARM64 模拟器，release 构建。通过真实点击，以原速对比原有与紧凑原生播放、暂停/继续、seek、中断和停止。这不是实体设备性能测量。" />

动画完成或取消后，保留其 handle 不再保留旧的采样曲线和原生播放 handle。暂停中的动画和仍可 seek 的 timeline 步骤会保留继续播放所需的数据。

[测量报告](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/android-playback-efficiency.md)区分了原生准备/求值 CPU、保留的 Java 堆、进程 PSS、30 秒播放和主机 JavaScript 内存保留，并提供重复测量与原始数据。微基准只计算位置，不进行渲染；其 CPU 改善不代表帧率或续航保证。PSS 属于整个进程。

播放仍依赖 UI 线程。对于适合移出的应用计算，worker 仍是实际的缓解方法；通用 RenderThread 后端需要单独设计。与 Reanimated、Flutter 的实体设备对比仍由 [#65](https://github.com/rafaelaugustos/jolt/issues/65)跟踪。
