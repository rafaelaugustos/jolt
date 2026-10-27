# 动画触控区域 {#touch-targets-during-animation}

`interactionSurface(target)` 使原生触摸几何体与 Jolt 的动画变换和视图子树中的不透明度保持一致。在 beta.8 中添加。安装新的原生助手后的 **重建 iOS 应用程序**。

<Clip name="interaction-surface-ios" caption="在缓慢的重新排序过程中，在移动的蓝色卡片上点击坐标可将其展开。 iOS模拟器；布局播放选择交互式几何图形。" />

```ts
import { animate, drag, interactionSurface } from '@rafaelaugusto/jolt'

const surface = interactionSurface(container)
const animation = animate(button, { x: 180 }, { duration: 1200 })
const cardDrag = drag(card, { axis: 'x', bounds: { left: 0, right: 180 } })

// When this screen is disposed:
cardDrag.dispose()
animation.stop()
surface.dispose()
```

注册表面 **开始动画之前**。目标可以是 NativeScript 视图或支持的模板引用。它包括目标及其 NativeScript 后代。包括您设置动画的每个祖先：仅选择按钮无法修复表面外部父级上的单独 Core Animation 变换。拖动演示会注册其容器，以便卡的释放保持交互性。

## 为什么选择加入？ {#why-opt-in}

默认情况下，Jolt 将目标写入 NativeScript 模型，并在 iOS 上播放 Core Animation 演示文稿。然后，当按钮在其他地方可见时，UIKit 可以对目的地进行命中测试。第 56 期的设备探针通过翻译中途暂停的真实按钮重现了这一点。

在表面内部，iOS 使用共享的原生 `CADisplayLink` 播放预先计算的数字关键帧，更新实际的原生变换和不透明度。 UIKit 的普通点击测试、手势传递、剪辑、同级顺序和可访问性几何体使用相同的几何体。没有替换 UIView 方法，没有插入透明代理控件，并且每帧没有运行 JavaScript 回调。颜色和装饰继续使用现有的驱动程序。

Android 的原生属性动画已经更新了触摸几何体。相同的 API 可以安全地使用并保留现有的驱动程序。

这是 iOS 上的 UI 线程成本：使用表面来移动交互式内容，而不是默认选择整个装饰场景。重主线程 JavaScript 可以延迟此播放和触摸处理。当应用程序的主线程被阻止时，无法保证渲染服务器播放。 NativeScript的JS属性值仍然遵循引擎的目的地簿记；它们不是反应性的每帧动画值。

## 所有权和播放 {#ownership-and-playback}

返回的句柄具有 `disposed: boolean` 和幂等 `dispose()`。同一视图上的独立注册会进行引用计数。处置一个并不会删除另一个。

处置禁用 **未来** 动画的表面。它不会停止或切换已经运行的动画的驱动程序。注册表面也不会迁移现有的 Core Animation 轨道。如果需要交互式几何体，则在注册后停止或替换该动画。

暂停、恢复、擦除、延迟、反向/重复和选择性中断保留其动画句柄语义。暂停的轨迹在没有活动显示链接的情况下保持其原始姿势。卸载会取消视图的动画。在 iOS 上，应用程序暂停会取消当前姿态的交互式轨迹，并使用 `false` 解决它们；需要时恢复后开始新的播放。这可以避免在后台保留交互式帧循环。

范围可以同时拥有注册和播放：

```ts
const scope = motionScope() // or useMotionScope() in Vue setup
scope.use(() => interactionSurface(container))
const animation = scope.animate(button, { x: 180 })
// scope.dispose() stops owned animations and disposes the registration.
```

## 原生交互规则仍然适用 {#native-interaction-rules-still-apply}

禁用或非交互式视图保持禁用状态。被剪裁的部分无法接收触摸，并且祖先的原生边界仍然限制命中测试。此 API 不会扩展父级的触摸范围、仲裁竞争识别器或更改 [拖动](./drag) 中记录的拖动坐标限制。 NativeScript 拥有控件的标签、角色和启用状态可访问性语义；表面保留这些控件而不是创建重复项。

[验证报告](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/interaction-lifecycle.md) 涵盖操作系统注入的点击、动画祖先、剪辑、重叠控件、`press()`、原生可访问性框架以及 iOS 和 Android 的生命周期检查。它不要求手动 VoiceOver 或 TalkBack 导航审核。
