# La colección de movimiento

La [página principal](/es/) y la [colección de recetas](/es/recipes/) combinan un playground Web interactivo con grabaciones nativas de Motion Studio. Busca por nombre, filtra por categoría y abre una receta para ver su grabación, copiar el ejemplo de API, consultar la demo NativeScript Vue o copiar un prompt de adaptación.

La escultura sigue el puntero y gira al activarla con ratón o teclado. El playground utiliza el runtime experimental Jolt Web existente para springs, stagger y drag/snap. El runtime se carga con la página principal y se libera al salir; las páginas de referencia no lo cargan. La escultura actualiza su geometría al cambiar el tamaño de la ventana.

<Clip name="motion-site-chromium" :width="960" caption="Chromium en macOS arm64: interacción real con puntero y teclado en el sitio Jolt, escultura elástica, reproducción de Morrow, preview nativo, interrupción de spring, stagger, drag/snap, búsqueda y copia. Grabación del navegador a velocidad original. Los vídeos de recetas proceden del simulador iOS; Morrow es una captura iOS del creador sin dispositivo de captura especificado. Esta grabación del navegador no demuestra rendimiento nativo." />

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
