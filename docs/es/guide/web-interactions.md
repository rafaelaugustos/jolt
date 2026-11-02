# Overlays y movimiento compartido Web

**Disponible desde 0.1.0-rc.7**, entregado en #320–#323. La [guía de ámbitos e input](./web-lifecycle) cubre #314–#317. La adopción en Mavis es una integración separada.

## Frontera de geometría renderizada {#overlays}

Un dialog modal o popover abierto participa en la top layer del browser. Los ancestros DOM pueden seguir animándose sin cambiar las coordenadas del overlay. Jolt termina su recorrido en esa raíz renderizada, incluyendo Shadow DOM y eliminación pendiente de la top layer. El transform de la propia raíz sigue importando. Los transforms identidad también se aceptan fuera de overlays.

Esto corrige la reproducción de [Mavis #197](https://github.com/getcortexlabs/mavis-ui/issues/197): un transform identidad o animado en el Card que contiene Select no debe rechazar un arrastre válido de Sheet. Sigue el [modelo CSS de top layer](https://www.w3.org/TR/css-position-4/#top-layer).

```ts
dialog.showModal() // La aplicación controla foco, selección y cierre.
const open = runtime.scope()
open.drag(panel, { axis: 'y', snap: { y: [0] } })
dialog.addEventListener('close', () => open.dispose(), { once: true })
```

Descendientes ordinarios de ancestros con escala/rotación/zoom siguen necesitando adaptación de coordenadas. Jolt rechaza esos espacios antes de modificar touch-action o adjuntar input. Una raíz transformada dentro del modal afecta la geometría. Mantenga identidad en el transform estático de la superficie arrastrable. Use top layer real o input sin transform; z-index no crea esta frontera.

Cerrar un dialog libera superficies sin caja renderizada. Cancelar/descartar tras cerrarlo es seguro; recree attachments al abrir. Jolt no sustituye selección, foco, Escape, scroll del contenido o navegación. Los fallos preservan esos comportamientos del host. FLIP y geometría del puntero usan la misma frontera.

<Clip name="web-lifecycle-overlay-chromium" :width="900" caption="Chromium en macOS arm64: clics reales abren un modal tipo Select dentro de un card con traslación/rotación, arrastran, eligen Porto, reabren y cierran con Escape. Demuestra Jolt, no el componente Mavis." />
<Clip name="bottom-sheet-ios" caption="Demo NativeScript existente en inglés, simulador iOS 26: arrastre/scroll, crecimiento del contenido, teclado y cierre reales. Referencia nativa, no la corrección Web." />

## Elementos compartidos {#shared}

`sharedLayout()` conecta hasta ocho identidades no superpuestas en un container declarado. Captura la presentación saliente, ejecuta el cambio síncrono de aplicación y espera el siguiente layout del destino. Vue puede sustituir/adjuntar la ref en la microtask resultante. El controller no navega ni elige contenido.

```ts
const shared = owner.sharedLayout(container, { transition: 'smooth' })
const detach = shared.attach(card, 'cover')
const flight = shared.transition(() => {
  card.remove()
  container.append(detail)
  shared.attach(detail, 'cover')
})
const result = await flight.finished
```

El resultado indica `completed`, `cancelled` o `unavailable`, con motivo cuando corresponde. Una identidad puede cambiar de attachment durante la transición; un detach antiguo no elimina el nuevo. Las copias son inert, aria-hidden, sin IDs/atributos/handlers ni interacción. Congelan la presentación computada sin duplicar código de aplicación. Los originales reciben una contribución privada de opacidad; cleanup retira solo esa contribución y conserva nuevos propietarios y otros movimientos. Aplicación/browser mantienen el foco.

La transición mezcla copias salientes/entrantes con traslación y escala. Invertir captura la presentación actual antes de cancelar la anterior. El contenido se escala visualmente, sin reflow real del texto. `cancel()`/`stop()` conservan el nuevo layout y eliminan copias. `pause()`/`suspend()` cancelan y bloquean transiciones hasta `play()`/`resume()`. Eliminar container/target, scroll/resize y movimiento reducido activo también limpian. Movimiento reducido ejecuta el cambio y deja visible el contenido final.

`layoutTimeout`: 500 ms por defecto, máximo 10 s. Destinos ausentes/sin tamaño devuelven `missing-target` o `layout-timeout`. `maxElements`: 512 elementos por operación, incluyendo capturas de inversión; máximo 4096. Admite HTML/texto estáticos e imágenes decodificadas. Controles de formulario, canvas/video, documentos embebidos, custom elements, Shadow DOM, pseudo-contenido generado y raíces rotadas/inclinadas/proyectivas devuelven `unsupported-target`. Admite geometría positiva alineada con los ejes. Aunque la captura no esté soportada, el cambio síncrono se ejecuta y el contenido real sigue visible. Una excepción de aplicación limpia y se propaga.

El escenario temporal usa popover manual en coordenadas de viewport, sin heredar transforms de página. Sin esa capacidad, informa indisponibilidad. Es copia DOM, no screenshot ni promesa de rendimiento. Cargue datos y decodifique imágenes previamente.

<Clip name="web-lifecycle-shared-chromium" :width="900" caption="Chromium en macOS arm64: controles reales alternan card/detalle y miniatura/visor, invierten en movimiento, cancelan y prueban destino ausente. La aplicación cambia el contenido; las copias son temporales." />
<Clip name="shared-layout-ios" caption="Demo existente en inglés, simulador iOS: identidades nativas cambian de padre, expanden la portada e invierten desde el snapshot actual. Referencia nativa, no evidencia Web o física." />

## Recetas completas {#recipes}

El [código ejecutable](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-lifecycle/recipes.ts) combina tres interacciones en un ámbito:

- `drag()` limitado con retorno por spring y `press()` independiente.
- `animateSize(panel, { height: open ? 'auto' : 0 })` para expansión intrínseca; aplicación controla `aria-expanded`, contenido inert y foco al cerrar.
- `animateLayout(list, mutation)` para reordenar/eliminar identidades estables. Aplicación controla orden; Jolt mide y anima.

Cambios rápidos e interrupciones reutilizan continuidad y propiedad existentes. No hay solver ni loop propio por frame. El ámbito descarta listeners, controllers y movimiento pendiente. Botones semánticos permiten teclado; Return acompaña el arrastre. No implementa listas virtualizadas ni un nuevo framework.

<Clip name="web-lifecycle-recipes-chromium" :width="900" caption="Chromium en macOS arm64: arrastre/soltura, expansión intrínseca e inversión, reordenamiento/eliminación, movimiento reducido y descarte usando primitivas existentes." />
<Clip name="drag-ios" caption="Demo existente en inglés, simulador iOS: arrastre y soltura nativos reales. Referencia, no medición de coordenadas Web o rendimiento físico." />
<Clip name="size-ios" caption="Demo existente en inglés, simulador iPhone 17 / iOS 26.0: layout real e interrupción. La aplicación selecciona 0,25× en el segmento de interrupción; el vídeo conserva su tiempo original." />
<Clip name="layout-ios" caption="Demo FLIP nativa existente en inglés, simulador iOS: cambios de layout e interrupción. No es la receta Web ejecutada en un dispositivo." />

## Diagnóstico de integración {#diagnostics}

```ts
const diagnostics = runtime.diagnostics({ development: true, maxEvents: 200 })
console.log(diagnostics.snapshot())
diagnostics.clear()
diagnostics.dispose()
```

Snapshots informan canales/layers, IDs de propietarios de animación/valor, reposo, rutas de ejecución y recuentos de recursos. Eventos identifican adquisición, finalización, sustitución, stop explícito, liberación, movimiento reducido y ciclo de vida. IDs locales a la sesión; historial con números/enums, sin DOM o valores de aplicación. Sustitución parcial conserva otros canales. Perder un canal puede resolver la animación con false aunque los restantes terminen.

Historial de 1–2000 eventos, 200 por defecto. Requiere `development: true`, un colector por runtime, sin historial antes de activar o después de descartar. `snapshot()` funciona bajo demanda, sin observers, timers, suscripciones de frame o renders. Ningún callback de evento se ejecuta dentro de transacciones. Descartar el runtime conserva un snapshot final serializable sin retener su documento mediante el handle diagnóstico.

Una superficie/canal en reposo no es animación activa. Compare valores activos, tareas de frame, observers y ámbitos con la base del host; el host llama `release(target)` o descarta su runtime. No mide GPU, FPS presentado ni latencia de input.

<Clip name="web-lifecycle-diagnostics-chromium" :width="900" caption="Chromium en macOS arm64: controles inician x/y, sustituyen solo x, consultan propietarios/motivos y descartan la pantalla. Informe bajo demanda, sin polling." />
<Clip name="motion-inspector-ios" caption="Inspector nativo existente en inglés, simulador iOS con input XCTest real: interrupción, ajustes, playback pausado, layers y bindings. No mide la pantalla física." />

Ejecute `npm run web:lifecycle:test` y consulte la [reproducción](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-lifecycle.md). La matriz incluye Chromium, Firefox, WebKit, cleanup y consumidores empaquetados imperativo/Vue/SSR. CI nativo protege las rutas existentes. La paridad completa Web/mobile #236 sigue abierta.
