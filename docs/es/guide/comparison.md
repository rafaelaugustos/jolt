# Comparación de rendimiento

El primer escenario equivalente mueve un bloque de 48×48 a lo largo de 240 píxeles lógicos mientras la opacidad pasa de 1 a 0,4. Cada tramo lineal dura un segundo. Start reinicia y Stop mantiene la posición actual. Los builds de producción usan el mismo emulador dedicado Android API 36.

El movimiento normal, un bloqueo del runtime de 300 ms y un bloqueo de la interfaz de 300 ms son fases separadas. JavaScript de NativeScript comparte el hilo de interfaz Android; JavaScript de aplicación de Reanimated no. Los experimentos de bloqueo son distintos.

## Jolt / NativeScript

<Clip name="comparison-jolt-android" caption="App nativa real, emulador Android API 36, interfaz en inglés. Toques reales inician/reinician, bloquean el runtime, bloquean el hilo de interfaz y detienen. Velocidad original; la grabación está separada de la medición." />

## React Native / Reanimated

<Clip name="comparison-reanimated-android" caption="App nativa real, emulador Android API 36, interfaz en inglés. Toques reales inician/reinician, bloquean el runtime, bloquean el hilo de interfaz y detienen. Velocidad original; la grabación está separada de la medición." />

## Flutter

<Clip name="comparison-flutter-android" caption="App nativa real, emulador Android API 36, interfaz en inglés. Toques reales inician/reinician, bloquean el runtime, bloquean el hilo de interfaz y detienen. Velocidad original; la grabación está separada de la medición." />

## Mediciones y reproducción

[Protocol, pinned versions and source](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/comparison.md).
