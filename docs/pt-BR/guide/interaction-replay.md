# Gravar e reproduzir uma interação

Guarde as entradas que reproduziram um bug, fixe o movimento esperado e teste o próximo build com elas. A entrada opcional **@rafaelaugusto/jolt/testing** oferece trace numérico versionado, gravação explícita e runner com adaptadores. **@rafaelaugusto/jolt/testing/native** adiciona relógio controlado do Jolt, captura de pan do Core e leitura da apresentação nativa.

::: warning Prévia de desenvolvimento
Este checkout prepara a etapa inicial do replay para beta.18; os pacotes publicados de beta.17 não incluem essas entradas. Use em um ambiente isolado de desenvolvimento. Não é telemetria de produção e importar o módulo não instala observadores.
:::

<Clip name="interaction-replay-ios" caption="Simulador iOS com toques e drag reais do XCTest: aceitar a gravação de um spring, reproduzir, detectar um checkpoint propositalmente errado e cancelar/reproduzir um drag. O replay usa tempo lógico gravado; sua duração não mede desempenho." />

<Clip name="interaction-replay-android" caption="Emulador Android com toques e swipe reais via ADB. O app cancela o drag enquanto o contato continua. O trace é validado primeiro no motor e depois nas posições das views nativas. Velocidade original da gravação." />

## Grave apenas as entradas escolhidas

```ts
import { recordInteraction } from '@rafaelaugusto/jolt/testing'
import {
  observeTraceInputs,
  traceMetadata,
  traceNow,
  traceSettings,
} from '@rafaelaugusto/jolt/testing/native'

const take = recordInteraction({
  now: traceNow,
  seed: 63,
  metadata: traceMetadata(),
  settings: traceSettings(),
  motions: [
    {
      id: 'card',
      kind: 'spring',
      axis: 'x',
      initial: 0,
      stiffness: 170,
      damping: 26,
      mass: 1,
      min: 0,
      max: 240,
      snap: [],
    },
  ],
})

take.input({ type: 'target', id: 'card', value: 180 })
// Aplique o alvo ao grafo. Leia o estado na mesma fronteira do relógio controlado:
take.checkpoint('card', { position: 0, velocity: 0, settled: false })

// Captura opcional de ambiente: exige um adaptador de replay do aplicativo.
const detach = observeTraceInputs(cardView, 'card', take, {
  layout: true,
  keyboard: true,
  lifecycle: true,
})
detach()
const trace = take.stop()
saveFixture(JSON.stringify(trace))
```

O app controla a persistência e fornece um relógio monotônico. Entradas no mesmo instante mantêm a ordem. O formato aceita alvos, posição/velocidade/contatos do pan, retângulos de layout, offset do scroll, inset do teclado e lifecycle. Coordenadas usam DIP, velocidade usa DIP/s e timestamps usam milissegundos desde o início. Os slots indicam a quantidade de contatos ativos; não são identidades de ponteiros nativos nem reconstroem reconhecimento multitouch.

O schema rejeita campos desconhecidos, IDs inexistentes, números não finitos, tempo regressivo e versões incompatíveis. Não guarda texto digitado, bytes de imagens, views ou handles nativos. Escolha IDs estáveis e rótulos de SO/modelo sem dados pessoais. A versão 1 aceita até 5.000 entradas, cinco minutos e 32 motions; a entrada JSON tem limite de 2 MB. Ao atingir um limite, o gravador lança erro; seu dono deve remover observadores e parar a gravação.

**Os checkpoints precisam usar o mesmo relógio lógico do replay.** Um animador nativo pode começar depois do callback e apresentar um frame depois da amostra do motor. O preview preserva essa captura bruta separadamente; **Finalizar** fixa uma referência do motor com relógio controlado, uma única vez. Replays posteriores reutilizam a referência sem recalculá-la. Revise e versione esse JSON como resultado esperado. Os fixtures canônicos do CI usam checkpoints independentes e fixos, sem aceitar a implementação atual a cada execução.

## Execute o motor e depois o probe nativo

```ts
import { parseTrace } from '@rafaelaugusto/jolt/testing'
import { motionTraceGraph, replayWithDriver } from '@rafaelaugusto/jolt/testing/native'

const trace = parseTrace(savedJSON)
for (const native of [false, true]) {
  const report = await replayWithDriver(
    trace,
    (trace) => motionTraceGraph(trace.motions, (id) => views.get(id)!, { native }),
    { native },
  )
  if (!report.passed) {
    saveArtifact('trace.json', JSON.stringify(report.trace))
    saveArtifact('expected-observed.svg', report.plot)
    throw new Error(report.errors.join('\n'))
  }
}
```

As views precisam estar carregadas. Configure antes a escala de tempo e o valor resolvido de Reduzir Movimento conforme o trace. O runner troca temporariamente o driver global do Jolt e o restaura em **finally**. Execute um replay isolado por vez, sem animações concorrentes. Ele não controla relógios de live springs retidos nem sessões nativas de gestos.

**ReplayClock** avança uma vez por timestamp distinto. Uma pausa de 288 ms continua sendo um frame longo. As tracks nativas ficam pausadas e recebem seek no tempo lógico correspondente; o probe aguarda dois frames de apresentação, com prazo limitado. No iOS, lê a presentation layer sem recorrer ao modelo; no Android, lê a translação nativa em DIP. Velocidade e estado de repouso vêm do motor, não de uma estimativa por diferenças entre frames nativos.

Cada checkpoint compara posição e velocidade com tolerâncias explícitas (padrão: 3 DIP e 30 DIP/s), além do estado exato de repouso. O runner descarta o adaptador em sucesso, divergência, cancelamento ou erro, e exige zero recursos próprios restantes. O relatório inclui observações, erros, recursos, trace e gráfico de posição esperada/observada.

## Adaptadores e cobertura

O grafo de referência usa **animate**, **motionValue**, **bind**, **drag** e **motionScope** reais. Cobre os casos iniciais da #63: spring interrompido, continuidade no instante exato da troca de alvo, drag de um ponteiro cancelado, movimento ignorado após cancelar, suspensão e descarte. Um checkpoint nativo propositalmente errado precisa falhar. A suíte também detectou e corrige a perda da velocidade inicial do spring no instante exato da interrupção.

Layout, teclado, scroll e load/unload são preservados, mas precisam do roteamento do aplicativo. O grafo rejeita eventos não suportados, sem ignorá-los. Use **environment** ou implemente **ReplayAdapter** com **input**, **read**, **dispose** e **resources**. O runner puro **replayInteraction** recebe seu relógio **advanceTo** e entrega uma função aleatória local com seed à fábrica do adaptador. Não altera **Math.random** global.

O adaptador de replay para handoff scroll→sheet continua como próxima etapa da #63. Gravar esses números ainda não reproduz a política nativa de posse do bottom sheet. Os testes existentes de [gestos](./gestures) e [bottom sheet](./bottom-sheet) com entrada real do SO mantêm essa cobertura. Replay sintético ignora o reconhecedor e não prova hit testing, arbitragem de gestos, temporização nativa do teclado ou clipping.

O experimento **57 — Replay de interações** está em inglês e português. O [guia de validação](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/interaction-replay.md) contém comandos, artefatos e limites.

<Clip name="interaction-replay-pt-ios" caption="Preview integrado em português brasileiro no simulador iOS: gravação real de um spring e replay nativo, com toques do XCTest na velocidade original." />
