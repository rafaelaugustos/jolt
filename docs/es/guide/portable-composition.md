# Composición portable

Disponible en `0.1.0-rc.12.1`, mediante [PR #428](https://github.com/rafaelaugustos/jolt/pull/428) (#424–#427, #386 y #385). Los contratos nativos existentes comparten definiciones, políticas y ciclo de vida con adaptadores de navegador. Instala paquetes de la misma versión y recompila las apps nativas. Las APIs Web siguen experimentales; la entrega y precisión de sensores en un navegador físico siguen pendientes en #385.

## Recursos retenidos {#lifecycle}

`retain(resource)` y `resource(factory)` conservan recursos hasta release, reset o eliminación, incluso reproducciones terminadas. `release(resource)` destruye solo recursos del scope. La suspensión pausa recursos compatibles y conserva una pausa manual previa; los recursos estáticos retenidos permanecen. `add()` mantiene su ciclo transitorio y es idempotente para recursos ya retenidos por ese scope. Convertir un recurso transitorio en retenido se rechaza: elige su ciclo al adoptarlo. Las factories limpian recursos nuevos si falla la adopción.

`useShape` de Vue utiliza el adaptador SVG existente. `.current` está disponible tras montar; el callback ref también acepta componentes con un único HTMLElement raíz. KeepAlive pausa y conserva el dibujo; desmontarlo realmente o sustituir la ref lo elimina. `{ runtime }` opcional es prestado. `useWebMotion(ref).resource(setup)` ofrece el mismo ciclo retenido; `.use(setup)` sigue recreándolo al activar. `unload: 'pause'` conserva un shape desconectado dentro del mismo documento; `motion.shape` lo elimina por defecto al retirarlo. Release o eliminación explícita del runtime siempre destruye el recurso.

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'
const motion = createWebRuntime(document)
const scope = motion.scope()
const drawing = scope.resource(() =>
  motion.shape(host, {
    d: 'M10 50 L50 10 L90 50 Z',
    viewBox: [0, 0, 100, 100],
    stroke: '#7858db',
    unload: 'pause',
  }),
)
scope.suspend()
scope.resume()
scope.release(drawing)
scope.dispose()
```

```vue
<script setup lang="ts">
import { useShape } from '@rafaelaugusto/jolt/web/vue'
const drawing = useShape({
  d: 'M10 50 L50 10 L90 50 Z',
  viewBox: [0, 0, 100, 100],
  stroke: '#7858db',
})
</script>
<template><div :ref="drawing.ref" style="width: 120px; height: 120px" /></template>
```

<Clip name="composition-lifecycle-web" :width="900" caption="Recursos retenidos: Chromium en macOS: controles reales y reproducción del navegador." />

<Clip name="composition-resources-ios" caption="Recursos retenidos: Simulador iOS 26.2: demo nativa real e interacción XCTest." />

## Coordinación de comportamientos {#behaviors}

Nativo y Web comparten una política de ejecución exclusiva: prioridad, `when`, `blocks`, rechazo/sustitución de igual prioridad y reposo explícito. Una prioridad mayor interrumpe salvo que la acción actual la bloquee; los coordinadores separados siguen siendo independientes. Cada ejecución posee un scope hijo. Usa `wait`, `checkpoint` y `guard` para impedir cambios asíncronos tardíos tras cancelar. Una Promise arbitraria no puede cancelarse por la fuerza. El segundo plano y la pausa manual suspenden la reproducción; terminar/cancelar restaura el reposo, `stop()` cancela sin restaurarlo y eliminar impide nuevas solicitudes. El estado de dominio pertenece a la aplicación.

```ts
const actions = scope.motionBehaviors(
  {
    rest: { priority: -1, run: ({ scope }) => scope.animate(card, { x: 0 }).finished },
    touch: {
      run: async ({ scope, wait }) => {
        await wait(scope.animate(card, { x: -70 }, { duration: 2000 }).finished)
      },
    },
    dress: { priority: 2, run: ({ scope }) => scope.animate(card, { x: 70 }).finished },
    eat: {
      priority: 3,
      blocks: ['touch', 'dress'],
      run: ({ scope }) => scope.animate(card, { scale: [1, 1.2, 1] }).finished,
    },
  },
  { rest: 'rest' },
)
actions.request('touch')
actions.request('dress')
```

<Clip name="composition-behaviors-web" :width="900" caption="Coordinación de comportamientos: Chromium en macOS: controles reales y reproducción del navegador." />

<Clip name="composition-behaviors-ios" caption="Coordinación de comportamientos: Simulador iOS 26.2: demo nativa real e interacción XCTest." />

## Texto con degradado {#gradient-text}

Ambas plataformas admiten 2–8 colores, stops ordenados en 0..1, ángulo horario en grados desde izquierda-derecha y anchura del brillo en (0,1]. Nativo acepta ColorValue; Web acepta cadenas de color CSS. `play()` devuelve una reproducción interrumpible, pausable y cancelable; `stop()` quita el brillo móvil y conserva el relleno estático. Movimiento reducido conserva ese relleno.

El navegador pinta el texto original seleccionable mediante recorte CSS del fondo; admite HTMLElement de texto simple sin elementos hijos. Conserva su nombre accesible y restaura estilos propios sin sobrescribir cambios posteriores de la aplicación. Colores forzados o falta de recorte utilizan texto normal legible y cancelan el brillo decorativo. No combines degradado de fondo y de texto en el mismo destino. Nativo pinta glifos reales; el recorte, coste de repintado y los píxeles del navegador difieren.

```ts
const title = scope.gradientText(heading, {
  colors: ['#7858db', '#197a88'],
  angle: 10,
  sheen: { color: '#ffffffbf', width: 0.3, direction: 'right' },
})
const playback = title.play({ duration: 1800, ease: 'linear' })
title.suspend()
title.resume()
title.stop()
```

<Clip name="composition-text-web" :width="900" caption="Texto con degradado: Chromium en macOS: controles reales y reproducción del navegador." />

<Clip name="composition-text-ios" caption="Texto con degradado: Simulador iOS 26.2: demo nativa real e interacción XCTest." />

## Rigs 2D articulados {#rig}

La definición compartida admite 1–64 partes y `x`, `y`, `scaleX`, `scaleY`, `rotate`: grados para rotación, DIPs nativos o píxeles CSS para traslación. Los pivotes son fracciones de la caja con borde. Los anclajes usan fracciones relativas o unidades lógicas locales (`dip` conserva su nombre nativo en Web). La mezcla es relativa al reposo; pesos con suma mayor que uno se normalizan. La rotación sin límites recorre el camino más corto; los límites restringen las muestras del muelle, incluido overshoot.

Las partes Web deben ser cajas 2D conectadas en la jerarquía DOM directa declarada, con padres posicionados como `offsetParent`; zoom CSS, perspectiva, 3D y propiedades individuales de transformación se rechazan. Los accesorios son hijos directos sin otro propietario en la parte del anclaje. Los transportan las transformaciones de sus padres nativos o DOM. `point()` devuelve coordenadas de la caja con borde del padre raíz; llama a `refresh()` tras cambiar offsets de layout. Redimensionar actualiza los anclajes. `attach` sustituye partes; las poses Web comparten una reproducción, por lo que liberar una parte cancela ese grupo. La limpieza restaura solo canales aún poseídos por el rig. Conserva etiquetas semánticas para imágenes significativas; rigs no proporcionan hit testing ni semántica accesible.

```ts
const character = scope.rig2d(
  {
    parts: {
      body: { rest: { rotate: 0 } },
      hand: {
        parent: 'body',
        pivot: { x: 0.5, y: 0.1 },
        rest: { rotate: 0 },
        rotation: [-70, 70],
      },
    },
    poses: {
      rest: {},
      wave: { hand: { rotate: -55 } },
      reach: { hand: { rotate: 110 } },
    },
    sockets: { grip: { part: 'hand', x: 0.5, y: 0.85, units: 'relative' } },
  },
  { body, hand },
)
character.accessory('grip', flower)
character.to('wave', 'bouncy')
character.blend([
  { pose: 'wave', weight: 0.5 },
  { pose: 'reach', weight: 0.5 },
])
```

<Clip name="composition-rig-web" :width="900" caption="Rigs 2D articulados: Chromium en macOS: controles reales y reproducción del navegador." />

<Clip name="composition-rig-ios" caption="Rigs 2D articulados: Simulador iOS 26.2: demo nativa real e interacción XCTest." />

## Helpers y preferencias de movimiento {#preferences}

La entrada Web reexporta `cubicBezier`, `origamiSpring`, `springs` y `presets` existentes usando el mismo solver. `motion.reducedMotion()` lee la preferencia efectiva del documento/runtime, incluidas configuraciones `user`, `always` y `never`. `onReducedMotion()` observa cambios sin polling ni callback inicial y devuelve una función para cancelar la suscripción. Eliminar el runtime termina la observación.

`useReducedMotion(runtime?)` de Vue devuelve una ref de solo lectura. Sin runtime comienza en false en SSR y se suscribe tras montar; con runtime prestado lee ese runtime. KeepAlive retira la suscripción al desactivar y vuelve a sincronizar al activar. Solo elimina un runtime que haya creado. No existe singleton de preferencias entre solicitudes. Prefiere el observador del runtime cuando la aplicación pueda reemplazar la preferencia del sistema.

```ts
import { cubicBezier, origamiSpring, springs, presets } from '@rafaelaugusto/jolt/web'
const current = motion.reducedMotion()
const unsubscribe = motion.onReducedMotion((reduced) => updatePreference(reduced))
scope.retain(unsubscribe)
scope.animate(
  card,
  { x: [0, 70, 0] },
  { duration: 1200, ease: cubicBezier(0.25, 0.1, 0.25, 1) },
)
// Vue: import { useReducedMotion } from '@rafaelaugusto/jolt/web/vue'
// const reduced = useReducedMotion(motion)
```

<Clip name="composition-preferences-web" :width="900" caption="Helpers y preferencias de movimiento: Chromium en macOS: controles reales y reproducción del navegador." />

<Clip name="composition-text-ios" caption="Helpers y preferencias de movimiento: Simulador iOS 26.2: demo nativa real e interacción XCTest." />

## Sensores vectoriales {#sensors}

Se aceptan los seis nombres canónicos. `rotation` proporciona radianes relativos y quaternion; `acceleration` es aceleración propia con gravedad (m/s², aproximadamente +9,8 en Z con la pantalla hacia arriba); `linearAcceleration` excluye gravedad (m/s²); `gravity` apunta hacia abajo (lineal menos propia); `gyroscope` usa radianes/s con la regla de la mano derecha, mapeados de beta/gamma/alpha. `magneticField` conserva µT pero devuelve `unavailable`, backend `none`, motivo `unsupported-kind`: DeviceMotion no ofrece un vector magnético ni se infiere de la orientación.

Se requiere contexto seguro, soporte del navegador/dispositivo y política de permisos compatible. Solo `requestPermission()` explícito desde una acción del usuario solicita permiso. Disponibilidad exige una muestra finita completa de ese tipo: valores nulos/parciales no se convierten en ceros. API ausente, denegación y timeout sin datos aparecen en `snapshot()`. Las fuentes comparten un listener por evento/documento y solo funcionan con demanda, visibles y sin pausa. Coordenadas de interfaz cambian con la orientación de pantalla; las del dispositivo siguen canónicas. `interval` limita lecturas entregadas (5–1000 ms o `auto`), no la frecuencia del hardware. Timestamps son monotónicos del navegador, no del hardware nativo.

Esta ronda valida renderización real del navegador con **eventos inyectados** y la vista previa nativa en simulador. La entrega real de sensores del navegador y su precisión en un dispositivo físico siguen pendientes en #385. Consulta [Device Orientation and Motion](https://www.w3.org/TR/orientation-event/) y los [límites de Magnetometer](https://www.w3.org/TR/magnetometer/).

```ts
const sensor = scope.sensor('gyroscope', { coordinates: 'interface', interval: 50 })
// Invoke directly from a click/tap handler:
await sensor.requestPermission()
scope.bind(card, { rotate: scope.map(sensor.z, [-Math.PI, Math.PI], [-45, 45]) })
console.log(sensor.snapshot())
```

<Clip name="composition-sensors-web" :width="900" caption="Chromium en macOS: eventos DeviceMotion explícitamente inyectados, pausa/reanudación e indisponibilidad magnética. Sin medición de sensores físicos." />

<Clip name="composition-sensors-ios" caption="Simulador iOS 26.2: vista previa vectorial nativa y ciclo de vida. Los datos de vista previa no demuestran disponibilidad de sensores físicos." />

Las grabaciones son evidencia funcional. No demuestran menor CPU/PSS, precisión del hardware ni renderización independiente de JavaScript. Los [contratos nativos](./native-composition) siguen disponibles; el [informe de validación y reproducción](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/portable-composition.md) registra la aceptación y límites pendientes.
