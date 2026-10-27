# Respuesta háptica {#haptics}

Agrega un impacto cuando llega una animación:

<Clip name="haptics-ios" caption="Animaciones de llegada y rebote en el simulador iOS. El vídeo no puede reproducir retroalimentación háptica; sintiendo que requiere un iPhone físico compatible." />

<Clip name="haptics-android" caption="Llegadas de resorte, controles de rebote, escalonamiento y reproducción en un emulador Android 15. Los destellos blancos indican solicitudes de respuesta nativas, no pruebas de vibración. El vídeo no puede reproducir comentarios táctiles." />

<Clip name="haptics-android-device" caption="Toques reales en un ASUS_Z017DC físico, Android 8.0, Animator escala 1 y retroalimentación táctil habilitada. Los destellos blancos marcan las solicitudes en la vista nativa; la grabación no puede reproducir su sensación táctil." />

```ts
animate(card, { y: 0 }, { type: 'spring', haptic: 'light' })
```

Elija `light`, `medium` o `heavy`. Los comentarios se aceptan en **iOS y Android**. Necesitas un dispositivo físico compatible para sentirlo. Un simulador/emulador puede verificar las solicitudes y los tiempos, pero no puede establecer la sensación. La configuración del dispositivo y el hardware deciden si se siente una solicitud; Los estilos no son niveles de intensidad calibrados entre dispositivos.

## Comportamiento Android {#android-behavior}

Jolt llama a [`View.performHapticFeedback()`](https://developer.android.com/develop/ui/views/haptics/haptic-feedback) sin indicadores de omisión ni permiso `VIBRATE`. Respeta la configuración `hapticFeedbackEnabled` de la vista y la preferencia de retroalimentación táctil del sistema. Una solicitud rechazada no se vuelve a intentar como una vibración más fuerte.

| Estilo   | Mapeo Android            | Alternativa a plataformas anteriores |
| -------- | ------------------------ | ------------------------------------ |
| `light`  | `CLOCK_TICK`, API 21+    | `KEYBOARD_TAP`                       |
| `medium` | `CONTEXT_CLICK`, API 23+ | `KEYBOARD_TAP`                       |
| `heavy`  | `LONG_PRESS`             | Mismo efecto                         |

En las versiones modernas de Android, un resultado de API `true` puede reconocer el envío asincrónico incluso cuando el sistema suprime posteriormente la solicitud. No es prueba de vibración.

Estas son categorías de retroalimentación de la plataforma, no formas de onda personalizadas. Los OEM pueden hacer que dos categorías parezcan similares. No se requiere ningún paquete de adaptador nativo opcional para los hápticos.

Consulte [notas de validación nativas](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/haptics.md) para conocer la configuración del dispositivo, los tiempos de solicitud registrados y la distinción entre el reconocimiento de la plataforma y la retroalimentación sentida.

## Llegada {#arrival}

Un resorte desencadena retroalimentación en la misma llegada visual que avanza una secuencia, antes de que termine su cola asentada. Una interpolación se activa al final. Con varias propiedades, Jolt espera la última llegada y dispara un impacto por vista. Se incluyen retrasos, anulaciones de propiedad y escalonamiento.

```ts
animate(
  card,
  { x: 160, scale: 1.1 },
  {
    type: 'spring',
    duration: 500,
    haptic: 'medium',
  },
)
```

Las repeticiones finitas se activan una vez, al final de la última iteración. Las animaciones infinitas no tienen llegada final y no producen retroalimentación. Las animaciones vacías, los cambios de duración cero y los fotogramas clave estacionarios también permanecen en silencio.

## Impactos durante un movimiento {#impacts-during-a-movement}

Utilice `times` para impactos específicos. Estos son puntos crecientes mayores que `0` y como máximo `1`, sobre la animación finita completa después de su retraso inicial. Con las anulaciones de propiedades, el intervalo comienza en el primer retraso de la propiedad en movimiento y finaliza cuando finaliza la última propiedad. En ese lapso se incluyen repeticiones finitas; los puntos no se repiten automáticamente.

El preset `bounce` aterriza en 60% y 100%:

```ts
animate(button, 'bounce', {
  haptic: { style: 'light', times: [0.6, 1] },
})
```

Los puntos siguen la duración resuelta en lugar de un temporizador de milisegundos separado proporcionado por la aplicación. Reemplazan el impacto de llegada predeterminado.

## Cancelación y calendario {#cancellation-and-timing}

`animation.stop()`, `stop(view)` y cancelación de interrupción pendiente de retroalimentación. Tomar control o detener cualquier propiedad cancela los impactos restantes de esa animación, incluso si sus otras propiedades continúan reproduciéndose. Las animaciones independientes en la misma vista mantienen sus propios comentarios.

Al descargar la vista se cancelan sus impactos pendientes de forma permanente. Los comentarios también se omiten si la vista nativa fue reemplazada, está fuera de una ventana o la aplicación está inactiva. Una nueva animación puede programar nuevos comentarios cuando vuelva la vista.

`pause()` tiene impactos pendientes y `play()` programa el tiempo restante. Esto también se aplica a las animaciones propiedad de `timeline()`. La búsqueda salta puntos de impacto cruzados; El rebobinado no reproduce los puntos consumidos. Estos son eventos de una sola vez, no una forma de onda reversible.

Jolt prepara `UIImpactFeedbackGenerator` en iOS cuando comienza la reproducción y nuevamente poco antes de un impacto distante. En Android, los marcadores de tiempo nativos discretos siguen la escala de duración de Animator y la solicitud de impacto se ejecuta a través de JavaScript en el límite programado. No hay devolución de llamada JavaScript por cuadro de animación en el programador háptico. La demostración opta por separado por la observación del progreso para su etiqueta de porcentaje.

El mejor momento es el mejor esfuerzo: JavaScript comparte el hilo de la interfaz de usuario en NativeScript, y un hilo ocupado puede retrasar una solicitud. Los impactos con más de 100 ms de retraso **en tiempo de animación** se descartan en lugar de reproducirse. Una solicitud oportuna a la plataforma aún no garantiza una retroalimentación física.

## Configuración de movimiento {#motion-settings}

La cámara lenta Jolt y la escala de duración del animador Android afectan el tiempo de retroalimentación con la reproducción. La escala Android **0** suprime la retroalimentación incluso cuando `configure({ reducedMotion: 'never' })` conserva una animación lógica. Un cambio de escala a cero también silencia las solicitudes pendientes.

Las transformaciones de movimiento reducido que saltan inmediatamente no producen impactos. Una animación de opacidad/color que aún se reproduce puede conservar la respuesta solicitada explícitamente, a menos que los animadores de Android estén deshabilitados. `haptic: false` siempre desactiva la retroalimentación de la llamada.

Los ajustes preestablecidos personalizados pueden incluir `haptic` en su transición. Pase `haptic: false` para desactivarlo para una llamada:

```ts
animate(card, 'myPreset', { haptic: false })
```
