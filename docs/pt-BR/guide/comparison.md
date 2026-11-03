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
