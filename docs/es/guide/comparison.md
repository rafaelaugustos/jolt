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

## Baseline medido

Emulador Android API 36 arm64, apps release, dos ejecuciones de 30 segundos por fase tras cinco segundos de calentamiento. Valores: mediana entre ejecuciones (mínimo–máximo). Sin grabación durante las mediciones.

### Movimiento normal

| Stack               | Intervalo de presentación p95 (ms) | CPU segundos / 30 s |        PSS final (MiB) |
| ------------------- | ---------------------------------: | ------------------: | ---------------------: |
| Jolt / NativeScript |                20.83 (18.15–23.51) |   9.75 (7.18–12.33) | 102.89 (102.10–103.68) |
| RN / Reanimated     |                18.44 (18.19–18.69) |    8.91 (7.98–9.84) |    92.20 (91.58–92.81) |
| Flutter             |                24.72 (18.24–31.20) | 15.80 (13.17–18.43) |    93.87 (93.04–94.70) |

### Bloqueos deliberados de 300 ms

| Fase             | Stack               | Máximo intervalo de presentación (ms) | Confirmación de entrada p95 (ms) |
| ---------------- | ------------------- | ------------------------------------: | -------------------------------: |
| Runtime del app  | Jolt / NativeScript |                308.68 (300.55–316.82) |                 0.17 (0.13–0.22) |
| Runtime del app  | RN / Reanimated     |                   36.81 (36.59–37.03) |                 0.66 (0.57–0.76) |
| Runtime del app  | Flutter             |                316.49 (316.26–316.72) |                 0.38 (0.34–0.43) |
| UI de plataforma | Jolt / NativeScript |                302.48 (300.49–304.48) |                 0.23 (0.12–0.33) |
| UI de plataforma | RN / Reanimated     |                301.39 (301.06–301.72) |                 3.28 (3.14–3.42) |
| UI de plataforma | Flutter             |                317.05 (315.91–318.19) |                 0.43 (0.40–0.45) |

Baseline exploratorio en emulador. Durante la recogida se corrigió la regla del host: la carga del emulador se contaba como interferencia externa; las muestras anteriores también cumplen la regla final. Se conserva el historial y los registros de exclusión. Presentar buffers no mide latencia del panel; confirmar la entrada no mide el primer píxel visible. NativeScript comparte JS/UI; Reanimated y Flutter tienen distinta distribución de hilos.

[Distribuciones, trazas Perfetto, hashes, memoria, CPU y reproducción](https://github.com/rafaelaugustos/jolt/tree/main/benchmarks/results/comparison-2026-11-03).

Una ejecución normal de Reanimated tuvo un intervalo de 348 ms fuera de las entradas programadas; no se aisló la causa. Se conserva la muestra. Dos repeticiones en un host compartido no establecen un ranking estable de CPU/frames.
