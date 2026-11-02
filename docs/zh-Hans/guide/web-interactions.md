# Web 浮层与共享运动

**自 0.1.0-rc.7 起提供**，对应 #320–#323。[作用域与输入指南](./web-lifecycle) 覆盖 #314–#317。Mavis 采用这些能力属于单独的集成工作。

## 实际渲染的几何边界 {#overlays}

打开的模态 dialog 或 popover 位于浏览器 top layer。DOM 祖先可以继续动画，而不成为浮层的坐标祖先。Jolt 在该渲染根节点结束几何遍历，支持 Shadow DOM 和 top layer 延迟移除。根节点自身的 transform 仍有效。浮层外也接受恒等 transform。

这修复了 [Mavis #197](https://github.com/getcortexlabs/mavis-ui/issues/197) 的上游复现：包含 Select 的 Card 使用恒等或运动 transform，不应导致 Sheet 的有效拖动表面被拒绝。依据是 [CSS top layer 模型](https://www.w3.org/TR/css-position-4/#top-layer)。

```ts
dialog.showModal() // 应用控制焦点、选择和关闭。
const open = runtime.scope()
open.drag(panel, { axis: 'y', snap: { y: [0] } })
dialog.addEventListener('close', () => open.dispose(), { once: true })
```

普通非模态后代若受祖先缩放、旋转或 zoom 影响，仍需坐标适配；不能将屏幕位移直接当作本地距离。Jolt 在修改 touch-action 或绑定输入前拒绝不支持的拖动空间。模态内部变换根节点仍影响几何。拖动表面的静态 transform 基线需为恒等。使用真正的 top layer modal/popover 或未变换的输入表面；z-index 不能替代此边界。

关闭 dialog 会释放已无渲染框的表面。关闭后立即取消/释放是安全的，重新打开时重建输入绑定。Jolt 不替代选择、焦点恢复、Escape、内容滚动或应用导航；失败也保留宿主行为。FLIP 和指针区域几何采用相同边界。

<Clip name="web-lifecycle-overlay-chromium" :width="900" caption="macOS arm64 上的 Chromium：真实点击在平移/旋转 card 内打开类似 Select 的模态框、拖动面板、选择 Porto、重开并用 Escape 关闭。演示 Jolt 边界，并非 Mavis 组件录制。" />
<Clip name="bottom-sheet-ios" caption="现有英文 NativeScript 演示，iOS 26 模拟器：真实拖动/滚动衔接、内容增长、键盘和关闭。原生参考，不是浏览器几何修复。" />

## 共享元素 {#shared}

`sharedLayout()` 在声明的 container 内连接最多八个互不重叠的身份。捕获离场视觉，执行应用同步变更，然后等待目标的下一次布局。Vue 可在随后 microtask 中替换/绑定 ref。controller 不负责导航或内容选择。

```ts
const shared = owner.sharedLayout(container, { transition: 'smooth' })
const detach = shared.attach(card, 'cover')
const flight = shared.transition(() => {
  card.remove()
  container.append(detail)
  shared.attach(detail, 'cover')
})
const result = await flight.finished
```

结果为 `completed`、`cancelled` 或 `unavailable`，适用时包含原因。过渡中可替换身份绑定，旧 detach 不会移除新绑定。副本为 inert、aria-hidden，无 IDs/属性/事件处理器或指针交互，冻结计算后的视觉而非复制应用代码。原元素通过私有透明度贡献隐藏；清理仅移除此贡献，保留其他运动及新透明度所有者。焦点由应用/浏览器负责。

过渡在离场/入场副本之间交叉淡化并平移/缩放。反向时先捕获当前视觉，再取消旧过渡。内容是视觉缩放，不是真实文字重排。`cancel()`/`stop()` 保留应用已改变的布局并移除副本。`pause()`/`suspend()` 取消并阻止新过渡，直到 `play()`/`resume()`。container/target 移除、scroll/resize 及实时减少动态效果也会清理。减少动态效果仍执行应用变更，最终内容保持可见。

`layoutTimeout` 默认为 500 ms，最大 10 秒。缺少/零尺寸目标报告 `missing-target` 或 `layout-timeout`。`maxElements` 默认每次操作 512 个复制元素，包括反向捕获；最大 4096。支持静态 HTML/文字及已解码图片。表单控件、canvas/video、嵌入文档、custom elements、Shadow DOM 内容、生成伪内容及旋转/倾斜/投影根节点返回 `unsupported-target`。支持正向轴对齐几何。捕获不受支持时仍执行同步应用变更，真实内容保持可见。应用变更抛错会先清理再传播异常。

临时舞台使用 manual popover，处于视口坐标，不继承页面 transform。缺少该能力的引擎走不可用路径。这是 DOM 视觉副本，不是截图或性能保证。请提前获取数据并解码图片。

<Clip name="web-lifecycle-shared-chromium" :width="900" caption="macOS arm64 上的 Chromium：真实控件切换 card/详情和缩略图/查看器，在运动中反向、取消并测试缺失目标。应用改变内容，视觉副本仅临时存在。" />
<Clip name="shared-layout-ios" caption="现有英文演示，iOS 模拟器：原生共享身份更换父容器、展开封面并从当前快照反向。原生参考，不是 Web 或实体设备证据。" />

## 完整交互示例 {#recipes}

[可执行源码](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-lifecycle/recipes.ts) 在一个作用域中组合三种交互：

- 有边界的 `drag()` 与弹簧返回，保留独立 `press()`。
- `animateSize(panel, { height: open ? 'auto' : 0 })` 实现内在尺寸展开。应用控制 `aria-expanded`、inert 内容及关闭时焦点。
- `animateLayout(list, mutation)` 对稳定身份执行重排/移除。应用控制顺序，Jolt 测量并动画。

快速切换和中断复用现有连续性与所有权规则，无示例专用求解器或逐帧循环。作用域释放监听器、controllers 和未完成运动。语义按钮支持键盘，Return 按钮补充指针拖动。这不是虚拟列表拖动重排或新组件框架。

<Clip name="web-lifecycle-recipes-chromium" :width="900" caption="macOS arm64 上的 Chromium：真实拖动/释放、内在尺寸展开及反向、重排/移除、减少动态效果和释放。三种示例组合已有 runtime 原语。" />
<Clip name="drag-ios" caption="现有英文演示，iOS 模拟器：真实原生拖动和释放。交互参考，不是 Web 坐标或实体设备性能测量。" />
<Clip name="size-ios" caption="现有英文演示，iPhone 17 模拟器 / iOS 26.0：真实布局和中断。中断片段在应用内选择 0.25×，视频时间未改变。" />
<Clip name="layout-ios" caption="现有英文原生 FLIP 演示，iOS 模拟器：布局变化与中断。不是 Web 示例在设备上运行。" />

## 集成诊断 {#diagnostics}

```ts
const diagnostics = runtime.diagnostics({ development: true, maxEvents: 200 })
console.log(diagnostics.snapshot())
diagnostics.clear()
diagnostics.dispose()
```

快照报告逻辑通道/layers、当前动画/值所有者 ID、保留的静止通道、执行路径及资源计数。事件标识接管、完成、替换、显式停止、释放、减少动态效果及作用域/runtime 生命周期。ID 仅在本诊断会话内有效，历史只保存数字和枚举，不含 DOM 或应用值。部分替换保留其他通道；失去通道的动画即使完成其余轨道，也可能以 false 结束。

历史容量 1–2000，默认 200。要求 `development: true`，每个 runtime 一个收集器，启用前和释放后不收集历史。`snapshot()` 按需读取，不增加 observer、定时器、帧订阅或渲染工作；动画事务中不执行事件回调。runtime 释放后保留最终可序列化快照，但诊断 handle 不继续持有文档。

保留的表面/静止通道不是活动动画。将活动值、帧任务、observers 和作用域计数与宿主基线比较；宿主最终调用 `release(target)` 或释放 runtime。诊断不测量 GPU、实际呈现 FPS 或输入延迟。

<Clip name="web-lifecycle-diagnostics-chromium" :width="900" caption="macOS arm64 上的 Chromium：真实控件启动 x/y，仅替换 x，查看所有者/原因并释放页面。按需更新，无轮询。" />
<Clip name="motion-inspector-ios" caption="现有英文原生 inspector 演示，iOS 模拟器，真实 XCTest 输入：中断、调参、暂停播放、layers 和 bindings。不是物理显示测量。" />

运行 `npm run web:lifecycle:test` 并参阅[录制复现](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-lifecycle.md)。矩阵覆盖 Chromium、Firefox、WebKit、清理及打包后的命令式/Vue/SSR 消费者。原生 CI 保护已有执行路径。完整 Web/mobile 对等能力 #236 仍未完成。
