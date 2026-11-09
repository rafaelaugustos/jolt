# Inspeção portátil e replay de sensores

Adições candidatas às entradas opcionais Web de inspector/testing: gráficos limitados de valores esperados/observados e replay canônico de sensores. Os equivalentes nativos já existem. Essas APIs Web ainda não estão publicadas na RC.12.1.

```ts
import { createMotionInspector } from '@rafaelaugusto/jolt/web/inspector'
const inspector = createMotionInspector(document, runtime, {
  development: true,
  capacity: 128,
})
const unwatch = inspector.watch(card, 'card')
inspector.sample('card', 'x', 80, 'replace')
const svg = inspector.plot('card', 'x')
// Application teardown:
unwatch()
inspector.dispose()
```

A coleta é explícita: x/y são translações CSS em pixels, e opacidade não tem unidade. O app fornece o valor esperado e o evento semântico opcional. A observação vem do estilo computado, não da GPU nem de sensor físico. Elementos desconectados e transformações projetivas ou incompatíveis produzem lacunas null. A capacidade limita o histórico compartilhado, com padrão 256; gráficos exportados aceitam até 4096 amostras ordenadas. Eventos: start, replace, pause, play, stop, complete e seek.

Observe elementos montados com IDs únicos sem dados pessoais. Libere a observação antes de reutilizar um ID; a nova observação começa um histórico novo. Destruir o inspector limpa observações e diagnósticos próprios, mantendo elementos e animações do app vivos. Diagnósticos emprestados continuam sob responsabilidade do app. Não há polling automático, captura de conteúdo pessoal ou promessa de desempenho.

```ts
import { replaySensor } from '@rafaelaugusto/jolt/web/testing'
const source = runtime.sensor('gravity', { reducedMotion: 'continue' })
const unsubscribe = source.x.subscribe((value) => console.log(value))
const replay = replaySensor(
  source,
  [
    { time: 0, values: [0, -9.81, 0], orientation: 0 },
    { time: 100, values: [1, -9.76, 0], orientation: 0 },
  ],
  { manual: true },
)
replay.advanceTo(0)
replay.advanceTo(100)
await replay.finished
unsubscribe()
source.dispose()
```

As amostras são explicitamente sintéticas: 2–10000 entradas copiadas, tempos relativos estritamente crescentes de 0 a 60000 ms. Vetores usam xyz do dispositivo, em m/s², rad/s ou µT; rotação usa quaternion normalizado xyzw. A orientação opcional aceita 0/90/180/270 graus. O mapeamento de interface e a recentralização existentes continuam funcionando. O replay não inventa leituras intermediárias.

O replay desconecta apenas seu sensor dos eventos de dispositivo. Pausa sem consumidores, com pausa da fonte, background/visibilidade ou Reduzir Movimento. O modo manual exige advanceTo dentro da duração. O handle também oferece pause/play/stop/dispose e finished: true ao concluir, false ao cancelar. Entrada inválida preserva um replay anterior. Destruir a fonte cancela o replay. Concluir ou parar retoma a aquisição normal conforme permissão e demanda.

snapshot().sampleSource distingue replay, device-event e none, inclusive para valores retidos. O replay não concede permissão e available permanece false para entrada sintética. API presente, emulador e replay não comprovam dados físicos; #385 continua aberta. O teste deve controlar e destruir suas inscrições, valores derivados, bindings e fonte, por scope ou limpeza explícita.

<Clip name="web-tools" caption="Chromium no macOS: amostras sintéticas movem um elemento DOM real; pausa/retomada, observações CSS explícitas e marcadores de substituição. O gráfico identifica sua fonte; sem medição de sensor físico ou GPU." />

<Clip name="interaction-inspector-ios" caption="Inspector nativo existente no simulador iOS: interação real com controles e observações. As fontes de observação nativa e Web permanecem distintas." />

<Clip name="composition-sensors-ios" caption="Demo nativo existente de sensores no simulador iOS. Evidência de ciclo de vida e mapeamento, não de leituras físicas ou novo benchmark de hardware." />
