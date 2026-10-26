# Uma rolagem, a página inteira

`scrollHeader()` conecta uma ListView do Core a uma capa medida após o layout, paralaxe, barra compacta e uma seção fixa. Abra **Feito para rolar** no preview: oitenta faixas com células recicladas, uma capa carregada de forma assíncrona com título maior, inserção acima da área visível e controles nativos para navegar pela lista.

Disponível desde a **0.1.0-rc.1**. Recompile o aplicativo nativo.

<Clip name="scroll-header-ios" caption="Simulador iOS 26.2, inglês: arraste real, expansão no overscroll, inversão, inércia, capa/título maiores, inserção e retorno programático. Velocidade original; validação de comportamento, não desempenho em aparelho físico." />
<Clip name="scroll-header-ios-pt" caption="Simulador iOS, português: a mesma composição nativa com gestos reais do sistema e controles traduzidos." />
<Clip name="scroll-header-android" caption="Emulador Android 16, inglês: rolagem real com reciclagem, mudanças de layout preservando a posição e navegação nativa. Este adaptador usa o overscroll normal do Android, sem expansão decorativa da capa." />
<Clip name="scroll-header-android-pt" caption="Emulador Android, português: interação real com a página traduzida. Os indicadores representam os toques; o vídeo não foi acelerado." />

## Estrutura suportada

Use uma única **ListView do Core**, sem seções, com um espaçador não acessível na posição zero e linhas de dados de altura fixa nas posições seguintes. A lista ocupa um GridLayout com altura delimitada. Acima dela, mantenha capa, seção e barra como irmãos, nessa ordem. A imagem e o título expandido pertencem à capa; o título compacto pertence à barra. Não envolva a lista em outro ScrollView vertical.

```ts
import { scrollHeader } from '@rafaelaugusto/jolt'

const page = scrollHeader(list, {
  header,
  artwork,
  title,
  toolbar,
  toolbarTitle,
  section,
  rowHeight: 76, // DIPs; mesma altura para todas as linhas de dados
  setSpacerHeight(height) {
    spacerHeight = height
    list.refresh()
  },
  keys: () => tracks.map((track) => track.id), // sem o espaçador
  parallax: 48,
  titleFade: [0, 0.7], // frações do intervalo de recolhimento
  toolbarFade: [0.55, 0.95],
  stretch: true, // iOS; Android usa a alternativa sem expansão
  onState(state) {
    // Mudanças de fase/layout, sem dirigir os frames da animação.
    console.log(state.phase)
  },
})

await page.remeasure()
await page.preserveAnchor(() => {
  tracks.unshift(newTrack)
  list.refresh()
})
page.scrollToItem(35, true) // índice dos dados, sem o espaçador
page.scrollToTop(true)
// Ao encerrar a propriedade da tela:
page.dispose()
```

O template precisa garantir a altura real. No Core 9.1.3 Android, a lista com altura automática redefine o `height` da raiz da célula: configure **minHeight e maxHeight** com a altura fixa; no espaçador, use `spacerHeight`. Deixe o `rowHeight` da ListView automático para permitir a altura diferente da linha zero. Evite margens verticais nas linhas. O adaptador inclui os pixels dos separadores e o arredondamento para pixels físicos na geometria.

Veja a [tela Vue completa](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/components/ScrollHeaderLab.vue) e os [templates recicláveis](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/showcase/scroll-header-cells.ts). O app mantém dados, templates, imagens e rotas. Os fundos sobrepostos devem deixar os toques passar, exceto seus controles; o exemplo usa `isPassThroughParentEnabled` e textos decorativos sem interação.

## Geometria e preservação da posição

A altura expandida vem do layout da capa e a altura mínima vem da barra. `expandedHeight` e `minimumHeight` permitem valores explícitos. O intervalo de recolhimento é `expanded − minimum`; o espaçador ocupa `expanded + section`. A seção desce da base da capa até ficar abaixo da barra. A lista continua rolando e reciclando células depois que a seção fica fixa.

O deslocamento canônico usa DIPs. No iOS, é `contentOffset.y + adjustedContentInset.top`, incluindo o bounce negativo. No Android, deriva do índice/topo da primeira linha visível, padding, espaçador e altura das linhas/separadores. Mantenha as sobreposições no mesmo pai ajustado à área segura da lista. Este primeiro adaptador pressupõe que não exista inset/padding superior extra criado pelo app dentro dessa área; ele não altera os insets da lista nem assume as barras do sistema.

Quando a capa muda de altura, o deslocamento recebe a diferença do espaçador para manter as linhas no mesmo lugar da tela. No topo absoluto, permanece em zero e mostra a nova capa. `preserveAnchor()` também acompanha a chave estável da primeira linha abaixo da seção fixa. Se a chave desaparecer, usa o índice sobrevivente mais próximo. O deslocamento respeita os limites reais: conteúdo curto/vazio pode voltar em direção ao topo. Aguarde uma atualização terminar antes de iniciar outra; com dados reativos, aguarde a atualização do framework dentro do callback. Uma inserção no topo mostra intencionalmente o novo primeiro item.

`remeasure()` também roda nos eventos relevantes de layout, incluindo quebra de texto e rotação. `pause()` desconecta a fonte; `play()` lê sua posição atual. Descarregar a lista libera listeners e grafo; recarregar cria uma nova conexão. `dispose()` restaura transformações, recorte, acessibilidade e delegate, além de `originalSpacerHeight` (zero por padrão). Não use outro controlador nas mesmas propriedades enquanto esta composição for a dona delas.

## Entrada nativa e limites

O iOS observa a geometria com KVO. Um proxy de delegate por lista fornece alturas exatas e encaminha os demais métodos ao Core, evitando que estimativas mudem a posição durante um refresh. Ao descartar, restaura o delegate anterior se ainda tiver essa propriedade. O Android observa mudanças nativas de rolagem/layout sem substituir adapter, listener de rolagem ou callbacks de itens do Core. Nenhum deles instala um handler JS de scroll. Ambos atualizam o grafo nativo de valores; JS participa de configuração, mudanças de dados/layout, ciclo de vida e callbacks semânticos. A criação e vinculação de células continuam sendo trabalho normal da ListView e podem entrar no JS.

`state` fornece `offset`, `phase`, contadores de atualizações nativas e callbacks, além das quantidades de linhas visíveis/total. Um Label opcional em `diagnostic` mostra esses números diretamente pelo nativo. São diagnósticos, não garantia de desempenho: no Android, JS e views compartilham a thread de UI; bloqueá-la também bloqueia a rolagem.

Reduzir Movimento mantém fixação e rolagem, desativa paralaxe/expansão decorativas, troca o título imediatamente e desativa a animação da navegação programática. Apenas um título participa da acessibilidade por vez. As linhas fixas precisam ter tamanho adequado à escala de texto escolhida pelo app; linhas de dados com alturas variáveis não são suportadas neste adaptador.

| Combinação                                                                  | Contrato inicial                                                                                       |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Core 9.1.3, ListView sem seções, um espaçador e linhas fixas                | Referência suportada nas duas plataformas                                                              |
| Dados curtos/vazios                                                         | Extensão real, sem criar espaço de rolagem artificial                                                  |
| Bounce do iOS                                                               | Expansão opcional; a lista nativa continua dona do gesto                                               |
| Overscroll do Android                                                       | Efeito de borda da plataforma, sem expandir a capa                                                     |
| Pull-to-refresh                                                             | Nenhum recognizer adicional; integrações de refresh ainda não foram validadas e ficam fora deste marco |
| Seções, sticky-header ou busca integrados do Core                           | Rejeitados, pois esta composição controla a geometria fixa                                             |
| Outros plugins, linhas variáveis, rolagem vertical aninhada, abas paginadas | Não suportados; sem fallback silencioso para JS                                                        |

As [notas de validação e reprodução](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/scroll-header.md) registram os testes de simulador/emulador. Desempenho em iOS/Android físicos, navegação VoiceOver/TalkBack e integração de refresh continuam abertos na #116. Os vídeos não representam aceite físico completo nem publicação de release.
