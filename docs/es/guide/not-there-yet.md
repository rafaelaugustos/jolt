# Estado de la versión y límites {#not-there-yet}

**También en RC.7:** [ámbitos, puntero/viewport y configuración continua Vue](./web-lifecycle), además de [geometría de overlays, elementos compartidos, recetas y diagnóstico](./web-interactions). La adopción en Mavis sigue separada.

**Desde RC.7:** [colores, bordes, pintura continua, tamaño real, FLIP y escenas con seek](./web-visual) amplían este runtime. Las APIs Web siguen experimentales; la paridad completa continúa en [#236](https://github.com/rafaelaugustos/jolt/issues/236).

**0.1.0-rc.7 está disponible.** Las funciones nativas mantienen sus límites documentados mientras continúa la validación estable. Las entradas Web son experimentales; publicarlas no completa la integración Mavis ni establece paridad de todas las APIs entre native y Web.

RC.6 incluye [movimiento continuo Web](./web-dynamic), con valores, followers y drag/snap, además de [mapeos numéricos, geometría y scroll vertical](./web-support). Las APIs Web siguen experimentales.

RC.6 también añade [bindings nativos de color/radio](./live-springs), [escenas con seek](./sequences), [tamaño Flexbox compatible](./size) y [springs entre cuerpos](./physics-attachments). Reconstruye las aplicaciones nativas tras actualizar.

RC.5 añade [playback Web experimental](./web-runtime), [press compuesto](./web-press) y el [adapter Vue DOM](./web-vue), corrige la recuperación tras segundo plano y la eliminación de layers Android, y entrega [pull-to-refresh nativo](./scroll-header#pull-to-refresh) y correcciones de foco de lectores en scroll/galería. Mavis completó la migración inicial de press/reveal y la prueba de animación compartida; la adopción de las capacidades de RC.6 continúa en sus [issues de integración](https://github.com/getcortexlabs/mavis-ui/issues/137).

RC.4 compone las ventanas de capas en nodos nativos, reanuda las formas, gradientes y blur de Android desde el tiempo en que estaban en pausa, coloca la hoja inferior según los insets del área segura del host y ofrece solo las acciones del identificador que un stop puede ejecutar. RC.3 añadió `interactiveModal()` en iOS, keyframes numéricos de Android en una sola llamada nativa, formas creadas antes de que la vista se cargue y refs de componente como objetivos.

La [auditoría de bindings/capas](./motion-values#binding-measurements) incluye preparación/reproducción en iPhone y Android físicos, inicio de respuesta a entradas automáticas y retención en montajes/desmontajes repetidos. Los costes altos de las ventanas de composición, los fallos de contadores aproximados de asignación y la falta de telemetría térmica en Android siguen explícitos en las pruebas. Los resultados orientan los escenarios medidos; no garantizan capacidad universal ni frames presentados. Desde RC.4, las composiciones en ventana se reproducen en compositores nativos sin envíos de frontera; el coste restante es el inicio síncrono de lotes grandes de keyframes, medido en la misma auditoría.

## Disponible en RC.7 {#available-in-rc-1}

- [Playback Web finito](./web-runtime), [press](./web-press) y [lifecycle Vue DOM](./web-vue) experimentales, con peers nativos/framework opcionales e imports seguros en SSR.
- [Navegación compartida](./shared-navigation), [gestos compartidos](./shared-gestures), [regreso a la celda actual](./return-targets) y [galería conectada](./gallery), para las combinaciones documentadas de Frame/ListView/imágenes estáticas.
- [Composición nativa de gestos](./gestures): desplazamiento, pellizco y rotación, además de la transferencia de gestos compatible con Core ScrollView vertical. Las [restricciones de arrastre](./drag) y el [zoom de fotos](./photo-zoom) tienen sus propios contratos de interacción.
- [Composición de desplazamiento](./scroll-header) con el adaptador de Core ListView, y [sensores de rotación/gravedad](./device-sensors) que alimentan valores de movimiento nativos.
- [Dimensiones reales](./size), [cambios de diseño](./layout), [valores de movimiento](./motion-values), [progreso observable](./playback) y [controles conjuntos de línea de tiempo](./sequences).
- [Propiedades nativas externas](./native-properties), incluidas [luces/materiales de SceneKit](./scene-lighting), [campo de visión de la cámara](./scene-camera) y [entorno/parámetros de shaders](./scene-shaders), mediante el complemento nativo opcional.
- [Gravedad](./gravity), [física de círculos con anclajes](./physics-attachments), [trazado y transformación de vectores](./shapes), [desenfoque animado](./blur) y [Liquid Glass](./glass), con la compatibilidad y las alternativas por plataforma documentadas.

## Límites actuales {#current-limits}

- Las APIs Web siguen experimentales. RC.7 añade [pintura, tamaño real, FLIP y escenas](./web-visual), [ámbitos/input/ciclo de vida Vue](./web-lifecycle) y [overlays/elementos compartidos/diagnóstico](./web-interactions) a la base continua de RC.6. El contenido de snapshots y los espacios de coordenadas mantienen límites explícitos; pinch/handoff de scroll, otros adapters y referencias portátiles estables siguen fuera de esta versión.
- `animateSize()` admite StackLayout/GridLayout y hijos directos de FlexboxLayout row/column sin wrap, incluso en ScrollView. El hijo animado en el eje principal necesita `flexGrow=0` y `flexShrink=0`; la asignación del padre y el stretch transversal siguen prevaleciendo. Medición/layout usa JavaScript por frame. Celdas recicladas y elementos compartidos quedan fuera.
- `drag()` no ofrece composición genérica de gestos con varios dedos. Usa [`gestures()`](./gestures) para desplazamiento/pellizco/rotación, o [zoom de fotos](./photo-zoom) para su controlador específico de pellizco, desplazamiento y cierre. El adaptador de transferencia de gestos admite Core ScrollView vertical; otras combinaciones de listas/contenedores requieren sus propios adaptadores y validación nativa.
- Los adaptadores de propiedades externas requieren `@rafaelaugusto/jolt-native`. Los adaptadores incluidos de cámara, luces y materiales de SceneKit son exclusivos de iOS; no se incluye un adaptador de renderizado 3D para Android. Las unidades de cámara de MapKit y MapLibre son distintas.
- El campo de visión de la cámara SceneKit admite proyección en perspectiva automática en iOS. La escala ortográfica, las matrices de proyección personalizadas y los controles arbitrarios de lente quedan fuera de ese adaptador.
- `seekableTimeline()` permite seek en escenas declarativas finitas de vistas/valores numéricos. Callbacks, haptics, followers continuos y efectos arbitrarios de una sola ejecución quedan fuera; las timelines imperativas conservan controles de participantes.
- La reproducción nativa tiene [rutas de ejecución](./how-it-works) específicas de cada API. Las escrituras de propiedades nativas no aíslan un renderizador del JavaScript en el hilo principal. El diseño, las suscripciones opcionales, la entrada y el ciclo de vida conservan sus costes documentados de JavaScript.

## De RC a 0.1.0 {#from-rc-to-0-1-0}

Las issues de aceptación abiertas que aparecen a continuación corresponden a API ya entregadas. Antes de la versión estable, valida las combinaciones admitidas en dispositivos físicos iOS y Android:

- **Galería ([#117](https://github.com/rafaelaugustos/jolt/issues/117)):** zoom/regreso interrumpido, destinos reciclados o eliminados, rotación, accesibilidad y navegación repetida sin capas superpuestas retenidas.
- **Composición de desplazamiento ([#116](https://github.com/rafaelaugustos/jolt/issues/116)):** inversión/inercia, cambios tardíos de diseño, conservación del anclaje y limpieza con el adaptador admitido de Core ListView.
- Mantén las pruebas generales, de iOS y Android y sus controles negativos pasando en el commit de la versión. Comprueba la instalación de los paquetes correspondientes y una recompilación nativa limpia; resuelve las regresiones que bloquean la versión antes de etiquetar la estable.

La aceptación física inicial de rotación/gravedad se completó en [#114](https://github.com/rafaelaugustos/jolt/issues/114). El [informe de sensores](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/device-sensors.md) documenta el alcance probado y sus límites. Las fuentes de aceleración, giroscopio y campo magnético siguen como trabajo separado en [#256](https://github.com/rafaelaugustos/jolt/issues/256).

La aceptación de galería y scroll aún requiere las verificaciones físicas pendientes de regularidad de fotogramas, respuesta a la entrada, memoria y accesibilidad. Consulta los informes de [galería](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/gallery.md) y [scroll](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/scroll-header.md). Las grabaciones de simulador/emulador no completan la aceptación en dispositivos físicos.

## Después de 0.1.0 {#after-0-1-0}

Las siguientes RC se centran en corrección, compatibilidad, accesibilidad, limpieza del ciclo de vida y documentación. Las capacidades nuevas quedan para después de 0.1.0: otros adaptadores de frameworks, shaders arbitrarios de vistas, más tipos de sensores, otros tipos de uniones físicas y navegación modal genérica.

El [proyecto comparativo](https://github.com/rafaelaugustos/jolt/issues/65) es independiente de la entrega del alcance actualmente admitido. Las [issues de funcionalidades más amplias](https://github.com/rafaelaugustos/jolt/issues) no amplían las combinaciones admitidas por la versión estable ni modifican las alternativas por plataforma y los costes de JavaScript documentados.
