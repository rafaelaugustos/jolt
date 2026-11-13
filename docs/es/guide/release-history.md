# Historial de versiones

## 0.1.0-rc.15: Valores combinados, scroll y listas por clave {#rc-15}

RC.15 incorpora [valores de movimiento combinados, bindings de scroll nativo, salidas de layout, listas por clave y encabezados SwiftUI](./values-scroll-lists), del [PR #506](https://github.com/rafaelaugustos/jolt/pull/506). La documentación organiza sus 109 enlaces en 16 temas. Instale core/plugin nativo en la misma versión y recompile apps NativeScript; use `v0.1.0-rc.15` de [`jolt-swift`](https://github.com/rafaelaugustos/jolt-swift) para Swift Package Manager. Las nuevas capacidades, Web y SwiftUI siguen siendo experimentales.

Siguen pendientes las mediciones de asignaciones/tiempo por frame en Android físico (#494), la matriz completa de scroll horizontal/RTL/bounce/CollectionView de terceros y el coste comparable por evento (#495), y la navegación y el foco completos con VoiceOver/TalkBack nativos (#498/#499). Esas issues permanecen abiertas. Las transiciones de Core ListView requieren filas planas de altura fija; transiciones de CollectionView, secciones, grids y movimientos entre listas quedan fuera de este primer adaptador. La evidencia de simulador/emulador no demuestra menor CPU/PSS del app ni superioridad sobre Reanimated.

## 0.1.0-rc.14: Drop ordenado y paridad de SwiftUI {#rc-14}

RC.14 incorpora [asas de arrastre, posición durante el movimiento, destinos con padding y reanclaje](./interaction-depth) en Web, NativeScript y SwiftUI, y lleva a SwiftUI [rotación 3D y sombras](./swiftui-motion), [shimmer, loaders, reveal, degradados y blur](./swiftui-advanced), [entrada de texto y números rodantes](./swiftui-text) y [actividad por ventana en macOS](./swiftui), del PR #488. El PR #491 corrige un set inmediato que sustituye un path en Android (#479) y cierra los huecos de [puntero](./portable-foundations) y de grupos SwiftUI de #412/#413. Web y SwiftUI siguen siendo experimentales. Instale versiones npm coincidentes y recompile apps NativeScript; use la etiqueta `v0.1.0-rc.14` de [`jolt-swift`](https://github.com/rafaelaugustos/jolt-swift) para Swift Package Manager. Las guías en cuatro idiomas incluyen grabaciones nativas/Web revisadas. Los accesorios de puntero físicos siguen sin verificar (#492): la evidencia de puntero usa simulador, emulador y entrada inyectada.

[0.1.0-rc.14](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.14)

## 0.1.0-rc.13: SwiftUI y ciclo de vida de frameworks Web {#rc-13}

RC.13 incorpora [SwiftUI independiente para iOS 17+/macOS 14+](./swiftui), [adaptadores Web React/Angular/Svelte/Solid](./web-frameworks), [inspección y replay portátiles](./portable-tools) y [paneles, reorder medido y curvas Bézier tipadas](./swiftui-geometry), del PR #436 (39 tareas). Web y SwiftUI siguen siendo experimentales. Instale versiones npm coincidentes y recompile apps NativeScript; use la etiqueta `v0.1.0-rc.13` para Swift Package Manager. Las guías en cuatro idiomas incluyen grabaciones nativas/Web revisadas. Sensores físicos, coste del inspector y comparaciones generales de rendimiento siguen separados.

[0.1.0-rc.13](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.13)

## 0.1.0-rc.12.1: Composición portable y preferencias {#release-candidate}

RC.12.1 añade [recursos Web retenidos y ownership de shapes en Vue, coordinación de comportamientos, texto con degradado, rigs 2D, helpers compartidos y observación de la preferencia efectiva de movimiento reducido](./portable-composition). Los adaptadores de vectores del navegador comparten adquisición y unidades compatibles con el nativo; el campo magnético informa explícitamente que no está disponible. Instala paquetes de la misma versión y recompila las apps nativas. Las APIs Web siguen experimentales.

La entrega y precisión de sensores en un navegador físico siguen pendientes en #385. La validación usa simuladores/emuladores y lecturas inyectadas, identificadas como tales. La publicación no demuestra nuevas mejoras de rendimiento ni reproducción durante bloqueos de JavaScript.

<Clip :autoplay="false" name="composition-behaviors-ios" caption="Simulador iOS 26.2, interfaz en inglés: grabaciones revisadas de interrupción, prioridades y regreso al reposo en nativo y navegador. Interacción real con XCTest/Playwright; no representa un dispositivo físico." />

<Clip :autoplay="false" name="composition-behaviors-web" caption="Chromium en macOS, interfaz en inglés: grabaciones revisadas de interrupción, prioridades y regreso al reposo en nativo y navegador. Interacción real con XCTest/Playwright; no representa un dispositivo físico." />

## 0.1.0-rc.12: Interacción, dibujo y profundidad portables {#rc-12}

RC.12 añade [presencia del puntero, propiedades coordinadas, actividad del renderer y dibujo acotado](./portable-foundations), además de [drop targets, audio/cues opcionales, inspección/replay y paths, rotación 3D y sombras Web](./interaction-depth). Recompila las apps nativas con paquetes de la misma versión. Las entradas Web siguen experimentales.

La validación con un accesorio físico de puntero, el modo silencioso del iPhone y nuevas mediciones de inspector/rendimiento en un Android más reciente siguen pendientes. El teléfono antiguo solo aporta evidencia de compatibilidad. Latencia/PSS (#405, #406) siguen como deuda técnica; publicar no demuestra superioridad de rendimiento ni reproducción durante bloqueos de JavaScript.

<Clip :autoplay="false" name="portable-groups-ios" caption="Simulador iOS 26.2, interfaz en inglés: propiedades nativas y uniforms SceneKit coordinados, pausa/reanudación, sustitución y remontaje. Grabación revisada reutilizada; no mide rendimiento de un dispositivo físico." />

<Clip :autoplay="false" name="interaction-drop-android" caption="ASUS ZenFone 3 físico, Android 8, interfaz en inglés: arrastre real con rechazo y aceptación, seguido de remontaje del scope. Grabación revisada de compatibilidad reutilizada." />

<Clip :autoplay="false" name="interaction-tools-web" caption="Chromium, interfaz en inglés: edición de animación de la aplicación y dos replays de una traza numérica, verificando el destino y cero recursos restantes. Interacción real; sin captura de entradas del sistema." />

## 0.1.0-rc.11.1: Ciclo de vida y composición nativa {#rc-11-1}

RC.11.1 añade [recursos retenidos y dibujos con ciclo de vida Vue, prioridades de comportamientos, partes 2D articuladas, texto con degradado y eventos con nombre en timelines](./native-composition). Las APIs nativas incluyen interrupción, movimiento reducido y controles de ciclo de vida para los usos documentados.

[Instala RC.11.1](./install), conserva el paquete nativo opcional en la misma versión y recompila las apps. Las investigaciones de latencia y memoria siguen como deuda técnica (#405, #406); esta versión no afirma nuevas mejoras de rendimiento ni reproducción durante bloqueos del JavaScript de la aplicación.

<Clip name="native-text-android" caption="ASUS ZenFone 3 físico, Android 8, interfaz en inglés: taps nativos reales muestran letras con degradado, luz en movimiento, reemplazo de texto, pausa/reanudación y movimiento reducido. Velocidad original; no es una medición de rendimiento." />

## 0.1.0-rc.11: ajustes Web y reproducción nativa {#rc-11}

RC.11 ajusta el [teclado móvil](./web-platforms), los [rangos de scroll relativos al elemento](./web-support) y los diagnósticos de conflictos entre superficies. Añade adapters nativos opcionales, [sensores](./device-sensors), [shaders controlados por resortes/scroll, máscaras líquidas y vídeo local sin audio en iOS](./image-effects). La [reproducción Android](./android-performance) conserva menos datos al finalizar; el exportador de auditoría procesa informes en un worker. El [estudio en dispositivo físico](./performance-study) documenta CPU, memoria y presentación sin cambiar la configuración predeterminada.

Las APIs Web siguen experimentales. El sitio ya usa el runtime Web para la escultura, el movimiento con scroll y el playground; los cambios de shaders/vídeo nativos no se aplican automáticamente al DOM. [Instala RC.11](./install), conserva el paquete nativo opcional en la misma versión y recompila las apps nativas. [Changelog de la versión](https://github.com/rafaelaugustos/jolt/blob/v0.1.0-rc.11/CHANGELOG.md).

<Clip name="shader-inputs-liquid-mask-ios" caption="Simulador iPhone 17 Pro, iOS 26.2, interfaz en inglés. Taps y scroll reales mediante XCTest muestran entradas nativas, fusión/separación, transparencia, resize y descarte. Velocidad original; no es un dispositivo físico." />
<Clip name="web-element-range-chromium" caption="Chromium de escritorio, interfaz en inglés. Rueda y clics reales muestran entrada/salida de la sección, inserción encima, resize, diagnóstico de geometría y recuperación. Grabación del navegador a velocidad original; no mide rendimiento nativo ni de un dispositivo físico." />

## 0.1.0-rc.10: efectos Web, sensores y retorno completo de la galería {#rc-10}

RC.10 añade [degradados, carga y texto](./web-effects), [partículas, blur, formas y efectos de imagen](./web-surfaces), [teclado, paneles, navegación, física e iconos](./web-platforms) y [gravedad, haptics, sensores, glass y retorno a miniaturas por clave](./web-parity). Las aplicaciones nativas ganan [headers de Core ScrollView](./scroll-header#retained-scrollview) y [reordenación de filas montadas](./reorder#retained-rows).

Las APIs Web siguen experimentales. [Instala RC.10](./install), conserva los adapters nativos opcionales en la misma versión y recompila las aplicaciones nativas. [Notas](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.10). La adopción en Mavis sigue separada.

## 0.1.0-rc.8: orquestación y ciclo de vida Web {#rc-8}

RC.8 añade [reproducción de valores, decay, progreso, secuencias, timelines, estados y trazado SVG](/es/guide/web-orchestration), además de [montaje Vue/Nuxt, entradas por identidad y scroll horizontal](/es/guide/web-collections). Los [estados nativos](/es/guide/motion-controllers#paused-replacement) ahora reanudan la vista sustituta tras retirar la anterior durante la pausa.

Las APIs Web siguen experimentales, con límites documentados de coordenadas/captura; Mavis se integra por separado. [Instala RC.8](/es/guide/install), conserva el paquete nativo opcional en la misma versión y reconstruye las apps nativas. Consulta las [notas](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.8) y la [aceptación pendiente](/es/guide/not-there-yet).

## 0.1.0-rc.7: layout e interacciones completas Web {#rc-7}

RC.7 añade [colores, bordes, tamaño intrínseco, FLIP y escenas con seek](/es/guide/web-visual), [ámbitos, puntero/viewport y configuración continua Vue](/es/guide/web-lifecycle), además de [geometría de overlays, elementos compartidos, recetas y diagnóstico](/es/guide/web-interactions). El [showcase](/es/guide/showcase) presenta ejemplos nativos y envíos de la comunidad.

Las APIs Web siguen experimentales, con límites documentados de coordenadas/captura; Mavis se integra por separado. [Instala RC.7](/es/guide/install), conserva el paquete nativo opcional en la misma versión y reconstruye las apps nativas. Consulta las [notas](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.7) y la [aceptación pendiente](/es/guide/not-there-yet).

## 0.1.0-rc.6: interacción Web y movimiento nativo {#rc-6}

RC.6 añade [valores, springs continuas y drag/snap Web](/es/guide/web-dynamic), además de [mapeos, geometría y scroll](/es/guide/web-support). En native entrega [color/radio con springs](/es/guide/live-springs), [escenas con seek](/es/guide/sequences), [tamaño Flexbox](/es/guide/size) y [springs entre cuerpos](/es/guide/physics-attachments).

Las APIs Web siguen experimentales; Mavis se integra por separado. [Instala RC.6](/es/guide/install), reconstruye las apps nativas y consulta las [notas](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.6) y la [aceptación pendiente](/es/guide/not-there-yet).

## 0.1.0-rc.4: composición nativa, reanudación y hojas {#rc-4}

RC.4 reproduce [capas infinitas sin período común](/es/guide/layers) en compositores nativos en lugar de reconstruir ventanas de cuatro segundos, así que las composiciones de 64 vistas pasan de cientos de milisegundos por frontera a ninguno en los teléfonos medidos. Reanuda [formas, gradientes y blur de Android](/es/guide/shapes) desde el tiempo en que estaban en pausa, coloca la [hoja inferior](/es/guide/bottom-sheet) según los insets del área segura del host y ofrece solo las acciones del identificador que un stop puede ejecutar.

La [vista previa](/es/guide/demo) tiene **74 ejemplos en cuatro idiomas**. [Instala RC.4](/es/guide/install) y reconstruye la aplicación nativa. Consulta las [notas de la versión](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.4) y la [aceptación pendiente en dispositivos físicos](/es/guide/not-there-yet) antes de la versión estable.

## 0.1.0-rc.3: modales, formas y objetivos {#_0-1-0-rc-3-modals-shapes-and-targets}

RC.3 añade [modales interactivos en iOS](/es/guide/interactive-navigation), construye [keyframes numéricos de Android en una sola llamada nativa](/es/guide/motion-values), permite [crear formas antes de que la vista se cargue](/es/guide/shapes) y acepta [refs de componente como objetivos](/es/guide/vue). Ajusta la [galería](/es/guide/gallery) y las [cabeceras de scroll](/es/guide/scroll-header) al texto grande del sistema y completa las auditorías físicas de [sensores](/es/guide/device-sensors) y de [bindings/capas](/es/guide/motion-values).

La [vista previa](/es/guide/demo) tiene **74 ejemplos en cuatro idiomas**. [Instala RC.3](/es/guide/install) y reconstruye la aplicación nativa. Consulta las [notas de la versión](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.3) y la [aceptación pendiente en dispositivos físicos](/es/guide/not-there-yet) antes de la versión estable.

## 0.1.0-rc.2: correcciones del ciclo de vida y la composición {#_0-1-0-rc-2-lifecycle-and-composition-fixes}

RC.2 corrige [las anclas de scroll durante cambios de tamaño y recarga](/es/guide/scroll-header), [los gestos de retorno en iOS tras pasar a segundo plano](/es/guide/interactive-navigation), [la liberación de press en capas](/es/guide/press#layered-press) y [la sincronización de la composición nativa](/es/guide/layers). Incluye [arrastre nativo con resorte en el puntero](/es/guide/physics-attachments) y [validación del ciclo de vida de la galería en Android](/es/guide/gallery#android-rotation-and-resume).

La [vista previa](/es/guide/demo) ya tiene **74 ejemplos en cuatro idiomas**. [Instala RC.2](/es/guide/install) y reconstruye la aplicación nativa. Consulta las [notas de la versión](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.2) y la [aceptación pendiente en dispositivos físicos](/es/guide/not-there-yet) antes de la versión estable.

## 0.1.0-rc.1: la primera versión candidata {#_0-1-0-rc-1-the-first-release-candidate}

El alcance de la característica 0.1.0 está congelado. Este candidato trae [navegación compartida](/es/guide/shared-navigation) y un [galería de fotos conectada](/es/guide/gallery), [iOS gestos hacia atrás](/es/guide/interactive-navigation) y [Android respaldo predictivo](/es/guide/predictive-back) nativos, [composición de desplazamiento](/es/guide/scroll-header), [sensores del dispositivo](/es/guide/device-sensors), [gravedad](/es/guide/gravity) y [física circular con archivos adjuntos](/es/guide/physics-attachments).

[Dibujo vectorial y transformación](/es/guide/shapes), [desenfoque animado](/es/guide/blur) y [Liquid Glass en iOS 26](/es/guide/glass) se unen a un [vista previa](/es/guide/demo) con **73 ejemplos en inglés, portugués, español y chino simplificado**. Reconstruya la aplicación nativa después de la actualización. [Instalar RC.1](/es/guide/install), lea [notas de la versión](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.1) o verifique [trabajo de aceptación restante antes del establo](/es/guide/not-there-yet). La fase RC se centra en correcciones, compatibilidad y validación en dispositivos físicos.

<div class="clips">
<Clip name="gallery-ios" caption="Simulador iOS, inglés: pinch/pan real, zoom interrumpido, descarte cancelado y regreso a la miniatura actual después de reordenar. Velocidad original." />
<Clip name="physics-attachments-android" caption="Emulador Android, inglés: arrastre/liberación real con ataduras, resortes, colisiones y puntos de ajuste nativos. Sincronización original; no es una medida del rendimiento del dispositivo físico." />
<Clip name="shapes-android" caption="Emulador Android, inglés: toques reales dibujan un trazo vectorial, transforman rutas compatibles, interrumpen y pausan la reproducción. Velocidad original." />
<Clip name="glass-ios" caption="Simulador iOS 26.2, inglés: superficies de vidrio nativo se fusionan y dividen, con cambios de material, interrupción, pausa/reanudación y reducción de movimiento. Grifos reales; velocidad original." />
</div>

## Anteriormente en beta.18 {#earlier-in-beta-18}

[Diseños compartidos](/es/guide/shared-layout) mueve elementos estables entre diseños dentro de una página. [Repetición de la interacción](/es/guide/interaction-replay) convierte resortes interrumpidos, arrastres cancelados y transferencias de desplazamiento a hoja en rastros de regresión. [Muestreo adaptativo](/es/guide/transitions) coloca fotogramas clave nativos donde la curva los necesita, mientras que [inspector de movimiento](/es/guide/motion-inspector) muestra propiedad y observaciones nativas, ajusta un resorte y copia TypeScript. Ese lanzamiento amplió la vista previa a 59 ejemplos en inglés y portugués. [Instalar la versión](/es/guide/install) o lea el [notas de la versión](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-beta.18).

<div class="clips">
<Clip name="shared-layout-ios" caption="Indicador de pestaña compartida, portada del álbum en expansión y reversión rápida. Entrada real del sistema operativo en un simulador iOS, en el momento original." />
<Clip name="scroll-handoff-replay-android" caption="Graba un traspaso de desplazamiento a hoja, reprodúcelo y detecta un punto de control intencionalmente incorrecto. Interacción real ADB en un emulador Android; La repetición del contacto retenido no es una prueba del reconocedor del sistema operativo." />
<Clip name="curve-sampling-ios" caption="Curvas adaptativas y de tasa fija mediante reproducción nativa en un simulador iOS. El rápido resorte es deliberadamente cuatro veces más lento; los números describen el error de la curva, no FPS." />
<Clip name="motion-inspector-android" caption="Inspeccione la propiedad, afine y sostenga un resorte, luego copie su TypeScript. Entrada real del emulador Android; Las observaciones de la vista nativa no miden la presentación de la GPU ni el dispositivo físico FPS." />
</div>

## Hoja inferior, listas y SceneKit {#bottom-sheet-lists-and-scenekit}

[Sábana bajera](/es/guide/bottom-sheet) coordina el arrastre, el desplazamiento y el teclado; [reordenamiento de lista](/es/guide/reorder) mueve elementos a través de celdas recicladas con desplazamiento de borde nativo. En iOS, [entorno y sombreadores](/es/guide/scene-shaders) recibe intensidad y uniformes escritos a través de reproducción nativa. La vista previa también admite apariencia clara/oscura/del sistema.

<div class="clips">
<Clip name="bottom-sheet-ios" caption="Arrastre, transferencia de desplazamiento, crecimiento de contenido y seguimiento del teclado. Entrada real de XCTest en un simulador iOS 26." />
<Clip name="reorder-android" caption="Reordene 200 elementos con desplazamiento de borde nativo y celdas recicladas. Real OS toca un emulador Android, a velocidad original." />
<Clip name="scene-shaders-ios" caption="Iluminación ambiental y entradas de sombreado escalar/vectorial a través de la reproducción nativa SceneKit. Grifos reales en un simulador iOS; no es una medida del rendimiento del dispositivo físico." />
<Clip name="showcase-appearance-ios" caption="Vista previa de Jolt con temas claros/oscuros y una transición circular. Grabación real del simulador iOS." />
</div>

## Manantiales vivos y gestos autóctonos {#live-springs-and-native-gestures}

<div class="clips">
<Clip name="live-springs-ios" caption="Seguidores nativos con reversiones y una capa independiente. Interacción real en un simulador iOS; Los eventos táctiles de esta demostración ingresan a JavaScript." />
<Clip name="live-springs-android" caption="La misma cadena de resorte con inversiones y movimiento reducido en un emulador Android. Esta no es una medición del rendimiento del dispositivo físico." />
<Clip name="gesture-composition-ios" caption="Panorámica, pellizco y rotación simultáneos seguidos de toques simples y dobles. Entrada real del sistema operativo en un simulador iOS." />
<Clip name="gesture-handoff-android" caption="Un arrastre expande el panel y desplaza su contenido; el arrastre inverso vuelve al panel sin levantar el dedo. Emulador Android, Core vertical ScrollView." />
</div>

## Dimensiones y cámara {#dimensions-and-camera}

<div class="clips">
<Clip name="size-ios" caption="Ancho/alto real y tamaño automático, con reflujo de texto, interrupción y objetivos táctiles de trabajo. Simulador iPhone 17, iOS 26; la aplicación selecciona una velocidad de 0,25× para el segmento de interrupción." />
<Clip name="scene-camera-ios" caption="SceneKit Zoom en perspectiva coordinado con pintura e iluminación, incluyendo pausa e inversión. Grabación en tiempo real del simulador iPhone 17, iOS 26." />
</div>

## Más movimiento {#more-motion}

<div class="clips">
<Clip name="assistant-flow" caption="El asistente de demostración en iOS. Cada movimiento es una llamada Jolt." />
<Clip name="presets" caption="Presets, resortes y escalonamiento en el patio de recreo." />
</div>
