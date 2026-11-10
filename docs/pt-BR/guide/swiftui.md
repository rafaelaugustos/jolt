# SwiftUI

Disponível na **0.1.0-rc.13 (Beta)** para iOS 17+ e macOS 14+, sem NativeScript ou JavaScript. Instale o produto `JoltSwiftUI` pela tag `v0.1.0-rc.13` do repositório de pacote [`jolt-swift`](https://github.com/rafaelaugustos/jolt-swift). Consulte [instalação](./swiftui), [ciclo de vida](./swiftui-motion) e [interação/geometria](./swiftui-geometry) para os limites.

Adicione `https://github.com/rafaelaugustos/jolt-swift` como Swift Package no Xcode e selecione a versão exata `0.1.0-rc.13`. Ele contém só o pacote Swift, gerado a partir do repositório do Jolt a cada release, então o SwiftPM não baixa as mídias da documentação nem os resultados de benchmark. Projetos que já usam `https://github.com/rafaelaugustos/jolt.git` continuam resolvendo `0.1.0-rc.13`, e um checkout local do repositório do Jolt também funciona. Poses finitas usam interpolação SwiftUI; valores amostrados usam um relógio nativo ativado sob demanda.

```swift
// Package.swift
.package(url: "https://github.com/rafaelaugustos/jolt-swift.git", exact: "0.1.0-rc.13")
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

createPreset(name, parameters) é compartilhado por NativeScript e Web. JoltPreset.recipe usa definições geradas no Apple. distance, scale, direction e duration são validados; duration explícita converte canais em tweens finitos, com zero imediato. Os padrões preservam as molas originais. As definições são copiadas e não alteram o registro global. Os 13 nomes portáveis estão no guia de instalação.

`fadeIn`, `fadeInUp`, `fadeInDown`, `fadeInLeft`, `fadeInRight`, `zoomIn`, `popIn`, `fadeOut`, `fadeOutUp`, `fadeOutDown`, `fadeOutLeft`, `fadeOutRight`, `zoomOut`.

<Clip name="swiftui-ios" caption="App SwiftUI independente no simulador iPhone 17 Pro / iOS 27.0, com toques XCTest reais: destinos, identidade, remontagem, acessibilidade, background e navegação. Interface em inglês; evidência de simulador." />

<Clip name="swiftui-macos" caption="App SwiftUI independente neste Mac, com cliques reais pelo XCTest: destinos, pressão, troca de identidade, remontagem, Reduzir Movimento e presets. Gravação somente da janela do demo; sem benchmark." />

<Clip name="web-preset" caption="Chromium no macOS: a receita Web popIn existente em execução real. O Swift Package deriva as mesmas definições; os motores de renderização e as unidades diferem." />

[Movimento derivado e gráficos retidos](./swiftui-advanced)

[SwiftUI · Keyframes / gestures / characters](./swiftui-characters)
