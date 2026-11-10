# SwiftUI: keyframes, interacción y personajes

Candidato en código para iOS 17+ y macOS 14+, pendiente de merge/publicación en el [PR #436](https://github.com/rafaelaugustos/jolt/pull/436). Estas APIs Swift no están en RC.12.1. Consulte [instalación](./swiftui), [propiedad](./swiftui-motion) y [grupos](./swiftui-advanced). SwiftUI funciona sin NativeScript ni JavaScript; Web reutiliza el runtime público existente.

## Keyframes finitos

JoltTimeline.keyframes compila paradas normalizadas en la timeline existente. El easing de cada parada controla el segmento siguiente. Requiere 2–256 paradas crecientes por canal, de 0 a 1, con valores finitos hasta ±10¹². Admite 1–128 canales distintos del mismo reloj, 1–100 pasadas, 10.000 segmentos expandidos y 60.000 ms en total. iterations:2 con autoreverses:true ejecuta ida y vuelta, invierte la curva y termina en el valor inicial; no hay bucle infinito.

Valida antes de cambiar la propiedad de los valores. Otro escritor interrumpe la timeline; cancel/dispose es terminal. Pause congela el progreso y la suspensión conserva la pausa manual. reducedMotion liquida la última pasada sin reloj activo; pase la preferencia del host, además de la preferencia del sistema observada por el reloj. Web reutiliza animate con x:[-100,100,0], times:[0,0.6,1], ease:["easeIn","easeOut"], duration:1800, repeat:1 y repeatType:"reverse". repeat cuenta pasadas adicionales.

```swift
let scope = JoltScope()
let x = try scope.value(0)
let scene = try scope.retain(JoltTimeline.keyframes([
    .init(x, [try .init(-100, at: 0, ease: .easeIn),
              try .init(100, at: 0.6, ease: .easeOut),
              try .init(0, at: 1)])
], duration: 1800, iterations: 2, autoreverses: true))
scene.pause()
try scene.seek(to: 0.5) // Pauses; no side effects.
scene.play()
// Bind: Capsule().joltBind(.x, to: x)
```

## Gestos compuestos

JoltGestureModel posee x/y, escala uniforme y rotación. joltGestures conecta entrada real y conserva el punto focal al cambiar escala/rotación, con transición entre contactos. Traslación: puntos Apple; rotación: grados; escala: positiva y sin unidad. Use límites x/y finitos y escala en (0,100]. Los límites pueden impedir conservar exactamente el punto focal. El padre debe carecer de transformaciones; ancestros transformados y perspectiva quedan fuera del contrato inicial. En iOS, los recognizers de ventana filtran por el rectángulo de entrada y no detectan oclusión por overlays SwiftUI. Deshabilite la región de gestos cubierta al presentar contenido superpuesto.

En macOS, arrastre/pinza/rotación reconocidos tienen prioridad sobre el gesto del control; los clics normales siguen disponibles. La entrada interrumpe el movimiento desde la posición muestreada. Cancel mantiene la transformación; settle anima un destino validado. Deshabilitar, retirar o pasar a background cancela contactos y suspende movimiento, sin borrar una pausa manual. Incluye acciones accesibles de zoom, giro y reset; los botones visibles son otra alternativa. El vídeo macOS prueba ratón y botones, no trackpad físico. Web reutiliza scope.gestures, contactos de puntero y settleTo, con controles accesibles explícitos.

```swift
let gesture = try scope.retain(JoltGestureModel(
    bounds: .init(x: -100...100, y: -70...70), scale: 0.6...2
))
// card.joltGestures(gesture)
try gesture.settle(to: .init(), reducedMotion: false)
```

<Clip name="swiftui-key-gesture-ios" caption="Simulador iOS, SwiftUI nativo: keyframes, pausa/reanudación, drag/pinch/rotación táctil, reset y movimiento reducido. No es un dispositivo físico." />

<Clip name="swiftui-key-gesture-macos" caption="macOS, SwiftUI nativo: keyframes, arrastre con ratón y botones de zoom/giro. Sin validación de trackpad físico." />

## Reordenación de filas realizadas

JoltReorderModel posee hasta 1.000 IDs string únicos y estables de 1–128 caracteres. JoltReorderList realiza filas verticales de altura fija de 24–500 puntos y separación de 0–100; no virtualiza. Solo el asa inicia arrastre; el contenido conserva el desplazamiento. La vista previa no modifica keys hasta soltar. onMove recibe key, índice final y beforeKey; la aplicación persiste sus datos. replace valida antes de cancelar la entrada. El desplazamiento de borde solo trabaja durante el arrastre activo y se detiene al alcanzar el límite.

Cada fila expone posición y acciones accesibles para subir/bajar; macOS acepta flechas con foco. Movimiento reducido elimina animación de la vista previa sin impedir la operación. Pausa, deshabilitación, background, nuevos datos y descarte cancelan sin commit. Web reutiliza scope.reorder, filas DOM realizadas, teclado y desplazamiento de borde. Sus filas variables no implican virtualización SwiftUI.

```swift
let order = try scope.retain(JoltReorderModel(["one", "two", "three"]) { move in
    // Persist the controlled application order using move.key / move.beforeKey.
})
// JoltReorderList(order) { key in Text(key) }
order.move("one", to: 2)
```

## Zonas de drop

JoltDropZones registra 1–64 destinos, con IDs únicos de 1–64 caracteres, prioridad finita y aceptación síncrona. Gana la prioridad mayor; los empates conservan el orden declarado. El centro incluye bordes; overlap requiere área positiva. Usa rectángulos reales en coordenadas globales compartidas. Es drop dentro de la app, sin importar archivos ni drag del sistema. El rechazo vuelve por muelle al origen, inmediatamente con movimiento reducido. request(id) ofrece una alternativa accesible sin superposición, pero requiere un destino montado.

La siguiente interacción, retirada del destino, pausa/background o descarte destruye el efecto aceptado. Los callbacks pueden cancelar o reemplazar la operación sin que una limpieza antigua sobrescriba la nueva. Coordenadas y dimensiones: hasta ±1.000.000 puntos, con dimensiones positivas. No aplique otra traslación mientras el controlador posee el origen. Web reutiliza scope.dropZones y la política común de prioridad, aceptación y efectos; drop no aporta el desplazamiento de borde de reorder.

```swift
let zones = try scope.retain(JoltDropZones([
    .init("basket", label: "Basket"),
    .init("locked", label: "Locked shelf", priority: 10, accepts: { false })
], onDrop: { event in
    // Apply app data; return an optional owned effect.
    JoltEffect { /* cancel that effect */ }
}))
// source.joltDropSource(zones)
// basket.joltDropTarget("basket", in: zones)
try zones.request("basket")
zones.cancel()
```

<Clip name="swiftui-transfer-ios" caption="Simulador iOS, SwiftUI nativo: drops aceptados/rechazados, retorno/limpieza, reordenación y desplazamiento de borde en 12 filas realizadas." />

<Clip name="swiftui-transfer-macos" caption="macOS, SwiftUI nativo: ratón, botones accesibles, reordenación por asa y desplazamiento de borde. Sin virtualización." />

## Partículas finitas

JoltParticles es un Canvas opcional: 1–2.000 partículas vivas, 1–32 colores, vida de 1–60.000 ms y tamaño de 1–128 puntos. burst y emit finito reemplazan la emisión actual. Tasa máxima: 1.000/s; emisión más vida: 60 s. Una población excesiva se rechaza antes de reemplazar. Velocidad/variación: 0–10.000 puntos/s; gravedad: ±10.000 puntos/s²; giro: ±3.600 grados/s; variación del giro: 0–3.600. Formas: círculo, rectángulo o anillo; origen: centro, arriba o abajo. La semilla permite repetir pruebas, sin prometer la misma secuencia aleatoria Web.

No hay reloj antes de emitir ni después de completar/cancelar/descartar. Pause congela edades; resize cambia nacimientos nuevos y conserva los existentes. Frames tardíos omiten nacimientos ya expirados. Movimiento reducido del sistema o la view suprime partículas y termina la emisión activa. Canvas es decorativo, no intercepta entrada y está oculto de accesibilidad: conserve mensajes semánticos de éxito/error. Devuelva JoltEffect { particles.cancel() } desde un evento de timeline para reutilizar un emisor prestado. La timeline debe durar lo suficiente y su finalización también limpia efectos. Web reutiliza particles/confetti y la ecuación balística, con límites y aleatoriedad propios.

```swift
let particles = try scope.retain(JoltParticles(.confetti))
// JoltParticlesView(particles).frame(width: 320, height: 330)
try particles.burst(count: 100, seed: 7)
particles.pause()
particles.play()
particles.cancel()
```

## Personajes articulados

JoltRigDefinition valida 1–64 partes, padres sin ciclos, hasta 128 poses y 256 sockets. Dimensiones fijas: (0,10.000] puntos; pivotes fraccionarios hasta ±10; canales x/y/scaleX/scaleY/rotate y límites opcionales de giro. Traslación/rotación: ±1.000.000; escala: ±100, incluido el exceso del muelle. Las poses dan destinos absolutos. La mezcla pondera desviaciones del reposo y divide por max(1,pesoTotal) por canal; usa el recorrido angular corto en articulaciones sin límites. Partes desconocidas, ciclos, pesos no finitos y matrices inválidas se rechazan antes de cambiar la animación.

JoltRigView dibuja símbolos SwiftUI en un Canvas. Sitúe accesorios en el mismo contenedor sin transformar; sockets recorren toda la jerarquía. El rig posee canales/playback, las vistas accesorias son prestadas. Pause conserva la pose; movimiento reducido liquida el destino; el scope elimina observaciones y trabajo de reloj. Incluya una etiqueta accesible significativa y controles semánticos separados. No incluye hit test por parte, cinemática inversa, deformación de malla ni física. Web reutiliza rig2d y jerarquía DOM: los accesorios deben ser hijos directos de la parte del socket, a diferencia de los hermanos en SwiftUI.

```swift
let rig = try scope.retain(JoltRig(.init(
    parts: ["arm": .init(width: 95, height: 28, pivotX: 0, rotation: -90...30)],
    poses: ["rest": [:], "wave": ["arm": .init([.rotate: -65])]],
    sockets: ["hand": .init(part: "arm", x: 0.95, y: 0.5, relative: true)]
)))
try rig.pose("wave")
try rig.blend([.init("wave", weight: 0.5)])
// JoltRigView(rig, accessibilityLabel: "Companion") { name in ... }
// flower.joltRigSocket("hand", in: rig)
```

<Clip name="swiftui-character-ios" caption="Simulador iOS, SwiftUI nativo: poses ponderadas, flor en socket, confeti de timeline, cancelación y movimiento reducido. Sin afirmaciones de rendimiento físico." />

<Clip name="swiftui-character-macos" caption="macOS, SwiftUI nativo: poses articuladas y el mismo ciclo de vida de sockets/efectos, capturado en la ventana nativa." />

## Web

Los consumidores empaquetados React, Angular, Svelte y Solid usan APIs Web existentes bajo el scope de cada framework. Las grabaciones muestran ratón/teclado reales, poses y Canvas. Chromium/Firefox/WebKit verifican comportamiento y limpieza al desmontar. No son grabaciones NativeScript ni de pantalla táctil física; no prometen igualdad de píxeles, tiempos, memoria o CPU.

<Clip name="web-characters-react" caption="React · Chromium: keyframes, ratón/teclado reales, sockets y partículas coordinadas en un consumidor empaquetado." />

<Clip name="web-characters-angular" caption="Angular · Chromium: keyframes, ratón/teclado reales, sockets y partículas coordinadas en un consumidor empaquetado." />

<Clip name="web-characters-svelte" caption="Svelte · Chromium: keyframes, ratón/teclado reales, sockets y partículas coordinadas en un consumidor empaquetado." />

<Clip name="web-characters-solid" caption="Solid · Chromium: keyframes, ratón/teclado reales, sockets y partículas coordinadas en un consumidor empaquetado." />
