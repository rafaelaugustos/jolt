# SwiftUI: paneles y geometría medida

Disponible en **0.1.0-rc.13 (Beta)** para iOS 17+ y macOS 14+, sin NativeScript ni JavaScript. Instale el producto `JoltSwiftUI` desde la etiqueta `v0.1.0-rc.13` del repositorio de paquete [`jolt-swift`](https://github.com/rafaelaugustos/jolt-swift). Consulte [instalación](./swiftui), [ciclo de vida](./swiftui-motion) e [interacción/geometría](./swiftui-geometry) para los límites.

## Paneles con posiciones de parada

`JoltSheetModel` controla un resorte finito y 1–32 posiciones únicas: `.points` en (0, 1.000.000], `.fraction` en (0, 1] o `.content`. Unidades: puntos Apple, puntos/segundo; Web usa píxeles CSS. La altura se limita al área útil. La proyección al soltar usa 200 ms y velocidad limitada a ±4.000, conservada en el resorte; los empates favorecen la última posición declarada.

`JoltBottomSheet` mide contenedor/contenido, aporta asa y `JoltScrollView`, desactiva/oculta su fondo de accesibilidad y devuelve el foco mediante `returnFocus`. Es un panel dentro de la aplicación, no una presentación del sistema ni una trampa de foco para toda la ventana. Los controles externos son responsabilidad de la aplicación. No anides otro scroll vertical en su contenido.

```swift
let scope = JoltScope()
let panel = try scope.retain(JoltSheetModel(
    snaps: [.points(230), .fraction(0.85), .content]
))
// Keep the model in @StateObject; restore app focus in returnFocus.
JoltBottomSheet(panel, label: "Details", returnFocus: { openerFocused = true }) {
    Button("Open") { try? panel.open(.points(230)) }
} content: {
    TextField("Note", text: $note)
    Text("Your scrolling content")
}
```

`open`, `snapTo`, `expand`, `collapse` y `dismiss` seleccionan posiciones lógicas, incluso antes del primer layout. Los datos inválidos fallan antes de reemplazar movimiento. `dismissible: false` impide cerrar mediante código o gesto. El arrastre interrumpe el resorte muestreado. El contenido expande antes de desplazarse; al bajar desde el origen del scroll, el panel toma el contacto. Levanta y comienza otro contacto para desplazar tras cambiar de parada. No hay transferencia continua de inercia entre scroll y resorte.

El asa expone acciones accesibles aplicables; macOS admite flechas con foco y Escape. iOS mide la superposición real del teclado inferior relativa al contenedor, sin descontarla dos veces si SwiftUI ya redujo el host. Teclados flotantes no cuentan; no se promete teclado virtual en macOS. Cambiar contenido/host/teclado cancela el contacto y conserva la parada lógica.

La pausa manual sobrevive a suspensión; `cancel` congela. Retirar la vista suspende; conserva el modelo para remontar o usa `JoltScope` para destruirlo. Movimiento reducido asienta cambios programáticos y conserva entrada directa. `dispose` elimina suscripciones e impide nuevas aperturas.

<Clip name="swiftui-panel-ios" caption="Simulador iOS: panel nativo, arrastre, scroll interno, teclado virtual, cierre, movimiento reducido y remontaje. No es dispositivo físico." />

<Clip name="swiftui-panel-macos" caption="macOS nativo: ratón, scroll, escritura, Escape y retorno de foco. Sin teclado virtual ni validación de trackpad." />

## Filas realizadas con altura medida

`measuresRows: true` habilita medición; `rowHeight` fijo sigue disponible. Hasta 1.000 IDs únicos de 1–128 caracteres. La vista realiza todas las filas, reserva 44 puntos para el asa y recorta sobre 10.000; el modelo acepta medidas 24–10.000 y separación 0–100. No hay virtualización. Texto, Dynamic Type y layout actualizan las medidas.

El arrastre conserva el desplazamiento del contacto y compara centros medidos; solo soltar confirma el orden. Cambios mayores de 0,5 punto, viewport, reemplazo, pausa/background o retirada cancelan contacto y scroll de borde sin commit. Código, acciones accesibles y flechas macOS usan el mismo commit por ID. Movimiento reducido elimina la animación de previsualización. `replace` descarta medidas retiradas; filas nuevas usan altura de reserva. `dispose` libera entrada y scroll.

```swift
let order = try scope.retain(JoltReorderModel(
    ["one", "two", "three"], measuresRows: true
) { move in
    // Persist the controlled application order using move.key / move.beforeKey.
})
JoltReorderList(order) { key in
    Text(descriptions[key] ?? key).padding(12)
}
try order.replace(["three", "one", "two"])
```

## Curvas cuadráticas y cúbicas

`JoltPath(from:segments:)` admite líneas y Bézier cuadráticas/cúbicas; conserva el inicializador de polilínea. Coordenadas finitas ±1.000.000, 1–1.024 segmentos, profundidad adaptativa 18, máximo 8.192 vértices, tolerancia geométrica 0,025 punto y comprobaciones de tangente. Exceder el límite produce error. Longitud aproximada; sin importador SVG completo ni morphing arbitrario.

Progreso [0,1], orientación tangente continua con `orient: true`; tangentes degeneradas usan una cuerda cercana y longitud cero queda inmóvil. Coordenadas relativas al centro original. Progreso lineal aproxima velocidad constante; otro easing la cambia. Cancelación, interrupción, pausa y destrucción pertenecen al valor/scope. Movimiento reducido usa el destino sin recorrer. Fixtures comparan longitud, posición y ángulo con el muestreador Q/C TypeScript.

```swift
let path = try JoltPath(from: .init(-125, 40), segments: [
    .quadratic(control: .init(-65, -100), to: .init(0, 0)),
    .cubic(control1: .init(65, 100), control2: .init(70, -100),
           to: .init(125, -40))
])
let progress = try scope.value(0)
// marker.joltPath(path, progress: progress, orient: true)
try progress.animate(to: 1,
    transition: .tween(milliseconds: 2400, ease: .linear),
    reducedMotion: reduceMotion)
// Retarget to 0 to reverse from the sampled position; cancel() freezes it.
```

<Clip name="swiftui-geometry-ios" caption="Simulador iOS: curvas cuadráticas/cúbicas, cancelación/reversa, filas medidas y texto dinámico." />

<Clip name="swiftui-geometry-macos" caption="macOS nativo: curvas, reordenación medida y contenido dinámico." />

## Web existente y validación

React/Angular/Svelte/Solid empaquetados reutilizan `scope.bottomSheet`, `scope.reorder` y `scope.animate(marker, {path: "M… Q… C…", orient: true}, transition)`. El asa Web es un slider enfocable; botones/inputs conservan su interacción. Modalidad, fondo inerte y foco corresponden a la aplicación. Usa `remeasure()` al mover el host respecto al viewport. El teclado depende de VirtualKeyboard/VisualViewport; grabación desktop no valida teclado móvil.

Web reorder conserva observación de tamaño/origen entre arrastres tras FLIP: texto nuevo permite otro arrastre y cambiar altura durante contacto cancela sin commit. Retirada/disposal libera observaciones; continúa la protección de transform. La comparación de centros comparte fixtures Swift.

XCTest valida simulador iOS/macOS nativo; Web usa Chromium, Firefox y WebKit. Sin evidencia de iPhone/trackpad físico ni equivalencia de rendimiento. Mavis ya tiene adaptadores Sheet/reorder; [#234](https://github.com/getcortexlabs/mavis-ui/issues/234), [#237](https://github.com/getcortexlabs/mavis-ui/issues/237) y [#298](https://github.com/getcortexlabs/mavis-ui/issues/298) conservan seguimiento de integración/validación. SwiftUI está incluido en v0.1.0-rc.13.

<Clip name="web-geometry-react" caption="Chromium desktop, consumidor React empaquetado: panel, scroll/foco, curvas y filas variables. Backends Web existentes; sin evidencia de teclado móvil." />

<Clip name="web-geometry-angular" caption="Chromium desktop, consumidor Angular empaquetado: panel, scroll/foco, curvas y filas variables. Backends Web existentes; sin evidencia de teclado móvil." />

<Clip name="web-geometry-svelte" caption="Chromium desktop, consumidor Svelte empaquetado: panel, scroll/foco, curvas y filas variables. Backends Web existentes; sin evidencia de teclado móvil." />

<Clip name="web-geometry-solid" caption="Chromium desktop, consumidor Solid empaquetado: panel, scroll/foco, curvas y filas variables. Backends Web existentes; sin evidencia de teclado móvil." />
