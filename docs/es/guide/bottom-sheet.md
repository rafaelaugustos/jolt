# Panel inferior {#bottom-sheet}

`bottomSheet()` combina arrastre nativo, transferencia de desplazamiento, resortes, un fondo y teclado en una receta opcional en la página. Importarlo desde `@rafaelaugusto/jolt/bottom-sheet`; no agrega una hoja al punto de entrada principal.

Disponible desde **0.1.0-beta.17**, en el paquete principal. Instale `@rafaelaugusto/jolt@0.1.0-rc.2` y reconstruya la aplicación nativa para incluir las devoluciones de llamadas de contactos nativas. No se necesita ningún complemento opcional de propiedad nativa.

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

Los insets del área segura provienen del host, en DIP. Core ya coloca los hijos del host dentro de esos insets, así que el panel empieza en el inset superior del host y la altura útil descuenta ambos insets. Bajo un indicador de inicio, el panel se extiende hasta el borde de la ventana mientras el contenido queda por encima del indicador; mientras el teclado cubre ese borde, el panel termina en el teclado. `safeArea: { top, bottom }` reemplaza los insets medidos cuando el diseño circundante ya los tiene en cuenta; un override superior solo se suma a la colocación del host. Mantenga el host de superposición en la misma ventana que el panel y el teclado.

<Clip name="bottom-sheet-safe-area-ios" caption="Entrada real de XCTest en un simulador de iPhone 17 Pro (iOS 26.0) con un host de ventana completa: el snap de contenido termina en el borde de la ventana con sus filas por encima del indicador de inicio, el snap completo empieza debajo de la barra de estado y el panel sigue al teclado. Grabación de simulador, no evidencia de dispositivo físico." />

## Accesibilidad y propiedad {#accessibility-and-ownership}

El identificador recibe acciones personalizadas nativas: expandir cuando existe un stop mayor, contraer cuando existe uno menor y descartar cuando la hoja puede cerrarse, así que una hoja de un solo snap ofrece solo descartar y el conjunto sigue al stop seleccionado. Se conservan las acciones personalizadas existentes. Localícelas con `accessibility: { label, expand, collapse, dismiss, value }`, donde `value(point)` formatea el valor hablado de cada stop y de `null` al cerrar; sin él se habla el nombre del stop, y nada con un solo stop; El reverso nativo solo se intercepta mientras la hoja está abierta y cargada. `returnFocus` identifica al abridor al que enfocarse después de un descarte completo. Sin él, la receta captura el enfoque nativo actual. Reduced Motion sigue la configuración de Jolt y la preferencia de plataforma.

El controlador proporciona `isOpen`, `snapPoint`, `visibleHeight`, `paused` y `disposed`, además de `open`, `snapTo`, `expand`, `collapse`, `dismiss`, `remeasure`, `pause`, `play` y `dispose`. `onChange(point)` informa el complemento seleccionado, o `null` en una solicitud de cierre; `onDismiss()` espera a que se complete.

La descarga libera la sesión de gestos nativos, enlaces y suscripción de teclado; recargar se vuelve a adjuntar a las mismas vistas. Para una instantánea de contenido, el contenido medido se alinea en la parte superior para que una lista corta conserve su altura intrínseca. La eliminación restaura esa alineación y las otras propiedades de diseño/accesibilidad que posee la receta. No animes simultáneamente su panel Y o la opacidad del fondo con otro propietario.

La primera versión admite un panel en la página y el núcleo vertical `ScrollView`. La presentación modal nativa, los complementos de lista virtualizados y la transferencia de desplazamiento entre ventanas necesitan adaptadores separados. Los controles nativos ejercen acciones personalizadas y manejo de enfoque; una auditoría completa de navegación VoiceOver/TalkBack en dispositivos físicos es independiente de estas grabaciones del simulador.
