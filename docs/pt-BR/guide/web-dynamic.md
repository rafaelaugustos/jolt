# Movimento contínuo na Web {#web-dynamic}

**Desde a RC.7:** [cores, bordas, pintura contínua, tamanho real, FLIP e cenas com seek](./web-visual) ampliam este runtime. As APIs Web continuam experimentais; a paridade completa segue na [#236](https://github.com/rafaelaugustos/jolt/issues/236).

Desde a **0.1.0-rc.6**, `motionValue()`, `bind()`, `springValue()` e `drag()` estão disponíveis no runtime de `@rafaelaugusto/jolt/web`. As APIs Web continuam experimentais; entradas nativas e adapter Vue mantêm seus contratos.

<Clip name="web-dynamic-chromium" caption="Chromium 156 desktop, velocidade original: ponteiro e teclado reais controlam o follower, alteram a escala da aplicação durante o press, arrastam e retomam o snap, removem/remontam o card e mudam pausa/movimento reduzido. Gravação do navegador; não é evidência nativa nem desempenho em aparelho físico." />

## Valores de entrada e bindings {#values}

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'

const motion = createWebRuntime(document)
const input = motion.motionValue(0)
const follower = motion.springValue(input, { stiffness: 170, damping: 22 })
const binding = motion.bind(card, { x: follower })
input.set(180)
input.set(60)

binding.dispose()
follower.dispose()
input.dispose()
motion.release(card)
motion.dispose()
```

Os valores pertencem ao contexto. `get()` lê o número atual; `getVelocity()` usa unidades/segundo. `set()` altera a entrada imediatamente, enquanto as escritas visuais são agrupadas no próximo frame. Bindings aceitam x/y/rotação/escala/opacidade; scale se expande em scaleX/scaleY. Valores de outro contexto, descartados ou não numéricos são rejeitados antes de substituir o controle existente.

`subscribe(listener)` observa mudanças depois das escritas agendadas e devolve uma função para cancelar a assinatura. Não emite o valor inicial. Callbacks executam JavaScript e têm custo próprio, sem converter animações WAAPI independentes em loops. Mapeamentos numéricos e cadeias limitadas de followers estão no [suporte Web da RC.6](./web-support). A RC.7 adiciona [mapeamentos de cor e bindings contínuos de pintura](./web-visual#paint); a paridade completa com a API nativa continua na #236.

Cada binding controla apenas seus canais de base. `animate()`, `set()` e `stop()` posteriores substituem os canais correspondentes; os demais bindings e layers de press continuam. Descartar um binding antigo não restaura valores antigos. Desvincular mantém o valor atual. `release()` restaura os estilos inline ainda controlados e cancela o trabalho do elemento; a remoção do DOM faz isso automaticamente. Valores podem sobreviver ao elemento: descarte-os separadamente ou descarte o runtime. Descartar uma entrada também descarta seus followers.

## Scheduler e springs {#scheduler}

Um scheduler por contexto agrupa leituras, atualizações e escritas usando timestamps, sem passo fixo de 60 Hz. Ele para quando entradas, observadores e movimento estabilizam. O tempo oculto do documento não avança as springs contínuas; retomar não simula todo o intervalo. Relógios WAAPI finitos mantêm o comportamento da timeline do navegador.

Enquanto uma superfície possui bindings vivos, seus canais finitos também são compostos pelo scheduler. Outras superfícies continuam com WAAPI. Desvincular devolve os tracks finitos restantes à WAAPI sem reiniciar seus relógios. Esse caminho contínuo executa JavaScript e não garante composição fora da thread principal.

A spring segue um valor numérico legível do mesmo contexto com o solver analítico portátil. Opções: `stiffness`, `damping`, `mass` ou `duration`/`bounce`, além de `initial`, `restDelta` (0,001 unidade) e `restSpeed` (0,01 unidade/segundo). `pause()` mantém posição e velocidade, mesmo se a entrada mudar; `play()` retoma para o alvo atual; `stop()` mantém a posição com velocidade zero; `jump()` chega imediatamente à entrada; `dispose()` é terminal.

Uma mudança para movimento reduzido estabiliza todos os followers genéricos, inclusive sem binding. Entradas diretas continuam diretas. Cada nova trajetória captura o `timeScale` atual; mudar a configuração não reescala uma trajetória já ativa. Damping zero pode manter trabalho até parar ou descartar.

## Drag e snap finito {#drag}

```ts
const drag = motion.drag(card, {
  axis: 'x',
  bounds: { left: -120, right: 120 },
  snap: { x: [-100, 0, 100] },
  spring: { stiffness: 180, damping: 20 },
})
```

Drag usa um ponteiro primário e translação x/y em pixels CSS. O transform estático do alvo deve ser identidade; ancestrais que afetam a geometria não podem introduzir transforms, perspectiva ou zoom CSS. A RC.7 aceita transforms identidade e encerra a caminhada na raiz real de modal/popover da top layer, cuja própria geometria continua relevante; veja [geometria de overlays](./web-interactions#overlays). Rotação/escala do Jolt e press entram depois da translação. Scroll e resize cancelam o drag; espaços arbitrariamente transformados, pinch e handoff de scroll aninhado continuam fora.

O drag assume a translação no pointerdown e captura o ponteiro. Aplica temporariamente `touch-action: pan-y` no eixo x, `pan-x` no y ou `none` nos dois, restaurando o valor inline anterior no descarte. Controles interativos internos mantêm seus eventos. Toques e ativação por teclado continuam; um arrasto suprime apenas seu clique resultante. Disabled/inert/busy, cancelamento, perda de captura/foco, documento oculto e remoção cancelam a entrada sem executar snap de sucesso.

Bounds limitam a entrada e os destinos; a spring de saída pode ultrapassá-los. O snap escolhe o ponto por eixo usando projeção de velocidade de 150 ms; sem pontos, retorna à posição de quando foi anexado. A velocidade usa amostras recentes, zera após 80 ms sem movimento e é limitada a 5.000 pixels CSS/segundo. Ao soltar, posição e velocidade passam ao playback finito WAAPI. Outro drag pode retomar esse movimento; um novo controle da aplicação cancela o drag antigo sem restaurar sua translação.

`drag.animation` expõe o snap mais recente e `finished`. `update({ disabled: true })` cancela a entrada; `cancel()` mantém a posição sem snap; `dispose()` para apenas seu próprio snap. Descartar o elemento/runtime libera bindings e listeners. O componente continua responsável por alternativa de teclado e semântica acessível.

## Referências nativas e validação {#verification}

As gravações revisadas abaixo preservam as implementações nativas existentes. Mostram valores, followers e drag nativos; não mostram o novo scheduler Web nem uma tela compartilhada do Mavis. As APIs nativa e Web mantêm subconjuntos distintos.

<Clip name="live-springs-ios" caption="Demo existente no simulador iOS: inversões de alvo, toque, layer de shake independente e movimento reduzido. Velocidade original; referência nativa, não aparelho físico." />
<Clip name="live-springs-android" caption="Demo existente no emulador Android: followers nativos respondem a toques, gestos e movimento reduzido. Velocidade original; referência nativa." />
<Clip name="drag-values-ios" caption="Demo existente no simulador iOS: um sheet arrastável controla valores vinculados e faz snap; a animação da aplicação pode ser interrompida. Velocidade original." />
<Clip name="drag-values-android" caption="Demo existente no emulador Android: flings reais e retomada de um sheet em movimento com bindings nativos. Velocidade original." />

Execute `npm run web:dynamic:typecheck` e `npm run web:dynamic:test`. Chromium, Firefox e WebKit verificam composição, cancelamento e cleanup. Injeção de scroll touch real é exclusiva do Chromium; os outros engines têm cobertura de cancelamento de ponteiro. Os checks de tempo oculto controlam deliberadamente o sinal de visibilidade, sem medir background móvel físico. Veja o [relatório reproduzível](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-dynamic.md). CI nativo e consumidores reais Web/Vue/SSR/nativos continuam obrigatórios. Esta entrega não altera o Mavis nem adiciona outro framework.
