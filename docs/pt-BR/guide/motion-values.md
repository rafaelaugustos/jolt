# Valores de movimento

Para um spring persistente que segue um valor variável, veja [`springValue()`](./live-springs).

Um valor de movimento é um número que anima nativamente e controla toda propriedade de view ligada a ele. Um único valor pode mover um sheet, escurecer o fundo e encolher a página por trás, tudo no mesmo relógio nativo:

```ts
import { animate, bind, motionValue } from '@rafaelaugusto/jolt'

const progress = motionValue(0)
bind(page, { scale: progress.to([0, 1], [1, 0.92]) })
bind(backdrop, { opacity: progress.to([0, 1], [0, 0.45]) })
bind(sheet, { y: progress.to([0, 1], [200, 0]) })

animate(progress, 1, 'snappy')
```

<Clip name="motion-values-ios" caption="Um valor de movimento abre e fecha um sheet, escurece o fundo e encolhe a página, no simulador iOS. Velocidade real." />

## Mapeando

`to(input, output)` mapeia um valor por faixas de entrada e de saída, como o `interpolate` do React Native: em trechos lineares, segurando as saídas dos extremos fora da faixa de entrada. Passe `{ clamp: false }` para estender os trechos dos extremos, permitindo que o avanço além do destino de uma mola chegue até a view. As entradas podem aumentar ou diminuir, mas não podem mudar de direção. Devem ser finitas, com pelo menos duas entradas e uma saída por entrada.

```ts
const y = progress.to([0, 0.4, 1], [600, 120, 0])
const tint = progress.to([0, 1], ['#18181B', '#FACC15']) // cores se misturam em OKLab
const bounce = progress.to([0, 1], [0, 300], { clamp: false })
```

Para um sheet cujo offset vai de `closed` até `0`, mapeie essa direção diretamente. Cada saída continua associada à sua entrada, inclusive nas cores:

```ts
const closed = 380
const offset = motionValue(closed)
const open = offset.to([closed, 0], [0, 1])
bind(sheet, { y: offset })
bind(page, { scale: open.to([0, 1], [1, 0.9]) })
bind(backdrop, { opacity: open.to([0, 1], [0, 0.5]) })
animate(offset, 0, 'snappy')
```

O resultado equivale a `offset.to([0, closed], [1, 0])`, sem alterar seus arrays. A extrapolação numérica funciona nas duas direções; cores sempre respeitam os limites. Faixas inválidas como `[0, 1, 0]` lançam erro na chamada de `to()`.

<Clip name="descending-values-ios" caption="Uma faixa decrescente de offset controla o fundo e a escala da página, incluindo mapeamentos encadeados, arraste e soltura com mola, no simulador iOS. Velocidade real." />

<Clip name="descending-values-android" caption="Faixas decrescentes, mapeamentos encadeados e gestos reais na folha, no emulador Android. Reprodução em tempo real." />

Entradas repetidas preservam o comportamento de degrau existente, considerando os pares em ordem crescente: exatamente numa parada repetida interna, vale a saída do trecho inferior; logo acima, vale a última saída daquela parada. O clamp tem prioridade nos extremos. Uma faixa com todas as entradas iguais mantém a primeira saída até a parada, inclusive, e a última acima dela; com `clamp: false`, exatamente na parada o resultado passa a ser a segunda saída.

Um número mapeado pode ser mapeado de novo. Saídas de cor se ligam a `backgroundColor`, `borderColor` e `color`; saídas numéricas se ligam a todo o resto que o `animate()` aceita, e `scale` define os dois eixos. Um valor também pode ser ligado direto: `bind(dot, { x: offset })`.

## Animando e aplicando

`animate(value, to, transition)` recebe um número ou keyframes e as mesmas transições do `animate()`: tweens, molas, `repeat`, `repeatType`, `repeatDelay`, `delay` e `easeTrack`. Devolve uma [`PlaybackAnimation`](./playback), incluindo pausa, retomada e progresso finito. O Jolt amostra a curva do valor uma vez, mapeia por cada ligação e toca um track nativo por propriedade ligada, todos começando juntos. As ligações nativas dispensam callbacks por quadro em JavaScript.

```ts
animate(progress, 1, 'snappy')
animate(progress, [0, 1, 0.6], { duration: 700, times: [0, 0.5, 1] })
animate(pulse, 1, { duration: 900, repeat: Infinity, repeatType: 'reverse' })
```

Uma animação que interrompe outra começa do valor na tela, com a velocidade dele, então todas as views ligadas viram juntas. `set(value, número)` aplica um valor a todas as views ligadas na hora. `stop(value)` segura o valor e as views onde estão. `value.get()` lê o valor agora, inclusive durante a animação.

Com [redução de movimento](./configure#reducao-de-movimento), transformações ligadas pulam para o fim enquanto opacidade e cores continuam animando. A [escala de tempo](./configure#escala-de-tempo) vale uma vez, na curva do valor.

## Observando fora das views

`value.subscribe((valor, tempo) => ...)` acompanha um valor pelo JavaScript, incluindo derivações numéricas, cores e valores de rolagem. Entrega o valor atual imediatamente e devolve uma função de cancelamento que pode ser chamada mais de uma vez. Passe `{ immediate: false }` para receber somente as próximas mudanças.

```ts
const release = progress.subscribe((value, time) => {
  // Por exemplo, atualize uma pose no SceneKit ou um renderizador nativo próprio.
  stage.setProgress(value)
})
const releaseColor = progress.to([0, 1], ['black', 'white']).subscribe((color) => {
  stage.setTint(color)
})

// Controle de ciclo de vida, incluindo suspensão e retomada do escopo:
scope.use(() => progress.subscribe((value) => stage.setProgress(value)))
release()
releaseColor()
```

As atualizações compartilham uma fonte de quadros baseada no agendamento CADisplayLink/Choreographer do NativeScript. Cada lote captura todas as fontes observadas antes de chamar os listeners e fornece o mesmo instante do relógio nativo, em milissegundos. Chamadas repetidas de `set()` antes de um quadro entregam somente o valor mais recente; saídas mapeadas que não mudaram não notificam. Conclusão e parada entregam o valor final no próximo quadro, se ele mudou. Uma escrita feita dentro de um callback entra no próximo lote.

Os callbacks executam JavaScript e aguardam enquanto essa thread estiver bloqueada. Para targets nativos externos compatíveis, os [adaptadores de propriedades nativas](./native-properties) opcionais oferecem playback e bindings compilados. As ligações comuns de views não exigem uma assinatura; os limites de execução da plataforma continuam valendo.

Cancelar a assinatura tem efeito inclusive durante a entrega e não interrompe a animação. A fonte de quadros fica ociosa depois que as fontes observadas se estabilizam e as escritas pendentes são entregues. Em segundo plano, a entrega para; ao voltar, lê o valor atual sem reproduzir os quadros perdidos. Erros de listeners vão para o trace de erros do NativeScript e não interrompem os demais. Use `scope.use()` ou chame a função devolvida quando o consumidor for destruído.

Com redução de movimento, o track escalar preserva seu tempo; transformações ligadas podem já estar no destino enquanto assinantes e cores ainda acompanham o escalar. Consumidores externos devem respeitar `reducedMotion()` ao aplicar movimento espacial. A escala de duração dos animadores do sistema Android continua valendo nos relógios nativos, inclusive com animadores desativados.

<Clip name="value-observers-ios" caption="Uma view vinculada e um CALayer externo seguem o mesmo valor; remoção e reconexão da assinatura no simulador iOS. Callbacks executam em JavaScript. Reprodução em tempo real." />

<Clip name="value-observers-android" caption="Uma view vinculada e uma View Android direta seguem o mesmo valor, com remoção, reconexão e parada, no emulador Android. Callbacks executam em JavaScript. Reprodução em tempo real." />

## Camadas em um valor

Uma camada nomeada soma um deslocamento escalar ao motion value **antes** dos mapeamentos. A animação base mantém seu tempo e sua velocidade enquanto um pulso de carga altera todos os consumidores juntos:

```ts
const charge = motionValue(0)
bind(car, {
  y: charge.to([0, 1], [0, -20]),
  scale: charge.to([0, 1], [1, 1.08]),
  backgroundColor: charge.to([0, 1], ['#14b8a6', '#6366f1']),
})
animate(charge, 1, { duration: 4000 })
animate(charge, [0, 0.12, -0.12, 0], {
  duration: 1200,
  repeat: Infinity,
  layer: 'pulse',
})
```

Camadas de valores sempre somam, inclusive quando um binding mapeia o resultado para escala, opacidade ou cor. Seu valor neutro é `0`. Isso difere das [camadas em propriedades de views](./layers), que multiplicam escala e opacidade. Clamping, mapeamentos por trechos e mistura de cores recebem o escalar combinado; `get()` e `subscribe()` recebem a mesma composição.

<Clip name="value-layers-ios" caption="Um pulso de carga soma à posição, escala e cor enquanto a base continua; mudança de destino, remoção do pulso e reset, no simulador iOS. O ponto cinza mostra somente a base. Reprodução em tempo real." />

Cada nome tem sua animação e velocidade. Alterar o destino daquele nome substitui somente aquela camada; animar sem `layer` substitui somente a base. Uma camada concluída mantém sua contribuição final até ser removida. O `PlaybackAnimation` retornado também oferece pausa, retomada e progresso finito daquele canal; a pausa mantém sua contribuição enquanto os outros continuam. Parar o handle de uma camada ativa remove sua contribuição; parar o handle da base congela a base e mantém as camadas. Um handle já encerrado não faz nada.

```ts
stop(charge, { layer: 'pulse' }) // remove inclusive uma contribuição concluída
// Ou anime a contribuição de volta a zero antes:
await animate(charge, 0, { duration: 250, layer: 'pulse' })
stop(charge, { layer: 'pulse' })
stop(charge) // congela a composição como nova base e limpa as camadas
set(charge, 0) // cancela todos os canais e substitui o valor
```

Arrastar um motion value altera somente sua base. Limites, pontos de encaixe, posição do controlador e eventos do gesto usam unidades da base; as camadas podem levar o resultado combinado além desses limites. A camada continua durante o arraste e a soltura. Valores de scroll continuam sendo entradas somente de leitura e não oferecem camadas de animação.

Os bindings reproduzem uma composição nativa compilada. Ela é reconstruída nas alterações dos canais e nos eventos de arraste, não a cada quadro. Períodos infinitos com milissegundos inteiros usam um loop nativo comum de até 30 segundos; combinações maiores ou fracionárias, e composições finitas de mais de quatro segundos, usam janelas reconstruídas nas bordas. Relógios nativos preservam a fase de cada canal. Usar `subscribe()` acrescenta notificações em JavaScript.

<Clip name="value-layers-android" caption="A mesma base e pulso aditivo, com mudança de destino e limpeza, no emulador Android. O ponto cinza mostra somente a base. Reprodução em tempo real." />

## Ligando

`bind(views, bindings)` dá às views o estado atual dos valores na hora e as mantém acompanhando. Devolve uma função de limpeza: depois dela, as views ficam onde estão. `motionScope().use(() => bind(...))` prende uma ligação a um escopo.

Um valor dura mais que as views. Uma view que ainda não carregou recebe o valor quando carregar, e entra numa animação em andamento no ponto em que ela está. Um `animate()` ou `set()` comum numa propriedade ligada assume essa propriedade no valor e na velocidade atuais; o valor continua controlando as outras ligações. `stop(view)` para o movimento na tela, mas mantém a ligação.

## Vue

`useMotionValue()` cria um valor que para quando o componente desmonta. `useBinding()` devolve um template ref que liga ao montar e solta ao desmontar, então um elemento recriado por `v-if` pega o valor de novo:

```vue
<script setup lang="ts">
import { animate } from '@rafaelaugusto/jolt'
import { useBinding, useMotionValue } from '@rafaelaugusto/jolt/vue'

const progress = useMotionValue(0)
const sheet = useBinding({ y: progress.to([0, 1], [200, 0]) })
const toggle = (open: boolean) => animate(progress, open ? 1 : 0, 'snappy')
</script>

<template>
  <GridLayout :ref="sheet" />
</template>
```

<Clip name="motion-values-android" caption="O mesmo sheet no emulador Android, incluindo um toque no meio do caminho que faz as três views virarem juntas. Velocidade real." />

## Offsets de rolagem

`scrollValue(scrollView)` é o offset de um ScrollView como um valor, em DIPs. Ligue-o como qualquer valor de movimento; cada evento de rolagem escreve as propriedades ligadas direto, sem animação no meio:

```ts
import { bind, scrollValue } from '@rafaelaugusto/jolt'

const offset = scrollValue(scroll)
bind(header, { y: offset.to([0, 90], [0, -64]) })
bind(title, { scale: offset.to([0, 90], [1, 0.72]), y: offset.to([0, 90], [0, 30]) })
bind(subtitle, { opacity: offset.to([0, 50], [1, 0]) })
bind(progress, { scaleX: offset.to([0, 700], [0, 1]) })
```

<Clip name="scroll-values-ios" caption="Rolar a lista recolhe o cabeçalho, encolhe o título, apaga o subtítulo e enche a barra de progresso, no simulador iOS. Velocidade real." />

`{ axis: 'x' }` segue o offset horizontal. O valor começa do offset atual, e `offset.ref(scrollView)` passa a seguir outro ScrollView, ou nenhum com `null`. `offset.dispose()` para de seguir e deixa as views ligadas onde estão. No Vue, `useScrollValue()` devolve um valor cujo `ref` vai no template ref do ScrollView, e para junto com o componente:

```vue
<script setup lang="ts">
const offset = useScrollValue()
const header = useBinding({ y: offset.to([0, 90], [0, -64]) })
</script>

<template>
  <ScrollView :ref="offset.ref">...</ScrollView>
  <GridLayout :ref="header" />
</template>
```

Os eventos de rolagem chegam no JavaScript, como no [`scrollLinked()`](./scroll-linked). Com cinco propriedades ligadas, um evento custa cerca de 0,25 a 0,3 ms no simulador iOS e no emulador Android, cerca de metade da configuração equivalente com `scrollLinked()` no Android; veja as [medições](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/scroll-values.md).

<Clip name="scroll-values-android" caption="O mesmo cabeçalho seguindo a lista no emulador Android. Velocidade real." />

## Arrastando

`drag(view, { axis, value })` escreve a posição do dedo num valor em vez de mover a view, e depois toca a soltura no valor. Tudo o que está ligado a ele segue o dedo e o arremesso junto. O gesto é lido na view que você passa; ligue essa view também se ela deve se mover:

```ts
import { bind, drag, motionValue } from '@rafaelaugusto/jolt'

const closed = 380
const y = motionValue(closed)
bind(sheet, { y })
bind(page, { scale: y.to([0, closed], [0.9, 1]) })
bind(backdrop, { opacity: y.to([0, closed], [0.5, 0]) })
bind(hint, { opacity: y.to([closed / 2, closed], [0, 1]) })

drag(sheet, {
  axis: 'y',
  value: y,
  bounds: { top: 0, bottom: closed },
  snap: [0, closed / 2, closed],
  rubberband: true,
})
```

<Clip name="drag-values-ios" caption="Um sheet arrastável controla um valor de movimento que escala a página, escurece o fundo e apaga a dica, com pontos de encaixe, rubberband e o mesmo valor animado por um botão, no simulador iOS. Velocidade real." />

`axis` é `'x'` ou `'y'`. Limites, pontos de encaixe e o eixo arrastado nos eventos ficam nas unidades do valor; o outro eixo vem 0. O resto funciona como no [`drag()`](./drag): rubberband, atrito, callbacks e o controller. A soltura é a mesma curva, calculada uma vez e tocada nativamente por cada propriedade ligada, sem nada no JavaScript até terminar. O `onRelease` recebe uma [`Animation`](./api#animacoes) em vez de uma `PlaybackAnimation`. Tocar na view durante a soltura, ou durante um `animate(value, ...)`, para o valor onde ele está, e o gesto continua dali.

Cada evento de pan escreve as propriedades ligadas direto. Com seis propriedades ligadas, um evento custa mais ou menos o mesmo que escrevê-las à mão no `onMove`: cerca de 0,8 ms no simulador iOS e de 0,25 a 0,35 ms no emulador Android; veja as [medições](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/drag-values.md). No Vue, comece o arrasto a partir do `useMotionScope()` no `onMounted`, como faz a tela **Drag values** do demo.

<Clip name="drag-values-android" caption="O mesmo sheet no emulador Android, com arremessos reais nas duas direções e uma pegada enquanto a animação do botão ainda roda. Velocidade real." />

## Caminhos de execução {#what-comes-next}

Valores e [camadas de propriedades](./layers) podem ser combinados. O [RFC #152](https://github.com/rafaelaugustos/jolt/issues/152) original deu origem a caminhos de execução distintos:

| Entrada                                                                                                                                | Execução                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Valores e camadas guiados por timelines                                                                                                | TypeScript prepara curvas e composições; tracks nativos reproduzem entre mudanças e limites das janelas de composição. |
| `drag()` e `scrollValue()`                                                                                                             | JavaScript trata cada evento de entrada e atualiza os bindings; a soltura do drag usa uma curva nativa preparada.      |
| [Gestos nativos](./gestures), [springs contínuas](./live-springs), [sensores](./device-sensors) e [headers de scroll](./scroll-header) | As entradas e ligações compatíveis são avaliadas nativamente, com JavaScript na configuração e no ciclo de vida.       |
| `subscribe()`                                                                                                                          | Observação explícita em JavaScript por uma fonte de quadros compartilhada.                                             |

Uma fonte nativa contínua não transforma `drag()` ou `scrollValue()` comuns em caminhos de eventos nativos. Cada guia documenta suas propriedades e seu ciclo de vida. Os limites de bindings/camadas em aparelhos físicos e as medições em telas mais carregadas continuam na [#242](https://github.com/rafaelaugustos/jolt/issues/242).

## Custos medidos de bindings {#binding-measurements}

A [auditoria de bindings e camadas](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/binding-budgets.md) cobre 22 cargas em um iPhone 17 Pro físico, com uma rodada adicional no emulador Android. Ela separa preparação, reprodução nativa, limites das janelas de composição e observação explícita em JS. Os tempos do emulador Android não estabelecem a capacidade de um celular.

Nesse iPhone, a carga de motion value com 64 views e três propriedades gastou **82–95 ms** para reconstruir cada janela de composição. O caso com loops compatíveis não enviou novas tracks durante a reprodução. Mesmo 16 views ultrapassaram um intervalo de 60 Hz no limite da janela. Prefira loops nativos compatíveis para movimentos repetidos e meça muitas vinculações antes de usar composição por janelas durante uma interação. São observações dessas cargas, não um número máximo universal de bindings.

A auditoria de entrada usa gestos reais para `drag()`, pan nativo, `scrollValue()` e `scrollHeader()`. Os caminhos nativos não registraram callbacks JS por movimento; todos voltaram a zero trabalho rastreado após o descarte. Callbacks de exibição não são FPS apresentados, e a latência entre entrada e imagem não foi medida. Consulte os dados brutos, o escopo de CPU/memória e a aceitação física pendente na [#242](https://github.com/rafaelaugustos/jolt/issues/242).

Uma [auditoria posterior em Android físico](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/binding-budgets.md#physical-android-follow-up-2026-10-30) executou as 22 cargas e 66 repetições em um ASUS_Z017DC, Android 8 / API 26, além de quatro janelas automáticas de gesto/scroll. Vinte cargas passaram nos checks de diagnóstico; duas janelas com poucas amostras continuam registradas como falhas. Mesmo a reconstrução da janela de composição com uma view levou **116–130 ms** nessa rodada. Os dois caminhos nativos de entrada usaram zero callbacks JS por movimento, e os quatro testes liberaram os recursos rastreados. Essa versão do sistema não informa o estado térmico, portanto as observações não estabelecem capacidade em condições térmicas controladas. Os vídeos existentes abaixo mantêm os rótulos originais de plataforma; as novas medições Android não foram gravadas.

<Clip name="binding-budget-ios" caption="iPhone 17 Pro físico espelhado pelo Device Hub: um toque real inicia a carga de 64 views, três propriedades e janelas de composição. Interface em inglês, tempo original; rodada separada das medições sem gravação. O espelhamento não mede frames apresentados." />
<Clip name="binding-budget-android" caption="Emulador Android: gestos reais do ADB movem 64 views por pan nativo, seguidos do descarte. Interface em inglês, tempo original; demonstração separada, sem estabelecer a capacidade de um Android físico." />
