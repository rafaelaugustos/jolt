# Desempenho, às claras

O [painel de desempenho da home](/pt-BR/#performance) apresenta um retrato fixo da pesquisa do [PR #395](https://github.com/rafaelaugustos/jolt/pull/395), integrado e incluído na RC.11 em 3 de novembro de 2026. Os dados estão vinculados ao commit `c15b7f0da59168bcf1baa187daa7a622e9e5c19b`. É um estudo exploratório, não uma nova otimização do motor nem uma mudança nos padrões do Jolt. As barras usam Jolt Web para apresentar medições armazenadas; elas não executam um benchmark no navegador.

## O que foi medido

ASUS ZenFone 3 físico (ASUS_Z017DC), Android 8.0.0, aplicações arm64 em release. Um bloco de 48 × 48 pixels lógicos percorre 240 unidades enquanto a opacidade muda de 1 para 0,4. Cada trecho linear dura um segundo. Foram cinco pares alternados por configuração, com 30 segundos após cinco segundos de aquecimento. A animação reinicia aos 5, 15 e 25 segundos. Não houve gravação de tela durante as medições.

As três métricas da home usam o **grupo de configuração padrão**:

| Métrica                                               | NativeScript + Jolt | React Native + Reanimated |
| ----------------------------------------------------- | ------------------: | ------------------------: |
| CPU do processo, segundos por execução de 30 segundos |                6,79 |                     14,63 |
| PSS após a execução, MiB                              |               88,27 |                     85,65 |
| P50 de frame pronto → apresentação, ms                |               32,43 |                     25,28 |

Os valores são medianas de cinco execuções. CPU inclui todas as threads da aplicação, normalizada para 30 segundos. As faixas de CPU foram 6,74–7,27 s e 14,53–14,68 s. A redução de 53,6% é calculada a partir dessas medianas; não é velocidade da animação, economia de bateria ou uma comparação isolada das bibliotecas. PSS é uma fotografia após cada execução, não o pico de memória. A espera é a mediana do p50 de cada execução, não latência de toque nem varredura do painel.

## Custos e resultados ainda incompletos

O Jolt padrão usou 2,62 MiB a mais de PSS após a execução e teve 7,15 ms a mais entre frame pronto e apresentação nesse cenário. O estudo não estabelece uma classificação de aplicações completas, listas, gestos, outros aparelhos ou do Android em geral.

O grupo separado com **perfil V8 size explícito** mediu 7,37 contra 14,70 segundos de CPU e 79,16 contra 85,96 MiB de PSS após a execução. As medianas dos maiores intervalos entre frames foram 50,15 contra 17,06 ms. Antes da janela, o PSS do Jolt ainda era maior: 89,56 contra 80,42 MiB. O perfil reduziu memória ao final, mas aumentou CPU e intervalos; uma carga separada de alocação JSON também ficou mais lenta. Os grupos padrão e size foram sequenciais, sem randomização entre perfis. É um experimento opcional do runtime da aplicação, não um padrão da biblioteca Jolt.

Outras duas execuções por fase de bloqueio usaram o APK do Jolt com perfil size. Com três bloqueios deliberados de JavaScript de 300 ms por execução, a mediana dos maiores intervalos de apresentação foi **309,13 ms no Jolt e 17,06 ms no Reanimated**. O JavaScript da aplicação NativeScript compartilha a thread de UI; no Reanimated, não. Bloquear a thread de UI produziu 300,85 contra 300,79 ms. Os experimentos percorrem threads diferentes e não são intercambiáveis.

Quatro inicializações frias do Jolt falharam com `EGL_NOT_INITIALIZED`; outra tentativa incompleta foi encoberta pelo diálogo de um erro anterior. Essas tentativas foram preservadas fora das amostras bem-sucedidas. A causa segue sem esclarecimento, e o estudo não determina uma taxa geral de falhas. O observador no aparelho e as condições térmicas também limitam a interpretação.

[Veja amostras, faixas, tentativas com falha e identificação dos builds](https://github.com/rafaelaugustos/jolt/blob/c15b7f0da59168bcf1baa187daa7a622e9e5c19b/benchmarks/results/android-followup-2026-11-03/README.md) · [Protocolo e reprodução](https://github.com/rafaelaugustos/jolt/blob/c15b7f0da59168bcf1baa187daa7a622e9e5c19b/benchmarks/comparison.md). As medições de emulador são separadas e não entram no painel da home.

## Gravações nativas reais

São as gravações em inglês revisadas no PR vinculado, copiadas sem alterar quadros ou tempo. Mostram os controles e os testes de bloqueio, **não as amostras principais de medição**. O vídeo do Jolt usa o perfil size; o painel da home usa o grupo padrão.

<Clip name="comparison-jolt-physical-android" caption="ASUS ZenFone 3 físico / Android 8.0.0, inglês: Jolt com perfil V8 size explícito. Interações reais de início/reinício, bloqueio de JS, bloqueio da UI e parada. Velocidade original; gravado separadamente das medições. Não é a execução do grupo padrão mostrada no gráfico da home." />

<Clip name="comparison-reanimated-physical-android" caption="ASUS ZenFone 3 físico / Android 8.0.0, inglês: React Native + Reanimated com interações reais de início/reinício, bloqueio de JS, bloqueio da UI e parada. Velocidade original; gravação separada das medições. Um vídeo não comprova CPU, memória ou tempos de execução." />

## Navegação pelo site

<Clip name="motion-site-chromium" :width="960" caption="Chromium no macOS arm64: interação real de ponteiro e teclado com o site, incluindo seleção de métricas e novo rodapé. O gráfico animado apresenta medições armazenadas de um aparelho físico. Esta captura do navegador não é evidência de desempenho nativo; os vídeos nativos exibidos no site têm identificação própria." />
