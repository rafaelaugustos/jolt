# Panel inferior {#bottom-sheet}

`bottomSheet()` combina arrastre nativo, transferencia de desplazamiento, resortes, un fondo y teclado en una receta opcional en la página. Importarlo desde `@rafaelaugusto/jolt/bottom-sheet`; no agrega una hoja al punto de entrada principal.

Disponible desde **0.1.0-beta.17**, en el paquete principal. Instale `@rafaelaugusto/jolt@0.1.0-rc.1` y reconstruya la aplicación nativa para incluir las devoluciones de llamadas de contactos nativas. No se necesita ningún complemento opcional de propiedad nativa.

Coloque un `GestureSurface` directamente dentro de un `GridLayout` de una sola celda de tamaño completo. Coloque una manija separada y una NativeScript vertical `ScrollView` dentro del panel. El telón de fondo es un hermano detrás. La aplicación es propietaria de estas vistas y su apariencia.

```ts
import { bottomSheet } from '@rafaelaugusto/jolt/bottom-sheet'
import { motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
const sheet = scope.add(
  bottomSheet(panel, {
    handle,
    scrollView: results,
    snap: ['content', '50%', '90%'],
    backdrop,
    returnFocus: openButton,
    keyboard: 'follow',
  }),
)

sheet.open('50%')
sheet.expand() // Next larger resolved stop
sheet.collapse() // Next smaller stop, then dismiss
sheet.dismiss()
// On component destruction:
scope.dispose()
```

El identificador es una vista accesible por separado, por lo que hacerlo procesable no colapsa los elementos secundarios de la hoja en un elemento de lector de pantalla. `GestureSurface` también se exporta desde el punto de entrada de la hoja inferior.

## Arrastrar, desplazar y mover paradas {#drag-scroll-and-moving-stops}

Los puntos de ajuste son alturas de DIP positivas, porcentajes hasta `100%` o `content`. Los porcentajes utilizan la altura utilizable del host después de la superposición de las áreas seguras y del teclado. `content` mide `scrollView.content` más el área sin desplazamiento del panel. Sin un ScrollView, proporcione una vista `content` de tamaño intrínseco que contenga el contenido de hoja deseado.

Los cambios de diseño vuelven a medir las paradas. Al hacer crecer el contenido, cambiar el tamaño del host o rotar la ventana, se reorienta la parada lógica seleccionada sin reiniciar el resorte nativo desde una nueva posición. La ventana gráfica tiene el tamaño adecuado para la parada más grande, por lo que las últimas filas permanecen accesibles cuando están completamente expandidas. `sheet.remeasure()` también está disponible para cambios basados ​​en aplicaciones.

Al arrastrar hacia arriba dentro de la lista, primero se expande el panel y luego se desplaza su contenido en el mismo contacto. Arrastrar hacia abajo primero regresa la lista a la parte superior y luego mueve el panel. Un toque interrumpe inmediatamente una aventura; soltar ese toque sin un paneo todavía selecciona una parada. El coordinador de gestos nativo maneja el movimiento y el consumo de desplazamiento. El panel y el fondo utilizan enlaces de valores de movimiento nativos. JavaScript maneja eventos de diseño/teclado y observa el cierre breve para ocultar las vistas después de establecerse.

<Clip name="bottom-sheet-ios" caption="Entrada real de XCTest en un simulador iOS 26: crecimiento de contenido, transferencia de arrastrar para desplazarse, un campo enfocado después del teclado del software y descarte. Esta es una grabación de simulador, no evidencia de rendimiento de un dispositivo físico o un lector de pantalla." />

<Clip name="bottom-sheet-android" caption="Entrada real del sistema operativo en un emulador Android: expandir antes de desplazarse, devolver la lista a su parte superior antes de mover el panel, crecimiento de contenido, seguimiento del teclado y descarte hacia atrás." />

## Teclado y despido {#keyboard-and-dismissal}

`keyboard: 'follow'` es el valor predeterminado. Mientras el teclado está visible, la hoja llena temporalmente el espacio utilizable encima de él, mantiene visible el campo enfocado y conserva el ajuste elegido. Cuando el teclado se oculta, se restaura el complemento seleccionado. Si Android ya ha cambiado el tamaño del host, el espacio del teclado no se resta nuevamente. Utilice `'none'` cuando la aplicación lo gestione por sí misma.

El fondo, una liberación hacia abajo, Android hacia atrás y la acción nativa de accesibilidad Descartar pueden cerrar la hoja. Configure `dismissible: false` para deshabilitar esas rutas de despido de usuarios; un `sheet.dismiss()` explícito todavía funciona. Un cierre interrumpido no llama a `onDismiss` ni restablece el enfoque prematuramente.

Las inserciones del área segura provienen del host. `safeArea: { top, bottom }` puede anularlos cuando el diseño circundante ya tiene en cuenta esas inserciones. Mantenga el host de superposición en la misma ventana que el panel y el teclado.

## Accesibilidad y propiedad {#accessibility-and-ownership}

El identificador recibe acciones personalizadas nativas de expandir, contraer y descartar. Se conservan las acciones personalizadas existentes. Localícelos con `accessibility: { label, expand, collapse, dismiss }`; El reverso nativo solo se intercepta mientras la hoja está abierta y cargada. `returnFocus` identifica al abridor al que enfocarse después de un descarte completo. Sin él, la receta captura el enfoque nativo actual. Reduced Motion sigue la configuración de Jolt y la preferencia de plataforma.

El controlador proporciona `isOpen`, `snapPoint`, `visibleHeight`, `paused` y `disposed`, además de `open`, `snapTo`, `expand`, `collapse`, `dismiss`, `remeasure`, `pause`, `play` y `dispose`. `onChange(point)` informa el complemento seleccionado, o `null` en una solicitud de cierre; `onDismiss()` espera a que se complete.

La descarga libera la sesión de gestos nativos, enlaces y suscripción de teclado; recargar se vuelve a adjuntar a las mismas vistas. Para una instantánea de contenido, el contenido medido se alinea en la parte superior para que una lista corta conserve su altura intrínseca. La eliminación restaura esa alineación y las otras propiedades de diseño/accesibilidad que posee la receta. No animes simultáneamente su panel Y o la opacidad del fondo con otro propietario.

La primera versión admite un panel en la página y el núcleo vertical `ScrollView`. La presentación modal nativa, los complementos de lista virtualizados y la transferencia de desplazamiento entre ventanas necesitan adaptadores separados. Los controles nativos ejercen acciones personalizadas y manejo de enfoque; una auditoría completa de navegación VoiceOver/TalkBack en dispositivos físicos es independiente de estas grabaciones del simulador.
