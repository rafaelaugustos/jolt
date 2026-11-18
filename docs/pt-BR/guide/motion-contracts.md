# Continuidade do movimento e relações entre gestos

**Candidato de código, ainda fora da versão 0.1.0-rc.15.** Este lote cobre [#497](https://github.com/rafaelaugustos/jolt/issues/497), [#502](https://github.com/rafaelaugustos/jolt/issues/502), [#503](https://github.com/rafaelaugustos/jolt/issues/503), [#504](https://github.com/rafaelaugustos/jolt/issues/504), [#505](https://github.com/rafaelaugustos/jolt/issues/505) e [#508](https://github.com/rafaelaugustos/jolt/issues/508). Não publica pacote nem altera a versão. SwiftUI continua Beta em iOS 17+ e macOS 14+.

## Relações entre controladores {#gesture-relationships}

Crie `gestureRelations()` depois de montar controladores ociosos e antes do contato. Com `waitFor`, `gesture` espera `other` falhar; `simultaneous` permite os dois; `block` deixa o alvo começar enquanto o bloqueador ainda é possível e cancela o alvo quando o bloqueador reconhece. O contato bloqueado não reinicia. Isso permite cancelar o feedback de press quando o carrossel começa a se mover.

`gestures`, `drag`, `zoomable`, `bottomSheet`, `reorder` e a função retornada por `press` expõem endpoints. O tipo padrão é `pan`, exceto `reorder` (`longPress`) e `press` (`tap`). `kind`/`otherKind` selecionam um `pan`, `pinch`, `rotate`, `tap` ou `longPress` habilitado. O sheet coordena seu pan interno; o zoomable, pan/pinch/tap. Com `dismiss:false`, a foto na escala mínima faz o pan falhar para o sheet que está esperando se mover.

```ts
import { gestureRelations } from '@rafaelaugusto/jolt/web'
// NativeScript: import from '@rafaelaugusto/jolt'.
const links = gestureRelations([
  { gesture: sheet, other: photo, relation: 'waitFor', otherKind: 'pan' },
  { gesture: photo, kind: 'pinch', other: sheet, relation: 'block' },
])
// Before destroying or remounting the participating controllers:
links.dispose()
```

A configuração aceita 1–128 relações e rejeita ciclos entre grupos, autorrelações, runtimes incompatíveis, canais desabilitados, contatos ativos e contradições entre simultaneidade e ordem antes de instalar as relações. Descarte o grupo para cancelar a entrada participante e remover suas relações. Descartar qualquer controlador também remove suas relações; recrie o grupo após unload/remontagem nativa. As relações tomam os controladores emprestados, sem possuir valores ou views.

UIKit usa requisitos de falha removíveis no delegate e política de reconhecimento simultâneo, preservando o delegate anterior. Android decide na distribuição nativa de toques, sem decisão por frame em JavaScript. Web coordena Pointer Events do Jolt, fixa `touch-action` antes do contato e compartilha pointer capture entre superfícies aninhadas. O descarte restaura a política anterior. A superfície composta aceita ancestrais transladados; escala, rotação e perspectiva nos ancestrais ficam fora do contrato de coordenadas. Tempos de eventos e limiares nativos podem variar.

`nativeGestureRecognizer(native, kind)` é uma entrada opcional do NativeScript para um reconhecedor UIKit do app ou `org.rafaelaugusto.jolt.GesturePeer` no Android. Descartar esse handle remove relações sem destruir o reconhecedor do app. Ele não envolve detectores Android arbitrários. Na navegação interativa, coordene o controlador zoom/drag que origina a interação; edge-back do sistema e predictive-back não são endpoints de `sharedNavigationEntry()`.

## Continuidade e desenho retido no SwiftUI {#swiftui-contracts}

`JoltTimelineTrack.velocity` aceita uma substituição finita em unidades do valor/segundo. A primeira faixa no tempo zero, com `from` implícito, herda a velocidade amostrada **na construção da timeline**. Fontes pausadas/suspensas contribuem zero; `from` explícito, faixas atrasadas e etapas posteriores começam em zero, salvo substituição. `sequence` usa a mesma velocidade resolvida para calcular a duração das etapas. `autoplay:false` mantém a amostra da construção. Seek continua determinístico; cancelamento libera a propriedade e pausa/suspensão são independentes.

`connectEdgeScroll` dá aos grips próprios de reorder o relógio de borda já existente no modelo. Retenha seu `JoltObservation`; o callback recebe -1/+1 e retorna se ainda é possível rolar. Informe medidas reais das linhas, coordenadas do ponteiro/viewport e offset atual pelos métodos existentes. Trocar/desconectar o viewport cancela o contato; descartar a conexão antiga não desliga a nova. Suspensão, remoção do item e descarte do modelo param o trabalho de borda. As ações da linha podem ficar fora do grip.

`JoltParticles.emit(duration:nil)` emite até cancelamento/descarte ou até Reduced Motion finalizar o efeito. O padrão continua finito: 2000 ms. A taxa é partículas/segundo (0,1000], lifetime usa milissegundos e `ceil(rate × lifetime / 1000)` deve caber na capacidade (1–2000). O armazenamento permanece limitado; frames atrasados pulam nascimentos expirados sem acumular trabalho. As identidades de nascimento continuam estáveis após 60 segundos. Pausa/suspensão congelam o tempo independentemente; `cancel()` limpa o campo e o descarte libera o relógio. Geometria usa pontos locais, velocidade pontos/segundo, gravidade pontos/segundo² e rotação graus/segundo.

`JoltSVGPath` aceita M/L/H/V/C/S/Q/T/A/Z absolutos/relativos, coordenadas repetidas e expoentes. Normaliza para M/L/C/Q/Z, converte arcos em cúbicas e preserva subpaths/fechamento. Limites: 20.000 bytes UTF-8, 256 comandos normalizados e coordenadas em ±1.000.000. Fixtures TypeScript/Swift compartilhadas verificam a normalização. `JoltPath` continua sendo a API separada de trajetória medida.

```swift
let replacement = try JoltTimeline(tracks: [
  .init(x, to: 120),                     // inherit current velocity
  .init(y, to: 40, velocity: -80)        // explicit units/second
])
let edge = try model.connectEdgeScroll { direction in
  scrollOneRow(direction)              // return false at the viewport boundary
}
// Retain edge alongside the custom viewport; call edge.dispose() on teardown.
try particles.emit(rate: 12, duration: nil, seed: 1)
let path = try JoltSVGPath("M10 10H90V90H10Z M35 35H65V65H35Z")
let drawing = try JoltDrawing([
  .init(.svg(path), fill: .init(argb: 0xffdbff7a),
        stroke: .init(argb: 0xff7766ff), lineWidth: 3,
        strokeStart: 0.1, strokeEnd: 0.9,
        lineCap: .square, lineJoin: .bevel, fillRule: .evenodd)
])
// JoltDrawingView(drawing, viewBox: try JoltViewBox(0, 0, 100, 100), accessibilityLabel: "Window")
try drawing.morphPath(at: 0, to: anotherCompatiblePath)
```

`JoltDrawingView` desenha a geometria retida em um Canvas. Fill rule: nonzero/evenodd; caps: butt/round/square; joins: miter/round/bevel. `strokeStart`/`strokeEnd` por forma e os valores opcionais da view usam 0…1 e se intersectam; um intervalo vazio esconde o traço, preservando o preenchimento. A largura usa unidades do desenho, 0…1000. Um `viewBox` explícito, finito e positivo escala x/y independentemente até o viewport; não preserva proporção automaticamente. Sem ele, as coordenadas são pontos locais.

Há um morph por desenho. Os caminhos precisam dos mesmos comandos/subpaths normalizados; entrada incompatível falha antes de cancelar o trabalho atual. A substituição amostra o caminho visível no instante do comando e preserva o estilo. `pause`/`play`, `suspend`/`resume`, cancelamento, cena inativa, Reduced Motion e descarte usam o ciclo de vida do relógio existente. Cancelar preserva a geometria amostrada; descartar limpa o desenho. O inicializador `strokeProgress` anterior segue válido. Não há hit testing, conversão de topologia arbitrária ou promessa de pixels iguais entre nativo e navegador.

## Velocidade da mola pausada {#paused-velocity}

No Web, `springValue.getVelocity()` e grafos derivados agora retornam zero imediatamente durante pausa ou quando o runtime está oculto, acompanhando o contrato nativo. Retomar preserva o impulso; `stop()` o zera. A posição fica congelada durante a pausa. A correção também invalida valores dependentes sem criar outro loop. As gravações nativas verificam o comportamento já existente no iOS/Android.

## Evidências por plataforma {#evidence}

Web já oferece velocidade de timeline, emissão contínua, estilo/morph SVG e autoscroll de reorder por chave. O lote reutiliza essas APIs; veja [orquestração Web](./web-orchestration), [efeitos Web](./web-effects) e [gestos Web](./web-gestures). As novidades Web são reconhecimento entre controladores e propagação da derivada pausada. Os testes cobrem espera aninhada nos dois sentidos, press/carrossel, swipe/reorder e foto/sheet em iOS, Android e Chromium; política com mouse e pausa também rodam em Firefox/WebKit. A injeção multitoque confiável é exclusiva do Chromium. Os vídeos estão na velocidade original e não comparam desempenho de hardware.

<Clip name="gesture-relations-ios" caption="iPhone 17 Pro, simulador iOS 27: toques reais do XCTest mostram espera aninhada nos dois sentidos, press/carrossel, swipe/reorder e foto/sheet. Interface em inglês." />

<Clip name="gesture-relations-android" caption="Pixel 7, emulador Android API 36: entrada real do sistema mostra os mesmos casos. Indicador de toques ligado; interface em inglês." />

<Clip name="gesture-relations-web" caption="Chromium no macOS: mouse e toque/pinch confiáveis; cenários separados unidos na velocidade original. Interface em inglês." />

<Clip name="spring-velocity-ios" caption="Simulador iOS 27: posição congelada, velocidade direta e derivada zeradas; retomada preserva o impulso. Interface em inglês." />

<Clip name="spring-velocity-android" caption="Emulador Android API 36: pausa/retomada reais, com velocidade e derivada zeradas na pausa. Interface em inglês." />

<Clip name="spring-velocity-web" caption="Chromium no macOS: pausa, retomada e stop reais com velocidade derivada. Interface em inglês." />

<Clip name="swiftui-motion-contracts-ios" caption="iPhone 17 Pro, simulador iOS 27: substituição com velocidade, morph/trim SVG, partículas além de 60 segundos e autoscroll com grip próprio e ações de linha. XCTest real; velocidade original; interface em inglês." />

<Clip name="swiftui-motion-contracts-macos" caption="App nativo macOS: cliques e drag reais mostram os mesmos contratos SwiftUI, incluindo mais de 60 segundos de partículas contínuas. Velocidade original; interface em inglês." />
