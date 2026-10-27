# 动画检查器 {#inspect-motion-on-a-running-device}

选择一个视图，查看哪个动画拥有其属性，并将预期曲线与原生观察结果进行比较。实验 **59 — 动画检查器** 还调整弹簧，重放它并复制重现它所需的 TypeScript。

::: warning 仅限开发
自 **0.1.0-beta.18** 起在核心包中可用。重建探针的原生应用程序。将检查器导入保留在您的生产版本排除的开发条目中。
:::

<Clip name="motion-inspector-ios" caption="iOS 模拟器与实际的 XCTest 点按：检查中断，调整和重播弹簧，保持其播放，检查延迟/分层/绑定运动并复制 TypeScript。 Lime是发动机型号；粉红色是 CALayer 演示文稿的样本。原始捕获时序，而不是物理显示性能测量。" />

<Clip name="motion-inspector-android" caption="Android 模拟器，具有实际的 ADB 点按：同一检查器读取有界缓冲区中的原生视图属性。这些是 UI 线程观察结果，而不是 GPU 呈现时间戳或真机 FPS。原始播放速度。" />

## 仅在开发中开始 {#start-only-in-development}

```ts
// dev/motion-tools.ts — exclude this entry from the production build
import { createMotionInspector } from '@rafaelaugusto/jolt/inspector'

const inspector = createMotionInspector({
  development: true,
  capacity: 240,
  hertz: 60,
})
const unwatch = inspector.watch(card, 'card')
inspector.select('card', 'x')

const animation = animate(card, { x: 220 }, 'bouncy')
inspector.label(animation, 'Entrance')

// One batch, normally read by a development panel every 200–250 ms.
const state = inspector.read()
// state.properties: owner, label, layer, target, value, velocity, delay, elapsed, duration
// state.bindings: motion-value root, mapping ranges, live-follower input
// state.events: starts, replacements, stops, completion, pause/play/seek
// state.samples: time, expected, observed, source

unwatch()
inspector.dispose()
```

读取和选择不会查找、重新启动、订阅动画值或获取动画属性的所有权。原厂手柄标注`animate(view, ...)`；组句柄不是每个子属性的所有者。即使驱动程序播放一个复合音轨，命名图层也会显示为单独的所有者。该组合的驱动程序事件有自己的标识。

在重现错误之前观察并选择以捕获其边界。选择现有动画可提供其当前状态，但无法恢复过去的事件。绑定公开其现有的根和数字映射链；现场弹簧从动输入扩展到八个级别。颜色映射内部结构和任意外部依赖关系不会被重建。

## 调谐、复制并按住 {#tune-copy-and-hold}

```ts
import { inspectorSpring, springCode } from '@rafaelaugusto/jolt/inspector'

const spring = { duration: 650, bounce: 0.35 }
const options = inspectorSpring(spring)
// Physics is also accepted: { stiffness: 180, damping: 22, mass: 1 }
const code = springCode({ target: 'card', to: 220, spring })
```

演示仅在按下 **重播** 时更改持续时间/弹跳。 **复制TypeScript** 复制了初始速度为零的显式 `[0, target]` 弹簧，因此重新启动后新视图会重现相同的运动。复制时预览会保存这些旋钮。中断返回是一个单独的动作，并有意保持传入速度。

`inspector.control(animation, 'seek', 0.25)` 显式暂停并寻找有限播放句柄。使用 `'play'` 继续，或使用 `'pause'` 保持当前点。这是一个编辑命令，与检查分开。无尽的动画无法擦洗；当前的 `timeline()` API 不会公开任意的全时间线查找。可以在实际参与者激活时检查延迟的序列。

## 了解测量的内容 {#know-what-was-measured}

- **iOS:** 原生探针读取表示层。若不存在则`observed`为`null`；模型层永远不会被替换。
- **Android:** 探针读取 UI 线程上的原生 View 属性。这些值并不是 GPU 扫描输出的证据，并且回调顺序可以将读取的一帧置于动画师后面。
- 原生采样支持 `x`、`y`、`scaleX`、`scaleY`、`rotate`、`rotateX`、`rotateY` 和 `opacity`。其他属性保留引擎诊断，但显式原生采样不可用。翻译使用 DIP、旋转角度、比例/不透明度无单位值。
- `expected` 是传递给原生驱动程序的曲线，锚定到其报告的时钟。它是一个模型，而不是第二个屏幕的测量值。在选择之前开始的实时本地追随者和合成可能缺乏可重构的曲线；他们的预期样本是 `null`。直接应用程序写入和第三方动画师不在事件记录器的覆盖范围内。
- 原生和 JavaScript 历史记录有限制：容量 8-600，默认 240，最多 32 个注册视图和 1 个检查器会话。收藏是原生的； JavaScript 排出批次。请求的赫兹是上限，而不是刷新率保证。对丢弃的旧样本进行计数。情节差距仍然是差距。

卸载选定的视图或后台会停止原生收集。返回后再次选择视图以恢复。不观看会释放听众； dispose 会恢复以前的驱动程序并停止探测，但不会停止应用程序的动画。当开发页面或热重载会话结束时使用处置。

生产核心条目既不导入检查器挂钩也不导入其 UI；捆绑检查确认它们已被删除。原生探针类随核心二进制文件一起提供，但在显式启动之前处于休眠状态。 `development: true` 是显式选择加入，而不是自动检测发布版本。

`state.overhead` 报告累积的 JavaScript 读取/挂钩成本、原生采样/序列化成本、样本计数和缓冲区丢失。一批后报告原生排水成本。测量结果不包括面板渲染，并且是局部观察结果；该基准还比较了有检查和无检查的准备情况。参见 [验证和复制](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/motion-inspector.md)。
