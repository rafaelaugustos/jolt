# Diseños compartidos {#shared-layouts-within-a-page}

La portada de un álbum puede salir de un mini reproductor y convertirse en la portada ampliada. Un indicador de pestaña seleccionado puede moverse entre diferentes padres. **sharedLayout()** conecta esas vistas por identidad, captura la presentación saliente y mueve una imagen nativa temporal al nuevo diseño.

Disponible desde **0.1.0-beta.18**, en el paquete principal. Instale `@rafaelaugusto/jolt@0.1.0-rc.2` y reconstruya la aplicación nativa para instalar las clases de instantánea/renderizado. No se necesita ningún complemento opcional de propiedad nativa.

<Clip name="shared-layout-ios" caption="Interacción real en un simulador iOS: un indicador de pestaña se mueve entre los padres, la portada de un minirreproductor se expande y regresa, y comienza una inversión rápida desde la instantánea actual. Velocidad original." />

<Clip name="shared-layout-android" caption="Identidades compartidas en un emulador Android, con toques reales del sistema operativo y reproducción de instantáneas nativa. Esta no es una medición del rendimiento del dispositivo físico." />

## Captura antes de cambiar el árbol {#capture-before-changing-the-tree}

Cree un propietario para un contenedor y adjunte vistas descendientes cargadas con claves de cadena estables:

```ts
import { sharedLayout } from '@rafaelaugusto/jolt/shared-layout'
import { motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
const shared = scope.add(sharedLayout(pageContent, { transition: 'smooth' }))

const detach = shared.attach(collapsedCover, 'cover', {
  content: 'image',
  radius: 12,
})

const flight = shared.transition(() => {
  // Replace the tree synchronously; register the new loaded view with the same key.
  replaceMiniPlayerWithExpandedPlayer()
  shared.attach(expandedCover, 'cover', { content: 'image', radius: 24 })
})
const result = await flight.finished
```

Vue puede actualizar una referencia en la mutación y adjuntar la vista entrante en su controlador cargado. Jolt espera la actualización en cola de Vue y el siguiente diseño nativo antes de medir el destino. El [ejemplo completo](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/components/SharedLayoutLab.vue) también maneja el pedido inicial de eventos cargados.

La mutación debe ser sincrónica. Cargue los datos primero. La fecha límite de diseño predeterminada es 500 ms; **layoutTimeout** acepta un valor positivo de hasta 10.000 ms. Un destino faltante o no medido finaliza con un respaldo y publica cada instantánea.

Una identidad tiene una vista actual. Archivo adjunto duplicado fuera de los lanzamientos de transición. Durante la preparación, una nueva vista puede reemplazar la fuente capturada con la misma clave. Se admite la eliminación de la fuente después de la captura; la descarga lo da de baja automáticamente. Una devolución de llamada de desconexión obsoleta no puede eliminar su reemplazo. Las identidades deben pertenecer al subárbol del propietario y no pueden superponerse.

## Contenido y geometría {#content-and-geometry}

La posición, el ancho, la altura y el recorte uniforme de las esquinas utilizan coordenadas nativas de la ventana. La escala y traducción de ancestros uniformes positivos, los desplazamientos de desplazamiento, las áreas seguras y la densidad Android se incluyen en la conversión de coordenadas.

- **contenido: 'imagen'** escala cada instantánea de manera uniforme para llenar el clip en movimiento y realiza fundidos cruzados hasta la captura de destino.
- **contenido: 'contenedor'** es el valor predeterminado. Las capturas conservan el tamaño del contenido renderizado y se funden dentro del clip cambiante, sin estirar el texto.
- **radio** es un valor DIP finito no negativo. Omítalo para utilizar el uniforme numérico de la vista borderRadius.

El contenido permanece congelado durante la reproducción. Las etiquetas o imágenes actualizadas se activan cuando finaliza el vuelo. Las réplicas temporales no reciben enfoque táctil ni de accesibilidad. Las vistas originales se ocultan durante el vuelo y se restauran una vez finalizado. Mantenga los controles de inversión fuera de los subárboles adjuntos y evite mutar por separado su visibilidad nativa durante la reproducción.

## Interrupción y limpieza {#interruption-and-cleanup}

Una nueva transición captura el compuesto actual antes de cambiar el árbol nuevamente. La posición y la velocidad nativas generan las nuevas pistas de geometría. El identificador anterior se resuelve como cancelado con el motivo **interrumpido**.

```ts
flight.cancel() // stop() is an alias
shared.cancel()
shared.pause() // cancels and rejects new transitions
shared.play()
shared.dispose()
```

La cancelación revela el diseño actual de la aplicación; no deshace la mutación de la aplicación. Los cambios de geometría de destino, la rotación/cambio de tamaño de la ventana, la descarga del host y el fondo cancelan el vuelo. El movimiento reducido aplica la mutación sin una superposición en movimiento y al habilitarla durante la reproducción se cancela el vuelo. Un alcance de movimiento posee limpieza y suspensión mediante pausa/reproducción.

La promesa terminada se resuelve en **completado**, **cancelado** o **no disponible**, con un motivo para los dos últimos. Los motivos incluyen interrupción, cancelación explícita, cambio de geometría, suspensión, puntos finales faltantes, captura no admitida, movimiento reducido y fecha límite de diseño. La captura no compatible aplica el cambio de diseño normal de la aplicación sin un respaldo de bucle de fotograma JavaScript.

## Caso inicial soportado {#initial-supported-case}

Se admiten imágenes estáticas y contenedores simples en una página/ventana. [Transiciones de navegación](https://github.com/rafaelaugustos/jolt/issues/24) y [animación de diseño](./layout) hijo directo son API independientes.

Antepasados ​​translúcidos, vistas nativas de desenfoque/efecto, rotados, sesgados, en perspectiva o antecesores escalados de manera negativa o no uniforme, puntos finales parcialmente recortados/fuera de la pantalla, contenedores de desplazamiento/lista como contenido capturado, WebViews, video, cámara y superficies respaldadas por GPU utilizan la ruta no disponible. Primero resuelva los puntos finales en vistas alineadas con ejes completamente visibles. No se prometen interpolaciones arbitrarias de recorte de imágenes ni superficies vivas.

Como máximo se pueden registrar ocho identidades. **maxSnapshotPixels** tiene por defecto 8.000.000 de píxeles, aproximadamente 32 MB de capturas RGBA adicionales, incluidas capturas de inversión temporales. Acepta hasta 32.000.000. Al exceder el presupuesto se utiliza el diseño alternativo normal. El presupuesto excluye las imágenes que ya conserva la aplicación.

## Ejecución {#execution}

JavaScript maneja el registro, la mutación de aplicaciones, la coordinación del diseño, el muestreo de curvas y las devoluciones de llamadas de terminales. El código compilado iOS/Android captura/dibuja imágenes, evalúa pistas preparadas, verifica la geometría de destino y es propietario del reloj de pantalla. La reproducción de vuelos no llama a JavaScript por cuadro de visualización.

Las devoluciones de llamada nativas aún comparten el hilo de la interfaz de usuario con NativeScript; bloquear ese hilo puede retrasar la reproducción. Cada captura o reversión tiene un costo único de preparación del hilo de la interfaz de usuario.

La implementación utiliza una vista UIKit adjunta a una ventana y [VerSuperposición De Grupo](https://developer.android.com/reference/android/view/ViewGroupOverlay) de Android. La captura de origen en iOS lee [capa de presentación](<https://developer.apple.com/documentation/quartzcore/calayer/presentation()>) cuando está disponible.

<Clip name="shared-layout-pt-ios" caption="La vista previa integrada en portugués brasileño en un simulador iOS: selección de pestañas, reproductor ampliado y reversión rápida. Entrada real del sistema operativo en el momento original." />
