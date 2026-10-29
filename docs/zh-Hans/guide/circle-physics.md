# 圆形物理模拟 {#circle-physics}

让一些视图相互碰撞，从容器中反弹并跟随手指。 `physicsWorld()` 是自 **0.1.0-rc.1** 起可用的可选条目。升级后重建原生应用程序。

<Clip name="circle-physics-ios" caption="iOS 模拟器：Bump Club 具有真实的原生拖动/释放、圆圈和墙壁碰撞、脉冲、暂停/恢复和减少运动。英文UI，原汁原味的速度。" />
<Clip name="circle-physics-android" caption="Android 模拟器：相同的原生交互，使用实际的 ADB 触摸。英文UI，原汁原味速度；模拟器/仿真器记录不是真机性能测量。" />

创造世界**布局后**，使用专用的`AbsoluteLayout`和方形直子。每个视图的宽度和高度必须等于其圆的直径。位置是容器本地 DIPs 的中心，x 向右，y 向下。

```ts
import { physicsWorld } from '@rafaelaugusto/jolt/physics'
import { motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
// board is at least 240 × 300; red and blue are 48 × 48 direct children.
const world = physicsWorld(
  board,
  [
    { id: 'red', view: red, radius: 24, x: 70, y: 60 },
    { id: 'blue', view: blue, radius: 24, x: 170, y: 80, mass: 2 },
  ],
  { scope, restitution: 0.7 },
)

world.impulse('blue', { x: 180, y: -700 })
world.pause()
world.play()
world.reset()
// Read diagnostics on demand; no observer is required.
console.log(world.snapshot())
// On permanent screen teardown:
scope.dispose()
```

## 主体和选项 {#bodies-and-options}

| 输入            | 合同                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| 机构            | 1–16 个非重叠圆，唯一的非空 ID，半径 12–256 DIPs，质量 0.1–100（默认为 1）。一切都必须从容器内部开始。 |
| 区域            | 组合圆面积最多为容器面积的40%。每个直径必须适合两个尺寸。                                              |
| `velocity`      | DIPs/s中初始`{ x, y }`，默认为零；震级最多 1200。                                                      |
| `gravity`       | 默认为 `{ x: 0, y: 750 }` DIPs/s²；每个分量在-2000 到 2000 之间。                                      |
| `restitution`   | 0–1，默认 0.65。低于 40 DIPs/s 的正常触点稳定且不会反弹。                                              |
| `damping`       | 每秒指数速度阻尼，0–20；默认 0.5。                                                                     |
| `reducedMotion` | 默认为 `'pause'`。 `'continue'` 是对必要交互的明确选择。                                               |
| `scope`         | 可选主动运动范围；暂停暂停，恢复恢复之前的播放，处理删除世界。                                         |

`impulse(id, {x,y})` 使用质量 × DIPs/s 并将脉冲/质量添加到速度中。分量限制为 ±120000；由此产生的速度上限为 1200。暂停、分离、减少和保持的身体会忽略冲动。 `reset()` 根据当前边界和初始速度按比例恢复初始位置，包括暂停时。 `paused` 报告显式暂停； `snapshot().status` 还报告自动暂停、睡眠和无效边界。

## 原生交互和所有权 {#native-interaction-and-ownership}

iOS 上的生产 C 内核和 Android 上的 Java 内核执行固定的 1/240 秒步骤。原生显示回调推进物理并编写原生视图翻译；原生平移/触摸处理程序驱动拖动和释放速度。每帧、指针移动或碰撞没有 JavaScript 回调。 JavaScript 创建场景、发送命令、处理布局/生命周期边界并读取可选快照。 NativeScript与JavaScript共享其UI线程；此 API 确实 **不** 承诺通过阻塞的 UI 线程进行运动。

保持的圆充当运动体并推动其他圆。一次可以握住一个指针/主体；取消以零速度释放它。发布使用平台的指针速度，上限为 1200 DIPs/s。物体没有旋转、摩擦、关节、任意形状、连续碰撞检测或接触回调。这是一个小型 UI 游乐场解算器，而不是一般的刚体引擎或 Box2D 集成。

给予世界对其容器和主体视图的独占所有权。不要在其坐标空间处于活动状态时对它们的变换进行动画处理/绑定、附加其他手势/原生触摸侦听器、重新调整主体的父级或变换/滚动其坐标空间。现有的 NativeScript 手势观察器、初始变换和重复的世界所有权都被拒绝。让装饰性的子视图保持非互动性。处置会删除原生输入/生命周期挂钩，停止其时钟并恢复原始翻译和交互标志。

## 边界、休息和生命周期 {#bounds-rest-and-lifecycle}

调整大小会将中心缩放到新边界，取消拖动，清除速度并分离接触。对于其圆圈来说太小的容器会暂停原生时钟，直到它再次适合。密集或极端排列不属于稀疏圆形场景的支持范围；有界迭代求解器是近似的。

暂停、应用程序后台、卸载和减少运动停止更新并取消活动拖动。保留剩余的动态速度以供恢复。静止的世界会休眠并删除其显示回调；触摸圆圈或施加脉冲会唤醒它。每个显示帧最多运行 16 个子步（1/15 秒）。超出该限制的时间将被丢弃并报告为 `droppedMs`，从而防止 UI 停顿后无限制的追赶工作。

**在一起更好 / Bump Club** 预览提供英语、葡萄牙语、西班牙语和简体中文控件。原生圆形碰撞、[固定锚点弹簧与吸附](./physics-attachments)以及[重力与弹跳](./gravity)均已在 **0.1.0-rc.1** 中提供，共同构成 [#39](https://github.com/rafaelaugustos/jolt/issues/39) 已实现的范围。开发版本通过 [#238](https://github.com/rafaelaugustos/jolt/issues/238) 添加可选的[指针弹簧拖动](./physics-attachments)，直接拖动仍保留运动学行为。通用约束和任意形状不属于圆形物理世界的接口约定。请参阅[原生验证](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/circle-physics.md)和[交付审计](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/physics-completion.md)。

如果NativeScript重建原生视图，世界会自动处理。新布局后创造新世界。保留相同原生视图的卸载/加载仅暂停和恢复。
