# Zoom y desplazamiento de fotos {#photo-zoom-pan-and-dismissal}

`zoomable()` ofrece un pellizco nativo NativeScript `Image`, zoom con doble toque, panorámica limitada y descarte vertical opcional. Conserva la misma vista de imagen. El procesamiento de punteros, las matemáticas de punto focal, las transformaciones y la configuración se ejecutan en código nativo en ambas plataformas.

<Clip name="photo-zoom-ios" caption="Pellizcar, desplazar, hacer doble toque para hacer zoom, restablecer y cancelar el descarte en el simulador iOS." />

```ts
import { zoomable } from '@rafaelaugusto/jolt'

const viewer = zoomable(photo, {
  viewport: photo.parent, // Must be the direct parent
  scale: [1, 5],
  doubleTap: 2.5,
  dismiss: 'vertical',
  backdrop,
  onDismiss(intent) {
    // The application owns navigation; this callback fires once per intent.
    showCloseConfirmation().then((accepted) => {
      if (accepted) {
        if (intent.complete()) closeViewerRoute({ animated: false })
      } else intent.cancel()
    })
  },
})
```

Reconstruya la aplicación nativa después de agregar el paquete. Adjunte después de que la imagen tenga un padre o proporcione su ventana gráfica futura explícitamente. La configuración espera a que se carguen ambas vistas, el diseño positivo y una imagen cargada. `ready` indica si el controlador nativo existe.

Los argumentos no válidos se lanzan sincrónicamente. Una falla de configuración nativa posterior elimina el controlador, completa el `error` y llama al `onError(error)` opcional, por lo que una reconstrucción nativa faltante no se convierte en un rechazo de inicialización no controlada.

## Reglas de gestos {#gesture-rules}

- Pinch sigue su punto focal en las coordenadas de la ventana gráfica y permanece dentro del rango de escala configurado.
- Al tocar dos veces se alterna entre el zoom mínimo y `doubleTap` (predeterminado 2.5, sujeto al rango).
- Por encima del zoom mínimo, un dedo recorre la imagen; Los límites tienen en cuenta el contenido de la imagen visible y el tamaño de la ventana gráfica. El overscroll resiste el movimiento y se estabiliza al soltarlo.
- Con el zoom mínimo, el movimiento horizontal está disponible para un buscapersonas ancestral. El despido vertical requiere una dirección vertical clara y `dismiss: 'vertical'`; está deshabilitado de forma predeterminada.
- Un despido que supera el 35 % de progreso, o un lanzamiento vertical en la misma dirección a más de 1000 DIPs/s, emite una intención. El controlador mantiene esa postura hasta que se cancela, se completa o se reinicia.

El rango de escala predeterminado es `[1, 5]`. El mínimo debe ser al menos 1. La escala es relativa a la transformación positiva alineada con el eje original de la imagen. Gira un antepasado en lugar de la imagen. La ventana gráfica recorta el contenido transformado mientras está adjunto y restaura su recorte anterior al eliminarlo.

El controlador posee las transformaciones de imágenes y su entrada de gestos. No ejecute otra animación de transformación en la misma imagen mientras esté adjunta. `imageEffect()`, `liquid()` y otro `zoomable()` reemplazan esta propiedad y eliminan el controlador anterior. Utilice un antepasado para el movimiento de pantalla independiente.

## Controles y accesibilidad {#controls-and-accessibility}

```ts
viewer.zoomTo(3, { x: 100, y: 160 }) // Viewport-local focal point, in DIPs
viewer.zoomTo(2, undefined, false) // Immediate, without settling animation
viewer.reset()
viewer.requestDismiss()
viewer.cancelDismiss()
viewer.dispose()
```

Exponga botones o acciones de accesibilidad de aplicaciones para hacer zoom, restablecer y cerrar, como lo hace la demostración. El reconocimiento de gestos por sí solo no es un sustituto accesible para estos controles. El movimiento reducido hace que el movimiento programático y el asentamiento sean inmediatos; El seguimiento directo de los dedos sigue al usuario.

`state` es una instantánea con `x`, `y` (viewport-local DIPs), relativo `scale`, despido `progress` y `pending`. `onSettled(state)` funciona en reposo. Intencionalmente no hay devolución de llamada de progreso JavaScript. Las vistas independientes opcionales `backdrop` y `chrome` se desvanecen de forma nativa al descartarlas; su opacidad original se restaura al restablecer/eliminar.

## Navegación y ciclo de vida {#navigation-and-lifecycle}

`onDismiss` recibe `{ state, velocity, cancel, complete }`. La velocidad es vertical DIPs/s. `cancel()` vuelve al zoom mínimo; `complete()` libera el controlador después de que el enrutador acepta el cierre. Ambos devuelven `false` si la intención quedó obsoleta; navegar sólo después de una finalización exitosa. Sin gestor el despido se anula automáticamente. Llamar a un intent obsoleto después de restablecerlo, reemplazarlo o eliminarlo no tiene ningún efecto.

Esta API es la parte de interacción de imágenes de un espectador. Las transiciones de rutas de elementos compartidos siguen siendo [trabajo separado](./not-there-yet). `nativeController` expone el objeto nativo para adaptadores; una ruta debe tomar posesión explícitamente antes de deshacerse de ella, utilizando el estado final si desea un traspaso continuo.

Para una transición que anima a un ancestro del espectador, mantenga pendiente la intención de descarte mientras la navegación anima a ese ancestro. La imagen permanece en la pose publicada. Al aceptar, oculte/elimine la ruta antes de restaurar la imagen con `complete()`; en caso de cancelación, restaure el antepasado y llame a `cancel()`. Completar antes de una transición de ruta visible restablece la foto demasiado pronto. Un adaptador que necesite animar la misma transformación de imagen debe transferir explícitamente la pose nativa; consulte [receta completa de la galería](./gallery) para ver el traspaso `returnToSource()` en pose sostenida.

El **Abrir ruta del visor** de la demostración utiliza una página NativeScript Frame real, una imagen vertical con transparencia y controles accesibles. Sistema Android El botón Atrás y cerrar usa `requestDismiss()`, que devuelve una imagen ampliada a su escala de reposo antes de pedirle a la aplicación que se cierre. El ejemplo deshabilita el gesto de retroceso independiente de iOS para mantener un propietario de navegación. Seguir viendo cancelaciones en la misma vista de imagen; Dejar el visor desvanece su antecesor antes de aceptar la ruta emergente. El laboratorio de imágenes en línea también funciona sin una pila de navegación.

Los cambios de fuente/estiramiento se restablecen y vuelven a conectar de forma segura. Los cambios en la ventana gráfica recalculan los límites. La descarga de cualquiera de las vistas elimina a los oyentes y restaura la transformación original. El trasfondo anula un despido pendiente y liquida la imagen; reanudar vuelve a habilitar la entrada. Deseche siempre cuando una aplicación elimine un visor sin descargar sus vistas.
