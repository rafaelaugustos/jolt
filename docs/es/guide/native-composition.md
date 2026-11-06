# Escenas nativas y ciclo de vida de recursos

API en desarrollo: estas incorporaciones no están en la versión publicada `0.1.0-rc.11`. Usa una build de la rama de implementación hasta que se publique una versión que las incluya.

Estas APIs componen movimiento nativo en iOS y Android: dibujos retenidos, prioridades de comportamiento, partes articuladas, texto con gradiente y efectos con nombre en timelines. Son entradas nativas; esta entrega no añade un contrato Web equivalente. Las reglas, los assets y los objetos de SDK siguen perteneciendo a la aplicación. Consulta la base en [scopes y estados visuales](./motion-controllers).

## Conservar el recurso y pausar su movimiento {#resources}

`scope.resource(factory)` crea y retiene un recurso; `scope.retain(resource)` adopta uno existente. Ambos conservan su propiedad hasta `release(resource)`, `reset()` o `dispose()`, aunque termine la animación. Aceptan funciones de limpieza u objetos con `dispose()` o `stop()`. Un recurso no puede pertenecer a dos scopes. Retener de nuevo el mismo objeto es idempotente; volver a llamar a la factory crea otro recurso.

| Recurso                              | Suspensión                                                        | Destrucción final                                 |
| ------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------- |
| Shape o texto con gradiente retenido | Conserva el dibujo y pausa la animación activa                    | Elimina pintura nativa y listeners                |
| Controlador retenido con playback    | Llama a `pause()`; reanuda solo lo pausado por el scope           | Llama a `dispose()` o `stop()`                    |
| Propiedad nativa retenida            | Conserva el adaptador; no pausa animaciones/bindings no adoptados | Destruye el adaptador, no el objeto SDK de la app |
| `scope.add(animation)`               | Pausa playback y deja de retener handles completados              | Detiene el trabajo restante                       |
| `scope.use(factory)`                 | Elimina la suscripción y la recrea al reanudar                    | Elimina la suscripción                            |

La retención prefiere `suspend()/resume()` si existe ese par; si no, usa `pause()/play()`. Los recursos estáticos sin esos métodos permanecen retenidos. La pausa manual sobrevive al paso por background. Los contratos anteriores de `add()` y `use()` se conservan; retener un objeto ya adoptado con otra duración de vida lanza un error.

`useShape()` vincula un callback ref al desmontaje real de Vue. Refs repetidas no duplican recursos; sustituir la vista libera el dibujo anterior. KeepAlive suspende playback al desactivarse. Su valor predeterminado es `unload: 'pause'`; `shape()` imperativo mantiene `unload: 'stop'` salvo elección explícita. El dibujo puede seguir visible mientras está pausado.

Para propiedades nativas, retén el adaptador, adopta su animación y registra los bindings por separado. El segundo ejemplo requiere un uniform SceneKit declarado e inicializado; ese adaptador solo existe en iOS. El valor fuente y el objeto SDK pertenecen a la app. Destruye el scope antes del destino nativo.

```vue
<script setup lang="ts">
import { useShape } from '@rafaelaugusto/jolt/vue'

const drawing = useShape({
  d: 'M10 50 L50 10 L90 50',
  viewBox: [0, 0, 100, 100],
  stroke: '#8B5CF6',
  strokeWidth: 3,
})
function replay() {
  drawing.current?.animate({ strokeEnd: [0, 1] }, { duration: 900 })
}
</script>

<template>
  <GridLayout :ref="drawing.ref" width="160" height="160" @tap="replay" />
</template>
```

```ts
import { motionScope } from '@rafaelaugusto/jolt'
import { sceneKitUniform } from '@rafaelaugusto/jolt/native'

const scope = motionScope()
const focus = scope.resource(() =>
  sceneKitUniform(material, 'focus', {
    type: 'float',
    range: [0, 1],
    units: ['fraction'],
    motion: 'appearance',
  }),
)
scope.add(focus.animate(1, { duration: 800 }))
// For a binding instead: scope.use(() => focus.bind(applicationOwnedValue, p => p))
// Dispose the scope before destroying the application's native target.
```

<Clip name="native-resources-ios" caption="Simulador iOS 26.2: pausa, reanudación, caché Vue KeepAlive y desmontaje/remontaje real. Los contadores separan vida del recurso y playback." />
<Clip name="native-resources-android" caption="ASUS ZenFone 3 físico, Android 8: el dibujo permanece pausado, sobrevive a la caché y se destruye al desmontar. Toques ADB reales; no mide rendimiento." />

## Prioridades e interrupción {#behaviors}

`motionBehaviors()` coordina una línea de interacción exclusiva. Una prioridad mayor interrumpe; las iguales se rechazan salvo que el comportamiento solicitado declare `equal: 'replace'`. `blocks` excluye solicitudes por nombre sin importar la prioridad; `when` evalúa condiciones de la aplicación antes de cambiar la propiedad. Los coordinadores separados siguen siendo independientes.

Cada ejecución tiene un scope privado. La interrupción lo destruye antes de iniciar la sustituta, por lo que la transición nativa parte de la presentación actual. `wait()` comprueba la identidad después del await y retiene la continuación durante pausa manual/background. Úsalo en cada paso esperado; usa `checkpoint()` después de un await externo y `guard(callback)` para callbacks tardíos. No pueden deshacer mutaciones arbitrarias de la app ni abortar una petición externa.

Los resultados son `completed`, `interrupted`, `cancelled`, `failed` o `blocked`. `cancel()` restaura el reposo declarado; `stop()` cancela sin restaurarlo y `dispose()` impide nuevas ejecuciones. El reposo vuelve a empezar tras completar, cancelar o fallar; las acciones interrumpidas no se reanudan implícitamente. `pause()/play()` controlan la pausa. Los guards pueden lanzar errores síncronos; los fallos de ejecución aparecen en el resultado y en `onError`. Retén el controlador en un scope para vincularlo a la vida del componente.

```ts
import { motionBehaviors } from '@rafaelaugusto/jolt'

const behavior = motionBehaviors(
  {
    rest: {
      priority: -1,
      run: async ({ scope, wait }) => {
        await wait(scope.animate(card, { x: 0, rotate: 0 }, 'smooth'))
      },
    },
    touch: {
      priority: 1,
      run: async ({ scope, wait }) => {
        await wait(scope.animate(card, { rotate: -15 }, { duration: 900 }))
      },
    },
    dress: {
      priority: 2,
      run: async ({ scope, wait }) => {
        await wait(scope.animate(card, { x: 60 }, { duration: 900 }))
      },
    },
    eat: {
      priority: 3,
      blocks: ['touch', 'dress'],
      run: async ({ scope, wait }) => {
        await wait(scope.animate(card, { rotate: 15 }, { duration: 900 }))
      },
    },
  },
  { rest: 'rest' },
)

const run = behavior.request('touch')
behavior.request('dress')
const result = await run.finished // { status: 'interrupted' }
```

<Clip name="native-behaviors-ios" caption="Simulador iOS: vestir interrumpe caricia, comer bloquea vestir y la finalización restaura reposo. La misma coordinación anima personaje y confirmación de interfaz." />
<Clip name="native-behaviors-android" caption="Android físico: toques reales interrumpen y bloquean acciones por prioridad y restauran reposo. Los nombres de comportamiento pertenecen a la app." />

## Partes articuladas y puntos de unión {#rig}

Importa `rig2d` desde la entrada opcional `/rig`. La app proporciona vistas nativas con la jerarquía directa padre/hijo declarada; Jolt no cambia sus padres. Las definiciones contienen partes, poses y sockets, sin assets ni refs de framework. Se aceptan hasta 64 partes; ese límite de validación no garantiza rendimiento en cualquier dispositivo.

Los transforms son `x` e `y` en DIPs, `rotate` en grados y `scaleX/scaleY` como multiplicadores. Los pivotes son fracciones del tamaño nativo. Los sockets usan DIPs locales o fracciones con `units: 'relative'`; el accesorio debe ser hijo directo de su parte. Los transforms nativos del padre mueven el accesorio sin observador JavaScript por frame. `point(name)` muestrea coordenadas relativas al padre de la raíz y exige ancestros con layout; no es un binding continuo. Solo se modelan transforms 2D, sin perspectiva, skew, deformación de malla o IK.

Los pesos no negativos mezclan desplazamientos desde el reposo de cada canal. Los canales omitidos usan reposo; las sumas superiores a uno se normalizan por canal. Las rotaciones sin límites usan el menor desplazamiento angular; las limitadas restringen todas las muestras, incluido el overshoot de springs. Solo se controlan canales declarados en reposo/poses. Las nuevas mezclas parten de la presentación actual.

`attach()` valida propiedad y jerarquía antes de sustituir partes. `accessory(name, null)` separa el accesorio. La destrucción restaura transforms todavía propios del rig sin cancelar nuevos propietarios externos. `pause()/play()/stop()/dispose()` controlan su vida; reanuda antes de solicitar otra pose tras una pausa manual. La misma API sirve para personajes e ilustraciones articuladas comunes.

```ts
import { rig2d } from '@rafaelaugusto/jolt/rig'

const rig = rig2d(
  {
    parts: {
      body: { rest: { rotate: 0 } },
      hand: { parent: 'body', pivot: { x: 0.5, y: 0.1 }, rotation: [-70, 70] },
    },
    poses: {
      rest: {},
      wave: { hand: { rotate: -55 } },
      reach: { body: { rotate: 12 }, hand: { rotate: 110 } },
    },
    sockets: { grip: { part: 'hand', x: 0.5, y: 0.85, units: 'relative' } },
  },
  { body, hand },
)
rig.accessory('grip', flower)
rig.to('wave', 'smooth')
rig.blend([
  { pose: 'wave', weight: 0.3 },
  { pose: 'reach', weight: 0.7 },
])
```

<Clip name="native-rig-ios" caption="Simulador iOS: tres poses, mezcla interrumpida, flor unida a la mano y límite de rotación. Una lámpara usa la misma API articulada." />
<Clip name="native-rig-android" caption="Android físico: transforms del padre transportan la flor entre cambios rápidos de pose; el alcance respeta el límite angular. Sin actualizar sockets desde JavaScript por frame." />

## Letras con gradiente y luz en movimiento {#text}

`gradientText(label, options)` conserva el Label nativo y su texto accesible. La pintura decorativa no añade otro nodo de texto ni intercepta entrada. Acepta 2–8 colores, stops ordenados en 0–1, ángulo de gradiente horario y color/anchura del brillo. La anchura es una fracción en (0, 1]. `sheen.direction` usa `right` por defecto; `left` mueve el brillo de derecha a izquierda. Reconstruye Android para instalar el helper nativo; actualizar solo JavaScript no basta.

`play()` devuelve un handle nativo con seek; repeats/reverse de la transición controlan pasadas repetidas. `stop()` elimina la luz móvil y conserva el gradiente estático. `suspend()/resume()` conservan playback activo. `dispose()` elimina la pintura y restaura el color original salvo que la app lo haya sustituido. Movimiento reducido suprime la luz móvil y conserva el relleno legible.

Cambiar texto, fuente, layout o alineación invalida los glifos almacenados. Multilínea y RTL siguen al Label nativo; los emojis se convierten en siluetas con gradiente sin conservar sus colores. No se admiten spans formateados: `formattedText` inicial se rechaza; cambiar a él libera la pintura. `refresh()` solicita invalidación después de un cambio externo de estilo nativo.

La máscara admite 4.194.304 píxeles: Android usa un bitmap alfa; iOS limita la escala de rasterización y rechaza superficies excesivas. `snapshot().maskBytes` estima la máscara, no la memoria GPU total ni el PSS. Las comprobaciones de layout reutilizan máscaras sin cambios; mover la luz no regenera glifos en cada frame.

```ts
import { gradientText, motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
const title = scope.resource(() =>
  gradientText(label, {
    colors: ['#7C3AED', '#DB2777', '#F59E0B'],
    angle: 0,
    sheen: { color: '#FFFFFFFF', width: 0.35 },
  }),
)
const light = title.play({ duration: 1800, ease: 'easeInOut' })
light.pause()
light.play()
```

<Clip name="native-text-ios" caption="Simulador iOS: gradiente en glifos, brillo móvil, sustitución de texto latino/árabe, pausa y movimiento reducido. El Label original conserva el texto accesible." />
<Clip name="native-text-android" caption="Android 8 físico: brillo recortado por glifos y pausado en su posición; movimiento reducido conserva el gradiente. Efecto distinto del shimmer de placeholders." />

## Efectos con nombre en la timeline {#cues}

`withTimelineCues(playback, cues, options)` envuelve un reloj Jolt existente. Cada cue tiene nombre único, posición en milisegundos lógicos y callback que devuelve un handle o limpieza bajo su propiedad. Los efectos en la misma posición respetan el orden de declaración. Audio puede usar un adaptador de la app con stop/dispose; esta API no añade un motor de audio.

Los callbacks ejecutan JavaScript en los puntos marcados, usando el reloj nativo, sin polling por frame. No pueden ejecutarse mientras JavaScript esté bloqueado. `late: 'skip'` descarta por defecto eventos con más de 50 milisegundos lógicos de retraso; elige `tolerance` o `late: 'catch-up'` explícitamente. `lateBy` expresa retraso de entrega relativo al reloj, no latencia de presentación, audio o haptic. `configure({ timeScale })` escala los puntos con el reloj visual. Movimiento reducido suprime cues.

Pausar retiene puntos pendientes y efectos con playback, incluidos los que continúan tras terminar la animación visual. Stop/dispose cancela visuales, puntos y efectos juntos. La finalización espera las promises finitas de efectos devueltos; los adaptadores deben resolver su promise al detenerse. Seek no dispara puntos cruzados, cancela efectos activos y rearma puntos futuros al retroceder.

`repeat: { every, count, reverse }` declara pasadas finitas explícitas; no se infieren repeats de tracks visuales. Límites: 1.024 nombres, 1.024 pasadas por cue y 4.096 ocurrencias totales. Los errores de efectos van a `onError` sin abortar el playback visual.

```ts
import { animate, motionScope, withTimelineCues } from '@rafaelaugusto/jolt'

const scope = motionScope()
const scene = scope.add(
  withTimelineCues(
    animate(ball, { x: [-100, 100] }, { duration: 2400, ease: 'linear' }),
    [
      {
        name: 'impact',
        at: 1200,
        effect: () =>
          animate(
            star,
            { scale: [0.2, 1.6], opacity: [1, 0] },
            { duration: 650, haptic: { style: 'light', times: [0.001] } },
          ),
      },
    ],
  ),
)
scene.pause()
scene.play()
scene.dispose()
```

<Clip name="native-cues-ios" caption="Simulador iOS: cancelar antes del impacto, repetir partículas/brillo y pausar antes del punto marcado. El simulador no demuestra vibración física." />
<Clip name="native-cues-android" caption="Android físico: cancelar impide el impacto pendiente; pausa y reanudación conservan el reloj visual. El vídeo no transmite ni mide el inicio de la vibración." />

## Validación y límites {#validation}

Las grabaciones muestran interacción nativa real en ASUS ZenFone 3 (Android 8) y un simulador iPhone 17 Pro (iOS 26.2). Son evidencia funcional, no una comparación CPU/PSS. Consulta el [informe de validación](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/native-composition.md) para reproducción, ciclos de vida repetidos y medidas del reloj. La ejecución nativa no elimina la contención del hilo principal de NativeScript; estas APIs no introducen un backend general de RenderThread.
