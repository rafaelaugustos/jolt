# Springs que seguem um alvo móvel

Disponível desde a **0.1.0-beta.16**, no pacote principal. Recompile o app nativo após atualizar. Não exige o plugin opcional de propriedades nativas.

`springValue()` mantém a posição e a velocidade de um spring nativo enquanto o alvo muda. Atualizar o alvo modifica o nó existente, sem reconstruir uma animação de keyframes. Um seguidor pode alimentar outro sem uma assinatura JavaScript entre eles.

```ts
import { bind, motionScope, motionValue, set, springValue } from '@rafaelaugusto/jolt'

const scope = motionScope()
const pointer = motionValue(0)
const first = scope.add(springValue(pointer, { stiffness: 260, damping: 24 }))
const second = scope.add(springValue(first, { stiffness: 260, damping: 24 }))
scope.use(() => bind(cursor, { x: first }))
scope.use(() => bind(trailingCursor, { x: second }))

set(pointer, 180)
set(pointer, -40) // preserva posição e velocidade de cada seguidor
// Ao descartar a página ou o componente:
scope.dispose()
```

<Clip name="live-springs-ios" caption="Três seguidores nativos no simulador iOS: inversões de alvo, arrastos reais, shake aditivo e redução de movimento. Reprodução em tempo real; a gravação não demonstra desempenho de 120 Hz em aparelho físico." />

<Clip name="live-springs-android" caption="A mesma cadeia no emulador Android, com toques e arrastos reais. O último seguidor também recebe uma camada de shake; a redução de movimento leva a cadeia diretamente ao alvo." />

## Fontes e bindings

A fonte pode ser um motion value, um mapeamento numérico ou outro spring value. `animate(pointer, ...)` envia a curva da fonte nas mudanças de playback, permitindo seguir uma timeline nativa. Mapeamentos numéricos com `to()`, inclusive intervalos decrescentes, pontos repetidos e extrapolação, rodam nativamente nos bindings e nas cadeias de seguidores.

O resultado aceita bindings em `x`, `y`, `scale`, `scaleX`, `scaleY`, `rotate`, `rotateX`, `rotateY` e `opacity`. Cores, decorações e adaptadores nativos compostos ainda não têm suporte nesse caminho ao vivo. O spring value é somente leitura: atualize a fonte em vez de passar o seguidor para `animate()` ou `set()`.

Camadas nomeadas de transformação e opacidade continuam compondo com a base:

```ts
bind(card, { x: first })
animate(card, { x: [0, -12, 12, 0] }, { layer: 'feedback', duration: 500 })
```

O mixer nativo soma translação/rotação e multiplica escala/opacidade. Pausar ou parar uma camada mantém o seguidor ativo. Uma animação comum que substitui o binding assume a posição atual da base; o seguidor continua alimentando seus outros bindings.

## Configuração e ciclo de vida

As opções aceitam `stiffness`, `damping`, `mass` ou a parametrização existente de `duration`/`bounce`. `initial` define a posição inicial; sem essa opção, o seguidor começa no valor atual da fonte. `duration: 0` segue imediatamente. A escala global de tempo é capturada na criação do seguidor.

Os padrões são **0,001 unidade da fonte** para `restDelta` e **0,01 unidade da fonte por segundo** para `restSpeed`. Ambos precisam ser positivos. Em repouso, o spring mantém exatamente o alvo e deixa de pedir frames quando nenhum outro seguidor ou camada precisa deles. Ele desperta na próxima mudança de alvo. Repouso não descarta a assinatura: ela permanece no escopo até `dispose()`.

`get()` e `getVelocity()` leem o estado nativo. `moving` indica movimento do spring, independentemente das camadas. `subscribe()` habilita explicitamente observação em JavaScript; bindings e cadeias não exigem callbacks JS por frame. O unload de uma view remove seu binding nativo, e o próximo load aplica o estado atual do seguidor.

`pause()` preserva posição e velocidade; `play()` retoma em direção ao alvo atual. O escopo pausa os springs na suspensão e retoma sem criar novos nós. Um spring pausado manualmente continua pausado após o app voltar do background. No Vue, use `useMotionScope().add(springValue(source, options))` junto de `useBinding()` para cuidar da ativação de componentes em cache e do unmount definitivo.

A redução de movimento leva a cadeia diretamente ao alvo atual. A suspensão do app preserva o estado; na retomada, o spring segue novamente a fonte atual. O agendador integra passos de até 1/240 de segundo e limita a integração a 64 ms após um frame atrasado, evitando um salto grande para compensar o tempo perdido. Chamadas de `animate()` com alvo fixo mantêm seus caminhos existentes de Core Animation / Android.

Nesta demo, os eventos de toque ainda atualizam a fonte pelo JavaScript. Para entrada de gestos nativa e transferência para rolagem, use a [API opcional de gestos](./gestures); `springValue()` não transforma o reconhecedor de gestos em nativo. Os núcleos C e Java têm testes de trajetórias equivalentes, incluindo passos de 60/120 Hz e frames atrasados. Esses testes não substituem medições de desempenho em aparelhos físicos.
