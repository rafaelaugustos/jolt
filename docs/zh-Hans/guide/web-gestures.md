# Web 手势、缩放与滚动

这些实验性功能自 **0.1.0-rc.9** 起可用，由 #340–#345 跟踪。六项功能共享文档运行时和资源作用域。Web 导入图不依赖 NativeScript 或框架。下方原生视频是保留的行为参考，不是此 Web 实现的录像。

在挂载后创建运行时。坐标使用 CSS 像素，旋转使用度，速度使用单位/秒。输入表面保持无 transform，动画应用到子元素；现有渲染坐标与 top-layer 边界仍适用。应用负责标记、语义、数据和导航。

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'

const motion = createWebRuntime(document)
const scope = motion.scope()
const x = scope.motionValue(0)
```

## 惯性拖动与数值 {#drag}

选择 `release: "decay"` 可复用原生拖动求解器：摩擦、投影吸附与边界恢复。`rubberband` 在越界时增加阻力。现有默认行为仍通过弹簧回到初始位置或吸附点。单轴配合 `value` 可控制借用的 motion value；省略它则移动输入元素。dragging/settling/position/animation/paused/disposed 与开始、移动、释放、取消、稳定回调描述生命周期。取消会冻结自身动画；dispose 不销毁借用数值。元素的有限释放动画使用 WAAPI。

```ts
const drag = scope.drag(handle, {
  axis: 'x',
  value: x,
  release: 'decay',
  bounds: { left: -200, right: 200 },
  rubberband: true,
  friction: 0.998,
  snap: [-200, 0, 200],
  onRelease: ({ animation }) => animation.finished.then(onFinished),
})
drag.pause()
drag.play()
drag.cancel()
```

<Clip name="web-gestures-drag-chromium" :width="760" caption="macOS Chromium：真实鼠标拖动与释放、有界惯性和借用数值。原始速度。" />

<Clip name="drag-ios" caption="iOS 模拟器参考：原有边界拖动、阻力与吸附演示。真实原生输入；播放行为未改动。" />

## 组合触点 {#contacts}

平移、双指缩放和旋转可同时识别。增减触点会重新建立测量基准，避免中心跳变。数值可观察，无需框架逐帧渲染；settleTo/jumpTo/updateBounds 与 pause/play/cancel/dispose 控制交互。平移支持轴、threshold、failOffset 和边界，也可按当前姿态计算边界。启用双击时，单击会等待确认。焦点坐标采用视口 CSS 坐标。仅在输入或动画活跃时安排帧。

```ts
const gesture = scope.gestures(inputSurface, {
  pan: true,
  pinch: { min: 0.5, max: 4 },
  rotate: true,
  onTap: select,
  onDoubleTap: reset,
})
scope.bind(card, {
  x: gesture.x,
  y: gesture.y,
  scale: gesture.scale,
  rotate: gesture.rotate,
})
gesture.settleTo({ x: 0, y: 0, scale: 1, rotate: 0 })
```

<Clip name="web-gestures-gesture-chromium" :width="760" caption="macOS Chromium：CDP 注入的浏览器可信双触点缩放/旋转、单触点继续以及双击。浏览器输入自动化，不是实体触摸硬件录像。" />

<Clip name="gesture-composition-ios" caption="iOS 模拟器参考：原有原生同时触点组合与点击演示。不是实体设备性能测量。" />

## 面板与嵌套滚动 {#scroll}

声明有界单轴平移及其滚动后代。向上时先展开面板再滚动；反向时先将符合条件的嵌套内容滚回起点，再折叠面板。每个增量只消费一次，释放沿用 decay。横向协调考虑 RTL 偏移。滚轮、键盘和焦点滚动仍由浏览器执行。协调的触摸轴由 Jolt 控制：Pointer Events 在触点开始前决定 touch-action，中途改 CSS 不能将当前平移交回浏览器。区域中的输入控件保留自身交互。

```ts
const gesture = scope.gestures(inputSurface, {
  pan: { axis: 'y', bounds: { top: 0, bottom: 240 } },
  initial: { y: 240 },
  scroll: { element: content },
})
scope.bind(panel, { y: gesture.y })
```

<Clip name="web-gestures-scroll-chromium" :width="760" caption="macOS Chromium：一次持续接触展开面板、滚动内容并反向，随后使用浏览器滚轮。" />

<Clip name="gesture-handoff-ios" caption="iOS 模拟器参考：同一次接触中，原生面板与内容交换移动控制。" />

## 图片缩放与关闭 {#zoom}

图片盒应在直接视口父元素内居中，通常使用 `width:100%; height:100%; object-fit:contain`。图片拥有独立 transform 贡献。焦点缩放、有界平移、双击、滚轮以及 +/−/0/方向键和 Escape 共享控制器；页面缩放快捷键仍由浏览器处理。ready/error/state 描述加载、几何与状态。可选 backdrop/chrome 使用独立透明度贡献。关闭是受保护的意图：应用决定导航，过时的 cancel/complete 返回 false。

```ts
const photo = scope.zoomable(image, {
  viewport,
  scale: [1, 5],
  doubleTap: 2.5,
  backdrop,
  chrome,
  onDismiss(intent) {
    closeRoute().then(
      (closed) => (closed ? intent.complete() : intent.cancel()),
      () => intent.cancel(),
    )
  },
})
photo.zoomTo(2, { x: 180, y: 120 })
photo.reset()
```

<Clip name="web-gestures-zoom-chromium" :width="760" caption="macOS Chromium：双击、平移、可信双指缩放、重置、取消关闭与键盘缩放。" />

<Clip name="photo-zoom-ios" caption="iOS 模拟器参考：原生图片缩放、平移、重置与取消关闭。" />

## 页头、锚点与刷新 {#header}

声明封面、可选图片/标题/固定分区及真实滚动容器。Jolt 管理可移除占位和动画贡献，最小高度可动态测量。preserveAnchor 在同步或异步渲染变更前记录可见行的键；行被移除时使用存续位置。scrollToItem/scrollToTop/remeasure 与控制接口使用同一滚动源。展开与紧凑标题协调可见性和焦点。可选刷新具有单一活动 promise、阈值、取消与失败重试。commit 在调用变更和恢复锚点前检查请求；异步变更在 await 后写入前也应检查 cancelled。取消会立即结束刷新结果。

```ts
const header = scope.scrollHeader(scroller, {
  header: cover,
  artwork,
  title,
  toolbarTitle,
  section,
  expanded: () => cover.offsetHeight,
  minimum: () => toolbar.offsetHeight,
  items: () => rows.map((row) => ({ key: row.id, target: row.element })),
  async onRefresh(context) {
    const next = await fetchRows()
    await context.commit(() => replaceRows(next))
  },
  onRefreshError: showRetry,
})
await header.preserveAnchor(() => insertRows())
header.scrollToItem('album-6')
header.cancelRefresh()
```

<Clip name="web-gestures-header-chromium" :width="760" caption="macOS Chromium：折叠、锚定插入、真实下拉释放、失败重试与完成。修正速度单位后重新录制。" />

<Clip name="scroll-header-refresh-ios" caption="实体 iPhone 17 Pro / iOS 27.2 参考：原有原生下拉刷新、失败重试与锚定更新。保留原视频，不代表 Web 实现。" />

## 按身份交互排序 {#reorder}

应用提供稳定字符串/数字键及已实现的 DOM 行，并提交按身份描述的移动。Jolt 通过私有层预览不同高度的相邻行，并使用 FLIP 配合渲染器提交。外部 transform 与按压反馈保持独立。支持鼠标、触摸长按、边缘滚动和键盘操作。建议使用专用手柄，让其余内容保留普通浏览器滚动。空格/Enter 开始或提交，方向键/Home/End 移动，Escape 取消。move/moveTo/moveUp/moveDown 使用同一提交协议。数据、身份、移除、几何与生命周期变化会取消过时工作。控制器不实现数据渲染或虚拟列表。

```ts
const reorder = scope.reorder(list, {
  items: () => rows.map((row) => ({ key: row.id, target: row.element })),
  handle: '[data-reorder-handle]',
  onCommit: ({ key, beforeKey }) => moveItemBefore(key, beforeKey),
  edge: { size: 72, speed: 640 },
})
reorder.moveDown('album-1')
reorder.move('album-1', null)
reorder.refresh()
```

<Clip name="web-gestures-reorder-chromium" :width="760" caption="macOS Chromium：鼠标排序、键盘提交、边缘滚动及真实控件触发的程序移动。" />

<Clip name="reorder-ios" caption="iOS 模拟器参考：原有不同高度行排序、按钮与边缘滚动。保留原视频。" />

## 生命周期与验证 {#lifecycle}

控制器支持显式 dispose 和作用域暂停/继续。在 Vue 中用 `useWebMotion(ref).use((scope, element) => ...)` 管理 ref 替换、KeepAlive 与卸载，并将输入表面和动画元素分开。减少动态效果时保留最终状态并跳过可选弹簧运动；无工作时调度器空闲。这不构成帧率保证，也不替代应用语义。

运行 `npm run web:gestures:typecheck`、`npm run web:gestures:test` 和 `npm run web:gestures`。测试区分合成识别协议与 Chromium 的可信多触点注入。参见[验证报告](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-gestures.md)。Mavis 集成另由 [#234](https://github.com/getcortexlabs/mavis-ui/issues/234)、[#235](https://github.com/getcortexlabs/mavis-ui/issues/235)、[#236](https://github.com/getcortexlabs/mavis-ui/issues/236) 和 [#237](https://github.com/getcortexlabs/mavis-ui/issues/237) 跟踪。
