# Imágenes líquidas {#liquid-images}

`liquid()` le da a un iOS `Image` una deformación lenta y continua. Partes de la textura se mueven entre sí mientras que los límites de la imagen permanecen fijos.

<Clip name="liquid-ios" caption="El orbe de voz se deforma, se pausa y se reanuda en el simulador iOS. La demostración también anima su escala y rotación generales." />

```ts
import { liquid } from '@rafaelaugusto/jolt'

const flow = liquid(orb, { intensity: 0.9, duration: 7200 })

flow.pause() // freeze the current shape
flow.resume() // continue from that shape
flow.stop() // remove the effect and restore the original image
```

## Opciones {#options}

| Opción      | Predeterminado | Significado                                                                 |
| ----------- | -------------- | --------------------------------------------------------------------------- |
| `intensity` | `0.7`          | Resistencia a la deformación de `0` a `1`. Zero deja la imagen sin cambios. |
| `duration`  | `8000`         | Milisegundos por ciclo continuo. Debe ser finito y mayor que cero.          |

El controlador controla este efecto únicamente. Las transformaciones y la opacidad todavía pertenecen a `animate()`; detener esas animaciones no detiene el efecto líquido. Llame a `flow.stop()` cuando su dueño sea eliminado. Llamar nuevamente a `liquid()` en la misma imagen reemplaza el efecto anterior. Las opciones no válidas dejan el efecto de ejecución solo.

## Renderizado y ciclo de vida {#rendering-and-lifecycle}

Jolt prepara un campo de desplazamiento periódico en una cuadrícula de textura de 24 × 24. SpriteKit interpola 64 etapas por ciclo a través de una acción repetitiva nativa. La GPU deforma los píxeles; no hay devolución de llamada de fotograma JavaScript, temporizador, compilación de sombreador personalizado ni secuencia de recursos de imagen.

El renderizador nativo vive dentro de la vista de imagen existente. Mantiene el modo alfa, accesibilidad, máscaras, transformaciones y estiramiento de la imagen (`aspectFit`, `aspectFill`, `fill` o `none`). Los cambios de diseño cambian el tamaño del renderizador sin reiniciar el ciclo. La fuente de la imagen original permanece en el modelo NativeScript.

La pausa congela la deformación actual. La inactividad de la aplicación también detiene el procesamiento; convertirse en reanudacións activos a menos que lo hayas pausado explícitamente. La descarga libera la escena, la textura y la acción nativa; La carga recrea el efecto. Un cambio de fuente reconstruye la textura. Reducir el movimiento u ocultar la imagen elimina el renderizador y muestra la imagen original; volver a activar el movimiento o mostrar la imagen lo recrea.

## Contenido soportado {#supported-content}

Este asistente acepta objetivos NativeScript `Image` y sus referencias de plantilla. Utiliza una imagen rasterizada estática. Las imágenes animadas, las imágenes de plantilla/SF Symbols, las imágenes faltantes y las imágenes de más de 16 megapíxeles mantienen su representación original. Android devuelve un identificador inerte sin acceder a las API de iOS.

El efecto deforma la obra de arte existente. No genera nuevos pliegues ni simula un fluido, y no es una API de sombreado general para vistas arbitrarias. Ese trabajo se rastrea por separado en [#35](https://github.com/rafaelaugustos/jolt/issues/35).

Consulte el [Pantalla de voz](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/assistant/Voice.vue) del asistente para ver un ejemplo completo con pausa/reanudación y limpieza de desmontaje.
