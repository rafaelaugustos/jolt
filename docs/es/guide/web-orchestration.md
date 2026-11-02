# Orquestación y control Web

Adiciones experimentales disponibles desde **0.1.0-rc.8**, seguidas en #327–#333. Usan las mismas trayectorias portátiles y reglas de planificación que la reproducción nativa. La entrada Web sigue independiente de NativeScript y frameworks; Vue administra el ciclo de vida mediante `motion.use()` y su ámbito hijo.

## Valores y progreso {#values}

`animate(value, destinoOFotogramas, transición)` acepta un valor numérico mutable del mismo contexto. `null` lee el canal actual. La sustitución hereda posición y velocidad; las capas escalares se suman, incluso al alimentar escala. Una capa terminada conserva su destino; detenerla elimina su contribución. `set(value, número)` elimina reproducción y capas; `stop(value)` conserva el valor combinado. Los valores derivados o de otro contexto se rechazan antes de cambiar la propiedad del movimiento.

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'

const motion = createWebRuntime(document)
const scope = motion.scope()
const x = scope.motionValue(0)
scope.bind(card, { x })
const travel = scope.animate(x, [0, 240, 100], { duration: 1200 })
scope.animate(x, 24, { layer: 'accent', duration: 200 })
const progress = scope.playbackProgress(travel)
scope.bind(meter, { scaleX: progress })
travel.pause()
travel.progress = 0.5
travel.play()
// Elimina solo esta contribución aditiva:
motion.stop(x, { layer: 'accent' })
```

`playbackProgress(handle)` es de solo lectura y usa el reloj existente. Pausas, seek, conclusión y cancelación se reflejan en mapas y bindings. Desechar el progreso no detiene la reproducción. Requiere duración finita conocida; una timeline imperativa puede conocerla solo tras activar todos sus participantes. Sin observadores no hay bucle por frame. Los observadores y bindings usan el planificador compartido bajo demanda; no crean una segunda reproducción visual.

<Clip name="web-orchestration-values-chromium" caption="Chromium en macOS: controles reales reproducen fotogramas, añaden/eliminan una capa, pausan, buscan y cambian el destino con spring. El indicador usa playbackProgress; grabación del navegador." />

<Clip name="motion-values-ios" caption="Referencia del simulador iOS: un motion value anima sheet, escala y fondo. Grabación nativa existente reutilizada sin cambiar su comportamiento." />

## Decay y snap {#decay}

`decay(elemento, { x?, y? }, { friction?, snap? })` compila velocidad en píxeles CSS/segundo para WAAPI finita. Friction está entre 0 y 1; un valor mayor recorre más distancia. Snap acepta una lista común o `{ x: [...], y: [...] }`; el destino más cercano a la proyección gana. La velocidad suministrada es explícita. La sustitución mantiene la posición actual y otros canales siguen activos. Use la velocidad medida al soltar el gesto. Pausa, reanudación, seek, stop y movimiento reducido siguen el contrato normal.

<Clip name="web-orchestration-decay-chromium" caption="Chromium en macOS: arrastre y liberación reales, snap proyectado, pausa/reanudación y cancelación. El ejemplo proporciona el input; decay controla la trayectoria posterior." />

<Clip name="orchestration-decay-ios" caption="Referencia del simulador iOS: decay libre y snap nativos. Captura original reutilizada sin el inicio de apertura, conservando la velocidad." />

## Secuencias y timelines imperativas {#groups}

Ambas APIs aceptan posiciones absolutas, `<` para la activación anterior y offsets con signo desde la llegada visual. Los objetivos futuros reciben su primer fotograma absoluto al preparar; null y valores relativos se resuelven al activar. Los offsets negativos necesitan una previsión animate/decay. Las factories ejecutan en JavaScript y devuelven una animación; los errores rechazan la conclusión y cancelan los recursos propios.

```ts
const scene = scope.timeline([
  [card, { x: 240 }, { duration: 1400 }],
  [x, [0, 1], { duration: 1400, at: '<' }],
  { at: 800, run: () => scope.animate(badge, 'fadeIn') },
])
scene.pause()
scene.play()
await scene.finished

const steps = scope.sequence([
  [card, 'fadeInUp'],
  [badge, 'fadeIn', { at: '-100' }],
  () => scope.decay(card, { x: 400 }, { snap: [0, 240] }),
])
// Detiene participantes activos e impide factories futuras:
steps.stop()
```

`sequence()` ofrece orden, superposición y stop. `timeline()` añade tuplas numéricas y factories controlables, pausando participantes y activaciones futuras juntos. Reanuda solo los hijos que pausó. El tiempo oculto no cuenta para la planificación futura; una pausa manual se conserva al volver. Cancelar impide factories pendientes. Los ámbitos cancelan secuencias y pausan timelines al suspender. No hay seek imperativo: use `seekableTimeline()` para escenas declarativas. La duración puede permanecer desconocida o infinita hasta conocer los participantes.

<Clip name="web-orchestration-groups-chromium" caption="Chromium en macOS: la pausa retiene el checkpoint futuro; reanudar respeta el tiempo restante. La segunda ejecución superpone pasos; cancelar elimina trabajo futuro." />

<Clip name="orchestration-timeline-ios" caption="Referencia del simulador iOS: pasos nativos ordenados y superpuestos. Captura real reutilizada sin apertura de la aplicación, a velocidad original." />

<Clip name="controlled-playback-ios" caption="Referencia del simulador iOS: ruta, valor, ripple, progreso y checkpoint nativos se pausan/reanudan juntos. No demuestra rendimiento en un dispositivo físico." />

## Estados y referencias reemplazables {#states}

`current` es el último estado solicitado; `settled`, el último completado correctamente. Las definiciones contienen destinos absolutos y transiciones por objetivo. Los datos inválidos se rechazan antes de cambiar ownership. La sustitución hereda movimiento; los canales omitidos conservan su valor. `attach()` o un callback estable de `ref(nombre)` cambia la superficie: el hijo anterior se detiene, el nuevo parte de su presentación actual y la conclusión lo espera. Un estado ya terminado se aplica inmediatamente a la nueva superficie. `null` desconecta; los objetivos ausentes se omiten. Otros owners sobreviven a la limpieza.

```ts
const states = scope.motionStates(
  { card, badge: null as HTMLElement | null },
  {
    idle: { card: { x: 0, scale: 1 }, badge: { opacity: 0 } },
    active: { card: { x: 240, scale: 1.1 }, badge: { opacity: 1 } },
  },
  { transition: { duration: 600, badge: { duration: 180 } } },
)
const transition = states.to('active')
states.attach('badge', mountedBadge)
states.attach('card', replacementCard)
await transition.finished
// En setup de Vue, cree los recursos en motion.use((scope, element) => { ... }).
// Desmontaje definitivo:
scope.dispose()
```

<Clip name="web-orchestration-states-chromium" caption="Chromium en macOS: interrumpe con error, pausa, cambia el elemento del card, reanuda y termina. El nuevo elemento participa en la conclusión del estado." />

<Clip name="motion-controllers-ios" caption="Referencia del simulador iOS: estados de subida/error/reintento/éxito, controles y desmontaje/remontaje. Grabación existente en inglés reutilizada para el contrato nativo equivalente." />

## Validación e integración {#validation}

Ejecute `npm run web:orchestration:test` para Chromium, Firefox y WebKit, y `npm run web:orchestration` para la demo (`?demo=values`, `decay`, `groups`, `states` o `stroke`). Los consumidores del tarball imperativo/Vue ejercitan las siete APIs, SSR y bundles nativos. Los vídeos muestran comportamiento, no aceleración garantizada ni FPS físicos. Mavis tiene una integración separada; las recetas compartidas conservan su intención independiente de plataforma.

## Dibujo SVG controlado {#svg}

`drawPath(geometríaSvg, { progress? })` crea un controlador con ownership (#333). `animate()` acepta destino normalizado o fotogramas y devuelve pausa, reanudación, seek y stop finitos. Anime hacia `0` para borrar o invertir el dibujo en curso, heredando posición y velocidad. `playback.progress` es progreso temporal; `drawing.snapshot().progress` es la fracción visible del trazo. La limpieza de un handle antiguo conserva el nuevo dibujo.

```ts
const drawing = scope.drawPath(connectionPath, { progress: 0 })
const playback = drawing.animate(1, {
  duration: 1100,
  ease: [0.16, 1, 0.3, 1],
})
playback.pause()
playback.progress = 0.5
playback.play()
const reverse = drawing.animate(0, 'snappy')
await reverse.finished
```

El driver mide unidades SVG y respeta `pathLength`, sin longitud fija ni porcentajes CSS usados como progreso. WAAPI reproduce la trayectoria preparada; observar progreso usa el planificador compartido. El stroke puede requerir pintura del navegador, sin garantía de aceleración por compositor. Consulte el [modelo de guiones SVG](https://www.w3.org/TR/SVG2/painting.html#StrokeDashing).

Use un contorno continuo por dibujo. Paths, líneas, polilíneas, polígonos, círculos, elipses y rectángulos usan geometría medida; separe contornos compuestos en objetivos distintos. Longitud cero termina inmediatamente y permanece invisible. Los destinos están en 0–1 y el overshoot visual queda limitado. Repeticiones finitas y presupuestos de fotogramas siguen Web; esta API no transforma `d` por morph. El validador conserva los límites nativos de 20.000 caracteres y 256 comandos normalizados.

El controlador posee dasharray, dashoffset y opacidad del stroke hasta desecharlo, restaurando estilos originales y conservando cambios inline externos posteriores. Fill, transform, input y accesibilidad pertenecen al host. Elimine animaciones CSS que compitan en esos canales. Se observan atributos geométricos y resize; `refresh()` vuelve a medir sin reiniciar el tiempo normalizado. Las actualizaciones explícitas inválidas se rechazan; un observer que detecta geometría inválida desecha el dibujo de forma segura. Eliminación, shadow roots, teardown y movimiento reducido liberan o completan el trabajo correspondiente.

Lume conserva `vEnter`, `useContentTransition`, `useListLayout` y `useConnectionMotion` para Vue y coreografía. Solo el dibujo SVG manual corresponde a este driver. La altura animada de Reveal sigue siendo adopción en Mavis de la animación de tamaño existente, no física ausente en Jolt.

<Clip name="web-orchestration-stroke-chromium" caption="Chromium en macOS: controles reales dibujan tres conexiones SVG, pausan, buscan, cambian geometría, invierten en curso y activan movimiento reducido. Tiempo original, sin imágenes fabricadas." />

<Clip name="shapes-ios" caption="Referencia del simulador iOS: dibujo nativo real con pausa/reanudación y movimiento reducido, junto al morph nativo. Grabación existente en inglés; esta API Web cubre stroke, no morph." />
