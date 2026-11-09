# SwiftUI: valores, interação e composição

Candidato em código-fonte para iOS 17+ e macOS 14+, sem NativeScript ou JavaScript. Estas APIs ampliam os modificadores de pose; ainda não estão na RC.12.1. [Instalação](./swiftui).

JoltScope retém os recursos que possui. Aplique .joltScope(scope) em um único limite de view para suspender fora da tela ou com a cena inativa e retomar depois. A suspensão preserva a pausa manual. O modelo controla a destruição: dispose() destrói os recursos; reset() limpa e permite reutilizar o scope. Cada recurso tem um proprietário. Bindings e seguidores apenas usam valores emprestados: destruir um seguidor não destrói a origem. Mantenha os proprietários em @StateObject, nunca dentro de body.

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

JoltMotionValue publica valor amostrado, destino, velocidade e estado no main actor. animate substitui a partir da posição e velocidade atuais; set salta e cancela. Destinos inválidos preservam a animação anterior. pause/play e suspend/resume são independentes; cancel congela e dispose impede reutilização. joltBind aceita x/y em pontos, scale/scaleX/scaleY, rotate em graus e opacity de 0 a 1. Use um proprietário por propriedade, sem outra interpolação implícita. A preferência do sistema por movimento reduzido encerra movimentos imperativos no destino; passe reducedMotion também para a política do app. Isso não introduz RenderThread independente nem promete resistir a bloqueios de JavaScript.

JoltPresence mantém a identidade durante a saída, desativa interação/acessibilidade e cancela a remoção antiga quando há reentrada. Mantenha a mesma identidade; active em joltPreset apenas escolhe um extremo. JoltPressStyle usa ButtonStyle nativo e preserva teclado, desabilitação e ações acessíveis. joltPointerFollow normaliza coordenadas locais em −1…1: aplique na região sem transformação e anime o filho. Saída do ponteiro, inatividade e movimento reduzido centralizam o valor. Dispositivos apenas com toque permanecem centralizados. JoltDragModel limita o arraste e os destinos de snap em pontos; a mola de assentamento pode ultrapassar o limite temporariamente. Um novo arraste parte da posição amostrada. Ações acessíveis ajustam entre snaps; pausa, suspensão da cena e destruição cancelam gestos ativos.

JoltTimeline usa uma assinatura de relógio para tracks finitas: até 60 s, 10.000 tracks e 1.024 eventos nomeados únicos. Tracks do mesmo valor não podem se sobrepor. sequence usa durações calculadas; stagger desloca os inícios. Substituir uma propriedade cancela o conjunto. Um evento pode retornar JoltEffect para adaptar som, haptic ou partículas do aplicativo, com pausa, retomada e limpeza ao terminar/cancelar. Nenhum dispositivo de áudio ou haptic é adquirido implicitamente. Por padrão, eventos atrasados mais de 50 ms são ignorados; catchUp é explícito. Movimento reduzido aplica os destinos sem efeitos. Cancelar suprime eventos posteriores, inclusive em callbacks reentrantes.

joltSharedLayout usa IDs estáveis em um Namespace do SwiftUI; joltLayout(value:) anima a alteração estrutural. Não conecta janelas ou árvores independentes. JoltScrollView lê o deslocamento real do scroll nativo; JoltScrollProgress pode definir uma faixa em pontos. joltScrollLinked mapeia poses sem segunda interpolação. Com movimento reduzido, transformações decorativas ficam em from e a opacidade acompanha o progresso. As observações nativas são removidas ao desmontar.

JoltInspector(development:true, capacity:40) é opcional e só observa em DEBUG. Retenha as observações de watch; liberá-las remove o diagnóstico. JoltInspectorPanel mostra valores amostrados, destinos, estado, recursos e clientes do relógio, com pause/play/cancel. O histórico tem limite de 1–4096; não há timer de consulta nem medição da apresentação na GPU. Builds Release não conectam observadores.

createPreset(name, parameters) é compartilhado por NativeScript e Web. JoltPreset.recipe usa definições geradas no Apple. distance, scale, direction e duration são validados; duration explícita converte canais em tweens finitos, com zero imediato. Os padrões preservam as molas originais. As definições são copiadas e não alteram o registro global. Os 13 nomes portáveis estão no guia de instalação.

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

A Web já oferece motionValue, springValue, map, pointerFollow, drag, scrollLinked, sequence, eventos de timeline, sharedLayout e inspector. Os novos scopes dos frameworks possuem esses recursos existentes: useMotion no React, JoltMotionDirective no Angular e motion no Svelte/Solid. Veja [adaptadores](./web-frameworks). Não há outro motor no navegador. Conformidade numérica não significa pixels, threads ou desempenho idênticos.

Validação: fixtures geradas de molas/receitas; testes de propriedade, interrupção, eventos e inspector; cliques, arrastes e scroll reais via XCTest no iOS/macOS; pacote instalado com SSR/hidratação e interação em Chromium, Firefox e WebKit. O CI executa a interação nativa. Desempenho em hardware e validação em aparelho físico continuam separados.

<Clip name="swiftui-interaction-ios" caption="Simulador iPhone 17 Pro / iOS 27.0: toques reais via XCTest mostram presença, press, arraste limitado e movimento reduzido. Ponteiro centralizado no dispositivo de toque; interface em inglês." />

<Clip name="swiftui-interaction-macos" caption="Aplicativo macOS neste Mac: mouse, hover, arraste, interrupção da presença e snaps reais. Apenas a janela do app; interface em inglês." />

<Clip name="swiftui-composition-ios" caption="Simulador iOS 27.0: molas amostradas, interrupção, sequências, stagger, eventos/cancelamento, layout compartilhado e inspector. Interação real via XCTest; interface em inglês." />

<Clip name="swiftui-composition-macos" caption="Aplicativo macOS: valores, limpeza de eventos, sequências/stagger, layout e inspector. Cliques reais; não é benchmark de CPU/GPU." />

<Clip name="swiftui-scroll-ios" caption="Simulador iOS 27.0: scroll real altera o progresso/cabeçalho; movimento reduzido remove as transformações decorativas. Interface em inglês." />

<Clip name="swiftui-scroll-macos" caption="Aplicativo macOS: roda do mouse e leitura nativa do deslocamento; movimento reduzido mantém o cabeçalho estável. Interface em inglês." />

<Clip name="web-expansion-react" caption="Chromium no macOS, React DOM: ponteiro, arraste, presença, valores, eventos, layout e scroll reais. O mesmo contrato é testado nos quatro frameworks." />

[Movimento derivado e gráficos retidos](./swiftui-advanced)
