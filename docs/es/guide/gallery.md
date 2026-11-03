# Galería conectada {#a-gallery-that-stays-connected}

Abra una miniatura, pellizque un detalle, siga desplazándose después de levantar un dedo, interrumpa el zoom al tocar dos veces y luego tire hacia abajo para regresar. La referencia se compone de `sharedNavigationEntry`, `zoomable` y un solucionador de celda actual con Core ListView y vue-router-ns. La ruta permanece en el enrutador; Los cuadros de gestos y animación permanecen nativos.

Disponible desde **0.1.0-rc.1**. Reconstruya la aplicación nativa. Abra **La galería viviente** en la vista previa en cuatro idiomas.

<Clip name="gallery-ios" caption="Simulador iOS 26.2, inglés: entrada multitáctil real, doble toque interrumpido, arrastre cancelado, regreso de la pose liberada después de reordenar y retroceso de eliminación. Velocidad original." />
<Clip name="gallery-pt-ios" caption="Simulador iOS, portugués: la misma interacción completa con gestos reales del sistema operativo. Esta no es una prueba de rendimiento del dispositivo físico." />
<Clip name="gallery-android" caption="Emulador Android 16, inglés: transferencia real de pinch-to-pan, interrupción, arrastre cancelado y retorno comprometido a la miniatura reciclada actual." />
<Clip name="gallery-pt-android" caption="Emulador Android, portugués: hacer zoom, cancelar, mover, arrastrar hacia atrás y eliminar. Los indicadores táctiles representan la entrada real; El metraje no se acelera." />

## Conectar a los dos propietarios {#connect-the-two-owners}

Asigne a ambas imágenes el mismo `sharedTransitionTag`, según la clave estable de la foto. Cree la entrada como se describe en [objetivos de retorno](./return-targets). Espere a que finalice `entry.open()` antes de adjuntar el zoom a la imagen detallada en vivo. Esto evita que la transición de apertura y el espectador sean propietarios de la imagen al mismo tiempo.

```ts
import { zoomable } from '@rafaelaugusto/jolt'

// After entry.open() settles and the detail image is loaded:
const viewer = zoomable(detailImage, {
  viewport, // direct parent; unscaled in this recipe
  backdrop,
  chrome, // separate sibling, not an ancestor of the image
  dismiss: 'vertical',
  async onDismiss(intent) {
    const result = await entry.returnToSource({
      velocity: { x: 0, y: intent.velocity },
    })
    if (!result.navigated) intent.cancel()
  },
})
zoomButton.on('tap', () => viewer.zoomTo(2.5))
resetButton.on('tap', () => viewer.reset())
closeButton.on('tap', () => viewer.requestDismiss())
```

`returnToSource()` captura el **pose nativa actual y clip de ventana gráfica antes del enrutamiento** de la imagen, mantiene la página de origen visible dentro del presupuesto de la instantánea, resuelve la miniatura actual e inicia el vuelo nativo. Lleva la velocidad de traslación x/y suministrada a pistas de resorte. La velocidad está en el espacio de la ventana DIPs/segundo; conviértalo si su ventana gráfica tiene un antepasado escalado. No infiere la velocidad de pellizco/escala a partir de una liberación vertical.

Mantener pendiente el intento de despido mientras se ejecuta esta operación. No llame a `intent.complete()` antes de la captura: eso restablecería la foto. La navegación aceptada descarga la imagen, que dispone del controlador de zoom. La navegación rechazada devuelve `navigated: false`; `intent.cancel()` luego restaura al espectador en vivo desde su pose mantenida. Una segunda solicitud de devolución obtiene `unavailable/busy` sin otra ruta. El resultado devuelto tiene los mismos estados que [navegación compartida](./shared-navigation).

El código completo de la aplicación ejecutable es [GaleríaFotoDetalle.vue](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/showcase/GalleryPhotoDetail.vue), con [identidad de colección/enrutamiento](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/showcase/photo-collection.ts) y [plantilla de celda reciclada](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/showcase/collection-cells.ts). El diseño, el almacenamiento de elementos, la búsqueda de claves, el mapeo de fallas del enrutador y los controles accesibles siguen siendo códigos de aplicación. Jolt proporciona las primitivas nativas de gesto, captura, resolución y vuelo.

## Atrás, cancelación y respaldo {#back-cancellation-and-fallback}

| Situación                                     | Comportamiento en la referencia                                                                                                                           |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pequeño arrastre vertical                     | Foto nativa/cromo reposar; No hay ruta.                                                                                                                   |
| Arrastrar mientras se hace zoom               | Panorámica dentro de los límites de la imagen; el despido espera escala mínima.                                                                           |
| Cierre accesible mientras se hace zoom        | Restablecimiento nativo al mínimo, luego una intención de despido.                                                                                        |
| Borde iOS mientras se hace zoom o se arrastra | `canBegin` rechaza propiedad competitiva; restablecer o usar cerrar.                                                                                      |
| Android Atrás mientras se hace zoom           | El compromiso restablece el zoom y retiene los detalles; Otro Back puede irse.                                                                            |
| Android Espalda en reposo                     | Vista previa detallada primero; resolver la celda actual después del compromiso del sistema operativo.                                                    |
| Solicitud de retroceso durante la apertura    | Las solicitudes entregadas se fusionan hasta que se establece la entrada. UIKit puede suprimir los toques físicos durante su breve transición de entrada. |
| Elemento reordenado/fuera de pantalla         | Resuelva la fila actual por tecla y desplácese antes de medir.                                                                                            |
| Elemento eliminado o realización fallida      | Un desvanecimiento/retorno ordinario; nunca apunte a un rectángulo guardado.                                                                              |
| Detalle directo sin entrada                   | Regrese al enrutador normal o reemplácelo con la galería cuando el historial esté vacío.                                                                  |
| Cambio de ventana/diseño durante un vuelo     | Finaliza la superposición de forma segura; mantener la ruta comprometida.                                                                                 |
| Suspensión                                    | Desechar la entrada; El cierre posterior utiliza la navegación normal.                                                                                    |

Reducir movimiento conserva la semántica de zoom/restablecer/cerrar y ruta/enfoque sin el vuelo compartido. Las réplicas están ocultas al acceso. El artículo devuelto actual recibe el foco del lector de pantalla; un encabezado de colección es el recurso alternativo cuando falta. El texto ampliado tiene la cobertura en simulador/emulador descrita abajo. La validación de lectores está en [Lectores de pantalla](#screen-readers); la matriz física más amplia sigue pendiente.

## Texto ampliado del sistema

El detalle mide el encabezado y el panel de controles en lugar de reservar filas de texto de altura fija. Títulos y botones admiten varias líneas. El panel nativo tiene altura limitada y permite desplazarse cuando hace falta, también en horizontal, mientras la foto conserva una zona separada para los gestos. El chrome sigue siendo hermano de la imagen para animarse de forma independiente al cerrar.

iOS habilita Dynamic Type y aplica el área segura una sola vez. Android actualiza las etiquetas retenidas con el tamaño nativo en SP después del cambio de configuración, reutilizando el helper del ejemplo de encabezado con scroll. El listener y la actualización pendiente se eliminan al desmontar.

Se comprobaron cambios reales del sistema en iPhone 17 / iOS 26.2 Simulator (`large` → `accessibility-medium` → `large`) y Android 16 / API 36 emulator (`font_scale` 1 → 2 → 1). El zoom de 2,5× se conserva; ampliar/restablecer funcionan después de girar, y un desplazamiento real del panel muestra los controles completos. Se restaura el texto normal y se abre otra foto con texto ampliado. Ambos retornos llegan a la miniatura actual, con una navegación por retorno y cero recursos nativos de navegación al terminar. Las mediciones nativas comprueban el ajuste del texto y las dimensiones de los controles. Esa prueba anterior cubre las configuraciones del simulador; la combinación de lector e iPhone físico se documenta abajo.

<Clip name="gallery-large-text-ios" caption="Simulador iPhone 17, iOS 26.2, interfaz en inglés: cambios reales de Dynamic Type, zoom conservado, controles en vertical/horizontal con desplazamiento del panel, restauración y dos retornos a miniaturas. Reproducción nativa a velocidad original; la vista horizontal aparece girada en la grabación vertical. Snapshot solo recoge diagnósticos opcionales. No valida dispositivos físicos ni lectores de pantalla." />
<Clip name="gallery-large-text-android" caption="Emulador Android 16 / API 36, interfaz en inglés: escala de fuente de 1 a 2 y de vuelta, zoom conservado, rotación, controles desplazables y dos retornos a miniaturas. Reproducción nativa a velocidad original con indicadores de toques reales; la vista horizontal tiene bandas negras. Snapshot solo registra diagnósticos. No valida dispositivos físicos ni lectores de pantalla." />

[Reproducción y observaciones nativas](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/gallery.md#enlarged-system-text-2026-10-30) detallan esta comprobación acotada de la pantalla de detalle.

## Hito soportado {#supported-milestone}

Imágenes estáticas verticales, horizontales y cuadradas transparentes empaquetadas/en caché, un Core Frame/ventana, Core ListView y vue-router-ns 0.1.0-rc.2. Los retornos arrastrados personalizados admiten el recorte de la ventana gráfica rectangular y la escala positiva uniforme. Una miniatura parcialmente recortada en la entrada puede utilizar una apertura normal; la resolución de un objetivo de retorno visible sigue siendo independiente. El reemplazo de red, un buscapersonas fotográfico, transiciones arbitrarias modales/marcos anidados, imágenes rotadas y superficies de video/GL/WebView son las siguientes cosas.

La guía y el [evidencia nativa](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/gallery.md) cubren la corrección en simulador/emulador y la prueba limitada del lector en iPhone físico descrita abajo. El ritmo de cuadros del dispositivo físico, la latencia de entrada y la creación de perfiles de memoria de proceso permanecen abiertos en el n.° 117; Estos clips no cierran esa matriz de aceptación.

## Rotación y reanudación en Android {#android-rotation-and-resume}

La auditoría en el emulador Android 16 / API 36 conserva el zoom de 2,5× al pasar de vertical a horizontal y de nuevo a vertical, y verifica un desplazamiento real dentro del viewport redimensionado. Tras ir a la pantalla de inicio y reanudar la aplicación, la ruta de detalle sigue activa y acepta otro gesto de pinza seguido de desplazamiento, reinicio y cancelación del cierre.

La suspensión libera la entrada de navegación compartida, como se describe arriba; por eso, el primer cierre tras reanudar usa navegación normal. Cada apertura posterior crea una entrada nueva: tres ciclos con imágenes verticales, transparentes y horizontales completan el retorno compartido a la miniatura actual. Al terminar, el historial vuelve a la galería y los contadores nativos de transiciones, callbacks de Back y escenas retenidas quedan a cero. Esto verifica esos recursos y las interacciones visibles; no mide memoria del proceso ni rendimiento en un dispositivo físico.

<Clip name="gallery-lifecycle-android" caption="Emulador Android 16 / API 36, galería en inglés: zoom, rotación, desplazamiento, inicio y reanudación, nueva pinza, cierre cancelado y retornos repetidos mediante entrada real. Reproducción nativa a velocidad original. La grabación muestra bandas vacías en horizontal; no demuestra rendimiento en un dispositivo físico." />

[Reproducción y observaciones del ciclo de vida](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/gallery.md#android-lifecycle-audit-2026-10-29) cubren este adaptador y escenario. La matriz completa de aceptación permanece en [#117](https://github.com/rafaelaugustos/jolt/issues/117).

## Lectores de pantalla {#screen-readers}

Cada miniatura es un botón independiente, incluidas las dos fotos de una fila reciclada. Los metadatos decorativos quedan fuera del orden de lectura; el título del detalle es un encabezado y los controles de zoom, restablecer y cerrar son accesibles.

Durante el regreso con resolución de destino, Jolt excluye temporalmente la página de la navegación del lector para evitar que el enfoque automático desplace la celda durante la transición. Restaura el estado original al terminar, cancelar o liberar, y solicita el foco de la miniatura actual en el siguiente turno nativo. Si la foto desapareció, enfoca el encabezado. Ignora solicitudes pendientes si la vista fue reciclada, descargada o ya pertenece a otra ruta.

La grabación cubre apertura, zoom de 2,5×, restablecer, cerrar con zoom, reabrir después de mover la foto al índice 59, eliminación y un cuarto regreso con Reducir movimiento de Jolt. Los registros comprueban foco real, escala nativa, cuatro navegaciones y cero recursos nativos de navegación al finalizar. La cobertura corresponde al Core ListView/router de referencia y al tamaño de texto grabado; la combinación con texto ampliado está documentada abajo; Android físico, otras configuraciones y rendimiento siguen pendientes.

<Clip name="gallery-voiceover-ios" caption="iPhone 17 Pro físico, iOS 27.2, interfaz en inglés: navegación real con VoiceOver, doble toque, zoom/restablecer, foco después de reordenar, encabezado tras eliminar y Reducir movimiento. Grabación nativa de XCTest a velocidad original, sin audio de voz. La traza verifica voz real y foco nativo." />
<Clip name="gallery-talkback-android" caption="Emulador Android 16 / API 36, interfaz en inglés: gestos reales de TalkBack, exploración táctil y doble toque en cuatro regresos, incluidos elementos movidos/eliminados y Reducir movimiento. Grabación nativa a velocidad original, sin audio de voz. No demuestra Android físico ni rendimiento." />

[Reproducción y evidencias](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/gallery.md#screen-readers-2026-11-01).

## Lectores de pantalla con texto ampliado {#screen-readers-with-enlarged-text}

El mismo recorrido de cuatro regresos también pasa con **VoiceOver y Dynamic Type del sistema en `accessibility-medium` en un iPhone físico**, y **TalkBack con `font_scale=2` en el emulador Android**. La navegación del lector alcanza ampliar, restablecer, mover y eliminar; el panel nativo permite desplazarse para revelar un control recortado. El título conserva su función de encabezado, el texto se ajusta sin puntos suspensivos, los controles mantienen al menos 44 × 44 DIPs y la foto conserva un viewport separado.

Las grabaciones muestran zoom de 2,5×, restablecimiento, cierre con zoom, regreso a la foto movida al índice 59, foco en el encabezado tras eliminarla y otra foto con Reducir movimiento de Jolt. Las comprobaciones confirman pose nativa, foco en la clave actual, una navegación por cierre y contadores finales de transiciones, entradas y escenas retenidas a cero. La automatización restaura las configuraciones originales de fuente y lector. Esto valida el demo existente sin añadir una API pública.

<Clip name="gallery-large-text-voiceover-ios" caption="iPhone 17 Pro físico, iOS 27.2, interfaz en inglés: navegación y activación reales con VoiceOver y accessibility-medium seleccionado en Ajustes de iOS. Controles ampliados, zoom/restablecer y cuatro regresos, incluidas fotos movidas/eliminadas y Reducir movimiento de Jolt. Grabación nativa de XCTest a velocidad original, sin audio de voz; la traza verifica voz real, foco nativo y tamaño de fuente. Orientación vertical, router/lista de referencia." />
<Clip name="gallery-large-text-talkback-android" caption="Emulador Android 16 / API 36, interfaz en inglés: TalkBack real con escala de fuente 2, navegación del lector, desplazamiento del panel con dos dedos, zoom/restablecer y cuatro regresos. Grabación nativa a velocidad original, sin audio de voz; las trazas verifican foco y geometría del texto. Evidencia de corrección en emulador, no Android físico ni medición de rendimiento." />

[Reproducción y evidencia combinada](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/gallery.md#screen-readers-with-enlarged-text-2026-11-01). Otras categorías de fuente, orientación horizontal con lector, idiomas, Android físico y la matriz completa de ciclo de vida/rendimiento siguen en [#117](https://github.com/rafaelaugustos/jolt/issues/117).

[Recetas nativas completas](recipes.md)

## Aceptación actual en emuladores {#current-emulator-acceptance}

El candidato del 2026-11-03 repite interrupción, retorno, rotación, texto ampliado y limpieza en iOS Simulator y Android Emulator, según lo solicitado. Las interacciones nativas repetidas incluyen muestras de memoria del proceso. Los 30 ciclos de scroll muestran asignación y recolección, sin crecimiento monótono; estas muestras no demuestran ausencia de fugas. [Resultados y límites](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/results/acceptance-2026-11-03/README.md). La validación física de este candidato sigue sin verificarse.
