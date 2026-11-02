# Colores, layout y escenas Web

**Candidato en desarrollo posterior a RC.6**, seguido en #308–#313. Estas funciones no están en el paquete RC.6 publicado. Amplían `/web` experimental sin depender de un framework o NativeScript. La [paridad funcional completa](https://github.com/rafaelaugustos/jolt/issues/236) sigue siendo el objetivo general; este lote no cubre todas las APIs nativas.

## Colores, bordes y bindings continuos {#paint}

La reproducción finita acepta `backgroundColor`, `color`, `borderColor` y sus cuatro lados; `borderWidth` y sus cuatro anchos; `borderRadius`, cuatro esquinas independientes y los radios `X`/`Y` de cada esquina. Las propiedades explícitas prevalecen sobre abreviaturas. Los números representan píxeles CSS para longitudes y ARGB empaquetado para colores. Las cadenas CSS se resuelven contra el destino al preparar la llamada; las esquinas admiten sintaxis elíptica y porcentajes.

Los colores usan el compilador compartido de OKLab con alfa premultiplicada y salida sRGB. Anchos y radios no son negativos y respetan geometría y estilo del borde. Jolt no muestra un borde con `border-style: none`, reemplaza imágenes de fondo ni cambia el contorno de foco. Cada canal de pintura se reemplaza independientemente; las capas aditivas/multiplicativas mantienen el contrato de transform/opacidad.

`.to()` también acepta cadenas de color y devuelve `WebColorValue` de solo lectura. Aplica `springValue()` antes del mapa; los colores no tienen velocidad escalar. `bind()` combina estos nodos y decoraciones numéricas en el scheduler existente bajo demanda. Descartar la fuente libera dependientes; descartar el binding conserva la pintura actual. Un handle antiguo no sobrescribe al nuevo.

Los mapas de color son independientes del destino: pasa colores resueltos, no variables CSS del elemento ni `currentColor`. El `animate()` finito resuelve esas expresiones contra su destino.

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'
const motion = createWebRuntime(document)
motion.animate(
  card,
  {
    backgroundColor: '#d8f381',
    color: '#15291e',
    borderTopColor: '#dc672a',
    borderRightWidth: 8,
    borderRadius: '42px 12px 56px 20px / 16px 32px 24px 48px',
  },
  'snappy',
)

const input = motion.motionValue(0)
const follower = motion.springValue(input)
const paint = motion.bind(card, {
  backgroundColor: follower.to([0, 1], ['#7655e8', '#ed8b46']),
  borderRadius: follower.to([0, 1], [12, 64]),
})
input.set(1)
```

<Clip name="web-paint-chromium" :width="900" caption="Chromium 156, macOS arm64: clics, presión mantenida y teclado en el control de rango muestran colores, bordes y esquinas finitas y bindings continuos. Tiempo original; sin afirmar rendimiento en dispositivos móviles." />

## Tamaño real y layout visual {#layout}

`animateSize()` cambia `width` y `height` reales, por separado o juntos, con destinos numéricos y `auto`. El texto se redistribuye y los vecinos participan en layout normal. Box sizing, min/max, Grid y Flexbox siguen determinando la asignación. En Flexbox se interpola el tamaño CSS preferido para no aplicar grow/shrink dos veces. Los destinos intrínsecos se vuelven a medir mientras están activos; contenido nuevo puede prolongar la operación. La finalización restaura `auto` semántico o la declaración numérica solicitada.

La mutación es síncrona tras la captura; las microtareas del framework se ejecutan antes de medir. Carga datos primero. Mutaciones asíncronas, repeticiones y seek no corresponden a un destino intrínseco cambiante. El reemplazo hereda valor/velocidad en ejes compartidos, restaura ejes omitidos y resuelve la operación anterior como `false`. Pause elimina frames de tamaño. `stop()` conserva el tamaño; `stop({ restore: true })`, retirada y descarte restauran declaraciones todavía propias sin deshacer contenido ni escrituras externas nuevas.

`animateLayout()` captura hijos HTMLElement directos por identidad, aplica la mutación y mide en el siguiente frame. Anima posición y tamaño inversos mediante contribuciones privadas, preservando aplicación/press, transforms 2D estáticos y orígenes. Los nuevos hijos pueden aparecer con fade; los retirados salen inmediatamente. `size: false` desactiva inversión de tamaño y `enter: false` la entrada. Reemplazar recaptura la pose actual. `stop()` elimina inversiones y conserva el layout final. El handle ofrece `finished` y `stop()`. La geometría proyectiva o singular no tiene inversa 2D admitida.

```ts
const size = motion.animateSize(
  card,
  { width: 420, height: 'auto' },
  () => {
    card.textContent = nextText
  },
  { duration: 400 },
)
size.pause()
size.play()
await size.finished

const layout = motion.animateLayout(
  list,
  () => {
    list.append(list.firstElementChild!)
  },
  { size: 'scale', enter: true, duration: 400 },
)
await layout.finished
```

<Clip name="web-size-chromium" :width="900" caption="Chromium 156 en macOS: controles reales cambian ancho y alto intrínseco, pausan, reanudan, invierten y añaden texto. La fila siguiente participa en layout real; velocidad original." />

<Clip name="web-layout-chromium" :width="900" caption="Chromium 156 en macOS: clics reordenan, redimensionan, interrumpen, insertan y eliminan tarjetas. FLIP escala contenido visual; no es redistribución real del texto." />

## Escenas con seek {#scenes}

`seekableTimeline()` coordina tracks explícitas de elementos y valores numéricos mutables, `steps` anidados, offsets en milisegundos y repeticiones finitas en un reloj. Usa un descriptor por canal/layer; combina movimientos repetidos en keyframes. Callbacks, gestos y efectos secundarios no son descriptores reversibles. Destinos y valores pertenecen al mismo documento/runtime.

Pause, resume, stop y `progress` conservan el contrato finito. Se puede retroceder desde un endpoint pausado. Reemplazar un canal o hacer `set()` del valor mantiene los demás; el handle anterior no recupera el canal y finalmente resuelve `false`. Observar valores numéricos usa el scheduler; las escenas elegibles solo de elementos mantienen WAAPI.

```ts
const progress = motion.motionValue(0)
const scene = motion.seekableTimeline(
  [
    {
      target: card,
      keyframes: { x: [0, 240], borderRadius: [8, 40] },
      transition: { duration: 1200, ease: 'linear' },
    },
    {
      at: 200,
      steps: [{ value: progress, keyframes: [0, 100], transition: { duration: 1000 } }],
    },
  ],
  { paused: true },
)
scene.progress = 1
scene.progress = 0.3
scene.play()
await scene.finished
```

<Clip name="web-scene-chromium" :width="900" caption="Chromium 156 en macOS: play/pause y teclado coordinan dos elementos y un contador, llegan al endpoint pausado, retroceden y continúan." />

## Lifecycle, coste e integración {#integration}

Reduced motion en vivo finaliza tracks espaciales/decorativas y tamaño intrínseco, incluso pausado; color/opacidad conservan sus tiempos. Libera destinos y descarta el contexto con su dueño. `useWebMotion()` también ofrece `animateSize()` y `animateLayout()` sobre la ref declarada y limpia con el scope Vue.

Se mantiene la [política Web de superficies](./web-runtime#surface-policy-and-limits): usa superficies dedicadas sin animaciones/transiciones CSS competidoras. La pintura finita usa keyframes WAAPI preparados, pero colores pueden repintar y bordes provocar layout. El tamaño real mide layout cada frame activo; ningún camino garantiza aceleración del compositor. Evita renders del framework por frame.

Ejecuta `npm run web:visual:typecheck`, `npm run web:visual:test` y `npm run web:visual`; la demo usa el puerto 4287 con `?demo=paint`, `size`, `layout` o `scene`. El [informe y los comandos](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-visual.md) incluyen Chromium/Firefox/WebKit reales y consumidores empaquetados imperativo/Vue/SSR/nativo.

La adopción Mavis se sigue en [controles #191](https://github.com/getcortexlabs/mavis-ui/issues/191), [Accordion #192](https://github.com/getcortexlabs/mavis-ui/issues/192), [FLIP compartido #193](https://github.com/getcortexlabs/mavis-ui/issues/193) y [escenas #194](https://github.com/getcortexlabs/mavis-ui/issues/194), consumiendo el motor Jolt.

## Referencias nativas conservadas {#native-reference}

Estas grabaciones revisadas en inglés muestran equivalentes nativos existentes. No muestran Web ni acreditan nuevo rendimiento físico.

<Clip name="decorations-reference-ios" caption="Extracto de la demo nativa iOS: bordes y esquinas. Se recortó el inicio; tiempos y archivo original conservados." />

<Clip name="live-paint-ios" caption="Simulador iOS: toques reales cambian el destino y pausan/reanudan color y radio. Las esquinas nativas uniformes difieren de las independientes Web." />

<Clip name="size-ios" caption="Simulador iPhone 17, iOS 26.0: ancho/alto reales, contenido intrínseco, interrupción y pausa. La demo elige 0,25× en parte; tiempo del vídeo conservado." />

<Clip name="layout-ios" caption="Simulador iOS: inserción, eliminación, reordenación y tamaño en la demo FLIP nativa existente." />

<Clip name="seekable-scene-ios" caption="Simulador iOS: interacción real con slider controla una escena nativa, retrocediendo desde el endpoint pausado." />
