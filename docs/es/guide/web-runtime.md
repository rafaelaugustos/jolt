# Runtime Web finito

**En desarrollo después de RC.6:** [colores, bordes, pintura continua, tamaño real, FLIP y escenas con seek](./web-visual) amplían este runtime. No están en el paquete RC.6 publicado. La paridad completa sigue en [#236](https://github.com/rafaelaugustos/jolt/issues/236).

Desde **0.1.0-rc.5**, la entrada experimental `@rafaelaugusto/jolt/web` usa el compilador portátil de Jolt y WAAPI directamente sobre elementos HTML, sin depender de Vue, React o NativeScript. Consulta la [instalación](./install#experimental-web-candidate). Mavis completó la migración inicial de press/reveal y el ejemplo compartido de aplicación; la adopción de nuevas capacidades Web continúa [en Mavis](https://github.com/getcortexlabs/mavis-ui/issues/191).

RC.6 incluye [movimiento continuo Web](./web-dynamic), con valores, followers y drag/snap, además de [mapeos numéricos, geometría y scroll vertical](./web-support). Las APIs Web siguen experimentales.

La entrada por puntero y teclado está en [Pulsación en Web](./web-press); la grabación siguiente sigue siendo la referencia del runtime finito.

<Clip name="web-runtime-chromium" :width="720" caption="Chromium 156 en macOS arm64, reproducción y clics reales a velocidad original: movimiento con opacidad, interrupción parcial, escala de la aplicación con contribución de presión, repetición inversa, pausa, seek, reanudación y movimiento reducido. Los botones ejercitan la contribución; el reconocimiento completo de puntero/teclado corresponde a #283." />

## Movimiento compatible {#supported-motion}

`x` e `y` usan píxeles CSS, `rotate` usa grados, `scaleX`/`scaleY` usan factores y `opacity` se limita a 0–1. `scale` se expande a ambos ejes; un eje explícito prevalece. Springs con destino definido, tweens, keyframes numéricos, presets internos/personalizados compatibles, transiciones por propiedad, delay y stagger usan el compilador existente. Las recetas numéricas nativas se comparten sin importar el runtime nativo.

Cada runtime pertenece a un documento. Configuración, presets, tokens de propiedad, efectos y limpieza pertenecen al contexto. Dos contextos no pueden controlar simultáneamente el mismo elemento. La entrada Web puede importarse sin DOM; crear el runtime exige un documento activo con WAAPI. No hay instalación global de driver.

```ts
// Entrada experimental del candidato empaquetado localmente.
import { createWebRuntime } from '@rafaelaugusto/jolt/web'

const motion = createWebRuntime(document)
motion.set(card, { scale: 1.1 })
const move = motion.animate(card, { x: 240, opacity: 1 }, 'snappy')
motion.animate(card, { scale: 0.96 }, { layer: 'press', duration: 120 })
// La escala visual es 1.056. Soltar solo press conserva la escala de la aplicación.
motion.animate(card, { scale: 1 }, { layer: 'press', duration: 120 })
move.pause()
move.progress = 0.5
move.play()
const completed = await move.finished
motion.release(card)
motion.dispose()
```

## Controles, composición y limpieza {#controls-and-cleanup}

Cada llamada controla sus canales lógicos y un reloj de origen. Traslación/rotación se suman; escala/opacidad se multiplican. Un efecto visual compuesto por superficie reproduce el resultado. Sustituir `x` conserva los demás canales y las contribuciones privadas. El handle anterior no recupera canales sustituidos al hacer seek o finalizar. Un fallo de preparación o del presupuesto de keyframes conserva la reproducción anterior.

`progress` abarca toda la timeline finita, incluidos delays y repeticiones. Buscar `1` en pausa permite retroceder; la reproducción termina al reanudarse. `stop()` mantiene los valores muestreados actuales y resuelve `finished` como `false`. La finalización natural conserva los valores finales y resuelve como `true`; una sustitución parcial hace que la llamada anterior resuelva como `false` al terminar sus canales restantes. Los handles terminados permanecen terminados. Efectos y relojes se eliminan al finalizar; los valores finales permanecen hasta que `release()` restaura los estilos inline originales. Se conservan los cambios inline externos al liberar.

Los targets retirados se liberan automáticamente, incluso en shadow roots. Los adapters de framework deben liberar las superficies al terminar su lifecycle. `dispose()` también elimina observers, listeners de preferencias y frames pendientes. Una timeline sin resolver mantiene la pose hasta activarse; `ready` resuelve al activarse o descartarse. La reproducción finita normal no usa un bucle de frames de la biblioteca ni escrituras JavaScript de estilos por frame.

## Tiempo y movimiento reducido {#timing-and-reduced-motion}

La interrupción proyecta el inicio resuelto del reloj de origen sobre el reloj de performance del documento en el instante del comando. Ese timestamp ancla la composición y la nueva reproducción. Posición y velocidad proceden del modelo de origen; los movimientos pausados o pendientes transfieren velocidad cero. Esto evita usar un tick antiguo durante tareas largas. Presentación del navegador y precisión numérica se verifican por separado, incluida una interrupción a 2.000 px/s después de una tarea JavaScript ocupada en WebKit.

`reducedMotion: 'user'` sigue la preferencia activa del navegador. Activarla finaliza los canales de transform en sus valores finales; la opacidad continúa. Desactivarla permite movimientos futuros sin repetir canales terminados. `'always'` y `'never'` reemplazan la preferencia por contexto. `timeScale` afecta a tracks futuras. Las repeticiones finitas normales/inversas aceptan 0–1.000 repeticiones; la reproducción infinita queda fuera de esta etapa. El presupuesto predeterminado es de 6.001 keyframes preparados por track/superficie compuesta, configurable entre 2 y 60.001; superarlo rechaza la transacción.

## Política de superficie y límites {#surface-policy-and-limits}

El runtime controla `transform` y `opacity` de una caja HTML montada y transformable. El orden es `base 2D estática × translate × rotate × scale`, conservando `transform-origin`. No admite transforms CSS individuales, bases 3D, animaciones/transiciones existentes ni estilos de movimiento inline con `!important`. Libere y recree antes de cambios CSS externos; no se monitorizan cambios arbitrarios de hojas de estilo/variables CSS. Use una superficie interna dedicada cuando otro código controle los estilos externos.

Los cambios admitidos de tamaño y pivote 2D conservan ownership con la [API de geometría de RC.6](./web-support#geometry); otros cambios externos siguen exigiendo release/recreación.

Esta guía cubre reproducción finita. Consulta [movimiento continuo](./web-dynamic) para valores, springs y drag/snap, y [soporte Web](./web-support) para mapeos, geometría y scroll vertical. Pinch, propiedades exclusivas del nativo y otros adapters de framework quedan fuera de este alcance Web. Todavía no establece una API estable de referencias portátiles ni completa Mavis. WAAPI por sí sola no demuestra aceleración por compositor ni garantiza FPS.

## Referencia nativa y validación {#native-reference-and-validation}

El comportamiento nativo no cambia. Estas grabaciones nativas revisadas, en inglés, ilustran composición; no muestran el fixture Web ni una pantalla compartida de Mavis ejecutándose de forma nativa.

<Clip name="layers-ios" caption="Simulador iOS, demo nativa Layers existente: movimiento y feedback coexisten. Referencia nativa conservada, no es un dispositivo físico ni el nuevo runtime Web." />

<Clip name="layers-android" caption="Emulador Android, demo nativa Layers existente: movimiento y feedback coexisten. Referencia nativa conservada, no es un dispositivo físico ni el nuevo runtime Web." />

Con Node 22, ejecute `npm run web:runtime:typecheck`, `npm run web:runtime:test` y `npm run web:runtime` después de instalar las dependencias y Chromium/Firefox/WebKit de Playwright. El fixture abre en `http://127.0.0.1:4282`; deténgalo antes de los tests. El [informe de evidencias](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-runtime.md) describe relojes, referencias nativas compartidas, rollback, limpieza y comandos de grabación.

El [adapter Vue DOM opcional](./web-vue) ya ofrece refs declaradas y lifecycle de entrada/salida.
