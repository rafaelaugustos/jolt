# 重力与弹跳 {#gravity-and-bounce}

给一张卡片一个固定的着陆位置，让它下落并弹起。 `{ type: 'gravity' }` 自 **0.1.0-rc.1** 起可通过现有的 `animate()` API 使用。

<Clip name="gravity-ios" caption="iOS 模拟器：真正的原生预览，通过实际的点击来进行放下、抛掷、暂停/恢复、返回、更改恢复和减少运动。英文界面；原来的速度。" />
<Clip name="gravity-android" caption="Android 模拟器：相同的弹道运动和控制，由原生视图渲染并通过 ADB 点击进行练习。英文界面；原来的速度。这些记录不是真机性能测量。" />

```ts
import { animate } from '@rafaelaugusto/jolt'

const falling = animate(
  card,
  { y: 280 },
  {
    type: 'gravity',
    acceleration: 1800,
    restitution: 0.55,
  },
)

falling.pause()
falling.play()
// Interrupt the fall and preserve its current position and velocity:
animate(card, { y: 0 }, 'smooth')
```

端点是属性平移坐标中的边界，而不是检测到的楼层或其他视图。如果该卡未变换的顶部为 20 DIPs，其高度为 100，则 400 处的底板需要 `y: 280`。测量您自己的布局。固定轨迹不响应障碍物或移动地板；布局更改后重新定位。

## 物理参数 {#physical-parameters}

| 选项           | 默认   | 含义                                                                                                 |
| -------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| `acceleration` | `1800` | 以单位/秒为单位的有限正量值，从起始值指向终点。对于视图翻译，单位为 DIPs。                           |
| `restitution`  | `0.55` | 保留的冲击速度分数，从 `0`（含）到 `1`（不含）。 `0`落地无弹跳；每个篮板的高度按恢复程度的平方计算。 |
| `velocity`     | 继承   | 沿着属性轴的有符号单位/秒。显式值会覆盖中断动画的速度；静止视图从零开始。                            |

仅 `x`、`y` 和数值动画值支持这条曲线。需提供当前或显式起点及一个终点，不支持多段关键帧列表。终点可以为负数：加速度指向终点，而速度保留坐标轴方向的正负号。起点和终点重合时，边界朝向坐标轴正方向；负速度会使物体远离边界，朝向边界的正速度则会立即反弹。

持续时间遵循物理原理。请勿将重力与 `duration`、缓动或弹簧参数结合起来。 `delay`、交错、重复、反向播放、命名图层、范围、暂停/恢复和进度查找使用现有的动画合同。反向播放将记录的轨迹反向播放；这不是一个新的物理模拟。 `finished` 会等到最后一次弹跳，因此序列不会在第一次接触时前进。

## 一个来源，多种观点 {#one-source-several-views}

```ts
import { animate, bind, motionScope, motionValue } from '@rafaelaugusto/jolt'

const scope = motionScope()
const height = motionValue(0)
scope.use(() => bind(ball, { y: height }))
scope.use(() =>
  bind(shadow, {
    scaleX: height.to([0, 280], [0.35, 1]),
    opacity: height.to([0, 280], [0.08, 0.4]),
  }),
)
scope.animate(height, 280, { type: 'gravity', restitution: 0.7 })
// Suspend on temporary inactivity; dispose when the screen is released.
```

动画值保留其加速度和速度的原始单位。 **软着陆** 预览使用球体和阴影的一个值，具有英语、葡萄牙语、西班牙语和简体中文控件。它还显示了抛掷和弹簧中断。

## 执行和限制 {#execution-and-limits}

Jolt 在设置过程中分析求解恒定加速度飞行。采样时会保留精确的接触和顶点时间，并且本地播放器会对样本进行插值。没有 JavaScript 物理循环或每帧应用程序回调。这在 iOS 和现有的 Android 动画驱动程序上重用了 Core Animation。 NativeScript JavaScript 共享UI线程；原生执行不保证每个平台或绑定路径继续通过阻塞的 UI 线程。

当下一次反弹在位置和速度容差范围内时，轨迹稳定在边界处。平移/动画值采样使用 0.25 单位插值容差；共享采样器报告极端情况何时需要其有界工作后备。设置拒绝超过 60 秒或 512 次飞行的轨迹以及非有限/溢出输入。完全弹性的无限弹跳超出了这条有限曲线的合同范围。

Reduce Motion 通过现有配置直接到达静止端点。当选择“减少运动”控件时，预览会立即停止运行下落。卸载/处置释放绑定和拥有的动画；临时背景暂停预览范围。

有限重力动画、原生[圆形碰撞](./circle-physics)以及[固定锚点弹簧与吸附](./physics-attachments)是 [#39](https://github.com/rafaelaugustos/jolt/issues/39) 已交付的三个部分，从 **0.1.0-rc.1** 起可用。可选的圆形物理世界还支持通过 `world.impulse()` 施加瞬时冲量。开发版本通过 [#238](https://github.com/rafaelaugustos/jolt/issues/238) 添加可选的[指针弹簧拖动](./physics-attachments)，默认仍为直接拖动。[decay 吸附点](./decay)和[连续弹簧](./live-springs)仍遵循各自的接口约定。请参阅[验证说明](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/gravity.md)和[交付审计](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/physics-completion.md)。
