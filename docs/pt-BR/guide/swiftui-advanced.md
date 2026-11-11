# SwiftUI: movimento derivado e gráficos retidos

Disponível na **0.1.0-rc.14 (Beta)** para iOS 17+ e macOS 14+, sem NativeScript ou JavaScript. Instale o produto `JoltSwiftUI` pela tag `v0.1.0-rc.14` do repositório de pacote [`jolt-swift`](https://github.com/rafaelaugustos/jolt-swift). Consulte [instalação](./swiftui), [ciclo de vida](./swiftui-motion) e [interação/geometria](./swiftui-geometry) para os limites.

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

Membros fora de um dicionário parcial mantêm o valor amostrado. Desde a 0.1.0-rc.14: quando outro escritor assume um membro (seu próprio `animate`, `set`, `decay`, `cancel` ou `dispose`, outro grupo ou uma timeline), a execução inteira é cancelada na hora, inclusive em pausa, e a conclusão informa `false` uma vez. No 0.1.0-rc.13, um grupo em execução percebia isso no frame seguinte e um grupo pausado só no `play()`. `cancel()` depois da conclusão mantém `.completed`. Os grupos de NativeScript e Web aceitam 1–64 membros e exigem todos em cada comando; os grupos SwiftUI aceitam até 1024 valores escalares e dicionários parciais.

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

## Shimmer, loaders e revelação circular

Desde a **0.1.0-rc.14** ([PR #488](https://github.com/rafaelaugustos/jolt/pull/488)). Durações e geometria vêm da mesma definição compartilhada dos adaptadores NativeScript e Web (`src/core/loading.ts`, compilada em `JoltCore` e verificada com fixtures geradas).

JoltShimmer(duration:) recebe uma varredura positiva e finita em milissegundos, no máximo 60 000, padrão 1500, incluindo a entrada e a saída da faixa. joltShimmer pinta a faixa da Web: ângulo CSS de 100°, branco com opacidade 0, 0,55 e 0 em 15, 50 e 85 %, movendo-se linearmente de uma largura à esquerda da view até uma largura à direita. A faixa é composta com a view num único grupo de composição (`sourceAtop`), então só pinta onde o conteúdo é opaco e é ponderada pelo seu alfa: placeholders translúcidos recebem uma varredura mais fraca. Aplique-o a um contêiner para varrer todas as formas do skeleton com uma faixa; várias views podem mostrar o mesmo shimmer em sincronia. Use-o em formas de placeholder, não em views nativas vivas, que passam a ser renderizadas dentro desse grupo.

JoltLoader(style:color:size:duration:) desenha a geometria do loader NativeScript no iOS. Padrões: `.dots`, `#71717a`, 48 pontos, 1200 ms por ciclo. O tamanho deve estar em (0, 16 384] pontos e a duração em (0, 60 000] milissegundos. JoltLoaderView centraliza um quadrado cujo lado é o menor entre `size` e o espaço oferecido. Pontos: três pontos de 0,2 × lado escalando 0,35 → 1 → 0,35 em 0, 30 e 60 % do ciclo. Barras: cinco barras com 0,12 × lado de largura e 0,75 × lado de altura, escalando na vertical nas mesmas chaves. Anel: doze pontos de 0,16 × lado esmaecendo de 1 a 0,2. As cópias começam `duration / 5` uma após a outra (pontos, barras) ou `duration / 12` (anel). Sem `accessibilityLabel`, o loader fica oculto para a acessibilidade; rotule o controle ocupado, por exemplo "Salvando".

Ambos são JoltResource; retenha-os num JoltScope. Eles assinam o JoltClock só enquanto ao menos uma view os mostra numa cena ativa (iOS: a cena está ativa; macOS: a janela hospedeira está visível) com movimento completo, e enquanto não estão pausados nem suspensos. Não há TimelineView nem timer ocioso. Sair da tela, uma cena inativa, `pause()` ou a suspensão do escopo mantêm a fase atual; mostrá-los de novo continua de onde parou. Com movimento reduzido (o ajuste do sistema ou `joltReduceMotion`), a faixa do shimmer fica oculta e as cópias do loader ficam numa pose estática: pontos e barras em tamanho cheio, pontos do anel com opacidade 0,35. `state` informa `running`, `paused`, `suspended`, `idle` ou `disposed`. O descarte libera o relógio, as views não desenham nada e chamadas posteriores são ignoradas; os testes verificam que o `activeCount` do relógio volta a zero.

```swift
let scope = JoltScope()
let shimmer = try scope.retain(JoltShimmer())
let saving = try scope.retain(JoltLoader(.ring, size: 28))
let details = try scope.retain(JoltReveal(revealed: false))
// SkeletonRows().joltShimmer(shimmer)
// Text("Save").opacity(busy ? 0 : 1).overlay { if busy { JoltLoaderView(saving) } }
// Details().joltReveal(details)
try details.reveal(from: JoltPoint(40, 40)) { finished in
    // Mova o foco para os detalhes aqui.
}
try details.conceal(to: JoltPoint(40, 40))
```

JoltReveal(revealed:) executa `reveal(from:duration:reducedMotion:completion:)` e `conceal(to:...)` numa superfície exibida com joltReveal. As origens são pontos no espaço local da view a partir do canto superior esquerdo, o espaço que um gesto de toque `.local` informa, dentro de ±1 000 000. Sem origem, o círculo fica centralizado na view, ou mantém o centro do círculo atual ao interromper. Uma revelação cresce até o canto mais distante e uma ocultação encolhe até zero, com ease-in-out de 0 a 60 000 milissegundos (padrão 400); zero aplica o estado final de imediato. Uma nova chamada parte do círculo na tela, então uma ocultação pode inverter uma revelação no meio; a chamada substituída termina com `false`. Ocultar uma superfície já oculta termina com `true` de imediato. `cancel()` para e restaura a fase de antes da cadeia interrompida. Um redimensionamento recalcula o canto mais distante.

Quando uma revelação termina, o recorte circular é removido: o modificador mantém um recorte neutro para que o conteúdo preserve sua identidade e estado, e sombras ou conteúdo que transborda deixam de ser recortados. Quando uma ocultação termina, a view fica transparente e mantém seu espaço no layout. Sair da tela, uma cena inativa, `pause()` e a suspensão mantêm o círculo; mostrá-la de novo continua. Com movimento reduzido, ou com `reducedMotion: true`, o estado final é aplicado imediatamente e a conclusão informa `true`.

Só uma superfície totalmente revelada (`interactive == true`, fase `.revealed`) recebe toques e aparece para a acessibilidade. Enquanto revela, oculta ou está oculto, o conteúdo fica `accessibilityHidden` e não participa do hit-testing, então os toques chegam às views atrás dele. O Jolt nunca move o foco: a aplicação move o foco do VoiceOver ou do teclado para o conteúdo depois que a revelação termina, e para fora dele antes de chamar `conceal`, por exemplo com `@AccessibilityFocusState` ou `@FocusState`. O SwiftUI expõe descendentes ocultos de um contêiner explícito `.accessibilityElement(children: .contain)` (observado no simulador do iOS 27), então não envolva a superfície em um.

Diferenças entre plataformas: o shimmer NativeScript no iOS mascara o alvo de modo que o conteúdo fora da faixa escurece para opacidade 0,35, e a Web pinta sua faixa sobre toda a caixa do elemento; o SwiftUI pinta a faixa da Web só sobre conteúdo opaco. O loader da Web desenha caixas CSS com proporções próprias (pontos de 20 %, barras de 12 × 65 %, um arco giratório de 75 %) e um pulso suavizado, mantidos na mesma definição compartilhada; o SwiftUI segue a geometria nativa. NativeScript e Web cancelam uma revelação quando a view é descarregada ou desanexada; o SwiftUI a mantém fora da tela. A Web centraliza no elemento uma revelação que interrompe sem origem; NativeScript e SwiftUI mantêm o centro atual. O NativeScript mantém a área de toque retangular durante a reprodução; o SwiftUI ignora toques até a revelação completa. Estes efeitos continuam sem efeito no NativeScript Android.

## Superfícies com gradiente e desfoque

Desde a **0.1.0-rc.14** ([PR #488](https://github.com/rafaelaugustos/jolt/pull/488)). JoltGradient(colors:stops:angle:) pinta um gradiente linear com os limites da Web: 2–8 cores, um stop por cor, stops constantes em 0...1 e em ordem, um ângulo CSS finito em graus (o padrão 180 vai de cima para baixo, 90 da esquerda para a direita). A linha passa pelo centro e é longa o bastante para os cantos receberem a primeira e a última cor; as faixas ficam perpendiculares ao ângulo em pontos, em caixas de qualquer formato. Cada componente é uma constante ou uma fonte emprestada: `JoltNumberSource.value(JoltMotionValue)` para stops e ângulo, `JoltColorSource.value(JoltColorValue)` para cores. Anime o gradiente animando esses valores, com suas transições, springs, interrupção, pausa e conclusão; o gradiente não tem trilhas próprias. Stops vinculados são limitados a 0...1 e mantidos em ordem sem reordenar as cores, como a projeção de gradiente portátil. `update(colors:stops:angle:)` valida todos os componentes antes de substituir qualquer um e mantém a quantidade de cores; crie um novo gradiente para mudá-la.

`joltGradient(_:in:)` pinta o gradiente atrás da view dentro da forma informada (padrão `Rectangle()`); o conteúdo em si não é recortado. A pintura não participa do hit-testing e fica oculta para a acessibilidade. `frame` contém as cores pintadas, os stops projetados e o ângulo.

JoltBlur(amount:radius:) tem o significado da Web: o raio aplicado é `amount × radius` pontos, com `amount` em 0...1 (uma constante, ou um valor vinculado limitado a 0...1) e `radius` em 1...64, padrão 24. joltBlur aplica o `blur(radius:opaque: false)` do SwiftUI à view e às suas descendentes, então as bordas se dissolvem em transparência. O kernel é do SwiftUI; os pixels não são idênticos ao `filter: blur()` do CSS.

Gradientes e desfoque seguem suas fontes só enquanto uma view os mostra numa cena ativa e não estão pausados nem suspensos. Sair da tela, uma cena inativa, `pause()` ou a suspensão mantêm o último quadro; mostrar ou retomar alcança o valor atual. Nenhum dos dois assina o JoltClock; os valores vinculados são donos da reprodução. Com movimento reduzido, ângulos, stops e quantidades de desfoque vinculados mostram o alvo do motion value, enquanto as cores continuam seguindo seus valores. O descarte para de seguir, remove a pintura de todas as views e rejeita atualizações posteriores. As fontes são emprestadas e nunca descartadas pela pintura.

```swift
let angle = try scope.value(135), stop = try scope.value(0.3), tone = try scope.value(0)
let tint = try scope.retain(JoltColorValue(tone,
    from: .init(argb: 0xff7766ff), to: .init(argb: 0xffff9dce)))
let aurora = try scope.retain(JoltGradient(
    colors: [.constant(.init(argb: 0xff1b1f3a)), .value(tint), .constant(.init(argb: 0xffdbff7a))],
    stops: [0, .value(stop), 1], angle: .value(angle)))
let focus = try scope.value(0)
let soft = try scope.retain(JoltBlur(amount: .value(focus), radius: 24))
// Card().joltGradient(aurora, in: RoundedRectangle(cornerRadius: 22))
// Photo().joltBlur(soft)
try angle.animate(to: 315, transition: .tween(milliseconds: 1600))
try focus.animate(to: 1, transition: .tween(milliseconds: 700))
```

Diferenças entre plataformas: os gradientes da Web e do NativeScript também têm os tipos radial e cônico, com centro e raio, e seus próprios `animate()`, `set()` e `bind()`; o SwiftUI oferece a superfície linear, guiada por valores vinculados e `update()`. Com movimento reduzido, a Web mantém a geometria vinculada em vez de mostrar o alvo, e o NativeScript salta o ângulo para o fim enquanto cores e stops ainda fazem a transição. O desfoque do fundo (backdrop) não é oferecido: o SwiftUI não tem um filtro com raio controlado sobre o conteúdo atrás de uma view, e seus materiais aplicam desfoque e tonalidade definidos pelo sistema em vez de `amount × radius`. Desfoque uma view de fundo dedicada, como no desfoque de conteúdo do Android. O desfoque NativeScript no iOS é um material `UIVisualEffectView` em que 0,5 é metade da transição do material; SwiftUI e Web usam um raio.

A validação inclui fixtures geradas a partir do core TypeScript para a geometria dos loaders, os deslocamentos do shimmer, os raios da revelação, o easing e a projeção de stops; testes determinísticos de recursos para posse do relógio, suspensão, movimento reduzido, interrupção e descarte; testes de renderização para os cantos do gradiente, a máscara alfa do shimmer e o recorte da revelação; e interação XCTest no iOS e no macOS.

<Clip name="swiftui-effects-ios" caption="Simulador iOS, SwiftUI nativo: toques do XCTest varrem linhas de skeleton, rodam os loaders de pontos, barras e anel em botões ocupados, revelam uma superfície a partir de pontos tocados e a ocultam no meio, varrem um gradiente vinculado, desfocam um cartão e ativam o movimento reduzido. Interface em inglês. Não é uma gravação de dispositivo físico." />

<Clip name="swiftui-effects-macos" caption="App macOS, SwiftUI nativo: cliques reais conduzem o mesmo laboratório de efeitos, incluindo a revelação interrompida e o movimento reduzido. Só a janela do app; interface em inglês. Sem alegação de desempenho." />
