# Gestos, zoom y scroll Web

Funciones experimentales disponibles desde **0.1.0-rc.9**, seguidas en #340–#345. Las seis capacidades comparten el runtime del documento y sus ámbitos. La entrada Web no depende de NativeScript ni de frameworks. Los vídeos nativos son referencias conservadas, no grabaciones de esta implementación Web.

Crea el runtime después del montaje. Las coordenadas usan píxeles CSS, la rotación grados y la velocidad unidades por segundo. Mantén la superficie de entrada sin transforms y anima un hijo; se conserva la frontera de coordenadas renderizadas/top-layer. La aplicación controla marcado, semántica, datos y navegación.

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'

const motion = createWebRuntime(document)
const scope = motion.scope()
const x = scope.motionValue(0)
```

## Arrastre inercial y valores {#drag}

Activa `release: "decay"` para reutilizar el solver nativo: fricción, snap proyectado y recuperación en los límites. `rubberband` añade resistencia fuera de ellos. El comportamiento predeterminado existente sigue regresando con spring a la posición inicial o al snap. `value` con un eje controla un valor prestado; sin él, mueve el elemento de entrada. dragging/settling/position/animation/paused/disposed y los callbacks de inicio, movimiento, liberación, cancelación y reposo describen su ciclo de vida. Cancelar congela el movimiento propio; dispose conserva el valor prestado. La reproducción finita de elementos usa WAAPI.

```ts
const drag = scope.drag(handle, {
  axis: 'x',
  value: x,
  release: 'decay',
  bounds: { left: -200, right: 200 },
  rubberband: true,
  friction: 0.998,
  snap: [-200, 0, 200],
  onRelease: ({ animation }) => animation.finished.then(onFinished),
})
drag.pause()
drag.play()
drag.cancel()
```

<Clip name="web-gestures-drag-chromium" :width="760" caption="Chromium en macOS: arrastre y liberación reales, inercia limitada y valor prestado. Velocidad original." />

<Clip name="drag-ios" caption="Referencia del simulador iOS: drag nativo existente con límites, resistencia y snap. Entrada nativa real; reproducción conservada." />

## Contactos compuestos {#contacts}

Pan, pinch y rotación se reconocen juntos. Añadir o retirar contactos reajusta las medidas sin saltos del centroide. Los valores se observan sin renders del framework; settleTo/jumpTo/updateBounds y pause/play/cancel/dispose controlan la interacción. Pan acepta eje, threshold, failOffset y límites, incluso una función de la posición. Un tap espera cuando hay doble tap. El foco usa coordenadas CSS de la viewport. Solo se programan frames con entrada o movimiento activo.

```ts
const gesture = scope.gestures(inputSurface, {
  pan: true,
  pinch: { min: 0.5, max: 4 },
  rotate: true,
  onTap: select,
  onDoubleTap: reset,
})
scope.bind(card, {
  x: gesture.x,
  y: gesture.y,
  scale: gesture.scale,
  rotate: gesture.rotate,
})
gesture.settleTo({ x: 0, y: 0, scale: 1, rotate: 0 })
```

<Clip name="web-gestures-gesture-chromium" :width="760" caption="Chromium en macOS: dos contactos confiables mediante CDP, pinch/rotación, continuación con un dedo y doble tap. Automatización del navegador, no hardware táctil físico." />

<Clip name="gesture-composition-ios" caption="Referencia del simulador iOS: composición nativa simultánea de contactos y taps. No mide un dispositivo físico." />

## Panel y scroll anidado {#scroll}

Declara un pan limitado de un solo eje y su descendiente de scroll. Primero se expande el panel y después se desplaza el contenido; al invertir, se vacía el scroll anidado antes de colapsar. Cada delta se consume una sola vez y la liberación usa decay. El eje horizontal contempla offsets RTL. Rueda, teclado y foco conservan el scroll del navegador. El eje táctil coordinado lo controla Jolt: Pointer Events decide touch-action antes del contacto; cambiar CSS durante el gesto no devuelve el pan al navegador. Los campos mantienen sus interacciones.

```ts
const gesture = scope.gestures(inputSurface, {
  pan: { axis: 'y', bounds: { top: 0, bottom: 240 } },
  initial: { y: 240 },
  scroll: { element: content },
})
scope.bind(panel, { y: gesture.y })
```

<Clip name="web-gestures-scroll-chromium" :width="760" caption="Chromium en macOS: un contacto expande, desplaza e invierte sin levantar; después se usa la rueda del navegador." />

<Clip name="gesture-handoff-ios" caption="Referencia del simulador iOS: transferencia nativa entre panel y contenido en un contacto." />

## Zoom y cierre de imágenes {#zoom}

Usa una caja de imagen centrada en su padre directo, normalmente `width:100%; height:100%; object-fit:contain`. Su contribución de transform es independiente. Pinch focal, pan limitado, doble tap, rueda, teclas +/−/0/flechas y Escape comparten controlador; los atajos de zoom de página siguen en el navegador. ready/error/state describen carga, geometría y estado. Backdrop/chrome opcionales usan opacidad independiente. El cierre es una intención protegida: la aplicación navega y los cancel/complete obsoletos devuelven false.

```ts
const photo = scope.zoomable(image, {
  viewport,
  scale: [1, 5],
  doubleTap: 2.5,
  backdrop,
  chrome,
  onDismiss(intent) {
    closeRoute().then(
      (closed) => (closed ? intent.complete() : intent.cancel()),
      () => intent.cancel(),
    )
  },
})
photo.zoomTo(2, { x: 180, y: 120 })
photo.reset()
```

<Clip name="web-gestures-zoom-chromium" :width="760" caption="Chromium en macOS: doble tap, pan, pinch confiable, reset, cierre cancelado y teclado." />

<Clip name="photo-zoom-ios" caption="Referencia del simulador iOS: pinch, pan, reset y cierre cancelado de la imagen nativa." />

## Cabecera, anclas y actualización {#header}

Declara portada, imagen/títulos/sección fija opcionales y el contenedor real de scroll. Jolt controla un espaciador desmontable y contribuciones de movimiento. La altura mínima puede medirse dinámicamente. preserveAnchor conserva una fila visible por clave durante cambios síncronos o asíncronos; si desaparece, usa una posición superviviente. scrollToItem/scrollToTop/remeasure y los controles comparten fuente. Los títulos transfieren visibilidad y foco. El refresh opcional tiene una única promise, umbral, cancelación y error/reintento. commit comprueba la solicitud antes del cambio y de restaurar el ancla. Un cambio asíncrono debe comprobar cancelled antes de escribir después de un await. Cancelar resuelve inmediatamente el resultado.

```ts
const header = scope.scrollHeader(scroller, {
  header: cover,
  artwork,
  title,
  toolbarTitle,
  section,
  expanded: () => cover.offsetHeight,
  minimum: () => toolbar.offsetHeight,
  items: () => rows.map((row) => ({ key: row.id, target: row.element })),
  async onRefresh(context) {
    const next = await fetchRows()
    await context.commit(() => replaceRows(next))
  },
  onRefreshError: showRetry,
})
await header.preserveAnchor(() => insertRows())
header.scrollToItem('album-6')
header.cancelRefresh()
```

<Clip name="web-gestures-header-chromium" :width="760" caption="Chromium en macOS: colapso, inserción anclada, pull/release, error/reintento y finalización. Vídeo revisado tras corregir las unidades de velocidad." />

<Clip name="scroll-header-refresh-ios" caption="Referencia de iPhone 17 Pro físico / iOS 27.2: actualización nativa, fallo/reintento y anclas. Grabación original conservada; no muestra el backend Web." />

## Reordenación interactiva por identidad {#reorder}

La aplicación aporta claves string/number estables y elementos DOM realizados, y confirma el movimiento por identidad. Jolt previsualiza vecinos de distinta altura en layers privados y usa FLIP para reconciliar el renderer. Se conservan transforms y press externos. Hay mouse, pulsación larga, scroll de borde y controles de teclado. Prefiere handles dedicados para preservar el scroll normal del contenido. Espacio/Enter inicia o confirma; flechas/Home/End mueven; Escape cancela. move/moveTo/moveUp/moveDown comparten commit. Cambios de datos, identidad, geometría y lifecycle cancelan trabajo obsoleto. El controlador no implementa renderizado de datos ni virtualización.

```ts
const reorder = scope.reorder(list, {
  items: () => rows.map((row) => ({ key: row.id, target: row.element })),
  handle: '[data-reorder-handle]',
  onCommit: ({ key, beforeKey }) => moveItemBefore(key, beforeKey),
  edge: { size: 72, speed: 640 },
})
reorder.moveDown('album-1')
reorder.move('album-1', null)
reorder.refresh()
```

<Clip name="web-gestures-reorder-chromium" :width="760" caption="Chromium en macOS: reordenación con mouse, teclado, scroll de borde y movimiento programático mediante controles reales." />

<Clip name="reorder-ios" caption="Referencia del simulador iOS: reordenación nativa con distintas alturas, botones y scroll de borde. Grabación conservada." />

## Ciclo de vida y evidencias {#lifecycle}

Los controladores admiten dispose y pausa/reanudación por ámbito. En Vue, usa `useWebMotion(ref).use((scope, element) => ...)` para sustitución de refs, KeepAlive y desmontaje, separando la entrada del elemento animado. Movimiento reducido conserva el destino evitando springs opcionales. El scheduler queda inactivo cuando no hay trabajo; esto no promete FPS ni sustituye la semántica de la aplicación.

Ejecuta `npm run web:gestures:typecheck`, `npm run web:gestures:test` y `npm run web:gestures`. Las pruebas separan reconocimiento sintético y multitouch confiable de Chromium. Consulta el [informe](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-gestures.md). La adopción Mavis sigue en [#234](https://github.com/getcortexlabs/mavis-ui/issues/234), [#235](https://github.com/getcortexlabs/mavis-ui/issues/235), [#236](https://github.com/getcortexlabs/mavis-ui/issues/236) y [#237](https://github.com/getcortexlabs/mavis-ui/issues/237).
