# 从 React Native Animated 迁移 {#from-react-native-animated}

大多数 `Animated` 代码在 Jolt 中都有直接对应的代码。主要区别在于 Jolt 没有 `Animated.Value`：您对视图的属性进行动画处理，而 Jolt 计算一次曲线并以原生方式播放它，就像 `useNativeDriver: true` 对每个动画的处理方式一样。

## 时序 {#timing}

```ts
// React Native
Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }).start()

// Jolt
animate(card, { opacity: 1 }, { duration: 500, ease: 'easeInOut' })
```

`Animated.timing` 默认为 500 ms，`Easing.inOut(Easing.ease)` 与 Jolt 的 `easeInOut` 非常接近。 Jolt 补间默认为 300 毫秒，而 `easeOut` 则默认为 300 毫秒，因此当端口看起来相同时，请同时传递两者。 `Easing.bezier(x1, y1, x2, y2)` 变为 `cubicBezier(x1, y1, x2, y2)` 或数组 `[x1, y1, x2, y2]`，并且任何缓动函数仍然有效。 `Easing.quad`、`Easing.cubic`、`Easing.poly(4)`、`Easing.poly(5)`、`Easing.sin` 和 `Easing.exp` 是 `quad`、`cubic`、`quart`、`quint`、 `sine` 和 `expo` 曲线：它们自己缓和 (`'cubicIn'`)，`Easing.out(Easing.cubic)` 是 `'cubicOut'`，`Easing.inOut(Easing.cubic)` 是 `'cubicInOut'`。

## 弹簧 {#springs}

`stiffness`、`damping` 和 `mass` 结转不变。对于 `friction` 和 `tension`，`origamiSpring()` 应用 `Animated.spring` 使用的相同折纸转换，具有相同的默认值 7 和 40：

```ts
// React Native
Animated.spring(x, {
  toValue: 100,
  friction: 3,
  tension: 40,
  useNativeDriver: true,
}).start()

// Jolt
animate(card, { x: 100 }, origamiSpring({ friction: 3, tension: 40 }))
```

`bounciness`和`speed`没有转换器；用 Jolt 的 `bounce` 和 `duration` 来描述这些弹簧。

<Clip name="react-native-ios" caption="使用 origamiSpring() 转换的三个 Animated.spring 配置，在 iOS 模拟器上进行抛出和中断。实时播放。" />

## 组成 {#composition}

| 反应原生                              | Jolt                                                                                         |
| ------------------------------------- | -------------------------------------------------------------------------------------------- |
| `Animated.sequence([...])`            | [`sequence([...])`](./sequences)                                                             |
| `Animated.parallel([...])`            | 具有多个属性的一个 `animate()`，或具有 `at: '<'` 的步骤                                      |
| `Animated.stagger(60, [...])`         | `animate(views, ..., { stagger: 60 })`                                                       |
| `Animated.delay(200)`                 | `delay: 200`，或步骤 `at: '+200'`                                                            |
| `Animated.loop(anim)`                 | `repeat: Infinity`                                                                           |
| `Animated.loop(anim, { iterations })` | `repeat: iterations - 1`                                                                     |
| `loop(sequence([delay(d), anim]))`    | `repeat: Infinity, repeatDelay: d`                                                           |
| `.start(({ finished }) => ...)`       | `await animate(...)` 解析为 `finished`                                                       |
| `value.stopAnimation()`               | `stop(view, ['x'])`                                                                          |
| `value.setValue(v)`                   | `set(value, v)`，或 [`set(view, { x: v })`](./interrupting#setting-values-without-animating) |

## 动画.值和插值 {#animated-value-and-interpolate}

`Animated.Value`是[动画值](./motion-values)，并且`interpolate`是`to()`。绑定映射值取代了在 `style` 中传递它们：

```ts
// React Native
const progress = useRef(new Animated.Value(0)).current
const style = {
  opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }),
  transform: [
    { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [200, 0] }) },
  ],
}
Animated.spring(progress, { toValue: 1, useNativeDriver: true }).start()

// Jolt
const progress = motionValue(0)
bind(backdrop, { opacity: progress.to([0, 1], [0, 0.45]) })
bind(sheet, { y: progress.to([0, 1], [200, 0]) })
animate(progress, 1, origamiSpring())
```

`to()` 默认夹紧，而 `interpolate` 延伸；将 `{ clamp: false }` 转换为 `extrapolate: 'extend'`。仅沿时间轴驱动一个视图的值也可以是普通关键帧：输入范围变为 `times`，输出范围变为关键帧，`easeTrack: true` 在整个轨道上运行驱动动画的缓动。参见 [轨道缓和](./transitions#tweens)。由滚动偏移驱动的值是 [`scrollLinked()`](./scroll-linked)，由平移手势驱动的值是 [`drag()` 与 `value`](./motion-values#dragging)。

## 值相加和相乘 {#adding-and-multiplying-values}

`Animated.add` 和 `Animated.multiply` 在一个属性上组合了两个动画。在 Jolt 中，在 [层](./layers) 上播放第二个：平移和旋转相加，缩放和不透明度相乘。

```ts
animate(logo, { scale: [1, 1.04, 1] }, { duration: 1200, repeat: Infinity }) // the base
animate(logo, { scale: [1, 1.15, 1] }, { duration: 300, layer: 'kick' }) // multiplied on top
```

## 平台 API {#platform-apis}

| 反应原生                                    | Jolt                                                                                                 |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `useNativeDriver: true`                     | 始终：每个动画都以原生方式播放                                                                       |
| `LayoutAnimation`                           | [`animateLayout()`](./layout)                                                                        |
| `Keyboard` 事件和 `keyboardWillShow` 时序   | [`onKeyboard()`](./keyboard#keyboard-state) 和 `followKeyboard()`                                    |
| `AccessibilityInfo.isReduceMotionEnabled()` | [`reducedMotion()` and `onReducedMotion()`](./configure#reading-the-preference)                      |
| `Animated.event` 上 `onScroll`              | [`scrollValue()`](./motion-values#scroll-offsets) 与 `bind()` 或 [`scrollLinked()`](./scroll-linked) |
| `PanResponder` 写入 `Animated.Value`        | [`drag()` 与 `value`](./motion-values#dragging)，包含版本                                            |
| 比重新安装的视图寿命更长的值                | [`attach()` 的运动状态](./motion-controllers#views-that-come-back)                                   |
