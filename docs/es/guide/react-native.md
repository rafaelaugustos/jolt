# Desde Animated de React Native {#from-react-native-animated}

La mayoría del código `Animated` tiene una contraparte directa en Jolt. La principal diferencia es que Jolt no tiene `Animated.Value`: usted anima las propiedades de una vista y Jolt calcula la curva una vez y la reproduce de forma nativa, como lo haría `useNativeDriver: true` para cada animación.

## Sincronización {#timing}

```ts
// React Native
Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }).start()

// Jolt
animate(card, { opacity: 1 }, { duration: 500, ease: 'easeInOut' })
```

`Animated.timing` tiene un valor predeterminado de 500 ms y `Easing.inOut(Easing.ease)`, que está muy cerca del `easeInOut` de Jolt. Las interpolaciones Jolt están predeterminadas en 300 ms y `easeOut`, así que pase ambos cuando un puerto deba tener el mismo aspecto. `Easing.bezier(x1, y1, x2, y2)` se convierte en `cubicBezier(x1, y1, x2, y2)` o en la matriz `[x1, y1, x2, y2]`, y cualquier función de aceleración sigue funcionando. `Easing.quad`, `Easing.cubic`, `Easing.poly(4)`, `Easing.poly(5)`, `Easing.sin` y `Easing.exp` son `quad`, `cubic`, `quart`, `quint`, `sine` y Curvas `expo`: por sí solas se suavizan (`'cubicIn'`), `Easing.out(Easing.cubic)` es `'cubicOut'` y `Easing.inOut(Easing.cubic)` es `'cubicInOut'`.

## Resortes {#springs}

`stiffness`, `damping` y `mass` se trasladan sin cambios. Para `friction` y `tension`, `origamiSpring()` aplica la misma conversión de Origami que utiliza `Animated.spring`, con los mismos valores predeterminados de 7 y 40:

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

`bounciness` y `speed` no tienen convertidor; describa esos resortes con `bounce` y `duration` de Jolt en su lugar.

<Clip name="react-native-ios" caption="Tres configuraciones de Animated.spring convertidas con origamiSpring(), lanzadas e interrumpidas en el simulador iOS. Reproducción en tiempo real." />

## Composición {#composition}

| Reaccionar nativo                     | Jolt                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------ |
| `Animated.sequence([...])`            | [`sequence([...])`](./sequences)                                                           |
| `Animated.parallel([...])`            | un `animate()` con varias propiedades, o pasos con `at: '<'`                               |
| `Animated.stagger(60, [...])`         | `animate(views, ..., { stagger: 60 })`                                                     |
| `Animated.delay(200)`                 | `delay: 200`, o un paso `at: '+200'`                                                       |
| `Animated.loop(anim)`                 | `repeat: Infinity`                                                                         |
| `Animated.loop(anim, { iterations })` | `repeat: iterations - 1`                                                                   |
| `loop(sequence([delay(d), anim]))`    | `repeat: Infinity, repeatDelay: d`                                                         |
| `.start(({ finished }) => ...)`       | `await animate(...)` se resuelve con `finished`                                            |
| `value.stopAnimation()`               | `stop(view, ['x'])`                                                                        |
| `value.setValue(v)`                   | `set(value, v)` o [`set(view, { x: v })`](./interrupting#setting-values-without-animating) |

## Valor animado e interpolación {#animated-value-and-interpolate}

`Animated.Value` es un [valor de movimiento](./motion-values) y `interpolate` es un `to()`. Vincular los valores asignados reemplaza pasarlos en `style`:

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

`to()` se sujeta por defecto, mientras que `interpolate` se extiende; pase `{ clamp: false }` por `extrapolate: 'extend'`. Un valor que solo dirige una vista a lo largo de una línea de tiempo también puede ser fotogramas clave simples: el rango de entrada se convierte en `times`, el rango de salida en fotogramas clave y `easeTrack: true` ejecuta la animación de conducción suavizada en toda la pista. Ver [suavización de pistas](./transitions#tweens). Un valor impulsado por un desplazamiento de desplazamiento es [`scrollLinked()`](./scroll-linked) y uno impulsado por un gesto de desplazamiento es [`drag()` con `value`](./motion-values#dragging).

## Sumar y multiplicar valores {#adding-and-multiplying-values}

`Animated.add` y `Animated.multiply` combinan dos animaciones en una propiedad. En Jolt, reproduce el segundo en un [capa](./layers): las traslaciones y rotaciones suman, la escala y la opacidad se multiplican.

```ts
animate(logo, { scale: [1, 1.04, 1] }, { duration: 1200, repeat: Infinity }) // the base
animate(logo, { scale: [1, 1.15, 1] }, { duration: 300, layer: 'kick' }) // multiplied on top
```

## API de plataforma {#platform-apis}

| Reaccionar nativo                                     | Jolt                                                                                                  |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `useNativeDriver: true`                               | siempre: cada animación se reproduce de forma nativa                                                  |
| `LayoutAnimation`                                     | [`animateLayout()`](./layout)                                                                         |
| Eventos `Keyboard` y temporización `keyboardWillShow` | [`onKeyboard()`](./keyboard#keyboard-state) y `followKeyboard()`                                      |
| `AccessibilityInfo.isReduceMotionEnabled()`           | [`reducedMotion()` and `onReducedMotion()`](./configure#reading-the-preference)                       |
| `Animated.event` en `onScroll`                        | [`scrollValue()`](./motion-values#scroll-offsets) con `bind()`, o [`scrollLinked()`](./scroll-linked) |
| `PanResponder` escribiendo en un `Animated.Value`     | [`drag()` con `value`](./motion-values#dragging), lanzamiento incluido                                |
| un valor que sobrevive a una vista remontada          | [estados de movimiento con `attach()`](./motion-controllers#views-that-come-back)                     |
