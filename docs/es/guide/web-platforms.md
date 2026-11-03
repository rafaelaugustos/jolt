# Teclado, paneles, navegación, física e iconos Web

**Disponible desde 0.1.0-rc.10.** Las issues #366–#371 añaden seis capacidades al runtime y a los ámbitos Web. Importe `/web` durante SSR y cree `createWebRuntime(document)` después de montar los elementos; obtenga un ámbito con `motion.scope()`.

## Geometría del teclado {#keyboard}

`scope.onKeyboard(callback)` y `scope.followKeyboard(composer, { offset: 12 })` devuelven funciones de limpieza con `pause/play`, `dispose` y `snapshot()`. El estado incluye visibilidad, rectángulo, cobertura inferior en píxeles CSS, backend y precisión. VirtualKeyboard proporciona la geometría declarada; VisualViewport utiliza una estimación cuando hay un campo editable enfocado, sin zoom, y una reducción superior a 80 px. Los teclados físicos o flotantes y las barras del navegador limitan esa estimación. Un teclado flotante puede estar visible con cobertura inferior cero. Sin geometría, la precisión es `unavailable`.

La duración es siempre cero: el navegador no ofrece la curva nativa. Jolt no cambia `overlaysContent` ni descuenta dos veces un viewport ya reducido. Use un destino alineado a los ejes, sin ancestros transformados; el seguimiento añade una capa de traslación propia. `offset` es una separación no negativa.

<Clip name="web-keyboard-platforms-chromium" :width="900" caption="Chromium en macOS, interfaz en inglés: foco y escritura reales muestran geometría desktop. No se abre un teclado virtual; no demuestra seguimiento de teclado móvil." />
<Clip name="keyboard-ios" caption="Simulador iOS, demo nativa en inglés: referencia existente revisada con interacción y animación reales, a velocidad original. No es un dispositivo físico." />

## Bottom sheet {#sheet}

`scope.bottomSheet(panel, { host, handle, snap: [160, '75%'], scrollView: content })` requiere un panel hijo directo de un host posicionado y recortado, y un handle separado dentro del panel. Los snaps aceptan píxeles positivos, porcentajes o `'content'` con un elemento medido aparte. El coordinador gestiona la transferencia entre arrastre y desplazamiento anidado, conservando la entrada de formularios. La aplicación controla la semántica modal y el bloqueo del fondo.

Use `open`, `snapTo`, `expand`, `collapse`, `dismiss` y `remeasure`. `safeArea` recibe píxeles CSS; `keyboard: 'none'` desactiva el seguimiento. El backdrop es un hermano del panel. `onChange` informa el destino y `onDismiss` se ejecuta una vez al terminar el cierre. `dismissible: false` impide el cierre del usuario. El handle ofrece semántica slider y flechas/Home/End/Escape; proporcione `label` localizado y, si hace falta, `returnFocus`.

<Clip name="web-sheet-platforms-chromium" :width="900" caption="Chromium en macOS, interfaz en inglés: clics, teclas y gestos reales muestran el comportamiento Web a velocidad original; no representa rendimiento de un dispositivo físico." />
<Clip name="bottom-sheet-ios" caption="Simulador iOS, demo nativa en inglés: referencia existente revisada con interacción y animación reales, a velocidad original. No es un dispositivo físico." />

## Modal interactivo {#modal}

`scope.interactiveModal(dialog, { handle })` acepta un `HTMLDialogElement` montado e inicialmente cerrado. `open()` usa la capa modal, la inercia del fondo y el foco del navegador. `canBegin` puede vetar el arrastre; un arrastre corto o `cancel()` vuelve a la posición abierta. `close(returnValue)`, Escape y el botón cierran. `state/onState` distinguen apertura, arrastre y cierre.

Se admiten `dialog.close()` externo y formularios `method="dialog"`. Pausar congela el movimiento. Descartar deja un diálogo abierto bajo responsabilidad de la aplicación, que debe cerrarlo o eliminarlo al desmontar. No implementa delegates iOS ni predictive back Android.

<Clip name="web-modal-platforms-chromium" :width="900" caption="Chromium en macOS, interfaz en inglés: clics, teclas y gestos reales muestran el comportamiento Web a velocidad original; no representa rendimiento de un dispositivo físico." />
<Clip name="interactive-modal-ios" caption="Simulador iOS, demo nativa en inglés: referencia existente revisada con interacción y animación reales, a velocidad original. No es un dispositivo físico." />

## Navegación de la aplicación {#navigation}

`scope.sharedNavigation(routeHost)` ofrece `attach(card, 'cover')` y `navigate({ tag: 'cover', async navigate({ animated }) { ... } })`. Mantenga el contenedor entre rutas. El callback se invoca una vez con `animated: false`; adjunte el destino antes de resolverlo. El router conserva historia, datos y control de solicitudes antiguas.

Una operación concurrente devuelve `unavailable/busy` sin ejecutar el callback. `finished` informa estado, motivo, `navigated` y error opcional; `navigated` significa callback invocado, no éxito confirmado. Cancelar elimina el efecto sin revertir la ruta. Rechazos devuelven `failed`; contenido no compatible y movimiento reducido mantienen la navegación sin vuelo.

`navigationTimeout` vale 3000 ms, máximo 10000. La ventana visual suma ese límite y `layoutTimeout` (500 por defecto), con máximo 10000 ms; excluye tiempo oculto. Se aplican los límites de copia del shared layout: HTML estático, sin formularios, vídeo, canvas, custom elements o SVG. No es una captura nativa ni un gesto de retorno interactivo.

<Clip name="web-navigation-platforms-chromium" :width="900" caption="Chromium en macOS, interfaz en inglés: clics, teclas y gestos reales muestran el comportamiento Web a velocidad original; no representa rendimiento de un dispositivo físico." />
<Clip name="shared-navigation-ios" caption="Simulador iOS, demo nativa en inglés: referencia existente revisada con interacción y animación reales, a velocidad original. No es un dispositivo físico." />

## Física circular {#physics}

`scope.physicsWorld(arena, [{ id: 'ball', view: ball, radius: 24, x: 80, y: 80 }])` acepta 1–16 hijos directos distintos. Radio 12–256 px CSS, masa 0,1–100, velocidad máxima 1200 px/s y área total hasta 40% del host. Cada wrapper mide el doble del radio; host y ancestros no deben transformarse. Los cuerpos iniciales deben caber sin superposición. Gravedad: componentes ±2000; restitución: 0–1; amortiguación: 0–20.

El motor TypeScript se compara con C/iOS y Java/Android en 52 casos. Integra a 240 Hz con hasta 24 pasos de recuperación por frame; `snapshot().droppedMs` informa el exceso. Web ejecuta la física en la thread principal. Admite arrastre directo o por resorte, attachment fijo o 1–8 snaps, y hasta 32 resortes entre cuerpos, cuatro por cuerpo. Los endpoints de resortes no admiten snaps; attachment y snaps son excluyentes.

`impulse`, `attach`, `spring`, `snapTo`, `reset`, `pause/play` y `snapshot` controlan el mundo. Las líneas son decorativas. El arrastre por resorte conserva el momento integrado al soltar. Redimensionar escala posiciones y borra velocidades; límites inválidos pausan hasta recuperarse. Movimiento reducido pausa salvo `'continue'` explícito; el reposo elimina solicitudes de frames. Descartar libera guías, entrada, bindings y posicionamiento controlado.

<Clip name="web-physics-platforms-chromium" :width="900" caption="Chromium en macOS, interfaz en inglés: clics, teclas y gestos reales muestran el comportamiento Web a velocidad original; no representa rendimiento de un dispositivo físico." />
<Clip name="circle-physics-ios" caption="Simulador iOS, demo nativa en inglés: referencia existente revisada con interacción y animación reales, a velocidad original. No es un dispositivo físico." />
<Clip name="physics-attachments-ios" caption="Simulador iOS, demo nativa en inglés: referencia existente revisada con interacción y animación reales, a velocidad original. No es un dispositivo físico." />

## Iconos propios {#symbols}

`scope.symbolEffect(iconWrapper, 'bounce', { speed: 1 })` anima un wrapper HTML dedicado. Bounce, pulse y variableColor pueden repetirse; scale mantiene el tamaño ampliado hasta parar. `variableColor` usa ondas de opacidad en 1–32 capas `[data-jolt-symbol-layer]`; no carga SF Symbols.

`{ replace: detachedIconElement }` conserva el nuevo HTML/SVG decorativo tras cancelar o descartar. Actualice el nombre accesible y el estado de la aplicación. Los bucles y scale tienen duración infinita y no admiten seek. Los efectos finitos admiten progreso, pausa y resultado booleano. Movimiento reducido omite decoración (`false`), pero aplica reemplazo (`true`).

<Clip name="web-symbols-platforms-chromium" :width="900" caption="Chromium en macOS, interfaz en inglés: clics, teclas y gestos reales muestran el comportamiento Web a velocidad original; no representa rendimiento de un dispositivo físico." />
<Clip name="symbols-reference-ios" caption="Simulador iOS, demo nativa en inglés: referencia existente revisada con interacción y animación reales, a velocidad original. No es un dispositivo físico." />

## Ciclo de vida y validación {#validation}

Todas las factories están en runtime y ámbitos, incluidos los de Vue. Suspensión/reanudación controla recursos; descarte y desconexión los liberan. El compositor puede conservar transform/opacity neutros serializados sin eliminar otras capas. Ejecute `npm run web:platforms:typecheck`, `npm run web:platforms:test` y `python3 benchmarks/verify-circle-math.py`. Las pruebas verifican Chromium, Firefox y WebKit. Los rectángulos de teclado inyectados pertenecen sólo a pruebas; los vídeos nunca fabrican un teclado móvil. Grabe con `node benchmarks/web-platforms/record.mjs`. La adopción en Mavis se realiza por separado.
