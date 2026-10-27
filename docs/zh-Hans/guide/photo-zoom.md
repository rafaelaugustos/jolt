# 照片缩放与平移 {#photo-zoom-pan-and-dismissal}

`zoomable()` 提供 NativeScript `Image` 原生捏合、双击缩放、有界平移和可选的垂直消除。它保留相同的图像视图。指针处理、焦点数学、转换和稳定在两个平台上都以原生代码运行。

<Clip name="photo-zoom-ios" caption="iOS 模拟器中的捏合、平移、双击缩放、重置和取消关闭。" />

```ts
import { zoomable } from '@rafaelaugusto/jolt'

const viewer = zoomable(photo, {
  viewport: photo.parent, // Must be the direct parent
  scale: [1, 5],
  doubleTap: 2.5,
  dismiss: 'vertical',
  backdrop,
  onDismiss(intent) {
    // The application owns navigation; this callback fires once per intent.
    showCloseConfirmation().then((accepted) => {
      if (accepted) {
        if (intent.complete()) closeViewerRoute({ animated: false })
      } else intent.cancel()
    })
  },
})
```

添加包后重建原生应用程序。在图像具有父级后附加，或明确提供其未来的视口。安装程序等待两个视图加载、正版布局和加载的图像。 `ready`表示原生控制器是否存在。

同步抛出无效参数。稍后的原生设置失败会处理控制器、填充 `error` 并调用可选的 `onError(error)`，因此丢失的原生重建不会成为未处理的初始化拒绝。

## 手势规则 {#gesture-rules}

- 捏合遵循视口坐标中的焦点并保持在配置的比例范围内。
- 双击可在最小缩放和 `doubleTap`（默认 2.5，限制在范围内）之间切换。
- 在最小缩放以上，一根手指平移图像；边界考虑可见图像内容和视口大小。过度滚动会阻止移动并在释放时稳定下来。
- 在最小缩放时，祖先寻呼机可以进行水平移动。垂直解雇需要明确的垂直方向和`dismiss: 'vertical'`；默认情况下它是禁用的。
- 超过 35% 进度的解雇，或超过 1,000 DIPs/s 的同向垂直投掷，会发出一个意图。控制器保持该姿势直到取消、完成或重置。

刻度范围默认为 `[1, 5]`。最小值必须至少为 1。比例是相对于图像的原始正轴对齐变换而言的。旋转祖先而不是图像。视口在附加时剪辑转换后的内容，并在处理时恢复其先前的剪辑。

控制器拥有图像变换及其手势输入。附加时请勿在同一图像上运行另一个变换动画。 `imageEffect()`、`liquid()` 和另一个 `zoomable()` 取代此所有权并处置以前的控制器。使用祖先进行独立的屏幕运动。

## 控件和辅助功能 {#controls-and-accessibility}

```ts
viewer.zoomTo(3, { x: 100, y: 160 }) // Viewport-local focal point, in DIPs
viewer.zoomTo(2, undefined, false) // Immediate, without settling animation
viewer.reset()
viewer.requestDismiss()
viewer.cancelDismiss()
viewer.dispose()
```

公开用于缩放、重置和关闭的按钮或应用程序辅助功能操作，如演示所示。仅凭手势识别并不能替代这些控件。减少运动使程序化运动和稳定立即进行；直接手指跟踪仍然跟随用户。

`state` 是包含 `x`、`y`（视口本地 DIPs）、相对 `scale`、解雇 `progress` 和 `pending` 的快照。 `onSettled(state)` 静态运行。故意没有 JavaScript 进度回调。可选的单独的 `backdrop` 和 `chrome` 视图会随着关闭而自然消失；它们的原始不透明度在重置/处置时恢复。

## 导航和生命周期 {#navigation-and-lifecycle}

`onDismiss` 接收 `{ state, velocity, cancel, complete }`。速度为垂直 DIPs/s。 `cancel()` 返回最小变焦； `complete()` 路由器接受关闭后释放控制器。如果意图已过时，两者都会返回 `false`；仅在成功完成后才进行导航。如果没有处理程序，解雇将自动取消。重置、替换或处置后调用过时的意图没有任何效果。

该API是查看器的图像交互部分。共享元素路由转换仍为 [单独工作](./not-there-yet)。 `nativeController` 公开适配器的原生对象；路由在处置之前必须明确获取所有权，如果需要连续切换，则使用最终状态。

对于为查看者祖先设置动画的转换，请在导航为该祖先设置动画时保持解除意图挂起。图像保持在释放姿势。接受后，在使用 `complete()` 恢复图像之前隐藏/删除路线；取消时，恢复祖先并调用 `cancel()`。在可见路线转换之前完成会过早重置照片。需要对相同图像变换进行动画处理的适配器必须显式传输原生姿势；有关保持姿势 `returnToSource()` 切换，请参阅 [完整的画廊食谱](./gallery)。

该演示的 **开放观众路线** 使用真实的 NativeScript Frame 页面，这是一个具有透明度和可访问控件的肖像图像。 Android 系统“返回”和关闭按钮使用 `requestDismiss()`，它会在要求应用程序关闭之前将缩放图像返回到其静止比例。该示例禁用 iOS 的独立向后边缘手势以保留一个导航所有者。在同一图像视图上继续查看取消；离开查看器在接受路由弹出之前淡出其祖先。内联图像实验室也可以在没有导航堆栈的情况下工作。

源/延伸更改安全重置并重新附加。视口更改重新计算边界。卸载任一视图都会处理侦听器并恢复原始转换。后台处理取消了未完成的解雇并解决了形象；恢复重新启用输入。当应用程序删除查看器而不卸载其视图时，请始终进行处置。
