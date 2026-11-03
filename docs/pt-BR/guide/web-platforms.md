# Teclado, sheets, navegação, física e ícones na Web

**Disponível desde a 0.1.0-rc.10.** As issues #366–#371 adicionam seis capacidades ao runtime e aos escopos Web. A importação de `/web` funciona em SSR; crie o runtime e os recursos após montar os elementos no cliente.

## Geometria do teclado {#keyboard}

`scope.onKeyboard(callback)` e `scope.followKeyboard(composer, { offset: 12 })` retornam funções de limpeza com `pause/play`, `dispose`, `disposed` e `snapshot()`. As assinaturas compartilham observadores dentro do runtime. O acompanhamento usa uma camada de translação separada, removida no descarte. Use um alvo alinhado aos eixos dentro de um host sem transformação.

O estado informa `visible`, `height`, `rect`, `backend`, `accuracy`, `duration` e `transition`. A altura representa a cobertura inferior do **layout viewport em pixels CSS**, evitando descontar novamente um viewport já redimensionado. Um teclado flutuante pode estar visível com cobertura inferior zero. A [API VirtualKeyboard](https://www.w3.org/TR/virtual-keyboard/) fornece o retângulo informado pelo navegador. Sem ela, um campo editável focado e uma redução maior que 80 px no VisualViewport sem zoom produzem uma **estimativa**. Barras do navegador e teclados físicos ou flutuantes limitam essa estimativa; sem geometria, a precisão é `unavailable`.

O navegador não fornece a curva nativa de animação: a duração é sempre zero. O Jolt não altera a política global `overlaysContent`. `offset` define uma distância não negativa acima do teclado. Evite combinar dois responsáveis pelo acompanhamento da mesma região.

<Clip name="web-keyboard-platforms-chromium" :width="900" caption="Chromium no macOS, interface em inglês: foco e digitação reais mostram a geometria desktop. Não há teclado virtual neste vídeo; ele não demonstra acompanhamento de teclado móvel." />
<Clip name="keyboard-ios" caption="Simulador iOS, demo nativa em inglês: referência existente revisada com interação e animação reais, em velocidade original. Não é gravação de aparelho físico." />

## Bottom sheet {#sheet}

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'
const motion = createWebRuntime(document)
const scope = motion.scope()
const sheet = scope.bottomSheet(panel, {
  host,
  handle,
  snap: [160, '75%'],
  scrollView: content,
})
sheet.open()
```

O painel deve ser filho direto de um `host` posicionado e com recorte, com um `handle` separado dentro dele. Os snaps aceitam pixels CSS positivos, percentuais da altura útil ou `'content'` com um elemento `content` separado para medição. `scrollView` habilita a coordenação de rolagem aninhada. Campos e botões mantêm sua interação. Este sheet pertence à página; a aplicação controla semântica modal e bloqueio da rolagem de fundo.

O controle oferece `open`, `snapTo`, `expand`, `collapse`, `dismiss`, `remeasure`, `snapPoint` e `visibleHeight`. A geometria é compartilhada com o nativo e a soltura preserva velocidade. O teclado é acompanhado, salvo `keyboard: 'none'`. Informe `safeArea.top/bottom` em pixels CSS. O `backdrop` deve ser irmão do painel; opacidade e interação são controladas até o descarte. `dismissible: false` bloqueia o fechamento pelo usuário. `onChange` informa o destino e `onDismiss` dispara uma vez após o fechamento terminar. O handle oferece semântica de slider e ações por setas, Home, End e Escape; forneça seu `label` localizado e os rótulos da aplicação. `returnFocus` pode identificar o acionador.

<Clip name="web-sheet-platforms-chromium" :width="900" caption="Chromium no macOS, interface em inglês: cliques, teclas e gestos reais demonstram o comportamento Web em velocidade original. Não representa desempenho de aparelho físico." />
<Clip name="bottom-sheet-ios" caption="Simulador iOS, demo nativa em inglês: referência existente revisada com interação e animação reais, em velocidade original. Não é gravação de aparelho físico." />

## Modal interativo {#modal}

`scope.interactiveModal(dialog, { handle: modalHandle })` recebe um `HTMLDialogElement` montado e inicialmente fechado. `open()` usa a [camada modal, a inércia do fundo e o foco do navegador](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element). `handle` limita o início do arrasto; `canBegin` pode vetá-lo. O botão de fechamento, `close(returnValue)` e Escape fecham o diálogo. Um arrasto curto ou `cancel()` retorna à posição aberta. `state` e `onState` distinguem closed/opening/open/dragging/closing/disposed.

`dialog.close()` externo e formulários com `method="dialog"` continuam válidos. A pausa congela o movimento. O descarte remove o comportamento adicional e deixa um diálogo aberto sob responsabilidade da aplicação, que deve fechá-lo ou removê-lo ao desmontar. Esta API DOM não implementa o delegate de transição do iOS nem o predictive back do Android.

<Clip name="web-modal-platforms-chromium" :width="900" caption="Chromium no macOS, interface em inglês: cliques, teclas e gestos reais demonstram o comportamento Web em velocidade original. Não representa desempenho de aparelho físico." />
<Clip name="interactive-modal-ios" caption="Simulador iOS, demo nativa em inglês: referência existente revisada com interação e animação reais, em velocidade original. Não é gravação de aparelho físico." />

## Navegação controlada pelo roteador {#navigation}

```ts
const navigation = scope.sharedNavigation(routeHost)
const detach = navigation.attach(card, 'cover')
const operation = navigation.navigate({
  tag: 'cover',
  async navigate({ animated }) {
    await routerCommit({ animated })
    navigation.attach(nextCard, 'cover')
  },
})
const result = await operation.finished
```

Mantenha o contêiner montado entre rotas. O Jolt captura a identidade, chama o callback uma única vez com `{ animated: false }` e aguarda sua promise e o destino anexado. O roteador continua responsável pelo histórico, pelos dados, pela confirmação da rota e pelas requisições assíncronas antigas. Anexe o destino antes de resolver o callback ou dentro da janela restante de layout.

Uma operação concorrente retorna `unavailable/busy` sem chamar seu callback. O resultado contém status, motivo, `navigated` e erro opcional. `navigated` significa que o callback foi chamado, não que o roteador assíncrono necessariamente concluiu. Cancelar ou descartar encerra o efeito sem reverter a rota. Rejeições retornam `failed`; conteúdo ausente ou não suportado mantém a navegação sem efeito. Movimento reduzido também confirma a rota sem transição visual.

`navigationTimeout` vale 3000 ms por padrão, até 10000. A preparação visual tem janela limitada à soma desse timeout com `layoutTimeout` (500 por padrão), limitada a 10000 ms. O relógio exclui o tempo com documento oculto. Valem os limites do shared layout: HTML estático, orçamento de cópia, sem snapshots de vídeo/canvas/formulários/custom elements/SVG. Não é uma captura de tela nativa nem gesto de retorno interativo.

<Clip name="web-navigation-platforms-chromium" :width="900" caption="Chromium no macOS, interface em inglês: cliques, teclas e gestos reais demonstram o comportamento Web em velocidade original. Não representa desempenho de aparelho físico." />
<Clip name="shared-navigation-ios" caption="Simulador iOS, demo nativa em inglês: referência existente revisada com interação e animação reais, em velocidade original. Não é gravação de aparelho físico." />

## Física de círculos {#physics}

```ts
const world = scope.physicsWorld(arena, [
  {
    id: 'ball',
    view: ball,
    radius: 24,
    x: 80,
    y: 80,
    drag: { type: 'spring', line: { color: '#8de2ce' } },
  },
])
world.impulse('ball', { x: 200, y: -500 })
```

São aceitos 1–16 filhos diretos distintos, raio de 12–256 pixels CSS, massa de 0,1–100, velocidade máxima de 1200 px/s e área total de até 40% do host. Dimensione cada wrapper para o dobro do raio. Host e ancestrais devem estar sem transformação. Os corpos iniciais precisam caber sem sobreposição. Gravidade aceita componentes de ±2000, restituição de 0–1 e amortecimento de 0–20.

O cálculo TypeScript é comparado aos motores reais C/iOS e Java/Android em 52 cenários. A simulação usa passos fixos de 240 Hz e no máximo 24 passos de recuperação por frame; o excesso aparece em `snapshot().droppedMs`. A física Web roda na thread principal, sem promessa de desempenho nativo.

Cada corpo pode usar arrasto direto, mola até o ponteiro, `attachment` fixo ou 1–8 `snap.points`. Attachment e snaps são mutuamente exclusivos. Há até 32 molas entre corpos, no máximo quatro por corpo, sem endpoints com snaps. Use `attach`, `spring`, `snapTo`, `impulse`, `reset`, `pause/play` e `snapshot`. Guias `line` são decorativas. O arrasto por mola mantém o momento integrado na soltura. Cancelar libera o ponteiro; redimensionar ajusta posições e zera velocidades. Limites inválidos pausam até voltarem a comportar os corpos. Movimento reduzido pausa por padrão; `'continue'` é explícito. Corpos em repouso deixam de solicitar frames. O descarte restaura o posicionamento controlado e libera bindings, ouvintes e guias.

<Clip name="web-physics-platforms-chromium" :width="900" caption="Chromium no macOS, interface em inglês: cliques, teclas e gestos reais demonstram o comportamento Web em velocidade original. Não representa desempenho de aparelho físico." />
<Clip name="circle-physics-ios" caption="Simulador iOS, demo nativa em inglês: referência existente revisada com interação e animação reais, em velocidade original. Não é gravação de aparelho físico." />
<Clip name="physics-attachments-ios" caption="Simulador iOS, demo nativa em inglês: referência existente revisada com interação e animação reais, em velocidade original. Não é gravação de aparelho físico." />

## Ícones da aplicação {#symbols}

`scope.symbolEffect(iconWrapper, 'bounce', { speed: 1 })` anima um wrapper HTML dedicado. Bounce, pulse e `variableColor` podem repetir. `scale` mantém a ampliação até parar. `variableColor` faz ondas de opacidade em 1–32 descendentes marcados com `[data-jolt-symbol-layer]`; não carrega SF Symbols nem recolore uma imagem arbitrária.

`{ replace: detachedIconElement }` substitui os filhos pelo elemento decorativo HTML/SVG da aplicação, desconectado e pertencente ao mesmo documento. A substituição permanece após parar ou descartar. Atualize o nome acessível e o estado da aplicação. Repetição e scale têm duração lógica infinita e não aceitam seek; efeitos finitos oferecem progresso, pausa e conclusão booleana. Movimento reduzido pula decoração (`false`), mas confirma a substituição (`true`). O cancelamento restaura as propriedades animadas sem reverter o estado novo da aplicação.

<Clip name="web-symbols-platforms-chromium" :width="900" caption="Chromium no macOS, interface em inglês: cliques, teclas e gestos reais demonstram o comportamento Web em velocidade original. Não representa desempenho de aparelho físico." />
<Clip name="symbols-reference-ios" caption="Simulador iOS, demo nativa em inglês: referência existente revisada com interação e animação reais, em velocidade original. Não é gravação de aparelho físico." />

## Ciclo de vida e validação {#validation}

Todas as factories estão no runtime e nos escopos, incluindo setup Vue. `scope.suspend/resume` controla os recursos; descarte e remoção do alvo liberam recursos. Recrie o controle após remover seu alvo. O compositor compartilhado pode manter uma serialização neutra de transform/opacity após remover o binding; as demais camadas da aplicação são preservadas.

Execute `npm run web:platforms:typecheck`, `npm run web:platforms:test` e `python3 benchmarks/verify-circle-math.py`. Os testes cobrem Chromium, Firefox e WebKit, ponteiros reais, teclado, foco modal, cancelamento, rotas assíncronas e pixels renderizados. Retângulos de teclado injetados são apenas fixtures de teste, nunca gravações de teclado móvel. Reproduza os vídeos Web com `node benchmarks/web-platforms/record.mjs`. A adoção no Mavis é acompanhada em issues separadas.
