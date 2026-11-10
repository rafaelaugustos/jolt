# SwiftUI: valores, interacción y composición

Disponible en **0.1.0-rc.13 (Beta)** para iOS 17+ y macOS 14+, sin NativeScript ni JavaScript. Instale el producto `JoltSwiftUI` desde la etiqueta `v0.1.0-rc.13` del repositorio. Consulte [instalación](./swiftui), [ciclo de vida](./swiftui-motion) e [interacción/geometría](./swiftui-geometry) para los límites.

JoltScope retiene sus recursos. .joltScope(scope) vincula un único límite de vista a la suspensión fuera de pantalla o con la escena inactiva. La pausa manual se conserva al reanudar. El modelo destruye mediante dispose(); reset() vacía un scope reutilizable. Cada recurso tiene un propietario. Bindings y seguidores usan valores prestados: destruir el seguidor no destruye su origen. Conserve propietarios en @StateObject, no en body.

```swift
@MainActor final class CardModel: ObservableObject {
    let scope = JoltScope()
    let x: JoltMotionValue
    init() { x = try! scope.value(0) }
    func move() { try! x.animate(to: 100, transition: .spring(.bouncy)) }
}
struct Card: View {
    @StateObject private var model = CardModel()
    var body: some View {
        Button("Move", action: model.move)
            .joltBind(.x, to: model.x)
            .buttonStyle(JoltPressStyle())
            .joltScope(model.scope)
    }
}
```

JoltMotionValue publica valor muestreado, destino, velocidad y estado en el main actor. animate reemplaza desde la posición/velocidad actuales; set salta y cancela. Una entrada inválida conserva el movimiento anterior. pause/play y suspend/resume son independientes; cancel congela y dispose impide reutilizar. joltBind acepta x/y en puntos, scale/scaleX/scaleY, rotate en grados y opacity 0–1. Un propietario por propiedad, sin otra animación implícita. La preferencia del sistema de movimiento reducido aplica el destino inmediatamente; pase reducedMotion para la política del app. No hay RenderThread independiente ni promesa de inmunidad a bloqueos de JavaScript.

JoltPresence conserva identidad durante la salida, desactiva interacción/accesibilidad y cancela la eliminación pendiente al regresar. active en joltPreset solo elige un extremo. JoltPressStyle mantiene semántica nativa de Button, teclado, desactivación y accesibilidad. joltPointerFollow normaliza coordenadas locales −1…1; úselo en una región sin transformar y anime su hijo. Salida, inactividad y movimiento reducido centran el valor; dispositivos táctiles sin hover permanecen centrados. JoltDragModel limita arrastre y destinos de snap; la primavera de asentamiento puede sobrepasarlos temporalmente. Un nuevo arrastre parte de la posición muestreada. Acciones accesibles ajustan los snaps; pausa, suspensión y destrucción cancelan gestos.

JoltTimeline comparte una suscripción de reloj para tracks finitas: máximo 60 s, 10.000 tracks y 1.024 eventos únicos. No admite solapamientos del mismo valor. sequence usa duraciones calculadas; stagger desplaza inicios. Reemplazar una propiedad cancela el conjunto. Los eventos pueden devolver JoltEffect para adaptar audio, haptic o partículas del app, con pausa, reanudación y limpieza al terminar/cancelar. No adquiere hardware implícitamente. Los eventos con más de 50 ms de retraso se omiten por defecto; catchUp es explícito. Movimiento reducido aplica destinos sin efectos; cancelar suprime eventos futuros, incluso con callbacks reentrantes.

joltSharedLayout usa IDs estables en un Namespace; joltLayout(value:) anima la actualización estructural. No conecta ventanas ni árboles independientes. JoltScrollView observa el desplazamiento nativo real; JoltScrollProgress acepta un rango en puntos. joltScrollLinked mapea poses sin interpolación adicional. Movimiento reducido mantiene transformaciones decorativas en from y la opacidad sigue el progreso. Al desmontar elimina observaciones nativas.

JoltInspector(development:true, capacity:40) es opcional y solo observa en DEBUG. Retenga las observaciones watch; liberarlas desconecta el diagnóstico. JoltInspectorPanel muestra muestras, destinos, estado, recursos y clientes del reloj, con pause/play/cancel. Historial acotado a 1–4096, sin temporizador de sondeo ni medición GPU. En Release no conecta observadores.

createPreset(name, parameters) se comparte entre NativeScript y Web; JoltPreset.recipe usa definiciones generadas. Valida distance, scale, direction y duration. Una duration explícita convierte canales a tweens finitos; cero es inmediato. Los valores por defecto conservan los resortes originales. Copia definiciones sin modificar el registro global. Los 13 nombres portables están en instalación.

```ts
import { createPreset } from '@rafaelaugusto/jolt/web'
const recipe = createPreset('fadeInUp', { distance: 48, duration: 350 })
// runtime.animate(element, recipe.keyframes, recipe.transition)
// NativeScript: import createPreset from '@rafaelaugusto/jolt'.
```

```swift
let recipe = JoltPreset.fadeInUp.recipe(
    try! JoltPresetParameters(distance: 48, duration: 350)
)
JoltPresence(visible, enter: recipe) { Text("Jolt") }
```

Web ya ofrece motionValue, springValue, map, pointerFollow, drag, scrollLinked, sequence, eventos de timeline, sharedLayout e inspector. Los scopes nuevos poseen esos recursos: React useMotion, Angular JoltMotionDirective, Svelte/Solid motion. Consulte [adaptadores](./web-frameworks). Sin otro motor de navegador; igualdad numérica no garantiza píxeles, hilos o rendimiento idénticos.

Validación: fixtures compartidas de resortes/recetas, propiedad/interrupción/eventos/inspector, interacción XCTest real en iOS/macOS y paquetes con SSR/hidratación en Chromium, Firefox y WebKit. CI ejecuta interacción nativa. Las mediciones de hardware y dispositivos físicos siguen separadas.

<Clip name="swiftui-interaction-ios" caption="Simulador iPhone 17 Pro / iOS 27.0: toques XCTest reales, presencia, press, arrastre y movimiento reducido. Sin hover táctil; interfaz en inglés." />

<Clip name="swiftui-interaction-macos" caption="App macOS en este Mac: mouse, hover, arrastre y presencia interrumpida. Solo la ventana; interfaz en inglés." />

<Clip name="swiftui-composition-ios" caption="Simulador iOS 27.0: valores, secuencias/stagger, eventos/cancelación, layout e inspector con XCTest real. Interfaz en inglés." />

<Clip name="swiftui-composition-macos" caption="App macOS: valores, limpieza de eventos, secuencias, layout e inspector; clics reales, sin benchmark de CPU/GPU." />

<Clip name="swiftui-scroll-ios" caption="Simulador iOS 27.0: scroll real cambia progreso/cabecera; movimiento reducido estabiliza transformaciones. Interfaz en inglés." />

<Clip name="swiftui-scroll-macos" caption="App macOS: rueda real y desplazamiento nativo; movimiento reducido mantiene la cabecera estable. Interfaz en inglés." />

<Clip name="web-expansion-react" caption="Chromium en macOS, React DOM: interacción y recursos reales. El mismo contrato se prueba en cuatro frameworks." />

[Movimiento derivado y gráficos retenidos](./swiftui-advanced)
