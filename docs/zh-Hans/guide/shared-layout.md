# 共享布局 {#shared-layouts-within-a-page}

专辑封面可以离开迷你播放器并成为扩展封面。选定的选项卡指示器可以在不同的父级之间移动。 **sharedLayout()** 通过标识连接这些视图，捕获传出的演示并将临时原生图像移动到新布局。

自 **0.1.0-beta.18** 起在核心包中可用。安装 `@rafaelaugusto/jolt@0.1.0-rc.2` 并重建原生应用程序以安装快照/渲染类。不需要可选的原生属性插件。

<Clip name="shared-layout-ios" caption="iOS 模拟器上的真实交互：选项卡指示器在父母之间移动，迷你播放器封面展开并返回，并且从当前快照开始快速反转。 Original timing." />

<Clip name="shared-layout-android" caption="Android 模拟器上的共享身份，具有真实的操作系统点击和原生快照播放。这不是真机性能测量。" />

## 更改树之前捕获 {#capture-before-changing-the-tree}

为容器创建一个所有者，并使用稳定的字符串键附加加载的后代视图：

```ts
import { sharedLayout } from '@rafaelaugusto/jolt/shared-layout'
import { motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
const shared = scope.add(sharedLayout(pageContent, { transition: 'smooth' }))

const detach = shared.attach(collapsedCover, 'cover', {
  content: 'image',
  radius: 12,
})

const flight = shared.transition(() => {
  // Replace the tree synchronously; register the new loaded view with the same key.
  replaceMiniPlayerWithExpandedPlayer()
  shared.attach(expandedCover, 'cover', { content: 'image', radius: 24 })
})
const result = await flight.finished
```

Vue 可以更新突变中的引用并将传入视图附加到其加载的处理程序中。 Jolt 在测量目的地之前等待 Vue 的排队更新和下一个原生布局。 [完整示例](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/components/SharedLayoutLab.vue) 还处理初始加载事件排序。

突变必须是同步的。首先加载数据。默认布局截止时间为500毫秒； **layoutTimeout** 接受最多 10,000 ms 的正值。丢失或未测量的目标将以回退结束并释放每个快照。

身份具有一个当前视图。过渡抛出之外的重复附件。在准备过程中，新视图可以使用相同的密钥替换捕获的源。支持捕获后移除源；卸载会自动取消注册。过时的分离回调无法删除其替换。身份必须属于所有者的子树并且不能重叠。

## 内容和几何形状 {#content-and-geometry}

位置、宽度、高度和统一角部剪切使用原生窗口坐标。坐标转换中包括正统一祖先比例和平移、滚动偏移、安全区域和 Android 密度。

- **内容：'图像'** 均匀缩放每个快照以填充移动剪辑并交叉淡入淡出到目标捕获。
- **内容：'容器'** 是默认值。捕获在变化的剪辑中保留其渲染的内容大小和交叉淡入淡出，而不拉伸文本。
- **半径** 是有限非负 DIP 值。省略它以使用视图的数字统一 borderRadius。

播放期间内容保持冻结状态。航班结束时，更新的标签或图像就会生效。临时副本不会接收触摸或辅助功能焦点。原始视图在飞行过程中隐藏，并在飞行结束时恢复。将反转控件保留在附加子树之外，并避免在播放期间单独改变其原生可见性。

## 中断和清理 {#interruption-and-cleanup}

新的转换在再次更改树之前捕获当前组合。原始位置和速度为新的几何轨迹提供种子。先前的句柄解析为已取消，原因为 **被打断**。

```ts
flight.cancel() // stop() is an alias
shared.cancel()
shared.pause() // cancels and rejects new transitions
shared.play()
shared.dispose()
```

取消显示应用程序的当前布局；它不会撤消应用程序突变。目的地几何形状变化、窗口旋转/调整大小、主机卸载和后台取消航班。减少运动应用突变而不使用移动叠加，并且在播放期间启用它会取消飞行。运动范围通过暂停/播放进行清理和暂停。

完成的 Promise 解析为 **已完成**、**已取消** 或 **不可用**，并给出后两者的原因。原因包括中断、显式取消、几何形状更改、暂停、缺少端点、不受支持的捕获、运动减少和布局截止日期。不受支持的捕获应用普通应用程序布局更改，而无需 JavaScript 帧循环回退。

## 初始支持案例 {#initial-supported-case}

支持一页/窗口中的静态图像和普通容器。 [导航转换](https://github.com/rafaelaugustos/jolt/issues/24) 和直接子 [布局动画](./layout) 是单独的 API。

半透明祖先、原生模糊/效果视图、旋转、倾斜、透视或负向或非均匀缩放祖先、部分剪切/屏幕外端点、作为捕获内容的滚动/列表容器、WebView、视频、相机和 GPU 支持的表面使用不可用路径。首先将端点解析为完全可见的轴对齐视图。不保证任意图像裁剪插值和实时表面。

最多可以注册八个身份。 **maxSnapshotPixels** 默认为 8,000,000 像素，大约 32 MB 的额外 RGBA 捕获，包括临时反转捕获。它最多接受 32,000,000 个。超出预算使用普通布局后备。该预算不包括应用程序已保留的图像。

## 执行 {#execution}

JavaScript 处理注册、应用程序突变、布局协调、曲线采样和终端回调。编译的 iOS/Android 代码捕获/绘制图像、评估准备好的轨迹、检查目标几何形状并拥有显示时钟。飞行回放不会在每个显示帧调用 JavaScript。

原生回调仍然与 NativeScript 共享 UI 线程；阻塞该线程会延迟播放。每次捕获或反转都会产生一次性 UI 线程准备成本。

该实现使用窗口附加的UIKit视图和Android的[ViewGroupOverlay](https://developer.android.com/reference/android/view/ViewGroupOverlay)。 iOS 上的源捕获读取 [表示层](<https://developer.apple.com/documentation/quartzcore/calayer/presentation()>)（如果可用）。

<Clip name="shared-layout-pt-ios" caption="iOS 模拟器上的巴西葡萄牙语嵌入式预览：选项卡选择、扩展播放器和快速反转。原始时间的真实操作系统输入。" />
