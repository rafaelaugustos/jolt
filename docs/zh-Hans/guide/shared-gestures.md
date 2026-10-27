# 共享手势 {#shared-gestures}

`sharedNavigationEntry(frame, options)` 在打开路线并拖回时保持一张图像或一张卡片的连接。取消手势以保留细节；完成它以返回源。路由器拥有历史记录，而 Jolt 的原生驱动程序拥有共享演示文稿。

自 **0.1.0-rc.1** 起可用。重建原生应用程序。在 iOS 26.2 模拟器和 Android 16 / API 36 模拟器上使用 NativeScript Core 9.1.3 和 `vue-router-ns` 0.1.0-rc.2 进行验证。 Android 需要 API 34+、AndroidX Activity 1.8+、手势导航和 `<application android:enableOnBackInvokedCallback="true" ...>`。

<Clip name="shared-entry-ios" caption="iOS 26.2模拟器，英文：真实的点击和边缘滑动打开图像，取消部分返回，完成返回，然后在使用后退按钮之前打开并取消卡片。原始的原生播放速度。" />
<Clip name="shared-entry-pt-ios" caption="iOS 26.2 模拟器，葡萄牙语：相同的图像/卡旅程，原生取消和承诺返回与真实操作系统输入。这不是真机性能证据。" />
<Clip name="shared-entry-android" caption="Android 16模拟器，英文：真实系统左边缘取消和右边缘完成保持照片连接；该卡还可以通过其可访问按钮取消并返回。原来的速度。" />
<Clip name="shared-entry-pt-android" caption="Android 16 模拟器，葡萄牙语：真实操作系统手势和点击演示图像/卡片转换、取消和完成。触摸指示器识别实际输入；没有模拟动画帧。" />

## 一项条目，一位所有者 {#one-entry-one-owner}

为源和目标指定相同的唯一 `sharedTransitionTag`。两个页面都必须保留其视图树。图像必须是具有相同来源的解码静态核心图像；支持 `aspectFill`/`aspectFit` 裁剪更改。普通布局卡片交叉淡入淡出其快照。遵循 [共享导航](./shared-navigation) 中支持的内容规则。

```ts
import { sharedNavigationEntry } from '@rafaelaugusto/jolt/shared-navigation'

// The source Frame and page are already loaded.
const entry = sharedNavigationEntry(frame, {
  tag: 'place-cover',
  spring: { duration: 480, bounce: 0 },
  // vue-router-ns resolves undefined for success and a failure object for rejection.
  back: async (options) => (await router.back(options)) === undefined,
  onState(event) {
    if (event.outcome === 'cancelled') console.log('Still in detail')
  },
})

const result = await entry.open((options) => router.push('/place/cove', options))
// Wire the destination's accessible back button to the same owner.
backButton.on('tap', () => entry.back())
// Dispose when this owned entry is removed, not merely when its source is covered.
```

对于 Core，将提供的选项传递到 `frame.navigate({ create: createDetail, ...options })` 并使用 `back` 回调在 `frame.goBack()` 之前检查 `frame.canGoBack()`。如果无法退货，则返回 `false`。支持同步 `navigate` 返回 void。不要向同一条目添加另一个转换。

`open()` 是一次性使用的，并在条目呈现与现有 `SharedNavigationResult`（`completed`、`unavailable`、`cancelled` 或 `failed`，加上 `navigated` 和可选的 `reason`）解决后解决。丢失或不受支持的对使用普通导航。因此，`unavailable` 可以有 `navigated: true`。重复打开不会调用其他路由。输入完成后，打开期间的返回请求将合并为一个返回。

## 原生手势所有权 {#native-gesture-ownership}

| 平台        | 共享演示文稿和历史记录                                                                                                                                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iOS         | Core 的自定义转换挂钩保留其导航委托和 UIKit 历史记录。原生边缘识别器以相同的进度驱动页面交叉淡入淡出和共享图像/卡。该对在 UIKit 布置转换后得到解决。                                               |
| Android 14+ | 现有系统后台调度程序驱动原生进程和原生spring。在进入之前捕获静态源页面及其锚点的有界快照。真正的详细信息页面位于共享退货下方。应用程序的 `back` 回调在完成后运行一次，值为 `{ animated: false }`。 |

每个手势样本或显示帧都不会运行 JavaScript 回调。 JavaScript 解析标签、验证手势边界处的静态源、传递生命周期通知并执行应用程序导航。这不会使同步主线程 JavaScript 以非阻塞方式工作。

在iOS上，UIKit通过Core提交交互式pop；提供的应用程序 `back` 回调由可访问按钮使用。尊重 `Page.enableSwipeBackNavigation` 和路由器的防护策略：离开防护可以禁用原生滑动。在 Android 上，被拒绝的异步防护会弹回来，保留相同的条目以进行重试。操作系统决定手势是否提交；没有共享进入中途门槛。

## 清理和后备 {#cleanup-and-fallback}

- `back()` 使用原生返回路径；退货等待期间重复的请求将被忽略。为句柄已被释放的按钮保留普通的路由器后备。
- `cancel()` 恢复保持的手势。在打开期间调用它可以处理演示文稿；它不能取消路由器自己的挂起操作。操作系统已提交的 Android 版本仍在继续。
- `dispose()`、Frame 卸载、路由删除或应用程序暂停释放输入、覆盖和保留的快照。暂停后，使用普通后退或在下一次推动时创建新条目。
- 减少运动可以在不共享飞行的情况下保留导航。丢失/重复的标签、不兼容的图像、更改的静态 Android 源、不支持的内容或快照预算不足都会回退，而不会留下隐藏视图。
- `maxSnapshotPixels` 默认为 **8,000,000**，接受最大为 **32,000,000** 的正整数。 Android 解释了与其航班一起保留的返回场景； iOS 绑定每个航班。这限制了计算的图像像素，而不是总的进程内存。
- `navigationTimeout` 默认为 **5000 毫秒**，最大为 **10000 毫秒**。打开和后备返回等待在超时时释放所有权。 Android 的受保护提交在超时时恢复其预览。这些都不能取消应用程序承诺或撤消延迟的外部导航；保持警卫的界限。

弹簧接受 `smooth`、`snappy`、`bouncy`、持续时间/弹跳或刚度/阻尼/质量。原生稳定受到现有驱动程序的限制（iOS 上为 3 秒，Android 上为 1.5 秒）。可见的共享几何图形被固定到其端点。

生命周期 `state` 为 `ready`、`opening`、`idle`、`tracking`、`finishing`、`cancelling`、`committing` 或 `disposed`。事件可能包括 `shared: { status: 'ready' | 'unavailable', reason? }`、终端 `outcome` 和采样的 `release: { progress, velocity }`。它们是生命周期诊断，而不是反应性进度流。

此阶段支持**稳定的保留页面，一张静态图像或普通卡片**。 Android 的返回背景是一个快照：在覆盖时保持源静态；更改检测会回退而不是解决新的目的地。对于回收/屏幕外单元格和滚动目标分辨率，请使用可选的 [返回目标解析器](./return-targets)，它选择不同的 Android 退货政策。有关照片缩放和拖动关闭协调，请参阅 [完整画廊](./gallery)。实时视频/GL/WebView 内容、任意模式消除和 iOS 原生缩放过渡仍在此阶段之外。旋转、RTL 和真机性能尚未得到彻底验证。参见 [本地复制和审计证据](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/shared-entry.md)。
