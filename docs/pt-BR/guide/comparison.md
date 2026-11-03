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

## Verificação em Android físico

Cinco pares alternados por configuração em um ASUS ZenFone 3 físico, Android 8.0.0; 30 segundos por rodada após cinco segundos de aquecimento. Os grupos com perfil padrão e de memória foram coletados em sequência. Estas medianas descrevem uma animação simples em um celular antigo, não uma classificação geral dos frameworks. Flutter não foi repetido aqui.

| Configuração                           | CPU em 30 s (s) | PSS após a rodada (MiB) | Maior intervalo entre frames, mediana (ms) |
| -------------------------------------- | --------------: | ----------------------: | -----------------------------------------: |
| Jolt, padrão                           |            6,79 |                   88,27 |                                      17,04 |
| Reanimated, grupo padrão               |           14,63 |                   85,65 |                                      17,25 |
| Jolt, perfil V8 de memória explícito   |            7,37 |                   79,16 |                                      50,15 |
| Reanimated, grupo do perfil de memória |           14,70 |                   85,96 |                                      17,06 |

A opção `--optimize_for_size` reduziu o PSS após a rodada, mas aumentou CPU e os maiores intervalos entre frames em relação ao Jolt padrão. Antes da janela de animação, Jolt com esse perfil ainda usava 89,56 MiB, contra 80,42 MiB do controle Reanimated. PSS é uma amostra, não o pico de memória. É um experimento de configuração do aplicativo; o motor e os padrões do Jolt não mudaram. Não ative a opção apenas para melhorar esta tabela.

O p95 da cadência normal ficou próximo de 16,9 ms. A mediana de frame pronto→apresentação foi 32,43 ms no Jolt padrão e 25,28 ms no seu controle Reanimated; no grupo de memória, 30,03 e 25,31 ms. Esses intervalos do SurfaceFlinger físico não são a métrica fila→apresentação do emulador, latência de entrada ou varredura do painel. A espera adicional e o bloqueio da thread principal continuam sem solução. Algumas inicializações também falharam com `EGL_NOT_INITIALIZED`; as tentativas foram preservadas e a causa ainda não foi isolada.

Duas rodadas adicionais por fase de bloqueio usaram Jolt com o perfil de memória e o mesmo controle Reanimated. As medianas do maior intervalo entre frames foram **309,13 contra 17,06 ms** ao bloquear o JavaScript da aplicação, e **300,85 contra 300,79 ms** ao bloquear a thread de UI. O PSS menor não resolveu a diferença no bloqueio do JavaScript. Cada rodada contém três bloqueios deliberados de 300 ms.

<Clip name="comparison-jolt-physical-android" caption="ASUS ZenFone 3 físico, Android 8.0.0, interface em inglês. Jolt com o perfil V8 de memória explícito: toques reais reiniciam, bloqueiam o JS da aplicação, bloqueiam a UI e param. Velocidade original; gravação separada da medição, com custo adicional de captura." />

<Clip name="comparison-reanimated-physical-android" caption="ASUS ZenFone 3 físico, Android 8.0.0, interface em inglês. Reanimated com início/reinício, bloqueio do JS da aplicação, bloqueio da UI e parada por toques reais. Velocidade original; gravação separada da coleta." />

No teste separado de alocação JSON, as duas rodadas padrão levaram 421,61 e 417,33 ms por lote medido (medianas); as rodadas com o perfil de memória levaram 592,38 e 591,06 ms. A CPU do processo subiu de 426/420 para 743/742 ms, enquanto o PSS após o trabalho caiu de 120,57/121,15 para 102,51/102,06 MiB. O primeiro lote de cada processo é excluído. Esse custo reforça a decisão de manter a opção experimental.

<Clip name="comparison-js-profile-physical-android" caption="ASUS ZenFone 3 físico, Android 8.0.0, interface em inglês. Teste separado de alocação JavaScript, perfil padrão. Progresso real dos lotes e conclusão com checksum verificado; evidência visual, não amostra de desempenho ou comparação entre frameworks." />

[Intervalos completos, amostras físicas brutas, falhas, custos do perfil de memória e reprodução](https://github.com/rafaelaugustos/jolt/tree/main/benchmarks/results/android-followup-2026-11-03).
