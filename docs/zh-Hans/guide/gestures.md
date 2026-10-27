# 原生手势 {#native-gestures-and-scroll-handoff}

自 **0.1.0-beta.16** 起在核心包中可用。升级后重建原生应用程序。不需要可选的原生属性插件。

`gestures()` 在具有原生输入边界的 `GestureSurface`、NativeScript `GridLayout` 上组合平移、捏合和旋转。其只读输出可与 `bind()`、数字 `to()` 映射和 `springValue()` 配合使用。识别、指针跟踪和绑定输出更新不需要每次移动都有 JavaScript 回调。

从 `@rafaelaugusto/jolt/gestures` 导入此可选 API，并在升级后重建原生应用程序。

```ts
import { bind, motionScope, springValue } from '@rafaelaugusto/jolt'
import { GestureSurface, gestures } from '@rafaelaugusto/jolt/gestures'

const scope = motionScope()
const surface = new GestureSurface()
surface.addChild(card)
container.addChild(surface)
const input = scope.add(
  gestures(surface, {
    pan: { bounds: { left: -120, right: 120, top: -160, bottom: 160 } },
    pinch: { min: 0.5, max: 3 },
    rotate: true,
  }),
)
scope.use(() =>
  bind(card, {
    x: input.x,
    y: input.y,
    scale: input.scale,
    rotate: input.rotate,
  }),
)
const follower = scope.add(springValue(input.x))
scope.use(() => bind(trailingCard, { x: follower }))

// On page/component disposal:
scope.dispose()
```

<Clip name="gesture-composition-ios" caption="iOS 模拟器中的实际操作系统触摸输入：同时平移、捏合和旋转、添加/移除手指、单独的手势、单击/双击以及现有的 NativeScript 敲击侦听器。录屏线束采用XCTest；它不是真机性能测量。" />

<Clip name="gesture-composition-android" caption="Android 模拟器上的实际操作系统多点触控输入，然后是单击/双击和指针取消。 NativeScript 敲击侦听器保持连接状态。手势位置为DIP；比例是无单位的，旋转是度数。" />

## Recognition policies {#recognition-policies}

启用平移、捏合和旋转同时识别。添加或移除手指会重新确定平移质心和缩放/旋转测量的基准，而不会将质心的变化添加到输出中。变换输出是独立的；当您需要图像特定的焦点变焦、内容边界和消除时，请使用 [可缩放](./photo-zoom)。

`pan` 接受 `axis: 'x' | 'y' | 'both'`（默认 `'both'`）、`threshold`（默认 **8 DIP**）、`failOffset`（默认 **12 DIP**）和翻译 `bounds`。当垂直运动超过 `failOffset` 时，单轴平移在激活之前失败，从而允许父滚动获胜。界限是接触期间的硬限制。表面应该位于未缩放、未旋转的祖先链中；如果可能的话，单独移动其绑定的内容。

`pinch: true` 使用比例限制 **0.25–4**；通过 `{ min, max }` 来更改它们。 `rotate: true` 能够以度为单位进行旋转。 `initial` 接受`{ x, y, scale, rotate }`，默认为`{ x: 0, y: 0, scale: 1, rotate: 0 }`；初始值必须符合其配置的边界。

`onTap` 和 `onDoubleTap` 是分开的。当两者都存在时，单击等待双击失败。如果没有双击回调，则单击不会等待该关系。 `onStart`、`onEnd` 和 `onCancel` 报告 `{ x, y, scale, rotate, velocityX, velocityY }`；平移速度为 DIP/秒，禁用轴报告为零。取消的活动交互会发出一次取消，并且不会发出结束回调。没有自动投掷；在 `onEnd` 中选择释放操作。

这些是一个表面的内置关系，而不是外部识别器的任意图形。现有的 NativeScript 监听器保持独立。编写相同转换的侦听器仍然可以与 Jolt 绑定竞争。

## 垂直列表中的水平交互 {#a-horizontal-interaction-in-a-vertical-list}

将 `GestureSurface` 放入列表内容中，配置 x 轴平移并绑定卡片的 x 位置。水平运动激活平移；垂直移动让周围的原生滚动接管。周围的列表不是下面的`scrollView`选项。

<Clip name="gesture-carousel-ios" caption="iOS 模拟器上的垂直 NativeScript ScrollView 内的水平交互。在同一张卡上开始垂直拖动并滚动父卡。" />

<Clip name="gesture-carousel-android" caption="Android 模拟器上的同轴竞争。水平运动与卡保持一致；垂直运动滚动其父级。" />

## 在面板及其内容之间传输 {#transfer-between-a-panel-and-its-content}

对于包含 **NativeScript ScrollView** 的垂直面板，将该后代作为 `scrollView` 传递并提供两个垂直边界：

```ts
const input = scope.add(
  gestures(panelSurface, {
    initial: { y: 180 },
    pan: { axis: 'y', bounds: { top: 0, bottom: 320 } },
    scrollView: results,
    onEnd: ({ y, velocityY }) => {
      input.settleTo({ y: y + velocityY * 0.15 < 160 ? 0 : 320 })
    },
  }),
)
scope.use(() => bind(panelSurface, { y: input.y }))
```

向上拖动会消耗面板在滚动其内容之前的剩余行程。在移动面板之前，向下拖动会消耗内容到顶部的距离。同样的接触继续跨越边界。 Android使用嵌套的前/后滚动消耗； iOS 协调同步平移与原生滚动视图并转发其现有委托。当扩展内容可以消耗原生滚动时，原生滚动会保留其释放。

<Clip name="gesture-handoff-ios" caption="连续滑动可展开面板，然后滚动其内容；反向滑动到达内容顶部并将面板向下移动。 iOS模拟器，页内测试面板。" />

<Clip name="gesture-handoff-android" caption="使用 NativeScript 的 NestedScrollView 实现在 Android 模拟器上进行相同的页内切换。在面板/内容边界处不需要抬起手指。" />

此集成已使用 NativeScript 核心 **9.1.3**、iOS 运行时 **9.1.0** 和 Android 运行时 **9.1.1** 进行测试。支持垂直核心ScrollView；它不承诺 ListView、RecyclerView 插件、第三方列表实现或水平内部滚动的切换。 Android 检查原生滚动是否实现了所需的嵌套滚动协议。不同的列表需要自己的适配器和原生测试。

## 移动和所有权 {#movement-and-ownership}

`position` 读取所有四个当前值。表面负载后，`jumpTo(partialPosition)` 立即移动，`settleTo(partialPosition)` 使用原生弹簧。从 `onEnd` 调用的沉降携带释放速度；重新定位现有定居点可以保留其当前速度。 `spring` 接受 `stiffness`、`damping` 和 `mass`。减少运动可以立即稳定下来，同时仍然可以进行直接手指跟踪。

`updateBounds(partialBounds)` 更新限制而不重置位置或速度。它不会选择新的目标：当布局/内容更改时，使用新解析的捕捉点调用 `settleTo()`。

`cancel()` 冻结接触或稳定在当前位置。 `pause()` 取消并停止接受输入； `play()` 接受新联系人。作用域暂停使用这些方法。卸载和应用暂停取消输入；除非手动暂停，否则重新加载/恢复会恢复它。 `dispose()` 删除拥有的识别器/原生调度，恢复滚动委托并释放所有四个值。放下或抬起手指不会终止控制器的使用寿命。

在Vue中，在安装应用程序之前将`GestureSurface`注册到`registerElement('GestureSurface', () => GestureSurface)`，并采用`useMotionScope().add(...)`的控制器。添加与 `useBinding()` 或作用域的 `use()` 帮助程序的绑定。该演示可在 Playground 中的 **原生手势** 下使用，或在 iOS 上使用 `--gesture-lab` / Android 上的 `--es gesture-lab true` 上使用。

原生输入和活动 spring 仍然在 UI 线程上执行。该线程上繁忙的 JavaScript 可能会延迟它们。显式回调、现有 Core 侦听器和 `subscribe()` 保留其 JavaScript 成本。多点触控注入器仅位于录屏线束中；它们不作为应用程序代码提供。

`onContactStart` 和 `onContactEnd` 报告第一次和最后一次接触，包括从未变成平移的触摸。它们是选择加入的并且需要本地重建。 [底部面板配方](./bottom-sheet) 使用它们来解决触摸中断弹簧的问题，而不会拦截文本字段上的点击。
