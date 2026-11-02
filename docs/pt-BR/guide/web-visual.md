# Cores, layout e cenas na Web

**Disponível desde a 0.1.0-rc.7**, entregue pelas #308–#313. Estes recursos ampliam a entrada experimental `/web` sem dependência de framework ou NativeScript. A [paridade funcional completa](https://github.com/rafaelaugustos/jolt/issues/236) continua como meta maior; este release não representa todas as APIs nativas na Web.

## Cores, bordas e bindings contínuos {#paint}

O playback finito aceita `backgroundColor`, `color`, `borderColor` e as quatro cores laterais; `borderWidth` e as quatro larguras laterais; `borderRadius`, quatro cantos independentes e os raios `X`/`Y` de cada canto. Propriedades explícitas prevalecem sobre atalhos. Números representam pixels CSS para comprimentos e ARGB empacotado para cores. Strings CSS são resolvidas no alvo durante a preparação; o atalho de cantos aceita sintaxe elíptica e percentuais.

As cores usam o compilador compartilhado em OKLab com alfa pré-multiplicado e saída sRGB. Larguras e raios são não negativos e respeitam a geometria e o estilo da borda. Jolt não torna visível uma borda com `border-style: none`, não substitui a imagem de fundo nem altera o contorno de foco. Canais de pintura são substituídos independentemente; layers aditivos/multiplicativos mantêm o contrato de transform e opacidade.

O `.to()` de um valor numérico também aceita strings de cor, retornando um `WebColorValue` somente leitura. Aplique `springValue()` antes do mapeamento; cores não têm velocidade escalar. `bind()` aceita esses nós e valores numéricos de decoração no scheduler existente, ativo sob demanda. Descartar a fonte libera os dependentes; descartar o binding mantém a pintura atual. Um handle antigo não sobrescreve seu substituto.

Mapeamentos de cor independem do alvo: passe cores resolvidas, em vez de variáveis CSS do elemento ou `currentColor`. O `animate()` finito resolve essas expressões no seu alvo.

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'
const motion = createWebRuntime(document)
motion.animate(
  card,
  {
    backgroundColor: '#d8f381',
    color: '#15291e',
    borderTopColor: '#dc672a',
    borderRightWidth: 8,
    borderRadius: '42px 12px 56px 20px / 16px 32px 24px 48px',
  },
  'snappy',
)

const input = motion.motionValue(0)
const follower = motion.springValue(input)
const paint = motion.bind(card, {
  backgroundColor: follower.to([0, 1], ['#7655e8', '#ed8b46']),
  borderRadius: follower.to([0, 1], [12, 64]),
})
input.set(1)
```

<Clip name="web-paint-chromium" :width="900" caption="Chromium 156, macOS arm64: cliques, pressão mantida e teclado no controle de faixa demonstram cores, bordas e cantos finitos e bindings contínuos de cor/raio. Tempo original; sem alegação de desempenho em aparelho móvel." />

## Tamanho real e layout visual {#layout}

`animateSize()` altera `width` e `height` reais, separadamente ou juntas, com destinos numéricos e `auto`. O texto reflui e os vizinhos se movem pelo layout normal. Box sizing, min/max, Grid e Flexbox continuam determinando a alocação. No Flexbox, o tamanho CSS preferido é interpolado para não aplicar grow/shrink duas vezes. Destinos intrínsecos são medidos enquanto a operação está ativa; conteúdo novo pode prolongá-la. A conclusão restaura `auto` semântico ou a declaração CSS numérica solicitada.

A mutação roda sincronamente após a captura; microtarefas do framework executam antes da medição. Carregue os dados antes. Mutações assíncronas, repetições e seek não se aplicam a um destino intrínseco mutável. Substituir carrega valor/velocidade dos eixos comuns, restaura eixos omitidos e resolve a operação antiga como `false`. Pause remove os frames de tamanho. `stop()` mantém o tamanho atual; `stop({ restore: true })`, remoção e descarte restauram declarações ainda pertencentes à operação, preservando mudanças de conteúdo e escritas externas mais recentes.

`animateLayout()` captura filhos HTMLElement diretos por identidade, aplica a mutação e mede no próximo frame. Anima a inversão de posição e tamanho em contribuições privadas, preservando movimento da aplicação/press, transforms 2D estáticos e origens. Novos filhos podem entrar com fade; removidos saem imediatamente. `size: false` desativa a inversão de tamanho e `enter: false` desativa a entrada. Substituir recaptura a pose visual atual. `stop()` remove as inversões e mantém o layout alterado. O handle oferece `finished` e `stop()`. Geometria projetiva ou singular não tem inversão 2D suportada.

```ts
const size = motion.animateSize(
  card,
  { width: 420, height: 'auto' },
  () => {
    card.textContent = nextText
  },
  { duration: 400 },
)
size.pause()
size.play()
await size.finished

const layout = motion.animateLayout(
  list,
  () => {
    list.append(list.firstElementChild!)
  },
  { size: 'scale', enter: true, duration: 400 },
)
await layout.finished
```

<Clip name="web-size-chromium" :width="900" caption="Chromium 156 no macOS: controles reais alteram largura e altura intrínseca, pausam, retomam, invertem e acrescentam texto. A linha seguinte acompanha o layout real; velocidade original." />

<Clip name="web-layout-chromium" :width="900" caption="Chromium 156 no macOS: cliques reordenam, redimensionam, interrompem, inserem e removem cards. FLIP escala o conteúdo visual; isso é diferente do reflow real do texto." />

## Cenas com seek {#scenes}

`seekableTimeline()` coordena tracks explícitas de elementos e valores numéricos mutáveis, `steps` aninhados, offsets em milissegundos e repetições finitas no mesmo relógio. Use um descritor por canal/layer; reúna movimentos repetidos em keyframes. Callbacks, gestos e efeitos colaterais não são descritores reversíveis. Alvos e valores precisam pertencer ao mesmo documento/runtime.

Pause, resume, stop e `progress` preservam o contrato de playback finito. Um endpoint pausado pode voltar. Substituir um canal ou chamar `set()` no valor numérico mantém as demais tracks; o handle antigo não recupera o canal e termina com `false`. Valores numéricos observados usam o scheduler; cenas elegíveis apenas com elementos mantêm WAAPI.

```ts
const progress = motion.motionValue(0)
const scene = motion.seekableTimeline(
  [
    {
      target: card,
      keyframes: { x: [0, 240], borderRadius: [8, 40] },
      transition: { duration: 1200, ease: 'linear' },
    },
    {
      at: 200,
      steps: [{ value: progress, keyframes: [0, 100], transition: { duration: 1000 } }],
    },
  ],
  { paused: true },
)
scene.progress = 1
scene.progress = 0.3
scene.play()
await scene.finished
```

<Clip name="web-scene-chromium" :width="900" caption="Chromium 156 no macOS: play/pause e teclado no controle de faixa coordenam dois elementos e um contador, chegam ao endpoint pausado, voltam e retomam." />

## Lifecycle, custo e integração {#integration}

Reduced motion ao vivo conclui tracks espaciais/decorativas e tamanho intrínseco, inclusive quando pausado; cor/opacidade mantêm seu tempo. Libere alvos e descarte o contexto junto com seu dono. `useWebMotion()` também expõe `animateSize()` e `animateLayout()` na ref declarada, com limpeza no escopo Vue.

A [política de superfícies Web](./web-runtime#surface-policy-and-limits) continua valendo: use uma superfície dedicada, sem transições/animações CSS concorrentes. Pintura finita usa keyframes WAAPI preparados, mas cores podem exigir pintura e bordas podem causar layout. Tamanho real mede o layout a cada frame ativo; nenhum caminho garante aceleração pelo compositor. Evite renders do framework por frame.

Execute `npm run web:visual:typecheck`, `npm run web:visual:test` e `npm run web:visual`; a demo usa a porta 4287 e `?demo=paint`, `size`, `layout` ou `scene`. O [relatório e os comandos de gravação](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-visual.md) incluem Chromium/Firefox/WebKit reais e consumidores empacotados imperativo/Vue/SSR/nativo.

A adoção no Mavis fica em [controles #191](https://github.com/getcortexlabs/mavis-ui/issues/191), [Accordion #192](https://github.com/getcortexlabs/mavis-ui/issues/192), [FLIP compartilhado #193](https://github.com/getcortexlabs/mavis-ui/issues/193) e [cenas #194](https://github.com/getcortexlabs/mavis-ui/issues/194), consumindo o motor do Jolt.

## Referências nativas preservadas {#native-reference}

Estas gravações revisadas em inglês mostram os equivalentes nativos existentes. Não mostram a implementação Web nem comprovam desempenho novo em aparelho físico.

<Clip name="decorations-reference-ios" caption="Trecho da demo nativa iOS: bordas e cantos. As telas de abertura foram cortadas; tempo de playback e mídia original preservados." />

<Clip name="live-paint-ios" caption="Simulador iOS: toques reais mudam o alvo e pausam/retomam uma spring de cor e raio. Os cantos nativos uniformes diferem dos cantos independentes Web." />

<Clip name="size-ios" caption="Simulador iPhone 17, iOS 26.0: largura/altura reais, conteúdo intrínseco, interrupção e pausa. A demo seleciona 0,25× em parte da interação; tempo do vídeo preservado." />

<Clip name="layout-ios" caption="Simulador iOS: inserção, remoção, reordenação e redimensionamento na demo nativa FLIP existente." />

<Clip name="seekable-scene-ios" caption="Simulador iOS: interação real no slider controla uma cena nativa, inclusive voltando de um endpoint pausado." />
