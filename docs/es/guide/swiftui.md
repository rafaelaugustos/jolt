# SwiftUI

Candidato en código fuente para iOS 17+ y macOS 14+, sin NativeScript ni JavaScript. Estas APIs amplían las poses finitas; no están en RC.12.1.

Añada el checkout revisado como Swift Package local en Xcode. Tras publicar, seleccione un tag/commit con Package.swift; versiones npm antiguas no incluyen el paquete independiente. Las poses usan interpolación SwiftUI; los valores muestreados usan reloj nativo bajo demanda. Consulte [valores, interacción y composición](./swiftui-motion).

```swift
// Package.swift
.package(path: "../jolt")
// Application target dependencies:
.product(name: "JoltSwiftUI", package: "jolt")
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

createPreset(name, parameters) se comparte entre NativeScript y Web; JoltPreset.recipe usa definiciones generadas. Valida distance, scale, direction y duration. Una duration explícita convierte canales a tweens finitos; cero es inmediato. Los valores por defecto conservan los resortes originales. Copia definiciones sin modificar el registro global. Los 13 nombres portables están en instalación.

`fadeIn`, `fadeInUp`, `fadeInDown`, `fadeInLeft`, `fadeInRight`, `zoomIn`, `popIn`, `fadeOut`, `fadeOutUp`, `fadeOutDown`, `fadeOutLeft`, `fadeOutRight`, `zoomOut`.

<Clip name="swiftui-ios" caption="Aplicación SwiftUI independiente en simulador iPhone 17 Pro / iOS 27.0, con toques XCTest reales: destinos, identidad, remontaje, accesibilidad, segundo plano y navegación. Interfaz en inglés; evidencia de simulador." />

<Clip name="swiftui-macos" caption="Aplicación SwiftUI independiente en este Mac, con clics XCTest reales: destinos, presión, identidad, remontaje, Reducir movimiento y presets. Solo se graba la ventana del demo; no es un benchmark." />

<Clip name="web-preset" caption="Chromium en macOS: ejecución real del preset Web popIn existente. El paquete Swift deriva las mismas definiciones; motores y unidades difieren." />
