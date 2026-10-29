# 约束与吸附点 {#attachments-and-snap-points}

给一个圆圈一个可以返回的地方，或者让一个释放选择它的下一个休息点。附件和捕捉扩展了 **0.1.0-rc.1** 中的原生 [`physicsWorld()`](./circle-physics) 条目。重建原生应用程序。

<Clip name="physics-attachments-ios" caption="iOS模拟器：实际拖动拉伸铜绳；缓慢和快速的释放在码头之间移动着淡紫色的圆圈。原生线条绘制、锚点重定向、暂停/恢复和减少运动。英文用户界面，记录源时序。" />
<Clip name="physics-attachments-android" caption="Android 模拟器：与真实 ADB 手势、原生弹簧/碰撞步进和原生系绳绘制相同的交互。英文UI，记录源时序；不是真机性能测量。" />

布局后创建世界。 [圆物理](./circle-physics) 的专用集装箱、方圆视图、所有权、密度和车身限制仍然适用。

```ts
import { physicsWorld } from '@rafaelaugusto/jolt/physics'

// board is 320 × 360; copper is 56 × 56 and lilac is 52 × 52.
const world = physicsWorld(board, [
  {
    id: 'copper',
    view: copper,
    radius: 28,
    x: 160,
    y: 130,
    attachment: {
      anchor: { x: 160, y: 50 },
      length: 72,
      stiffness: 180,
      damping: 14,
      line: { color: '#DBB994', width: 1.5 },
    },
  },
  {
    id: 'lilac',
    view: lilac,
    radius: 26,
    x: 160,
    y: 280,
    snap: {
      points: [
        { x: 64, y: 280 },
        { x: 160, y: 280 },
        { x: 256, y: 280 },
      ],
      stiffness: 220,
      damping: 25,
      projection: 0.12,
    },
  },
])
world.snapTo('lilac', 1) // Optional initial dock; release selection is automatic.
// Later, retarget without resetting the current velocity:
world.attach('copper', { anchor: { x: 100, y: 50 }, length: 72 })
world.snapTo('lilac', 2)
// Remove the anchor spring and any selected snap:
world.attach('copper', null)
// On permanent teardown (or use an owning motionScope):
world.dispose()
```

## 锚簧 {#anchor-spring}

`attachment` 将主体中心连接到容器中的固定点。 `anchor` 使用本地 DIPs，并且必须在板内启动。 `length` 是弹簧的静止长度，0–10000 DIPs（默认为 0）。这是一个弹性距离，而不是硬绳限制。悬挂体的平衡包括重力拉伸：在垂直配置中，额外距离为 `mass * gravity / stiffness`。

`stiffness` 是每个 DIP 的力，1–1000（默认 180）。 `damping` 是粘性阻尼，0–120（默认 24），与世界上的指数速度阻尼不同。现有体重会影响反应。原生固定步长积分器应用弹簧力和隐式粘性阻尼以及碰撞和现有速度上限。

可选 `line` 绘制从锚点到圆边缘的连接。其颜色为`#RRGGBB`；宽度为 0.5–6 DIPs（默认为 1.5）。 iOS 使用形状层，Android 使用可绘制层。现有的原生世界勾选更新该行；没有额外的显示时钟或JavaScript观察器。重定向取代了整个附件配置，包括线条样式。省略 `line` 将删除旧行。

## 释放捕捉 {#release-snapping}

`snap.points` 包含 1–8 个不同的有效圆心。循环开始时没有选定的停靠点；如果应该开始连接到一个，请使用 `snapTo(id, index)`。在原生释放时，Jolt 限制传入的指针速度，通过 `velocity * projection` 投影主体的释放位置，然后选择最近的点。 `projection` 为 0–0.3 秒（默认 0.12）；零按当前位置选择。等距离连接选择第一个配置的点。

卡簧保持释放速度并向选定的中心稳定。该实体选定的捕捉的重力受到抑制，因此它不会沉降到停靠点下方。碰撞解决方案仍然适用：被占用的码头可以阻止到达。 `snapshot().bodies[i].snap` 报告所选索引/点以及低速时圆是否在 0.25 DIP 以内；不承诺独家预订。原生 `release` 诊断在捕捉选择/积分之前记录位置和上限速度。

弹性刚度/阻尼使用与附件弹簧相同的范围/默认值。一个主体可以配置两种行为：选定的捕捉优先；一个新的阻力暂停了弹簧力，并且它的释放再次选择。然后可选线指向有效弹簧目标。

## 命令、取消和布局 {#commands-cancellation-and-layout}

- `attach(id, options | null)` 替换/删除锚点，清除选定的捕捉并保留速度。它在暂停时接受更改，但在重新定位之前无效边界必须适合圆圈。
- `snapTo(id, index)` 选择配置的目标，包括暂停时。它忽略当前被拖动的物体。为该命令提供可访问的按钮以及直接操作。
- 原生拖动是运动学的。取消、暂停、卸载、后台和减少运动以零速度释放所保持的主体并恢复其先前选择的捕捉；他们不会从取消的手势中选择新的停靠点。
- `reset()` 恢复初始位置/速度，清除选定的坞站并释放诊断，并保留当前的附件/点配置。再次拨打 `snapTo()` 选择初始底座。
- 使用存储的标准化坐标，锚点和点随容器边界缩放；点夹紧到有效的圆心，而不累积调整大小漂移。圆半径和附件静止长度保持固定在 DIPs 中。调整大小会像以前一样取消保持的实体并清除速度。

暂停/减少运动停止现有的原生时钟。安定的弹簧沉睡着；冲动、重新定位或新的手势都会唤醒它。处置会删除原生指南以及世界现有的输入/生命周期资源。输入变化和生命周期边界跨越JavaScript；力、目标选择、接触、绘图和每帧视图更新保持原生状态。 UI线程仍然与NativeScript JavaScript共享。

四种语言的 **回归之地 / Equilibrium** 预览演示了这两种行为。固定锚点弹簧和释放后的吸附点是 [#39](https://github.com/rafaelaugustos/jolt/issues/39) 已交付的第三部分，从 **0.1.0-rc.1** 起可用。默认的直接拖动会暂停弹簧力。开发版本添加了 [#238](https://github.com/rafaelaugustos/jolt/issues/238) 的可选指针弹簧模式，详见下文。物体间关节、刚性约束、任意形状和通用动力学引擎不属于当前接口约定。请参阅[验证与复现说明](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/physics-attachments.md)和[交付审计](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/physics-completion.md)。

## 指针弹簧拖动（开发版本）

此功能位于 RC.1 之后的开发版本中，需要重新构建原生应用。设置 `CircleBody.drag: { type: 'spring' }`，通过原生触摸输入移动临时锚点。圆球仍是动态物体，质量、重力和碰撞继续生效。省略 `drag` 或使用 `'direct'` 时保留原有的直接拖动方式。

<Clip name="pointer-spring-ios" caption="iOS 模拟器：真实 XCTest 手势移动弹簧锚点，展示跟随延迟、碰撞、松手回弹与吸附、暂停和减少动态效果。英文界面，原始播放时序；不是实体设备性能测试。" />
<Clip name="pointer-spring-android" caption="Android 模拟器：真实 ADB 手势展示移动锚点、碰撞以及松手后返回固定弹簧或停靠点，并演示暂停和减少动态效果。英文界面，原始时序；不是实体设备性能测试。" />

```ts
const world = physicsWorld(board, [
  {
    id: 'orb',
    view: orb,
    radius: 28,
    x: 160,
    y: 130,
    drag: {
      type: 'spring',
      length: 45,
      stiffness: 140,
      damping: 12,
      line: { color: '#FFE1A6', width: 2 },
    },
    attachment: { anchor: { x: 160, y: 50 }, length: 72 },
  },
])
```

`length` 是弹簧静止长度，单位为 DIP（0–10000，默认 0）；`stiffness` 为 1–1000（默认 180），`damping` 为 0–120（默认 24）。可选连线颜色使用 `#RRGGBB`，宽度为 0.5–6 DIP（默认 1.5）。创建时复制配置。临时连线仅在持有手势时显示，随后恢复固定锚点的连线。

触摸必须从当前可见圆球内部开始，每个世界只允许一个指针控制一个物体。临时目标为指针位置加上初始触点到圆心的偏移，并限制在容器的局部边界内。这不是连接圆球表面的关节，圆球不会旋转。仍不支持同时多点触控或经过变换的祖先视图。

松手会移除临时锚点，保留**物体的模拟速度**，不会替换为手指速度。吸附点根据该位置和速度选择；没有吸附点时恢复固定弹簧，或让没有固定弹簧的物体自由运动。取消手势会释放指针、清零速度并恢复之前的停靠点，不记录新的松手事件。暂停、减少动态效果、卸载、进入后台、尺寸变化、重置及销毁都会取消手势。`attach()` 修改静止弹簧，不改变正在使用的指针弹簧；`snapTo()` 和 `impulse()` 仍忽略被持有的物体。

快照中的 `held` 表示手势所有权；`pointer` 描述当前临时锚点，未持有时为 `null`，而 `attachment` 仍描述静止锚点。输入、积分和连线绘制复用有界原生时钟，无需逐次移动或逐帧 JavaScript 回调，但仍共享 UI 线程。参见[原生验证与限制](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/pointer-spring.md)。
