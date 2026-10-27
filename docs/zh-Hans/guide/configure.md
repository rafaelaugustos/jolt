# 时间缩放与减少动态效果 {#time-scale-and-reduced-motion}

`configure()` 更改全局设置。每一项都适用于调用后开始的动画；已经播放的内容保持其定时。在任何更改之前抛出无效值。

<Clip name="tuning" caption="操场上以五分之一的速度。" />

```ts
import { configure } from '@rafaelaugusto/jolt'

configure({ timeScale: 0.2 }) // everything five times slower
configure({ reducedMotion: 'always' }) // transforms jump, opacity still fades
```

## 时间尺度 {#time-scale}

全速调整弹簧是猜测。相反，放慢一切：

```ts
configure({ timeScale: 0.2 })
configure({ timeScale: 1 }) // back to normal
```

时间尺度必须是正有限数。它延伸了每个引擎动画的整个时间线：持续时间、延迟、交错、重复、弹簧稳定时间、衰减和序列位置。 `animate()`、`decay()`、`sequence()`、`press()`、`scrollLinked()` 和 `animateText()` 在 iOS 和 Android 上都遵循它，因为 Jolt 计算曲线JavaScript 并将其持续时间交给平台。

```ts
configure({ timeScale: 0.5 })
const animation = animate(card, { x: 100 }, { duration: 300, delay: 100 })
animation.duration // 800: the delay and the motion both doubled
```

轨迹保持不变，只是速度较慢。关键帧在播放时每秒采样一次，因此减慢的弹簧可以使其细节保持在超调附近。中断减慢动画的动画仍以屏幕上的速度从屏幕上的值开始。 `progress`从0到1一直运行； `duration` 报告延长的毫秒数。

滚动链接动画从滚动偏移设置进度，因此它们的外观不会改变。触觉点是时间线的一部分并随之移动。

原生循环保留自己的计时：[微光](./shimmer)、[装载机](./loaders)、[液体图像](./liquid)、[颗粒](./particles)、[SF Symbol 效果](./symbol-effects) 和 [通告揭示](./reveal)。 Jolt 之外的平台动画也未受影响。

iOS 模拟器的慢速动画设置只会减慢 Core Animation 的速度，而 Android 没有针对每个应用程序的等效设置。两个平台上的时间尺度相同并且适用于设备，这使得它对于比较它们非常有用。

## 减少运动 {#reduced-motion}

iOS 具有减少运动，Android 具有删除动画。 Jolt 默认遵循它们：

```ts
configure({ reducedMotion: 'user' }) // the default: follow the platform setting
configure({ reducedMotion: 'always' }) // reduce regardless, to check the result
configure({ reducedMotion: 'never' }) // play everything
```

通过减少运动、平移、缩放、旋转，[运动路径](./paths)、[角、边框和阴影](./decorations) 和 [衰变](./decay) 跳转到其最终值而不是动画。不透明度和 [颜色](./colors) 仍然以 Framer Motion 处理它的方式进行动画处理，因此内容会不断淡入和淡出。 API 没有任何变化：`finished` 解析为 `true`，序列立即进入下一步，`press()` 捕捉，交错的组着陆在一起。

```ts
await animate(card, 'fadeInUp') // the card is in place, the fade still plays
```

无限重复，注意力预设保持静止而不是循环。每个动画开始时都会读取首选项，因此更改会从下一个动画开始应用。自行检查平台的效果遵循相同的偏好，包括`always`和`never`：[文本](./text)、[微光](./shimmer)、[装载机](./loaders)、[液体图像](./liquid)、[颗粒](./particles)、[SF Symbol 效果](./symbol-effects)和[通告揭示](./reveal)。

在 iOS 上，设置来自 `UIAccessibilityIsReduceMotionEnabled()`。在 Android 上，删除动画将动画师持续时间比例设置为零，Jolt 在 Android 8 及更高版本上通过 `ValueAnimator.areAnimatorsEnabled()` 以及之前的全局设置读取该值。

## 读取首选项 {#reading-the-preference}

屏幕的功能不仅仅是跳过动作：显示静态插图，或完全删除飞溅。阅读 Jolt 使用的相同首选项：

```ts
import { onReducedMotion, reducedMotion } from '@rafaelaugusto/jolt'

reducedMotion() // true or false, right now
const off = onReducedMotion((reduced) => {
  // called with the new value when it changes
})
off()
```

`reducedMotion()` 报告 Jolt 适用的内容：`user` 的平台设置、`true` 的 `always`、`false` 的 `never`。 `onReducedMotion()` 仅当该值发生变化时从 `configure()` 或平台回调。在 iOS 上，通过减少运动的通知（包括来自控制中心的切换），更改会立即到达。一般Android观察者在app返回前台时再次检查。 [颗粒](./particles#platforms-and-timing) 还可以原生观察动画师比例：将其更改为零会立即取消主动效果，包括当 Jolt 的首选项为 `never` 时。

在 Vue 中，[`useReducedMotion()`](./vue#reduced-motion) 提供了一个在组件卸载之前保持最新的引用。

如需播放所有动画并自行决定如何适配，请选择 `never`，然后在应用中读取平台设置。
