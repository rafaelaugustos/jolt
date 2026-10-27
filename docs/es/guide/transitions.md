# Resortes e interpolaciones {#springs-and-tweens}

El tercer argumento de `animate()` dice cómo llegar. Sin uno, la transformación se mueve con un resorte y `opacity` se relaja más de 300 ms. Interpolación de fotogramas clave.

<Clip name="springs" caption="Los tres resortes nombrados sobre una bola interrumpible." />

## Resortes {#springs}

```ts
animate(card, { scale: 1.2 }, 'bouncy')
animate(card, { y: 0 }, { bounce: 0.3, duration: 600 })
animate(card, { y: 0 }, { stiffness: 300, damping: 20, mass: 1 })
```

| Primavera | Sentir                                               |
| --------- | ---------------------------------------------------- |
| `smooth`  | sin sobrepaso                                        |
| `snappy`  | rápido, apenas se sobrepasa. El valor predeterminado |
| `bouncy`  | se sobrepasa y se asienta con un rebote              |

`bounce` va de -1 a 1: 0 se estabiliza sin sobrepasarse, los valores más altos rebotan más, los valores negativos se estabilizan más lentamente. `duration` es lo largo que se siente el resorte, el mismo modelo que SwiftUI. O descríbalo con `stiffness`, `damping` y `mass`. Un resorte comienza con la velocidad de la animación que interrumpe, a menos que pases `velocity` (unidades por segundo).

## Preadolescentes {#tweens}

```ts
animate(card, { opacity: 0 }, { duration: 200, ease: 'easeIn' })
animate(
  card,
  { x: [0, 100, 50] },
  { duration: 600, ease: ['easeOut', 'easeIn'], times: [0, 0.3, 1] },
)
```

**Una interpolación tarda 300 ms con `easeOut` a menos que se indique lo contrario.** Es más corto que el `Animated.timing` de React Native (500 ms, entrada y salida fácil) y comienza más rápido que el `ease` de CSS, así que pase ambos cuando un puerto tenga que coincidir.

`ease` toma `linear`, `ease`, `easeIn`, `easeOut`, `easeInOut`, `circIn`, `circOut`, `circInOut`, `backIn`, `backOut`, `backInOut`, `anticipate`, las curvas `quad`, `cubic`, `quart`, `quint`, `sine` y `expo` con `In`, `Out` o `InOut` (`'cubicOut'`), un bézier cúbico (`[0.2, 0, 0, 1]`) o cualquier función desde 0..1 hasta un valor. Con fotogramas clave, pase uno por segmento. `times` coloca cada fotograma clave entre 0 y 1.

<Clip name="easing-curves-ios" caption="Seis curvas con nombre de más de 900 ms y un logotipo cuya opacidad establece solo tiempos y mantiene la duración principal y la relajación, en el simulador iOS. Reproducción en tiempo real." />

Con `easeTrack: true`, un `ease` recorre toda la pista y el valor se mueve en líneas rectas entre fotogramas clave, de la misma manera que el `interpolate` de React Native coloca su rango de salida en un valor facilitado:

```ts
animate(
  spark,
  { y: [0, -30, -12, 0] },
  { duration: 900, ease: 'easeOut', easeTrack: true, times: [0, 0.4, 0.7, 1] },
)
```

<Clip name="ease-track-ios" caption="En el simulador iOS, los mismos fotogramas clave y tiempos con easeOut en cada segmento (izquierda) y en toda la pista (derecha). Reproducción en tiempo real." />

Una flexibilización que se excede, como `backOut`, extiende el primer o último segmento, como lo hace `interpolate` con `extrapolate: 'extend'`. `easeTrack` toma un único `ease` y se aplica únicamente a interpolaciones.

Las funciones de aceleración personalizadas se ejecutan una vez, cuando comienza la animación, como lo hacen los resortes. No cuestan nada por cuadro.

## Fotogramas clave adaptables {#adaptive-keyframes}

Las curvas numéricas concentran fotogramas clave nativos donde se doblan, en lugar de utilizar 60 muestras fijas por segundo en todas partes. Una pausa lenta de cuatro segundos puede utilizar 41 puntos en lugar de 241; un resorte rápido de 300 DIP necesita más detalles, lo que reduce su error de interpolación medido de aproximadamente 6,79 a 0,24 DIP. Estas son comparaciones numéricas, no afirmaciones sobre la velocidad de fotogramas. La velocidad de origen, la duración de la estabilización y la llegada utilizada por las secuencias permanecen sin cambios.

<Clip name="curve-sampling-ios" caption="Simulador iOS, toques XCTest reales: conjuntos de puntos adaptativos y de tasa fija se reproducen a través del controlador nativo. La comparación con el resorte rápido es deliberadamente cuatro veces más lenta; el planeo largo se desarrolla a la velocidad original. Los números muestran el error de la curva muestreada en DIP, pantalla no medida FPS." />

<Clip name="curve-sampling-android" caption="Emulador Android, toques ADB reales: la misma comparación nativa, con el resorte rápido a un cuarto de velocidad y el deslizamiento largo a la velocidad original. Los recuentos de puntos y los errores numéricos describen las curvas preparadas. No hay medición de la frecuencia de actualización del dispositivo físico." />

La traslación utiliza un presupuesto de error **0,25 DIP**; la escala utiliza **0.001**, opacidad/opacidad de sombra **0.002**, rotación **0.1°** y otras decoraciones numéricas **0.1 DIP**. Multiplique el error DIP por la densidad de la pantalla para los píxeles físicos: 0,25 DIP son 0,75 píxeles a 3×. La rotación y la escala tienen efectos de píxeles que dependen de la geometría. Los segmentos lineales conservan sus puntos finales exactos; Se conservan los tiempos de interpolación creados y las costuras de flexibilización de toda la pista.

Los resortes y las desintegraciones exponenciales libres utilizan límites de curvatura analíticos, incluido el ajuste de asentamiento final. Otras curvas utilizan tres sondas interiores con margen de seguridad. Las devoluciones de llamada de flexibilización desconocidas también conservan una red de semillas de 120 Hz. **Ninguna estrategia de muestreo finito garantiza una devolución de llamada arbitraria:** un pico estrecho o un cruce adicional pueden permanecer invisibles. La mezcla de colores, los mapeos derivados y los resortes vivos retenidos tienen rutas de ejecución separadas.

Los intervalos son como máximo 100 ms de reproducción. Cada segmento muestreado tiene un límite de intervalo de 6000, un presupuesto de refinamiento de evaluación de 24 000 y un límite de profundidad de 24. Si el refinamiento no puede cumplir con su presupuesto, Jolt vuelve a la antigua representación uniforme limitada y no ofrece garantía de precisión. Las uniones obligatorias, los segmentos creados, los colores y las repeticiones expandidas pueden agregar puntos más allá de ese límite por segmento. Este trabajo de configuración de límites; Las curvas difíciles pueden aumentar el costo de preparación y la memoria. La mejora es la precisión donde es necesaria y cargas útiles nativas más pequeñas para curvas suaves, no una reducción universal de la CPU.

El experimento **58 — Precisión de curva** incluye la comparación y las sondas nativas. Las sondas inspeccionan posiciones nativas en marcas de tiempo lógicas de 60/120 Hz; La búsqueda Android utiliza milisegundos enteros, registrados por separado del tiempo solicitado. Esto no certifica la representación física de 120 Hz. Ver [mediciones, límites y reproducción](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/curve-sampling.md).

La sonda nativa se detiene en cada marca de tiempo, espera más allá de la tarea de programación inicial de NativeScript y dos devoluciones de llamada de pantalla, luego compara una presentación leída con la curva. Mantiene la tolerancia de 0,28 DIP y un tiempo de espera limitado; no vuelve a intentar un valor incorrecto hasta que pasa. Los informes de CI fallidos incluyen la fase de búsqueda, el reloj y las observaciones nativas recientes.

## Por propiedad {#per-property}

```ts
animate(
  logo,
  { scale: [0.6, 1.08, 1], opacity: [0, 1, 1] },
  { duration: 900, ease: 'easeInOut', opacity: { times: [0, 0.3, 1] } },
)
animate(
  card,
  { y: 0, opacity: 1 },
  { type: 'spring', bounce: 0.3, opacity: { duration: 150 } },
)
```

Durante una interpolación, la transición de una propiedad cambia solo lo que establece: la opacidad del logotipo mantiene los 900 ms `easeInOut` y solo coloca sus fotogramas clave. Sobre un resorte, o cuando es un resorte en sí, reemplaza la curva, por lo que la opacidad de la tarjeta obtiene una interpolación de 150 ms. De cualquier manera, mantiene la sincronización (`delay`, `repeat`) de la principal a menos que establezca la suya propia. `times` y las flexibilizaciones por segmento tomadas de la transición principal se omiten cuando no se ajustan a los fotogramas clave de la propiedad. Las opciones pasadas a un [preestablecido](./presets) se fusionan de la misma manera, por lo que `animate(card, 'heartbeat', { duration: 1600 })` mantiene el ritmo del ritmo.

<Clip name="easing-curves-android" caption="Las mismas curvas y logo en el emulador Android. Reproducción en tiempo real." />

## Sincronización {#timing}

```ts
animate(
  badge,
  { scale: [1, 1.2] },
  { delay: 300, repeat: Infinity, repeatType: 'reverse' },
)
```

`delay` está en milisegundos y la vista toma el primer fotograma clave durante el mismo. `repeat` es cuántas veces más hay que jugar, `Infinity` hasta que se detenga. `repeatType: 'reverse'` reproduce cada dos repeticiones al revés. Las repeticiones también se reproducen de forma nativa.

`repeatDelay` mantiene el valor final durante esa cantidad de milisegundos antes de cada repetición. La primera jugada no espera, ni el final de la última tampoco. Con `'reverse'` espera en ambos extremos:

```ts
animate(
  z,
  { y: [0, -40], opacity: [0, 1] },
  { duration: 1200, repeat: Infinity, repeatDelay: 1800 },
)
```

<Clip name="repeat-delay-ios" caption="En el simulador iOS, cada z descansa 900 ms entre flotadores y la bola espera 700 ms en ambos extremos de un bucle invertido. Reproducción en tiempo real." />

La espera es parte de los fotogramas clave nativos, por lo que no cuesta JavaScript mientras se reproduce. Detenerse durante la espera deja la vista en el valor retenido.

Un rango, `repeatDelay: [min, max]`, dibuja una nueva espera antes de cada repetición, por lo que un bucle inactivo como un parpadeo no aterriza en un tiempo:

```ts
animate(
  eyes,
  { scaleY: [1, 0.1, 1] },
  { duration: 160, repeat: Infinity, repeatDelay: [1000, 4000] },
)
```

<Clip name="random-pauses-ios" caption="En el simulador iOS, la mascota izquierda parpadea y mira después de la misma pausa cada vez, y la derecha después de pausas dibujadas entre 1 y 4 segundos. Reproducción en tiempo real." />

Las esperas se dibujan cuando comienza la animación y se integran en los fotogramas clave nativos. Un `repeat` finito extrae uno por repetición. Un bucle sin fin dibuja dieciséis ciclos y los repite de forma nativa, por lo que el patrón se repite solo después de esos dieciséis, sin ningún JavaScript entre repeticiones. Todas las propiedades y vistas de una llamada `animate()` comparten las mismas esperas, por lo que `scaleX` y `scaleY`, o ambos ojos, permanecen juntos. Las llamadas separadas dibujan las suyas.

<Clip name="random-pauses-android" caption="Las mismas dos mascotas en el emulador Android. Reproducción en tiempo real." />
