# SwiftUI: movimento derivado e gráficos retidos

Disponível na **0.1.0-rc.13 (Beta)** para iOS 17+ e macOS 14+, sem NativeScript ou JavaScript. Instale o produto `JoltSwiftUI` pela tag `v0.1.0-rc.13` do repositório de pacote [`jolt-swift`](https://github.com/rafaelaugustos/jolt-swift). Consulte [instalação](./swiftui), [ciclo de vida](./swiftui-motion) e [interação/geometria](./swiftui-geometry) para os limites.

JoltNumericMap aceita 2–1024 pares finitos com entradas estritamente monotônicas. Entradas decrescentes são invertidas. Clamp é o padrão; clamp:false estende os segmentos extremos. sample retorna valor e inclinação, usando a derivada à esquerda nos nós internos. JoltMappedValue usa uma origem escalar emprestada e possui apenas sua observação: pausa congela, retomada atualiza e dispose desconecta. Overflow define valid=false e preserva o último resultado finito. Não cria outro relógio. O binding aceita x/y, scale/scaleX/scaleY, rotate e opacity; transformações decorativas ficam na identidade com movimento reduzido.

JoltColor armazena bytes ARGB em sRGB. mixed(to:progress:) e JoltColorValue interpolam em OKLab pré-multiplicado com alpha, limitam progresso a 0…1 e recortam a saída para sRGB. joltColor aplica foreground ou background. A origem possui a animação; destruir a cor não destrói essa origem. É conformidade numérica, sem promessa de gamut ou pixels de texto idênticos.

```swift
let scope = JoltScope()
let progress = try scope.value(0)
let mapped = try scope.retain(JoltMappedValue(progress,
    mapping: JoltNumericMap([0, 0.5, 1], [-100, 0, 100])))
let color = try scope.retain(JoltColorValue(progress,
    from: .init(argb: 0xff7766ff), to: .init(argb: 0xffdbff7a)))
try progress.animate(to: 1, transition: .tween(milliseconds: 1000))
// Text("Jolt").joltBind(.x, to: mapped).joltColor(.background, to: color)
```

JoltPropertyGroup usa 1–1024 valores escalares emprestados, com nomes únicos e o mesmo JoltClock. Valida todos os destinos antes de cancelar o trabalho anterior e inicia as propriedades em uma timeline. Chaves desconhecidas, valores não finitos ou membros destruídos são rejeitados sem mutação parcial. Substituição, cancelamento e suspensão coordenam o grupo; callbacks de cancelamento não sobrescrevem um trabalho mais novo. Destinos parciais são permitidos. O grupo possui seu playback, não os valores. Use um coordenador por conjunto de propriedades.

JoltMotionStates guarda estados nomeados validados e substitui transições a partir das posições amostradas. JoltBehaviors acrescenta ações finitas com prioridade, when, blocks, política de substituição na mesma prioridade e uma ação explícita de repouso. Prioridade maior interrompe, exceto quando bloqueada; prioridades iguais são rejeitadas por padrão. request retorna execução com status e cancel(). Uma execução antiga não cancela a nova. Conclusão/cancelamento restaura rest; stop() impede restauração. Pausa manual e suspensão são independentes. Este subconjunto SwiftUI coordena destinos finitos de propriedades, não fluxos assíncronos arbitrários; NativeScript/Web mantêm seus contextos assíncronos mais amplos.

```swift
let x = try scope.value(0), scale = try scope.value(1)
let group = try scope.retain(JoltPropertyGroup(["x": x, "scale": scale]))
let actions = try scope.retain(JoltBehaviors(group: group, definitions: [
    "rest": .init(["x": 0, "scale": 1]),
    "pet": .init(["x": -70, "scale": 1.1], priority: 1),
    "dress": .init(["x": 70, "scale": 0.9], priority: 2, blocks: ["eat"]),
    "eat": .init(["x": 0, "scale": 1.2], priority: 3)
], rest: "rest"))
let pet = try actions.request("pet")
try actions.request("dress")
// pet.status == .interrupted
```

JoltTimeline.seek(to:) aceita progresso finito em 0…1, pausa, libera efeitos ativos e amostra os canais sem disparar eventos atravessados. O playback posterior rearma eventos após a nova posição. Seek antes de uma track atrasada restaura seu valor inicial. Uma timeline concluída pode receber seek novamente; cancelamento/destruição são terminais. autoplay:false continua pausado após suspensão/retomada do scope. Durações usam milissegundos, até 60 segundos; sobreposição no mesmo escalar é rejeitada.

```swift
let scene = try scope.retain(JoltTimeline(
    tracks: [.init(x, to: 100, transition: .tween(milliseconds: 1000))],
    autoplay: false
))
try scene.seek(to: 0.5)
scene.play()
let demand = try scope.retain(JoltRenderActivity(JoltRenderAdapter(
    change: { active in /* renderer.setContinuous(active) */ },
    redraw: { /* renderer.drawCommittedValues() */ }
)))
let observation = try demand.track(scene) // Retain with the model.
```

JoltMotionValue.decay usa a equação exponencial compartilhada: velocidade em pontos/segundo, retenção por milissegundo (friction padrão 0.998). Para no primeiro limite, tem teto de 60 segundos e aceita interrupção, pausa e suspensão. JoltDragModel(release:.inertia()) usa a velocidade real do gesto e exige snaps vazios; .snap continua padrão. Limites restringem manipulação e decay; a mola de snap existente pode ultrapassá-los temporariamente. A amostragem de eventos difere da Web e do NativeScript, então o tempo de soltura não precisa ser idêntico.

JoltPath aceita 2–1024 pontos validados dentro de ±1.000.000. Remove duplicatas consecutivas, amostra a polilinha pelo comprimento, limita progresso normalizado e mantém continuidade dos ângulos tangentes. Um caminho degenerado permanece no ponto com rotação zero. joltPath aplica posição e orientação opcional a partir de progresso emprestado. Este adaptador não interpreta curvas SVG arbitrárias nem faz morph: forneça uma polilinha finita. O motor SVG Web já tem uma gramática maior. Fixtures compartilhadas verificam posições e ângulos.

O exemplo de polilinha continua válido. Para segmentos quadráticos/cúbicos tipados e seus limites, veja [geometria medida](./swiftui-geometry).

JoltDrawing retém até 1024 formas e 8192 pontos/unidades de geometria. Paths, retângulos e elipses usam pontos locais; fill/stroke usam JoltColor e espessura de 0…1000. A atualização inteira é validada antes da troca. JoltDrawingView usa um Canvas e progresso de traço emprestado; preenchimento e geometria permanecem ao pausar. dispose limpa os recursos; pausar o scope não apaga o desenho. O adaptador inicial tem um progresso de traço compartilhado, sem hit testing por item, parser SVG ou ajuste automático de viewBox. Forneça rótulo acessível para ilustrações relevantes.

JoltTextPaint valida 2–8 cores, stops ordenados em 0…1, ângulo horário e largura do brilho em (0,1]. JoltGradientText mantém Text acessível real e recorta o brilho opcional nas letras. O app possui o progresso: anime 0→1 ou 1→0, pause/cancele ou destrua pelo scope. Não cria loop infinito. Movimento reduzido e cena inativa ocultam o brilho, preservando o texto legível. Rasterização, fontes e quebras de linha pertencem à plataforma.

JoltViewportEntry observa a interseção real com scroll/janela nativos, não a criação da view. threshold é a fração visível em 0…1; zero ainda exige alguma área visível. once preserva o histórico do controlador; once:false repete após sair e entrar. Remoção cancela playback e desconecta observações; remount pode reutilizar histórico. Pausa manual e suspensão adiam a entrada. A geometria considera ancestrais com recorte, mas não janelas sobrepostas, overlays ou oclusão visual; aplique em uma região de entrada sem transformação.

```swift
let route = try JoltPath([.init(20, 80), .init(100, 20), .init(180, 80)])
let drawing = try scope.retain(JoltDrawing([
    .init(.path(route), stroke: .init(argb: 0xffdbff7a), lineWidth: 4)
]))
// JoltDrawingView(drawing, strokeProgress: progress, accessibilityLabel: "Route")
// Image(systemName: "paperplane.fill").joltPath(route, progress: progress, orient: true)
let entry = try scope.retain(JoltViewportEntry(threshold: 0.5, once: false))
// Text("Arrived").joltViewportEnter(entry)
```

JoltRenderActivity combina playback emprestado de escalares/timelines e tokens explícitos hold() com JoltRenderAdapter. scope() cria um filho que compartilha renderer e ciclo de vida do pai. Retenha as observações retornadas; destruir uma remove demanda sem parar a animação emprestada. change(active) só alterna quando a demanda conjunta muda; redraw() recebe valores já aplicados, inclusive o frame final ou após seek. Pausa/suspensão suprimem demanda e preservam pausa manual. Não há polling ou display link ocioso. Limites: 4096 observações/tokens e 1024 proprietários. O adaptador executa a renderização e combina demanda com sua política de cena.

As equivalências Web já existem: value.to()/scope.map para números/cores, propertyGroup, motionStates, motionBehaviors, seekableTimeline + withTimelineCues, decay/drag release, paths SVG, drawBatch/shape, gradientText, viewportEnter e renderActivity. O setup motion de React/Angular/Svelte/Solid possui esses recursos existentes, sem duplicar APIs. Um handle de transição de estado não expõe relógio para renderActivity.track; use hold explícito e limitado ou um handle de playback suportado. NativeScript/Web mantêm os contratos publicados de ciclo de vida e execução.

A validação inclui fixtures de números/cores/decay/paths geradas pelo core TypeScript, testes determinísticos de recursos, interação real via XCTest no iOS/macOS e consumidor npm instalado em Chromium/Firefox/WebKit. Os vídeos mostram controles reais na velocidade original. Comprovam comportamento, não superioridade de CPU/PSS ou desempenho em aparelho físico.

<Clip name="swiftui-dynamics-ios" caption="Simulador iPhone 17 Pro / iOS 27.0: toques reais via XCTest. Mapeamento/cor, grupos, estados, prioridades/repouso, seek e demanda de renderização; interface em inglês." />

<Clip name="swiftui-dynamics-macos" caption="Aplicativo macOS neste Mac: cliques reais nas mesmas capacidades. Apenas a janela do app; interface em inglês." />

<Clip name="swiftui-graphics-ios" caption="Simulador iOS 27.0: desenho/path reais, brilho finito nas letras, pausa/retomada, arraste inercial e destruição do desenho. Interface em inglês." />

<Clip name="swiftui-graphics-macos" caption="Aplicativo macOS: controles e arraste reais; Canvas retido, orientação no path, brilho e destruição. Interface em inglês; sem benchmark de desempenho." />

<Clip name="swiftui-viewport-ios" caption="Simulador iOS 27.0: scroll real mostra entrada única/repetida, saída, reentrada e remoção/remount. Interface em inglês." />

<Clip name="swiftui-viewport-macos" caption="Aplicativo macOS: roda do mouse real, limite de entrada de 50%, once/replay e limpeza. Interface em inglês." />

<Clip name="web-advanced-react" caption="Chromium no macOS: componente React real possui mapeamentos/cores, grupos, estados/comportamentos, seek/eventos, desenho, brilho, inércia, viewport e atividade. Interface em inglês; backends Web existentes." />

<Clip name="web-advanced-angular" caption="Chromium no macOS: componente Angular real possui mapeamentos/cores, grupos, estados/comportamentos, seek/eventos, desenho, brilho, inércia, viewport e atividade. Interface em inglês; backends Web existentes." />

<Clip name="web-advanced-svelte" caption="Chromium no macOS: componente Svelte real possui mapeamentos/cores, grupos, estados/comportamentos, seek/eventos, desenho, brilho, inércia, viewport e atividade. Interface em inglês; backends Web existentes." />

<Clip name="web-advanced-solid" caption="Chromium no macOS: componente Solid real possui mapeamentos/cores, grupos, estados/comportamentos, seek/eventos, desenho, brilho, inércia, viewport e atividade. Interface em inglês; backends Web existentes." />
