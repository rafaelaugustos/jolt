# Regreso a celdas recicladas {#returning-to-recycled-cells}

Proporciona a una entrada de navegación compartida una clave de elemento estable y un solucionador `returnTarget`. Jolt solicita la vista **actual** después de diseñar la página de retorno, para que una foto pueda volver a su miniatura después de reordenarla, desplazarla o reciclarla. La vista de origen guardada en la entrada nunca se utiliza como identidad de devolución.

Disponible desde **0.1.0-rc.1**. Reconstruya la aplicación nativa. La referencia utiliza un Core Frame, Core ListView y vue-router-ns 0.1.0-rc.2.

<Clip name="return-targets-ios" caption="Simulador iOS, inglés: toques reales mueven la foto seleccionada al final de una cuadrícula reciclada, cancelan un retorno, regresan a su nueva celda, luego eliminan la foto y usan el respaldo. Velocidad original; no evidencia de rendimiento del hardware." />
<Clip name="return-targets-pt-ios" caption="Simulador iOS, portugués: el mismo viaje de fotos reordenadas, canceladas y eliminadas con entrada real del sistema operativo." />
<Clip name="return-targets-android" caption="Emulador Android, inglés: cancelación y finalización del sistema real, resolución de la celda actual después de reordenar y respaldo de elementos eliminados. Velocidad original." />
<Clip name="return-targets-pt-android" caption="Emulador Android, portugués: gestos reales y controles traseros accesibles ejercitan el retorno y la eliminación de la celda actual. Los indicadores táctiles muestran la entrada real del sistema operativo." />

## Un solucionador acotado {#a-bounded-resolver}

```ts
import {
  sharedNavigationEntry,
  resolveListTarget,
} from '@rafaelaugusto/jolt/shared-navigation'

const entry = sharedNavigationEntry(frame, {
  tag: `photo:${photo.key}`,
  spring: 'smooth',
  returnTarget: {
    key: photo.key,
    timeout: 1500,
    resolve(context) {
      return resolveListTarget(context, {
        list,
        // Return the current ROW index, including grouped/grid rows.
        indexOf: (key) => rows.findIndex((row) => row.some((p) => p.key === key)),
        // Search realized cells by their current tag; never return a saved cell.
        viewForKey: (key) => findCurrentImage(list, `photo:${key}`),
      })
    },
    fallbackFocus: () => collectionHeading,
  },
  back: async (options) => (await router.back(options)) === undefined,
})
await entry.open((options) => router.push(`/photos/${photo.key}`, options))
```

`findCurrentImage` es un código de aplicación que atraviesa los elementos secundarios actuales de la lista. Vea los [adaptador de colección](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/showcase/photo-collection.ts) y [plantilla de celda nativa](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/showcase/collection-cells.ts) completos. La plantilla actualiza la etiqueta de cada imagen reciclada desde la clave de su nuevo elemento. Sólo conserva las celdas realizadas y utiliza la caché de imágenes normalmente.

El solucionador recibe `{ key, tag, page, signal }`. Puede devolver una vista, `null`, `undefined` o una promesa. `signal` expone `aborted`, `addEventListener('abort', callback)` y `removeEventListener`; no necesita navegador `AbortController` polyfill. Observe la cancelación al realizar el trabajo de solicitud. La espera por defecto es de 1500 ms y acepta hasta 5000 ms, incluida la realización y el diseño final. Se ignoran los resultados tardíos. `resolveListTarget` se desplaza a la fila actual y comprueba nuevamente después del diseño, lo que requiere la misma celda y geometría en dos pasadas, con un máximo de cuatro intentos si la identidad o los desplazamientos de fila estimados cambian.

Después de la resolución, Jolt requiere exactamente una etiqueta coincidente en la página devuelta y la misma vista cargada devuelta por el proveedor. Las vistas faltantes, eliminadas, duplicadas o obsoletas, los solucionadores rechazados y los tiempos de espera toman el camino normal/desaparecido. No modifican el compromiso de ruta. También cae una negativa a desplazarse o una geometría final incompatible. La vista resuelta recibe enfoque de accesibilidad; `fallbackFocus` proporciona un encabezado cercano cuando falta el elemento.

## Comportamiento de la plataforma {#platform-behavior}

En iOS, Core/UIKit monta la página de retorno debajo de los detalles. El movimiento nativo mantiene su postura inicial mientras el solucionador detecta el objetivo y luego modifica el gesto del borde restante sin saltar. Una cancelación mientras se espera aborta la preparación y conserva los detalles. Una devolución comprometida finaliza una vez. Cambiar la identidad o la geometría de la celda durante el vuelo finaliza esa presentación de manera segura.

En Android 14+, el gesto de retroceso del sistema muestra una vista previa de la página de detalles actual. La cancelación lo restaura sin ejecutar una ruta ni resolver un objetivo. Después del compromiso del sistema operativo, Jolt captura la imagen/página visible, invoca el enrutador una vez, realiza la celda actual y ejecuta el vuelo compartido nativo. **El destino reciclado en vivo no es una vista previa interactiva predictiva**: la resolución ocurre previo compromiso. A diferencia del backend estático [gestos compartidos](./shared-gestures), este modo no conserva la cuadrícula original como un mapa de bits de larga duración.

Ambas rutas mantienen los marcos de gestos/animación nativos. JavaScript se ejecuta en los límites de configuración, resolución y ciclo de vida. El presupuesto de píxeles combinado existente también cubre cualquier página retenida temporalmente; GPU/WebView/contenido de vídeo no compatible o presupuesto insuficiente utiliza la navegación normal. El movimiento reducido aún resuelve la identidad/enfoque, sin un vuelo compartido. Los tiempos de espera de ruta no pueden cancelar las promesas de propiedad de la aplicación ni deshacer una navegación externa tardía.

Para navegación programática, el mismo `returnTarget` se puede pasar a `sharedNavigation().navigate()`. `holdSource: true` conserva una instantánea de la página de origen limitada mientras se monta el destino. `onCaptured` se ejecuta una vez después de la captura y antes de llamar al enrutador, lo que permite que un controlador fotográfico retenido libere sus transformaciones. Al llamar a `cancel()` finaliza la presentación y resolución; nunca deshace una ruta comprometida.

## UIKit investigación de zoom {#uikit-zoom-investigation}

iOS 18 presentó `UIViewController.preferredTransition = .zoom(...)`. Su proveedor de fuente sincrónico puede devolver la vista de fuente actual repetidamente; Opera con controladores de vista empujados o presentados y posee despido interactivo. Las opciones públicas no exponen la rigidez/amortiguación/masa Jolt ni este contrato de realización asincrónica. Es un backend potencial independiente, no habilitado por este adaptador. Consulte [proveedor de fuente de zoom](https://developer.apple.com/documentation/uikit/uiviewcontrollertransition/zoomwithoptions%3Asourceviewprovider%3A) y [guía de transición fluida](https://developer.apple.com/documentation/uikit/enhancing-your-app-with-fluid-transitions) de Apple.

Esta entrega cubre imágenes estáticas decodificadas/contenedores simples, un Frame/ventana y geometría compatible con ejes alineados. Los modales nativos, los marcos/pestañas anidados, el reemplazo de imágenes de red y un buscapersonas de galería están fuera del contrato. La evidencia del simulador/emulador no completa la matriz de aceptación del rendimiento del dispositivo físico, el lector de pantalla y el número 24/n.° 117. Ver [reproducción y restantes controles](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/return-targets.md).

Componga este solucionador con zoom de fotografía nativo y un retorno de la pose de arrastre publicada en el [receta completa de la galería](./gallery).
