# Estado de la versión y límites {#not-there-yet}

**0.1.0-rc.4 está disponible.** Sus funciones ya se han entregado para las combinaciones documentadas en cada guía. El alcance funcional de 0.1.0 está congelado; la validación para la versión estable sigue en curso.

RC.4 compone las ventanas de capas en nodos nativos, reanuda las formas, gradientes y blur de Android desde el tiempo en que estaban en pausa, coloca la hoja inferior según los insets del área segura del host y ofrece solo las acciones del identificador que un stop puede ejecutar. RC.3 añadió `interactiveModal()` en iOS, keyframes numéricos de Android en una sola llamada nativa, formas creadas antes de que la vista se cargue y refs de componente como objetivos.

La [auditoría de bindings/capas](./motion-values#binding-measurements) incluye preparación/reproducción en iPhone y Android físicos, inicio de respuesta a entradas automáticas y retención en montajes/desmontajes repetidos. Los costes altos de las ventanas de composición, los fallos de contadores aproximados de asignación y la falta de telemetría térmica en Android siguen explícitos en las pruebas. Los resultados orientan los escenarios medidos; no garantizan capacidad universal ni frames presentados. Desde RC.4, las composiciones en ventana se reproducen en compositores nativos sin envíos de frontera; el coste restante es el inicio síncrono de lotes grandes de keyframes, medido en la misma auditoría.

## Disponible en RC.4 {#available-in-rc-1}

- [Navegación compartida](./shared-navigation), [gestos compartidos](./shared-gestures), [regreso a la celda actual](./return-targets) y [galería conectada](./gallery), para las combinaciones documentadas de Frame/ListView/imágenes estáticas.
- [Composición nativa de gestos](./gestures): desplazamiento, pellizco y rotación, además de la transferencia de gestos compatible con Core ScrollView vertical. Las [restricciones de arrastre](./drag) y el [zoom de fotos](./photo-zoom) tienen sus propios contratos de interacción.
- [Composición de desplazamiento](./scroll-header) con el adaptador de Core ListView, y [sensores de rotación/gravedad](./device-sensors) que alimentan valores de movimiento nativos.
- [Dimensiones reales](./size), [cambios de diseño](./layout), [valores de movimiento](./motion-values), [progreso observable](./playback) y [controles conjuntos de línea de tiempo](./sequences).
- [Propiedades nativas externas](./native-properties), incluidas [luces/materiales de SceneKit](./scene-lighting), [campo de visión de la cámara](./scene-camera) y [entorno/parámetros de shaders](./scene-shaders), mediante el complemento nativo opcional.
- [Gravedad](./gravity), [física de círculos con anclajes](./physics-attachments), [trazado y transformación de vectores](./shapes), [desenfoque animado](./blur) y [Liquid Glass](./glass), con la compatibilidad y las alternativas por plataforma documentadas.

## Límites actuales {#current-limits}

- `animateSize()` admite StackLayout/GridLayout, incluso dentro de ScrollView, y ejecuta medición/diseño en JavaScript en cada fotograma. La distribución flex, las celdas recicladas y los elementos compartidos quedan fuera de esa API.
- `drag()` no ofrece composición genérica de gestos con varios dedos. Usa [`gestures()`](./gestures) para desplazamiento/pellizco/rotación, o [zoom de fotos](./photo-zoom) para su controlador específico de pellizco, desplazamiento y cierre. El adaptador de transferencia de gestos admite Core ScrollView vertical; otras combinaciones de listas/contenedores requieren sus propios adaptadores y validación nativa.
- Los adaptadores de propiedades externas requieren `@rafaelaugusto/jolt-native`. Los adaptadores incluidos de cámara, luces y materiales de SceneKit son exclusivos de iOS; no se incluye un adaptador de renderizado 3D para Android. Las unidades de cámara de MapKit y MapLibre son distintas.
- El campo de visión de la cámara SceneKit admite proyección en perspectiva automática en iOS. La escala ortográfica, las matrices de proyección personalizadas y los controles arbitrarios de lente quedan fuera de ese adaptador.
- Las líneas de tiempo pausan y reanudan sus participantes, pero no ofrecen ajuste arbitrario del progreso agregado de callbacks o efectos de una sola ejecución.
- La reproducción nativa tiene [rutas de ejecución](./how-it-works) específicas de cada API. Las escrituras de propiedades nativas no aíslan un renderizador del JavaScript en el hilo principal. El diseño, las suscripciones opcionales, la entrada y el ciclo de vida conservan sus costes documentados de JavaScript.

## De RC a 0.1.0 {#from-rc-to-0-1-0}

Las issues de aceptación abiertas que aparecen a continuación corresponden a API ya entregadas. Antes de la versión estable, valida las combinaciones admitidas en dispositivos físicos iOS y Android:

- **Galería ([#117](https://github.com/rafaelaugustos/jolt/issues/117)):** zoom/regreso interrumpido, destinos reciclados o eliminados, rotación, accesibilidad y navegación repetida sin capas superpuestas retenidas.
- **Composición de desplazamiento ([#116](https://github.com/rafaelaugustos/jolt/issues/116)):** inversión/inercia, cambios tardíos de diseño, conservación del anclaje y limpieza con el adaptador admitido de Core ListView.
- Mantén las pruebas generales, de iOS y Android y sus controles negativos pasando en el commit de la versión. Comprueba la instalación de los paquetes correspondientes y una recompilación nativa limpia; resuelve las regresiones que bloquean la versión antes de etiquetar la estable.

La aceptación física inicial de rotación/gravedad se completó en [#114](https://github.com/rafaelaugustos/jolt/issues/114). El [informe de sensores](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/device-sensors.md) documenta el alcance probado y sus límites. Las fuentes de aceleración, giroscopio y campo magnético siguen como trabajo separado en [#256](https://github.com/rafaelaugustos/jolt/issues/256).

La aceptación de galería y scroll aún requiere las verificaciones físicas pendientes de regularidad de fotogramas, respuesta a la entrada, memoria y accesibilidad. Consulta los informes de [galería](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/gallery.md) y [scroll](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/scroll-header.md). Las grabaciones de simulador/emulador no completan la aceptación en dispositivos físicos.

## Después de 0.1.0 {#after-0-1-0}

Las siguientes RC se centran en corrección, compatibilidad, accesibilidad, limpieza del ciclo de vida y documentación. Las capacidades nuevas quedan para después de 0.1.0: otros adaptadores de frameworks, shaders arbitrarios de vistas, más tipos de sensores, uniones físicas entre cuerpos y navegación modal genérica.

El [proyecto comparativo](https://github.com/rafaelaugustos/jolt/issues/65) es independiente de la entrega del alcance actualmente admitido. Las [issues de funcionalidades más amplias](https://github.com/rafaelaugustos/jolt/issues) no amplían las combinaciones admitidas por la versión estable ni modifican las alternativas por plataforma y los costes de JavaScript documentados.
