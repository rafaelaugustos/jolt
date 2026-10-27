# Seguir al teclado {#follow-the-keyboard}

Mover un compositor, un botón o una barra de herramientas con el teclado del software:

<Clip name="keyboard" caption="El compositor siguiendo el teclado en Android." />

```ts
import { followKeyboard } from '@rafaelaugusto/jolt'

const release = followKeyboard(composer)
followKeyboard(sendButton, { offset: 12 })
```

Cuando aparece el teclado, la vista aumenta exactamente la distancia que de otro modo estaría cubierta, a la propia velocidad y curva del teclado. Cuando el teclado cambia de altura, la vista sigue. Cuando se esconde, la vista se calma. Una vista a la que el teclado no llega se queda donde está.

El objetivo es una vista o cualquier cosa que contenga una, como `animate()`. Adjunte el efecto antes de que aparezca el teclado; reacciona a los cambios del teclado y no lee por sí solo la posición actual del teclado.

## Desplazamiento {#offset}

`offset` mantiene DIPs adicional entre el borde inferior de la vista y el teclado:

```ts
followKeyboard(composer, { offset: 8 })
```

El valor predeterminado es cero, por lo que la vista termina tocando la parte superior del teclado.

## Que se mueve {#what-moves}

El efecto posee el `translateY` de la vista. Escribe la propiedad NativeScript, por lo que el valor que lee una aplicación y el valor desde el que Jolt inicia su siguiente animación son los que aparecen en la pantalla. Cualquier animación Jolt en `y` se detiene en su posición actual antes de que el teclado tome el control, por lo que los dos nunca pelean. Otras propiedades y otras vistas están intactas.

La posición no traducida de la vista se mide cuando se mueve el teclado. No se siguen los cambios de diseño mientras el teclado está abierto; el siguiente cambio de teclado vuelve a medirse.

## iOS {#ios}

Jolt observa `UIKeyboardWillChangeFrameNotification`, que cubre mostrar, ocultar, cambios de altura y los diseños divididos y flotantes en iPad. La notificación incluye el cuadro final, la duración y la curva del teclado. El marco se convierte en la ventana de la vista y la vista se mueve dentro de una animación `UIView` con esa duración y curva, por lo que permanece adherida al borde del teclado durante todo el movimiento. La curva es un valor privado que sólo existe desplazado a las opciones de animación; Jolt lo hace por usted.

Los teclados de hardware y los cambios de duración cero aplican la nueva posición inmediatamente.

<Clip name="keyboard-ios" caption="En el simulador iOS, el compositor se levanta con el teclado y se acomoda cuando se esconde, mientras que onKeyboard() encoge la insignia en el propio resorte del teclado. Reproducción en tiempo real." />

## Android {#android}

Android 11 y posteriores informan el progreso del teclado en cada cuadro hasta `WindowInsetsAnimation`. Jolt instala una devolución de llamada nativa en la vista, por lo que el trabajo por cuadro se ejecuta en Java y nada pasa a JavaScript mientras se mueve el teclado. La devolución de llamada mide la vista antes y después de la distribución del teclado, por lo que funciona con `adjustResize` (la vista ya está dispuesta encima del teclado y solo se suaviza el movimiento), así como con `adjustPan` y `adjustNothing` (la vista se traduce por su superposición). JavaScript se llama una vez cuando comienza el movimiento y una vez cuando se estabiliza.

La actividad de la aplicación necesita configurar `android:windowSoftInputMode`, como ya lo hace la plantilla NativeScript con `adjustResize`, para que la ventana reciba inserciones de teclado. Reconstruya la aplicación Android después de la actualización para que se incluya la clase nativa.

Android 7 a 10 no tienen progreso cuadro por cuadro. Allí, Jolt lee el teclado desde el marco visible de la ventana en cada diseño. Cuando una distribución del teclado mueve la vista, Jolt la devuelve a donde estaba y la anima a su lugar encima del teclado, en el tiempo habitual del teclado: aproximadamente 150 ms, desacelerando cuando se muestra y acelerando cuando se oculta, según lo medido en un emulador Android 9. Esto cubre `adjustResize`, donde el diseño ya eleva la vista, y `adjustPan` y `adjustNothing`, donde la vista se traduce por su superposición. La animación es una animación nativa Jolt normal, que se inicia una vez por cambio.

<Clip name="keyboard-android-9" caption="En un emulador Android 9, el compositor se eleva desde donde el diseño lo movió hacia arriba del teclado y se coloca hacia atrás cuando se oculta, mientras que onKeyboard() informa 297 DIPs y mide 150 ms. Reproducción en tiempo real." />

## Estado del teclado {#keyboard-state}

Una pantalla a menudo necesita reaccionar de otras maneras: compactar un encabezado, mover una ilustración, agregar espacio al final de una vista de desplazamiento. `onKeyboard()` informa qué parte de la ventana cubre el teclado y cómo llega allí:

```ts
import { animate, onKeyboard } from '@rafaelaugusto/jolt'

const off = onKeyboard(({ visible, height, duration, transition }) => {
  animate(header, { scale: visible ? 0.8 : 1 }, transition)
})
```

<Clip name="keyboard-state-android" caption="En el emulador Android, onKeyboard() reporta 336 DIPs y los 285 ms del teclado, y la insignia se contrae a lo largo de la propia curva del teclado mientras el compositor la sigue. Reproducción en tiempo real." />

| Campo        | Significado                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------ |
| `visible`    | un teclado acoplado cubre parte de la ventana                                                                |
| `height`     | DIPs de la ventana cubierta, desde su borde inferior; cero cuando está oculto o flotando                     |
| `duration`   | milisegundos que tarda el teclado en llegar allí; cero cuando cambia a la vez                                |
| `transition` | la sincronización propia del teclado, lista para `animate()`, para que otras vistas se muevan al mismo ritmo |

La devolución de llamada se ejecuta cuando cambia la altura cubierta: mostrar, ocultar, cambiar a un teclado más alto. Un teclado iPad flotante o desacoplado no cubre nada e informa `visible: false`. Todos los oyentes comparten un observador, eliminado con la última limpieza.

En iOS el teclado se mueve sobre un resorte que Core Animation toca críticamente amortiguado en 500 ms; `transition` es ese resorte (`stiffness: 1000`, `mass: 3`). iOS informa los cambios de teclado solo a medida que ocurren, por lo que un teclado que ya está abierto cuando el primer oyente se suscribe se informa en su próximo cambio. En Android 11 y posteriores, una devolución de llamada nativa en la ventana lee la duración del teclado y toma muestras de su interpolador, por lo que `transition` sigue la misma curva. Un teclado que ya está abierto se conoce desde el principio. En Android 7 a 10, la altura proviene del marco visible de la ventana, `duration` es 150 y `transition` es un `quadOut` de 150 ms como muestra el teclado y `quadIn` como se esconde, el tiempo medido en un emulador Android 9; la altura incluye la barra de navegación debajo del teclado, como ocurre en Android 11.

En Vue, [`useKeyboard()`](./vue#keyboard) proporciona una referencia que se mantiene actualizada hasta que se desmonta el componente.

## Limpieza {#cleanup}

El valor de retorno elimina el efecto:

```ts
const release = followKeyboard(composer)
release() // stops following and clears the translation it applied
```

Al descargar la vista también se libera, por lo que una pantalla que desaparece no mantiene a un observador. Adjunte nuevamente cuando reutilice una vista descargada. Llamar a la limpieza dos veces es inofensivo.
