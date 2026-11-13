# Valores combinados, scroll e listas por chave

**Candidato para a próxima RC; ainda não publicado na RC.14.** Abrange #494, #495, #498, #499, #500 e #501. Recompile o aplicativo nativo após atualizar. Os vídeos mostram interação real em simuladores, emulador e navegador; não comprovam desempenho em aparelho físico.

## Combinar valores numéricos

```ts
import { animate, bind, motionValue } from '@rafaelaugusto/jolt'
const a = motionValue(0)
const b = motionValue(0)
const x = a.add(b).mul(0.65).clamp(0, 300)
const detach = bind(card, { x })
animate(a, 180, 'snappy')
animate(b, 90, 'smooth')
// Ao desmontar: detach(); x.dispose(); a.dispose(); b.dispose()
```

Na Web, crie as entradas no mesmo `runtime.motionValue()` e use `runtime.bind()` / `runtime.animate()`. O binding Web expõe `dispose()`; o nativo retorna uma função de limpeza. Os mapeamentos `.to()` e seguidores existentes continuam disponíveis.

`add`, `sub`, `mul`, `div`, `min` e `max` aceitam outro valor numérico ou uma constante finita. `abs`, `clamp`, `sin`, `cos` e `velocity` completam a álgebra. Trigonometria usa radianos; velocidade usa unidades da entrada por segundo. Divisão por zero e resultados não finitos produzem zero. Empates de min/max e extremos limitados têm velocidade zero. A derivada do nó `velocity()` é zero: ele não estima aceleração. Os grafos imutáveis não permitem ciclos; limite de 32 níveis e programa nativo de 1.024 nós. Cores ficam fora dessa álgebra.

Entradas temporais finitas compilam tracks nativas; entradas vivas usam o avaliador nativo. O scheduler Web avalia fontes compartilhadas uma vez por amostra. Não há callbacks arbitrários no grafo nativo. Descartar uma saída não destrói suas entradas emprestadas; descartar uma entrada encerra seus grafos dependentes. Libere bindings, saídas e fontes no ciclo de vida do dono. Isso não muda o compartilhamento da thread principal entre UI e JavaScript do NativeScript.

<Clip name="values-scroll-ios" caption="Simulador iOS: duas entradas combinadas, interrupção, reinício e scroll real alimentando uma barra por binding nativo." />
<Clip name="values-scroll-android" caption="Emulador Android: valores combinados e scroll nativo. A auditoria conta callbacks do Jolt; o Core pode emitir seus próprios eventos JavaScript." />
<Clip name="combined-values-web" caption="Chromium: duas entradas animadas, interrupção e barra ligada ao scroll real do navegador." />

## Fontes nativas de scroll

```ts
const offset = scrollValue(scrollView, { axis: 'y', execution: 'native' })
const progress = offset.to([0, 500], [0, 1])
const detach = bind(meter, { scaleX: progress })
// detach(); offset.dispose()
```

`execution` aceita `auto`, `native` e `javascript`; o resultado informa o modo selecionado. O fallback JavaScript atende Core ScrollView. Forçar `native` sem a bridge gera erro. `refresh()` relê geometria e `ref(next)` troca a fonte. Unload, background e descarte removem os observers. Assinaturas explícitas com `subscribe()` habilitam notificações Jolt; apenas bindings nativos não acrescentam callbacks Jolt por evento. O Core ainda pode emitir seus próprios eventos JavaScript.

Offsets usam DIPs no Android e pontos no iOS. O iOS normaliza o inset inicial ajustado e preserva bounce negativo. ListView Android exige linhas fixas e considera divisores; RecyclerView precisa de layout linear, stride fixo, sem ordem invertida, stack-from-end, grids ou seções. iOS aceita subclasses UIScrollView, incluindo tabelas e coleções. `scrollLinked()` compila keyframes elegíveis de transform, opacidade e pintura em bindings; outras propriedades mantêm o caminho anterior de scrub.

Na Web, reutilizamos `runtime.scrollValue()` e `scrollLinked()`. Um `.to()` numérico direto e limitado, com intervalo não negativo compartilhado, pode usar ScrollTimeline. Álgebra, intervalos diferentes, falta de suporte e escala com extremos não positivos usam o scheduler compartilhado. Isso não promete pixels, overscroll ou execução em threads iguais aos nativos.

## Saídas e grupos Vue

```ts
animateLayout(container, () => container.removeChild(card), {
  duration: 500,
  exit: { opacity: 0, y: 16, scale: 0.92 },
})
// Web: runtime.animateLayout(container, () => card.remove(), mesmasOpcoes)
```

A remoção imediata continua sendo o padrão. `exit` aceita `'fadeOut'`, `false` ou objeto com `opacity`, `x`, `y` e `scale` uniforme positivo. A mesma transição finita dirige movimentos e saídas. `maxSnapshotPixels` soma os pixels das cópias da operação: padrão 8 milhões, intervalo de 1 a 32 milhões. Só filhos efetivamente removidos durante a mutação/próximo layout são capturados. `finished` aguarda movimentos e saídas.

O NativeScript desmonta a view nativa durante a remoção; por isso usamos cópias estáticas limitadas. Elas não recebem entrada nem acessibilidade e desaparecem ao interromper, reinserir, desmontar, entrar em background, reduzir movimento ou descartar. Views incompatíveis ou acima do orçamento saem imediatamente. A captura nativa exige conteúdo 2D totalmente visível, sem rotação, com escala uniforme e ancestrais opacos. Vídeo, texturas, WebView e superfícies internas de scroll ficam fora do contrato. Conteúdo fica congelado; editores vivos e foco não são transferidos para a cópia.

A Web copia a apresentação DOM. Formulários, custom elements, canvas/vídeo, pseudo-elementos e ancestrais rotacionados/3D não são suportados. Os hooks locais cobrem `removeChild`, `remove`, substituições e troca de texto/HTML do container; chamadas por métodos de protótipo guardados ou movimentos implícitos para outro pai não são capturados. Sem popovers, a remoção é imediata. Use mutações síncronas e filhos diretos.

```vue
<JoltTransitionGroup :enter="true" leave="fadeOut" move="snappy">
  <Label v-for="item in items" :key="item.id" :text="item.title" />
</JoltTransitionGroup>
```

Importe de `/vue` (container padrão `StackLayout`) ou `/web/vue` (`div`, com `runtime` emprestado opcional). `tag` escolhe o container, `enter` controla fade, `leave` segue o contrato de saída e `move` define a transição. Desativação/unmount encerra a operação. SwiftUI já oferece `ForEach` e transitions; não criamos outro grupo.

<Clip name="layout-exits-ios" caption="Simulador iOS: remoção, inserção e reordenação juntas, remoções sucessivas, cancelamento, reinserção e movimento reduzido." />
<Clip name="layout-exits-android" caption="Emulador Android: cópias nativas de saída, movimento dos vizinhos, interrupção, reinserção e movimento reduzido." />
<Clip name="layout-exits-web" caption="Chromium: alterações DOM e cancelamento, seguidos pelo grupo Vue real. As cópias usam inert e aria-hidden." />

## Listas recicladas por chave

```ts
const changes = listChanges(listView, {
  key: (item) => item.id,
  rowHeight: 60,
  exit: 'fadeOut',
  move: 'snappy',
})
const animation = changes.update(nextItems)
// scope.add(changes), ou changes.dispose() ao destruir o dono
```

O primeiro adaptador atende Core ListView plano com altura fixa positiva. `rowHeight` configura a propriedade em DIPs; sem essa opção, a altura é lida após carregar a lista. Atualizações exigem uma lista carregada com altura resolvida. Envie arrays imutáveis a `update()` com chaves únicas string ou número finito. O diff considera todos os dados, anima apenas linhas realizadas e visíveis e mantém a chave/posição interna da primeira linha visível. Se ela foi removida, usa o índice remanescente mais próximo. Atualizações interrompidas partem da apresentação atual; reciclagem limpa apenas propriedades pertencentes à operação. Itens existentes que chegam de fora da tela não recebem animação de entrada. Seções, grids, transições de CollectionView e movimentos entre listas ficam fora desta primeira versão.

`stop()` cancela movimento e mantém os dados já aplicados. `pause()` torna atualizações seguintes imediatas até `play()`. Unload descarta o controlador nativo; crie outro no próximo carregamento. Background e movimento reduzido cancelam transições decorativas. A restauração de foco procura a chave visível sobrevivente e o caminho de descendentes quando o template permanece compatível. Itens removidos/fora da tela não forçam mudança de foco.

```ts
const changes = runtime.listChanges(container, {
  key: (item) => item.id,
  scroll: viewport,
  exit: 'fadeOut',
  move: 'snappy',
  adapter: {
    items: () => items,
    render(next) {
      items = [...next]
      reconcileKeyedDOM(items)
    },
    rows: () => items.map((item) => ({ key: item.id, target: elements.get(item.id)! })),
  },
})
```

A Web não virtualiza dados nem renderiza filhos do framework. O adaptador atualiza DOM por chave sincronicamente, retendo nós sobreviventes e foco dos descendentes. Virtualizadores devem declarar `virtualized: true`, devolver linhas realizadas, implementar `observeRecycling(recycle)` com aviso antes de reutilizar o elemento e `anchor(keys)`, retornando uma função que restaura chave/índice e offset após o commit. Descarte o controlador com o dono; remover o container também o descarta. Não combine dois donos de layout nas mesmas linhas.

<Clip name="list-changes-ios" caption="Simulador iOS, 200 linhas Core ListView: scroll, inserção preservando posição, remoção, reverse/filter interrompidos e movimento reduzido." />
<Clip name="list-changes-android" caption="Emulador Android, 200 linhas fixas: reciclagem nativa, atualizações por chave, interrupção e auditoria da fonte de scroll." />
<Clip name="list-changes-web" caption="Chromium, 200 linhas DOM retidas por chave: inserção acima da área visível, remoção, reverse/filter e interrupção. Este exemplo não é um virtualizador." />

## Scroll estrutural e cabeçalhos SwiftUI

```swift
let combined = try a.add(b).mul(0.65)
card.joltBind(.x, to: combined)
let controller = try JoltScrollHeaderController(
  geometry: .init(expanded: 180, minimum: 48, section: 32, parallax: 50)
)
```

`JoltComputedValue` compartilha o clock das entradas e participa de `JoltScope`. A fonte de velocidade se chama `velocityValue()`, pois `JoltMotionValue.velocity` já lê um número. O SwiftUI continua responsável pela invalidação de views.

`JoltScrollHeader(controller:artwork:title:toolbar:compactTitle:section:content:)` fornece spacer, toolbar/seção fixos, troca de título e parallax decorativo. Marque linhas com `.joltScrollAnchor(id)` antes de `await controller.preserveAnchor { ... }`. `scrollTo`, `scrollToTop` e `remeasure` assíncrono usam o scroll nativo iOS/macOS. Entrada do usuário, pausa e descarte cancelam movimento programático. Mudanças de geometria preservam a posição, salvo quando uma operação mais nova assume o controle.

`JoltScrollProgress.subrange()` cria intervalos independentes emprestados; `setRange()` troca seus limites. `joltScrollLinked(..., role: .structuralTranslation)` preserva x/y com movimento reduzido e elimina canais decorativos; `.structuralPose` preserva a pose inteira explicitamente. O padrão `.decorative` suprime decoração espacial. `@Environment(\.joltEffectiveReduceMotion)` expõe a combinação de app e sistema. O cabeçalho mantém colapso e conteúdo fixo, desativa parallax e troca o título em um passo, sem impedir a rolagem.

<Clip name="swiftui-values-scroll-ios" caption="SwiftUI independente, simulador iOS 27: valores combinados, scroll programático, inserção por chave, cabeçalho/título fixos e movimento reduzido. Sem NativeScript." />
<Clip name="swiftui-values-scroll-macos" caption="App SwiftUI real no macOS: mesmo contrato de valores, cabeçalho, âncora e movimento reduzido usando NSScrollView." />

Os controladores existentes NativeScript/Web `scrollHeader()` continuam sendo seus equivalentes; esta entrega não duplica essas APIs. Consulte os [testes e limites](https://github.com/rafaelaugustos/jolt/tree/main/benchmarks/values-scroll-lists). A coleta física de alocações e tempo por frame da #494 continua pendente; não há afirmação de redução de CPU/PSS ou vitória sobre Reanimated.

<Clip name="list-changes-playground-web" caption="Chromium, playground real da documentação: scroll na lista por chave, inserção preservando a âncora, remoção, inversão e interrupção." />
