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

| React Native                          | Jolt                                                               |
| ------------------------------------- | ------------------------------------------------------------------ |
| `Animated.sequence([...])`            | [`sequence([...])`](./sequences)                                   |
| `Animated.parallel([...])`            | um `animate()` com várias propriedades, ou passos com `at: '<'`    |
| `Animated.stagger(60, [...])`         | `animate(views, ..., { stagger: 60 })`                             |
| `Animated.delay(200)`                 | `delay: 200`, ou um passo com `at: '+200'`                         |
| `Animated.loop(anim)`                 | `repeat: Infinity`                                                 |
| `Animated.loop(anim, { iterations })` | `repeat: iterations - 1`                                           |
| `loop(sequence([delay(d), anim]))`    | `repeat: Infinity, repeatDelay: d`                                 |
| `.start(({ finished }) => ...)`       | `await animate(...)` resolve com `finished`                        |
| `value.stopAnimation()`               | `stop(view, ['x'])`                                                |
| `value.setValue(v)`                   | [`set(view, { x: v })`](./interrupting#aplicar-valores-sem-animar) |

## interpolate

Um valor que vai de 0 a 1 e controla uma propriedade pelo `interpolate` é um track de keyframes. O `inputRange` vira `times`, o `outputRange` vira os keyframes, e o easing da animação que move o valor vale para o track inteiro com `easeTrack: true`:

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

Um valor que controla várias propriedades vira um `animate()` com os keyframes de cada propriedade nos mesmos `times`. Veja [easing do track](./transitions#tweens). Um valor controlado pela rolagem é o [`scrollLinked()`](./scroll-linked), e um controlado por gesto é o [`drag()`](./drag). Valores ao vivo compartilhados por várias views, sem uma linha do tempo, ainda não existem.

## Somar e multiplicar valores

`Animated.add` e `Animated.multiply` combinam duas animações numa propriedade. No Jolt cada propriedade tem um dono por vez, então aninhe views: a view de fora recebe uma animação e a de dentro, a outra. Uma escala no pai e uma no filho se multiplicam; translações se somam.

## APIs da plataforma

| React Native                                           | Jolt                                                                       |
| ------------------------------------------------------ | -------------------------------------------------------------------------- |
| `useNativeDriver: true`                                | sempre: toda animação toca nativamente                                     |
| `LayoutAnimation`                                      | [`animateLayout()`](./layout)                                              |
| eventos de `Keyboard` e o timing do `keyboardWillShow` | [`onKeyboard()`](./keyboard#estado-do-teclado) e `followKeyboard()`        |
| `AccessibilityInfo.isReduceMotionEnabled()`            | [`reducedMotion()` e `onReducedMotion()`](./configure#lendo-a-preferencia) |
| `Animated.event` no `onScroll`                         | [`scrollLinked()`](./scroll-linked)                                        |
| um valor que sobrevive à view remontada                | [estados com `attach()`](./motion-controllers#views-que-voltam)            |
