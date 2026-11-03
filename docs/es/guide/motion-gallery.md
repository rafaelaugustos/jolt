# La colección de movimiento

La [página principal](/es/) y la [colección de recetas](/es/recipes/) combinan un playground Web interactivo con grabaciones nativas de Motion Studio. Busca por nombre, filtra por categoría y abre una receta para ver su grabación, copiar el ejemplo de API, consultar la demo NativeScript Vue o copiar un prompt de adaptación.

La apertura combina tipografía grande con una escultura cromada que sigue el puntero, gira con clic o teclado y conserva la inercia tras un arrastre horizontal. El pequeño renderizador WebGL pertenece al sitio; Jolt aporta valores de movimiento, springs, seguimiento del puntero y arrastre con inercia. Una escultura vectorial sigue disponible si WebGL no está disponible o pierde el contexto. La renderización se pausa fuera del área visible o con el documento oculto. Los teléfonos de Morrow acompañan el desplazamiento y la acción principal responde al puntero. El playground utiliza el runtime experimental Jolt Web existente para springs, stagger y drag/snap. El showcase usa el mismo runtime para las escenas vinculadas al scroll. Las páginas de referencia cargan una interacción pequeña de Jolt para la entrada del título y el progreso de lectura, y la liberan al navegar.

<Clip name="motion-site-chromium" :width="960" caption="Chromium en macOS arm64: interacción real con puntero y teclado en el sitio Jolt, escultura cromada con inercia, teléfonos de Morrow vinculados al desplazamiento y reproducción, preview nativo, interrupción de spring, stagger, drag/snap, búsqueda y copia. Grabación del navegador a velocidad original. Los vídeos de recetas proceden del simulador iOS; Morrow es una captura iOS del creador sin dispositivo de captura especificado. Esta grabación del navegador no demuestra rendimiento nativo. Incluye el showcase animado de Morrow y Jolt Drive, el diseño compartido de la documentación, el progreso de lectura y los temas claro y oscuro." />

Se respeta la preferencia de movimiento reducido del sistema y el control persistente del pie de página. Los previews cargan al recibir el puntero o foco y se pausan al salir de la tarjeta, del área visible o del documento. Con movimiento reducido no se reproducen automáticamente. Las grabaciones completas tienen controles de reproducción.

## Grabaciones nativas

Los recortes reutilizan grabaciones revisadas de Motion Studio, conservando el tiempo original y sin sintetizar fotogramas. Los archivos originales permanecen en el repositorio.

<Clip name="showcase-springs-ios" caption="Simulador iOS 26: toques reales vía XCTest interrumpen y redirigen el resorte nativo. Velocidad original; no mide el rendimiento de un dispositivo físico." />
<Clip name="motion-recipe-drag-ios" caption="Simulador iOS 26: arrastre y liberación reales vía XCTest mueven la tarjeta y el panel hacia sus puntos de ajuste. Fragmento continuo de showcase-touch-ios a velocidad original. No mide rendimiento físico." />
<Clip name="motion-recipe-gradients-ios" caption="Simulador iOS 26: interacción real vía XCTest cambia la composición de gradientes nativos. Fragmento continuo de showcase-visual-ios a velocidad original. No mide rendimiento físico." />

La revelación circular conserva los 1600 ms seleccionados en la demo. La receta de confeti incluye emisores y una explosión de confeti. Las grabaciones no transmiten vibración física. La película y el ejemplo automotriz conservan sus leyendas. Las notas anteriores y sus vídeos están en el [historial de versiones](./release-history).

Los ejemplos se extraen del guía versionado durante el build. Representan la API central; la demo enlazada contiene la interfaz completa. Los prompts incluyen versión, imports documentados, fuente, limitaciones, movimiento reducido y limpieza de recursos. Las API nativas y Web no son intercambiables. Las recetas tienen cuatro idiomas; los filtros y la búsqueda se guardan en la URL, y cambiar idioma conserva la receta.

## Revisión

Ejecuta `npm run docs:check-media` y `npm run docs:build`, inicia `npm run docs:preview -- --port 5181` y ejecuta `npm run docs:test-site`. La revisión cubre Chromium y WebKit, interacción, reproducción MP4, copia, filtros, cuatro idiomas, desktop/móvil, movimiento reducido y navegación. Resultados: `/tmp/jolt-motion-site-review`. Analytics se bloquea y la lista de la comunidad utiliza una respuesta vacía simulada; esta revisión no prueba el servicio de comunidad en producción.

`scripts/motion-recipe-captures.json` registra las fuentes y los recortes exactos. `node scripts/prepare-motion-recipe-media.mjs` reproduce los clips con FFmpeg. `node scripts/record-motion-site.mjs` graba interacción real mediante Playwright. El sitio utiliza capacidades Web existentes y no cambia código de Mavis.

La página principal incluye un [estudio exploratorio en un dispositivo físico](./performance-study), con CPU, PSS posterior y espera de presentación en el mismo panel. Las tres métricas usan el grupo predeterminado; el gráfico anima mediciones almacenadas. El pie compacto enlaza recetas, proyectos, estudio, instalación y API, junto a movimiento reducido y vuelta al inicio.

El destacado de Jolt Drive enlaza al [repositorio público](https://github.com/rafaelaugustos/jolt-drive) y su [showcase](./showcase#jolt-drive). La vista previa publicada conserva el tiempo de cada fotograma. El recorrido anterior de Jolt Car sigue disponible bajo la tarjeta de la página principal, con la grabación original preservada.

<Clip name="jolt-drive-entrance-ios" :width="280" caption="Jolt Drive en iOS: entrada del garaje del GIF publicado por el proyecto, convertida a MP4 conservando los 113 fotogramas y sus tiempos. Dispositivo no especificado; no mide rendimiento de renderización." />

## Lleva el movimiento a tu app

Cuatro recetas del proyecto real: cockpit coordinado, selección de ambiente con resorte, panel de carga con fondo desenfocado y cámara hacia la cabina. Cada una incluye vídeo nativo, código revisado y un prompt de adaptación.

[Explora las 4 recetas](/es/recipes/?q=Jolt%20Drive) · [Lee la guía de integración](./drive-recipes)

## Hexdrop

Hexdrop combina animación de scroll con Jolt Web y grabación nativa real. [Conoce el proyecto](./showcase#hexdrop) o [adapta su receta de arrastre](./hexdrop-recipes).

<Clip name="hexdrop-creator-ios" :autoplay="false" poster="/media/hexdrop-creator-ios.jpg" :width="280" caption="Hexdrop en iOS: grabación del creador con apertura animada, arrastre, preparación, selector de documentos y repetición. Velocidad original, sin audio; se omiten los primeros 3,8 segundos de la pantalla de inicio y transición del sistema. Dispositivo no especificado. Demo local; no se suben archivos." />
