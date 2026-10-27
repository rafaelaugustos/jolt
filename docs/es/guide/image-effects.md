# Efectos de imagen {#image-effects}

`imageEffect()` agrega ondulación, distorsión táctil y disolución a un NativeScript `Image`. Estas API requieren una reconstrucción nativa después de instalar el paquete. Operan con imágenes rasterizadas cargadas, no con árboles de vistas arbitrarios, SVG, videos o imágenes animadas.

<Clip name="image-effects-ios" caption="Ondula, toca distorsión y disuelve en un dispositivo rasterizado usando Metal en el simulador iOS." />

```ts
import { imageEffect } from '@rafaelaugusto/jolt'

const ripple = imageEffect(photo, 'ripple', {
  origin: { x: 80, y: 120 }, // Image-local DIPs
  amplitude: 12,
  radius: 96,
  duration: 700,
})
await ripple.finished // true on completion, false on stop/replacement
```

## Presets y reproducción {#presets-and-playback}

| Preestablecido | Entrada                                           | Resultado                                                           |
| -------------- | ------------------------------------------------- | ------------------------------------------------------------------- |
| `ripple`       | Origen local, radio, amplitud.                    | Una onda viajera que regresa a la imagen original                   |
| `distortion`   | Movimiento del puntero nativo                     | Desplazamiento acotado alrededor del tacto, recuperándose al soltar |
| `dissolve`     | `to: ImageSource` cargado, entero opcional `seed` | Transición de ruido determinista entre dos imágenes                 |

Los orígenes, el radio y la amplitud están en DIPs en el sistema de coordenadas local de la imagen. El origen predeterminado es el centro. El radio por defecto es 96; la amplitud tiene por defecto 8 y acepta 0–64; la duración predeterminada es 650 ms; El valor predeterminado de semilla es 1 y acepta números enteros del 0 al 65535.

```ts
const transition = imageEffect(photo, 'dissolve', {
  to: nextImageSource,
  seed: 42,
  duration: 900,
  paused: true,
})
transition.progress = 0.4
transition.play()
transition.pause()
transition.reverse() // reverses and plays from the current progress
transition.finish() // completes at the current direction's endpoint
```

Los efectos finitos exponen el progreso de 0 a 1. `progress = value` conserva el estado de pausa/ejecución; Llame primero a `pause()` para obtener una vista previa de las imágenes fijas. La disolución directa exitosa compromete `to` con `photo.imageSource`. La finalización inversa mantiene la fuente original. `stop()` restaura los píxeles originales y resuelve `false`. Los identificadores completados o detenidos no pueden reiniciarse.

La distorsión es continua hasta que se detiene. Admite pausa/reproducción, pero rechaza la búsqueda de progreso y la marcha atrás. Su `finish()` se comporta como `stop()`. El procesamiento táctil y la sedimentación se producen de forma nativa; JavaScript no recibe ninguna devolución de llamada de puntero o marco.

## Plataformas y respaldo {#platforms-and-fallback}

| Plataforma                                                                               | Renderizador                                                              |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| iOS con soporte metálico                                                                 | Representación de textura metálica dentro de la vista de imagen existente |
| Android 13 / API 33+, aceleración de hardware                                            | AGSL `RuntimeShader`                                                      |
| Android anterior, renderizador no disponible, imagen no compatible o movimiento reducido | Reserva explícita                                                         |

El respaldo mantiene la imagen original para efectos decorativos y resuelve `false`. Disolver confirma inmediatamente su destino y resuelve `true`, incluso cuando la solicitud está en pausa. Esto garantiza que no se pierda una actualización de contenido cuando la animación no esté disponible. Marque `effect.diagnostics.backend` y `reason` si la aplicación necesita explicar o elegir otra presentación. Un error de configuración nativa también puede proporcionar `detail` para la depuración.

La superficie de salida tiene un límite de 4,194,304 píxeles físicos. Se conservan los píxeles transparentes y el modo de estiramiento de la imagen. El renderizador no anima el diseño ni reemplaza la navegación. La aplicación aún debe decodificar las imágenes de origen de gran tamaño en un tamaño de visualización adecuado.

## Propiedad y ciclo de vida {#ownership-and-lifecycle}

Una imagen tiene un controlador `imageEffect()`, `liquid()` o `zoomable()` activo. Iniciar otro detiene el anterior. La animación de vista exterior ordinaria puede ejecutarse junto con un efecto de imagen; evite reemplazar usted mismo su imagen dibujable/nativa.

Descargar, ocultar, cambiar la fuente/estiramiento/tinte activo o cambiar el tamaño de diseño de la imagen detiene un efecto y libera sus recursos. Una fuente aún no cargada espera la carga y el diseño positivo. La puesta en segundo plano detiene la reproducción nativa; devolver reanudacións solo si el usuario no lo pausó. Se observan cambios de movimiento reducido del sistema operativo en iOS. Las preferencias globales `configure()` se leen cuando comienza el efecto; detener y recrear un efecto continuo después de cambiarlos.

`diagnostics` informa el backend seleccionado, el recuento de fotogramas, los bytes de textura propios, el pico de bytes de textura propios, el tiempo de preparación en milisegundos y el intervalo de dibujo más largo observado. Estas son medidas de depuración, no un perfilador de GPU ni una promesa de un objetivo de velocidad de fotogramas. Los recursos propiedad de un identificador completado/detenido informan cero bytes de textura; la plataforma puede retirar las asignaciones de GPU de forma asincrónica. El límite de píxeles de la superficie es una protección de asignación conservadora, no una garantía de rendimiento medida.

Cambiar el relleno, el ancho de los bordes o los radios de las esquinas también detiene un efecto activo, por lo que su superficie no puede retener la geometría de recorte obsoleta. Los bordes y fondos quedan fuera de la textura de desplazamiento.

El laboratorio de imágenes [demostración](./demo) incluye orígenes de toque, arrastre nativo, reproducción, retroceso, desplazamiento, restauración, cuatro modos de estiramiento, bordes redondeados y controles de movimiento reducido. La fuente del paisaje se disuelve en un retrato con una esquina transparente.
