# 交互式导航 {#interactive-navigation}

`interactiveNavigation(frame)` 为 **自定义iOS页面转场** 提供原生边缘滑动返回。页面跟随手指移动；在中途取消之前释放，而继续或向前轻拂则提交弹出。 Jolt 弹簧可保持释放速度并使页面稳定。仅当 UIKit 提交时，Frame 和路由器才会更新其历史记录。

自 **0.1.0-rc.1** 起可用。重建原生应用程序。此集成已通过 NativeScript 核心 **9.1.3** 和 `vue-router-ns` **0.1.0-rc.2** 进行验证。

<Clip name="interactive-navigation-ios" caption="iOS 26.2模拟器：真实的XCTest点击和边缘拖动打开页面，取消部分返回，提交完整返回，然后使用后退按钮。以原速度本地播放；不是真机性能测量。" />
<Clip name="interactive-navigation-pt-ios" caption="iOS 26.2 模拟器：相同的葡萄牙语取消、提交和按钮导航，由真实的 XCTest 输入以原始速度驱动。" />

## 挂起与旋转 {#suspension-and-rotation}

**0.1.0-rc.2 中的修复：** 应用进入后台时，NativeScript 会暂时卸载根 Frame。Jolt 会取消正在进行的返回手势，并在该 Frame 重新加载期间保留控制器。恢复后，原页面、历史记录和自定义转场仍然可用。若 Frame 未重新挂载、路由已移除，或显式调用了 `dispose()`，则仍会释放控制器。

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

此 API 默认对整个 Frame 页面播放动画。图片或卡片若需共享原生进度，请使用[共享手势](./shared-gestures)。模态呈现使用下述独立的 `interactiveModal()` 控制器。整页全屏滑动和回收视图的自动实现不属于 Frame 接口范围。请保留普通返回按钮作为无障碍替代方式。参见[原生验证](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/interactive-navigation.md)。

## 交互式模态窗口 {#interactive-modals}

**尚未发布：** `interactiveModal()` 为占满窗口的 NativeScript 模态视图添加向下拖动关闭。打开预览中的 **交互式导航 → 打开模态窗口**。需要重新编译原生应用；已在 Core **9.1.3**、NativeScript-Vue **3.1.2** 和 iOS **26.2 模拟器**中验证。

<Clip name="interactive-modal-ios" caption="iPhone 17、iOS 26.2 模拟器，英文界面：打开真实 NativeScript-Vue 模态窗口，取消向下拖动，再次拖动并确认关闭，然后重新打开并用按钮关闭。原生原速播放。不证明真机性能或屏幕阅读器行为。" />

每次呈现都创建新的控制器。Core 和 Vue 继续管理模态窗口及关闭回调；Jolt 通过 Core 现有的过渡 delegate 提供原生动画与交互对象。

```ts
import { interactiveModal } from '@rafaelaugusto/jolt/interactive-navigation'
import { $showModal } from 'nativescript-vue'

const motion = interactiveModal({
  spring: 'smooth',
  canBegin: () => !saving,
  onState(event) {
    if (event.outcome === 'cancelled') console.log('窗口仍然打开')
  },
})
try {
  const result = await $showModal(Detail, {
    transition: motion.transition,
    props: { motion },
  })
} finally {
  motion.dispose()
}
```

在模态组件内部，关闭按钮使用 `motion.close(result)`。不支持的平台使用框架普通的 `$closeModal(result)`。只使用 Core 时，将同一个 `transition` 传给 `parent.showModal(content, { transition, closeCallback })`；普通的 `content.closeModal(result)` 仍可使用。如果呈现失败或被放弃，请释放未使用的控制器。[可运行的 Vue 示例](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/showcase/InteractiveModalDetail.vue) 不依赖页面路由。

| 操作             | 行为约定                                                                                                                           |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 向下拖动         | 一个原生 pan 控制模态窗口。进度跟随手指，松手后根据速度投影决定确认还是取消。UIControl 和 UIScrollView 后代保留各自的手势。        |
| 取消             | 恢复 controller 视图原有的 transform，保留 Core 模态窗口与 Vue 组件，不触发关闭回调或完成 promise。之后仍可再次拖动或按按钮关闭。  |
| 确认             | UIKit 只完成一次；Core 调用一次关闭回调，Vue 卸载一次。释放手势、display link 及 Core 过渡状态。                                   |
| `close(...args)` | 向 Core 传递参数。打开过程中第一个请求等待 `shownModally`；重复请求以及拖动或回弹过程中的请求返回 `false`，接受的请求返回 `true`。 |
| `cancel()`       | 回退仍在按住的手势。UIKit 已接受的松手结果仍会完成。                                                                               |
| `dispose()`      | 幂等地移除 Jolt 控制，但不关闭窗口。按住的拖动先取消，再释放 Core 状态；仍可使用 Core 或框架的普通关闭方法。                       |

模态选项中的 `cancelable: false` 与同步 `canBegin()` 会阻止手势关闭。请保留可访问的关闭按钮。“减少动态效果”使呈现和松手后的收尾立即完成，同时保留手指直接控制；启用此偏好会取消按住的手势。全局 `timeScale` 影响收尾，最长为三秒实际时间。状态包括 `ready`、`presenting`、`idle`、`dragging`、`finishing`、`cancelling`、`closed` 和 `disposed`。取消通知为 `idle/cancelled`，完成通知为 `closed/completed`。松手速度单位为**每秒模态窗口高度**。没有逐帧 JavaScript 观察回调。

在拖动时进入后台会取消手势，并保留模态窗口供返回前台后使用。录像在手指保持接触时请求旋转；此配置下，UIKit 在取消过渡结束后才显示横屏。恢复竖屏和后续关闭仍可正常使用。

<Clip name="interactive-modal-lifecycle-ios" caption="iPhone 17、iOS 26.2 模拟器，英文界面：真实按住拖动、Home/回到前台、旋转、再次取消及确认关闭，随后重新打开并用按钮关闭。保持原速；横屏在竖屏录像中旋转显示。Snapshot 等小按钮仅用于可选诊断。不证明真机性能或辅助功能验收。" />

支持的是 Core 的**自定义全窗口模态样式**，使用默认动画呈现。不要覆盖 `ios.presentationStyle` 或替换过渡 delegate。`animated: false` 使用普通的非交互呈现和关闭，不安装 Jolt pan。原生 sheet 停靠点、popover、外部 UIKit 呈现及滚动到关闭的手势接力不在本 API 范围内。包含滚动内容的模态窗口可以提供不滚动的标题栏作为拖动区域。在 Android、未重新编译原生类或 Core 缺少 `closedModallyEvent` 时，`supported` 为 false，`transition` 为 undefined。此示例未测量真机性能或 VoiceOver 遍历。

[原生观测与复现步骤](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/interactive-navigation.md#interactive-modals--2026-10-30) 记录了已验证的模态行为和资源释放。
