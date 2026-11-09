# SwiftUI experimental

Use Jolt en una aplicación escrita en Swift, sin JavaScript ni NativeScript. El paquete inicial admite iOS 17+ y macOS 14+, poses finitas dirigidas por estado y 13 presets compartidos. No es todo el motor Jolt; este candidato no está en RC.12.1.

Añada el checkout revisado como Swift Package local en Xcode o use la dependencia y el producto siguientes. Después de publicarlo, fije una etiqueta o commit revisado que incluya Package.swift; los paquetes npm anteriores no lo suministran.

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
    private let target = try! JoltPose(x: 80, scale: 1.08, rotate: 12)
    var body: some View {
        Button("Jolt") { moved.toggle() }
            .padding(24)
            .joltMotion(to: moved ? target : .identity,
                        transition: .spring(.smooth))
    }
}
```

```swift
Text("Jolt").joltPreset(.popIn, active: visible)
Card().joltReduceMotion(true)
```

JoltPose es un destino inmutable y validado: x/y en puntos, scale/scaleX/scaleY sin unidad, rotate en grados y opacity entre 0 y 1. Las entradas inválidas lanzan error antes de cambiar el destino. JoltTransition admite tween en milisegundos, Bézier cúbica validada o muelle con masa, rigidez y amortiguación positivos. Los muelles smooth/snappy/bouncy y cinco curvas básicas proceden de las definiciones existentes de Jolt.

SwiftUI controla interpolación, identidad, interacción, interrupción y eliminación. Asigne otra pose para cambiar el destino. Cambiar identidad crea otra vista; eliminarla termina su vida. Jolt no crea temporizador de frames, scope ni runtime JavaScript. Evite otro propietario de los mismos modificadores. Los cambios en segundo plano no inician animación; esta API no ofrece congelación/reanudación exactas, seek, handles de finalización ni coordinación de presencia durante la salida.

La preferencia del sistema Reducir movimiento siempre se respeta: los nuevos cambios de transformación llegan inmediatamente al destino; la opacidad conserva transiciones finitas. `.joltReduceMotion(true)` solicita esta política para un subárbol sin desactivar la preferencia del sistema. El toggle no es una API general de stop. SwiftUI y navegador pueden diferir en píxeles y tiempos.

`active` elige la pose inicial o final; no inserta ni elimina la vista. Nombres admitidos: fadeIn, fadeInUp, fadeInDown, fadeInLeft, fadeInRight, zoomIn, popIn, fadeOut, fadeOutUp, fadeOutDown, fadeOutLeft, fadeOutRight y zoomOut. Secuencias arbitrarias, gestos, sensores, dibujo, timelines e inspector quedan fuera de este primer subconjunto SwiftUI.

<Clip name="swiftui-ios" caption="Aplicación SwiftUI independiente en simulador iPhone 17 Pro / iOS 27.0, con toques XCTest reales: destinos, identidad, remontaje, accesibilidad, segundo plano y navegación. Interfaz en inglés; evidencia de simulador." />

<Clip name="swiftui-macos" caption="Aplicación SwiftUI independiente en este Mac, con clics XCTest reales: destinos, presión, identidad, remontaje, Reducir movimiento y presets. Solo se graba la ventana del demo; no es un benchmark." />

<Clip name="web-preset" caption="Chromium en macOS: ejecución real del preset Web popIn existente. El paquete Swift deriva las mismas definiciones; motores y unidades difieren." />
