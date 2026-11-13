# Valores combinados, scroll y listas por clave

**Candidato para la próxima RC; no publicado en RC.14.** Cubre #494, #495, #498, #499, #500 y #501. Recompile las aplicaciones nativas. Los vídeos muestran interacción real en simuladores, emulador y navegador; no prueban rendimiento en un dispositivo físico.

## Valores numéricos

```ts
const a = motionValue(0)
const b = motionValue(0)
const x = a.add(b).mul(0.65).clamp(0, 300)
const detach = bind(card, { x })
animate(a, 180, 'snappy')
animate(b, 90, 'smooth')
// Al desmontar: detach(); x.dispose(); a.dispose(); b.dispose()
```

Importe estas funciones de `@rafaelaugusto/jolt`. En Web, use `runtime.motionValue`, `runtime.bind` y `runtime.animate` del mismo runtime; el binding Web se libera con `dispose()`. Los mapeos `.to()` y seguidores existentes se mantienen.

`add`, `sub`, `mul`, `div`, `min` y `max` aceptan otro valor numérico o una constante finita. También hay `abs`, `clamp`, `sin`, `cos` y `velocity`. Los ángulos trigonométricos usan radianes y la velocidad unidades de entrada por segundo. División por cero o resultado no finito produce cero. Empates y extremos limitados tienen velocidad cero; la derivada del nodo de velocidad es cero, sin estimación de aceleración. Los grafos inmutables no admiten ciclos; máximo 32 niveles y 1.024 nodos en el programa nativo. Los colores quedan fuera de esta álgebra.

Las entradas temporales finitas compilan tracks nativas; las entradas vivas usan evaluación nativa. Web comparte muestras en su scheduler. El grafo nativo no ejecuta callbacks arbitrarios por frame. Descartar una salida conserva sus fuentes prestadas; descartar una fuente termina los grafos dependientes. Libere bindings, salidas y fuentes con su propietario. Esto no cambia la thread principal compartida por UI y JavaScript en NativeScript.

<Clip name="values-scroll-ios" caption="Simulador iOS: dos entradas combinadas, interrupción y scroll real conectado a una barra nativa." />
<Clip name="values-scroll-android" caption="Emulador Android: valores combinados y scroll nativo. La auditoría cuenta callbacks de Jolt; Core puede emitir sus propios eventos JavaScript." />
<Clip name="combined-values-web" caption="Chromium: entradas animadas, interrupción y barra conectada al scroll real del navegador." />

## Scroll nativo

```ts
const offset = scrollValue(scrollView, { axis: 'y', execution: 'native' })
const detach = bind(meter, { scaleX: offset.to([0, 500], [0, 1]) })
// detach(); offset.dispose()
```

`execution` acepta `auto`, `native` y `javascript`; el resultado informa el modo elegido. El fallback JavaScript admite Core ScrollView. Forzar nativo sin bridge produce error. `refresh()` actualiza geometría y `ref(next)` cambia la fuente. Unload, background y descarte eliminan observers. `subscribe()` habilita notificaciones explícitas; bindings nativos solos no añaden callbacks Jolt por evento. Core puede seguir emitiendo eventos JavaScript.

Offsets en DIPs Android y puntos iOS. iOS normaliza el inset inicial ajustado y conserva bounce negativo. Android ListView necesita filas fijas y considera divisores; RecyclerView exige layout lineal y stride fijo, sin orden invertido, stack-from-end, secciones o grids. iOS admite subclases UIScrollView, tablas y colecciones. `scrollLinked()` compila keyframes elegibles de transform, opacidad y pintura; las otras propiedades conservan scrub.

Web reutiliza `runtime.scrollValue()` y `scrollLinked()`. Mapeos `.to()` directos, numéricos y limitados con un intervalo no negativo común pueden usar ScrollTimeline. Álgebra, intervalos distintos, falta de soporte y escalas con extremos no positivos usan el scheduler. No se promete igualdad de píxeles, overscroll ni threads.

## Salidas y grupos Vue

```ts
animateLayout(container, () => container.removeChild(card), {
  duration: 500,
  exit: { opacity: 0, y: 16, scale: 0.92 },
})
// Web: runtime.animateLayout(container, () => card.remove(), opciones)
```

La eliminación inmediata sigue siendo el valor predeterminado. `exit` acepta `'fadeOut'`, `false` u objeto con `opacity`, `x`, `y` y `scale` uniforme positivo. La transición finita dirige movimientos y salidas; `finished` espera ambos. `maxSnapshotPixels` limita las copias de una operación: 8 millones por defecto, de 1 a 32 millones. Solo se capturan hijos realmente eliminados durante la mutación/próximo layout, nunca todos los supervivientes.

NativeScript destruye la view nativa al retirarla; usamos copias estáticas sin entrada ni accesibilidad. Interrupción, reinserción, unload, background, movimiento reducido y descarte las eliminan. Contenido no compatible o sobre presupuesto sale inmediatamente. Captura nativa: contenido 2D completamente visible, sin rotación, escala uniforme y ancestros opacos. Vídeo, texturas, WebView y scroll anidado quedan fuera. No se conservan editores vivos ni se transfiere foco a la copia.

Web copia presentación DOM; formularios, custom elements, canvas/vídeo, pseudo-elementos y ancestros rotados/3D no se admiten. Hooks locales cubren `removeChild`, `remove`, sustituciones y cambios de texto/HTML. Métodos de prototipo almacenados o movimientos implícitos a otro padre no se capturan. Sin popovers se elimina inmediatamente. Use mutaciones síncronas e hijos directos.

```vue
<JoltTransitionGroup :enter="true" leave="fadeOut" move="snappy">
  <Label v-for="item in items" :key="item.id" :text="item.title" />
</JoltTransitionGroup>
```

Importe de `/vue` (por defecto `StackLayout`) o `/web/vue` (`div`, runtime prestado opcional). `tag` elige container, `enter` controla fade, `leave` sigue el contrato de salida y `move` configura transición. Desactivación/unmount termina la operación. SwiftUI ya dispone de `ForEach` y transitions; no añadimos otra API de grupos.

<Clip name="layout-exits-ios" caption="Simulador iOS: eliminación, inserción y reordenación simultáneas, interrupción, reinserción y movimiento reducido." />
<Clip name="layout-exits-android" caption="Emulador Android: copias de salida nativas y movimiento de vecinos, cancelación y reinserción." />
<Clip name="layout-exits-web" caption="Chromium: cambios DOM y cancelación, seguidos por el grupo Vue real. Copias inert y aria-hidden." />

## Listas recicladas

```ts
const changes = listChanges(listView, {
  key: (item) => item.id,
  rowHeight: 60,
  exit: 'fadeOut',
  move: 'snappy',
})
changes.update(nextItems)
// scope.add(changes), o changes.dispose() con su propietario
```

Primer adaptador: Core ListView plano, altura fija positiva. `rowHeight` configura DIPs; en su ausencia se lee la altura tras cargar. Actualice una lista cargada con altura resuelta, usando arrays inmutables y claves únicas string/número finito. El diff cubre todos los datos, anima solo filas realizadas visibles y conserva clave/offset interno de la primera visible. Si desaparece, elige el índice restante más cercano. Una actualización interrumpida parte de la presentación actual. Reciclar limpia solo propiedades propias; filas existentes que llegan desde fuera de pantalla no reciben entradas. Secciones, grids, transiciones CollectionView y movimientos entre listas quedan fuera.

`stop()` cancela movimiento manteniendo datos; `pause()` vuelve inmediatas las siguientes actualizaciones hasta `play()`. Unload descarta el controlador nativo: cree otro al cargar. Background y movimiento reducido cancelan decoración. El foco sigue una clave visible superviviente y el camino de descendientes si el template es compatible; elementos eliminados/fuera de pantalla no fuerzan foco.

Web usa `runtime.listChanges(container, { key, scroll, exit, move, adapter })`. El adaptador implementa `items()`, `render(next)` síncrono reteniendo nodos por clave y `rows()` con `{ key, target }`. No virtualiza datos ni renderiza el framework. Un virtualizador declara `virtualized: true`, devuelve filas realizadas, implementa `observeRecycling(recycle)` notificando antes de reutilizar cada elemento y `anchor(keys)` que devuelve la función de restauración de clave/índice y offset. Descarte con el propietario; retirar el container también descarta. No mezcle dos propietarios de layout en las mismas filas.

<Clip name="list-changes-ios" caption="Simulador iOS, 200 filas Core ListView: scroll, inserción conservando posición, eliminación, reverse/filter interrumpidos y movimiento reducido." />
<Clip name="list-changes-android" caption="Emulador Android, 200 filas fijas: reciclaje nativo, cambios por clave e interrupción, con auditoría del scroll." />
<Clip name="list-changes-web" caption="Chromium, 200 filas DOM por clave: inserción por encima del viewport, eliminación, reverse/filter e interrupción. No es un virtualizador." />

## SwiftUI: scroll estructural y encabezados

```swift
let combined = try a.add(b).mul(0.65)
card.joltBind(.x, to: combined)
let controller = try JoltScrollHeaderController(
  geometry: .init(expanded: 180, minimum: 48, section: 32, parallax: 50)
)
```

`JoltComputedValue` comparte clock y participa en `JoltScope`. La fuente de velocidad se llama `velocityValue()` porque `JoltMotionValue.velocity` ya lee un número. SwiftUI sigue invalidando views.

`JoltScrollHeader(controller:artwork:title:toolbar:compactTitle:section:content:)` mantiene spacer, toolbar/sección fijos, cambio de título y parallax. Marque filas `.joltScrollAnchor(id)` antes de `await controller.preserveAnchor { ... }`. `scrollTo`, `scrollToTop` y `remeasure` asíncrono operan sobre el scroll iOS/macOS. Entrada del usuario, pausa y descarte cancelan movimiento programático. Cambios geométricos conservan posición salvo que una operación más reciente tome control.

`JoltScrollProgress.subrange()` crea intervalos independientes prestados; `setRange()` reemplaza límites. `joltScrollLinked(..., role: .structuralTranslation)` conserva x/y bajo movimiento reducido y elimina decoración; `.structuralPose` conserva la pose completa explícitamente. El modo predeterminado `.decorative` suprime decoración espacial. `@Environment(\.joltEffectiveReduceMotion)` expone app o sistema. El encabezado mantiene colapso/fijación, elimina parallax y cambia título en un paso; el scroll permanece disponible.

<Clip name="swiftui-values-scroll-ios" caption="SwiftUI independiente en simulador iOS 27: valores, scroll programático, inserción con ancla, encabezado y movimiento reducido, sin NativeScript." />
<Clip name="swiftui-values-scroll-macos" caption="Aplicación SwiftUI real en macOS: valores, encabezado, ancla y movimiento reducido mediante NSScrollView." />

NativeScript/Web conservan sus controladores `scrollHeader()` existentes. Consulte [validación y límites](https://github.com/rafaelaugustos/jolt/tree/main/benchmarks/values-scroll-lists). La medición física de asignaciones/frame de #494 sigue pendiente; no afirmamos reducción de CPU/PSS ni ventaja frente a Reanimated.

<Clip name="list-changes-playground-web" caption="Chromium, playground real de la documentación: scroll por clave, inserción conservando el ancla, eliminación, inversión e interrupción." />
