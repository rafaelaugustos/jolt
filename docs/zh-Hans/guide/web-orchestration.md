# Web 编排与播放控制

这些实验性能力从 **0.1.0-rc.8** 起可用，由 #327–#333 跟踪。它们与原生播放共用可移植轨迹和调度规则。Web 入口不依赖 NativeScript 或框架；可选 Vue 适配器通过 `motion.use()` 及其子作用域管理生命周期。

## 数值与播放进度 {#values}

`animate(value, destinationOrKeyframes, transition)` 接受同一上下文的可变数值。`null` 读取当前通道。替换继承位置与速度；命名数值层以加法叠加，即使该数值绑定到缩放也一样。完成的层保留终值；停止该层会移除其贡献。`set(value, number)` 清除播放和所有层，`stop(value)` 保留合成值。派生值或其他上下文的值会在改变所有权之前被拒绝。

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'

const motion = createWebRuntime(document)
const scope = motion.scope()
const x = scope.motionValue(0)
scope.bind(card, { x })
const travel = scope.animate(x, [0, 240, 100], { duration: 1200 })
scope.animate(x, 24, { layer: 'accent', duration: 200 })
const progress = scope.playbackProgress(travel)
scope.bind(meter, { scaleX: progress })
travel.pause()
travel.progress = 0.5
travel.play()
// 仅移除此加法贡献：
motion.stop(x, { layer: 'accent' })
```

`playbackProgress(handle)` 是只读值，借用原有时钟。暂停、跳转、完成和取消都会反映到映射与绑定。释放进度不会停止源动画。必须具有已知有限时长；命令式 timeline 可能要等所有参与者启动后才知道时长。没有观察者时，数值与进度不产生逐帧循环。观察者和实时绑定使用共享的按需调度器，不会创建第二套视觉播放。

<Clip name="web-orchestration-values-chromium" caption="macOS Chromium：通过真实控件播放关键帧、增加或移除层、暂停、跳转并用弹簧改变目标。进度条使用 playbackProgress；这是浏览器录像。" />

<Clip name="motion-values-ios" caption="iOS 模拟器参考：一个 motion value 驱动面板、页面缩放和背景遮罩。复用现有原生录像，播放行为未改变。" />

## 惯性衰减与吸附 {#decay}

`decay(element, { x?, y? }, { friction?, snap? })` 将 CSS 像素/秒速度编译为有限 WAAPI 播放。Friction 必须在 0 与 1 之间，越大滑行越远。Snap 接受两个轴共用的列表或 `{ x: [...], y: [...] }`，选择最接近投影终点的位置。速度由调用方明确提供。重设目标时保留当前位置，其他通道继续运行。应使用手势松开时测得的速度保证连续。暂停、恢复、跳转、停止和减少动态效果遵循普通播放契约。

<Clip name="web-orchestration-decay-chromium" caption="macOS Chromium：真实指针拖动和松开、投影吸附、暂停/恢复与取消。示例负责输入，decay 负责松开后的轨迹。" />

<Clip name="orchestration-decay-ios" caption="iOS 模拟器参考：原生自由衰减和吸附。复用原始录像并移除启动前缀，播放速度保持不变。" />

## 序列与命令式时间线 {#groups}

两种 API 都接受绝对位置、表示上一个步骤启动的 `<`、以及相对视觉到达时间的有符号偏移。后续目标在准备时应用第一个绝对关键帧；null 和相对值在启动时解析。负偏移需要 animate/decay 的到达预测。Factory 在 JavaScript 线程执行并返回动画；准备失败会拒绝完成承诺并取消其拥有的工作。

```ts
const scene = scope.timeline([
  [card, { x: 240 }, { duration: 1400 }],
  [x, [0, 1], { duration: 1400, at: '<' }],
  { at: 800, run: () => scope.animate(badge, 'fadeIn') },
])
scene.pause()
scene.play()
await scene.finished

const steps = scope.sequence([
  [card, 'fadeInUp'],
  [badge, 'fadeIn', { at: '-100' }],
  () => scope.decay(card, { x: 400 }, { snap: [0, 240] }),
])
// 停止当前参与者并阻止后续 factory：
steps.stop()
```

`sequence()` 提供顺序、重叠播放与 stop。`timeline()` 还接受数值元组和可控制 factory，同时暂停当前参与者及未来启动。它只恢复自己暂停的子动画。文档隐藏时间不计入未来调度，手动暂停在重新显示后仍然有效。取消会阻止待启动的 factory。作用域暂停时取消 sequence、暂停 timeline。命令式组没有 seek；声明式拖动进度应使用 `seekableTimeline()`。在参与者明确之前，时长可能未知或无限。

<Clip name="web-orchestration-groups-chromium" caption="macOS Chromium：暂停会保留未来检查点，恢复后按剩余时间启动。第二次运行展示重叠步骤，取消移除后续工作。" />

<Clip name="orchestration-timeline-ios" caption="iOS 模拟器参考：原生顺序和重叠步骤。复用真实录像并移除应用启动前缀，保持原速。" />

<Clip name="controlled-playback-ios" caption="iOS 模拟器参考：原生路线、数值、波纹、进度与计划检查点一起暂停和恢复。这不代表实体设备性能。" />

## 命名状态与可替换引用 {#states}

`current` 是最近请求的状态，`settled` 是最后成功完成的状态。定义包含绝对终值和按目标指定的过渡。无效输入在改变所有权之前被拒绝。替换继承运动，省略的旧通道保留当前值。`attach()` 或稳定的 `ref(name)` 回调可以替换声明的表面：旧子动画停止，新元素从当前显示状态加入，完成承诺等待新元素结束。已经完成的状态立即应用于新表面。`null` 表示分离，缺失目标被跳过。清理不影响其他所有者。

```ts
const states = scope.motionStates(
  { card, badge: null as HTMLElement | null },
  {
    idle: { card: { x: 0, scale: 1 }, badge: { opacity: 0 } },
    active: { card: { x: 240, scale: 1.1 }, badge: { opacity: 1 } },
  },
  { transition: { duration: 600, badge: { duration: 180 } } },
)
const transition = states.to('active')
states.attach('badge', mountedBadge)
states.attach('card', replacementCard)
await transition.finished
// Vue setup 中，在 motion.use((scope, element) => { ... }) 创建这些资源。
// 永久卸载：
scope.dispose()
```

<Clip name="web-orchestration-states-chromium" caption="macOS Chromium：用错误状态中断、暂停、更换卡片元素、恢复并完成。新元素参与同一次状态完成。" />

<Clip name="motion-controllers-ios" caption="iOS 模拟器参考：原生上传、错误、重试和成功状态，作用域控件及卸载/重新挂载。复用现有英文录像展示对应的原生契约。" />

## 验证与集成 {#validation}

运行 `npm run web:orchestration:test` 验证 Chromium、Firefox 和 WebKit；运行 `npm run web:orchestration` 打开交互示例（`?demo=values`、`decay`、`groups`、`states` 或 `stroke`）。实际 tarball 的命令式/Vue 消费者覆盖七个 API、SSR 安全导入与原生 bundle。录像展示行为，不保证合成器加速或实体设备帧率。Mavis 采用这些能力属于单独集成，共享应用配方应保留与平台无关的意图。

## 可控制的 SVG 描边 {#svg}

`drawPath(svgGeometry, { progress? })` 创建拥有目标的绘制控制器（#333）。`animate()` 接受归一化终点或关键帧，返回有限播放的暂停、恢复、seek 和 stop 控件。向 `0` 动画可擦除或反转正在绘制的线条，并继承当前位置与速度。`playback.progress` 表示时间线进度，`drawing.snapshot().progress` 表示可见描边比例。旧 handle 的清理不会取消新的绘制。

```ts
const drawing = scope.drawPath(connectionPath, { progress: 0 })
const playback = drawing.animate(1, {
  duration: 1100,
  ease: [0.16, 1, 0.3, 1],
})
playback.pause()
playback.progress = 0.5
playback.play()
const reverse = drawing.animate(0, 'snappy')
await reverse.finished
```

驱动使用 SVG 用户单位测量几何并尊重 `pathLength`，无需固定长度，也不把 CSS 百分比当成路径进度。WAAPI 播放预计算的虚线轨迹；可选进度观察使用共享调度器。描边可能需要浏览器重绘，不保证合成器加速。参见 [SVG 虚线模型](https://www.w3.org/TR/SVG2/painting.html#StrokeDashing)。

每个绘制目标应有一个连续轮廓。路径、线段、折线、多边形、圆、椭圆和矩形均使用测量后的几何；复合轮廓请拆分为不同目标。零长度立即完成并保持不可见。终点必须位于 0–1，弹簧的视觉过冲被限制在此范围。有限重复和关键帧预算遵循 Web 播放规则，本 API 不对 `d` 做形状变换。可移植验证器保留原生的 20,000 字符和 256 个标准化命令限制。

控制器在释放之前拥有 dasharray、dashoffset 与描边透明度，释放时恢复原始样式，同时保留后来外部修改的行内值。填充、变换、输入和无障碍语义由宿主负责。请移除这些描边通道上的冲突 CSS 动画。几何属性与 resize 会被观察；`refresh()` 可显式重测且不重启归一化时钟。无效显式更新被拒绝，观察器发现无效几何时安全释放绘制。移除元素（包括 shadow root）、作用域销毁和减少动态效果会释放或完成对应工作。

Lume 保留 `vEnter`、`useContentTransition`、`useListLayout` 和 `useConnectionMotion` 负责 Vue 集成与编排。仅手写 SVG 绘制应交给此驱动。Reveal 的高度动画仍属于 Mavis 采用现有尺寸动画能力，不是 Jolt 缺失的物理能力。

<Clip name="web-orchestration-stroke-chromium" caption="macOS Chromium：真实控件绘制三条 SVG 连接，暂停、跳转、更改几何、在途中反转并开启减少动态效果。保持原始时序，没有合成录像。" />

<Clip name="shapes-ios" caption="iOS 模拟器参考：真实原生描边、暂停/恢复与减少动态效果，录像也包含原生形状变换。复用现有英文录像；此 Web API 仅覆盖描边，不包含 morph。" />
