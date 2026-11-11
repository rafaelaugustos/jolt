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

## Atividade, suspensão e relógio

Toda view e todo modificador da Jolt leem um único valor de atividade, `joltActive`. No iOS ele é verdadeiro enquanto a cena está ativa. No macOS ele é verdadeiro enquanto a janela que hospeda a view está na tela: visível, não minimizada e não totalmente coberta, esteja ela em foco ou não e esteja o app na frente ou não. Enquanto ele é falso, o movimento fica parado e os contatos de entrada são cancelados; os dois retomam quando ele volta. Aplique `joltActivity()` para ler o mesmo valor nas suas próprias views:

```swift
struct Status: View {
    @Environment(\.joltActive) private var active
    var body: some View { Text(active ? "Rodando" : "Parado") }
}
// Container().joltActivity()
```

Medido no macOS 26.6.2 com o lab de atividade do demo (`testActivityExpansion`): uma janela de `WindowGroup` continua lendo `scenePhase == .active` enquanto outra janela está em foco, e janelas hospedadas por `NSHostingView` ou `NSHostingController` leem `.background` mesmo visíveis. Por isso o Mac deixou de seguir a fase da cena. O movimento roda em todas elas, numa cena `Settings` e numa janela de `MenuBarExtra` (estilo `.window`), e fica parado quando a janela é minimizada ou totalmente coberta por outra. Uma view num `NSHostingView` fora de janela, ou numa janela que nunca foi mostrada, não move o relógio.

O `JoltClock` compartilhado mantém um display link por tela que mostra uma janela visível com Jolt. Uma janela numa tela de 120 Hz avança no ritmo dessa tela, e uma janela levada para outra tela passa a seguir a nova; o demo mediu de 103 a 113 atualizações por segundo na tela embutida de 120 Hz e 59 no simulador iOS. O link para enquanto todas as janelas com Jolt estão ocultas, minimizadas ou cobertas, e antes de qualquer view Jolt ser hospedada ele usa a tela principal. Não havia duas telas com taxas diferentes para estas verificações, então a escolha de tela é coberta só por testes unitários.

`joltPointerFollow` recebe hover só enquanto o app está ativo. Numa janela visível de um app que não está na frente, ele fica centralizado e volta a seguir o ponteiro quando o app é ativado; o movimento continua rodando nessa janela.

<Clip name="swiftui-activity-macos" caption="macOS 26.6.2, SwiftUI nativo, conduzido pelo XCTest: a janela principal continua animando enquanto uma segunda janela, janelas com NSHostingView e NSHostingController, Settings e uma janela de MenuBarExtra recebem o foco; o log registra cada janela parando ao ser minimizada ou coberta e retomando. Só a janela principal é gravada." />

[Movimento derivado e gráficos retidos](./swiftui-advanced)

[SwiftUI · Keyframes / gestures / characters](./swiftui-characters)

[SwiftUI · Entrada de texto e números rolantes](./swiftui-text)
