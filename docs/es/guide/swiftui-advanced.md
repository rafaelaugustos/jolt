# SwiftUI: movimiento derivado y gráficos retenidos

Disponible en **0.1.0-rc.13 (Beta)** para iOS 17+ y macOS 14+, sin NativeScript ni JavaScript. Instale el producto `JoltSwiftUI` desde la etiqueta `v0.1.0-rc.13` del repositorio. Consulte [instalación](./swiftui), [ciclo de vida](./swiftui-motion) e [interacción/geometría](./swiftui-geometry) para los límites.

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
