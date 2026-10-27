# 减速与吸附 {#decay}

给视图一个速度并让它慢下来，就像一张卡片经过一次猛击：

<Clip name="decay" caption="一种自由衰变，然后是断裂。" />

```ts
import { decay } from '@rafaelaugusto/jolt'

decay(card, { x: 600 })
decay(card, { x: -400, y: 200 }, { friction: 0.995 })
```

`x` 和 `y` 是 **DIPs 每秒** 中从当前位置开始的平移速度。省略的轴继续做他们正在做的事情。目标可以是视图、模板引用、`ElementRef` 或这些的数组。

`friction` 是每毫秒的速度倍数。默认为`0.998`；较小的值减速得更快，接近 `1` 的值移动得更远。它必须是有限的并且严格位于 `0` 和 `1` 之间。该运动遵循经过的时间，因此更改显示器的刷新率不会改变着陆。

完整的曲线计算一次并由 Core Animation 在 iOS 或 `ObjectAnimator` 在 Android 上播放，每帧没有 JavaScript。这使用现有的驱动程序；此添加的原生验证是在 iOS 上完成的。

## 捕捉点 {#snap-points}

```ts
decay(card, { x: 600 }, { snap: [0, 320] })

decay(
  card,
  { x: 600, y: -400 },
  {
    snap: { x: [0, 320], y: [-200, 0] },
  },
)
```

使用 `snap`，Jolt 预测衰减将停止的位置，选择最近的位置并弹到那里 **直接地**，保留提供的速度。它使用默认弹簧。它不会等到衰变完成才折断。

数组对每个提供的轴应用相同的停止点。对象独立设置停止；没有停止点的轴自由衰减。停靠点可以是未排序的，必须是有限的，并且每个列表必须至少包含一个位置。平局使用列出的第一个停靠站。位置是 DIPs 中的绝对平移，而不是相对于起始位置的偏移。

## 中断和停止 {#interrupting-and-stopping}

```ts
const motion = decay(card, { x: 600 })
motion.stop() // leave the card where it is

stop(card, ['x']) // also stops a decay on this axis

await sequence([
  () => decay(card, { x: 600 }, { snap: [0, 320] }),
  () => animate(card, { opacity: 0 }),
])
```

`decay()` 返回与 `animate()` 相同的 `Animation` 句柄：`await` 或读取 `finished`。完成时解析为 `true`，停止或替换时解析为 `false`。与其他弹簧一样，折断的弹簧在视觉到达时可以推进序列。

`decay()`和`animate()`共有财产所有权。每个人都从对方的当前位置开始；由 `animate()` 启动的弹簧继承了衰变的当前速度。新的 `decay()` 使用传递给它的速度。加载之前进行的调用等待视图并读取其位置；在加载之前停止会取消播放。

速度必须是有限的。在接管动画之前，投影溢出或持续时间超出平台计时器范围的输入将被拒绝。非常长的自由衰减将其原生关键帧计数限制为 6,001。

这提供了释放后的动作。手势跟踪、边界和碰撞处理是分开的。
