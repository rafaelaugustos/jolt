# Vindo do Animated do React Native

Quase todo código de `Animated` tem um equivalente direto no Jolt. A principal diferença é que o Jolt não tem `Animated.Value`: você anima as propriedades da view, e o Jolt calcula a curva uma vez e a toca nativamente, como o `useNativeDriver: true` faria em toda animação.

## Timing

```ts
// React Native
Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }).start()

// Jolt
animate(card, { opacity: 1 }, { duration: 500, ease: 'easeInOut' })
```

O `Animated.timing` usa 500 ms e `Easing.inOut(Easing.ease)` por padrão, que fica muito próximo do `easeInOut` do Jolt. Os tweens do Jolt usam 300 ms e `easeOut`, então passe os dois quando o port precisar ficar igual. `Easing.bezier(x1, y1, x2, y2)` vira `cubicBezier(x1, y1, x2, y2)` ou o array `[x1, y1, x2, y2]`, e qualquer função de easing continua funcionando.

## Molas

`stiffness`, `damping` e `mass` passam sem mudança. Para `friction` e `tension`, o `origamiSpring()` aplica a mesma conversão Origami que o `Animated.spring` usa, com os mesmos padrões 7 e 40:

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

`bounciness` e `speed` não têm conversor; descreva essas molas com `bounce` e `duration` do Jolt.

<Clip name="react-native-ios" caption="Três configurações de Animated.spring convertidas com origamiSpring(), lançadas e interrompidas no simulador iOS. Velocidade real." />

## Composição

| React Native                          | Jolt                                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| `Animated.sequence([...])`            | [`sequence([...])`](./sequences)                                                       |
| `Animated.parallel([...])`            | um `animate()` com várias propriedades, ou passos com `at: '<'`                        |
| `Animated.stagger(60, [...])`         | `animate(views, ..., { stagger: 60 })`                                                 |
| `Animated.delay(200)`                 | `delay: 200`, ou um passo com `at: '+200'`                                             |
| `Animated.loop(anim)`                 | `repeat: Infinity`                                                                     |
| `Animated.loop(anim, { iterations })` | `repeat: iterations - 1`                                                               |
| `loop(sequence([delay(d), anim]))`    | `repeat: Infinity, repeatDelay: d`                                                     |
| `.start(({ finished }) => ...)`       | `await animate(...)` resolve com `finished`                                            |
| `value.stopAnimation()`               | `stop(view, ['x'])`                                                                    |
| `value.setValue(v)`                   | `set(value, v)`, ou [`set(view, { x: v })`](./interrupting#aplicar-valores-sem-animar) |

## Animated.Value e interpolate

`Animated.Value` é um [valor de movimento](./motion-values), e `interpolate` é o `to()`. Ligar os valores mapeados substitui passá-los no `style`:

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

O `to()` segura as pontas por padrão, enquanto o `interpolate` estende; passe `{ clamp: false }` para o `extrapolate: 'extend'`. Um valor que só controla uma view ao longo de uma linha do tempo também pode ser keyframes simples: o `inputRange` vira `times`, o `outputRange` vira os keyframes, e `easeTrack: true` aplica o easing da animação ao track inteiro. Veja [easing do track](./transitions#tweens). Um valor controlado pela rolagem é o [`scrollLinked()`](./scroll-linked), e um controlado por gesto é o [`drag()`](./drag).

## Somar e multiplicar valores

`Animated.add` e `Animated.multiply` combinam duas animações numa propriedade. No Jolt, toque a segunda numa [camada](./layers): translações e rotações se somam, escala e opacidade se multiplicam.

```ts
animate(logo, { scale: [1, 1.04, 1] }, { duration: 1200, repeat: Infinity }) // a base
animate(logo, { scale: [1, 1.15, 1] }, { duration: 300, layer: 'kick' }) // multiplicada por cima
```

## APIs da plataforma

| React Native                                           | Jolt                                                                                                       |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `useNativeDriver: true`                                | sempre: toda animação toca nativamente                                                                     |
| `LayoutAnimation`                                      | [`animateLayout()`](./layout)                                                                              |
| eventos de `Keyboard` e o timing do `keyboardWillShow` | [`onKeyboard()`](./keyboard#estado-do-teclado) e `followKeyboard()`                                        |
| `AccessibilityInfo.isReduceMotionEnabled()`            | [`reducedMotion()` e `onReducedMotion()`](./configure#lendo-a-preferencia)                                 |
| `Animated.event` no `onScroll`                         | [`scrollValue()`](./motion-values#offsets-de-rolagem) com `bind()`, ou [`scrollLinked()`](./scroll-linked) |
| um valor que sobrevive à view remontada                | [estados com `attach()`](./motion-controllers#views-que-voltam)                                            |
