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

Reducir movimiento conserva la semántica de zoom/restablecer/cerrar y ruta/enfoque sin el vuelo compartido. Las réplicas están ocultas al acceso. El artículo devuelto actual recibe el foco del lector de pantalla; un encabezado de colección es el recurso alternativo cuando falta. VoiceOver/TalkBack físico y la aceptación de texto grande siguen sin verificarse.

## Hito soportado {#supported-milestone}

Imágenes estáticas verticales, horizontales y cuadradas transparentes empaquetadas/en caché, un Core Frame/ventana, Core ListView y vue-router-ns 0.1.0-rc.2. Los retornos arrastrados personalizados admiten el recorte de la ventana gráfica rectangular y la escala positiva uniforme. Una miniatura parcialmente recortada en la entrada puede utilizar una apertura normal; la resolución de un objetivo de retorno visible sigue siendo independiente. El reemplazo de red, un buscapersonas fotográfico, transiciones arbitrarias modales/marcos anidados, imágenes rotadas y superficies de video/GL/WebView son las siguientes cosas.

La guía y el [evidencia nativa](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/gallery.md) cubren la corrección del simulador/emulador. El ritmo de cuadros del dispositivo físico, la latencia de entrada y la creación de perfiles de memoria de proceso permanecen abiertos en el n.° 117; Estos clips no cierran esa matriz de aceptación.
