# Respuesta a la pulsación en Web

`motion.press()` añade respuesta finita de puntero y teclado a una superficie HTML declarada. Utiliza el [runtime Web](./web-runtime), sin Vue, React ni un bucle permanente de frames. La API es experimental y está en el [candidato empaquetado localmente](./install#experimental-web-candidate), **no en la versión 0.1.0-rc.4 publicada**. La integración con Mavis llegará después.

<Clip name="web-press-chromium" :width="720" caption="Chromium 156 en macOS arm64, grabación real del navegador a velocidad original con pulsaciones mantenidas y teclado: escala de aplicación 1,1, factor 0,96, cambio a 1,2 durante la pulsación, liberación, Space/Enter, liberación fuera, descarte y cancelación por loading. No es una medición en dispositivo físico." />

## Uso imperativo {#imperative-usage}

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'

const motion = createWebRuntime(document) // después del montaje
motion.set(button, { scale: 1.1 })
const feedback = motion.press(button) // scale: 0.96, spring snappy

// La aplicación puede cambiar la escala mientras se mantiene el puntero o Space/Enter.
motion.animate(button, { scale: 1.2 }, 'snappy')
feedback.update({ loading: true }) // cancela la respuesta; no deshabilita la activación HTML
feedback.update({ loading: false }) // permite la próxima pulsación

// Al desmontar el componente o sustituir su superficie declarada:
feedback.dispose() // elimina solo su contribución y sus listeners inmediatamente
motion.release(button) // libera toda la superficie al terminar su ciclo de vida
motion.dispose() // descarta el contexto cuando ya no sea necesario
```

Los valores opcionales usan los canales numéricos del runtime: `motion.press(button, { scale: 0.96, opacity: 0.8 }, { transition: 'snappy', disabled: false, loading: false })`. Escala/opacidad se multiplican; traslación/rotación se suman. La respuesta vuelve a su contribución neutra, sin restaurar un valor antiguo de la aplicación.

| Estado                                       | Escala visual |
| -------------------------------------------- | ------------- |
| Aplicación en 1,1                            | 1,1           |
| Pulsado con factor 0,96                      | 1,056         |
| Aplicación cambia a 1,2 durante la pulsación | 1,152         |
| Liberado o respuesta descartada              | 1,2           |

Se admite un binding por superficie. El espacio privado `jolt:press:` está reservado. `pressed` indica el estado de entrada; `animation` expone el último handle finito. Una interrupción resuelve `finished` con `false`; una finalización con `true`, una sola vez. El nuevo movimiento hereda posición y velocidad actuales. Un handle antiguo no recupera el control. El movimiento reducido sigue la política del runtime en vivo.

## Entrada y ciclo de vida {#input-and-lifecycle}

El puntero primario funciona en cajas HTML transformables. Los elementos `<button>` nativos también reciben respuesta a Space/Enter. Jolt no sintetiza clics, cambia el foco, llama a `preventDefault()`, establece `touch-action` ni solicita captura del puntero. La activación, el envío de formularios y la repetición del teclado siguen siendo responsabilidad del navegador. Otros elementos reciben solo respuesta de puntero; la aplicación define su teclado y accesibilidad. Los controles interactivos anidados se ignoran.

Soltar fuera, cancelar/perder la captura, salir con el ratón, desplazar un ancestro, perder foco/ventana u ocultar la página cancela la respuesta. El navegador puede asumir el scroll. `:disabled` nativo (incluidos fieldsets), `aria-disabled`, `aria-busy` en el objetivo, un ancestro `inert` y `update({ disabled, loading })` bloquean la respuesta y cancelan una pulsación. Solo controlan la respuesta visual: el componente implementa activación, foco y loading, normalmente mediante la propiedad nativa `disabled`.

Los objetivos deben estar montados. Los elementos retirados se liberan automáticamente, incluso en shadow roots; el descarte explícito es idempotente y funciona inmediatamente tras retirarlos. Cree otro binding para la superficie sustituta. Siga la [política CSS](./web-runtime#surface-policy-and-limits): base 2D estática, sin animaciones/transiciones competidoras ni cambios de estilos de movimiento/clases mientras se controla la superficie. Una superficie interior dedicada puede separar estilo y movimiento.

## Referencia nativa y verificación {#native-reference-and-verification}

El press nativo no cambió. Estas grabaciones existentes en inglés muestran su composición por layers; no muestran código Web ni una pantalla compartida de Mavis.

<Clip name="motion-rfc-ios" caption="Simulador iOS 26.2, auditoría existente de Layers en inglés: pulsación real mantenida y liberación conservan una base distinta de 1 junto a layers independientes. Velocidad original; referencia nativa, no un iPhone físico." />
<Clip name="motion-rfc-android" caption="Emulador Android 16 / API 36, auditoría existente de Layers en inglés con pulsaciones reales mediante ADB. Referencia nativa a velocidad original, sin promesa de rendimiento en dispositivo físico." />

Ejecute `npm run web:press:typecheck` y `npm run web:press:test`. Chromium, Firefox y WebKit cubren entrada, composición y limpieza; el gesto real de scroll táctil usa solo CDP de Chromium. Consulte el [informe de verificación y grabación](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-press.md).
