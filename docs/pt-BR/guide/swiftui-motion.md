# SwiftUI: valores, interação e composição

Disponível na **0.1.0-rc.13 (Beta)** para iOS 17+ e macOS 14+, sem NativeScript ou JavaScript. Instale o produto `JoltSwiftUI` pela tag `v0.1.0-rc.13` do repositório de pacote [`jolt-swift`](https://github.com/rafaelaugustos/jolt-swift). Consulte [instalação](./swiftui), [ciclo de vida](./swiftui-motion) e [interação/geometria](./swiftui-geometry) para os limites.

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

JoltMotionValue publica valor amostrado, destino, velocidade e estado no main actor. animate substitui a partir da posição e velocidade atuais; set salta e cancela. Destinos inválidos preservam a animação anterior. pause/play e suspend/resume são independentes; cancel congela e dispose impede reutilização. joltBind aceita x/y em pontos, scale/scaleX/scaleY, rotate/rotateX/rotateY em graus e opacity de 0 a 1. Use um proprietário por propriedade, sem outra interpolação implícita. A preferência do sistema por movimento reduzido encerra movimentos imperativos no destino; passe reducedMotion também para a política do app. Isso não introduz RenderThread independente nem promete resistir a bloqueios de JavaScript.

JoltPresence mantém a identidade durante a saída, desativa interação/acessibilidade e cancela a remoção antiga quando há reentrada. Mantenha a mesma identidade; active em joltPreset apenas escolhe um extremo. JoltPressStyle usa ButtonStyle nativo e preserva teclado, desabilitação e ações acessíveis. joltPointerFollow normaliza coordenadas locais em −1…1: aplique na região sem transformação e anime o filho. Saída do ponteiro, inatividade e movimento reduzido centralizam o valor. Dispositivos apenas com toque permanecem centralizados. JoltDragModel limita o arraste e os destinos de snap em pontos; a mola de assentamento pode ultrapassar o limite temporariamente. Um novo arraste parte da posição amostrada. Ações acessíveis ajustam entre snaps; pausa, suspensão da cena e destruição cancelam gestos ativos.

Apenas no código-fonte, fora do 0.1.0-rc.13: joltPointerFollow também informa a amostra central inativa para uma view desabilitada e para posições fora dos limites locais, como NativeScript e Web; antes ele as limitava à borda e as mantinha ativas. O modificador não tem flag `available` e não distingue um acessório desconectado do fim de um hover.

JoltTimeline usa uma assinatura de relógio para tracks finitas: até 60 s, 10.000 tracks e 1.024 eventos nomeados únicos. Tracks do mesmo valor não podem se sobrepor. sequence usa durações calculadas; stagger desloca os inícios. Substituir uma propriedade cancela o conjunto. Um evento pode retornar JoltEffect para adaptar som, haptic ou partículas do aplicativo, com pausa, retomada e limpeza ao terminar/cancelar. Nenhum dispositivo de áudio ou haptic é adquirido implicitamente. Por padrão, eventos atrasados mais de 50 ms são ignorados; catchUp é explícito. Movimento reduzido aplica os destinos sem efeitos. Cancelar suprime eventos posteriores, inclusive em callbacks reentrantes.

joltSharedLayout usa IDs estáveis em um Namespace do SwiftUI; joltLayout(value:) anima a alteração estrutural. Não conecta janelas ou árvores independentes. JoltScrollView lê o deslocamento real do scroll nativo; JoltScrollProgress pode definir uma faixa em pontos. joltScrollLinked mapeia poses sem segunda interpolação. Ele compõe na ordem compartilhada (scale, rotateX, rotateY, rotate e por fim a translação), como joltMotion e a Web; até a 0.1.0-rc.13 ele transladava antes de escalar, então uma pose com as duas coisas se movia translação × escala. Com movimento reduzido, transformações decorativas ficam em from e a opacidade acompanha o progresso. As observações nativas são removidas ao desmontar.

JoltInspector(development:true, capacity:40) é opcional e só observa em DEBUG. Retenha as observações de watch; liberá-las remove o diagnóstico. JoltInspectorPanel mostra valores amostrados, destinos, estado, recursos e clientes do relógio, com pause/play/cancel. O histórico tem limite de 1–4096; não há timer de consulta nem medição da apresentação na GPU. Builds Release não conectam observadores.

createPreset(name, parameters) é compartilhado por NativeScript e Web. JoltPreset.recipe usa definições geradas no Apple. distance, scale, direction e duration são validados; duration explícita converte canais em tweens finitos, com zero imediato. Os padrões preservam as molas originais. As definições são copiadas e não alteram o registro global. Os 15 nomes portáveis, incluindo flipInX e flipInY, estão no guia de instalação.

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

<Clip name="swiftui-scroll-linked-ios" caption="Simulador iOS 27.0: scroll real altera o progresso/cabeçalho; movimento reduzido remove as transformações decorativas. Interface em inglês." />

<Clip name="swiftui-scroll-linked-macos" caption="Aplicativo macOS: roda do mouse e leitura nativa do deslocamento; movimento reduzido mantém o cabeçalho estável. Interface em inglês." />

<Clip name="web-expansion-react" caption="Chromium no macOS, React DOM: ponteiro, arraste, presença, valores, eventos, layout e scroll reais. O mesmo contrato é testado nos quatro frameworks." />

## Profundidade e sombra

Aguardando merge e publicação no [PR #488](https://github.com/rafaelaugustos/jolt/pull/488); não está na 0.1.0-rc.13. `JoltPose` aceita `rotateX` e `rotateY` em graus ao lado de `rotate`, com a mesma validação (valores finitos). Toda view do Jolt compõe na ordem da Web: escala, rotateX, rotateY, rotate e depois translação, em torno do centro do frame sem transformação. Animar um eixo preserva o ângulo do outro, e um eixo interrompido continua do valor amostrado. `joltBind` aceita `.rotateX` e `.rotateY`; `joltBind([.rotateX: rx, .rotateY: ry])` liga vários valores sob uma única projeção, e `scale` multiplica `scaleX`/`scaleY`. Ligue os dois eixos nessa mesma chamada: dois bindings de profundidade separados projetam duas vezes, e o interno fica ortográfico. Grupos de propriedades, estados e keyframes controlam os valores ligados. `JoltPreset.flipInX` e `flipInY` são gerados das receitas compartilhadas, e `createPreset` na Web e no NativeScript os aceita com os mesmos parâmetros.

`.joltPerspective(600)` declara uma distância em pontos, de 1 a 100.000; `JoltPerspective(distance:)` valida um valor calculado e lança erro, e um literal fora do intervalo para numa precondition. A distância chega à view do Jolt mais próxima abaixo dela que pode girar em X ou Y (`joltMotion`, `joltPreset`, `JoltPresence`, `joltScrollLinked`, `joltViewportEnter`, o `joltBind` de vários valores e um binding simples ou mapeado de rotateX/rotateY). Essa view projeta com ela e a esconde do próprio conteúdo, então um filho que inclina fica ortográfico, a menos que declare a sua. Os outros bindings, e um `JoltPressStyle` cujas poses não têm rotateX/rotateY, repassam a distância. O ponto de fuga é o centro do frame sem transformação de cada view, como no NativeScript. Na Web ele é o centro do contêiner com `perspective` CSS, então os dois coincidem quando a view está centralizada no contêiner; a translação move a superfície em relação a esse ponto fixo, como na Web. Sem perspectiva declarada, rotateX e rotateY são ortográficos, como na Web sem `perspective`: rotateY de 60° mostra a view com metade da largura. A distância não é animada; uma mudança vale no quadro seguinte. Uma superfície cuja borda próxima alcança o olho não é suportada: o CSS a recorta, `JoltProjection.corners` lança erro, e o Jolt não define o que o SwiftUI desenha.

O JoltCore calcula a projeção (`JoltProjection.matrix` e `JoltProjection.corners`) a partir do tamanho medido, e um efeito de geometria do SwiftUI a aplica, sem alterar o layout. Fixtures geradas com as matrizes de transformação e perspectiva do CSS cobrem três superfícies, oito poses, projeção ortográfica e 300/800/2400 pontos, além de duas superfícies que passam do olho. Os testes Swift comparam o JoltCore e a transformação que o efeito realmente retorna com elas, e o teste de UI do laboratório de profundidade lê os frames projetados em cada distância.

O hit testing e o frame de acessibilidade seguem a forma projetada. No teste de UI do laboratório no simulador iOS, um toque dentro do frame de layout mas fora do cartão inclinado não faz nada, e um toque acima do frame de layout, na borda próxima do cartão, o aciona; o frame de acessibilidade é a caixa delimitadora projetada. `joltSharedLayout`, `joltLayout`, `joltDrag`, `joltDropSource` e `joltPointerFollow` medem frames sem transformação ou posições globais, então não são suportados em uma view que gira em X ou Y, abaixo dela ou abaixo de uma perspectiva declarada. A Web os rejeita nesse caso; modificadores SwiftUI não podem lançar erro, e o Jolt não detecta a situação. Coloque-os em um contêiner sem transformação e incline um filho. Rigs e `JoltGestureModel` continuam bidimensionais, como os canais de rig compartilhados.

`JoltShadow(opacity:radius:x:y:)` é uma única sombra externa: opacidade de 0 a 1, raio ≥ 0 e deslocamentos em pontos, todos finitos e dentro de ±10¹². O raio é o número que a Web e o NativeScript no iOS chamam de `shadowRadius`; a Web o desenha como blur CSS de 2 × raio. A cor é fixa: `joltMotion(to:shadowColor:)`, `joltScrollLinked`, `joltViewportEnter` e `JoltPressStyle` usam preto por padrão, e o alfa da cor multiplica a opacidade. `JoltPose.shadow` anima com a transição de transformação da pose, então `y` e a sombra compartilham uma mola; uma pose sem sombra interpola a partir de uma sombra transparente, sem blur nem deslocamento. `joltShadow(rest, color:opacity:radius:x:y:)` liga qualquer um dos quatro canais a um `JoltMotionValue`. Um canal ligado substitui o valor de repouso, e remover o binding volta a mostrar o valor de repouso declarado. Amostras ligadas e o overshoot da mola são limitados como os canais de decoração compartilhados: opacidade em 0 a 1 e raio ≥ 0. A sombra é desenhada dentro da transformação da view, como um box-shadow CSS, e o SwiftUI a desenha para cada forma visível do conteúdo, então dê à view uma forma de fundo opaca. Presets e receitas do `JoltPresence` não têm sombra. Escolha a cor para cada aparência no app; o laboratório verifica claro e escuro.

Movimento reduzido encerra rotateX, rotateY e os quatro canais de sombra imediatamente, como as outras transformações, enquanto a opacidade mantém a transição. Isso é igual ao adaptador nativo, em que decorações saltam para o fim e só opacidade e cores animam. Bindings mostram os destinos sob `joltReduceMotion`; uma cena inativa encerra `joltMotion` no destino, e um scope suspende seus valores. Os pixels não são idênticos: SwiftUI, Core Animation e navegadores rasterizam sombras e bordas projetadas de formas diferentes.

```swift
let rest = try! JoltShadow(opacity: 0.2, radius: 3, y: 2)
let raised = try! JoltShadow(opacity: 0.42, radius: 18, y: 16)
VStack {
    TiltCard()
        .joltBind([.rotateX: model.rotateX, .rotateY: model.rotateY])
    LiftCard()
        .joltMotion(
            to: lifted ? try! JoltPose(y: -18, shadow: raised) : try! JoltPose(shadow: rest),
            transition: .spring(.bouncy))
}
.joltPerspective(600)
```

Veja os [canais de profundidade na Web](./interaction-depth) para o contrato do navegador.

<Clip name="swiftui-depth-ios" caption="Simulador iPhone 17 Pro / iOS 27.0, SwiftUI nativo: um cartão inclina em X e Y a 300 pt, 900 pt e sem perspectiva, um eixo é nivelado no meio do movimento enquanto o outro se mantém, toques testam a área de toque projetada, um segundo cartão sobe com y e sombra na mesma mola, o binding da sombra é removido e depois vêm movimento reduzido e a aparência clara. Toques reais do XCTest; não é gravação em dispositivo físico." />

<Clip name="swiftui-depth-macos" caption="App macOS, SwiftUI nativo: a mesma inclinação, perspectiva, cliques de hit testing, elevação, movimento reduzido e aparência clara com cliques reais do mouse. Só a janela do app é gravada." />

[Movimento derivado e gráficos retidos](./swiftui-advanced)
