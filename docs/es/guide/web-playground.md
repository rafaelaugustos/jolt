# El playground Web

[Abrir el playground](/es/#playground)

58 experimentos, siete categorías y una demo activa a la vez. Busca por nombre o API, elige, interactúa y copia el código principal. El experimento seleccionado queda en la URL y se conserva al cambiar de idioma.

## Explora

- [Movimiento y física · 12](/es/?play=spring#playground): Springs, stagger, keyframes, presets, gravedad, inercia, timelines, secuencias, progreso, estados, valores y física de círculos.
- [Toque y gestos · 7](/es/?play=gestures#playground): Press, drag/snap, inercia, gestos simultáneos, seguimiento del puntero, zoom y reordenación.
- [Scroll y layout · 9](/es/?play=scroll#playground): Scroll vertical y horizontal/RTL, entradas al viewport, elementos con clave, layout, tamaño automático, layout compartido, cabeceras y scroll anidado.
- [Efectos visuales · 12](/es/?play=gradient#playground): Gradientes lineales/radiales/cónicos, partículas, confeti, blur, glass, formas, dibujo SVG, imágenes líquidas, efectos de imagen, reveal/conceal, shimmer y loaders.
- [Texto y símbolos · 3](/es/?play=text#playground): Animación por palabra/letra, números rodantes y símbolos por capas.
- [Superficies y navegación · 5](/es/?play=sheet#playground): Bottom sheets, diálogos interactivos, navegación compartida, vuelta interactiva y regreso a galería, incluso sin la miniatura original.
- [Dispositivo y navegador · 5](/es/?play=sensor-rotation#playground): Sensores de rotación y gravedad, hápticos, observación del teclado y seguimiento, reproducción e inspección del ciclo de vida.

## Qué se ejecuta

Los previews usan el runtime experimental Jolt Web existente. Solo se monta el experimento seleccionado. Fuera del viewport se suspende su scope; al volver se recrea. Cambiar de demo o salir libera listeners, efectos y vínculos DOM. Redimensionar recalcula los límites. Se respetan las preferencias de movimiento reducido del sitio y del sistema.

Los fragmentos muestran la integración principal con refs DOM ya montadas. La guía de API detalla estructura, ciclo de vida y límites. La navegación compartida cambia una escena local; las rutas pertenecen a la aplicación. El adaptador Vue está en [Integración Web](./web-vue). Esta actualización no cambia el motor ni la API nativa.

Los sensores solo piden permiso tras una acción explícita y requieren lecturas reales para mostrar actividad. Los dispositivos incompatibles o sin permiso muestran su estado. Los hápticos informan aceptación del navegador, no vibración física confirmada. Un teclado de escritorio normalmente cubre cero píxeles; prueba en un móvil compatible. Glass y los efectos de imagen exponen su backend real. El movimiento reducido puede suprimir la reproducción.

## Grabaciones reales del navegador

<Clip :autoplay="false" name="web-playground-motion-chromium" :width="960" caption="Chromium en macOS arm64, interfaz en inglés, velocidad original, sin audio. Interacción real de puntero y teclado con el playground. Captura del navegador, no una medición de rendimiento nativo." />

<Clip :autoplay="false" name="web-playground-effects-chromium" :width="960" caption="Chromium en macOS arm64, interfaz en inglés, velocidad original, sin audio. Interacción real de puntero y teclado con el playground. Captura del navegador, no una medición de rendimiento nativo." />

<Clip :autoplay="false" name="web-playground-platform-chromium" :width="960" caption="Chromium en macOS arm64, interfaz en inglés, velocidad original, sin audio. Interacción real de puntero y teclado con el playground. Captura del navegador, no una medición de rendimiento nativo." />

## Referencias nativas revisadas

Estas grabaciones nativas existentes se distinguen de los previews Web. Las guías enlazadas incluyen las demás referencias y sus límites por plataforma.

<Clip :autoplay="false" name="showcase-springs-ios" caption="Simulador iOS 26: toques reales con XCTest interrumpen y redirigen el spring nativo. Velocidad original; no mide rendimiento en un dispositivo físico." />

<Clip :autoplay="false" name="gesture-composition-ios" caption="Simulador iOS: demo nativa existente de gestos simultáneos y toque. Velocidad original; no es un dispositivo físico." />

<Clip :autoplay="false" name="web-native-gradients-ios" caption="Simulador iPhone 17, iOS 26: demo Vue nativa en inglés, interacción real XCTest con gradientes. Velocidad original; no es un dispositivo físico." />

<Clip :autoplay="false" name="interactive-modal-ios" caption="Simulador iOS, demo nativa en inglés: presentación, retorno y cierre interactivo de modal. Velocidad original; no es un dispositivo físico." />

## Revisión y cobertura

Ejecuta `npm run docs:check-playground`, `npm run docs:check-media` y `npm run docs:build`. Con el sitio activo, usa `JOLT_SITE_URL=http://127.0.0.1:5184 npm run docs:test-playground`. La revisión prueba cada experimento en Chromium y WebKit, gestos, teclado, tamaños, idiomas, movimiento reducido y limpieza. La cobertura falla si un método público Web carece de demo o responsabilidad documentada del host. Esto mide cobertura, no compatibilidad universal.
