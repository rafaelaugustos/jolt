# Cabeceras plegables {#one-scroll-a-complete-page}

`scrollHeader()` conecta un Core ListView a un héroe medido, ilustraciones de paralaje, una barra de herramientas compacta y una sección fijada. Abra **Hecho para desplazarse** en la vista previa bilingüe: ochenta pistas recicladas, una portada cargada de forma asíncrona con un título más alto, inserción encima de la ventana gráfica y controles nativos de desplazamiento a elementos.

Disponible desde **0.1.0-rc.1**. Reconstruya la aplicación nativa.

<Clip name="scroll-header-ios" caption="Simulador iOS 26.2, inglés: arrastre real, estiramiento de overscroll, reversión, lanzamiento, una portada/título más alto, inserción y retorno programático. Velocidad original; corrección del simulador, no el rendimiento del dispositivo físico." />
<Clip name="scroll-header-ios-pt" caption="Simulador iOS, portugués: la misma composición nativa con entrada real del sistema operativo y controles traducidos." />
<Clip name="scroll-header-android" caption="Emulador Android 16, inglés: desplazamiento real a través de filas recicladas, cambios de diseño anclados y desplazamiento nativo al elemento. Este adaptador utiliza un desplazamiento normal Android sin estiramiento de héroe decorativo." />
<Clip name="scroll-header-android-pt" caption="Emulador Android, portugués: entrada real y la misma página en portugués. Los indicadores táctiles muestran gestos reales; El metraje no se acelera." />
<Clip name="scroll-header-lifecycle-ios" caption="Simulador iOS 26.2, inglés: portada más alta, descarga y recarga nativas, rotación, salida durante la inercia y reapertura de la página. Entrada real a velocidad original; no mide rendimiento en dispositivos físicos." />
<Clip name="scroll-header-lifecycle-android" caption="Emulador Android 16, inglés: cambio de tamaño con posición estable, descarga y recarga, rotación, salida tras un desplazamiento rápido y nueva interacción al volver. Entrada real mediante ADB a velocidad original; validación en emulador." />

## Construya el diseño compatible {#build-the-supported-layout}

Utilice un único **Núcleo ListView** plano, con un espaciador no accesible como fila cero y filas de datos de altura fija después. La lista llena un GridLayout acotado. Dibuja el héroe retenido, la sección y la barra de herramientas encima como hermanos, en ese orden. La obra de arte y el título ampliado pertenecen al héroe; el título compacto pertenece a la barra de herramientas. No envuelva esta lista en un ScrollView vertical.

```ts
import { scrollHeader } from '@rafaelaugusto/jolt'

const page = scrollHeader(list, {
  header,
  artwork,
  title,
  toolbar,
  toolbarTitle,
  section,
  rowHeight: 76, // DIPs; every data row has this height
  setSpacerHeight(height) {
    spacerHeight = height
    list.refresh()
  },
  keys: () => tracks.map((track) => track.id), // excludes the spacer
  parallax: 48,
  titleFade: [0, 0.7], // fractions of the measured collapse range
  toolbarFade: [0.55, 0.95],
  stretch: true, // iOS; Android has a no-stretch fallback
  onState(state) {
    // Phase/layout boundaries, never an animation-frame driver.
    console.log(state.phase)
  },
})

await page.remeasure()
await page.preserveAnchor(() => {
  tracks.unshift(newTrack)
  list.refresh()
})
page.scrollToItem(35, true) // data index, excluding the spacer
page.scrollToTop(true)
// When the screen is no longer owned:
page.dispose()
```

La plantilla de fila debe exigir su tamaño. Core 9.1.3 Android restablece el `height` de una celda raíz cuando la lista tiene un tamaño de fila automático: establezca el **minHeight y maxHeight** de la raíz en la altura de fila fija y el mínimo/máximo del espaciador en `spacerHeight`. Mantenga el propio `rowHeight` automático del ListView para que la fila cero pueda tener una altura diferente. No agregue márgenes de fila verticales. El adaptador incluye píxeles divisores Android y redondeo de píxeles físicos en su cálculo de compensación.

Ver los [Pantalla Vue](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/components/ScrollHeaderLab.vue) y [plantillas de células recicladas](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/showcase/scroll-header-cells.ts) completos. La composición aporta movimiento y geometría de desplazamiento; la aplicación posee datos, plantillas, imágenes y rutas. Los fondos superpuestos deben pasar toques excepto sus controles; la referencia utiliza `isPassThroughParentEnabled` y etiquetas decorativas no interactivas.

## Offset, geometría y anclajes {#offset-geometry-and-anchors}

La altura del héroe se mide después del diseño; la barra de herramientas proporciona su altura mínima. Los `expandedHeight` y `minimumHeight` explícitos anulan estas mediciones. El rango de colapso es `expanded − minimum` y la fila cero ocupa `expanded + section`. La sección se mueve desde la parte inferior del héroe hasta la parte inferior de la barra de herramientas. Una vez fijado, el desplazamiento continúa a través de la lista virtualizada sin un segundo propietario de desplazamiento.

El desplazamiento canónico está en DIPs. iOS utiliza `contentOffset.y + adjustedContentInset.top`, incluido el rebote negativo. Android lo deriva del índice y la parte superior, el relleno, la altura del espaciador y la zancada de la fila/divisor de la primera fila visible. Mantenga las superposiciones de hermanos en el mismo padre ajustado al área segura que la lista. Este primer adaptador no espera ningún inserto/relleno adicional de contenido superior propiedad de la aplicación dentro de esa ventana gráfica; no toma posesión de las barras del sistema ni cambia las inserciones de la lista.

Un cambio de tamaño de encabezado tardío agrega la diferencia de altura del espaciador al desplazamiento existente, manteniendo las filas de datos en su posición en la pantalla. En la parte superior absoluta, permanece en cero para que la nueva portada permanezca visible. `preserveAnchor()` sigue además la clave estable de la primera fila debajo de la sección fijada. Si esa clave desaparece, utiliza el índice de datos superviviente más cercano. Las compensaciones se ajustan a los límites del contenido real; Por lo tanto, el contenido corto/vacío puede volver a la parte superior. Los cambios se serializan; Espere una actualización antes de iniciar otra. Para datos reactivos, espere la actualización del marco dentro de la devolución de llamada. Una inserción en la parte superior de la página muestra intencionalmente el nuevo primer elemento.

`remeasure()` también se ejecuta en eventos de diseño relevantes, incluidos el ajuste y la rotación. `pause()` desconecta la fuente de desplazamiento; `play()` muestra su posición actual. La descarga de listas libera a los oyentes nativos y el gráfico, y la recarga adjunta un nuevo propietario. `dispose()` restaura transformaciones propias, recorte, accesibilidad y propiedad delegada, además de `originalSpacerHeight` (cero de forma predeterminada). No anime estas mismas propiedades de superposición desde otro controlador mientras la composición las posea.

La promesa de `remeasure()` incluye los cambios de diseño solicitados mientras una medición está pendiente. Si la lista se descarga, la promesa se rechaza; al cargarse de nuevo, la conexión se restablece automáticamente. `ready` solo es verdadero cuando termina la restauración nativa de la posición. En iOS, el adaptador también desactiva las estimaciones automáticas de encabezados y pies de sección para esta lista plana y restaura los valores anteriores al liberarse, salvo que la aplicación los haya cambiado.

## Entradas y límites nativos {#native-inputs-and-limits}

En iOS, KVO observa la geometría de desplazamiento. Un proxy delegado por lista proporciona alturas exactas de espaciador/datos y reenvía otros métodos de delegado de Core, evitando que las correcciones de altura estimada muevan un ancla durante la actualización. La eliminación restaura al delegado anterior si el apoderado todavía lo posee. Android observa cambios nativos de desplazamiento/diseño sin reemplazar el adaptador de Core, el detector de desplazamiento o las devoluciones de llamadas de elementos. Ninguna plataforma agrega un controlador de desplazamiento JS. Ambos actualizan el gráfico nativo de valor en vivo existente; JS se utiliza para configuración, cambios de diseño/datos, ciclo de vida y devoluciones de llamadas de estado aproximado. La realización/unión de células sigue siendo el trabajo normal del Core ListView y puede ingresar a JS.

`state` es una instantánea bajo demanda con `offset`, `phase`, `updates` nativo, `callbacks` semántico y recuentos de filas visibles/totales. Una etiqueta `diagnostic` opcional muestra esos recuentos nativos sin actualizaciones de marcos JS. Se trata de instrumentos de diagnóstico, no de garantía de rendimiento. En particular, el JS de Android y el trabajo de visualización comparten el hilo de la interfaz de usuario: esta API no puede hacer que el desplazamiento sea inmune al bloqueo del hilo de la interfaz de usuario.

Reduce Motion sigue fijando y desplazándose, desactiva el paralaje/estiramiento decorativo, utiliza una transferencia de título inmediata y desactiva el desplazamiento programático animado. Sólo un título participa en la accesibilidad a la vez. Las plantillas de datos de altura fija deben tener el tamaño adecuado para la escala de texto grande elegida por la aplicación; este primer adaptador no admite filas de datos de altura variable.

| Combinación                                                                                                 | Primer contrato de adaptador                                                                                                   |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Core 9.1.3 ListView plano, un espaciador y filas de datos fijas                                             | Referencia soportada en ambas plataformas                                                                                      |
| Datos cortos/vacíos                                                                                         | Extensión del contenido real; sin espacio de desplazamiento fantasma forzado                                                   |
| iOS rebote                                                                                                  | Extensión de obra de arte opcional; lista nativa posee el gesto                                                                |
| Android sobredesplazamiento                                                                                 | Comportamiento del borde de la plataforma, sin estiramiento del héroe decorativo                                               |
| Tirar para actualizar                                                                                       | No hay ningún reconocedor instalado; Las integraciones de actualización no se han validado y no son compatibles con este hito. |
| Modos principales seccionados/encabezado fijo/búsqueda                                                      | Rechazado; esta composición posee la geometría fijada                                                                          |
| Otros complementos de listas, filas de datos variables, desplazamiento vertical anidado, pestañas paginadas | No compatible; sin respaldo JS silencioso                                                                                      |

Las [notas de validación y reproducción](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/scroll-header.md) registran las comprobaciones en simulador/emulador aceptadas para esta entrega. Las mediciones de rendimiento en dispositivos físicos, el recorrido con VoiceOver/TalkBack y la integración de actualización quedan fuera de esta corrección; la evolución de los adaptadores se sigue en #116.
