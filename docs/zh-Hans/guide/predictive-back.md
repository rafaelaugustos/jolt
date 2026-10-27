# 预测性返回 {#predictive-back}

`predictiveBack(view, values, options)` 将专用表面连接到 Android 的系统后退手势。视图跟随任一屏幕边缘的进度；取消会弹回来，提交会在调用一次导航或解除函数之前完成弹跳。

自 **0.1.0-rc.1** 起可用。重建原生应用程序。需要 **Android 14 / API 34+**、手势导航、AndroidX 活动 **1.8+** 和下面的清单选择。使用 NativeScript 核心 **9.1.3** 和 `vue-router-ns` **0.1.0-rc.2** 进行验证。

<Clip name="predictive-back-android" caption="Android 16 / API 36 模拟器：真正的操作系统点击和边缘手势打开沙丘，取消部分返回，从右边缘提交，然后使用后退按钮。以原速度本地播放；不是真机性能测量。" />
<Clip name="predictive-back-pt-android" caption="Android 16 模拟器：相同的葡萄牙语原生取消、右边缘完成和可访问的后退按钮，由真实操作系统输入以原始速度驱动。" />

## 附加到拥有的表面 {#attach-to-an-owned-surface}

在主机应用程序上选择加入，而不是代表图书馆：

```xml
<application android:enableOnBackInvokedCallback="true" ...>
```

在附加视图并启动其生命周期时创建句柄，例如在页面的 `navigatedTo` 处理程序中。使用专用容器，其变换不会由其他动画或绑定写入。

```ts
import { predictiveBack } from '@rafaelaugusto/jolt/predictive-back'

const motion = predictiveBack(
  surface,
  {
    x: [0, 28],
    y: [0, 14],
    scale: [1, 0.9],
    rotate: [0, 0.6],
  },
  {
    spring: { duration: 380, bounce: 0 },
    // A successful vue-router-ns navigation resolves undefined; failures resolve an object.
    commit: async (options) => (await router.back(options)) === undefined,
    onState(event) {
      if (event.outcome === 'cancelled') console.log('Still here')
    },
  },
)

// Accessible back button: same animation and single commit path.
backButton.on('tap', () => motion.back())
```

`commit` 是必需的：Jolt 无法推断您的表面是否关闭工作表或导航路线。它接收 `{ animated: false }` 以防止第二次路由转换。当警卫拒绝时返回`false`；成功关闭/导航后返回 `true` 或不返回任何内容。同步错误和被拒绝的承诺也会恢复演示。对于页内面板，将其关闭在 `commit` 内。成功的手柄会自行处理；当该表面再次打开时创建另一个。

仅对于Core，一次提交可以检查`frame.canGoBack()`，如果不可用则返回false，然后调用`frame.goBack()`；配置该条目，在推送时无需进行第二个核心转换。不要将启用的所有者附加到没有拥有的后退操作的根页面。当 UI 的其他部分应该收到返回时设置 `motion.enabled = false`。

## 价值观和物理 {#values-and-physics}

| 值                              | 含义                                                   |
| ------------------------------- | ------------------------------------------------------ |
| `x`, `y`                        | DIPs 中的相对翻译，从 `0` 开始                         |
| `rotate`                        | 相对旋转度数，从 `0` 开始                              |
| `scale`，或 `scaleX` / `scaleY` | 捕获比例的乘数，从 `1` 开始，正端点                    |
| `opacity`                       | 捕获的 alpha 乘数，从 `1` 开始，终点在 `0` 和 `1` 之间 |

每个值都是有限的二元对。 `scale` 不能与 `scaleX` / `scaleY` 组合使用。默认值保留省略的属性。为每个手势捕获现有的原生平移、旋转、缩放和 Alpha，并在取消或清理时恢复。这六个属性在交互过程中属于句柄；不要同时为它们设置动画。

`mirrorX` 默认为 true：对于来自右边缘的手势，x 和旋转方向相反。 `spring` 接受 `smooth`、`snappy`、`bouncy`、持续时间/弹跳或刚度/阻尼/质量。原生进度将采样的释放速度传送到 Jolt 弹簧中。 Android 拥有提交/取消决定，包括轻弹； Jolt 没有中途门槛。可见进度被限制在 `[0, 1]`。即使物理异常或全局 `timeScale` 缓慢，结算也限于 **1.5 挂钟秒**；附加（或更新简化运动）时捕获速度。

## 原生输入、防护和清理 {#native-input-guards-and-cleanup}

Java `OnBackPressedCallback` 附加到视图树的现有调度程序所有者。它不会取代 Activity、路由器或调度程序。最后启用的回调拥有回来；在页面显示后注册此句柄，并在它不再拥有该操作时禁用或处置它。正常的 IME 关闭仍然在应用程序的返回操作之前。

进度更新和 `Choreographer` spring 框架保留在 Java 中。 JavaScript 接收生命周期事件和最终应用程序提交，每个进度样本或帧都不会回调。这不会使主线程 JavaScript 以非阻塞方式工作。

被拒绝的守卫会弹回来，但不会弹出历史记录。最多等待一次异步提交 `commitTimeout` 毫秒（默认 **5000**, 可接受的范围 **1–10000**），然后用理性恢复表面 `timeout`。这确实 **不** 取消您的承诺或撤消以后的外部导航：保持守卫有界或在您的应用程序中实施取消。

`state` 是 `idle`、`tracking`、`cancelling`、`finishing`、`committing` 或 `disposed`。完成/取消事件包括 `release: { progress, velocity }`（每秒进度）。终端空闲事件包括`outcome: 'completed' | 'cancelled'`；被拒绝的提交还报告 `reason: 'rejected' | 'error' | 'timeout'`。 `edge` 为手势左/右，按钮不存在。 `progress` 是一个轮询获取器，而不是一个反应值。

- `cancel()` 回滚保持的手势。 Android 已经提交的版本仍在继续。
- `enabled = false` 产生未来的返回输入并恢复保持的预览。
- 减少的运动使表面保持静止，同时保留所拥有的背部动作和防护检查。
- 视图分离、生命周期破坏和`dispose()`恢复表面并删除输入。 `commit` 期间的路由分离仅使有界完成处于挂起状态。暂停恢复手势。如果 Core 在 Activity 停止时卸载视图，则在重新加载并附加后创建一个新句柄；预览证明了这一点。视图保持附加状态的句柄可以恢复。
- `supported` 在 iOS、较旧的 Android、缺少原生代码、未附加视图或缺少/非活动视图树所有者上为 false。没有安装原生回调。显式 `back()` 仍然会调用您的提交而不进行任何动作；正常系统返回保持不变。在重试连接之前，请处理掉不受支撑的手柄。

即使 `supported` 为 true，清单标志和手势导航仍必须启用。该 API 对所提供的表面进行动画处理；它不会渲染先前的路由、添加共享元素变形或替换路由器的后堆栈。对于全页交互式 iOS 导航，请参阅 [互动导航](./interactive-navigation)。请参阅 [原生验证和再现步骤](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/predictive-back.md) 和 Android 的 [自定义背部动画指南](https://developer.android.com/guide/navigation/custom-back/support-animations-views)。
