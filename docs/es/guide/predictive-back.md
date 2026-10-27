# Retroceso predictivo {#predictive-back}

`predictiveBack(view, values, options)` conecta una superficie dedicada al gesto de retroceso del sistema Android. La vista sigue el progreso desde cualquiera de los bordes de la pantalla; la cancelación regresa y la confirmación finaliza el resorte antes de llamar a su función de navegación o descarte una vez.

Disponible desde **0.1.0-rc.1**. Reconstruya la aplicación nativa. Requiere **Android 14 / API 34+**, navegación por gestos, actividad de AndroidX **1.8+** y el manifiesto de suscripción a continuación. Verificado con NativeScript Core **9.1.3** y `vue-router-ns` **0.1.0-rc.2**.

<Clip name="predictive-back-android" caption="Emulador Android 16 / API 36: toques reales del sistema operativo y gestos de borde abren las dunas, cancelan un retorno parcial, confirman desde el borde derecho y luego usan el botón Atrás. Reproducción nativa a velocidad original; no es una medida del rendimiento del dispositivo físico." />
<Clip name="predictive-back-pt-android" caption="Emulador Android 16: la misma cancelación nativa, finalización en el borde derecho y botón de retroceso accesible en portugués, impulsado por entrada real del sistema operativo a la velocidad original." />

## Adjuntar a una superficie propia {#attach-to-an-owned-surface}

Opte por participar en la aplicación host, no en nombre de la biblioteca:

```xml
<application android:enableOnBackInvokedCallback="true" ...>
```

Cree el identificador cuando la vista esté adjunta y se inicie su ciclo de vida, por ejemplo en el controlador `navigatedTo` de la página. Utilice un contenedor dedicado cuyas transformaciones no estén escritas también por otra animación o enlace.

```ts
import { predictiveBack } from '@rafaelaugusto/jolt/predictive-back'

const motion = predictiveBack(
  surface,
  {
    x: [0, 28],
    y: [0, 14],
    scale: [1, 0.9],
    rotate: [0, 0.6],
  },
  {
    spring: { duration: 380, bounce: 0 },
    // A successful vue-router-ns navigation resolves undefined; failures resolve an object.
    commit: async (options) => (await router.back(options)) === undefined,
    onState(event) {
      if (event.outcome === 'cancelled') console.log('Still here')
    },
  },
)

// Accessible back button: same animation and single commit path.
backButton.on('tap', () => motion.back())
```

Se requiere `commit`: Jolt no puede inferir si su superficie cierra una hoja o navega por una ruta. Recibe `{ animated: false }` para evitar una segunda transición de ruta. Devuelve `false` cuando un guardia lo rechaza; devolver `true` o nada después de cerrar/navegar exitosamente. Los errores sincrónicos y las promesas rechazadas también restauran la presentación. Para un panel en página, ciérrelo dentro de `commit`. Un manejo exitoso se dispone solo; crear otro cuando esa superficie se abra nuevamente.

Solo para Core, una confirmación puede verificar `frame.canGoBack()`, devolver falso si no está disponible y luego llamar a `frame.goBack()`; configure esa entrada sin una segunda transición Core al presionarla. No adjunte un propietario habilitado a una página raíz que no tenga una acción de devolución de propiedad. Configure `motion.enabled = false` cuando otra parte de su interfaz de usuario deba recibir respuesta.

## Valores y física {#values-and-physics}

| Valores                        | Significado                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------- |
| `x`, `y`                       | Traducción relativa en DIPs, comenzando en `0`                                  |
| `rotate`                       | Rotación relativa en grados, comenzando en `0`                                  |
| `scale`, o `scaleX` / `scaleY` | Multiplicadores de la escala capturada, comenzando en `1`, punto final positivo |
| `opacity`                      | Multiplicador de alfa capturado, comenzando en `1`, punto final entre `0` y `1` |

Cada valor es un par finito de dos números. `scale` no se puede combinar con `scaleX` / `scaleY`. Los valores predeterminados conservan las propiedades omitidas. La traducción, rotación, escala y alfa nativos existentes se capturan para cada gesto y se restauran al cancelar o limpiar. Estas seis propiedades pertenecen al identificador durante la interacción; no los anime al mismo tiempo.

`mirrorX` tiene el valor predeterminado verdadero: x y dirección inversa de rotación para un gesto desde el borde derecho. `spring` acepta `smooth`, `snappy`, `bouncy`, duración/rebote o rigidez/amortiguación/masa. El progreso nativo lleva la velocidad de liberación muestreada al resorte Jolt. Android es propietario de la decisión de confirmación/cancelación, incluidas las películas; Jolt no impone ningún umbral intermedio. El progreso visible está fijado en `[0, 1]`. La estabilización está limitada a **1,5 segundos de reloj de pared** incluso con una física inusual o un `timeScale` global lento; la velocidad se captura al adjuntar (o actualizar el movimiento reducido).

## Entrada nativa, comprobaciones y limpieza {#native-input-guards-and-cleanup}

Un Java `OnBackPressedCallback` se adjunta al propietario del despachador existente del árbol de vista. No reemplaza la Actividad, el enrutador o el despachador. La última devolución de llamada habilitada es la propietaria; registre este identificador después de que se muestre la página y desactívelo o deséchelo cuando ya no sea propietario de esa acción. El despido normal de IME permanece antes de la acción de retroceso de la aplicación.

Las actualizaciones de progreso y los marcos de resorte `Choreographer` permanecen en Java. JavaScript recibe eventos del ciclo de vida y la confirmación final de la aplicación, nunca una devolución de llamada por muestra o marco de progreso. Esto no hace que el hilo principal JavaScript funcione sin bloqueo.

Un guardia rechazado regresa sin hacer estallar el historial. Una confirmación asincrónica espera como máximo milisegundos `commitTimeout` (**5000** predeterminado, rango aceptado **1–10000**) y luego restaura la superficie con el motivo `timeout`. Esto **no** cancela su promesa o deshace la navegación externa posterior: mantenga las comprobaciones acotadas o implemente la cancelación en su aplicación.

`state` es `idle`, `tracking`, `cancelling`, `finishing`, `committing` o `disposed`. Los eventos de finalización/cancelación incluyen `release: { progress, velocity }` (progreso por segundo). Los eventos de inactividad del terminal incluyen `outcome: 'completed' | 'cancelled'`; Las confirmaciones rechazadas también informan `reason: 'rejected' | 'error' | 'timeout'`. `edge` está izquierdo/derecho para gestos y ausente para botones. `progress` es un captador de encuestas, no un valor reactivo.

- `cancel()` revierte un gesto retenido. Continúa una liberación ya confirmada por Android.
- `enabled = false` genera entradas futuras y restaura una vista previa retenida.
- El movimiento reducido deja la superficie quieta mientras se preserva la acción de la espalda propia y los controles de guardia.
- Ver desprendimiento, destrucción del ciclo de vida y `dispose()` restaurar la superficie y eliminar la entrada. Una ruta que se separa durante `commit` mantiene pendiente solo la finalización limitada. La suspensión restablece un gesto. Si Core descarga la vista al detener la actividad, cree un identificador nuevo después de recargarla y adjuntarla; la vista previa lo demuestra. Se puede reanudar un identificador cuya vista permanece adjunta.
- `supported` es falso en iOS, Android anterior, falta código nativo, vistas no adjuntas o propietarios de árbol de vistas faltantes/inactivos. No se instala ninguna devolución de llamada nativa. El `back()` explícito todavía llama a su confirmación sin movimiento; La parte trasera del sistema normal permanece sin cambios. Deseche un mango sin soporte antes de volver a intentar conectarlo.

El indicador de manifiesto y la navegación por gestos aún deben estar habilitados incluso cuando `supported` sea verdadero. Esta API anima la superficie suministrada; no representa la ruta anterior, no agrega transformaciones de elementos compartidos ni reemplaza la pila posterior del enrutador. Para navegación interactiva iOS de página completa, consulte [navegación interactiva](./interactive-navigation). Consulte [guía de animación de espalda personalizada](https://developer.android.com/guide/navigation/custom-back/support-animations-views) de [pasos de validación y reproducción nativa](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/predictive-back.md) y Android.
