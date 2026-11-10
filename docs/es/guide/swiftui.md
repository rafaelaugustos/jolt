# SwiftUI

Disponible en **0.1.0-rc.13 (Beta)** para iOS 17+ y macOS 14+, sin NativeScript ni JavaScript. Instale el producto `JoltSwiftUI` desde la etiqueta `v0.1.0-rc.13` del repositorio. Consulte [instalación](./swiftui), [ciclo de vida](./swiftui-motion) e [interacción/geometría](./swiftui-geometry) para los límites.

Añada el repositorio como Swift Package en Xcode y seleccione la versión exacta `0.1.0-rc.13`. También funciona un checkout local. Las poses finitas usan interpolación SwiftUI; los valores muestreados usan un reloj nativo bajo demanda.

```swift
// Package.swift
.package(url: "https://github.com/rafaelaugustos/jolt.git", exact: "0.1.0-rc.13")
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

[Movimiento derivado y gráficos retenidos](./swiftui-advanced)

[SwiftUI · Keyframes / gestures / characters](./swiftui-characters)
