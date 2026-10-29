# 交互式导航 {#interactive-navigation}

`interactiveNavigation(frame)` 为 **自定义iOS页面转场** 提供原生边缘滑动返回。页面跟随手指移动；在中途取消之前释放，而继续或向前轻拂则提交弹出。 Jolt 弹簧可保持释放速度并使页面稳定。仅当 UIKit 提交时，Frame 和路由器才会更新其历史记录。

自 **0.1.0-rc.1** 起可用。重建原生应用程序。此集成已通过 NativeScript 核心 **9.1.3** 和 `vue-router-ns` **0.1.0-rc.2** 进行验证。

<Clip name="interactive-navigation-ios" caption="iOS 26.2模拟器：真实的XCTest点击和边缘拖动打开页面，取消部分返回，提交完整返回，然后使用后退按钮。以原速度本地播放；不是真机性能测量。" />
<Clip name="interactive-navigation-pt-ios" caption="iOS 26.2 模拟器：相同的葡萄牙语取消、提交和按钮导航，由真实的 XCTest 输入以原始速度驱动。" />

## 挂起与旋转 {#suspension-and-rotation}

**尚未发布的修复：** 应用进入后台时，NativeScript 会暂时卸载根 Frame。Jolt 会取消正在进行的返回手势，并在该 Frame 重新加载期间保留控制器。恢复后，原页面、历史记录和自定义转场仍然可用。若 Frame 未重新挂载、路由已移除，或显式调用了 `dispose()`，则仍会释放控制器。

<Clip name="interactive-background-ios" caption="iOS 26.2 模拟器，英文演示：保持真实的边缘拖动时切换到主屏幕。返回应用后页面保持不变；新的 Jolt 手势只提交一次返回，随后通过按钮导航。原速播放，不代表真机性能测量。" />

在测试的 iOS 配置中，手势保持期间旋转设备会推迟界面旋转，直到部分返回结束。录像验证了页面保留、横竖屏布局及随后的返回手势；它并未展示拖动期间视口立即变化的情况。

<Clip name="interactive-rotation-ios" caption="iOS 26.2 模拟器，英文演示：保持边缘手势期间改变设备方向；UIKit 等待取消完成后才显示横屏。恢复竖屏后，新的滑动正常返回。真实原生输入，原速播放。" />

## 每个推送条目一个句柄 {#one-handle-per-pushed-entry}

```ts
import { interactiveNavigation } from '@rafaelaugusto/jolt/interactive-navigation'

// The Frame is already loaded. Create a fresh handle for each push.
const motion = interactiveNavigation(frame, {
  spring: 'smooth', // or { duration: 480, bounce: 0 }
  onState(event) {
    // Lifecycle notifications, never a per-frame observer.
    if (event.outcome === 'cancelled') console.log('Still on this page')
  },
})

try {
  await router.push('/place/cala-serena', { transition: motion.transition })
  // A guard/redirect may resolve without using this transition.
  if (motion.state === 'ready') motion.dispose()
} catch (error) {
  motion.dispose()
  throw error
}

// The pushed entry remembers the transition for programmatic back too.
await router.back()
```

仅对于 Core，将 `transition: motion.transition` 传递给 `frame.navigate({ create: () => page, ... })`。如果该导航从未启动，则处置句柄。不要将其转换重复用于另一个条目。提交的弹出、历史记录删除或 Frame 卸载会自动释放识别器和核心转换状态。 `dispose()` 是幂等的；根据`page.enableSwipeBackNavigation`，在可见页面上进行处理会恢复Core的默认滑动。

`supported` 为 false，并且 `transition` 在 Android 上或当编译的原生类不存在时未定义。呼叫者可以使用这些选项正常导航。此条目未实现 Android 预测返回。

## 手指、弹簧和路线所有权 {#finger-spring-and-route-ownership}

- 原生 `UIScreenEdgePanGestureRecognizer` 从前沿开始（LTR 中为左，RTL 中为右）。它需要水平意图、具有返回目的地的当前条目，并且没有活动的 UIKit 转换。
- 该手势调用 Core 提供的 pop 回调一次。 Core 现有的导航控制器委托提供 Jolt 的原生动画器和交互式控制器； Jolt 不会替换或混合该委托。
- 原生手势更新会移动真实的页面视图。在发布时，`JoltSpringAdvance` 在原生显示链接上运行，将手指的速度带入 Jolt 的实时值所使用的相同弹簧方程中。每帧没有 JS 回调。主线程JS仍然可以阻塞UIKit。
- 完成使用进度加上短速度预测。即使在穿过一半后，向后移动到边缘也会取消。结算限于三挂钟秒，包括不寻常的弹簧设置或缓慢的全局 `timeScale`。
- 取消会恢复两个页面转换并保留当前路由和返回堆栈。提交一次弹出操作。嵌套条目保留独立的句柄；只有顶部条目接受手势。

`spring` 接受 `smooth`、`snappy`、`bouncy` 或持续时间/弹跳和刚度/阻尼/质量设置。不接受延迟、重复、补间和显式速度选项。手势进度始终附着在手指上；全局 `timeScale` 影响每次导航开始时的弹簧。即使使用弹性弹簧，进度也会被限制在页面边界内。

## 警卫、可达性和清理 {#guards-accessibility-and-cleanup}

`page.enableSwipeBackNavigation` 始终受到尊重。当异步路由离开防护需要运行时，`vue-router-ns` 禁用它；使用后退按钮进行受保护的导航。可选的同步 `canBegin()` 可以施加额外的门。它不能等待异步决策。

减少运动会禁用边缘手势并立即完成编程页面运动。返回按钮仍然可用。暂停、视口更改、`cancel()` 和处置滚回按住的手势。一旦 UIKit 接受了发布，清理就会完成该决定，而不是尝试逆转已提交的弹出。

`state` 是 `ready`、`animating`、`idle`、`dragging`、`finishing`、`cancelling` 或 `disposed`。 `finishing`/`cancelling` 事件包括 `release: { progress, velocity }`，速度以每秒页面宽度为单位。手势后的 `idle` 通知包括 `outcome: 'completed' | 'cancelled'`。观察者异常通过 NativeScript Trace 报告，并且不会中断清理。

当上一页位于 Frame 的后堆栈中时，保持上一页的可见内容已安装：交互式返回预览它 **之前** `navigatedTo`。仅在该事件上重建所有内容会产生空预览。

默认情况下，此 API 会对整个 Frame 页面进行动画处理。对于同一原始进度上的图像/卡片运动，请使用 [共享手势](./shared-gestures) 组合。任意原生模式、全屏滑动手势和回收视图的自动实现仍然不属于本合同范围。使用普通的后退按钮作为可访问的替代方案。参见 [原生验证](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/interactive-navigation.md)。
