# Arrastar, desacelerar e encaixar

`drag()` acompanha um dedo, limita a translação e usa a velocidade da soltura em uma animação nativa. Disponível na próxima versão após a beta.7.

```ts
import { drag } from '@rafaelaugusto/jolt'

const painel = drag(sheet, {
  axis: 'y',
  bounds: { top: 0, bottom: 600 },
  snap: [0, 300, 600],
  rubberband: true,
})

painel.dispose()
```

## Coordenadas e soltura

`axis` aceita `'x'`, `'y'` ou `'both'` (padrão). Limites e pontos de encaixe são **valores absolutos de translação em DIPs**, relativos à posição de layout. Não são coordenadas de tela nem o retângulo de um container. Calcule a distância disponível considerando o tamanho do card. Bordas omitidas ficam livres. Os limites devem ser finitos e ordenados; limites iguais travam um eixo.

`snap` aceita um array para cada eixo habilitado ou `{ x: [...], y: [...] }`. Os pontos precisam ser finitos, não vazios e estar dentro dos limites. Ganha o ponto mais próximo da posição projetada pela desaceleração; em empate, ganha o primeiro. Sem snap, o movimento desacelera com `friction` (padrão `0.998`, estritamente entre 0 e 1, retenção por milissegundo).

Por padrão, os limites são rígidos durante o gesto e a soltura. Com `rubberband: true`, ultrapassá-los encontra resistência crescente. Soltar fora dos limites produz uma mola de retorno. Uma desaceleração que alcança a borda transfere sua velocidade restante para essa mola. O encaixe usa uma mola criticamente amortecida com a velocidade de soltura; rubberband permite ultrapassar brevemente os limites. Um eixo sem snap mantém a desaceleração livre.

O gesto começa na translação atual e interrompe somente os eixos habilitados, preservando a posição visível. Outras propriedades continuam animando. Tocar durante a soltura interrompe essa animação imediatamente; se o toque não virar pan, a posição fica congelada. As opções são copiadas. Para atualizar limites após uma mudança de layout, descarte e recrie o controller.

## Eventos

```ts
drag(card, {
  axis: 'x',
  bounds: { left: -160, right: 160 },
  snap: [-160, 0, 160],
  onMove: ({ x, y, velocityX, velocityY }) => atualizarIndicador(x, y),
  onRelease: ({ target, animation }) => {
    void animation.finished.then((concluiu) => {
      if (concluiu) salvarPosicao(target)
    })
  },
  onCancel: () => limparDestaque(),
  onSettle: ({ x, y }) => limparDestaque(),
})
```

`onStart` e `onMove` recebem `{ x, y, velocityX, velocityY }`, em DIPs e DIPs/segundo. Eixos desabilitados têm velocidade zero. Fora dos limites, a velocidade inclui a resistência do rubberband. `onRelease` também recebe o destino e um `PlaybackAnimation`. `onSettle` só dispara após conclusão bem-sucedida. Handles interrompidos resolvem `false`: confira o booleano antes de aplicar efeitos de conclusão. Callbacks podem cancelar ou descartar o próprio controller. Evite trabalho pesado em `onMove`.

## Ciclo de vida

```ts
const motion = motionScope() // ou useMotionScope() no setup do Vue
const controller = motion.drag(card, { axis: 'x' })

controller.position // posição atual: x e y
controller.dragging
controller.settling
controller.cancel() // congela gesto/soltura e mantém a inscrição
controller.pause() // cancela e remove listeners de gestos
controller.play() // aceita um gesto novo
motion.dispose() // remove listeners e cancela a soltura própria
```

`pause()` cancela o gesto e a soltura; `play()` aceita gestos novos. A suspensão do scope usa esse comportamento, preservando controllers já pausados manualmente. Unload da view e suspensão do app cancelam e removem os listeners de gestos; reload/resume os reconectam enquanto o controller estiver vivo e não pausado. `dispose()` é terminal e idempotente. Um segundo `drag()` na mesma view descarta o primeiro; opções inválidas preservam o anterior. Descartar não cancela animações mais recentes de outros donos.

Cancelar congela a posição, inclusive fora dos limites durante rubberband. Não produz fling, `onRelease` ou `onSettle`. Multitouch e cancelamento nativo cancelam o gesto. `isEnabled = false` impede o acompanhamento. Reduced Motion mantém o acompanhamento direto do dedo e aplica imediatamente o destino ao soltar.

## Plataformas e escopo

O acompanhamento usa eventos síncronos de pan do NativeScript na main thread e escrita de propriedades via JavaScript. No iOS, translação e velocidade vêm do `UIPanGestureRecognizer` nas coordenadas do pai. No Android, a velocidade é estimada por uma janela recente de posições brutas e timestamps dos eventos, evitando realimentação quando a view se move. A soltura é calculada uma vez e executada pelos drivers nativos, sem loop JavaScript por frame. JavaScript ocupado ainda pode atrasar o acompanhamento e os callbacks. No Android, JavaScript e animações de View compartilham a UI thread: [a soltura nativa também pode travar com trabalho pesado nessa thread](./android-performance).

Use pai e ancestrais sem transformações para coordenadas equivalentes entre Android e iOS. Esta API não coordena gestos concorrentes, scroll aninhado, reordenação ou um bottom sheet completo. A arbitragem do NativeScript/SO continua valendo: o scroll pai pode cancelar o drag e reconhecedores iOS podem atuar simultaneamente. A demo usa uma tela sem scroll para o painel vertical. Composição e passagem de controle entre gestos estão na [#51](https://github.com/rafaelaugustos/jolt/issues/51).

Abra **Drag, fling and snap** no playground, ou use `--drag-lab` no iOS / `--es drag-lab true` no Android. A demo inclui card com desaceleração, painel com três pontos, pause/resume, unmount/remount e Reduced Motion.
