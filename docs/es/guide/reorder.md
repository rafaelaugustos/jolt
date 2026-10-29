# Reordenar listas {#reorder-a-list}

Sostenga un identificador de fila, muévalo a través de una lista y suéltelo. Los vecinos hacen espacio mientras la lista se desplaza cerca de sus bordes. La fila elevada permanece en una instantánea nativa incluso después de que su celda original abandone la ventana gráfica reciclada.

Disponible desde **0.1.0-beta.17**, en el paquete principal. Instale `@rafaelaugusto/jolt@0.1.0-rc.2` y reconstruya la aplicación nativa para incluir las clases de entrada y representación. No se necesita ningún complemento opcional de propiedad nativa.

<Clip name="reorder-ios" caption="Simulador de iOS, entrada real de XCTest: arrastra entre filas de altura desigual, muévete con botones y mantén presionado en el borde inferior para continuar a través de celdas recicladas. Sincronización original; sin reclamo de dispositivo físico." />

<Clip name="reorder-android" caption="Emulador Android, entrada táctil real del sistema operativo: reordene un Core ListView de 200 elementos y mantenga la fila levantada debajo del dedo mientras el desplazamiento de borde recicla su celda de origen. Velocidad original." />

## Un movimiento comprometido {#one-committed-move}

Importar desde `@rafaelaugusto/jolt/reorder`. El primer adaptador admite un **vertical plano NativeScript Núcleo ListView con alturas de fila variables**. Coloque la lista como el único hijo directo de un `ReorderSurface`; en Android, esto retiene el flujo del puntero sobre las celdas recicladas sin reemplazar el oyente táctil de Core. En iOS la superficie es una GridLayout normal y corriente.

Registre `ReorderSurface` y `ReorderHandle` una vez al iniciar la aplicación Vue:

```ts
import { registerElement } from 'nativescript-vue'
import { ReorderSurface, ReorderHandle } from '@rafaelaugusto/jolt/reorder'

registerElement('ReorderSurface', () => ReorderSurface)
registerElement('ReorderHandle', () => ReorderHandle)
```

En el componente, mantenga la matriz en estado de aplicación:

```ts
import { ref, onUnmounted } from 'nativescript-vue'
import type { EventData, ListView } from '@nativescript/core'
import { reorder, type Reorder } from '@rafaelaugusto/jolt/reorder'

type Track = { id: string; title: string }
const tracks = ref<Track[]>(/* your tracks */ [])
let sorting: Reorder<string> | undefined

function loaded(event: EventData) {
  sorting?.dispose()
  sorting = reorder<Track, string>(event.object as ListView, {
    key: (track) => track.id,
    handle: 'dragHandle',
    onCommit({ key, beforeKey }) {
      const moved = tracks.value.find((track) => track.id === key)!
      const next = tracks.value.filter((track) => track.id !== key)
      const index =
        beforeKey === null
          ? next.length
          : next.findIndex((track) => track.id === beforeKey)
      next.splice(index, 0, moved)
      tracks.value = next
    },
  })
}
onUnmounted(() => sorting?.dispose())
```

```vue
<ReorderSurface>
  <ListView :items="tracks" @loaded="loaded">
    <template #default="{ item }">
      <GridLayout columns="*,44" padding="12">
        <Label :text="item.title" textWrap="true" />
        <ReorderHandle
          id="dragHandle"
          col="1"
          text="☷"
          :accessibilityLabel="`Reorder ${item.title}`"
        />
      </GridLayout>
    </template>
  </ListView>
</ReorderSurface>
```

Para obtener una altura explícita por artículo, dimensione un contenedor interno como lo hace la demostración; Core posee la raíz de la fila y restablece su altura en Android cuando `rowHeight` es automático. Las alturas naturales basadas en texto también funcionan.

Las claves deben ser cadenas únicas o números finitos. Identifican datos, no instancias de vistas recicladas o posiciones actuales de la matriz. `onCommit` se ejecuta una vez para una entrega modificada y suministra `{ key, beforeKey, fromIndex, toIndex }`. `beforeKey: null` significa agregar; Los índices describen la posición original y la posición final después de la eliminación. Jolt nunca reorganiza la matriz de aplicaciones durante el movimiento del puntero. Aplique el movimiento sincrónicamente para obtener un resultado inmediato o mantenga el orden existente para rechazarlo.

Después de un movimiento confirmado, el adaptador Core resuelve la clave estable nuevamente, la revela con desplazamiento nativo si es necesario (centrado en iOS cuando se recorta en un borde) y devuelve el foco a su identificador. Esto sucede una vez después de que la aplicación se vuelve a vincular, incluso cuando cambian las alturas de fila estimadas iOS.

## Cancelaciones y cambios {#cancellation-and-changes}

Reemplazar `list.items`, o una fuente observable que emita `change`, cancela un arrastre pendiente antes de que se pueda confirmar un índice obsoleto. Eliminando los informes de identidad levantados `removed`; Informe de filtrado, sustitución, inserción o cambios de contenido `data-changed`. Para **cambios in situ a una matriz simple**, actualice/actualice la lista y llame a `sorting.refresh()`. Llámelo también cuando cambie la geometría de la fila sin cambiar los elementos. Las identidades se verifican nuevamente en el momento de la confirmación.

```ts
sorting.cancel() // keep the application order
sorting.pause() // cancel and disable input
sorting.play() // enable input again
sorting.dispose() // restore cells and remove native input/actions
```

Una caída sin cambios no emite ninguna confirmación. `onStart(key)` y `onCancel({ key, reason })` son devoluciones de llamada de ciclo de vida opcionales. Los motivos de cancelación también incluyen `cancelled`, `unchanged`, `unloaded`, `disposed`, `disabled` y `geometry-changed`. Salir de la página, poner la aplicación en segundo plano, cambiar el tamaño de la ventana gráfica o eliminarla libera la superposición y el marco nativo. Un controlador sobrevive a una descarga/recarga adjuntándose a la lista nativa recién cargada; `dispose()` es definitivo.

## Teclado y accesibilidad {#keyboard-and-accessibility}

Los identificadores reciben acciones de accesibilidad nativas **Subir** y **Mover hacia abajo**. Suministro de etiquetas traducidas a través de `accessibility: { moveUp, moveDown }`. Un `ReorderHandle` enfocado admite **Opción/Alt + ↑/↓**. El controlador también expone `moveUp(key)`, `moveDown(key)` y `move(key, beforeKey)`, por lo que una aplicación puede ofrecer botones normales enfocables en el teclado sin necesidad de arrastrar. Estos siguen el mismo contrato de confirmación y devuelven `false` para un elemento faltante o sin cambios.

Los resortes vecinos y la transición de caída respetan la configuración de Movimiento reducido de Jolt. El seguimiento directo de los dedos y el desplazamiento de bordes siguen estando disponibles. Configure la activación y el comportamiento del flanco con `longPress` (150–2000 ms, valor predeterminado 350) y `edge: { size, speed }` (valor predeterminado 72 DIPs y 640 DIPs/segundo).

## Límite nativo y contenido admitido {#native-boundary-and-supported-content}

Seguimiento de gestos, instantáneas, desplazamiento de resorte y desplazamiento de borde se ejecutan en código compilado UIKit/Android. Decisiones sobre el ciclo de vida, cambios de datos, accesibilidad/movimientos de teclado y creación/vinculación normal de células centrales utilizan JavaScript. No hay ninguna suscripción de puntero/trama Jolt a JavaScript; esto hace que **no** haga que la interfaz de usuario sea inmune a que JavaScript bloquee su hilo principal.

La ruta inicial admite texto estático, imágenes y contenedores de filas normales. Una instantánea es una imagen fija: no utilice cámaras en vivo/vídeo/superficies metálicas como vistas previas de arrastre. Jolt posee la traducción y opacidad del contenedor de filas realizado durante la operación; Coloque animaciones no relacionadas en una vista interior. Se rechazan las secciones integradas, los encabezados fijos y la búsqueda. Las cuadrículas, las listas horizontales, el arrastre entre listas y los complementos CollectionView de terceros no son compatibles con este adaptador.

`ReorderAdapter<T>` es el contrato de extensión para otra implementación de lista: proporcione `view`, `items()`, `subscribe(changed)` y `attach(config)`. Su controlador posee entrada nativa, geometría medida, duración de la instantánea, restauración y desplazamiento de celdas recicladas, y emite solo eventos de inicio/confirmación/cancelación del ciclo de vida. La publicación de un adaptador requiere validar el comportamiento de accesibilidad y reciclaje de esa lista; aceptar una visión arbitraria no equivale a apoyarla.
