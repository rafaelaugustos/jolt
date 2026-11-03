# Mapeos, geometría y scroll Web {#web-support}

Disponible desde RC.8: [montaje Vue/Nuxt, entradas por identidad y scroll horizontal LTR/RTL](./web-collections).

**Desde RC.7:** [colores, bordes, pintura continua, tamaño real, FLIP y escenas con seek](./web-visual) amplían este runtime. Las APIs Web siguen experimentales; la paridad completa continúa en [#236](https://github.com/rafaelaugustos/jolt/issues/236).

Desde **0.1.0-rc.6**, `@rafaelaugusto/jolt/web` incluye mapeos numéricos, geometría y scroll vertical (#302–#304). Las APIs siguen experimentales. Los contratos nativos y adapters se mantienen; Mavis se integra por separado.

<Clip name="web-support-chromium" caption="Chromium de escritorio, interfaz inglesa, velocidad original: slider, teclado, press y rueda reales muestran mapeos, cambio de tamaño de la etiqueta sin reiniciar el movimiento, inversión del scroll y limpieza. No mide rendimiento físico ni del compositor." />

## Mapeos numéricos {#mappings}

```ts
const motion = createWebRuntime(document)
const input = motion.motionValue(0)
const mapped = input.to([0, 100], [0, 200])
const follower = motion.springValue(mapped)
motion.bind(card, {
  x: follower,
  scale: input.to([0, 100], [1, 1.2]),
  opacity: input.to([0, 100], [0.4, 1]),
})
motion.press(card)
input.set(50) // Escala 1.1; el press predeterminado la multiplica por 0.96.
```

`.to(input, output, { clamp: true })` copia 2–1024 pares numéricos finitos. Entradas estrictamente crecientes o decrecientes; no admite puntos repetidos. La salida puede cambiar de dirección. `{ clamp: false }` extrapola los segmentos extremos. Callbacks, múltiples entradas y ciclos siguen fuera. RC.7 también admite [mapeos con salida de color](./web-visual#paint). Máximo: 32 niveles de mapeos/followers.

El resultado ofrece `get()`, `getVelocity()`, `subscribe()`, `dispose()` y `.to()`, pero no `set()`. La velocidad multiplica la de origen por la pendiente; los límites con clamp tienen velocidad cero. En un punto interior utiliza la derivada izquierda en orden ascendente. Rechaza intervalos inválidos y overflow. Todos los valores pertenecen al mismo runtime.

Los mapeos sin consumidores se leen bajo demanda. Las dependencias activas comparten el scheduler existente; no añaden loops propios. Pueden alimentar springs y otros mapeos. Descartar un mapeo termina sus descendientes y bindings, preservando hermanos y origen; descartar el origen termina todos. Un binding descartado mantiene su último valor; `release()` restaura los estilos controlados originales.

## Geometría sin reiniciar playback {#geometry}

```ts
motion.set(card, { scale: 1.1 })
const geometry = motion.observeGeometry(card)
motion.refresh(card) // Tras modificar tamaño o transform-origin 2D.
// geometry.dispose(); motion.release(card)
```

`refresh()` acepta la caja y el origen 2D calculado. El navegador aplica el pivote al mismo efecto, sin sustituir canales, regenerar keyframes, reiniciar relojes o emitir finalización. Conserva posición/velocidad lógicas, progreso pausado, tracks, bindings y press. Cambiar el pivote puede mover píxeles: no es FLIP, interpolación de tamaño ni bloqueo de posición visual.

`observeGeometry()` comparte un ResizeObserver por superficie. Agrupa cambios responsivos, etiquetas y métricas de fuentes. Un cambio de origen sin resize requiere `refresh()`. Release/desmontaje termina las observaciones; un handle antiguo no afecta a la nueva superficie. Un cambio automático inválido libera la superficie y reporta error; un refresh explícito rechazado no sustituye ownership.

El baseline CSS permanece fijo. Cambiar clases, transform/opacity externos, transforms individuales, origen 3D, transitions o `display: none/contents/inline` exige release/recreación. El elemento debe estar montado y controlado. Drag sigue cancelándose con scroll/resize; el contrato de coordenadas no se amplía.

## Scroll vertical {#scroll}

```ts
const linked = motion.scrollLinked(
  scroller,
  card,
  {
    y: [0, -60],
    scale: [1, 0.9],
    opacity: [1, 0.4],
  },
  { range: [0, 400] },
)
// linked.execution: 'scroll-timeline' | 'scheduler' | 'released'
// linked.refresh(); linked.dispose()
const scroll = motion.scrollValue(scroller) // Sin argumento: Document del runtime.
const progress = scroll.to([0, 400], [0, 1])
// scroll.refresh(); scroll.dispose()
```

El origen es un HTMLElement montado o el Document del runtime. El valor readonly devuelve píxeles CSS verticales limitados al contenido. La velocidad es muestreada y expira tras 100 ms sin cambios. `range` crece entre 0 y 1e9 píxeles; limita los extremos y revierte al volver. Arrays numéricos explícitos admiten x/y/rotate/scale/scaleX/scaleY/opacity. `times` opcional debe crecer estrictamente de 0 a 1 y coincidir con cada array. Sin contenido desplazable, permanece al inicio.

El modo automático usa [ScrollTimeline](https://www.w3.org/TR/scroll-animations-1/) y rangos en píxeles cuando existen; `{ execution: 'scheduler' }` fuerza fallback. Son elegibles los canales de un solo link junto con contribuciones estáticas/pausadas. Animaciones finitas activas, transiciones de press, bindings genéricos o links independientes requieren el scheduler para esa superficie; al estabilizarse recupera la timeline. Ownership y rangos conservan semántica; otras superficies no cambian. Observar un valor de scroll separado no fuerza el playback visual nativo a JavaScript. Bindings de `progress` y followers sí utilizan scheduler.

Scroll/resize/texto/fuentes invalidan geometría sin medición continua ni frames ociosos. Observa origen, hijos directos, contenido/texto y carga de fuentes. Overflow profundo sin resize observado necesita `refresh()`; `linked.refresh()` también valida el destino. Movimiento reducido fija canales espaciales en el último keyframe y conserva opacity; al desactivarlo vuelve el mapeo. El fallback oculto retoma el offset actual sin simular el intervalo perdido.

Descartar/sustituir el último canal o desmontar origen/destino libera listeners, valores y observers. La sustitución parcial preserva los demás; un handle antiguo no sobrescribe al nuevo. `scrollValue()` requiere descarte independiente. No incluye normalización horizontal/RTL, flujo inverso, escritura vertical, ViewTimeline, pinning, headers virtualizados ni handoff anidado. No equivale a `scrollHeader()` ni garantiza ejecución fuera del hilo principal.

## Referencias nativas y verificación {#verification}

Estos demos revisados muestran los mapeos y scroll nativos existentes, cuya implementación no cambia. No graban el backend Web ni la integración Mavis.

<Clip name="descending-values-ios" caption="Demo existente en simulador iOS, velocidad original: mapeos descendentes y encadenados siguen gestos reales en la sheet. Referencia nativa, no dispositivo físico." />
<Clip name="scroll-values-android" caption="Demo existente en emulador Android, velocidad original: scroll real controla traslación, escala, opacidad y progreso del header. Referencia nativa." />

Ejecuta `npm run web:support:typecheck` y `npm run web:support:test`: presentación CSS real en Chromium/Firefox/WebKit, auto/fallback, press, geometría, lifecycle, reposo, teclado/rueda y toque en Chromium. El tiempo oculto controla señales, no background físico. También se verifican consumidores empaquetados Web/Vue/SSR/nativos y las suites existentes. [Informe reproducible](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-support.md).

## Scroll relativo a un elemento {#element-range}

Pendiente para la próxima versión. Sustituye el cálculo manual y la recreación del vínculo por una sección de referencia:

```ts
const linked = motion.scrollLinked(
  document,
  ribbon,
  { x: [0, -220] },
  {
    range: { element: section, start: 'start end', end: 'end start' },
  },
)
// The defaults allow: range: { element: section }
// Cleanup: linked.dispose() — useWebMotion scopes own this automatically.
```

El valor predeterminado es `start end` → `end start`: empieza cuando la sección entra en la viewport y termina cuando sale. Cada alineación nombra un borde del elemento y otro de la viewport; también admite `center`. El rango puede comenzar negativo. El eje horizontal respeta LTR/RTL.

Los cambios de tamaño, texto, fuentes, hijos y estilos/clases relevantes actualizan el mismo vínculo mediante observadores agrupados, sin bucle de frames en reposo. `linked.refresh()` vuelve a medir. Disponer el vínculo, ámbito o runtime elimina los observadores; una referencia desmontada o inválida libera el vínculo y comunica un error.

Usa una sección sin transformación ni sticky; anima un hijo u otro elemento. Debe permanecer dentro del origen sin atravesar otro contenedor de scroll. Los ancestros transformados/fixed/sticky, zoom y las transiciones animadas de layout quedan fuera del contrato. Para cambios de stylesheet/CSSOM sin cambios observables de caja o DOM, llama a `linked.refresh()`. Los rangos numéricos no cambian.

<Clip name="web-element-range-chromium" caption="Chromium de escritorio · interfaz en inglés, velocidad original. Rueda y clics reales muestran entrada/salida, inserción, tamaño, diagnóstico y recuperación con observeGeometry. Grabación del navegador; la referencia nativa anterior usa su propia API." />

## Diagnóstico de conflictos de superficie {#surface-diagnostics}

Los conflictos informan `WebSurfaceConflictError`, un selector y entradas `changes` con `property`, `previous` y `current`, sin retener nodos DOM. Un cambio de origen causado por tamaño incluye las dimensiones y recomienda `observeGeometry()` antes del cambio o `refresh()` después de un cambio síncrono. Las escrituras externas siguen necesitando liberar y recrear la superficie.
