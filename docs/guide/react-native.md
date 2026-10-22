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

| React Native                          | Jolt                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------ |
| `Animated.sequence([...])`            | [`sequence([...])`](./sequences)                                         |
| `Animated.parallel([...])`            | one `animate()` with several properties, or steps with `at: '<'`         |
| `Animated.stagger(60, [...])`         | `animate(views, ..., { stagger: 60 })`                                   |
| `Animated.delay(200)`                 | `delay: 200`, or a step `at: '+200'`                                     |
| `Animated.loop(anim)`                 | `repeat: Infinity`                                                       |
| `Animated.loop(anim, { iterations })` | `repeat: iterations - 1`                                                 |
| `loop(sequence([delay(d), anim]))`    | `repeat: Infinity, repeatDelay: d`                                       |
| `.start(({ finished }) => ...)`       | `await animate(...)` resolves with `finished`                            |
| `value.stopAnimation()`               | `stop(view, ['x'])`                                                      |
| `value.setValue(v)`                   | [`set(view, { x: v })`](./interrupting#setting-values-without-animating) |

## interpolate

A value that runs from 0 to 1 and drives a property through `interpolate` is a keyframe track. The input range becomes `times`, the output range becomes the keyframes, and the easing of the driving animation applies to the whole track with `easeTrack: true`:

```ts
// React Native
const y = progress.interpolate({
  inputRange: [0, 0.4, 0.7, 1],
  outputRange: [0, -30, -12, 0],
})
Animated.timing(progress, { toValue: 1, duration: 900, easing: Easing.out(Easing.ease) })

// Jolt
animate(
  spark,
  { y: [0, -30, -12, 0] },
  { duration: 900, ease: 'easeOut', easeTrack: true, times: [0, 0.4, 0.7, 1] },
)
```

One value driving several properties becomes one `animate()` with each property's keyframes on the same `times`. See [track easing](./transitions#tweens). A value driven by a scroll offset is [`scrollLinked()`](./scroll-linked), and one driven by a gesture is [`drag()`](./drag). Live values shared by several views without a timeline are not available yet.

## Adding and multiplying values

`Animated.add` and `Animated.multiply` combine two animations on one property. In Jolt each property has one owner at a time, so nest views instead: the outer view takes one animation, the inner view the other. A scale on the parent and a scale on the child multiply; translations add.

## Platform APIs

| React Native                                    | Jolt                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------- |
| `useNativeDriver: true`                         | always: every animation plays natively                                          |
| `LayoutAnimation`                               | [`animateLayout()`](./layout)                                                   |
| `Keyboard` events and `keyboardWillShow` timing | [`onKeyboard()`](./keyboard#keyboard-state) and `followKeyboard()`              |
| `AccessibilityInfo.isReduceMotionEnabled()`     | [`reducedMotion()` and `onReducedMotion()`](./configure#reading-the-preference) |
| `Animated.event` on `onScroll`                  | [`scrollLinked()`](./scroll-linked)                                             |
| a value that outlives a remounted view          | [motion states with `attach()`](./motion-controllers#views-that-come-back)      |
