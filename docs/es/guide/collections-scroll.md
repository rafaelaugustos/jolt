# Colecciones y continuidad del scroll

## Colecciones medidas y transferencias {#collection-layouts}

En la rama de desarrollo, los adaptadores de CollectionView admiten carruseles de una fila LTR/RTL y cuadrículas verticales regulares. Desactive el reorder del plugin y use claves estables. El arrastre, el desplazamiento en los bordes y la cancelación usan la geometría de las celdas montadas. ListView de Core admite alturas automáticas y mantiene la posición de la primera fila visible que sobrevive al cambio.

En la Web, use axis x en listChanges para carruseles y layout grid en reorder para cuadrículas CSS de celdas uniformes. Los virtualizadores proporcionan su propio anclaje y notificaciones de reciclaje. El adaptador admite listas planas y cuadrículas verticales regulares.

Pase listTransferOptions a dropZones para cada origen. Proporcione claves únicas entre ambas listas, los centros de las filas montadas del destino y un commit que actualice ambas listas una vez. Un destino vacío acepta el índice cero. preview indica el índice y lo limpia al salir. accept decide al soltar de forma síncrona. Incremente revision al invalidar datos, cancele al interrumpir y llame a dispose al desmontar. Se mantienen los controles de teclado de reorder y dropZones.request.

Para un carrusel RTL en Android, habilite `android:supportsRtl="true"` en el manifiesto de la aplicación. Para mover una tarjeta entre columnas, permita que se dibuje fuera de la columna de origen. Use `clipToBounds = false` en iOS y aplique `setClipChildren(false)` y `setClipToPadding(false)` a los contenedores que atraviesa en Android. Durante el arrastre, dibuje la columna de origen por encima del destino.

```ts
const options = listTransferOptions({
  key: card.id,
  target: destination,
  sourceKeys: () => inbox.map((item) => item.id),
  targetKeys: () => queue.map((item) => item.id),
  centers: measureVisibleDestinationRows,
  revision: () => boardRevision,
  accept: () => queue.length < capacity,
  preview: showInsertionMarker,
  commit: ({ fromIndex, toIndex }) => moveCard(inbox, queue, fromIndex, toIndex),
})
const owner = dropZones(source, options)
// Web: runtime.dropZones(source, options)
```

### Carrusel de una fila

<Clip name="collection-carousel-ios" caption="Carrusel de una fila · simulador iOS." />

<Clip name="collection-carousel-android" caption="Carrusel de una fila · emulador Android." />

<Clip name="collection-carousel-web" caption="Carrusel de una fila · Chromium en macOS." />

### Carrusel de derecha a izquierda

<Clip name="collection-rtl-ios" caption="Carrusel de derecha a izquierda · simulador iOS." />

<Clip name="collection-rtl-android" caption="Carrusel de derecha a izquierda · emulador Android." />

<Clip name="collection-rtl-web" caption="Carrusel de derecha a izquierda · Chromium en macOS." />

### Filas de alturas distintas

<Clip name="collection-heights-ios" caption="Filas de alturas distintas · simulador iOS." />

<Clip name="collection-heights-android" caption="Filas de alturas distintas · emulador Android." />

<Clip name="collection-heights-web" caption="Filas de alturas distintas · Chromium en macOS." />

### Cuadrícula regular

<Clip name="collection-grid-ios" caption="Cuadrícula regular · simulador iOS." />

<Clip name="collection-grid-android" caption="Cuadrícula regular · emulador Android." />

<Clip name="collection-grid-web" caption="Cuadrícula regular · Chromium en macOS." />

### Transferencia entre listas

<Clip name="collection-transfer-ios" caption="Transferencia entre listas · simulador iOS." />

<Clip name="collection-transfer-android" caption="Transferencia entre listas · emulador Android." />

<Clip name="collection-transfer-web" caption="Transferencia entre listas · Chromium en macOS." />

## Adaptadores anteriores de CollectionView (RC.16) {#collections}

**Disponible en 0.1.0-rc.16 (Beta).** Cubre [#495](https://github.com/rafaelaugustos/jolt/issues/495), [#496](https://github.com/rafaelaugustos/jolt/issues/496) y [#510](https://github.com/rafaelaugustos/jolt/issues/510), [#511](https://github.com/rafaelaugustos/jolt/issues/511), [#512](https://github.com/rafaelaugustos/jolt/issues/512), [#513](https://github.com/rafaelaugustos/jolt/issues/513). Instale core/plugin nativo en la misma versión y recompile la aplicación nativa tras actualizar. SwiftUI sigue en Beta para iOS 17+ y macOS 14+.

`collectionViewListAdapter` y `collectionViewReorderAdapter` admiten el plugin opcional `@nativescript-community/ui-collectionview` (probado con 6.1.3), con una columna vertical, claves estables y sin layout invertido ni `reorderEnabled` del plugin. Usan la geometría nativa montada, sin importar el plugin en Jolt. No incluyen cuadrículas, secciones ni transferencias entre listas.

`listChanges` captura las filas visibles, aplica una actualización inmutable, conserva la primera clave visible y su desplazamiento interno, y anima el nuevo layout. Envíe los cambios estructurales mediante `update`; no use otro controlador de layout sobre las mismas filas. Las celdas recicladas restauran su estado antes de recibir otra identidad. Las copias de salida y las interrupciones conservan su duración limitada. Consulte [valores, scroll y listas](./values-scroll-lists).

Reorder ejecuta captura, previsualización, scroll en los bordes y restauración de celdas en el código nativo. El commit contiene la clave estable y la clave de inserción; la aplicación actualiza los datos una vez. En Android, la colección debe ser el único hijo de `ReorderSurface`. Para un panel padre, sitúe esa superficie dentro de `GestureSurface`. Declare `waitFor` del panel después de montar ambos controladores: mover antes de reconocer la pulsación larga permite el scroll normal; el reorder reconocido controla el arrastre. Recree las relaciones después de remontar.

```ts
import { collectionViewListAdapter, listChanges } from '@rafaelaugusto/jolt'
import { collectionViewReorderAdapter, reorder } from '@rafaelaugusto/jolt/reorder'
import { gestures, scrollHandoff, gestureRelations } from '@rafaelaugusto/jolt/gestures'

const changes = listChanges(collection, {
  key: (item: Item) => item.id,
  adapter: collectionViewListAdapter<Item>(collection),
})
changes.update(nextItems)
// Dispose changes before switching ownership to interactive reorder.
changes.dispose()
const sorting = reorder(collectionViewReorderAdapter<Item>(collection), {
  key: (item) => item.id,
  onCommit: (move) => commitByKey(move.key, move.beforeKey),
})
const panel = gestures(surface, {
  pan: { axis: 'y', bounds: { top: 0, bottom: 180 } },
  scrollView: scrollHandoff(collection),
})
const links = gestureRelations([{ gesture: panel, other: sorting, relation: 'waitFor' }])
// Teardown: links.dispose(); panel.dispose(); sorting.dispose().
```

## Transferencia continua {#handoff}

`scrollHandoff(view, { axis })` amplía `gestures(..., { scrollView })` y `bottomSheet` a Core ListView, CollectionView lineal y Core ScrollView horizontal. Panel y scroller deben compartir eje; el scroller debe descender de la superficie. Indique límites explícitos en DIPs. Core ListView y bottom sheets siguen siendo verticales; CollectionView exige un eje lineal coincidente y una columna. El panel se expande antes de desplazar el contenido; al invertir, el contenido vuelve al inicio antes de contraer el panel. Solo el último propietario recibe la velocidad de liberación, en DIPs/segundo.

Reemplazar los elementos cancela el contacto. Cambiar el contrato de layout descarta el controlador: recréelo tras cambiar orientación, columnas, tamaño de filas/columnas o estilo de layout. Cancelación, unload, suspensión y descarte liberan la entrada y los delegates nativos, conservando los listeners existentes. Handoff y reorder nativos no necesitan JavaScript de aplicación por fotograma. Una vista arbitraria sigue necesitando un backend nativo compatible.

`JoltBottomSheet` transfiere el mismo contacto SwiftUI entre panel y contenido en iOS y macOS. Su modelo conserva los puntos de parada y el reloj finito de liberación. Pan de UIKit y mouse/rueda de AppKit alimentan ese modelo, sin duplicar el momentum. Se conservan toques, texto, teclado y movimiento reducido. Los scrollers UIKit anidados mantienen su entrada. Inactividad, remontaje y descarte cancelan la conexión. Son paneles dentro de la aplicación; la rueda de XCTest no demuestra la sensación de un trackpad físico.

## Orden horizontal y valores de scroll {#horizontal}

Las filas nativas montadas admiten `axis: 'x'` y `direction: 'ltr' | 'rtl'`. El array conserva el orden lógico; los objetivos medidos deben seguirlo sin solaparse y pueden tener anchos distintos. RTL no cambia los índices verticales. En Web, use el `reorder` existente con `axis: 'x'` y `direction` CSS del contenedor; las previsualizaciones RTL siguen ahora el orden lógico. Scroll en bordes, cancelación y ciclo de vida conservan sus contratos.

`scrollValue` nativo admite Core horizontal/vertical y CollectionView lineal. En listas recicladas Android, `rowHeight` es el **paso fijo real entre elementos en DIPs** (ancho para x), incluido el espaciado. Puede diferir del tamaño solicitado: esta ejecución midió 49,524 DIP para filas solicitadas de 64 DIP. iOS lee el offset más el inset ajustado. El cero horizontal nativo está a la izquierda física incluso en RTL; el rebote iOS puede ser negativo y el rango Android validado queda limitado. No son índices de elementos.

El benchmark interno compara el coste del productor nativo y JavaScript con las mismas cinco propiedades. Excluye la evaluación posterior del grafo, renderizado y CPU/PSS de toda la aplicación. Simulador/emulador no demuestran rendimiento físico. Consulte el [informe de aceptación](https://github.com/rafaelaugustos/jolt/blob/feat/rc16-collections-scroll/benchmarks/collections-scroll/README.md).

## Web y límites del ciclo de vida {#web}

Reutilice `listChanges` Web, su adaptador explícito de virtualización, `scrollValue` y gestos con scroll anidado. Se mantiene el planificador del navegador, sin promesa de hilo nativo ni píxeles idénticos. Reorder actúa sobre la ventana montada: cambiar una clave u objetivo DOM durante el contacto cancela antes de un commit obsoleto. Mantenga esa ventana montada para continuar el arrastre durante la virtualización; Jolt no aporta un virtualizador Web. Se conservan botones, teclado y movimiento reducido; este lote no amplía el trabajo de accesibilidad.

## Grabaciones reales {#evidence}

<Clip name="collection-motion-ios" caption="iPhone 17 Pro · simulador iOS 27; entrada real de XCTest. Actualizaciones, reorder con reciclaje, inversión en bordes y cancelación." />

<Clip name="collection-motion-android" caption="Pixel 7 · emulador Android API 36; toques reales del sistema. Actualizaciones, reorder con reciclaje, inversión en bordes y cancelación." />

<Clip name="scroll-handoff-ios" caption="iPhone 17 Pro · simulador iOS 27; entrada real de XCTest. Un contacto expande, desplaza e invierte con ListView, CollectionView y ScrollView horizontal." />

<Clip name="scroll-handoff-android" caption="Pixel 7 · emulador Android API 36; toques reales del sistema. Un contacto expande, desplaza e invierte con ListView, CollectionView y ScrollView horizontal." />

<Clip name="horizontal-reorder-edges-ios" caption="iPhone 17 Pro · simulador iOS 27; entrada real de XCTest. Orden LTR/RTL con anchos variables, ambos bordes, inversión, cancelación y movimiento reducido." />

<Clip name="horizontal-reorder-edges-android" caption="Pixel 7 · emulador Android API 36; toques reales del sistema. Orden LTR/RTL con anchos variables, ambos bordes, inversión, cancelación y movimiento reducido." />

<Clip name="scroll-source-ios" caption="iPhone 17 Pro · simulador iOS 27; entrada real de XCTest. Cinco propiedades, comparación de offsets nativo/JS, RTL horizontal y CollectionView." />

<Clip name="scroll-source-android" caption="Pixel 7 · emulador Android API 36; toques reales del sistema. Cinco propiedades, comparación de offsets nativo/JS, RTL horizontal y CollectionView." />

<Clip name="swiftui-sheet-continuity-ios" caption="Simulador iOS 27: Entrada real: transferencia continua entre panel y contenido, botones y remontaje. UI en inglés; velocidad original." />

<Clip name="swiftui-sheet-continuity-macos" caption="Aplicación nativa macOS: Entrada real: transferencia continua entre panel y contenido, botones y remontaje. UI en inglés; velocidad original." />

<Clip name="horizontal-reorder-web" caption="Chromium en macOS: mouse real muestra commit LTR/RTL, inversión en bordes y cancelación con Escape. UI en inglés." />

## Aceptación con lectores de pantalla nativos {#native-reader-acceptance}

CollectionView comparte ahora la captura/restauración de foco por clave de Core ListView. La corrección se incluye en RC.17; el paquete RC.16 publicado no cambia. La fixture de 200 filas verifica movimiento, inserción, interrupción, foco externo, movimiento reducido y destrucción. Solo cubre el adaptador documentado de una columna.

[Informe](https://github.com/rafaelaugustos/jolt/tree/main/benchmarks/acceptance-closure).

<Clip :autoplay="false" name="collection-focus-voiceover-ios" caption="Simulador iOS 27 con VoiceOver real e interacción XCTest. Foco visible y aserciones de navegación; grabación sin audio. No demuestra comportamiento en dispositivos físicos. Foco por clave de CollectionView durante actualizaciones." />

<Clip :autoplay="false" name="collection-focus-talkback-android" caption="Emulador Android API 36 con TalkBack real e interacción táctil nativa. Foco visible y aserciones de navegación; grabación sin audio. No demuestra comportamiento en dispositivos físicos. Foco por clave de CollectionView durante actualizaciones." />
