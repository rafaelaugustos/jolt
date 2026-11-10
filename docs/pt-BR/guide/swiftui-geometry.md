# SwiftUI: painéis e geometria medida

Disponível na **0.1.0-rc.13 (Beta)** para iOS 17+ e macOS 14+, sem NativeScript ou JavaScript. Instale o produto `JoltSwiftUI` pela tag `v0.1.0-rc.13` do repositório de pacote [`jolt-swift`](https://github.com/rafaelaugustos/jolt-swift). Consulte [instalação](./swiftui), [ciclo de vida](./swiftui-motion) e [interação/geometria](./swiftui-geometry) para os limites.

## Painéis com pontos de parada

`JoltSheetModel` controla uma mola finita e 1–32 paradas únicas: `.points` em (0, 1.000.000], `.fraction` em (0, 1] ou `.content`. São pontos Apple e pontos/segundo; na Web, pixels CSS. A altura é limitada à área útil medida. A projeção da soltura usa 200 ms e velocidade limitada a ±4.000, preservada na mola. Empates seguem a última parada declarada.

`JoltBottomSheet` mede contêiner e conteúdo, fornece alça e `JoltScrollView`, desativa/oculta seu próprio fundo da acessibilidade enquanto aberto e devolve o foco pelo callback `returnFocus`. É um painel dentro do app; não é apresentação de sistema nem bloqueio de foco da janela inteira. Controles externos continuam sob responsabilidade do app. Não coloque outro scroll vertical dentro do conteúdo.

```swift
let scope = JoltScope()
let panel = try scope.retain(JoltSheetModel(
    snaps: [.points(230), .fraction(0.85), .content]
))
// Keep the model in @StateObject; restore app focus in returnFocus.
JoltBottomSheet(panel, label: "Details", returnFocus: { openerFocused = true }) {
    Button("Open") { try? panel.open(.points(230)) }
} content: {
    TextField("Note", text: $note)
    Text("Your scrolling content")
}
```

`open`, `snapTo`, `expand`, `collapse` e `dismiss` escolhem paradas lógicas; abrir antes da primeira medição é permitido. Entradas inválidas falham antes de substituir o movimento. `dismissible: false` impede fechamento por gesto e por código. Arrastar interrompe a mola na posição amostrada. O conteúdo expande o painel antes de rolar; um contato descendente no início do scroll passa ao painel. Após mudar a parada, levante e inicie outro contato para rolar. Não há transferência contínua de inércia entre scroll e mola.

A alça oferece ações acessíveis aplicáveis de expandir/recolher/fechar; no macOS, setas com foco e Escape. No iOS, a sobreposição real do teclado na borda inferior é medida no contêiner, evitando desconto duplo quando SwiftUI já reduziu sua altura. Teclados flutuantes não contam como sobreposição inferior. Mudanças de conteúdo, teclado ou contêiner cancelam o contato e mantêm a parada lógica. Não há promessa de teclado virtual no macOS.

Pausa manual sobrevive à suspensão da cena. `cancel` congela a posição; remoção suspende a view. Retenha o modelo para remontar ou use `JoltScope` para destruí-lo com o recurso. Movimento reduzido assenta mudanças programáticas e mantém entrada direta. `dispose` remove assinaturas e impede novas aberturas.

<Clip name="swiftui-panel-ios" caption="Simulador iOS: painel nativo, arrasto, scroll interno, teclado virtual, fechamento, movimento reduzido e remontagem. Não é aparelho físico." />

<Clip name="swiftui-panel-macos" caption="macOS nativo: mouse, scroll, digitação, Escape e retorno de foco. Sem promessa de teclado virtual ou trackpad." />

## Linhas realizadas com alturas medidas

Use `measuresRows: true`; o contrato antigo de `rowHeight` fixo continua disponível. São até 1.000 IDs únicos de 1–128 caracteres. Todas as linhas são realizadas: não há virtualização. A view reserva pelo menos 44 pontos para a alça e limita a 10.000; medidas do modelo aceitam 24–10.000 pontos e espaçamento 0–100. Texto, Dynamic Type e layout atualizam as medidas.

O arrasto preserva onde o contato começou dentro da linha; o destino compara centros medidos. A prévia só confirma os IDs ao soltar. Alteração acima de 0,5 ponto, redimensionamento, substituição, pausa/background ou remoção cancelam contato e rolagem de borda sem confirmar. Movimentos por código, ações acessíveis e setas no macOS usam o mesmo commit por ID. Movimento reduzido retira a animação da prévia. `replace` descarta medidas removidas; linhas novas usam a altura de reserva até serem medidas. `dispose` libera entrada e rolagem.

```swift
let order = try scope.retain(JoltReorderModel(
    ["one", "two", "three"], measuresRows: true
) { move in
    // Persist the controlled application order using move.key / move.beforeKey.
})
JoltReorderList(order) { key in
    Text(descriptions[key] ?? key).padding(12)
}
try order.replace(["three", "one", "two"])
```

## Curvas quadráticas e cúbicas

`JoltPath(from:segments:)` aceita linhas e segmentos Bézier quadráticos/cúbicos; o inicializador de polilinha continua válido. Coordenadas finitas em ±1.000.000 pontos, 1–1.024 segmentos, subdivisão adaptativa até profundidade 18 e 8.192 vértices, tolerância geométrica 0,025 ponto com verificação de tangente. Exceder o limite lança erro. O comprimento é aproximado; não há importador SVG completo nem morphing arbitrário.

Progresso limitado a [0,1]; `orient: true` acompanha a tangente com ângulo contínuo. Tangentes degeneradas usam uma corda próxima; comprimento zero permanece parado. Os pontos são deslocamentos locais do centro original. Progresso linear aproxima velocidade constante; outro easing muda a velocidade. Cancelamento, interrupção, pausa e destruição pertencem ao valor/scope. Movimento reduzido usa a pose final sem percorrer a curva. Fixtures geradas comparam comprimento, posição e ângulo ao amostrador Q/C TypeScript.

```swift
let path = try JoltPath(from: .init(-125, 40), segments: [
    .quadratic(control: .init(-65, -100), to: .init(0, 0)),
    .cubic(control1: .init(65, 100), control2: .init(70, -100),
           to: .init(125, -40))
])
let progress = try scope.value(0)
// marker.joltPath(path, progress: progress, orient: true)
try progress.animate(to: 1,
    transition: .tween(milliseconds: 2400, ease: .linear),
    reducedMotion: reduceMotion)
// Retarget to 0 to reverse from the sampled position; cancel() freezes it.
```

<Clip name="swiftui-geometry-ios" caption="Simulador iOS: curvas quadráticas/cúbicas, cancelamento/reverso, arrasto de linhas medidas e texto dinâmico." />

<Clip name="swiftui-geometry-macos" caption="macOS nativo: curvas, reordenação medida e conteúdo dinâmico." />

## Web existente e evidências

Consumidores empacotados de React/Angular/Svelte/Solid usam `scope.bottomSheet`, `scope.reorder` e `scope.animate(marker, {path: "M… Q… C…", orient: true}, transition)`. A alça Web é um elemento slider focável; botões e inputs internos mantêm sua interação. Semântica modal, fundo inerte e posicionamento de foco pertencem ao app. Use `remeasure()` após mover um contêiner em relação ao viewport. O teclado depende de VirtualKeyboard/VisualViewport; gravação desktop não valida teclado de celular.

A reordenação Web mantém observação de tamanho/origem entre arrastos após FLIP. Mudar texto e arrastar novamente funciona; mudar tamanho durante o arrasto cancela sem commit. Remover linhas ou destruir o controlador libera as observações. A proteção contra alterações externas de transform permanece. A comparação de centros alimenta as fixtures Swift.

XCTest usa simulador iOS e macOS nativo; testes Web usam Chromium, Firefox e WebKit. Vídeos não comprovam desempenho nem interação em iPhone/trackpad físico. O Mavis já possui adaptadores de Sheet/reorder; as issues existentes [#234](https://github.com/getcortexlabs/mavis-ui/issues/234), [#237](https://github.com/getcortexlabs/mavis-ui/issues/237) e [#298](https://github.com/getcortexlabs/mavis-ui/issues/298) acompanham integração/validação restante. SwiftUI está incluído na v0.1.0-rc.13.

<Clip name="web-geometry-react" caption="Chromium desktop, consumidor React empacotado: painel, scroll/foco, curvas e linhas de alturas variadas. Backends Web existentes; sem teclado móvel." />

<Clip name="web-geometry-angular" caption="Chromium desktop, consumidor Angular empacotado: painel, scroll/foco, curvas e linhas de alturas variadas. Backends Web existentes; sem teclado móvel." />

<Clip name="web-geometry-svelte" caption="Chromium desktop, consumidor Svelte empacotado: painel, scroll/foco, curvas e linhas de alturas variadas. Backends Web existentes; sem teclado móvel." />

<Clip name="web-geometry-solid" caption="Chromium desktop, consumidor Solid empacotado: painel, scroll/foco, curvas e linhas de alturas variadas. Backends Web existentes; sem teclado móvel." />
