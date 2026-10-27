# Cambios de diseño {#layout-changes}

`animateLayout(container)` anima el siguiente cambio de diseño de los hijos directos de un contenedor. Una nueva fila deja espacio, quitar una tarjeta cierra el espacio y reordenar las vistas existentes las mueve a sus nuevas posiciones. Agregado en beta.9.

<Clip name="layout-ios" caption="Insertar, quitar, reordenar y ampliar tarjetas nativas en el simulador iOS." />

```ts
import { animateLayout } from '@rafaelaugusto/jolt'

animateLayout(list, () => rows.value.splice(1, 0, newRow))
animateLayout(list, () => rows.value.reverse(), 'snappy')
animateLayout(list, () => {
  expanded.value = !expanded.value
})
```

Utiliza llaves estables para elementos hijos Vue. Esta API rastrea **ver instancias**, no ID de datos. Admite contenedores normales como StackLayout, GridLayout y WrapLayout. Las filas recicladas ListView/CollectionView necesitan su propia integración de animación de elementos; están fuera de esta API.

## Capturar, cambiar, animar {#capture-change-animate}

Con una devolución de llamada, Jolt captura la geometría actual, ejecuta la mutación sincrónicamente, solicita el diseño y aplica las transformaciones inversas antes del siguiente sorteo. La actualización del DOM en cola de Vue puede ocurrir entre la mutación y ese paso de diseño.

Sin una devolución de llamada, cambia el diseño inmediatamente después de llamarlo:

```ts
const animation = animateLayout(list, { duration: 350, ease: 'easeOut' })
rows.value.push(newRow)
await animation
```

Una llamada cubre un pase de diseño; no es un observador permanente. Obtener o esperar datos **antes** llamándolo. Se rechazan las devoluciones de llamada asíncronas. Una operación no operativa aún solicita una aprobación de diseño y se resuelve sin un retraso fijo. Un contenedor descargado o colapsado aplica la mutación inmediatamente y se resuelve sin retener el trabajo para animarlo en una carga posterior.

Solo se realiza un seguimiento de los hijos directos. Para mover a los vecinos de un contenedor cuando crece, llame a `animateLayout` en su padre. Los cambios anidados pueden utilizar llamadas independientes en sus propios contenedores. Las vistas eliminadas desaparecen inmediatamente; las vistas restantes se animan en el espacio. Esta API no conserva las vistas eliminadas de una animación de salida.

## Tamaño y contenido {#size-and-content}

Para cambios reales de ancho/alto, tamaños intrínsecos de `auto` y reflujo de texto continuo, utilice [`animateSize()`](./size). Su diseño por cuadro y contrato de cancelación difieren de esta API FLIP.

El `size: 'scale'` predeterminado escala desde las dimensiones antiguas a las nuevas, respetando la traslación, la escala y el origen existentes de la vista. El propio diseño calcula su tamaño final una vez. El escalado estira temporalmente el texto, las esquinas y otros contenidos; no es un reflujo de texto continuo.

Utilice `size: false` para aplicar el nuevo tamaño inmediatamente mientras anima los cambios posicionales:

```ts
animateLayout(
  list,
  () => {
    expanded.value = !expanded.value
  },
  {
    size: false,
    duration: 300,
  },
)
```

Las vistas con dimensiones cero/no finitas o visibilidad contraída no se miden. Un elemento hijo que se vuelve mensurable es tratado como nuevo. Los cambios de origen o rotación realizados en la misma mutación, y los elementos hijos que usan rotación 3D X/Y, omiten la traslación/inversión de escala; anima esas transformaciones explícitamente en su lugar. Las transformaciones de Ancestor están fuera de este cálculo de diseño local.

## Opciones {#options}

El tercer argumento (o el segundo sin devolución de llamada) acepta `'smooth'`, `'snappy'`, `'bouncy'` o un objeto `LayoutOptions`:

| Opción                                     | Comportamiento                                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Configuraciones de interpolación o resorte | `duration`, `ease`, `times`, `type`, `bounce`, `stiffness`, `damping`, `mass`, `velocity`, `delay`; Mismas unidades que `animate()`. |
| `size`                                     | `'scale'` (predeterminado) o `false`                                                                                                 |
| `enter`                                    | `true` (predeterminado) desvanece los nuevos elementos secundarios a su opacidad configurada; `false` los muestra inmediatamente     |

Las configuraciones se aplican uniformemente a los elementos hijos. La duración/retraso debe ser finito y no negativo; la rigidez/masa física debe ser positiva, la amortiguación no negativa y rebotar entre -1 y 1. Un resorte basado en la duración necesita una duración positiva; utilice una interpolación de duración cero para obtener un resultado inmediato. Las repeticiones, los marcos relativos, las anulaciones por propiedad y el escalonamiento no son opciones de diseño. Las opciones no válidas se rechazan antes de que se ejecute la mutación o se cancela una solicitud anterior.

Global `timeScale` se aplica a la reproducción. El movimiento reducido hace que la geometría se asiente inmediatamente y mantiene la entrada de opacidad opcional, siguiendo el comportamiento normal de movimiento reducido de Jolt.

## Interrupciones y titularidad {#interruptions-and-ownership}

Una segunda solicitud antes del diseño reemplaza la solicitud pendiente. Durante la reproducción, un nuevo cambio lee la pose en vivo de la animación anterior en el siguiente paso del diseño e inicia pistas de reemplazo antes de cancelar los controladores antiguos. Las traslaciones/escalas de aplicaciones existentes siguen siendo los valores en reposo; no están obligados a cero/uno.

Una animación explícita iniciada después de la captura mantiene la propiedad de sus propiedades. La reproducción de geometría posee `x`, `y`, `scaleX`, `scaleY` según sea necesario y la opacidad de los elementos hijos entrantes. Las propiedades disjuntas continúan normalmente.

El `Animation` devuelto está en espera, expone `finished` y tiene `stop()`. La finalización resuelve `true`; reemplazo o cancelación resuelve `false`. **La detención liquida las compensaciones temporales de esta operación en el diseño final**, en lugar de dejar tarjetas entre sus posiciones de diseño. La limpieza preserva a los nuevos propietarios de animaciones. No deshace la mutación de datos. Este mango agregado no expone pausa ni frega.

La descarga nativa y la suspensión de la aplicación cancelan la solicitud/reproducción y eliminan los oyentes. Utilice un ámbito para la propiedad de componentes:

```ts
const scope = motionScope() // or useMotionScope() in Vue setup
const animation = scope.animateLayout(list, () => rows.value.reverse())
// scope.reset(), scope.suspend() and scope.dispose() cancel owned layout work.
```

Las excepciones de mutación se vuelven a generar sincrónicamente después de la limpieza. Errores inesperados al preparar la reproducción nativa rechazan `finished` después de detener el trabajo parcialmente iniciado.

## Dibujo nativo y geometría táctil. {#native-drawing-and-touch-geometry}

Jolt lee límites nativos no transformados en el padre DIPs. Android inicia la reproducción desde un oyente previo al sorteo de una sola vez. iOS espera hasta que finalice el método de diseño NativeScript del contenedor y luego escribe la transformación inversa antes de dibujar. La medición y la inversión se ejecutan una vez en JavaScript; las curvas se reproducen de forma nativa después.

Las pistas de diseño seleccionan automáticamente el [controlador de geometría interactivo](./interaction-surface) en el iOS para que los controles en movimiento sigan siendo tocables en sus posiciones visibles. Sólo estas nuevas pistas están habilitadas; esto no migra animaciones existentes no relacionadas. Los ancestros animados fuera de la operación de diseño aún necesitan su propia superficie de interacción. La reproducción de iOS utiliza el hilo de la interfaz de usuario nativo, por lo que el hilo principal JavaScript puede retrasarlo. La integración de iOS también maneja el indicador de transformación en caché de NativeScript, mientras que las pistas interactivas asignan nuevos fotogramas nativos; Los ganchos son locales para las instancias afectadas y se eliminan al finalizar/cancelar.

Abra **Cambios de diseño** en el patio de juegos, o inicie `--layout-lab` en iOS / `--es layout-lab true` en Android. La demostración incluye inserción/eliminación, reordenamiento, expansión, cámara lenta, política de tamaño, parada, movimiento reducido y desmontaje/remontaje. Consulte [informe de validación](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/layout-lifecycle.md) para conocer la cobertura nativa y de entrada del sistema operativo.
