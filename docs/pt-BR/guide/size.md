# Dimensões reais

`animateSize()` altera a `width` e a `height` reais de uma view, incluindo transições de e para `auto`. O texto quebra linha, os ícones preservam as proporções e os vizinhos se movem pelo layout normal do NativeScript. Use em cards expansíveis e accordions.

Disponível desde a **0.1.0-beta.15** no pacote principal. Não exige o plugin opcional de propriedades nativas.

<Clip name="size-ios" caption="Largura/altura reais, mudanças de conteúdo intrínseco, pausa, inversão e toque na linha seguinte no simulador iPhone 17, iOS 26.0. Os controles selecionam explicitamente velocidade 0,25× no trecho de interrupção; o tempo do vídeo foi preservado." />
<Clip name="size-android" caption="Demo nativo no emulador Android 16: reorganização por largura/altura, auto pelo conteúdo, pausa/retomada, interrupção e GridLayout. A câmera lenta é selecionada no app; os toques são reais, via ADB." />

```ts
import { animateSize } from '@rafaelaugusto/jolt'

await animateSize(card, { height: 'auto' }, 'snappy')
await animateSize(card, { height: 80 }, { duration: 300 })
await animateSize(card, { width: 240, height: 'auto' }, 'smooth')

// Capture os limites atuais ANTES de alterar o conteúdo.
await animateSize(
  card,
  { height: 'auto' },
  () => {
    description.text = longerDescription
  },
  { duration: 350 },
)
```

É uma API separada de [`animateLayout()`](./layout). O FLIP mede o layout final uma vez e anima transforms; seu modo de tamanho escala o conteúdo. `animateSize()` mede e aplica layout real durante a execução. Nenhuma das duas é uma transição de elementos compartilhados entre telas. Os keyframes de `animate()` continuam sem width/height.

## Destinos e containers

Informe uma ou ambas as dimensões. Os destinos são números DIP finitos e não negativos ou `'auto'`; arrays, percentuais, objetos de unidade e propriedades desconhecidas são rejeitados antes de substituir uma animação existente. Declarações iniciais numéricas, DIP/px do NativeScript e `auto` são aceitas; uma declaração percentual no eixo animado é rejeitada. Percentuais dos ancestrais podem ser resolvidos normalmente pelo layout.

`auto` respeita **o alinhamento existente e as restrições do pai**. É tamanho intrínseco quando o pai permite; um eixo transversal com stretch pode preencher o espaço disponível. Use `horizontalAlignment="left"` ou `verticalAlignment="top"` para tamanho intrínseco em um eixo restrito. O Jolt não altera alinhamento, padding, margens ou clipping. Defina `clipToBounds="true"` no accordion para esconder filhos que ultrapassem seus limites durante o fechamento.

| Container ou distribuição                                                                            | Contrato                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Filho direto de StackLayout vertical/horizontal                                                      | Suportado; os vizinhos participam de cada layout.                                                                                                                            |
| Filho direto de GridLayout                                                                           | Suportado; linhas/colunas `auto` crescem com o conteúdo. Faixas fixas ou `*` mantêm sua própria distribuição; redimensionar uma view interna não anima a definição da faixa. |
| Stack/Grid dentro de ScrollView                                                                      | Suportado; os limites reais atualizam a área rolável. Esta API não anima o offset de scroll.                                                                                 |
| Largura e altura juntas                                                                              | Medidas juntas na largura de destino; o texto quebra linha em cada largura intermediária. Passe também `height: 'auto'` para animar a altura que envolve o conteúdo.         |
| FlexboxLayout, WrapLayout, AbsoluteLayout ou pai direto customizado                                  | Rejeitado. A política de layout exige validação específica.                                                                                                                  |
| Células recicladas de ListView/CollectionView, descendentes virtualizados ou com medição customizada | Não suportados; não há contrato para reciclagem e medição desses casos.                                                                                                      |

A distribuição do pai continua prevalecendo. Valores e overshoot de springs respeitam zero e os limites min/max; max prevalece quando min é maior que max. Um destino numérico fora dos limites termina no número limitado. Um destino `auto` restaura **a semântica de auto**, permitindo redimensionamentos posteriores pelo conteúdo.

## Conteúdo, interrupção e controles

O callback opcional de mudança executa sincronamente depois da captura dos limites anteriores. As atualizações de views enfileiradas pelo Vue podem ocorrer antes da primeira medição. Busque os dados antes da chamada; callbacks assíncronos são rejeitados. Mudanças de texto, imagem, fonte e restrições do pai durante a execução são medidas nos próximos frames. Um destino alterado recomeça dos limites reais atuais, preservando a velocidade da curva e descartando o delay original. Conteúdo que muda continuamente pode estender a conclusão. Após terminar, o Jolt para de observar; faça outra chamada para animar uma mudança posterior.

Uma operação controla os eixos solicitados de uma view. Outra chamada de `animateSize()` nessa view substitui toda a operação anterior, resolve seu resultado como `false` e parte dos limites atuais; um eixo antes controlado e omitido na nova chamada volta à declaração original. Tracks de transform/opacity continuam independentes.

```ts
const animation = animateSize(card, { height: 'auto' })
animation.pause() // mantém limites reais, sem callback de frame pendente
animation.play() // mede novamente ao retomar
animation.stop() // mantém o tamanho atual em declarações numéricas locais
// Alternativa: animation.stop({ restore: true })
// libera os overrides temporários, revelando as declarações locais/CSS originais.
const completed = await animation.finished
```

A conclusão resolve `true`; substituição, stop, unload e suspensão do app resolvem `false`. Uma view descarregada/colapsada, ou uma árvore sem sua distribuição inicial de layout, recebe o destino sem reter playback e resolve `false`. Unload/background restauram as declarações originais para evitar tamanhos intermediários presos ao recarregar. Erros inesperados de medição rejeitam `finished` após a limpeza.

Escritas locais ou CSS explícitas em uma dimensão controlada cancelam a operação e assumem seu controle, inclusive sob o override temporário. Dimensões não controladas ficam intactas. O Jolt recusa substituir uma animação CSS de keyframes em uma dimensão controlada. O cancelamento não desfaz a mudança de conteúdo.

Use `motionScope().animateSize()` ou `useMotionScope().animateSize()` no Vue. A suspensão do scope pausa; resume continua; reset/dispose param mantendo o tamanho numérico atual. Movimento Reduzido aplica o destino, inclusive se a preferência mudar durante uma pausa. O `timeScale` global se aplica; o Android usa o relógio de animação do sistema. Tweens/springs, easing e delay são aceitos. Repeat, tempos arbitrários de keyframes e seek não são suportados porque os destinos intrínsecos podem mudar; o retorno é `SizeAnimation`, não `PlaybackAnimation`.

## Execução e custo

**Esta API executa JavaScript e layout do NativeScript na thread de UI em cada frame.** Um callback CADisplayLink/Choreographer controlado pela biblioteca amostra a curva, mede o destino na árvore existente, restaura as dimensões atuais e aplica layout antes de desenhar. Não duplica views de conteúdo/acessibilidade nem desenha o destino usado na medição. Os dois eixos compartilham a medição; não exige timer do aplicativo. As animações padrão de transform mantêm seu caminho nativo atual.

A implementação inicial mede o destino em cada frame para detectar mudanças intrínsecas. Espere duas chamadas de medição da raiz e um layout explícito por operação/frame, além das passagens do framework. Várias views animadas e árvores profundas aumentam o custo; não há independência da thread de renderização. JavaScript ocupado na thread principal trava esta animação. Prefira `animateLayout()` baseado em transforms quando não precisar reorganizar o conteúdo.

Abra **Real dimensions** no playground, ou use `--size-lab` no iOS / `--es size-lab true` no Android. O [relatório de validação nativa](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/size-layout.md) registra containers, versões, limites reais/toques e custos de layout medidos. Resultados de simulador/emulador não garantem desempenho em aparelho físico.
