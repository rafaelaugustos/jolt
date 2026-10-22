# From React Native Animated

Most `Animated` code has a direct counterpart in Jolt. The main difference is that Jolt has no `Animated.Value`: you animate a view's properties, and Jolt computes the curve once and plays it natively, the way `useNativeDriver: true` would for every animation.

## Timing

```ts
// React Native
Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }).start()

// Jolt
animate(card, { opacity: 1 }, { duration: 500, ease: 'easeInOut' })
```

`Animated.timing` defaults to 500 ms and `Easing.inOut(Easing.ease)`, which is very close to Jolt's `easeInOut`. Jolt tweens default to 300 ms and `easeOut`, so pass both when a port should look the same. `Easing.bezier(x1, y1, x2, y2)` becomes `cubicBezier(x1, y1, x2, y2)` or the array `[x1, y1, x2, y2]`, and any easing function still works.

## Springs

`stiffness`, `damping` and `mass` carry over unchanged. For `friction` and `tension`, `origamiSpring()` applies the same Origami conversion `Animated.spring` uses, with the same defaults of 7 and 40:

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

`bounciness` and `speed` have no converter; describe those springs with Jolt's `bounce` and `duration` instead.

<Clip name="react-native-ios" caption="Three Animated.spring configurations converted with origamiSpring(), tossed and interrupted on the iOS simulator. Real-time playback." />

## Composition

| React Native                          | Jolt                                                                                         |
| ------------------------------------- | -------------------------------------------------------------------------------------------- |
| `Animated.sequence([...])`            | [`sequence([...])`](./sequences)                                                             |
| `Animated.parallel([...])`            | one `animate()` with several properties, or steps with `at: '<'`                             |
| `Animated.stagger(60, [...])`         | `animate(views, ..., { stagger: 60 })`                                                       |
| `Animated.delay(200)`                 | `delay: 200`, or a step `at: '+200'`                                                         |
| `Animated.loop(anim)`                 | `repeat: Infinity`                                                                           |
| `Animated.loop(anim, { iterations })` | `repeat: iterations - 1`                                                                     |
| `loop(sequence([delay(d), anim]))`    | `repeat: Infinity, repeatDelay: d`                                                           |
| `.start(({ finished }) => ...)`       | `await animate(...)` resolves with `finished`                                                |
| `value.stopAnimation()`               | `stop(view, ['x'])`                                                                          |
| `value.setValue(v)`                   | `set(value, v)`, or [`set(view, { x: v })`](./interrupting#setting-values-without-animating) |

## Animated.Value and interpolate

`Animated.Value` is a [motion value](./motion-values), and `interpolate` is `to()`. Binding the mapped values replaces passing them in `style`:

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

`to()` clamps by default, while `interpolate` extends; pass `{ clamp: false }` for `extrapolate: 'extend'`. A value that only drives one view along a timeline can also be plain keyframes: the input range becomes `times`, the output range the keyframes, and `easeTrack: true` runs the driving animation's easing over the whole track. See [track easing](./transitions#tweens). A value driven by a scroll offset is [`scrollLinked()`](./scroll-linked), and one driven by a gesture is [`drag()`](./drag).

## Adding and multiplying values

`Animated.add` and `Animated.multiply` combine two animations on one property. In Jolt, play the second one on a [layer](./layers): translations and rotations add, scale and opacity multiply.

```ts
animate(logo, { scale: [1, 1.04, 1] }, { duration: 1200, repeat: Infinity }) // the base
animate(logo, { scale: [1, 1.15, 1] }, { duration: 300, layer: 'kick' }) // multiplied on top
```

## Platform APIs

| React Native                                    | Jolt                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------- |
| `useNativeDriver: true`                         | always: every animation plays natively                                          |
| `LayoutAnimation`                               | [`animateLayout()`](./layout)                                                   |
| `Keyboard` events and `keyboardWillShow` timing | [`onKeyboard()`](./keyboard#keyboard-state) and `followKeyboard()`              |
| `AccessibilityInfo.isReduceMotionEnabled()`     | [`reducedMotion()` and `onReducedMotion()`](./configure#reading-the-preference) |
| `Animated.event` on `onScroll`                  | [`scrollLinked()`](./scroll-linked)                                             |
| a value that outlives a remounted view          | [motion states with `attach()`](./motion-controllers#views-that-come-back)      |
