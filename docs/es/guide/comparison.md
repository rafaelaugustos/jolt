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

## Verificación en Android físico

Cinco pares alternados por configuración en un ASUS ZenFone 3 físico con Android 8.0.0; 30 segundos por ejecución tras cinco segundos de calentamiento. Los grupos con perfil predeterminado y de memoria se recopilaron secuencialmente. Estas medianas describen una animación simple en un teléfono antiguo, no una clasificación general de frameworks. Flutter no se repitió aquí.

| Configuración                           | CPU por 30 s (s) | PSS posterior (MiB) | Intervalo máximo entre frames, mediana (ms) |
| --------------------------------------- | ---------------: | ------------------: | ------------------------------------------: |
| Jolt, predeterminado                    |             6,79 |               88,27 |                                       17,04 |
| Reanimated, grupo predeterminado        |            14,63 |               85,65 |                                       17,25 |
| Jolt, perfil V8 de memoria explícito    |             7,37 |               79,16 |                                       50,15 |
| Reanimated, grupo del perfil de memoria |            14,70 |               85,96 |                                       17,06 |

La opción `--optimize_for_size` redujo el PSS posterior, pero aumentó CPU y los intervalos máximos respecto a Jolt predeterminado. Antes de la ventana de animación, Jolt con este perfil todavía usaba 89,56 MiB frente a 80,42 MiB de su control Reanimated. PSS es una muestra, no el máximo de memoria. Es un experimento de configuración de la aplicación; el motor y los valores predeterminados de Jolt no cambiaron. No active la opción solo para mejorar esta tabla.

El p95 de cadencia normal quedó cerca de 16,9 ms. La mediana de frame listo→presentación fue 32,43 ms para Jolt predeterminado y 25,28 ms para su control Reanimated; en el grupo de memoria, 30,03 y 25,31 ms. Estos intervalos físicos de SurfaceFlinger no son la métrica cola→presentación del emulador, latencia de entrada ni barrido del panel. La espera adicional y el bloqueo del hilo principal siguen sin resolverse. Algunos arranques también fallaron con `EGL_NOT_INITIALIZED`; se conservaron los intentos y no se ha aislado la causa.

Dos ejecuciones adicionales por fase de bloqueo usaron Jolt con el perfil de memoria y el mismo control Reanimated. Las medianas del intervalo máximo fueron **309,13 frente a 17,06 ms** al bloquear el JavaScript de la aplicación, y **300,85 frente a 300,79 ms** al bloquear el hilo de UI. El menor PSS no resolvió la diferencia ante el bloqueo de JavaScript. Cada ejecución incluye tres bloqueos deliberados de 300 ms.

<Clip name="comparison-jolt-physical-android" caption="ASUS ZenFone 3 físico, Android 8.0.0, interfaz en inglés. Jolt con el perfil V8 de memoria explícito: toques reales reinician, bloquean el JS de la aplicación, bloquean la UI y detienen. Velocidad original; grabación separada de la medición, con coste adicional de captura." />

<Clip name="comparison-reanimated-physical-android" caption="ASUS ZenFone 3 físico, Android 8.0.0, interfaz en inglés. Reanimated con inicio/reinicio, bloqueo del JS de la aplicación, bloqueo de la UI y parada mediante toques reales. Velocidad original; grabado por separado de las mediciones." />

En la prueba separada de asignación JSON, las dos ejecuciones predeterminadas tardaron 421,61 y 417,33 ms por lote medido (medianas); el perfil de memoria tardó 592,38 y 591,06 ms. La CPU del proceso subió de 426/420 a 743/742 ms, mientras el PSS posterior bajó de 120,57/121,15 a 102,51/102,06 MiB. Se excluye el primer lote de cada proceso. Este coste refuerza la decisión de mantener la opción experimental.

<Clip name="comparison-js-profile-physical-android" caption="ASUS ZenFone 3 físico, Android 8.0.0, interfaz en inglés. Prueba separada de asignación JavaScript, perfil predeterminado. Progreso real de lotes y finalización con checksum verificado; evidencia visual, no muestra de rendimiento ni comparación entre frameworks." />

[Rangos completos, muestras físicas originales, fallos, costes del perfil de memoria y reproducción](https://github.com/rafaelaugustos/jolt/tree/main/benchmarks/results/android-followup-2026-11-03).
