# SwiftUI: keyframes, interação e personagens

Candidato em código para iOS 17+ e macOS 14+, pendente de merge/publicação no [PR #436](https://github.com/rafaelaugustos/jolt/pull/436). Estas APIs Swift não estão na RC.12.1. Consulte [instalação](./swiftui), [ownership](./swiftui-motion) e [grupos de propriedades](./swiftui-advanced). SwiftUI executa sem NativeScript ou JavaScript; a Web reutiliza o runtime público existente.

## Keyframes finitos

JoltTimeline.keyframes compila paradas normalizadas na timeline existente. O easing de cada parada controla o segmento seguinte. São 2–256 paradas estritamente crescentes por canal, com início em 0 e fim em 1; valores finitos até ±10¹². Aceita 1–128 canais distintos no mesmo relógio, 1–100 passagens, até 10.000 segmentos expandidos e 60.000 ms no total. iterations:2 com autoreverses:true executa ida e volta, invertendo também a curva, e termina no valor inicial. Não há loop infinito.

A validação termina antes de trocar o dono dos valores. Outro escritor interrompe a timeline; cancel/dispose é terminal. Pause congela o progresso, suspensão preserva pausa manual e reducedMotion liquida a última passagem sem manter o relógio ativo. Passe a preferência do host em reducedMotion; o relógio também observa a preferência do sistema. Na Web, animate usa x:[-100,100,0], times:[0,0.6,1], ease:["easeIn","easeOut"], duration:1800, repeat:1 e repeatType:"reverse". repeat conta passagens adicionais.

```swift
let scope = JoltScope()
let x = try scope.value(0)
let scene = try scope.retain(JoltTimeline.keyframes([
    .init(x, [try .init(-100, at: 0, ease: .easeIn),
              try .init(100, at: 0.6, ease: .easeOut),
              try .init(0, at: 1)])
], duration: 1800, iterations: 2, autoreverses: true))
scene.pause()
try scene.seek(to: 0.5) // Pauses; no side effects.
scene.play()
// Bind: Capsule().joltBind(.x, to: x)
```

## Gestos combinados

JoltGestureModel possui x/y, escala uniforme e rotação. joltGestures conecta a entrada real e preserva o ponto focal ao mudar escala/rotação, permitindo a transição entre contatos. Translação usa pontos Apple, rotação usa graus e escala é adimensional e positiva. Defina limites finitos de x/y e intervalo de escala em (0,100]. Limites podem impedir a preservação exata do ponto focal. Use um pai sem transformações; ancestrais transformados e perspectiva estão fora deste contrato inicial. No iOS, recognizers da janela filtram pelo retângulo da região de entrada e não detectam oclusão por overlays SwiftUI. Desabilite a região de gestos coberta enquanto apresentar conteúdo sobreposto.

No macOS, arraste/pinça/rotação reconhecidos têm prioridade sobre o gesto do controle envolvido; cliques normais continuam disponíveis. A entrada direta interrompe a acomodação na posição amostrada. Cancel mantém a transformação atual; settle anima um destino validado. Desabilitar, remover ou passar para background cancela contatos e suspende movimento. Pausa manual permanece após resume. O modificador oferece ações acessíveis de zoom, rotação e reset; os botões da demo são outra alternativa. O vídeo macOS comprova mouse e botões, sem validar um trackpad físico. A Web reutiliza scope.gestures, settleTo e contatos de ponteiro, com controles acessíveis explícitos.

```swift
let gesture = try scope.retain(JoltGestureModel(
    bounds: .init(x: -100...100, y: -70...70), scale: 0.6...2
))
// card.joltGestures(gesture)
try gesture.settle(to: .init(), reducedMotion: false)
```

<Clip name="swiftui-key-gesture-ios" caption="Simulador iOS, SwiftUI nativo: keyframes, pausa/retomada, arraste/pinch/rotação por toque, reset e movimento reduzido. Não é aparelho físico." />

<Clip name="swiftui-key-gesture-macos" caption="macOS, SwiftUI nativo: keyframes, arraste com mouse e botões de zoom/rotação. O vídeo não valida trackpad físico." />

## Reordenação de linhas realizadas

JoltReorderModel possui até 1.000 IDs string únicos e estáveis, com 1–128 caracteres. JoltReorderList realiza linhas verticais de altura fixa entre 24–500 pontos, com espaçamento de 0–100. Não há virtualização. Apenas a alça inicia arraste; o conteúdo continua rolável. A prévia não altera keys até soltar. onMove entrega key, índice final e beforeKey; persistir os dados é responsabilidade da aplicação. replace valida todos os IDs antes de cancelar a entrada. A rolagem de borda só mantém trabalho ativo durante o arraste e para ao atingir o limite.

Cada linha expõe posição e ações acessíveis de subir/descer; macOS também aceita setas quando há foco. Movimento reduzido remove a animação da prévia sem impedir a reordenação. Pausa, desabilitação, background, substituição de dados e descarte cancelam sem commit. A Web reutiliza scope.reorder, linhas DOM realizadas, teclado e rolagem de borda; o suporte Web a tamanhos variáveis não implica virtualização SwiftUI.

```swift
let order = try scope.retain(JoltReorderModel(["one", "two", "three"]) { move in
    // Persist the controlled application order using move.key / move.beforeKey.
})
// JoltReorderList(order) { key in Text(key) }
order.move("one", to: 2)
```

## Zonas de drop

JoltDropZones registra 1–64 destinos com IDs únicos de 1–64 caracteres, prioridade finita e aceitação síncrona. Maior prioridade vence; empates seguem a declaração. O teste pelo centro inclui bordas; overlap exige área positiva. A geometria vem das views reais no espaço global compartilhado: é drop dentro do app, sem importação de arquivos ou drag do sistema. Rejeição retorna à origem por mola, imediatamente com movimento reduzido. request(id) permite ação acessível/botão sem exigir sobreposição; o destino precisa continuar montado.

A próxima interação, remoção do destino, pausa/background ou descarte destrói o efeito aceito. Callbacks podem cancelar ou substituir a operação sem que a limpeza antiga sobrescreva a nova. Coordenadas e dimensões têm limite de ±1.000.000 pontos, com dimensões positivas. Não aplique outra translação à origem enquanto o controlador a possui. A Web reutiliza scope.dropZones e a política compartilhada de prioridade, aceitação e efeitos. Drop não fornece a rolagem de borda de reorder.

```swift
let zones = try scope.retain(JoltDropZones([
    .init("basket", label: "Basket"),
    .init("locked", label: "Locked shelf", priority: 10, accepts: { false })
], onDrop: { event in
    // Apply app data; return an optional owned effect.
    JoltEffect { /* cancel that effect */ }
}))
// source.joltDropSource(zones)
// basket.joltDropTarget("basket", in: zones)
try zones.request("basket")
zones.cancel()
```

<Clip name="swiftui-transfer-ios" caption="Simulador iOS, SwiftUI nativo: drops aceitos/rejeitados, retorno e limpeza de efeito, reordenação e rolagem de borda em 12 linhas realizadas." />

<Clip name="swiftui-transfer-macos" caption="macOS, SwiftUI nativo: drops com mouse, alternativas por botão, reordenação por alça e rolagem de borda. Sem virtualização." />

## Partículas finitas

JoltParticles usa Canvas opcional: 1–2.000 partículas vivas, 1–32 cores, vida de 1–60.000 ms e tamanho de 1–128 pontos. burst e emit finito substituem a emissão atual. A taxa máxima é 1.000/s; emissão mais vida dura até 60 s. População excessiva é rejeitada antes da substituição. Velocidade/variação: 0–10.000 pontos/s; gravidade: ±10.000 pontos/s²; giro: ±3.600 graus/s; variação do giro: 0–3.600. Formas: círculo, retângulo ou anel; origem: centro, topo ou base. A seed permite repetição dos testes, sem prometer a mesma sequência aleatória da Web.

Não há relógio antes da primeira emissão ou depois de conclusão/cancelamento/descarte. Pause congela a idade; resize afeta nascimentos novos e preserva a origem dos existentes. Frames atrasados descartam nascimentos já expirados. Movimento reduzido do sistema ou da view suprime partículas e termina a emissão ativa. O Canvas é decorativo, não intercepta entrada e fica oculto da acessibilidade: preserve a mensagem semântica de sucesso/erro. Para reutilizar um emissor emprestado, retorne JoltEffect { particles.cancel() } do evento da timeline. A timeline precisa durar o suficiente; sua conclusão também limpa efeitos. A Web reutiliza particles/confetti existentes, compartilha a equação balística e mantém limites e aleatoriedade próprios.

```swift
let particles = try scope.retain(JoltParticles(.confetti))
// JoltParticlesView(particles).frame(width: 320, height: 330)
try particles.burst(count: 100, seed: 7)
particles.pause()
particles.play()
particles.cancel()
```

## Personagens articulados

JoltRigDefinition valida 1–64 partes, pais sem ciclos, até 128 poses e 256 sockets. Dimensões fixas: (0,10.000] pontos; pivôs fracionários até ±10; canais x/y/scaleX/scaleY/rotate e limites opcionais de rotação. Translação/rotação ficam em ±1.000.000; escala em ±100, inclusive durante overshoot da mola. Poses fornecem destinos absolutos. A mistura pondera desvios do repouso, divide por max(1,pesoTotal) por canal e usa o caminho angular curto em juntas sem limite. Partes desconhecidas, ciclos, pesos não finitos e matrizes inválidas são rejeitados antes de alterar a animação.

JoltRigView desenha símbolos SwiftUI em um Canvas. Acessórios ficam no mesmo contêiner sem transformação; sockets percorrem toda a hierarquia. O rig possui canais e playback; as views dos acessórios são emprestadas. Pause mantém a pose, movimento reduzido liquida o destino e o scope descarta observações/relógio. Forneça um rótulo acessível significativo e controles semânticos separados. Não inclui hit test por parte, cinemática inversa, deformação de malha ou física. Na Web, rig2d usa a hierarquia DOM: acessórios precisam ser filhos diretos da parte do socket, diferentemente do contêiner irmão em SwiftUI.

```swift
let rig = try scope.retain(JoltRig(.init(
    parts: ["arm": .init(width: 95, height: 28, pivotX: 0, rotation: -90...30)],
    poses: ["rest": [:], "wave": ["arm": .init([.rotate: -65])]],
    sockets: ["hand": .init(part: "arm", x: 0.95, y: 0.5, relative: true)]
)))
try rig.pose("wave")
try rig.blend([.init("wave", weight: 0.5)])
// JoltRigView(rig, accessibilityLabel: "Companion") { name in ... }
// flower.joltRigSocket("hand", in: rig)
```

<Clip name="swiftui-character-ios" caption="Simulador iOS, SwiftUI nativo: poses ponderadas, flor no socket da mão, confete da timeline, cancelamento e movimento reduzido. Sem alegação de desempenho físico." />

<Clip name="swiftui-character-macos" caption="macOS, SwiftUI nativo: poses articuladas e o mesmo ciclo de vida de sockets/efeitos. Reprodução real capturada na janela nativa." />

## Web

Os consumidores empacotados React, Angular, Svelte e Solid usam as APIs Web existentes no scope do framework. As gravações mostram interação real de mouse/teclado, poses e partículas Canvas. Testes Chromium/Firefox/WebKit verificam comportamento e limpeza ao desmontar. Não são gravações NativeScript nem de touchscreen físico; comprovam comportamento, sem equivalência de pixels, tempos, memória ou CPU.

<Clip name="web-characters-react" caption="React · Chromium: keyframes, interação real com mouse/teclado, sockets e partículas coordenadas em um consumidor empacotado." />

<Clip name="web-characters-angular" caption="Angular · Chromium: keyframes, interação real com mouse/teclado, sockets e partículas coordenadas em um consumidor empacotado." />

<Clip name="web-characters-svelte" caption="Svelte · Chromium: keyframes, interação real com mouse/teclado, sockets e partículas coordenadas em um consumidor empacotado." />

<Clip name="web-characters-solid" caption="Solid · Chromium: keyframes, interação real com mouse/teclado, sockets e partículas coordenadas em um consumidor empacotado." />
