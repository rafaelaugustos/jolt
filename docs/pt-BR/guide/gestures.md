# Gestos nativos e transferência para scroll

`gestures()` compõe pan, pinch e rotação em uma `GestureSurface`, um `GridLayout` do NativeScript com processamento nativo de entrada. As saídas são somente leitura e funcionam com `bind()`, mapeamentos numéricos `to()` e `springValue()`. Reconhecimento, acompanhamento dos dedos e atualização dos bindings não exigem callbacks JavaScript a cada movimento.

Importe essa API opcional de `@rafaelaugusto/jolt/gestures` e recompile o app nativo após atualizar.

```ts
import { bind, motionScope, springValue } from '@rafaelaugusto/jolt'
import { GestureSurface, gestures } from '@rafaelaugusto/jolt/gestures'

const scope = motionScope()
const surface = new GestureSurface()
surface.addChild(card)
container.addChild(surface)
const input = scope.add(
  gestures(surface, {
    pan: { bounds: { left: -120, right: 120, top: -160, bottom: 160 } },
    pinch: { min: 0.5, max: 3 },
    rotate: true,
  }),
)
scope.use(() =>
  bind(card, {
    x: input.x,
    y: input.y,
    scale: input.scale,
    rotate: input.rotate,
  }),
)
const follower = scope.add(springValue(input.x))
scope.use(() => bind(trailingCard, { x: follower }))

// Ao descartar a página/componente:
scope.dispose()
```

<Clip name="gesture-composition-ios" caption="Entrada real de toque do sistema em simulador iOS: pan, pinch e rotação simultâneos, adição/remoção de um dedo, gestos separados, toque simples/duplo e um listener de tap existente do NativeScript. A gravação usa XCTest; não mede desempenho em aparelho físico." />

<Clip name="gesture-composition-android" caption="Multitoque real do sistema em emulador Android, seguido de toques simples/duplos e cancelamento de ponteiro. O listener de tap do NativeScript permanece conectado. Posições usam DIP, escala não tem unidade e rotação usa graus." />

## Regras de reconhecimento

Pan, pinch e rotação habilitados reconhecem simultaneamente. Adicionar ou retirar um dedo redefine a referência do centro dos toques e das medições de escala/rotação, sem somar essa mudança à posição. As saídas de transformação são independentes; use [zoomable](./photo-zoom) para zoom focal de imagens, limites de conteúdo e dismiss.

`pan` aceita `axis: 'x' | 'y' | 'both'` (padrão `'both'`), `threshold` (padrão **8 DIP**), `failOffset` (padrão **12 DIP**) e `bounds` de translação. Um pan de um eixo falha antes de ativar se o movimento perpendicular exceder `failOffset`, permitindo que o scroll pai assuma. Os limites são rígidos durante o contato. Use ancestrais sem escala ou rotação; mova o conteúdo vinculado separadamente quando possível.

`pinch: true` usa limites de escala **0,25–4**; passe `{ min, max }` para alterá-los. `rotate: true` habilita rotação em graus. `initial` aceita `{ x, y, scale, rotate }`, com padrão `{ x: 0, y: 0, scale: 1, rotate: 0 }`; os valores iniciais devem estar dentro dos limites configurados.

`onTap` e `onDoubleTap` são separados. Quando ambos existem, o toque simples espera o duplo falhar. Sem callback de toque duplo, o simples não espera essa relação. `onStart`, `onEnd` e `onCancel` recebem `{ x, y, scale, rotate, velocityX, velocityY }`; velocidades usam DIP/segundo e eixos desabilitados retornam zero. Cancelar uma interação ativa emite um cancelamento e nenhum callback de término. Não há fling automático; escolha a ação de soltura em `onEnd`.

Essas são as relações prontas de uma superfície, não um grafo arbitrário de reconhecedores externos. Listeners existentes do NativeScript continuam independentes. Um listener que escreve a mesma transformação ainda pode competir com um binding do Jolt.

## Interação horizontal em uma lista vertical

Coloque uma `GestureSurface` no conteúdo da lista, configure pan no eixo x e vincule a posição x do card. Movimento horizontal ativa o pan; movimento vertical deixa o scroll nativo ao redor assumir. Essa lista externa não é a opção `scrollView` descrita abaixo.

<Clip name="gesture-carousel-ios" caption="Interação horizontal dentro de um ScrollView vertical do NativeScript em simulador iOS. Um arraste vertical começa no mesmo card e rola o pai." />

<Clip name="gesture-carousel-android" caption="A mesma disputa de eixos em emulador Android. Movimento horizontal fica com o card; movimento vertical rola o pai." />

## Transferência entre painel e conteúdo

Para um painel vertical com um **ScrollView do NativeScript**, passe esse descendente como `scrollView` e forneça ambos os limites verticais:

```ts
const input = scope.add(
  gestures(panelSurface, {
    initial: { y: 180 },
    pan: { axis: 'y', bounds: { top: 0, bottom: 320 } },
    scrollView: results,
    onEnd: ({ y, velocityY }) => {
      input.settleTo({ y: y + velocityY * 0.15 < 160 ? 0 : 320 })
    },
  }),
)
scope.use(() => bind(panelSurface, { y: input.y }))
```

Arrastar para cima consome o percurso restante do painel antes de rolar o conteúdo. Arrastar para baixo consome a distância do conteúdo até o topo antes de mover o painel. O mesmo contato continua ao cruzar o limite. Android usa consumo de nested scroll; iOS coordena um pan simultâneo com o scroll nativo e encaminha seu delegate existente. O scroll nativo mantém a soltura quando o conteúdo expandido pode consumi-la.

<Clip name="gesture-handoff-ios" caption="Um único swipe expande o painel e depois rola o conteúdo; o swipe inverso chega ao topo do conteúdo e move o painel para baixo. Simulador iOS, painel de teste dentro da página." />

<Clip name="gesture-handoff-android" caption="A mesma transferência dentro da página em emulador Android, usando a implementação NestedScrollView do NativeScript. Não é preciso levantar o dedo na transição entre painel e conteúdo." />

A integração foi testada com NativeScript core **9.1.3**, runtime iOS **9.1.0** e runtime Android **9.1.1**. Suporta o ScrollView vertical do core; não promete transferência para ListView, plugins de RecyclerView, outras implementações de listas ou scroll interno horizontal. Android verifica se o scroll nativo implementa o protocolo necessário. Outra lista precisa de adapter e testes nativos próprios.

## Movimento e ciclo de vida

`position` lê os quatro valores atuais. Após carregar a superfície, `jumpTo(posiçãoParcial)` move imediatamente e `settleTo(posiçãoParcial)` usa um spring nativo. Uma chamada em `onEnd` preserva a velocidade de soltura; redirecionar um settle em andamento preserva sua velocidade atual. `spring` aceita `stiffness`, `damping` e `mass`. Reduced Motion torna o settle imediato e mantém o acompanhamento direto do dedo.

`updateBounds(limitesParciais)` altera limites sem zerar posição ou velocidade. Não escolhe um destino novo: chame `settleTo()` com o snap recalculado quando layout ou conteúdo mudar.

`cancel()` congela contato ou settle na posição atual. `pause()` cancela e deixa de aceitar entrada; `play()` aceita um contato novo. A suspensão de escopo usa esses métodos. Unload e suspensão do app cancelam entrada; reload/retomada restauram-na, exceto quando pausada manualmente. `dispose()` remove os reconhecedores/processamento nativo, restaura o delegate de scroll e libera os quatro valores. Assentar ou levantar o dedo não encerra o controlador.

No Vue, registre `GestureSurface` com `registerElement('GestureSurface', () => GestureSurface)` antes de montar o app e adote o controlador com `useMotionScope().add(...)`. Use `useBinding()` ou `scope.use()` para os bindings. O demo está em **Native gestures** no playground ou via `--gesture-lab` no iOS / `--es gesture-lab true` no Android.

Entrada nativa e springs ao vivo ainda executam na thread de UI. JavaScript ocupado nessa thread pode atrasá-los. Callbacks explícitos, listeners existentes do Core e `subscribe()` mantêm seus custos em JavaScript. Os injetores de multitoque pertencem apenas ao harness de gravação; não são distribuídos como código do aplicativo.
