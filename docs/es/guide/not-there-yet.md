# Estado de la versión y límites {#not-there-yet}

RC.14 incorpora [asas de arrastre, posición durante el movimiento, destinos con padding y reanclaje](./interaction-depth) en Web, NativeScript y SwiftUI, y lleva a SwiftUI [rotación 3D y sombras](./swiftui-motion), [shimmer, loaders, reveal, degradados y blur](./swiftui-advanced), [entrada de texto y números rodantes](./swiftui-text) y [actividad por ventana en macOS](./swiftui), del PR #488. El PR #491 corrige un set inmediato que sustituye un path en Android (#479) y cierra los huecos de [puntero](./portable-foundations) y de grupos SwiftUI de #412/#413. Web y SwiftUI siguen siendo experimentales. Instale versiones npm coincidentes y recompile apps NativeScript; use la etiqueta `v0.1.0-rc.14` de [`jolt-swift`](https://github.com/rafaelaugustos/jolt-swift) para Swift Package Manager. Las guías en cuatro idiomas incluyen grabaciones nativas/Web revisadas. Los accesorios de puntero físicos siguen sin verificar (#492): la evidencia de puntero usa simulador, emulador y entrada inyectada.

RC.13 incorpora [SwiftUI independiente para iOS 17+/macOS 14+](./swiftui), [adaptadores Web React/Angular/Svelte/Solid](./web-frameworks), [inspección y replay portátiles](./portable-tools) y [paneles, reorder medido y curvas Bézier tipadas](./swiftui-geometry), del PR #436 (39 tareas). Web y SwiftUI siguen siendo experimentales. Instale versiones npm coincidentes y recompile apps NativeScript; use la etiqueta `v0.1.0-rc.13` para Swift Package Manager. Las guías en cuatro idiomas incluyen grabaciones nativas/Web revisadas. Sensores físicos, coste del inspector y comparaciones generales de rendimiento siguen separados.

RC.12.1 añade [recursos Web retenidos y ownership de shapes en Vue, coordinación de comportamientos, texto con degradado, rigs 2D, helpers compartidos y observación de la preferencia efectiva de movimiento reducido](./portable-composition). Los adaptadores de vectores del navegador comparten adquisición y unidades compatibles con el nativo; el campo magnético informa explícitamente que no está disponible. Instala paquetes de la misma versión y recompila las apps nativas. Las APIs Web siguen experimentales.

La entrega y precisión de sensores en un navegador físico siguen pendientes en #385. La validación usa simuladores/emuladores y lecturas inyectadas, identificadas como tales. La publicación no demuestra nuevas mejoras de rendimiento ni reproducción durante bloqueos de JavaScript.

RC.12 añade [presencia del puntero, propiedades coordinadas, actividad del renderer y dibujo acotado](./portable-foundations), además de [drop targets, audio/cues opcionales, inspección/replay y paths, rotación 3D y sombras Web](./interaction-depth). Recompila las apps nativas con paquetes de la misma versión. Las entradas Web siguen experimentales.

La validación con un accesorio físico de puntero, el modo silencioso del iPhone y nuevas mediciones de inspector/rendimiento en un Android más reciente siguen pendientes. El teléfono antiguo solo aporta evidencia de compatibilidad. Latencia/PSS (#405, #406) siguen como deuda técnica; publicar no demuestra superioridad de rendimiento ni reproducción durante bloqueos de JavaScript.

**Versión actual: 0.1.0-rc.12.1.** Incluye [adaptadores nativos](./frameworks), [fuentes adicionales de sensores](./device-sensors#vector-sources), [correcciones del teclado móvil](./mobile-web), [scroll Web relativo al elemento](./web-support#element-range), [entradas de shaders y vídeo local en iOS](./image-effects) y [mejoras de reproducción Android](./android-performance). [Instala paquetes de la misma versión](./install) y recompila las apps nativas. Las APIs Web siguen experimentales.

**Novedades de RC.10:** [degradados, carga y texto Web](./web-effects), [partículas, blur, formas y efectos de imagen](./web-surfaces), [teclado, paneles, navegación, física e iconos](./web-platforms), [gravedad, haptics, sensores, glass y retorno a miniaturas por clave](./web-parity), además de [headers de Core ScrollView nativo](./scroll-header#retained-scrollview) y [reordenación de filas montadas](./reorder#retained-rows). Recompila las aplicaciones nativas. La adopción en Mavis sigue separada.

**Novedades de RC.9:** [gestos Web, zoom, scroll/refresh coordinado y reorder](./web-gestures), además de [canales nativos de pintura retenida y composición de bindings](./live-springs#extended-live-paint). Recompila las aplicaciones nativas tras actualizar.

**Novedades de RC.8:** [orquestación Web y trazado SVG](./web-orchestration), [montaje Vue/Nuxt, identidad de elementos y scroll horizontal](./web-collections) y [reanudación del reemplazo nativo pausado](./motion-controllers#paused-replacement).

**También en RC.7:** [ámbitos, puntero/viewport y configuración continua Vue](./web-lifecycle), además de [geometría de overlays, elementos compartidos, recetas y diagnóstico](./web-interactions). La adopción en Mavis sigue separada.

**Desde RC.7:** [colores, bordes, pintura continua, tamaño real, FLIP y escenas con seek](./web-visual) amplían este runtime. Las APIs Web siguen experimentales; la paridad completa continúa en [#236](https://github.com/rafaelaugustos/jolt/issues/236).

**0.1.0-rc.12.1 está disponible.** Las funciones nativas mantienen sus límites documentados mientras continúa la validación estable. Las entradas Web son experimentales; publicarlas no completa la integración Mavis ni establece paridad de todas las APIs entre native y Web.

RC.6 incluye [movimiento continuo Web](./web-dynamic), con valores, followers y drag/snap, además de [mapeos numéricos, geometría y scroll vertical](./web-support). Las APIs Web siguen experimentales.

RC.6 también añade [bindings nativos de color/radio](./live-springs), [escenas con seek](./sequences), [tamaño Flexbox compatible](./size) y [springs entre cuerpos](./physics-attachments). Reconstruye las aplicaciones nativas tras actualizar.

RC.5 añade [playback Web experimental](./web-runtime), [press compuesto](./web-press) y el [adapter Vue DOM](./web-vue), corrige la recuperación tras segundo plano y la eliminación de layers Android, y entrega [pull-to-refresh nativo](./scroll-header#pull-to-refresh) y correcciones de foco de lectores en scroll/galería. Mavis completó la migración inicial de press/reveal y la prueba de animación compartida; la adopción de las capacidades de RC.6 continúa en sus [issues de integración](https://github.com/getcortexlabs/mavis-ui/issues/137).

RC.4 compone las ventanas de capas en nodos nativos, reanuda las formas, gradientes y blur de Android desde el tiempo en que estaban en pausa, coloca la hoja inferior según los insets del área segura del host y ofrece solo las acciones del identificador que un stop puede ejecutar. RC.3 añadió `interactiveModal()` en iOS, keyframes numéricos de Android en una sola llamada nativa, formas creadas antes de que la vista se cargue y refs de componente como objetivos.

La [auditoría de bindings/capas](./motion-values#binding-measurements) incluye preparación/reproducción en iPhone y Android físicos, inicio de respuesta a entradas automáticas y retención en montajes/desmontajes repetidos. Los costes altos de las ventanas de composición, los fallos de contadores aproximados de asignación y la falta de telemetría térmica en Android siguen explícitos en las pruebas. Los resultados orientan los escenarios medidos; no garantizan capacidad universal ni frames presentados. Desde RC.4, las composiciones en ventana se reproducen en compositores nativos sin envíos de frontera; el coste restante es el inicio síncrono de lotes grandes de keyframes, medido en la misma auditoría.

## Disponible en RC.11 {#available-in-rc-1}

- [Playback Web finito](./web-runtime), [press](./web-press) y [lifecycle Vue DOM](./web-vue) experimentales, con peers nativos/framework opcionales e imports seguros en SSR.
- [Navegación compartida](./shared-navigation), [gestos compartidos](./shared-gestures), [regreso a la celda actual](./return-targets) y [galería conectada](./gallery), para las combinaciones documentadas de Frame/ListView/imágenes estáticas.
- [Composición nativa de gestos](./gestures): desplazamiento, pellizco y rotación, además de la transferencia de gestos compatible con Core ScrollView vertical. Las [restricciones de arrastre](./drag) y el [zoom de fotos](./photo-zoom) tienen sus propios contratos de interacción.
- [Composición de desplazamiento](./scroll-header) con Core ListView y [filas montadas en Core ScrollView](./scroll-header#retained-scrollview), además de [sensores de rotación/gravedad](./device-sensors) que alimentan valores de movimiento nativos.
- [Dimensiones reales](./size), [cambios de diseño](./layout), [valores de movimiento](./motion-values), [progreso observable](./playback) y [controles conjuntos de línea de tiempo](./sequences).
- [Propiedades nativas externas](./native-properties), incluidas [luces/materiales de SceneKit](./scene-lighting), [campo de visión de la cámara](./scene-camera) y [entorno/parámetros de shaders](./scene-shaders), mediante el complemento nativo opcional.
- [Gravedad](./gravity), [física de círculos con anclajes](./physics-attachments), [trazado y transformación de vectores](./shapes), [desenfoque animado](./blur) y [Liquid Glass](./glass), con la compatibilidad y las alternativas por plataforma documentadas.

## Límites actuales {#current-limits}

- Las APIs Web siguen experimentales. Snapshots, coordenadas, disponibilidad de hardware y alternativas del navegador mantienen límites explícitos. Los [adaptadores nativos](./frameworks) están en RC.11; las referencias portátiles estables siguen siendo un trabajo separado.
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

La aceptación física inicial de rotación/gravedad está documentada en [#114](https://github.com/rafaelaugustos/jolt/issues/114) y el [informe de sensores](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/device-sensors.md). Aceleración, aceleración lineal, giroscopio y campo magnético están en RC.11; [su aceptación en simulador/emulador](./device-sensors#vector-sources) no demuestra precisión ni coste en dispositivos físicos.

La aceptación de galería y scroll aún requiere las verificaciones físicas pendientes de regularidad de fotogramas, respuesta a la entrada, memoria y accesibilidad. Consulta los informes de [galería](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/gallery.md) y [scroll](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/scroll-header.md). Las grabaciones de simulador/emulador no completan la aceptación en dispositivos físicos.

## Después de 0.1.0 {#after-0-1-0}

Las próximas RC se centran en corrección, compatibilidad, accesibilidad, ciclo de vida y documentación. El trabajo futuro incluye shaders de vistas arbitrarias, más articulaciones físicas y soporte modal más amplio entre plataformas. Los adaptadores nativos y las fuentes vectoriales documentados ya están en RC.11.

El [proyecto comparativo](https://github.com/rafaelaugustos/jolt/issues/65) es independiente de la entrega del alcance actualmente admitido. Las [issues de funcionalidades más amplias](https://github.com/rafaelaugustos/jolt/issues) no amplían las combinaciones admitidas por la versión estable ni modifican las alternativas por plataforma y los costes de JavaScript documentados.
