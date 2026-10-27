# Navegación interactiva {#interactive-navigation}

`interactiveNavigation(frame)` le da a **transición de página personalizada iOS** un retorno de deslizamiento de borde nativo. La página sigue el dedo; soltar antes de la mitad se cancela, mientras continúa o un movimiento hacia adelante comete el pop. Un resorte Jolt preserva la velocidad de liberación y asienta las páginas. El Frame y el enrutador actualizan su historial solo cuando se confirma UIKit.

Disponible desde **0.1.0-rc.1**. Reconstruya la aplicación nativa. Esta integración se verifica con NativeScript Core **9.1.3** y `vue-router-ns` **0.1.0-rc.2**.

<Clip name="interactive-navigation-ios" caption="Simulador de iOS 26.2: toques y arrastres de borde reales de XCTest abren una página, cancelan una devolución parcial, confirman una devolución completa y luego usan el botón Atrás. Reproducción nativa a velocidad original; no es una medida del rendimiento del dispositivo físico." />
<Clip name="interactive-navigation-pt-ios" caption="iOS 26.2 simulator: the same cancel, commit and button navigation in Portuguese, driven by real XCTest input at original speed." />

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

De forma predeterminada, esta API anima páginas Frame completas. Para movimiento de imagen/tarjeta en el mismo progreso nativo, use la composición [gestos compartidos](./shared-gestures). Los modales nativos arbitrarios, los gestos de deslizamiento en pantalla completa y la realización automática de vistas recicladas quedan fuera de este contrato. Utilice un botón de retroceso normal como alternativa accesible. Ver [validación nativa](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/interactive-navigation.md).
