# Comparação de desempenho

O primeiro cenário equivalente usa um bloco de 48×48 movendo 240 pixels lógicos enquanto a opacidade muda de 1 para 0,4. Cada trecho linear dura um segundo. Start reinicia; Stop mantém a posição atual. Os builds de produção usam o mesmo emulador Android API 36 dedicado.

Movimento normal, bloqueio de 300 ms do runtime do app e bloqueio de 300 ms da thread de interface são fases separadas. O JavaScript do NativeScript compartilha a thread de interface Android; o JavaScript da aplicação Reanimated não. Os experimentos de bloqueio não devem ser confundidos.

## Jolt / NativeScript

<Clip name="comparison-jolt-android" caption="App nativo real, emulador Android API 36, interface em inglês. Toques reais iniciam/reiniciam, bloqueiam o runtime do app, bloqueiam a thread de interface e param. Velocidade original; a gravação é separada da coleta de tempos." />

## React Native / Reanimated

<Clip name="comparison-reanimated-android" caption="App nativo real, emulador Android API 36, interface em inglês. Toques reais iniciam/reiniciam, bloqueiam o runtime do app, bloqueiam a thread de interface e param. Velocidade original; a gravação é separada da coleta de tempos." />

## Flutter

<Clip name="comparison-flutter-android" caption="App nativo real, emulador Android API 36, interface em inglês. Toques reais iniciam/reiniciam, bloqueiam o runtime do app, bloqueiam a thread de interface e param. Velocidade original; a gravação é separada da coleta de tempos." />

## Medições e reprodução

[Protocol, pinned versions and source](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/comparison.md).

## Baseline medido

Emulador Android API 36 arm64, apps release, duas execuções de 30 segundos por fase após cinco segundos de aquecimento. Valores: mediana entre execuções (mínimo–máximo). Sem gravação durante a medição.

### Movimento normal

| Stack               | Intervalo de apresentação p95 (ms) | CPU em segundos / 30 s | PSS após execução (MiB) |
| ------------------- | ---------------------------------: | ---------------------: | ----------------------: |
| Jolt / NativeScript |                20.83 (18.15–23.51) |      9.75 (7.18–12.33) |  102.89 (102.10–103.68) |
| RN / Reanimated     |                18.44 (18.19–18.69) |       8.91 (7.98–9.84) |     92.20 (91.58–92.81) |
| Flutter             |                24.72 (18.24–31.20) |    15.80 (13.17–18.43) |     93.87 (93.04–94.70) |

### Bloqueios deliberados de 300 ms

| Fase             | Stack               | Maior intervalo de apresentação (ms) | Confirmação de entrada p95 (ms) |
| ---------------- | ------------------- | -----------------------------------: | ------------------------------: |
| Runtime do app   | Jolt / NativeScript |               308.68 (300.55–316.82) |                0.17 (0.13–0.22) |
| Runtime do app   | RN / Reanimated     |                  36.81 (36.59–37.03) |                0.66 (0.57–0.76) |
| Runtime do app   | Flutter             |               316.49 (316.26–316.72) |                0.38 (0.34–0.43) |
| UI da plataforma | Jolt / NativeScript |               302.48 (300.49–304.48) |                0.23 (0.12–0.33) |
| UI da plataforma | RN / Reanimated     |               301.39 (301.06–301.72) |                3.28 (3.14–3.42) |
| UI da plataforma | Flutter             |               317.05 (315.91–318.19) |                0.43 (0.40–0.45) |

Esta é uma baseline exploratória em emulador. A regra de admissão do host foi corrigida durante a coleta porque a carga do próprio emulador estava sendo contada como interferência; as amostras aceitas anteriormente também satisfazem a regra final. O histórico e os registros de exclusão foram preservados. Apresentação de buffers não mede latência do painel; confirmação de entrada não mede o primeiro pixel alterado. O JS do NativeScript compartilha a thread de UI; o JS do Reanimated e a thread de plataforma do Flutter seguem caminhos diferentes.

[Distribuições por execução, rastros Perfetto, hashes, memória, CPU e reprodução](https://github.com/rafaelaugustos/jolt/tree/main/benchmarks/results/comparison-2026-11-03).

Uma execução normal do Reanimated teve um intervalo de apresentação de 348 ms fora dos momentos de entrada programados; a causa não foi isolada. A amostra foi mantida. Duas repetições em host compartilhado não estabelecem um ranking estável de CPU/frames.
