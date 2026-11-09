# SwiftUI experimental

Use Jolt em um app escrito em Swift, sem JavaScript ou NativeScript. O Swift Package inicial atende iOS 17+ e macOS 14+, com poses finitas dirigidas por estado e 13 presets compartilhados. Ainda não é o motor Jolt completo; este código candidato não está na RC.12.1.

Adicione o checkout revisado como Swift Package local no Xcode ou use a dependência e o produto abaixo. Após a publicação, fixe uma tag ou commit revisado que contenha Package.swift; versões npm anteriores não fornecem esse pacote.

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

JoltPose é um destino imutável e validado: x/y em pontos, scale/scaleX/scaleY sem unidade, rotate em graus e opacity de 0 a 1. Entradas inválidas lançam erro antes de trocar o destino. JoltTransition aceita tween em milissegundos, curva Bézier cúbica validada ou mola com massa, rigidez e amortecimento positivos. As molas smooth/snappy/bouncy e cinco curvas básicas são geradas das definições existentes do Jolt.

SwiftUI controla interpolação, identidade, área de interação, interrupção e remoção. Atribua outra pose para mudar o destino da view existente. Trocar a identidade cria uma nova view; remover a view encerra sua vida. Jolt não cria timer de frames, scope ou runtime JavaScript nessa integração. Evite um segundo dono dos mesmos modificadores. Mudanças em background não iniciam animação; esta API não oferece congelamento/retomada exatos, seek, handles de conclusão ou coordenação de presença durante a saída.

A preferência Reduzir Movimento do sistema sempre é respeitada: novas mudanças de transformação chegam imediatamente ao destino; a opacidade mantém sua transição finita. `.joltReduceMotion(true)` pede essa política para uma subárvore e não desativa a preferência do sistema. Alterar o toggle não é uma API geral de stop. SwiftUI e navegador podem produzir pixels e tempos diferentes.

`active` seleciona a pose inicial ou final; não insere nem remove a view. Nomes suportados: fadeIn, fadeInUp, fadeInDown, fadeInLeft, fadeInRight, zoomIn, popIn, fadeOut, fadeOutUp, fadeOutDown, fadeOutLeft, fadeOutRight e zoomOut. Sequências arbitrárias de keyframes, gestos, sensores, desenho, timelines e controles do inspector ficam fora deste primeiro recorte SwiftUI.

<Clip name="swiftui-ios" caption="App SwiftUI independente no simulador iPhone 17 Pro / iOS 27.0, com toques XCTest reais: destinos, identidade, remontagem, acessibilidade, background e navegação. Interface em inglês; evidência de simulador." />

<Clip name="swiftui-macos" caption="App SwiftUI independente neste Mac, com cliques reais pelo XCTest: destinos, pressão, troca de identidade, remontagem, Reduzir Movimento e presets. Gravação somente da janela do demo; sem benchmark." />

<Clip name="web-preset" caption="Chromium no macOS: a receita Web popIn existente em execução real. O Swift Package deriva as mesmas definições; os motores de renderização e as unidades diferem." />
