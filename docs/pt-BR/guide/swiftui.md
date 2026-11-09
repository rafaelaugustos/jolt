# SwiftUI

Candidato em código-fonte para iOS 17+ e macOS 14+, sem NativeScript ou JavaScript. Estas APIs ampliam os modificadores de pose; ainda não estão na RC.12.1.

Adicione o checkout revisado como Swift Package local no Xcode. Após a publicação, selecione tag/commit revisado com Package.swift; versões npm antigas não fornecem o pacote independente. Poses finitas usam interpolação do SwiftUI; valores amostrados usam relógio nativo ativado sob demanda. Veja [valores, interação e composição](./swiftui-motion) para propriedade e limites.

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

createPreset(name, parameters) é compartilhado por NativeScript e Web. JoltPreset.recipe usa definições geradas no Apple. distance, scale, direction e duration são validados; duration explícita converte canais em tweens finitos, com zero imediato. Os padrões preservam as molas originais. As definições são copiadas e não alteram o registro global. Os 13 nomes portáveis estão no guia de instalação.

`fadeIn`, `fadeInUp`, `fadeInDown`, `fadeInLeft`, `fadeInRight`, `zoomIn`, `popIn`, `fadeOut`, `fadeOutUp`, `fadeOutDown`, `fadeOutLeft`, `fadeOutRight`, `zoomOut`.

<Clip name="swiftui-ios" caption="App SwiftUI independente no simulador iPhone 17 Pro / iOS 27.0, com toques XCTest reais: destinos, identidade, remontagem, acessibilidade, background e navegação. Interface em inglês; evidência de simulador." />

<Clip name="swiftui-macos" caption="App SwiftUI independente neste Mac, com cliques reais pelo XCTest: destinos, pressão, troca de identidade, remontagem, Reduzir Movimento e presets. Gravação somente da janela do demo; sem benchmark." />

<Clip name="web-preset" caption="Chromium no macOS: a receita Web popIn existente em execução real. O Swift Package deriva as mesmas definições; os motores de renderização e as unidades diferem." />

[Movimento derivado e gráficos retidos](./swiftui-advanced)
