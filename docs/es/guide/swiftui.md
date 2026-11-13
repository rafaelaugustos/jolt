# SwiftUI

Disponible en **0.1.0-rc.15 (Beta)** para iOS 17+ y macOS 14+, sin NativeScript ni JavaScript. Instale el producto `JoltSwiftUI` desde la etiqueta `v0.1.0-rc.15` del repositorio de paquete [`jolt-swift`](https://github.com/rafaelaugustos/jolt-swift). Consulte [instalación](./swiftui), [ciclo de vida](./swiftui-motion) e [interacción/geometría](./swiftui-geometry) para los límites.

Añada `https://github.com/rafaelaugustos/jolt-swift` como Swift Package en Xcode y seleccione la versión exacta `0.1.0-rc.15`. Solo contiene el paquete Swift, generado desde el repositorio de Jolt en cada versión, así que SwiftPM no descarga los medios de la documentación ni los resultados de benchmarks. Los proyectos que ya usan `https://github.com/rafaelaugustos/jolt.git` siguen resolviendo las mismas etiquetas de versión, y también funciona un checkout local del repositorio de Jolt. Las poses finitas usan interpolación SwiftUI; los valores muestreados usan un reloj nativo bajo demanda.

```swift
// Package.swift
.package(url: "https://github.com/rafaelaugustos/jolt-swift.git", exact: "0.1.0-rc.15")
// Application target dependencies:
.product(name: "JoltSwiftUI", package: "jolt-swift")
```

```swift
import SwiftUI
import JoltSwiftUI
struct Card: View {
    @State private var moved = false
    var body: some View {
        Button("Jolt") { moved.toggle() }
            .joltMotion(to: moved ? try! JoltPose(x: 80, scale: 1.08) : .identity,
                        transition: .spring(.smooth))
    }
}
```

createPreset(name, parameters) se comparte entre NativeScript y Web; JoltPreset.recipe usa definiciones generadas. Valida distance, scale, direction y duration. Una duration explícita convierte canales a tweens finitos; cero es inmediato. Los valores por defecto conservan los resortes originales. Copia definiciones sin modificar el registro global. Los 15 nombres portables están en instalación.

`fadeIn`, `fadeInUp`, `fadeInDown`, `fadeInLeft`, `fadeInRight`, `zoomIn`, `popIn`, `flipInX`, `flipInY`, `fadeOut`, `fadeOutUp`, `fadeOutDown`, `fadeOutLeft`, `fadeOutRight`, `zoomOut`.

<Clip name="swiftui-ios" caption="Aplicación SwiftUI independiente en simulador iPhone 17 Pro / iOS 27.0, con toques XCTest reales: destinos, identidad, remontaje, accesibilidad, segundo plano y navegación. Interfaz en inglés; evidencia de simulador." />

<Clip name="swiftui-macos" caption="Aplicación SwiftUI independiente en este Mac, con clics XCTest reales: destinos, presión, identidad, remontaje, Reducir movimiento y presets. Solo se graba la ventana del demo; no es un benchmark." />

<Clip name="web-preset" caption="Chromium en macOS: ejecución real del preset Web popIn existente. El paquete Swift deriva las mismas definiciones; motores y unidades difieren." />

## Actividad, suspensión y reloj

Desde **0.1.0-rc.14** ([PR #488](https://github.com/rafaelaugustos/jolt/pull/488)). Cada vista y cada modificador de Jolt leen un único valor de actividad, `joltActive`. En iOS es verdadero mientras la escena está activa. En macOS es verdadero mientras la ventana que aloja la vista está en pantalla: visible, sin minimizar y sin quedar cubierta por completo, tenga o no el foco y esté o no la app al frente. Mientras es falso, el movimiento se detiene y los contactos de entrada se cancelan; ambos se reanudan cuando vuelve. Aplica `joltActivity()` para leer el mismo valor en tus propias vistas:

```swift
struct Status: View {
    @Environment(\.joltActive) private var active
    var body: some View { Text(active ? "En marcha" : "Detenido") }
}
// Container().joltActivity()
```

Medido en macOS 26.6.2 con el laboratorio de actividad del demo (`testActivityExpansion`): una ventana de `WindowGroup` sigue leyendo `scenePhase == .active` mientras otra ventana tiene el foco, y las ventanas alojadas por `NSHostingView` o `NSHostingController` leen `.background` aunque estén visibles. Por eso el Mac ya no sigue la fase de la escena. El movimiento corre en todas ellas, en una escena `Settings` y en una ventana de `MenuBarExtra` (estilo `.window`), y se detiene cuando la ventana se minimiza o queda cubierta por completo por otra. Una vista en un `NSHostingView` fuera de una ventana, o en una ventana que nunca se mostró, no hace avanzar el reloj.

El `JoltClock` compartido mantiene un display link por pantalla que muestra una ventana visible con Jolt. Una ventana en una pantalla de 120 Hz avanza al ritmo de esa pantalla, y una ventana llevada a otra pantalla pasa a seguirla; el demo midió entre 103 y 113 actualizaciones por segundo en la pantalla integrada de 120 Hz y 59 en el simulador de iOS. El link se detiene mientras todas las ventanas con Jolt están ocultas, minimizadas o cubiertas, y antes de alojar cualquier vista Jolt usa la pantalla principal. No había dos pantallas con frecuencias distintas para estas comprobaciones, así que la selección de pantalla solo está cubierta por pruebas unitarias.

`joltPointerFollow` recibe hover solo mientras la app está activa. En una ventana visible de una app que no está al frente se queda centrado, y vuelve a seguir el puntero cuando la app se activa; el movimiento sigue corriendo en esa ventana.

<Clip name="swiftui-activity-macos" caption="macOS 26.6.2, SwiftUI nativo, conducido por XCTest: la ventana principal sigue animando mientras una segunda ventana, ventanas con NSHostingView y NSHostingController, Settings y una ventana de MenuBarExtra reciben el foco; el registro anota cada ventana que se detiene al minimizarse o quedar cubierta y que se reanuda. Solo se graba la ventana principal." />

[Movimiento derivado y gráficos retenidos](./swiftui-advanced)

[SwiftUI · Keyframes / gestures / characters](./swiftui-characters)

[SwiftUI · Entrada de texto y números rodantes](./swiftui-text)
