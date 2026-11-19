# Coleções e continuidade do scroll

**Disponível na 0.1.0-rc.16 (Beta).** Abrange [#495](https://github.com/rafaelaugustos/jolt/issues/495), [#496](https://github.com/rafaelaugustos/jolt/issues/496) e [#510](https://github.com/rafaelaugustos/jolt/issues/510), [#511](https://github.com/rafaelaugustos/jolt/issues/511), [#512](https://github.com/rafaelaugustos/jolt/issues/512), [#513](https://github.com/rafaelaugustos/jolt/issues/513). Instale core/plugin nativo na mesma versão e recompile o app nativo após atualizar. SwiftUI continua Beta em iOS 17+ e macOS 14+.

## Adaptadores de CollectionView {#collections}

`collectionViewListAdapter` e `collectionViewReorderAdapter` aceitam o plugin opcional `@nativescript-community/ui-collectionview` (testado na 6.1.3), com uma coluna vertical, chaves estáveis e sem layout invertido nem `reorderEnabled` do plugin. Usam a geometria nativa realmente montada e não importam o plugin para o Jolt. Grades, seções e transferência entre listas ficam fora deste contrato.

`listChanges` captura as linhas visíveis, aplica uma atualização imutável, preserva a primeira chave visível e seu deslocamento interno e anima o novo layout nativo. Envie toda alteração estrutural por `update`; não entregue as mesmas linhas a outro controlador de layout. Células recicladas recuperam seu estado anterior antes de receber outra identidade. Cópias de saída e interrupções mantêm o ciclo de vida limitado existente. Veja [valores, scroll e listas](./values-scroll-lists).

O reorder usa captura, prévia, rolagem nas bordas e restauração de células no nativo. O commit informa a chave estável e a chave de inserção; o app atualiza os dados uma vez. No Android, a coleção deve ser o único filho de `ReorderSurface`. Para um painel pai, coloque essa superfície dentro de `GestureSurface`. Declare `waitFor` do painel após montar os dois controladores: mover antes do toque longo rola normalmente; o reorder reconhecido assume o arraste. Recrie as relações após remontar.

```ts
import { collectionViewListAdapter, listChanges } from '@rafaelaugusto/jolt'
import { collectionViewReorderAdapter, reorder } from '@rafaelaugusto/jolt/reorder'
import { gestures, scrollHandoff, gestureRelations } from '@rafaelaugusto/jolt/gestures'

const changes = listChanges(collection, {
  key: (item: Item) => item.id,
  adapter: collectionViewListAdapter<Item>(collection),
})
changes.update(nextItems)
// Dispose changes before switching ownership to interactive reorder.
changes.dispose()
const sorting = reorder(collectionViewReorderAdapter<Item>(collection), {
  key: (item) => item.id,
  onCommit: (move) => commitByKey(move.key, move.beforeKey),
})
const panel = gestures(surface, {
  pan: { axis: 'y', bounds: { top: 0, bottom: 180 } },
  scrollView: scrollHandoff(collection),
})
const links = gestureRelations([{ gesture: panel, other: sorting, relation: 'waitFor' }])
// Teardown: links.dispose(); panel.dispose(); sorting.dispose().
```

## Transferência contínua {#handoff}

`scrollHandoff(view, { axis })` amplia o contrato existente de `gestures(..., { scrollView })` e `bottomSheet` para Core ListView, CollectionView linear e Core ScrollView horizontal. Painel e conteúdo compartilham o eixo, e o scroller deve descender da superfície. Informe limites explícitos do painel em DIPs. Core ListView e bottom sheets continuam verticais; CollectionView exige eixo linear correspondente e uma coluna. O painel expande antes de rolar o conteúdo; na volta, o conteúdo chega ao início antes de recolher. Apenas o último dono recebe a velocidade de soltura, em DIPs/segundo.

Substituir os itens cancela o contato atual. Mudanças no contrato de layout descartam o controlador; recrie-o após mudar orientação, colunas, dimensões de linhas/colunas ou estilo de layout. Cancelamento, unload, suspensão e descarte liberam a posse nativa de entrada/delegate, preservando os listeners do app. Handoff e reorder nativos não exigem JavaScript do aplicativo por quadro. Widgets personalizados ainda precisam de backend nativo compatível; uma view arbitrária não é um adaptador portátil.

`JoltBottomSheet` transfere o mesmo contato SwiftUI entre painel e conteúdo em iOS e macOS. O modelo existente continua dono dos pontos de parada e do relógio finito de soltura. Pan no UIKit e mouse/roda no AppKit alimentam esse modelo, sem aplicar o momentum da roda duas vezes. Toques no conteúdo, edição de texto, teclado e movimento reduzido continuam disponíveis. Scrollers UIKit aninhados mantêm sua entrada. Inatividade da cena, remontagem e descarte cancelam a conexão. São painéis dentro do app; eventos de roda do XCTest não comprovam a sensação de um trackpad físico.

## Ordem horizontal e valores de scroll {#horizontal}

Linhas nativas montadas aceitam `axis: 'x'` e `direction: 'ltr' | 'rtl'`. O array mantém a ordem lógica, e os alvos medidos devem seguir essa direção sem sobreposição. As larguras podem variar. RTL afeta a ordem horizontal, não os índices verticais. No Web, use o `reorder` existente com `axis: 'x'` e o `direction` CSS do contêiner; as prévias RTL agora seguem a ordem lógica. Rolagem nas bordas, cancelamento e ciclo de vida preservam seus contratos.

`scrollValue` nativo aceita scroll Core horizontal/vertical e CollectionView linear. Em listas recicladas Android, `rowHeight` é o **passo fixo real entre itens em DIPs** (largura no eixo x), incluindo espaçamento; pode diferir do tamanho solicitado ao plugin. Nesta execução, linhas pedidas com 64 DIP mediram 49,524 DIP no Android. O iOS lê offset mais inset ajustado. O zero horizontal nativo fica na esquerda física mesmo em RTL; o bounce do iOS pode ser negativo, enquanto o intervalo Android validado é limitado. São unidades de scroll, não índices.

O benchmark interno compara o custo do produtor nativo e JavaScript com as mesmas cinco propriedades vinculadas. Exclui avaliação posterior do grafo, renderização e CPU/PSS do app completo. Tempos de simulador/emulador não comprovam desempenho em aparelhos físicos. Veja o [relatório de aceitação](https://github.com/rafaelaugustos/jolt/blob/feat/rc16-collections-scroll/benchmarks/collections-scroll/README.md).

## Web e limites de ciclo de vida {#web}

Reutilize `listChanges` Web, seu adaptador explícito para virtualizadores, `scrollValue` e gestos com scroll aninhado. A execução usa o agendamento do navegador, sem promessa de thread nativa ou pixels idênticos. Reorder atua na janela de elementos fornecida: trocar uma chave ou alvo DOM durante o contato cancela antes de um commit desatualizado. Mantenha essa janela montada para continuar um arraste durante a virtualização; Jolt não fornece um virtualizador Web. As alternativas existentes por botão/teclado e movimento reduzido permanecem; este lote não abre uma frente de acessibilidade.

## Gravações reais {#evidence}

<Clip name="collection-motion-ios" caption="iPhone 17 Pro · simulador iOS 27; entrada real do XCTest. Atualizações da coleção, reorder com reciclagem, reversão nas bordas e cancelamento." />

<Clip name="collection-motion-android" caption="Pixel 7 · emulador Android API 36; toques reais no sistema. Atualizações da coleção, reorder com reciclagem, reversão nas bordas e cancelamento." />

<Clip name="scroll-handoff-ios" caption="iPhone 17 Pro · simulador iOS 27; entrada real do XCTest. Um contato expande, rola e inverte com ListView, CollectionView e ScrollView horizontal." />

<Clip name="scroll-handoff-android" caption="Pixel 7 · emulador Android API 36; toques reais no sistema. Um contato expande, rola e inverte com ListView, CollectionView e ScrollView horizontal." />

<Clip name="horizontal-reorder-edges-ios" caption="iPhone 17 Pro · simulador iOS 27; entrada real do XCTest. Ordem LTR/RTL com larguras diferentes, ambas as bordas, reversão, cancelamento e movimento reduzido." />

<Clip name="horizontal-reorder-edges-android" caption="Pixel 7 · emulador Android API 36; toques reais no sistema. Ordem LTR/RTL com larguras diferentes, ambas as bordas, reversão, cancelamento e movimento reduzido." />

<Clip name="scroll-source-ios" caption="iPhone 17 Pro · simulador iOS 27; entrada real do XCTest. Cinco propriedades vinculadas, comparação de offsets nativo/JS, RTL horizontal e CollectionView." />

<Clip name="scroll-source-android" caption="Pixel 7 · emulador Android API 36; toques reais no sistema. Cinco propriedades vinculadas, comparação de offsets nativo/JS, RTL horizontal e CollectionView." />

<Clip name="swiftui-sheet-continuity-ios" caption="Simulador iOS 27: Entrada real: transferência contínua entre painel e conteúdo, botões e remontagem. UI em inglês; velocidade original." />

<Clip name="swiftui-sheet-continuity-macos" caption="App nativo macOS: Entrada real: transferência contínua entre painel e conteúdo, botões e remontagem. UI em inglês; velocidade original." />

<Clip name="horizontal-reorder-web" caption="Chromium no macOS: mouse real mostra commit LTR/RTL, reversão nas bordas e cancelamento por Escape. UI em inglês." />
