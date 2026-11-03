# Rendimiento, a la vista

El [panel de la página principal](/es/#performance) presenta una instantánea fija del [PR #395](https://github.com/rafaelaugustos/jolt/pull/395), integrado e incluido en RC.11 el 3 de noviembre de 2026. Los datos se fijan al commit `c15b7f0da59168bcf1baa187daa7a622e9e5c19b`. Es un estudio exploratorio; no cambia el motor ni los valores predeterminados de Jolt. Las barras usan Jolt Web para mostrar mediciones almacenadas, no para ejecutar un benchmark en el navegador.

## Qué se midió

ASUS ZenFone 3 físico (ASUS_Z017DC), Android 8.0.0, aplicaciones arm64 release. Un bloque de 48 × 48 píxeles lógicos se desplaza 240 unidades y cambia la opacidad de 1 a 0,4, con tramos lineales de un segundo. Cinco pares alternados por configuración, 30 segundos por ejecución tras cinco segundos de calentamiento. Reinicios a los 5, 15 y 25 segundos. No se grabó durante la medición.

Las tres métricas del panel usan el **grupo de configuración predeterminada**:

| Métrica                                                | NativeScript + Jolt | React Native + Reanimated |
| ------------------------------------------------------ | ------------------: | ------------------------: |
| CPU del proceso, segundos por ejecución de 30 segundos |                6,79 |                     14,63 |
| PSS después de la ejecución, MiB                       |               88,27 |                     85,65 |
| P50 de frame listo → presentación, ms                  |               32,43 |                     25,28 |

Son medianas de cinco ejecuciones. CPU incluye todos los hilos, normalizada a 30 segundos; rangos 6,74–7,27 s y 14,53–14,68 s. El 53,6% se calcula con esas medianas: no significa velocidad de animación, ahorro de batería ni comparación aislada de bibliotecas. PSS es una instantánea posterior, no memoria máxima. La espera es la mediana del p50 de cada ejecución, no latencia táctil ni barrido del panel.

## Costes y resultados incompletos

Jolt predeterminado utilizó 2,62 MiB más de PSS y tuvo 7,15 ms más de espera en este escenario. No establece una clasificación para aplicaciones completas, listas, gestos, otros teléfonos o Android en general.

El grupo separado de **perfil V8 size explícito** midió 7,37 frente a 14,70 segundos de CPU y 79,16 frente a 85,96 MiB de PSS posterior. Las medianas de los intervalos máximos fueron 50,15 frente a 17,06 ms. El PSS anterior de Jolt seguía siendo mayor: 89,56 frente a 80,42 MiB. Menor memoria posterior costó CPU y mayores intervalos; una carga JSON separada también fue más lenta. Los grupos fueron secuenciales, sin aleatorizar perfiles. Es un experimento opcional del runtime, no un valor predeterminado de Jolt.

Dos ejecuciones adicionales por fase usaron el APK Jolt size y tres bloqueos de 300 ms. La mediana del intervalo máximo con JavaScript bloqueado fue **309,13 ms en Jolt frente a 17,06 ms en Reanimated**. JavaScript de NativeScript comparte el hilo UI; JavaScript de aplicación de Reanimated no. Bloquear UI dio 300,85 frente a 300,79 ms. Son rutas de hilos distintas.

Cuatro inicios fríos de Jolt fallaron con `EGL_NOT_INITIALIZED`; otro intento fue obstruido por un diálogo de error anterior. Se conservan fuera de las muestras exitosas; la causa y una tasa general de fallos no están establecidas. El observador y las condiciones térmicas también limitan los resultados.

[Muestras, rangos, fallos e identidades](https://github.com/rafaelaugustos/jolt/blob/c15b7f0da59168bcf1baa187daa7a622e9e5c19b/benchmarks/results/android-followup-2026-11-03/README.md) · [Protocolo y reproducción](https://github.com/rafaelaugustos/jolt/blob/c15b7f0da59168bcf1baa187daa7a622e9e5c19b/benchmarks/comparison.md). Las mediciones del emulador no se mezclan en el panel.

## Grabaciones nativas reales

Grabaciones en inglés revisadas en el PR fijado, copiadas sin modificar fotogramas ni tiempos. Muestran controles y bloqueos, **no las muestras principales de medición**. El vídeo Jolt utiliza size; el panel utiliza el grupo predeterminado.

<Clip name="comparison-jolt-physical-android" caption="ASUS ZenFone 3 físico / Android 8.0.0, inglés: Jolt con perfil V8 size explícito. Interacciones reales de inicio/reinicio, bloqueo JS, bloqueo UI y parada. Velocidad original, grabación separada de las mediciones. No es la ejecución predeterminada del gráfico." />

<Clip name="comparison-reanimated-physical-android" caption="ASUS ZenFone 3 físico / Android 8.0.0, inglés: React Native + Reanimated con inicio/reinicio, bloqueo JS, bloqueo UI y parada reales. Velocidad original, grabación separada de las mediciones. El vídeo no establece resultados de CPU, memoria ni tiempos." />

## Recorrido del sitio

<Clip name="motion-site-chromium" :width="960" caption="Chromium en macOS arm64: interacción real de puntero y teclado, selección de métricas y nuevo pie de página. Las barras muestran mediciones almacenadas del teléfono físico. Esta captura del navegador no demuestra rendimiento nativo; los vídeos nativos tienen sus propias etiquetas." />
