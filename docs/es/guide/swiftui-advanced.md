# SwiftUI: movimiento derivado y gráficos retenidos

Disponible en **0.1.0-rc.13 (Beta)** para iOS 17+ y macOS 14+, sin NativeScript ni JavaScript. Instale el producto `JoltSwiftUI` desde la etiqueta `v0.1.0-rc.13` del repositorio de paquete [`jolt-swift`](https://github.com/rafaelaugustos/jolt-swift). Consulte [instalación](./swiftui), [ciclo de vida](./swiftui-motion) e [interacción/geometría](./swiftui-geometry) para los límites.

JoltNumericMap acepta 2–1024 pares finitos con entradas estrictamente monótonas; invierte entradas descendentes. Clamp es el valor por defecto; clamp:false extrapola extremos. sample devuelve valor y pendiente, usando derivada izquierda en nodos internos. JoltMappedValue toma prestado el escalar y posee su observación: pausa congela, reanudación actualiza y dispose desconecta. Overflow marca valid=false y conserva la última salida finita. Sin reloj adicional. El binding admite x/y, scale/scaleX/scaleY, rotate y opacity; con movimiento reducido mantiene transformaciones decorativas en identidad.

JoltColor almacena bytes sRGB ARGB. mixed(to:progress:) y JoltColorValue interpolan en OKLab premultiplicado con alpha, limitan progreso 0…1 y salida a sRGB. joltColor vincula foreground/background. La fuente posee la animación; destruir el color no destruye la fuente. No garantiza gamut o píxeles idénticos.

```swift
let scope = JoltScope()
let progress = try scope.value(0)
let mapped = try scope.retain(JoltMappedValue(progress,
    mapping: JoltNumericMap([0, 0.5, 1], [-100, 0, 100])))
let color = try scope.retain(JoltColorValue(progress,
    from: .init(argb: 0xff7766ff), to: .init(argb: 0xffdbff7a)))
try progress.animate(to: 1, transition: .tween(milliseconds: 1000))
// Text("Jolt").joltBind(.x, to: mapped).joltColor(.background, to: color)
```

JoltPropertyGroup toma prestados 1–1024 escalares con nombres únicos y un mismo JoltClock. Valida todos los destinos antes de cancelar trabajo anterior y comienza en una timeline. Claves desconocidas, valores no finitos o miembros destruidos fallan sin mutación parcial. Reemplazo, cancelación y suspensión coordinan el conjunto; callbacks antiguos no pisan trabajos nuevos. Permite destinos parciales. Posee playback, no valores. Un coordinador por conjunto de propiedades.

JoltMotionStates almacena destinos con nombre y reemplaza desde posiciones muestreadas. JoltBehaviors añade prioridad, when, blocks, reemplazo opcional a igual prioridad y reposo explícito. Prioridad mayor interrumpe salvo bloqueo; por defecto igual prioridad se rechaza. request devuelve una ejecución con status/cancel(). Una ejecución vieja no cancela la nueva. Finalizar/cancelar restaura rest; stop() no restaura. Pausa y suspensión son independientes. Este subconjunto coordina propiedades finitas, no flujos asíncronos arbitrarios; NativeScript/Web conservan contextos asíncronos más amplios.

```swift
let x = try scope.value(0), scale = try scope.value(1)
let group = try scope.retain(JoltPropertyGroup(["x": x, "scale": scale]))
let actions = try scope.retain(JoltBehaviors(group: group, definitions: [
    "rest": .init(["x": 0, "scale": 1]),
    "pet": .init(["x": -70, "scale": 1.1], priority: 1),
    "dress": .init(["x": 70, "scale": 0.9], priority: 2, blocks: ["eat"]),
    "eat": .init(["x": 0, "scale": 1.2], priority: 3)
], rest: "rest"))
let pet = try actions.request("pet")
try actions.request("dress")
// pet.status == .interrupted
```

JoltTimeline.seek(to:) acepta progreso finito 0…1, pausa y limpia efectos sin disparar eventos cruzados. Playback posterior rearma eventos futuros. Antes de una track retrasada restaura el valor inicial. Una timeline completada admite seek; cancelación/dispose son terminales. autoplay:false permanece pausado tras suspender/reanudar scope. Tiempo en milisegundos, máximo 60 segundos, sin solapar el mismo escalar.

```swift
let scene = try scope.retain(JoltTimeline(
    tracks: [.init(x, to: 100, transition: .tween(milliseconds: 1000))],
    autoplay: false
))
try scene.seek(to: 0.5)
scene.play()
let demand = try scope.retain(JoltRenderActivity(JoltRenderAdapter(
    change: { active in /* renderer.setContinuous(active) */ },
    redraw: { /* renderer.drawCommittedValues() */ }
)))
let observation = try demand.track(scene) // Retain with the model.
```

JoltMotionValue.decay usa velocidad en puntos/segundo y fricción exponencial por milisegundo (0.998). Para en el primer límite, máximo 60 segundos, con interrupción/pausa/suspensión. JoltDragModel(release:.inertia()) usa velocidad real del gesto y exige snaps vacíos; .snap sigue por defecto. El resorte de snap puede sobrepasar límites temporalmente. La captura de velocidad depende de la plataforma.

JoltPath acepta 2–1024 puntos dentro de ±1.000.000, elimina duplicados consecutivos y muestrea una polilínea por longitud. Limita progreso y mantiene continuidad angular. Caminos degenerados quedan en su punto con rotación cero. joltPath vincula posición/orientación a progreso prestado. No incluye parser SVG general ni morph; Web conserva su gramática SVG más amplia. Fixtures compartidas verifican posiciones y tangentes.

El ejemplo de polilínea sigue siendo válido. Para segmentos cuadráticos/cúbicos tipados y sus límites, consulta [geometría medida](./swiftui-geometry).

JoltDrawing retiene hasta 1024 formas y 8192 puntos/unidades geométricas. Paths, rectángulos y elipses usan puntos locales, colores JoltColor y grosor 0…1000. Valida una actualización completa antes de aplicarla. JoltDrawingView usa un Canvas y progreso de trazo prestado; pausar conserva dibujo/relleno. dispose limpia. Primera versión con progreso compartido, sin hit testing por elemento, parser SVG o ajuste viewBox automático. Proporcione etiqueta accesible.

JoltTextPaint valida 2–8 colores, stops ordenados 0…1, ángulo horario y ancho de brillo (0,1]. JoltGradientText mantiene Text real accesible y recorta el brillo en los glifos. La aplicación posee progreso: anime 0→1 o 1→0 y controle pausa/cancelación/dispose por scope. No crea bucle infinito. Movimiento reducido e inactividad ocultan brillo y conservan texto legible. Fuentes/rasterización/saltos de línea son propios de cada plataforma.

JoltViewportEntry observa intersección geométrica real con scroll/ventana nativos. threshold es fracción visible 0…1, con área positiva incluso en cero. once conserva historial; once:false repite al salir/entrar. Desmontar cancela y desconecta observadores; remount puede reutilizar historial. Pausa/suspensión aplazan entrada. Considera ancestros con recorte, no overlays ni oclusión visual. Aplique en una región de entrada sin transformar.

```swift
let route = try JoltPath([.init(20, 80), .init(100, 20), .init(180, 80)])
let drawing = try scope.retain(JoltDrawing([
    .init(.path(route), stroke: .init(argb: 0xffdbff7a), lineWidth: 4)
]))
// JoltDrawingView(drawing, strokeProgress: progress, accessibilityLabel: "Route")
// Image(systemName: "paperplane.fill").joltPath(route, progress: progress, orient: true)
let entry = try scope.retain(JoltViewportEntry(threshold: 0.5, once: false))
// Text("Arrived").joltViewportEnter(entry)
```

JoltRenderActivity agrega playback prestado de escalares/timelines y tokens hold() mediante JoltRenderAdapter. scope() comparte renderer y vida del padre. Conserve las observaciones; destruirlas elimina demanda sin detener playback. change(active) cambia al variar demanda agregada; redraw() recibe valores aplicados, incluyendo frame final/seek. Pausa y suspensión preservan pausa manual. Sin polling ni display link ocioso; límites de 4096 tokens/observaciones y 1024 propietarios. El adaptador controla renderizado real y política de escena.

Web ya ofrece value.to()/scope.map numérico/color, propertyGroup, motionStates, motionBehaviors, seekableTimeline + withTimelineCues, decay/drag release, paths SVG, drawBatch/shape, gradientText, viewportEnter y renderActivity. El setup motion de cuatro frameworks posee recursos existentes. Los handles de transición de estado no exponen reloj para renderActivity.track; use hold explícito acotado o playback compatible. NativeScript/Web mantienen sus contratos publicados.

Validación: fixtures generadas desde TypeScript para números/colores/decay/paths, pruebas deterministas, XCTest real iOS/macOS y consumidor npm en Chromium/Firefox/WebKit. Vídeos de interacción real a velocidad original; no prueban superioridad CPU/PSS ni rendimiento de dispositivo físico.

<Clip name="swiftui-dynamics-ios" caption="Simulador iPhone 17 Pro / iOS 27.0: toques XCTest reales, mapeo/color, grupos, estados, prioridades/reposo y seek/demanda. Interfaz en inglés." />

<Clip name="swiftui-dynamics-macos" caption="App macOS en este Mac: clics reales en las mismas capacidades. Solo la ventana; interfaz en inglés." />

<Clip name="swiftui-graphics-ios" caption="Simulador iOS 27.0: dibujo/path, brillo finito, pausa/reanudación, arrastre inercial y destrucción reales. Interfaz en inglés." />

<Clip name="swiftui-graphics-macos" caption="App macOS: controles/arrastre reales, Canvas retenido, orientación, brillo y limpieza. Interfaz en inglés; sin benchmark." />

<Clip name="swiftui-viewport-ios" caption="Simulador iOS 27.0: scroll real con entrada única/repetida, salida, reentrada y remount. Interfaz en inglés." />

<Clip name="swiftui-viewport-macos" caption="App macOS: rueda real, umbral 50%, once/replay y limpieza. Interfaz en inglés." />

<Clip name="web-advanced-react" caption="Chromium en macOS: componente React real con mapeo/color, grupos, estados/comportamientos, seek/eventos, dibujo, brillo, inercia, viewport y actividad. Interfaz en inglés; backends existentes." />

<Clip name="web-advanced-angular" caption="Chromium en macOS: componente Angular real con mapeo/color, grupos, estados/comportamientos, seek/eventos, dibujo, brillo, inercia, viewport y actividad. Interfaz en inglés; backends existentes." />

<Clip name="web-advanced-svelte" caption="Chromium en macOS: componente Svelte real con mapeo/color, grupos, estados/comportamientos, seek/eventos, dibujo, brillo, inercia, viewport y actividad. Interfaz en inglés; backends existentes." />

<Clip name="web-advanced-solid" caption="Chromium en macOS: componente Solid real con mapeo/color, grupos, estados/comportamientos, seek/eventos, dibujo, brillo, inercia, viewport y actividad. Interfaz en inglés; backends existentes." />

## Brillo, cargadores y revelado circular {#shimmer-loaders-and-circular-reveal}

Añadidos después de `v0.1.0-rc.13`: hasta la próxima etiqueta de `jolt-swift`, estas API solo están disponibles desde el código fuente del repositorio. Duraciones y geometría provienen de la misma definición compartida que usan los adaptadores NativeScript y Web (`src/core/loading.ts`, compilada en `JoltCore` y verificada con fixtures generadas).

JoltShimmer(duration:) recibe un barrido positivo y finito en milisegundos, como máximo 60 000, 1500 por defecto, incluida la entrada y la salida de la banda. joltShimmer pinta la banda de la Web: ángulo CSS de 100°, blanco con opacidad 0, 0,55 y 0 en 15, 50 y 85 %, que se mueve linealmente desde un ancho a la izquierda de la vista hasta un ancho a la derecha. La banda se compone con la vista en un único grupo de composición (`sourceAtop`), así que solo pinta donde el contenido es opaco y se pondera por su alfa: los marcadores translúcidos reciben un barrido más débil. Aplíquelo a un contenedor para barrer todas las formas del esqueleto con una sola banda; varias vistas pueden mostrar el mismo brillo sincronizado. Úselo sobre formas de marcador, no sobre vistas nativas activas, que pasan a dibujarse dentro de ese grupo.

JoltLoader(style:color:size:duration:) dibuja la geometría del cargador NativeScript en iOS. Valores por defecto: `.dots`, `#71717a`, 48 puntos, 1200 ms por ciclo. El tamaño debe estar en (0, 16 384] puntos y la duración en (0, 60 000] milisegundos. JoltLoaderView centra un cuadrado cuyo lado es el menor entre `size` y el espacio ofrecido. Puntos: tres puntos de 0,2 × lado que escalan 0,35 → 1 → 0,35 en 0, 30 y 60 % del ciclo. Barras: cinco barras de 0,12 × lado de ancho y 0,75 × lado de alto, que escalan en vertical con las mismas claves. Anillo: doce puntos de 0,16 × lado que se desvanecen de 1 a 0,2. Las copias empiezan separadas `duration / 5` (puntos, barras) o `duration / 12` (anillo). Sin `accessibilityLabel`, el cargador queda oculto para la accesibilidad; etiquete el control ocupado, por ejemplo "Guardando".

Ambos son JoltResource; reténgalos en un JoltScope. Se suscriben a JoltClock solo mientras al menos una vista los muestra en una escena activa (iOS: la escena está activa; macOS: la ventana anfitriona es visible) con movimiento completo, y mientras no están pausados ni suspendidos. No hay TimelineView ni temporizador ocioso. Salir de la pantalla, una escena inactiva, `pause()` o la suspensión del ámbito mantienen la fase actual; volver a mostrarlos continúa. Con movimiento reducido (el ajuste del sistema o `joltReduceMotion`), la banda del brillo se oculta y las copias del cargador quedan en una pose estática: puntos y barras a tamaño completo, puntos del anillo con opacidad 0,35. `state` informa `running`, `paused`, `suspended`, `idle` o `disposed`. La liberación suelta el reloj, las vistas no dibujan nada y las llamadas posteriores se ignoran; las pruebas comprueban que el `activeCount` del reloj vuelve a cero.

```swift
let scope = JoltScope()
let shimmer = try scope.retain(JoltShimmer())
let saving = try scope.retain(JoltLoader(.ring, size: 28))
let details = try scope.retain(JoltReveal(revealed: false))
// SkeletonRows().joltShimmer(shimmer)
// Text("Save").opacity(busy ? 0 : 1).overlay { if busy { JoltLoaderView(saving) } }
// Details().joltReveal(details)
try details.reveal(from: JoltPoint(40, 40)) { finished in
    // Mueva el foco a los detalles aquí.
}
try details.conceal(to: JoltPoint(40, 40))
```

JoltReveal(revealed:) ejecuta `reveal(from:duration:reducedMotion:completion:)` y `conceal(to:...)` sobre una superficie mostrada con joltReveal. Los orígenes son puntos en el espacio local de la vista desde su esquina superior izquierda, el espacio que informa un gesto de toque `.local`, dentro de ±1 000 000. Sin origen, el círculo se centra en la vista, o conserva el centro del círculo actual al interrumpir. Un revelado crece hasta la esquina más lejana y un ocultado se reduce a cero, con ease-in-out de 0 a 60 000 milisegundos (400 por defecto); cero aplica el estado final de inmediato. Una nueva llamada parte del círculo en pantalla, así que un ocultado puede invertir un revelado a mitad; la llamada reemplazada termina con `false`. Ocultar una superficie ya oculta termina con `true` de inmediato. `cancel()` detiene y restaura la fase previa a la cadena interrumpida. Un cambio de tamaño recalcula la esquina más lejana.

Cuando termina un revelado, se quita el recorte circular: el modificador mantiene un recorte neutro para que el contenido conserve su identidad y su estado, y las sombras o el contenido desbordado dejan de recortarse. Cuando termina un ocultado, la vista queda transparente y conserva su espacio en el diseño. Salir de la pantalla, una escena inactiva, `pause()` y la suspensión mantienen el círculo; volver a mostrarla continúa. Con movimiento reducido, o con `reducedMotion: true`, el estado final se aplica inmediatamente y la finalización informa `true`.

Solo una superficie completamente revelada (`interactive == true`, fase `.revealed`) recibe toques y aparece para la accesibilidad. Mientras se revela, se oculta o está oculta, el contenido queda `accessibilityHidden` y fuera de las pruebas de toque, así que los toques llegan a las vistas de detrás. Jolt nunca mueve el foco: la aplicación mueve el foco de VoiceOver o del teclado al contenido cuando termina el revelado, y fuera de él antes de llamar a `conceal`, por ejemplo con `@AccessibilityFocusState` o `@FocusState`. SwiftUI expone los descendientes ocultos de un contenedor explícito `.accessibilityElement(children: .contain)` (observado en el simulador de iOS 27), así que no envuelva la superficie en uno.

Diferencias entre plataformas: el brillo NativeScript en iOS enmascara el objetivo de modo que el contenido fuera de la banda se atenúa a opacidad 0,35, y la Web pinta su banda sobre toda la caja del elemento; SwiftUI pinta la banda de la Web solo sobre contenido opaco. El cargador de la Web dibuja cajas CSS con proporciones propias (puntos de 20 %, barras de 12 × 65 %, un arco giratorio de 75 %) y un pulso suavizado, guardados en la misma definición compartida; SwiftUI sigue la geometría nativa. NativeScript y Web cancelan un revelado cuando la vista se descarga o se separa; SwiftUI lo mantiene fuera de pantalla. La Web centra en el elemento un revelado que interrumpe sin origen; NativeScript y SwiftUI conservan el centro actual. NativeScript mantiene el área táctil rectangular durante la reproducción; SwiftUI ignora los toques hasta el revelado completo. Estos efectos siguen sin efecto en NativeScript Android.

## Superficies con degradado y desenfoque {#gradient-surfaces-and-blur}

JoltGradient(colors:stops:angle:) pinta un degradado lineal con los límites de la Web: 2–8 colores, una parada por color, paradas constantes en 0...1 y en orden, un ángulo CSS finito en grados (180 por defecto va de arriba abajo, 90 de izquierda a derecha). La línea cruza el centro y es lo bastante larga para que las esquinas reciban el primer y el último color; las bandas quedan perpendiculares al ángulo en puntos, en cajas de cualquier forma. Cada componente es una constante o una fuente prestada: `JoltNumberSource.value(JoltMotionValue)` para las paradas y el ángulo, `JoltColorSource.value(JoltColorValue)` para los colores. Anime el degradado animando esos valores, con sus transiciones, muelles, interrupción, pausa y finalización; el degradado no tiene pistas propias. Las paradas vinculadas se limitan a 0...1 y se mantienen en orden sin reordenar los colores, como la proyección de degradado portable. `update(colors:stops:angle:)` valida todos los componentes antes de sustituir ninguno y conserva el número de colores; cree un degradado nuevo para cambiarlo.

`joltGradient(_:in:)` pinta el degradado detrás de la vista dentro de la forma indicada (`Rectangle()` por defecto); el contenido en sí no se recorta. La pintura no participa en las pruebas de toque y queda oculta para la accesibilidad. `frame` contiene los colores pintados, las paradas proyectadas y el ángulo.

JoltBlur(amount:radius:) tiene el significado de la Web: el radio aplicado es `amount × radius` puntos, con `amount` en 0...1 (una constante, o un valor vinculado limitado a 0...1) y `radius` en 1...64, 24 por defecto. joltBlur aplica `blur(radius:opaque: false)` de SwiftUI a la vista y a sus descendientes, de modo que los bordes se funden en transparencia. El núcleo es de SwiftUI; los píxeles no son idénticos a `filter: blur()` de CSS.

Los degradados y el desenfoque siguen a sus fuentes solo mientras una vista los muestra en una escena activa y no están pausados ni suspendidos. Salir de la pantalla, una escena inactiva, `pause()` o la suspensión mantienen el último fotograma; mostrar o reanudar los pone al día. Ninguno se suscribe a JoltClock; los valores vinculados son dueños de su reproducción. Con movimiento reducido, los ángulos, paradas y cantidades de desenfoque vinculados muestran el objetivo de su motion value, mientras los colores siguen a sus valores. La liberación deja de seguir, quita la pintura de todas las vistas y rechaza actualizaciones posteriores. Las fuentes son prestadas y la pintura nunca las libera.

```swift
let angle = try scope.value(135), stop = try scope.value(0.3), tone = try scope.value(0)
let tint = try scope.retain(JoltColorValue(tone,
    from: .init(argb: 0xff7766ff), to: .init(argb: 0xffff9dce)))
let aurora = try scope.retain(JoltGradient(
    colors: [.constant(.init(argb: 0xff1b1f3a)), .value(tint), .constant(.init(argb: 0xffdbff7a))],
    stops: [0, .value(stop), 1], angle: .value(angle)))
let focus = try scope.value(0)
let soft = try scope.retain(JoltBlur(amount: .value(focus), radius: 24))
// Card().joltGradient(aurora, in: RoundedRectangle(cornerRadius: 22))
// Photo().joltBlur(soft)
try angle.animate(to: 315, transition: .tween(milliseconds: 1600))
try focus.animate(to: 1, transition: .tween(milliseconds: 700))
```

Diferencias entre plataformas: los degradados de la Web y de NativeScript también tienen los tipos radial y cónico, con centro y radio, y sus propios `animate()`, `set()` y `bind()`; SwiftUI ofrece la superficie lineal, guiada por valores vinculados y `update()`. Con movimiento reducido, la Web mantiene la geometría vinculada en lugar de mostrar el objetivo, y NativeScript salta el ángulo al final mientras colores y paradas siguen en transición. El desenfoque de fondo (backdrop) no se ofrece: SwiftUI no tiene un filtro con radio controlado sobre el contenido detrás de una vista, y sus materiales aplican un desenfoque y un tinte definidos por el sistema en lugar de `amount × radius`. Desenfoque una vista de fondo dedicada, como con el desenfoque de contenido de Android. El desenfoque NativeScript en iOS es un material `UIVisualEffectView` en el que 0,5 es la mitad de la transición del material; SwiftUI y la Web usan un radio.

La validación incluye fixtures generadas desde el núcleo TypeScript para la geometría de los cargadores, los desplazamientos del brillo, los radios del revelado, el easing y la proyección de paradas; pruebas deterministas de recursos para la propiedad del reloj, la suspensión, el movimiento reducido, la interrupción y la liberación; pruebas de renderizado para las esquinas del degradado, la máscara alfa del brillo y el recorte del revelado; e interacción XCTest en iOS y macOS.

<Clip name="swiftui-effects-ios" caption="Simulador de iOS, SwiftUI nativo: toques de XCTest barren filas de esqueleto, ejecutan los cargadores de puntos, barras y anillo en botones ocupados, revelan una superficie desde puntos tocados y la ocultan a mitad, barren un degradado vinculado, desenfocan una tarjeta y activan el movimiento reducido. Interfaz en inglés. No es una grabación de un dispositivo físico." />

<Clip name="swiftui-effects-macos" caption="App de macOS, SwiftUI nativo: clics reales manejan el mismo laboratorio de efectos, incluido el revelado interrumpido y el movimiento reducido. Solo la ventana de la app; interfaz en inglés. Sin afirmaciones de rendimiento." />
