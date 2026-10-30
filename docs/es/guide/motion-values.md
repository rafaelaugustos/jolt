# Valores de movimiento {#motion-values}

Para un resorte retenido que sigue un valor cambiante, consulte [`springValue()`](./live-springs).

Un valor de movimiento es un número que se anima de forma nativa y controla todas las propiedades de vista vinculadas a él. Un valor puede mover una hoja, oscurecer un fondo y reducir la página detrás de él, todo en un reloj nativo:

```ts
import { animate, bind, motionValue } from '@rafaelaugusto/jolt'

const progress = motionValue(0)
bind(page, { scale: progress.to([0, 1], [1, 0.92]) })
bind(backdrop, { opacity: progress.to([0, 1], [0, 0.45]) })
bind(sheet, { y: progress.to([0, 1], [200, 0]) })

animate(progress, 1, 'snappy')
```

<Clip name="motion-values-ios" caption="Un valor de movimiento abre y cierra una hoja, oscurece el fondo y reduce la página, en el simulador iOS. Reproducción en tiempo real." />

## Mapeo {#mapping}

`to(input, output)` asigna un valor a través de rangos de entrada y salida, como `interpolate` de React Native: lineal por partes, con las salidas de los puntos finales mantenidas fuera del rango de entrada. Pase `{ clamp: false }` para extender los segmentos del punto final, de modo que el exceso del resorte se lleve a cabo. Las entradas pueden aumentar o disminuir, pero no pueden cambiar de dirección. Deben ser finitos, con al menos dos entradas y una salida por entrada.

```ts
const y = progress.to([0, 0.4, 1], [600, 120, 0])
const tint = progress.to([0, 1], ['#18181B', '#FACC15']) // colors mix in OKLab
const bounce = progress.to([0, 1], [0, 300], { clamp: false })
```

Para una hoja cuyo desplazamiento va de `closed` a `0`, asigne esa dirección directamente. Cada salida permanece emparejada con su entrada, incluidos los colores:

```ts
const closed = 380
const offset = motionValue(closed)
const open = offset.to([closed, 0], [0, 1])
bind(sheet, { y: offset })
bind(page, { scale: open.to([0, 1], [1, 0.9]) })
bind(backdrop, { opacity: open.to([0, 1], [0, 0.5]) })
animate(offset, 0, 'snappy')
```

Esto da el mismo resultado que `offset.to([0, closed], [1, 0])`, sin cambiar sus matrices. La extrapolación numérica funciona en ambas direcciones; Los colores siempre se sujetan. Rangos no válidos como `[0, 1, 0]` arrojan cuando se llama a `to()`.

<Clip name="descending-values-ios" caption="Un rango de desplazamiento descendente controla el fondo de la hoja y la escala de página, incluidas las asignaciones encadenadas, el arrastre y la liberación del resorte, en el simulador iOS. Reproducción en tiempo real." />

<Clip name="descending-values-android" caption="Rangos descendentes, mapeos encadenados y gestos de hojas reales en el emulador Android. Reproducción en tiempo real." />

Las entradas repetidas conservan su comportamiento de paso existente después de clasificar los pares en orden ascendente: en una parada interior repetida, la salida del segmento inferior gana; justo encima de él, gana la última salida en esa parada. La sujeción tiene prioridad en los puntos finales. Un rango totalmente igual mantiene su primera salida en o por debajo del tope y la última por encima; con `clamp: false`, la salida en el tope exacto es la segunda salida.

Un número asignado se puede asignar nuevamente. Las salidas en color se vinculan a `backgroundColor`, `borderColor` y `color`; las salidas numéricas se vinculan a todo lo demás que toma `animate()`, con `scale` configurando ambos ejes. Un valor también se puede vincular tal como está: `bind(dot, { x: offset })`.

## Animación y ambientación {#animating-and-setting}

`animate(value, to, transition)` toma un número o fotogramas clave y las mismas transiciones que `animate()`: tweens, springs, `repeat`, `repeatType`, `repeatDelay`, `delay` y `easeTrack`. Devuelve un [`PlaybackAnimation`](./playback), incluyendo pausa, reproducción y progreso finito. Jolt muestrea la curva del valor una vez, la asigna a cada enlace y reproduce una pista nativa por propiedad enlazada, todo iniciado al mismo tiempo. Los enlaces nativos no necesitan devoluciones de llamada JavaScript por cuadro.

```ts
animate(progress, 1, 'snappy')
animate(progress, [0, 1, 0.6], { duration: 700, times: [0, 0.5, 1] })
animate(pulse, 1, { duration: 900, repeat: Infinity, repeatType: 'reverse' })
```

Una animación que interrumpe otra comienza desde el valor en pantalla, con su velocidad, por lo que cada vista enlazada gira junta. `set(value, number)` aplica un valor a cada vista enlazada a la vez. `stop(value)` mantiene el valor y sus vistas donde están. `value.get()` lee el valor ahora, mientras también anima.

Con [movimiento reducido](./configure#reduced-motion), las transformaciones enlazadas saltan hasta su final mientras la opacidad y los colores aún se animan. El [escala de tiempo](./configure#time-scale) se aplica una vez, a la curva del valor.

## Observando vistas exteriores {#observing-outside-views}

`value.subscribe((value, time) => ...)` sigue un valor de JavaScript, incluidas derivaciones numéricas y de color y valores de desplazamiento. Entrega el valor actual inmediatamente y devuelve una función de cancelación de suscripción idempotente. Pase `{ immediate: false }` para recibir solo cambios posteriores.

```ts
const release = progress.subscribe((value, time) => {
  // For example, update a SceneKit pose or a custom native renderer.
  stage.setProgress(value)
})
const releaseColor = progress.to([0, 1], ['black', 'white']).subscribe((color) => {
  stage.setTint(color)
})

// Ownership, including scope suspension/resume:
scope.use(() => progress.subscribe((value) => stage.setProgress(value)))
release()
releaseColor()
```

Las actualizaciones comparten una fuente de fotogramas respaldada por la programación CADisplayLink/Choreographer de NativeScript. Cada lote de notificaciones captura todas las fuentes observadas antes de invocar a los oyentes y proporciona la misma marca de tiempo del reloj nativo en milisegundos. Llamadas `set()` repetidas antes de que un marco se fusione a su último valor; las salidas asignadas sin cambios no notifican. La finalización y la parada entregan el valor final en el siguiente cuadro si cambió. Una escritura realizada dentro de una devolución de llamada pertenece al siguiente lote.

Las devoluciones de llamada se ejecutan en JavaScript y esperan mientras ese hilo esté bloqueado. Para destinos nativos externos compatibles, los [adaptadores de propiedades nativas](./native-properties) opcionales ofrecen reproducción y enlaces compilados. Los enlaces normales de vistas no requieren una suscripción; siguen sujetos a los límites de ejecución de cada plataforma.

La cancelación de la suscripción tiene efecto incluso durante la entrega y no detiene la animación. La fuente del marco queda inactiva después de que las fuentes observadas se estabilizan y se entregan las escrituras pendientes. Mientras la aplicación está en segundo plano, la entrega se detiene; reanudar muestras del valor actual sin reproducir fotogramas perdidos. Los errores de los oyentes van al seguimiento de errores de NativeScript y no detienen a otros oyentes. Utilice `scope.use()` o llame a la función devuelta cuando se destruya el consumidor.

El movimiento reducido mantiene la sincronización de la pista escalar; Las transformaciones vinculadas ya pueden estar al final mientras los suscriptores y los colores vinculados aún siguen el escalar. Los consumidores externos deben respetar ellos mismos el `reducedMotion()` al aplicar el movimiento espacial. La escala de duración del animador del sistema Android todavía se aplica a los relojes nativos, incluso cuando los animadores están deshabilitados.

<Clip name="value-observers-ios" caption="Una vista enlazada y un CALayer externo siguen un valor; desconecte y vuelva a conectar el suscriptor en el simulador iOS. Las devoluciones de llamada se ejecutan en JavaScript. Reproducción en tiempo real." />

<Clip name="value-observers-android" caption="Una vista enlazada y una vista Android sin procesar siguen un valor, con separación, reconexión y parada, en el emulador Android. Las devoluciones de llamada se ejecutan en JavaScript. Reproducción en tiempo real." />

## Capas en un valor {#layers-on-a-value}

Una capa con nombre agrega un desplazamiento escalar a un valor de movimiento **antes** en sus asignaciones. La animación base mantiene su propio tiempo y velocidad mientras un pulso de carga cambia a cada consumidor al mismo tiempo:

```ts
const charge = motionValue(0)
bind(car, {
  y: charge.to([0, 1], [0, -20]),
  scale: charge.to([0, 1], [1, 1.08]),
  backgroundColor: charge.to([0, 1], ['#14b8a6', '#6366f1']),
})
animate(charge, 1, { duration: 4000 })
animate(charge, [0, 0.12, -0.12, 0], {
  duration: 1200,
  repeat: Infinity,
  layer: 'pulse',
})
```

Las capas de valores siempre se agregan, incluso cuando un enlace asigna el resultado a escala, opacidad o color. Su valor neutro es `0`. Esto se diferencia del [capas de propiedades de vista](./layers), que multiplica la escala y la opacidad. La sujeción, las asignaciones por partes y la mezcla de colores ven el escalar combinado; `get()` y `subscribe()` ven esa misma composición.

<Clip name="value-layers-ios" caption="Un pulso de carga añade posición, escala y color mientras la base sigue moviéndose; reorientación, eliminación del pulso y reinicio, en el simulador iOS. El punto gris muestra solo la base. Reproducción en tiempo real." />

Cada nombre posee su animación y velocidad. Reorientar ese nombre reemplaza solo esa capa; animar sin `layer` reemplaza solo la base. Una capa completa mantiene su contribución final hasta que se elimina. El `PlaybackAnimation` devuelto también admite pausa, reproducción y progreso finito para ese canal; la pausa mantiene su contribución mientras otros canales continúan. Detener el identificador de una capa activa elimina su contribución; Detener el mango de la base sostiene la base y deja las capas en funcionamiento. Un mango asentado no hace nada.

```ts
stop(charge, { layer: 'pulse' }) // removes even a completed contribution
// Or ease the contribution back to zero first:
await animate(charge, 0, { duration: 250, layer: 'pulse' })
stop(charge, { layer: 'pulse' })
stop(charge) // freezes the combined value as the new base, clears all layers
set(charge, 0) // cancels all channels and replaces the value
```

Arrastrar un valor de movimiento cambia solo su base. Los límites, los puntos de ajuste, la posición del controlador y los eventos de arrastre utilizan unidades base; las capas aditivas pueden mover el resultado combinado más allá de esos límites. Una capa sigue reproduciéndose mientras arrastra y suelta. Los valores de desplazamiento siguen siendo entradas de solo lectura y no exponen las capas de animación.

Los enlaces reproducen una composición nativa compilada. Se reconstruye según los cambios de canal y la entrada de arrastre, no en cada cuadro. Los períodos interminables de milisegundos enteros utilizan un bucle nativo común de hasta 30 segundos; Las combinaciones más largas o fraccionarias y las composiciones finitas de más de cuatro segundos utilizan ventanas reconstruidas en sus límites. Los relojes nativos mantienen la fase de cada canal. Optar por `subscribe()` también programa las notificaciones de JavaScript.

<Clip name="value-layers-android" caption="El mismo pulso base y aditivo, con retargeting y limpieza, en el emulador Android. El punto gris muestra solo la base. Reproducción en tiempo real." />

## Encuadernación {#binding}

`bind(views, bindings)` proporciona a las vistas el estado actual de los valores a la vez y los mantiene siguiendo. Devuelve una función de limpieza: después, las vistas permanecen donde están. `motionScope().use(() => bind(...))` vincula un enlace a un alcance.

Un valor sobrevive a sus vistas. Una vista que aún no está cargada toma su valor cuando se carga y se une a una animación en progreso en el punto alcanzado. Un `animate()` o `set()` normal en una propiedad vinculada toma esa propiedad a su valor y velocidad actuales; el valor sigue impulsando sus otras vinculaciones. `stop(view)` detiene el movimiento en la pantalla pero mantiene el enlace.

## Vue {#vue}

`useMotionValue()` crea un valor que se detiene cuando el componente se desmonta. `useBinding()` devuelve una referencia de plantilla que se vincula al montar y se libera al desmontar, por lo que un elemento recreado por `v-if` recupera el valor nuevamente:

```vue
<script setup lang="ts">
import { animate } from '@rafaelaugusto/jolt'
import { useBinding, useMotionValue } from '@rafaelaugusto/jolt/vue'

const progress = useMotionValue(0)
const sheet = useBinding({ y: progress.to([0, 1], [200, 0]) })
const toggle = (open: boolean) => animate(progress, open ? 1 : 0, 'snappy')
</script>

<template>
  <GridLayout :ref="sheet" />
</template>
```

<Clip name="motion-values-android" caption="La misma hoja en el emulador Android, incluyendo un toque a mitad de camino que gira las tres vistas juntas. Reproducción en tiempo real." />

## Desplazamientos de desplazamiento {#scroll-offsets}

`scrollValue(scrollView)` es un desplazamiento de ScrollView como valor, en DIPs. Vincúlelo como cualquier valor de movimiento; cada evento de desplazamiento escribe las propiedades enlazadas directamente, sin animación intermedia:

```ts
import { bind, scrollValue } from '@rafaelaugusto/jolt'

const offset = scrollValue(scroll)
bind(header, { y: offset.to([0, 90], [0, -64]) })
bind(title, { scale: offset.to([0, 90], [1, 0.72]), y: offset.to([0, 90], [0, 30]) })
bind(subtitle, { opacity: offset.to([0, 50], [1, 0]) })
bind(progress, { scaleX: offset.to([0, 700], [0, 1]) })
```

<Clip name="scroll-values-ios" caption="Al desplazarse por la lista se colapsa el encabezado, se reduce el título, se desvanece el subtítulo y se llena la barra de progreso, en el simulador iOS. Reproducción en tiempo real." />

`{ axis: 'x' }` sigue el desplazamiento horizontal. El valor comienza desde el desplazamiento actual y `offset.ref(scrollView)` sigue a otro ScrollView, o ninguno con `null`. `offset.dispose()` deja de seguir y deja las vistas enlazadas donde están. En Vue, `useScrollValue()` devuelve un valor cuyo `ref` va en la referencia de plantilla de ScrollView y termina con el componente:

```vue
<script setup lang="ts">
const offset = useScrollValue()
const header = useBinding({ y: offset.to([0, 90], [0, -64]) })
</script>

<template>
  <ScrollView :ref="offset.ref">...</ScrollView>
  <GridLayout :ref="header" />
</template>
```

Los eventos de desplazamiento llegan a JavaScript, al igual que a [`scrollLinked()`](./scroll-linked). Con cinco propiedades enlazadas, un evento cuesta entre 0,25 y 0,3 ms en el simulador iOS y el emulador Android, aproximadamente la mitad de la configuración equivalente de `scrollLinked()` en Android; ver el [mediciones](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/scroll-values.md).

<Clip name="scroll-values-android" caption="El mismo encabezado siguiendo la lista en el emulador Android. Reproducción en tiempo real." />

## Arrastrando {#dragging}

`drag(view, { axis, value })` escribe la posición del dedo en un valor en lugar de mover la vista, luego reproduce la liberación del valor. Todo lo que está ligado a él sigue al dedo y al lanzamiento juntos. El gesto se lee en la vista que pasas; vincule esa vista también si se mueve:

```ts
import { bind, drag, motionValue } from '@rafaelaugusto/jolt'

const closed = 380
const y = motionValue(closed)
bind(sheet, { y })
bind(page, { scale: y.to([0, closed], [0.9, 1]) })
bind(backdrop, { opacity: y.to([0, closed], [0.5, 0]) })
bind(hint, { opacity: y.to([closed / 2, closed], [0, 1]) })

drag(sheet, {
  axis: 'y',
  value: y,
  bounds: { top: 0, bottom: closed },
  snap: [0, closed / 2, closed],
  rubberband: true,
})
```

<Clip name="drag-values-ios" caption="Una hoja que se puede arrastrar genera un valor de movimiento que escala la página, oscurece el fondo y desvanece la pista, con puntos de ajuste, banda elástica y el mismo valor animado por un botón, en el simulador iOS. Reproducción en tiempo real." />

`axis` es `'x'` o `'y'`. Los límites, los puntos de ajuste y el eje arrastrado en los eventos están en las unidades del valor; el otro eje dice 0. Todo lo demás funciona como en [`drag()`](./drag): goma elástica, fricción, devoluciones de llamada y el controlador. El lanzamiento es la misma curva, muestreada una vez y reproducida de forma nativa por cada propiedad vinculada, sin nada en JavaScript hasta que finaliza. `onRelease` recibe un [`Animation`](./api#animations) en lugar de un `PlaybackAnimation`. Al tocar la vista durante un lanzamiento, o durante `animate(value, ...)`, se detiene el valor donde está y el gesto continúa desde allí.

Cada evento pan escribe las propiedades enlazadas directamente. Con seis propiedades enlazadas, un evento cuesta aproximadamente lo mismo que escribirlos a mano en `onMove`: alrededor de 0,8 ms en el simulador iOS y de 0,25 a 0,35 ms en el emulador Android; ver el [mediciones](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/drag-values.md). En Vue, inicie el arrastre desde `useMotionScope()` en `onMounted`, como lo hace la pantalla **Arrastrar valores** de la demostración.

<Clip name="drag-values-android" caption="La misma hoja en el emulador Android, con lanzamientos reales en ambas direcciones y un agarre mientras la animación del botón aún está en ejecución. Reproducción en tiempo real." />

## Rutas de ejecución {#what-comes-next}

Los valores y las [capas de propiedades](./layers) pueden combinarse. El [RFC #152](https://github.com/rafaelaugustos/jolt/issues/152) original dio lugar a rutas de ejecución distintas:

| Entrada                                                                                                                                   | Ejecución                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Valores y capas guiados por timelines                                                                                                     | TypeScript prepara curvas y composiciones; las pistas nativas se reproducen entre cambios y límites de ventanas de composición. |
| `drag()` y `scrollValue()`                                                                                                                | JavaScript procesa cada evento y actualiza los enlaces; la liberación del arrastre usa una curva nativa preparada.              |
| [Gestos nativos](./gestures), [resortes continuos](./live-springs), [sensores](./device-sensors) y [cabeceras de scroll](./scroll-header) | Sus entradas y enlaces compatibles se evalúan nativamente, con JavaScript en la configuración y el ciclo de vida.               |
| `subscribe()`                                                                                                                             | Observación explícita en JavaScript mediante una fuente de fotogramas compartida.                                               |

Una fuente nativa continua no convierte `drag()` ni `scrollValue()` normales en rutas de eventos nativos. Cada guía documenta las propiedades y el ciclo de vida compatibles. Los límites de enlaces/capas en dispositivos físicos y las mediciones con pantallas más cargadas siguen en [#242](https://github.com/rafaelaugustos/jolt/issues/242).

## Costes medidos de bindings {#binding-measurements}

La [auditoría de bindings y capas](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/binding-budgets.md) cubre 22 cargas en un iPhone 17 Pro físico, con una ejecución adicional en el emulador Android. Separa preparación, reproducción nativa, límites de las ventanas de composición y observación explícita en JS. Los tiempos del emulador Android no establecen la capacidad de un teléfono.

En este iPhone, la carga de motion value con 64 vistas y tres propiedades tardó **82–95 ms** en reconstruir cada ventana de composición. El caso con bucles compatibles no envió nuevas pistas durante la reproducción. Incluso 16 vistas superaron un intervalo de 60 Hz en el límite de la ventana. Prefiere bucles nativos compatibles para movimientos repetidos y mide las vinculaciones numerosas antes de usar composición por ventanas durante una interacción. Son observaciones de estas cargas, no un máximo universal de bindings.

La auditoría de entrada usa gestos reales para `drag()`, pan nativo, `scrollValue()` y `scrollHeader()`. Las rutas nativas no registraron callbacks JS por movimiento; todas volvieron a cero trabajo rastreado tras la liberación. Los callbacks de pantalla no son FPS presentados y no se midió la latencia entre entrada e imagen. Consulta los datos brutos, el alcance de CPU/memoria y la aceptación física pendiente en [#242](https://github.com/rafaelaugustos/jolt/issues/242).

Una [auditoría posterior en Android físico](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/binding-budgets.md#physical-android-follow-up-2026-10-30) ejecutó las 22 cargas y 66 repeticiones en un ASUS_Z017DC, Android 8 / API 26, además de cuatro ventanas automáticas de gestos/scroll. Veinte cargas pasaron las comprobaciones de diagnóstico; dos ventanas con pocas muestras siguen registradas como fallos. Incluso la reconstrucción de la ventana de composición con una vista tardó **116–130 ms** en esta ejecución. Las dos rutas nativas de entrada usaron cero callbacks JS por movimiento, y los cuatro ensayos liberaron los recursos rastreados. Esta versión del sistema no informa del estado térmico, por lo que estas observaciones no establecen capacidad con condiciones térmicas controladas. Los vídeos existentes conservan sus etiquetas originales de plataforma; las nuevas mediciones Android no se grabaron.

<Clip name="binding-budget-ios" caption="iPhone 17 Pro físico reflejado mediante Device Hub: un toque real inicia la carga de 64 vistas, tres propiedades y ventanas de composición. Interfaz en inglés, tiempo original; ejecución separada de las mediciones sin grabación. El reflejo no mide frames presentados." />
<Clip name="binding-budget-android" caption="Emulador Android: gestos reales de ADB mueven 64 vistas mediante pan nativo, seguidos de su liberación. Interfaz en inglés, tiempo original; demostración separada, sin establecer la capacidad de Android físico." />
