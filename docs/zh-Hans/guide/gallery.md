# 联动相册 {#a-gallery-that-stays-connected}

打开缩略图，捏入细节，抬起一根手指后继续平移，中断双击缩放，然后向下拉以返回。该参考由 `sharedNavigationEntry`、`zoomable` 以及带有 Core ListView 和 vue-router-ns 的电流单元旋转变压器组成。路由与路由器保持一致；手势和动画帧保持原生。

自 **0.1.0-rc.1** 起可用。重建原生应用程序。在四种语言预览中打开 **生活画廊**。

<Clip name="gallery-ios" caption="iOS 26.2模拟器，英文：实际多点触摸输入，中断双击，取消拖动，重新排序后从释放姿势返回，以及删除回退。原来的速度。" />
<Clip name="gallery-pt-ios" caption="iOS 模拟器，葡萄牙语：与真实操作系统手势相同的完整交互。这不是真机性能证据。" />
<Clip name="gallery-android" caption="Android 16模拟器，英文：真正的捏合平移切换、中断、取消拖动并承诺返回到当前回收的缩略图。" />
<Clip name="gallery-pt-android" caption="Android 模拟器，葡萄牙语：缩放、取消、移动、拖回和删除。触摸指示器代表实际输入；素材未加速。" />

## 连接两个所有者 {#connect-the-two-owners}

根据照片的稳定密钥，为两张图像指定相同的 `sharedTransitionTag`。按照 [返回目标](./return-targets) 中的说明创建条目。等待 `entry.open()` 完成，然后再将缩放附加到实时细节图像。这可以防止开场过渡和观看者同时拥有图像。

```ts
import { zoomable } from '@rafaelaugusto/jolt'

// After entry.open() settles and the detail image is loaded:
const viewer = zoomable(detailImage, {
  viewport, // direct parent; unscaled in this recipe
  backdrop,
  chrome, // separate sibling, not an ancestor of the image
  dismiss: 'vertical',
  async onDismiss(intent) {
    const result = await entry.returnToSource({
      velocity: { x: 0, y: intent.velocity },
    })
    if (!result.navigated) intent.cancel()
  },
})
zoomButton.on('tap', () => viewer.zoomTo(2.5))
resetButton.on('tap', () => viewer.reset())
closeButton.on('tap', () => viewer.requestDismiss())
```

`returnToSource()` 捕获图像的 **路由前的当前原生姿势和视口剪辑**，将可见源页面保留在快照预算内，解析当前缩略图并启动原生飞行。它将提供的 x/y 平移速度传送到弹簧轨道中。速度在窗口空间中为 DIPs/秒；如果您的视口有缩放的祖先，请转换它。它不会从垂直释放推断捏/缩放速度。

在此操作运行时保持解除意图挂起。拍摄前请勿调用 `intent.complete()`：这会重置照片。接受的导航会卸载图像，从而处理缩放控制器。拒绝导航返回`navigated: false`；然后，`intent.cancel()` 将实时观看者从保持的姿势恢复。第二个返回请求得到 `unavailable/busy`，而无需其他路由。返回结果与[共享导航](./shared-navigation)状态相同。

完整的可运行应用程序代码为 [GalleryPhotoDetail.vue](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/showcase/GalleryPhotoDetail.vue)，其中包括 [集合身份/路由](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/showcase/photo-collection.ts) 和 [回收细胞模板](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/showcase/collection-cells.ts)。布局、项目存储、密钥查找、路由器故障映射和可访问控件仍然是应用程序代码。 Jolt 提供原生手势、捕捉、分辨率和飞行原语。

## 返回、取消和后备 {#back-cancellation-and-fallback}

| 情况                      | 参考文献中的行为                                                              |
| ------------------------- | ----------------------------------------------------------------------------- |
| 小垂直阻力                | 原生照片/chrome 稳定下来；没有路线运行。                                      |
| 缩放时拖动                | 在图像范围内平移；解雇等待最低规模。                                          |
| 缩放时可关闭              | 原生重置为最小值，然后一个解雇意图。                                          |
| iOS 缩放或拖动时的边缘    | `canBegin` 拒绝竞争所有权；重置或使用关闭。                                   |
| Android 缩放时返回        | 承诺重置缩放并保留细节；另一个后卫可以离开。                                  |
| Android 回到休息状态      | 先详细预览；操作系统提交后解析当前单元。                                      |
| 打开期间返回请求          | 提交的请求合并，直到条目解决。 UIKit 在其短暂进入转换期间可能会抑制物理接触。 |
| 重新排序/屏幕外项目       | 在测量前通过按键解析当前行并滚动。                                            |
| 已删除项目或实现失败      | 一次淡出/普通返回；切勿以已保存的矩形为目标。                                 |
| 无需输入的直接详细信息    | 普通路由器返回，或者历史记录为空时用图库替换。                                |
| 飞行期间窗口/布局发生变化 | 安全结束覆盖；保持承诺的路线。                                                |
| 暂停                      | 处理该条目；随后的关闭使用普通导航。                                          |

Reduce Motion 保留缩放/重置/关闭和路线/聚焦语义，而无需共享航班。副本是隐藏的，无法访问。当前返回项接收屏幕阅读器焦点；集合标题是丢失时的后备。物理 VoiceOver/TalkBack 和大文本接受尚未得到验证。

## 支持的里程碑 {#supported-milestone}

捆绑/缓存的静态肖像、风景和透明方形图像，一个 Core Frame/窗口、Core ListView 和 vue-router-ns 0.1.0-rc.2。自定义拖动返回支持矩形视口裁剪和统一正比例。入口处的部分缩略图可以使用普通开口；解决可见的回报目标仍然是独立的。网络替换、照片寻呼机、任意模式/嵌套帧转换、旋转图像和视频/GL/WebView 表面是后续功能。

本指南和 [本土证据](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/gallery.md) 涵盖模拟器/仿真器的正确性。真机帧节奏、输入延迟和进程内存分析在 #117 中保持开放；这些剪辑不会关闭该接受矩阵。

## Android 旋转与恢复 {#android-rotation-and-resume}

Android 16 / API 36 模拟器审计验证了从竖屏切换到横屏、再切回竖屏时保持 2.5 倍缩放，并在调整后的视口中执行真实拖动。返回主屏幕后重新打开应用，详情路由保持有效，仍可进行新的双指缩放及单指拖动、重置，以及取消关闭手势。

如上所述，应用挂起会释放共享导航入口，因此恢复后的首次关闭使用普通导航。之后每次打开都会创建新的入口：纵向图片、透明图片和横向图片的三个循环均完成返回当前缩略图的共享转场。结束时导航栈回到图库，原生转场、Back 回调和保留场景的计数均为零。这验证了这些资源与可见交互，并非进程内存或真机性能测量。

<Clip name="gallery-lifecycle-android" caption="Android 16 / API 36 模拟器，英文图库：真实输入完成缩放、旋转、拖动、主屏幕切换与恢复、新的双指缩放、取消关闭及重复返回。原速原生播放。录屏在横屏时保留空白边框，不代表真机性能测量。" />

[复现步骤与原始生命周期观测](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/gallery.md#android-lifecycle-audit-2026-10-29) 仅覆盖此适配器和场景。更完整的验收矩阵仍由 [#117](https://github.com/rafaelaugustos/jolt/issues/117) 跟踪。
