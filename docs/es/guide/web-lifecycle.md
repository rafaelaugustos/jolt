# Ciclo de vida e interacción Web

Nuevo, sin publicar: [montaje Vue/Nuxt, entradas por identidad y scroll horizontal LTR/RTL](./web-collections).

**Disponible desde 0.1.0-rc.7.** Las issues #314–#317 añaden ámbitos hijos, seguimiento del puntero, entrada en viewport y configuración continua en Vue al runtime experimental `/web`. Reutilizan valores, springs, reproducción y scheduler. [Overlays, elementos compartidos y recetas](./web-interactions) usan la misma propiedad de recursos.

## Recursos de una interacción {#scopes}

```ts
const owner = runtime.scope()
const input = owner.motionValue(0)
const spring = owner.springValue(input)
owner.bind(card, { x: spring, rotate: owner.map(spring, [0, 100], [0, 8]) })
input.set(100)
owner.dispose()
```

Las factories adoptan sus resultados. `add(handle)` adopta un recurso existente una vez; `borrow(handle)` deja su ciclo de vida al propietario original. Pasar una fuente a `springValue`, `map` o `bind` no transfiere su propiedad. `map()` posee el mapeo numérico/de color resultante y `subscribe()` solo la suscripción. Un recurso no puede pertenecer a dos ámbitos del mismo runtime. El descarte termina sus handles, bindings y ámbitos hijos, preservando fuentes prestadas, el runtime, press independiente y nuevos propietarios de canales. No llama a `runtime.release(target)`.

`scope(setup)` y `use(setup)` revierten recursos creados mediante el ámbito recibido si falla la configuración síncrona. Espere los datos antes de configurar. Las animaciones terminadas salen del recuento. `reset()` limpia y permite reutilizar; `dispose()` es permanente e idempotente. Registrar tras el descarte lanza error; el llamador sigue siendo responsable de un recurso externo rechazado por `add()`. El cleanup intenta todos los recursos aunque alguno falle.

`suspend()` pausa handles/followers activos, conserva inputs numéricos y mapeos creados por el ámbito y suspende controllers compatibles. No reanuda handles ya pausados por la aplicación. Recursos sin playback, como bindings o press directos, se descartan. Use una factory para recrearlos en `resume()`:

```ts
owner.use((active) => {
  active.bind(card, { x: spring })
  active.observeGeometry(card)
  active.press(card)
})
```

El runtime conserva el estado de reposo hasta que el host libera la superficie. Descartar un ámbito no elimina contenido ni restaura CSS de otro propietario. El scheduler mantiene su política de documento oculto. No reinicie manualmente recursos mientras su ámbito esté suspendido.

<Clip name="web-lifecycle-scopes-chromium" :width="900" caption="Chromium en macOS arm64: controles reales cambian dos springs, descartan el primer propietario y mantienen activo el segundo. Press del host sigue disponible. Velocidad original." />

## Seguir una región de puntero {#pointer}

```ts
const follow = owner.pointerFollow(region, {
  range: { x: [-90, 90], y: [-45, 45] },
  spring: { stiffness: 150, damping: 18 },
})
owner.bind(icon, { x: follow.x, y: follow.y })
owner.press(icon)
owner.animate(icon, 'pulse')
```

Use una región estable separada de la superficie animada. Las coordenadas predeterminadas son `[-1, 1]` desde el centro; `range` define los límites de salida. `coordinates: 'pixels'` usa píxeles CSS de la viewport desde el centro, limitados por el range indicado. `axis`, `rest`, `spring: false` y `disabled` son explícitos. Reposo predeterminado cero, dentro de los límites. `x`/`y` son salidas de solo lectura; `owner.map()` permite rotación, escala o color.

Ratón y lápiz en hover actualizan input sin captura ni bloqueo de acciones predeterminadas. Toque y contacto del lápiz no simulan hover. Salir/cancelar vuelve al reposo; blur, documento oculto, superficie disabled/inert y movimiento reducido estabilizan inmediatamente. Restaurar movimiento espera input nuevo. El controller ofrece `update({ disabled })`, `refresh()`, `suspend()`, `resume()` y `dispose()`.

La geometría se almacena y se invalida por resize, scroll capturado, cambios de class/style en ancestros, cambios DOM de layout y fuentes. Use `refresh()` para cambios no observados. No se lee layout en cada evento de puntero. Se aceptan traslación y escala positiva alineadas con los ejes; rotación, skew, reflexión y perspectiva se rechazan con instrucciones para usar un wrapper estable. Animar la propia región continuamente no ofrece coordenadas estables. La top layer delimita los ancestros que afectan al renderizado.

<Clip name="web-lifecycle-pointer-chromium" :width="900" caption="Chromium en macOS arm64: puntero real conduce una spring con press/pulse independientes, movimiento reducido, reinicio con input nuevo y descarte. No mide latencia en dispositivo físico." />

## Entrada en viewport {#viewport}

```ts
const entrance = owner.viewportEnter(cards, {
  root: scroller,
  threshold: 0.2,
  rootMargin: '0px',
  once: false,
  keyframes: { opacity: [0, 1], y: [24, 0] },
  transition: { duration: 400, stagger: 80 },
})
```

Por defecto ejecuta `fadeInUp` una vez. El grupo es fijo, con identidades únicas; stagger mantiene el orden original aunque las observaciones lleguen por separado. Cambiar el grupo requiere recrear su controller. `root`, `rootMargin`, `threshold`, `once` y `disabled` configuran la observación. Se reutilizan presets, keyframes, transiciones spring/tween y delays, sin timers de aplicación.

No se oculta contenido antes del setup ni durante SSR. Sin IntersectionObserver permanece legible. Movimiento reducido omite la entrada decorativa y termina los canales aún propios, incluida opacidad; no sobrescribe nuevas decisiones de visibilidad. Salir durante playback cancela trabajo pendiente y termina solo canales todavía propios. Los nuevos propietarios sobreviven. El transform de entrada cruzando su propio umbral no cuenta como salida por scroll; scroll/resize/layout reales y `refresh()` invalidan esa protección.

Observaciones únicas terminadas se desconectan; el modo repetido se rearma tras salir. Eliminación, descarte, disabled, documento oculto y suspensión invalidan callbacks pendientes. Reactivar observa la geometría actual. Jolt no cambia foco, tabulación, navegación ni visibilidad de la aplicación. CSS animado concurrente requiere wrapper separado o propietario explícito.

<Clip name="web-lifecycle-viewport-chromium" :width="900" caption="Chromium en macOS arm64: scroll real activa entradas ordenadas, reentrada, eliminación y movimiento reducido. El observer no exige CSS que mantenga oculto el contenido." />

## Configuración continua en Vue {#vue}

```ts
import { shallowRef } from 'vue'
import { useWebMotion } from '@rafaelaugusto/jolt/web/vue'

const target = shallowRef<HTMLElement | null>(null)
const motion = useWebMotion(target)
motion.use((scope, element) => {
  const pointer = scope.pointerFollow(element.parentElement!)
  scope.bind(element, { x: scope.map(pointer.x, [-1, 1], [-40, 40]) })
  scope.observeGeometry(element)
  scope.press(element)
})
```

Llame a `useWebMotion` durante setup. `use()` registra configuración síncrona sin DOM antes del montaje. Recibe todas las factories, incluyendo valores, bindings, geometría/scroll, puntero/viewport y shared layout. Se ejecuta una vez para la ref montada; limpia en null, sustitución o desactivación y se repite al activar KeepAlive. El estado creado dentro se recrea: conserve fuera el estado persistente de la aplicación. El removedor termina solo esa configuración.

Las escrituras visuales no requieren render de Vue por frame. Suscríbase explícitamente para indicadores reactivos. Enter/leave finitos conservan su contrato: un leave puede retener la superficie tras ref null, mientras el input continuo se desconecta inmediatamente. Animación/set/press/layout imperativos requieren ref montada.

Para una superficie declarada por el host, use `useWebMotion(target, { runtime: hostRuntime })`. El host proporciona ref y runtime compatibles, sin buscar `$el` ni crear otro contexto para el elemento. El adapter descarta sus recursos, no el runtime prestado ni press del host. Su `stop()` afecta solo handles finitos propios; el cleanup de `use()` controla recursos continuos. Configure el runtime mediante el host. `WebAnimation.stop(properties, { layer })` cancela canales seleccionados todavía propios.

Imports y setup de servidor no agendan trabajo de browser ni crean estado global de aplicación. `/vue` nativo conserva su contrato. Mavis adapta su superficie portátil por separado.

<Clip name="web-lifecycle-vue-chromium" :width="900" caption="Chromium en macOS arm64: controles Vue cambian una spring, ejecutan pulse, desactivan/reactivan KeepAlive, reemplazan la ref y desmontan. Sin render Vue por frame." />

## Referencias nativas y verificación {#verification}

Estas demos existentes muestran springs, ciclo de vida y entradas nativas, no APIs de puntero o IntersectionObserver del browser.

<Clip name="live-springs-ios" caption="Demo NativeScript existente en inglés, simulador iOS: springs persistentes siguen nuevos destinos. Referencia nativa, no hover Web ni dispositivo físico." />
<Clip name="motion-controllers-ios" caption="Demo existente en inglés, simulador iOS: estados, ámbitos y desmontaje/montaje. Referencia de ciclo de vida nativo, sin medición física." />
<Clip name="vue-lifecycle-reference-ios" caption="Extracto de la demo NativeScript Vue existente en inglés, simulador iOS: entrada y eliminación de filas. Inicio omitido, tiempo original. Referencia nativa, no observación de viewport Web." />

Ejecute `npm run web:lifecycle:test`, `npm run web:lifecycle:typecheck`, `npm run package:check`, `npm run docs:check-media` y `npm run docs:build`. El [informe](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-lifecycle.md) identifica engines y reproducción. Pruebas y vídeos no demuestran aceleración universal, FPS móvil ni latencia hasta la pantalla.
