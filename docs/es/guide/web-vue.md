# Movimiento Vue en Web

La [composición portable candidata a la próxima versión](./portable-composition) incorpora equivalentes Web viables y conserva estos contratos nativos publicados. Las incorporaciones no están en RC.12.

**También en RC.7:** [ámbitos, puntero/viewport y configuración continua Vue](./web-lifecycle), además de [geometría de overlays, elementos compartidos, recetas y diagnóstico](./web-interactions). La adopción en Mavis sigue separada.

**Desde RC.7:** [colores, bordes, pintura continua, tamaño real, FLIP y escenas con seek](./web-visual) amplían este runtime. Las APIs Web siguen experimentales; la paridad completa continúa en [#236](https://github.com/rafaelaugustos/jolt/issues/236).

La entrada experimental `@rafaelaugusto/jolt/web/vue` se incluye en **0.1.0-rc.5** y conecta una ref DOM declarada al [runtime Web](./web-runtime). Instala Vue 3.5 por separado. `/vue` conserva su significado NativeScript; `/web` imperativo no instala Vue. Consulta la [instalación](./install#experimental-web-candidate).

<Clip name="web-vue-chromium" :width="720" caption="Chromium 156 en macOS arm64: entrada real de puntero y teclado invierte una salida, presiona la tarjeta, cambia la escala de la aplicación durante la pulsación, sustituye la superficie y completa ocultar/mostrar. Captura del navegador a velocidad original; no mide un dispositivo físico." />

## Una superficie DOM declarada {#declared-surface}

```vue
<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import { useWebMotion } from '@rafaelaugusto/jolt/web/vue'

const visible = ref(true)
const surface = shallowRef<HTMLElement | null>(null)
const motion = useWebMotion(surface, {
  initial: { opacity: 0, y: 24 },
  enter: { keyframes: { opacity: 1, y: 0 }, transition: { duration: 220 } },
  leave: { keyframes: { opacity: 0, y: -12 }, transition: { duration: 160 } },
})
</script>

<template>
  <button @click="visible = !visible">Toggle</button>
  <Transition v-bind="motion.transition" appear>
    <div v-if="visible" ref="surface">Content</div>
  </Transition>
</template>
```

Llama al composable sincrónicamente en `setup`. Crea el runtime bajo demanda para el documento del destino. La importación y el renderizado SSR no necesitan globals del navegador. `animate`, `set`, `press` y `stop` usan la ref DOM montada actual; antes del montaje o después de destruir el scope lanzan un error. `configure` sigue la política Web. Las instancias de componentes, la búsqueda mediante `$el` y las refs genéricas de componentes compuestos quedan fuera del contrato experimental.

El objeto `transition` proporciona `css: false`, entrada, salida y cancelación. Vincúlalo a `Transition` de Vue y conserva hooks de aplicación como `@before-leave` y `@after-leave`. Las recetas usan los mismos keyframes y transiciones del runtime imperativo y deben tener duración finita. El adaptador no añade otro solver ni bucle por frame.

## Ciclo de vida y composición {#lifecycle}

- `initial` se aplica una vez por elemento entrante, tras insertarlo y antes del playback. Reentrar en la misma superficie `v-show` continúa desde el estado actual.
- Una ref `v-if` puede ser nula durante la salida. El elemento permanece montado hasta que termina o se interrumpe su playback actual; una interrupción no puede retenerlo indefinidamente.
- La cancelación de Vue invalida la generación antes de detener el movimiento. Promises antiguas no terminan una nueva salida ni eliminan un elemento que volvió. `v-if` puede crear otra superficie; `v-show` puede reutilizarla.
- Sustituir la ref libera la anterior, excepto durante su salida actual. Destruir el scope cancela tareas, elimina listeners de pulsación y efectos e ignora finalizaciones antiguas.
- Movimiento de aplicación y pulsación comparten contexto: 1.1 × 0.96 = 1.056. Cambiar la base a 1.2 mientras se mantiene pulsado produce 1.152; soltar restaura 1.2. Crea otro binding para el elemento DOM nuevo.
- Los cambios de movimiento reducido siguen el runtime: transforms llegan al destino mientras la opacidad conserva su timeline finita. Se aplican los mismos límites CSS; no compitas por los estilos de movimiento controlados.

El componente/aplicación controla foco, `inert`, `aria-hidden`, activación y restauración del foco al disparador. Usa hooks de Vue; Jolt no mueve el foco ni aporta semántica de accesibilidad. Es una base para Mavis Reveal; la migración y una API de refs portátiles siguen siendo trabajos separados.

## Verificación y límites {#verification}

`npm run web:integration:test` verifica interrupción, controles, sustitución, movimiento reducido, composición de pulsación y desmontajes repetidos en Chromium, Firefox y WebKit. `npm run package:check` instala el tarball real en consumidores imperativo y Vue, verifica declaraciones estrictas, SSR directo/Vite, playback real y bundles nativos de producción.

El [informe de integración](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-integration.md) registra versiones, workloads y límites de regresión. Preparar 100 tarjetas con spring ocupa de forma medible el hilo principal; estos tests no garantizan FPS ni latencia móvil. La prueba de bloqueo exclusiva de Chromium utiliza frames presentados y un trace del navegador, no conteos de rAF.

El comportamiento nativo de `/vue` se conserva. Esta grabación existente es una referencia nativa, no código Web ejecutándose en native:

<Clip name="vue" caption="Demo existente NativeScript Vue en inglés en simulador iOS: JoltTransition elimina y restaura una fila. Referencia de playback nativo; no es dispositivo físico ni pantalla Mavis compartida." />

El mismo lote corrige la presentación de layers finalizados en Android y verifica iOS:

<Clip name="layer-cleanup-android" caption="Emulador Android 16 / API 36, auditoría Layers en inglés iniciada con toque ADB real: quitar feedback durante la liberación restaura la base no unitaria y conserva base en movimiento, otro layer y movimiento reducido. Se consultan valores nativos presentados. Velocidad original; evidencia de corrección en emulador." />
<Clip name="layer-cleanup-ios" caption="Simulador iOS 26.2, auditoría Layers en inglés iniciada con toque XCTest real: los mismos casos de eliminación, composición y movimiento reducido consultan la presentación de Core Animation. Velocidad original; no es iPhone físico." />
