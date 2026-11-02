# Movimiento continuo en Web {#web-dynamic}

Este **candidato experimental aún no publicado** añade `motionValue()`, `bind()`, `springValue()` y `drag()` al runtime de `@rafaelaugusto/jolt/web`. No están en la RC.5 publicada: valida un tarball local antes de usarlos. Las entradas nativas y el adaptador Vue conservan sus contratos.

<Clip name="web-dynamic-chromium" caption="Chromium 156 de escritorio, velocidad original: entrada real de puntero y teclado, follower, cambio de escala durante press, drag y captura del snap, desmontaje y pausa/movimiento reducido. Grabación del navegador; no demuestra rendimiento en un dispositivo físico." />

## Valores de entrada y bindings {#values}

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'

const motion = createWebRuntime(document)
const input = motion.motionValue(0)
const follower = motion.springValue(input, { stiffness: 170, damping: 22 })
const binding = motion.bind(card, { x: follower })
input.set(180)
input.set(60)

binding.dispose()
follower.dispose()
input.dispose()
motion.release(card)
motion.dispose()
```

Los valores pertenecen al contexto. `get()` lee el número actual; `getVelocity()` usa unidades/segundo. `set()` cambia la entrada inmediatamente y las escrituras visuales se agrupan por frame. Se admiten x/y/rotación/escala/opacidad; scale se expande a scaleX/scaleY. Se rechazan valores ajenos al contexto, descartados o no numéricos antes de sustituir el control existente.

`subscribe(listener)` observa cambios después de las escrituras programadas y devuelve la función de desuscripción; no emite el valor inicial. Los callbacks tienen coste JavaScript propio y no convierten animaciones WAAPI independientes en loops. Esta API inicial no incluye grafos derivados, colores, cadenas de followers ni paridad completa con la API nativa.

El binding posee solo sus canales de base. `animate()`, `set()` y `stop()` posteriores sustituyen los canales correspondientes; los demás y las capas press continúan. Descartar un binding antiguo no restaura valores obsoletos. Desvincular mantiene el valor actual. `release()` restaura los estilos inline que aún controla y cancela el trabajo; quitar el elemento del DOM hace lo mismo. Los valores pueden sobrevivir al elemento: descártalos o descarta el runtime. Descartar una entrada descarta también sus followers.

## Scheduler y springs {#scheduler}

Un scheduler por contexto agrupa lecturas, actualizaciones y escrituras mediante timestamps, sin paso fijo de 60 Hz. Deja de programar frames cuando entradas, observadores y movimiento se estabilizan. El tiempo del documento oculto no avanza las springs continuas; al volver no se simula todo el intervalo. Los relojes WAAPI finitos mantienen la timeline del navegador.

Mientras una superficie tiene bindings vivos, el scheduler compone también sus canales finitos; las demás superficies conservan WAAPI. Desvincular devuelve los tracks finitos a WAAPI sin reiniciar sus relojes. La composición continua requiere JavaScript y no garantiza ejecución por compositor.

La spring sigue un `motionValue` de entrada con el solver analítico portátil. Admite `stiffness`, `damping`, `mass` o `duration`/`bounce`, además de `initial`, `restDelta` (0,001 unidades) y `restSpeed` (0,01 unidades/segundo). `pause()` conserva posición/velocidad mientras cambia la entrada; `play()` retoma hacia el destino actual; `stop()` mantiene posición con velocidad cero; `jump()` alcanza la entrada; `dispose()` es terminal.

El movimiento reducido estabiliza todos los followers genéricos, incluso sin bindings; la entrada directa sigue siendo directa. Cada trayectoria nueva captura el `timeScale` actual, sin reescalar trayectorias activas. Damping cero puede mantener trabajo hasta detener o descartar.

## Drag y snap finito {#drag}

```ts
const drag = motion.drag(card, {
  axis: 'x',
  bounds: { left: -120, right: 120 },
  snap: { x: [-100, 0, 100] },
  spring: { stiffness: 180, damping: 20 },
})
```

El alcance inicial es un puntero primario y traslación x/y en píxeles CSS. La transformación CSS de base debe ser identidad; los ancestros no pueden tener transforms, perspectiva ni zoom CSS. La rotación/escala de Jolt y press se componen después de la traslación y sí se admiten. Scroll y resize cancelan el drag. No se admiten ancestros transformados arbitrarios, pinch ni handoff entre scrolls anidados.

Drag toma la traslación en pointerdown y captura el puntero. Aplica temporalmente `touch-action: pan-y` para x, `pan-x` para y o `none` para ambos, restaurando el valor inline al descartar. Los controles interactivos internos conservan su entrada. Taps y activación por teclado siguen funcionando; un drag suprime su clic resultante. Disabled/inert/busy, cancelación, pérdida de captura/foco, ocultación y desmontaje cancelan sin snap de éxito.

Bounds limita la entrada y los destinos; la spring puede sobrepasarlos. Snap elige por eje con una proyección de velocidad de 150 ms; sin puntos vuelve a la posición al adjuntarse. La velocidad usa muestras recientes, se hace cero tras 80 ms sin movimiento y se limita a 5.000 píxeles CSS/segundo. Al soltar, posición/velocidad pasan a playback WAAPI finito. Un drag nuevo puede capturarlo; un nuevo dueño de la aplicación cancela el anterior sin restaurar su traslación.

`drag.animation` expone el último snap y `finished`. `update({ disabled: true })` cancela la entrada; `cancel()` mantiene la posición sin snap; `dispose()` detiene solo su snap. El descarte del elemento/runtime libera bindings/listeners. La alternativa de teclado y la semántica accesible pertenecen al componente.

## Referencias nativas y validación {#verification}

Las grabaciones revisadas conservan las implementaciones nativas existentes. Muestran valores, followers y drag nativos; no el nuevo scheduler Web ni una pantalla compartida de Mavis. Las cadenas nativas superan el alcance inicial Web.

<Clip name="live-springs-ios" caption="Demo existente en simulador iOS: inversión de destinos, toque, capa shake independiente y movimiento reducido. Velocidad original; no es un dispositivo físico." />
<Clip name="live-springs-android" caption="Demo existente en emulador Android: followers nativos con taps, gestos y movimiento reducido reales. Velocidad original." />
<Clip name="drag-values-ios" caption="Demo existente en simulador iOS: un sheet arrastrable controla valores vinculados y snap; la animación de la aplicación se puede interrumpir. Velocidad original." />
<Clip name="drag-values-android" caption="Demo existente en emulador Android: flings reales y captura de un sheet en movimiento con bindings nativos. Velocidad original." />

Ejecuta `npm run web:dynamic:typecheck` y `npm run web:dynamic:test`. Chromium, Firefox y WebKit cubren composición, cancelación y limpieza. La inyección de scroll táctil real usa solo Chromium; los demás conservan pruebas de cancelación de puntero. Las pruebas de tiempo oculto controlan la señal de visibilidad y no miden background en móviles físicos. Consulta el [informe reproducible](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-dynamic.md). CI nativo y consumidores reales Web/Vue/SSR/nativos siguen siendo obligatorios. Esta entrega no cambia Mavis ni añade otro framework.
