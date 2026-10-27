# 返回复用单元格 {#returning-to-recycled-cells}

为共享导航条目提供稳定的项目密钥和 `returnTarget` 解析器。 Jolt 在返回页面布局后请求 **当前** 视图，以便照片在重新排序、滚动或回收后可以返回到其缩略图。在条目中保存的源视图永远不会用作返回标识。

自 **0.1.0-rc.1** 起可用。重建原生应用程序。该参考使用一个 Core Frame、Core ListView 和 vue-router-ns 0.1.0-rc.2。

<Clip name="return-targets-ios" caption="iOS 模拟器，英语：真实点击将选定的照片移动到回收网格的末尾，取消返回，返回到新单元格，然后删除照片并使用后备。原速度；不是硬件性能证据。" />
<Clip name="return-targets-pt-ios" caption="iOS 模拟器，葡萄牙语：与真实操作系统输入相同的重新排序、取消和删除的照片旅程。" />
<Clip name="return-targets-android" caption="Android 模拟器，英文：真实的系统后台取消和完成，重新排序后的当前单元格分辨率，以及删除项回退。原来的速度。" />
<Clip name="return-targets-pt-android" caption="Android 模拟器，葡萄牙语：真实的手势和可访问的后退控件可以执行当前单元格的返回和删除。触摸指示器显示实际的操作系统输入。" />

## 有界解析器 {#a-bounded-resolver}

```ts
import {
  sharedNavigationEntry,
  resolveListTarget,
} from '@rafaelaugusto/jolt/shared-navigation'

const entry = sharedNavigationEntry(frame, {
  tag: `photo:${photo.key}`,
  spring: 'smooth',
  returnTarget: {
    key: photo.key,
    timeout: 1500,
    resolve(context) {
      return resolveListTarget(context, {
        list,
        // Return the current ROW index, including grouped/grid rows.
        indexOf: (key) => rows.findIndex((row) => row.some((p) => p.key === key)),
        // Search realized cells by their current tag; never return a saved cell.
        viewForKey: (key) => findCurrentImage(list, `photo:${key}`),
      })
    },
    fallbackFocus: () => collectionHeading,
  },
  back: async (options) => (await router.back(options)) === undefined,
})
await entry.open((options) => router.push(`/photos/${photo.key}`, options))
```

`findCurrentImage` 是遍历列表当前子项的应用程序代码。请参阅完整的 [收集适配器](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/showcase/photo-collection.ts) 和 [原生细胞模板](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/showcase/collection-cells.ts)。该模板根据新项目的密钥更新每个回收图像的标签。它仅保留已实现的单元并正常使用图像缓存。

解析器接收`{ key, tag, page, signal }`。它可以返回视图、`null`、`undefined` 或承诺。 `signal` 暴露 `aborted`、`addEventListener('abort', callback)` 和 `removeEventListener`；它不需要浏览器 `AbortController` polyfill。执行申请工作时请注意取消。等待默认为 1500 毫秒，最多接受 5000 毫秒，包括实现和最终布局。较晚的结果将被忽略。 `resolveListTarget` 滚动到当前行并在布局后再次检查，要求两次遍历中具有相同的单元和几何形状，如果标识或估计的行偏移发生变化，则最多尝试四次。

解析 Jolt 后，返回的页面上需要有一个匹配的标签，并且提供者返回相同的加载视图。丢失、删除、重复或过时的视图、拒绝的解析器和超时采用普通/淡入淡出路径。他们不改变路线承诺。拒绝滚动或最终几何形状不兼容也会导致失败。已解析的视图获得可访问性焦点；当物品丢失时，`fallbackFocus` 会提供附近的标题。

## 平台行为 {#platform-behavior}

在iOS上，Core/UIKit将返回页面安装在详细信息下方。原生运动保持其初始姿势，而解析器实现目标，然后重新调整剩余边缘手势而不跳跃。等待时取消会中止准备并保留详细信息。承诺的回报完成一次。在飞行过程中更改单元格身份或几何形状会安全地结束演示。

在Android 14+上，系统后退手势预览当前详细信息页面。取消可以恢复它，而无需运行路线或解析目标。操作系统提交后，Jolt 捕获可见图像/页面，调用路由器一次，实现当前单元并运行原生共享飞行。 **实时回收目标不是交互式预测返回预览**：解决它发生在承诺之后。与静态 [共享手势](./shared-gestures) 后端不同，此模式不会保留原始网格作为长期位图。

两条路径都保持手势/动画帧原生。 JavaScript 在设置、分辨率和生命周期边界运行。现有的组合像素预算还涵盖任何临时保留的页面；不支持的GPU/WebView/视频内容或预算不足使用普通导航。减少运动仍然可以解决身份/焦点问题，无需共享飞行。路由超时无法取消应用程序拥有的承诺或撤消延迟的外部导航。

对于编程式导航，可以将相同的 `returnTarget` 传递给 `sharedNavigation().navigate()`。 `holdSource: true` 在目标安装时保留有界源页面快照。 `onCaptured` 在捕获后和调用路由器之前运行一次，允许持有的照片控制器释放其变换。调用`cancel()`结束演示和解析；它永远不会撤销已承诺的路线。

## UIKit变焦调查 {#uikit-zoom-investigation}

iOS 18介绍`UIViewController.preferredTransition = .zoom(...)`。其同步源提供者可以重复返回当前源视图；它在推送或呈现的视图控制器上运行，并拥有交互式解雇。公共选项不公开 Jolt 刚度/阻尼/质量或此异步实现合约。它是一个单独的潜在后端，此适配器未启用。请参阅 Apple 的 [缩放源提供商](https://developer.apple.com/documentation/uikit/uiviewcontrollertransition/zoomwithoptions%3Asourceviewprovider%3A) 和 [流体转变指导](https://developer.apple.com/documentation/uikit/enhancing-your-app-with-fluid-transitions)。

此交付涵盖解码的静态图像/普通容器、一个 Frame/窗口和轴对齐支持的几何体。原生模态、嵌套框架/选项卡、网络图像替换和图库寻呼机不在合同范围内。模拟器/仿真器证据并未完成 #24/#117 中的真机、屏幕阅读器和性能接受矩阵。参见 [复制和剩余支票](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/return-targets.md)。

使用原生照片缩放和从 [完整的画廊食谱](./gallery) 中释放的拖动姿势返回来构建此解析器。
