# 中断与停止 {#interrupting-and-stopping}

在已经动画的属性上启动动画会接管它：新动画从屏幕上的值开始，以相同的速度，因此卡片可以中途改变主意而无需跳转。先前动画的其他属性继续保留。

<Clip name="interrupting-ios" caption="重复轻击会使飞行中的弹簧反转。真实的 iOS 模拟器以五分之一的速度播放，使切换可见。" />

`animate()` 返回一个动画，您可以 `await`。当播放到最后时，它解析为 `true`；当它停止或接管时，它解析为 `false`。它从不拒绝。

```ts
const animation = animate(card, { x: 300 })
animation.stop() // the card stays where it is

stop(card) // stops everything running on the card
stop(card, ['x', 'scale']) // stops translation on x and both scale axes
```

所选属性保持当前值；其他人继续动画。 `scaleX`和`scaleY`也可以单独停止。传递一个空数组以停止任何操作，或者省略它以停止所有操作。这也适用于目标数组。

如果动画的一部分停止，则在其剩余属性完成后，其 `finished` 承诺将解析为 `false`。

## 设置值而不设置动画 {#setting-values-without-animating}

`set()` 放置一个视图而不对其进行动画处理，以实现减少运动的布局、循环之前的重置或应该简单存在的状态：

```ts
set(logo, { opacity: 1, scale: 1, y: 0 })
set(card, { backgroundColor: '#fff' })
```

每个属性取一个值，与 `animate()` 具有相同的属性，包括颜色和装饰。无论激活这些属性的是什么，都会停止，其 `finished` 会解析为 `false`；其他属性保持动画状态。接下来的`animate()`从设定值开始，没有速度。尚未加载的视图会立即获取值，并且它们会赢得仍在等待该视图加载的动画。

## 循环和背景 {#loops-and-the-background}

无限重复继续原生播放。在iOS上，当应用程序进入后台时，Core Animation会丢弃动画； Jolt 回来后再次启动它们。

要保持动画并选择其帧，请参阅 [暂停、播放和擦洗](./playback)。
