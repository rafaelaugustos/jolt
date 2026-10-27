# 拖动、惯性与吸附 {#drag-fling-and-snap}

`drag()` 跟随单个手指，限制平移并将释放速度带入原生动画。在 beta.8 中添加。

<Clip name="drag-ios" caption="iOS 模拟器中具有有限释放、橡皮筋和三个面板捕捉点的真实拖动。" />

```ts
import { drag } from '@rafaelaugusto/jolt'

const panel = drag(sheet, {
  axis: 'y',
  bounds: { top: 0, bottom: 600 },
  snap: [0, 300, 600],
  rubberband: true,
})

panel.dispose()
```

## 坐标并发布 {#coordinates-and-release}

`axis` 是 `'x'`、`'y'` 或 `'both'`（默认）。边界和捕捉点是 **DIPs 中的绝对平移坐标**，相对于视图的布局位置。它们不是屏幕坐标或容器的矩形。自行将`right`设置为可用行程距离； `drag()` 不会测量卡的尺寸并减去它。省略的边是无界的。界限必须是有限且有序的；相等的边锁定轴。

Snap 接受每个启用轴的数组，或 `{ x: [...], y: [...] }`。点必须是有限的、非空的并且位于该轴的边界内。距离预计衰减着陆点最近的点获胜；选择第一个列出的关系。因此，速度会影响选择。如果没有捕捉，视图会以 `friction` 减速（默认 `0.998`，严格介于 0 和 1 之间，每毫秒保留一次）。

硬边界是默认值：跟踪和释放保持在限制内。使用 `rubberband: true`，拖过边缘会遇到越来越大的阻力。超出范围的释放会弹回。到达边界的抛掷将其剩余速度带入边缘弹簧。按扣使用临界阻尼弹簧来承载释放速度；橡皮筋允许它短暂地超出界限。省略的捕捉轴可保持自由衰减。

跟踪开始时将保留现有翻译。新手势会中断所选轴的当前呈现；其他属性保持动画状态。释放期间触摸会立即停止释放。如果触摸永远不会变成平移，则视图将保持在该位置。创建前配置bounds/snap；选项被复制。布局更改后进行处置并重新创建以更改它们。

## 驱动动画值 {#driving-a-motion-value}

使用 `value`，手势会移动 [动画值](./motion-values#dragging) 而不是视图，因此一张纸可以驱动其后面的页面、背景以及绑定到该值的任何其他内容。轴为 `'x'` 或 `'y'`，边界和捕捉点采用值的单位：

```ts
const y = motionValue(380)
bind(sheet, { y })
bind(backdrop, { opacity: y.to([0, 380], [0.5, 0]) })
drag(sheet, { axis: 'y', value: y, bounds: { top: 0, bottom: 380 }, snap: [0, 190, 380] })
```

## 事件 {#events}

```ts
drag(card, {
  axis: 'x',
  bounds: { left: -160, right: 160 },
  snap: [-160, 0, 160],
  onStart: ({ x, y }) => highlightCard(),
  onMove: ({ x, y, velocityX, velocityY }) => updateReadout(x, y),
  onRelease: ({ target, animation }) => {
    void animation.finished.then((completed) => {
      if (completed) savePosition(target)
    })
  },
  onCancel: () => clearHighlight(),
  onSettle: ({ x, y }) => clearHighlight(),
})
```

位置和速度使用 DIPs 和 DIPs/秒。禁用轴的速度为零。在边缘之外，报告的速度包括橡皮筋阻力。 `onRelease` 接收预计的静止 `target` 和朝其播放的 `PlaybackAnimation`。 `onSettle` 仅在成功完成后才会触发。被取代或取消的发布句柄解决了 `false`；守卫完成效果相应。回调可能会取消或处置它们自己的控制器。保持移动回调轻量。

## 所有权和生命周期 {#ownership-and-lifecycle}

```ts
const motion = motionScope() // or useMotionScope() in Vue setup
const controller = motion.drag(card, { axis: 'x' })

controller.position // current motion position; x and y
controller.dragging
controller.settling
controller.cancel() // freeze current input/release, remain subscribed
controller.pause() // cancel and detach input
controller.play() // accept a fresh gesture
motion.dispose() // remove listeners and cancel owned release
```

`pause()` 取消，而不是按住手势或释放以供稍后播放。作用域暂停称之为；作用域恢复接受新手势。手动暂停的控制器在作用域暂停期间保持暂停状态。原生卸载和应用程序暂停取消输入/释放并分离手势侦听器。当控制器处于活动状态且未手动暂停时重新加载/恢复重新连接。显式 `dispose()` 是终端且幂等的。同一视图上的第二个 `drag()` 处理第一个；无效选项使第一个选项保持不变。处置仅停止其自己的发布句柄，保留其他所有者启动的较新动画。

取消会冻结当前位置，即使它超出了边界。它不会产生 fling、release 或 set 回调。多点触控和原生手势取消取消手势。 `isEnabled = false` 防止跟踪。减少运动保持直接手指跟踪并在释放后立即应用静止目标。

## 平台行为和范围 {#platform-behavior-and-scope}

跟踪使用 NativeScript 的同步主线程平移回调和 JavaScript 属性写入。 iOS 在父坐标中使用 `UIPanGestureRecognizer` 平移/速度。 Android 根据最近的原始运动事件位置和时间戳窗口估计速度，避免目标移动时的反馈。释放曲线采样一次并由现有的本地关键帧驱动程序播放；释放后没有JavaScript帧循环。繁忙的 JavaScript 线程仍然会延迟手指跟踪和应用程序回调。 Android 主运行时 JavaScript 与视图动画 [原生发布播放在繁重的主线程工作下也会停止](./android-performance) 共享 UI 线程。

使用未变换的父/祖先链来匹配 Android/iOS 平移坐标。此 API 不协调竞争手势或嵌套滚动、执行重新排序命中测试或提供生产底部表。 NativeScript/OS 手势仲裁仍然适用：父滚动可以接管并取消拖动，并且 iOS 识别器可以同时运行。该演示将垂直面板放置在专用的非滚动屏幕上。使用 [原生手势](./gestures) 在面板与其 ScrollView 之间进行同步识别和传输。

在 Playground 中打开 **拖动、猛击和捕捉**，或者在 iOS 上使用 `--drag-lab` / 在 Android 上使用 `--es drag-lab true` 启动。该演示包括有界卡衰减、具有三个停止、暂停/恢复、卸载/重新安装和减少运动的面板。

对于在原生发布期间必须保持交互的内容，请在开始播放之前在其容器上注册 [相互作用表面](./interaction-surface)。这在拖动演示中启用。
