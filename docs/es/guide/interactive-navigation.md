# Navegación interactiva {#interactive-navigation}

`interactiveNavigation(frame)` le da a **transición de página personalizada iOS** un retorno de deslizamiento de borde nativo. La página sigue el dedo; soltar antes de la mitad se cancela, mientras continúa o un movimiento hacia adelante comete el pop. Un resorte Jolt preserva la velocidad de liberación y asienta las páginas. El Frame y el enrutador actualizan su historial solo cuando se confirma UIKit.

Disponible desde **0.1.0-rc.1**. Reconstruya la aplicación nativa. Esta integración se verifica con NativeScript Core **9.1.3** y `vue-router-ns` **0.1.0-rc.2**.

<Clip name="interactive-navigation-ios" caption="Simulador de iOS 26.2: toques y arrastres de borde reales de XCTest abren una página, cancelan una devolución parcial, confirman una devolución completa y luego usan el botón Atrás. Reproducción nativa a velocidad original; no es una medida del rendimiento del dispositivo físico." />
<Clip name="interactive-navigation-pt-ios" caption="iOS 26.2 simulator: the same cancel, commit and button navigation in Portuguese, driven by real XCTest input at original speed." />

## Suspensión y rotación {#suspension-and-rotation}

**Corregido en 0.1.0-rc.2:** NativeScript descarga temporalmente el Frame raíz cuando la aplicación pasa a segundo plano. Jolt cancela el gesto de retorno y conserva su controlador mientras ese Frame vuelve a cargarse. La misma página, el historial y la transición personalizada siguen disponibles al reanudar. Un Frame que permanece desconectado, una ruta eliminada o un `dispose()` explícito siguen liberando el controlador.

<Clip name="interactive-background-ios" caption="Simulador iOS 26.2, demo en inglés: un arrastre real desde el borde se mantiene mientras se cambia a la pantalla de inicio. Al regresar se conserva la página; un nuevo gesto de Jolt confirma un único retorno, seguido de navegación con el botón. Velocidad original; sin medición de rendimiento en un dispositivo físico." />

En la configuración de iOS probada, girar el dispositivo durante el gesto aplaza la rotación de la interfaz hasta que termina el retorno parcial. La grabación verifica la página conservada, los diseños horizontal y vertical y un nuevo retorno confirmado; no demuestra un cambio inmediato del viewport durante el arrastre.

<Clip name="interactive-rotation-ios" caption="Simulador iOS 26.2, demo en inglés: la orientación cambia durante el gesto sostenido; UIKit espera a la cancelación antes de mostrar la interfaz horizontal. Al volver a vertical, un nuevo gesto regresa normalmente. Entrada nativa real a velocidad original." />

## Un identificador por entrada enviada {#one-handle-per-pushed-entry}

```ts
import { interactiveNavigation } from '@rafaelaugusto/jolt/interactive-navigation'

// The Frame is already loaded. Create a fresh handle for each push.
const motion = interactiveNavigation(frame, {
  spring: 'smooth', // or { duration: 480, bounce: 0 }
  onState(event) {
    // Lifecycle notifications, never a per-frame observer.
    if (event.outcome === 'cancelled') console.log('Still on this page')
  },
})

try {
  await router.push('/place/cala-serena', { transition: motion.transition })
  // A guard/redirect may resolve without using this transition.
  if (motion.state === 'ready') motion.dispose()
} catch (error) {
  motion.dispose()
  throw error
}

// The pushed entry remembers the transition for programmatic back too.
await router.back()
```

Solo para Core, pase `transition: motion.transition` a `frame.navigate({ create: () => page, ... })`. Deseche un identificador si esa navegación nunca se inicia. No reutilice su transición para otra entrada. Una ventana emergente confirmada, una eliminación del historial o una descarga de Frame liberan automáticamente el reconocedor y el estado de transición del Core. `dispose()` es idempotente; Al eliminarlo en la página visible, se restaura el deslizamiento predeterminado de Core de acuerdo con `page.enableSwipeBackNavigation`.

`supported` es falso y `transition` no está definido en Android o cuando la clase nativa compilada está ausente. La persona que llama puede navegar normalmente con esas opciones. Esta entrada no implementa el respaldo predictivo Android.

## Propiedad de dedos, resortes y rutas. {#finger-spring-and-route-ownership}

- Un `UIScreenEdgePanGestureRecognizer` nativo comienza en el borde anterior (izquierda en LTR, derecha en RTL). Requiere intención horizontal, una entrada actual con un destino posterior y ninguna transición UIKit activa.
- El gesto llama una vez a la devolución de llamada pop proporcionada por Core. El delegado de controlador de navegación existente de Core suministra el animador nativo y el controlador interactivo de Jolt; Jolt no reemplaza ni modifica a ese delegado.
- Las actualizaciones de gestos nativos mueven las visitas a la página real. En el lanzamiento, `JoltSpringAdvance` se ejecuta en un enlace de pantalla nativo, trasladando la velocidad del dedo a la misma ecuación de resorte utilizada por los valores en vivo de Jolt. No hay devoluciones de llamada JS por cuadro. El JS del hilo principal aún puede bloquear UIKit.
- La finalización utiliza el progreso más una breve proyección de velocidad. Retroceder hacia el borde puede cancelarse incluso después de cruzar la mitad del camino. La estabilización está limitada a tres segundos de reloj de pared, incluidos ajustes de resorte inusuales o un `timeScale` global lento.
- La cancelación restaura ambas transformaciones de página y mantiene la ruta y la pila de actividades actuales. Cometer aparece una vez. Las entradas anidadas mantienen identificadores independientes; sólo la entrada superior acepta gestos.

`spring` acepta `smooth`, `snappy`, `bouncy`, o configuraciones de duración/rebote y rigidez/amortiguación/masa. No se aceptan opciones de retardo, repetición, interpolación y velocidad explícita. El progreso del gesto permanece adherido al dedo; global `timeScale` afecta al resorte al inicio de cada navegación. El progreso se sujeta a los límites de la página incluso con un resorte elástico.

## Comprobaciones, accesibilidad y limpieza {#guards-accessibility-and-cleanup}

Siempre se respeta `page.enableSwipeBackNavigation`. `vue-router-ns` lo desactiva mientras es necesario ejecutar comprobaciones de salida de ruta asincrónicas; Utilice el botón Atrás para una navegación vigilada. Un `canBegin()` síncrono opcional puede imponer una puerta adicional. No puede esperar una decisión asincrónica.

El movimiento reducido desactiva el gesto de borde y finaliza el movimiento de página programático inmediatamente. El botón Atrás sigue estando disponible. La suspensión, los cambios de ventana gráfica, `cancel()` y la eliminación hacen retroceder un gesto retenido. Una vez que UIKit ha aceptado una versión, la limpieza finaliza esa decisión en lugar de intentar revertir un pop comprometido.

El `state` es `ready`, `animating`, `idle`, `dragging`, `finishing`, `cancelling` o `disposed`. El evento `finishing`/`cancelling` incluye `release: { progress, velocity }`, con velocidad en anchos de página por segundo. Una notificación `idle` después de un gesto incluye `outcome: 'completed' | 'cancelled'`. Las excepciones del observador se informan a través de NativeScript Trace y no interrumpen la limpieza.

Mantén el contenido visible de la página anterior montado mientras está en la pila posterior del Frame: el retorno interactivo muestra una vista previa del mismo **antes** `navigatedTo`. Reconstruir todo solo en ese evento produce una vista previa vacía.

Esta API anima páginas Frame completas. Para imágenes o tarjetas con el mismo progreso nativo, usa [gestos compartidos](./shared-gestures). Los modales usan el control independiente `interactiveModal()` descrito abajo. Los gestos de página a pantalla completa y la realización automática de vistas recicladas quedan fuera del contrato de Frame. Mantén un botón de volver como alternativa accesible. Consulta la [validación nativa](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/interactive-navigation.md).

## Modales interactivos {#interactive-modals}

**Aún no publicado:** `interactiveModal()` permite cerrar con un arrastre hacia abajo un modal NativeScript que ocupa toda la ventana. Abre **Navegación interactiva → Abrir un modal** en la vista previa. Recompila la aplicación nativa; validado con Core **9.1.3**, NativeScript-Vue **3.1.2** y simulador iOS **26.2**.

<Clip name="interactive-modal-ios" caption="Simulador iPhone 17, iOS 26.2, interfaz en inglés: abrir un modal NativeScript-Vue real, cancelar un arrastre hacia abajo, repetir y confirmar, después reabrir y cerrar con el botón. Reproducción nativa a velocidad original. No mide rendimiento físico ni valida lectores de pantalla." />

Crea un control nuevo para cada presentación. Core y Vue conservan la propiedad del modal y su callback de cierre; Jolt proporciona los objetos nativos de animación e interacción mediante el delegate de transición existente de Core.

```ts
import { interactiveModal } from '@rafaelaugusto/jolt/interactive-navigation'
import { $showModal } from 'nativescript-vue'

const motion = interactiveModal({
  spring: 'smooth',
  canBegin: () => !saving,
  onState(event) {
    if (event.outcome === 'cancelled') console.log('Sigue abierto')
  },
})
try {
  const result = await $showModal(Detail, {
    transition: motion.transition,
    props: { motion },
  })
} finally {
  motion.dispose()
}
```

Dentro del modal, usa `motion.close(result)` en el botón de cerrar. En plataformas no compatibles, usa el `$closeModal(result)` habitual del framework. Con Core sin Vue, pasa la misma `transition` a `parent.showModal(content, { transition, closeCallback })`; `content.closeModal(result)` sigue disponible. Libera el control si la presentación falla o se abandona. El [ejemplo Vue ejecutable](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/showcase/InteractiveModalDetail.vue) no depende del router de páginas.

| Operación            | Contrato                                                                                                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arrastre hacia abajo | Un pan nativo controla el modal. El progreso sigue al dedo; al soltar, se proyecta la velocidad para confirmar o cancelar. Los UIControls y descendientes de UIScrollView conservan sus gestos.      |
| Cancelar             | Restaura el transform original de la vista del controller, conserva el modal de Core y el componente Vue, y mantiene pendiente el callback/promise de cierre. Permite otro gesto o cierre por botón. |
| Confirmar            | Completa UIKit una vez; Core llama al callback y Vue desmonta una vez. Libera el gesto, el display link y el estado de transición de Core.                                                           |
| `close(...args)`     | Envía argumentos a Core. La primera petición durante la apertura espera a `shownModally`; duplicados y peticiones durante arrastre/asentamiento devuelven `false`. Las aceptadas devuelven `true`.   |
| `cancel()`           | Revierte un gesto aún sostenido. Una liberación ya aceptada por UIKit termina con el resultado elegido.                                                                                              |
| `dispose()`          | Desconecta Jolt de forma idempotente sin cerrar el modal. Cancela el arrastre antes de liberar el estado de Core; el cierre habitual de Core/framework sigue disponible.                             |

`cancelable: false` en las opciones del modal y `canBegin()` síncrono bloquean el cierre por gesto. Mantén un botón de cerrar accesible. Reducir movimiento hace inmediatos la presentación y el asentamiento, conservando el control directo con el dedo; activar la preferencia cancela un gesto sostenido. `timeScale` afecta al asentamiento, limitado a tres segundos reales. Los estados son `ready`, `presenting`, `idle`, `dragging`, `finishing`, `cancelling`, `closed` y `disposed`. La cancelación informa `idle/cancelled`; la finalización, `closed/completed`. La velocidad se expresa en **alturas del modal por segundo**. No hay observador JavaScript por frame.

Suspender durante el arrastre cancela el gesto y conserva el modal para reanudarlo. La grabación solicita la rotación mientras el dedo sigue presionado; en esta configuración, UIKit muestra la orientación horizontal una vez que termina la cancelación. Restaurar vertical y volver a cerrar siguen funcionando.

<Clip name="interactive-modal-lifecycle-ios" caption="Simulador iPhone 17, iOS 26.2, interfaz en inglés: arrastre real sostenido, Home/reanudación, rotación, otro intento cancelado y cierre confirmado, seguido de reapertura y cierre por botón. Velocidad original; la vista horizontal aparece girada dentro de la grabación vertical. Snapshot y los demás controles pequeños son diagnósticos opcionales. No valida rendimiento físico ni accesibilidad." />

El estilo compatible es el **modal personalizado de Core que ocupa toda la ventana**, con presentación animada predeterminada. No sustituyas `ios.presentationStyle` ni su delegate de transición. `animated: false` utiliza presentación y cierre habituales sin instalar el pan de Jolt. Detents de sheets nativas, popovers, presentaciones UIKit externas y transferencia de scroll a cierre quedan fuera de esta API. Un modal desplazable puede ofrecer un encabezado sin scroll para el arrastre. `supported` es falso en Android, sin la clase nativa recompilada o en versiones de Core sin `closedModallyEvent`; entonces `transition` es undefined. El ejemplo no mide rendimiento físico ni recorrido con VoiceOver.

[Observaciones nativas y reproducción](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/interactive-navigation.md#interactive-modals--2026-10-30) detallan el comportamiento y la limpieza validados.
