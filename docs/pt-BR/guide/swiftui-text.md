# SwiftUI: entrada de texto e números rolantes

Disponível na **0.1.0-rc.15 (Beta)** para iOS 17+ e macOS 14+, sem NativeScript ou JavaScript. Instale o produto `JoltSwiftUI` pela tag `v0.1.0-rc.15` do repositório de pacote [`jolt-swift`](https://github.com/rafaelaugustos/jolt-swift). Consulte [instalação](./swiftui), [ciclo de vida](./swiftui-motion) e [interação/geometria](./swiftui-geometry) para os limites. Elas seguem [`animateText` e `rollTo`](./web-effects#text) da Web e compartilham a divisão, o escalonamento e o alinhamento pelo núcleo portável.

<Clip name="swiftui-text-ios" caption="Simulador iOS, SwiftUI nativo: uma frase entrando por palavra e por letra com repetição, uma linha em hebraico da direita para a esquerda, valores de moeda e porcentagem rolando para cima e para baixo com interrupção, Reduzir movimento e Dynamic Type maior. Não é uma gravação em dispositivo físico." />

<Clip name="swiftui-text-macos" caption="SwiftUI nativo no macOS, conduzido por cliques reais de mouse do XCTest: entradas por palavra e por letra com repetição, rolagem de moeda e porcentagem com interrupção e Reduzir movimento. O macOS não tem Dynamic Type." />

## Entrada de texto

`JoltTextEntrance` é dono de uma string e da sua reprodução. `JoltAnimatedText` a desenha como um único `Text` do SwiftUI, estilizado pelos modificadores `font`, `foregroundStyle`, `multilineTextAlignment` e `lineLimit` ao redor. Cada pedaço visível vai de opacidade 0 a 1 e sobe `y` pontos até o seu lugar, numa interpolação ease-out. Os padrões são os da Web: letras, 400 ms por pedaço, 35 ms de escalonamento, sem atraso, 12 pontos.

```swift
@StateObject private var title = try! JoltTextEntrance(
    "Motion should feel like it belongs to the words it carries.",
    options: .init(by: .word, duration: 400, stagger: 70, y: 12))

JoltAnimatedText(title).font(.title2.bold())
Button("Repetir") { title.replay() }
// try title.replay("Um novo título")   // valida e repete
```

`by: .letter` divide em clusters de grafemas estendidos, então uma letra acentuada, uma bandeira ou uma família de emojis unida é um só pedaço. `by: .word` usa os segmentos de palavra Unicode que o tokenizador do sistema informa para a localidade atual; espaços e pontuação são pedaços próprios. Espaços não desenham nada, mas mantêm o seu lugar na ordem: o pedaço na posição _k_ começa em `delay + k × stagger` milissegundos, contando os espaços, exatamente como na Web. A entrada dura até o último pedaço visível chegar. Duração zero mostra o texto inteiro de uma vez, qualquer que seja o atraso.

Duração, escalonamento e atraso são milissegundos finitos, de 0 a 60.000. `y` é em pontos, finito, dentro de ±10.000; valores negativos entram por cima. O texto tem no máximo 256 grafemas, e o último pedaço precisa chegar em até 60.000 ms. Entradas inválidas lançam `JoltError.invalidMotion` antes de qualquer mudança: `replay(_:)` com uma string inválida deixa a entrada atual tocando.

A entrada é um `JoltResource` movido pelo `JoltClock`. Ela toca desde a criação, a menos que `autoplay: false`, que a mantém oculta no primeiro quadro até `play()` ou `replay()`. `pause()` a congela; `cancel()` mostra o texto inteiro e a mantém repetível; `dispose()` mostra o texto inteiro em definitivo. `state`, `elapsed` e `progress` informam a reprodução. Um `JoltScope` pode retê-la. `JoltAnimatedText` a suspende enquanto a view está fora da tela, enquanto a cena do iOS está inativa ou enquanto a janela do macOS está oculta, minimizada ou coberta; uma pausa manual sobrevive à retomada. Nenhum relógio roda antes da reprodução, em pausa ou depois do fim.

**Acessibilidade.** A view é um único elemento de acessibilidade cujo rótulo é a string inteira, desde o primeiro quadro, independentemente do que os pedaços estejam desenhando. Os pedaços não acrescentam elementos.

**Reduzir movimento.** O ajuste do sistema, `joltReduceMotion(true)` num ancestral e `reducedMotion: true` mostram o texto final de imediato e concluem a entrada. Ativá-lo durante uma entrada a conclui.

**Layout, Dynamic Type e direita para a esquerda.** No iOS 18 e no macOS 15 em diante, cada pedaço é um trecho de um único `Text` já diagramado, desenhado por um `TextRenderer`. Quebra de linha, Dynamic Type, ordem bidirecional e ligação do árabe são do próprio SwiftUI; a view tem o mesmo tamanho de um `Text` comum. Uma mudança de Dynamic Type durante a entrada diagrama o texto de novo e a reprodução continua no tempo atual. Em texto da direita para a esquerda, os pedaços entram na ordem de leitura, então a primeira palavra em hebraico ou árabe, à direita, entra primeiro. Enquanto as letras se movem, uma ligadura que abrange dois pedaços é desenhada como letras separadas; em repouso a view é um `Text` comum. Glifos em movimento desenham até `y` pontos fora do quadro. No iOS 17 e no macOS 14, onde `TextRenderer` não existe, a view mostra o texto final e a entrada termina assim que começa. O macOS não tem Dynamic Type.

**Diferenças entre plataformas.** As letras coincidem com a Web grafema por grafema. Os limites de palavra vêm do mecanismo de texto de cada plataforma: `Intl.Segmenter` na Web, o tokenizador do sistema na Apple. Eles concordam onde as regras de palavra do Unicode decidem, o que os fixtures compartilhados verificam para inglês, pontuação, emojis, marcas combinantes, coreano, árabe, hebraico e números. Palavras em chinês e japonês vêm de dicionários diferentes: `你好世界` é `你好 | 世界` na Web e `你 | 好 | 世界` na Apple. O `animateText` do NativeScript difere de ambos: lá os espaços não acrescentam passos de letra, e a pontuação se junta à sua palavra.

## Números rolantes

`JoltRollingNumber` guarda um valor e o texto que um formatador do aplicativo faz dele. `roll(to:)` define `value`, `text` e o valor de acessibilidade de uma vez; só o desenho se move. `JoltRollingText` o desenha: em cada posição alterada, o glifo na tela desliza para fora enquanto o novo desliza para dentro, numa mola. Glifos que não mudam não se movem.

```swift
@StateObject private var balance = try! JoltRollingNumber(
    1249.9,
    format: { $0.formatted(.currency(code: "BRL")) },
    options: .init(duration: 600, bounce: 0.2, stagger: 0))

HStack {
    Text("Saldo")
    Spacer()
    JoltRollingText(balance)  // tabular: true, alignment: .trailing
        .font(.largeTitle.bold())
        .accessibilityLabel("Saldo")
}
Button("Depositar") { try? balance.roll(to: 12980.6) }
```

`format` é um `@MainActor (Double) -> String` e precisa devolver no máximo 256 grafemas; o padrão, `JoltRollingNumber.plain`, escreve números inteiros sem fração e os demais valores como o decimal mais curto do Swift. Os valores precisam ser finitos. `duration` (acima de 0, no máximo 60.000 ms) e `bounce` (−1 a 1) descrevem a mola como o SwiftUI e a Web: `JoltTransition.spring(milliseconds:bounce:)` devolve a mesma rigidez e o mesmo amortecimento da Web, com bounce limitado a ±0,99. `stagger` e `delay` são milissegundos de 0 a 60.000. Entradas inválidas lançam erro antes de o texto ou uma rolagem em curso mudar.

As duas strings são divididas em grafemas e alinhadas pelo último, então o dígito das unidades fica no lugar quando o número cresce: `99` vira `100` rolando dois noves para zeros e um `1` entrando à esquerda. Os grafemas são comparados pelos seus escalares Unicode exatos, como na Web, então `é` e `e` seguido de acento combinante rolam. O escalonamento conta as posições alteradas a partir da direita e depois os grafemas antigos que saem sem substituto. `direction: .auto` rola para cima até um valor maior e para baixo até um menor; rolar para cima significa que o glifo antigo sai pelo topo enquanto o novo entra por baixo. `roll(to:direction:)` pode trocar a direção uma vez. `set(_:)` salta sem rolar.

**Interrupção.** Um novo alvo durante uma rolagem vale de imediato em `text` e no valor de acessibilidade. Glifos iguais nos dois alvos continuam se movendo como estavam. Todos os outros saem do deslocamento e da opacidade com que estão desenhados, então nada salta. No máximo oito gerações de glifos saindo são mantidas; as mais antigas desaparecem. Na Web, um novo alvo achata o que está desenhado e faz o novo texto inteiro entrar.

**Desenho e layout.** Glifos em movimento são recortados à sua linha, como um odômetro. A view assume o tamanho do novo texto, diagramado como um `Text` nativo com Dynamic Type. Glifos saindo são diagramados numa linha, na largura natural, e posicionados em `alignment` dentro da view: o padrão `.trailing` mantém as colunas alinhadas pelo fim, o que convém a números numa linha alinhada ao fim. Use o alinhamento que o contêiner mantém fixo quando a largura muda; largura fixa ou `tabular: true` (dígitos monoespaçados, o padrão) dão as colunas mais estáveis. Num layout da direita para a esquerda, `.trailing` é a borda esquerda; defina o alinhamento explicitamente quando um número estiver em texto da direita para a esquerda. No iOS 17 e no macOS 14 o texto final aparece de imediato.

**Acessibilidade e Reduzir movimento.** A view é um único elemento cujo valor de acessibilidade é o alvo formatado desde o primeiro quadro da mudança; dê a ela um rótulo com `.accessibilityLabel`. Reduzir movimento, `joltReduceMotion(true)` e `reducedMotion: true` mostram o texto final de imediato. A rolagem é um `JoltResource` com as mesmas regras de pausa, suspensão, escopo e descarte da entrada.

## Fixtures compartilhados

`npm run swiftui:check` gera de novo `Fixtures/text.json` a partir do núcleo portável e falha quando ele está desatualizado. Ele contém os pedaços por letra e por palavra de strings com ASCII, pontuação, sequências de emoji com ZWJ, marcas combinantes, CJK, árabe, hebraico e números mistos; os inícios e o progresso suavizado das entradas para três combinações de duração/escalonamento/atraso; diffs de rolagem com seu escalonamento; e molas a partir de duração e bounce. `JoltCoreTests` reproduz todos eles, comparando limites de palavra em chinês e japonês apenas fora dos trechos de dicionário.
