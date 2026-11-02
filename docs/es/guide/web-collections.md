# Montaje, colecciones y scroll horizontal Web

**Sin publicar.** Estas adiciones resuelven #334, #336 y #337. El runtime experimental `/web` funciona directamente o con Vue, sin otro motor en los componentes.

## Vue y Nuxt: esperar la conexión {#nuxt}

`mounted` no garantiza la inserción en el documento. Nuxt out-in y Suspense pueden montar una rama separada. `createViewportEnterDirective()` observa su conexión real, sin temporizador fijo ni sondeo por frame. Cree una directiva por aplicación/solicitud SSR y úsela sobre HTML.

```ts
import { createViewportEnterDirective } from '@rafaelaugusto/jolt/web/vue'

export default defineNuxtPlugin((nuxt) => {
  nuxt.vueApp.directive(
    'enter',
    createViewportEnterDirective({
      viewport: {
        keyframes: { opacity: [0, 1], y: [24, 0] },
        transition: { duration: 350 },
      },
    }),
  )
})
```

```vue
<template><section v-enter>Content</section></template>
```

La fábrica es segura en SSR y no oculta contenido del servidor. `runtime` toma prestado el contexto del host; `config` configura el propio y `viewport` aporta valores predeterminados. El binding los sobrescribe; sustituya su objeto para cambiar la receta. Desmontar cancela la espera y desconectar libera solo esa entrada. KeepAlive reconstruye entradas incompletas/repetidas y conserva las únicas completadas. Cambiar el binding reinicia ese historial. Se observa un ShadowRoot conocido y su host; trasladar a una raíz cerrada desconocida queda fuera del contrato.

`useWebMotion().use()` y las entradas de transición esperan la inserción. Cambiar referencias, desactivar, cancelar o destruir elimina la espera. Las llamadas imperativas `animate()`, `set()` y `runtime.viewportEnter()` siguen exigiendo elementos montados. Resuelva datos asíncronos antes del callback síncrono del scope.

<Clip name="web-nuxt-attachment-chromium" caption="Chromium en macOS: consumidor Nuxt de producción con out-in, historial, KeepAlive y página asíncrona. Velocidad original; no es un dispositivo físico." />

<Clip name="vue-lifecycle-reference-ios" caption="Referencia Vue existente en simulador iOS: entrada/salida y directiva reales. No reproduce el defecto de DOM de Nuxt." />

El consumidor empaquetado Nuxt 4.6.3/Vue 3.5.44 verifica SSR, historial, inserción diferida, KeepAlive y movimiento reducido en tres navegadores. Interrumpir una ruta asíncrona durante out-in puede dejar un placeholder vacío incluso con CSS puro; el adapter no corrige esa limitación del router. La cancelación Vue se prueba por separado. Consulte el [informe](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-attachment/README.md).

## Identidad de datos al reciclar filas {#items}

`animateItems()` controla entradas; no virtualiza ni reordena con FLIP. Las claves únicas son strings, números finitos u objetos. Los elementos también deben ser únicos y estar montados. Se valida todo el lote antes de cambiar ownership. En Vue actualice tras `nextTick()` o con un watcher post-flush.

```ts
const rows = runtime.animateItems([{ key: item.id, target: rowElement }], 'fadeInUp', {
  root: scroller,
  once: true,
  duration: 400,
})

// After the renderer has committed the next DOM rows:
rows.update(nextItems.map((item) => ({ key: item.id, target: elements.get(item.id)! })))
rows.forget(item.id)
rows.suspend()
rows.resume()
rows.dispose()
```

El valor predeterminado `once: false` permite reentrada. Con `once: true`, el historial pertenece a la clave: una nueva clave en el mismo DOM entra; una conocida en otro DOM recibe el destino. Los objetos usan referencias débiles; las claves primitivas duran hasta `forget(key)`, `forget()` o dispose. Elimine claves expulsadas de la caché. Reordenar conserva el movimiento del mismo par clave/elemento. Quitar filas detiene solo su entrada. `stagger` se rechaza: use `viewportEnter()` para grupos y `animateLayout()` para FLIP.

`pending`, `completed`, `suspended` y `disposed` describen el controlador. Una colección vacía acepta filas nuevas. Un grupo de observers atiende todas las filas y se desconecta al completar entradas únicas. Sin IntersectionObserver, con movimiento reducido o deshabilitado, el contenido sigue visible. Scopes y suspensión conservan canales nuevos y press independiente.

<Clip name="web-attachment-items-chromium" caption="Chromium en macOS: botones reales reciclan, añaden, reordenan y reinician el historial. Press permanece independiente." />

<Clip name="lists-android" caption="Referencia ListView nativa: entradas al desplazar filas en un emulador Android. Web recibe claves/elementos explícitos y no virtualiza." />

## Scroll horizontal LTR y RTL {#horizontal}

```ts
const offset = runtime.scrollValue(rail, { axis: 'x' })
const progress = offset.to([0, 600], [0, 1])
const link = runtime.scrollLinked(
  rail,
  indicator,
  { scaleX: [0.02, 1] },
  {
    axis: 'x',
    range: [0, 600],
    execution: 'auto',
  },
)
// After application geometry changes:
offset.refresh()
link.refresh()
// On teardown:
link.dispose()
progress.dispose()
offset.dispose()
```

El eje predeterminado sigue siendo `y`. `axis: x` mide píxeles CSS desde el inicio lógico: izquierda en LTR, derecha en RTL. Se normaliza el scrollLeft negativo y se limita overscroll. Documento y elemento comparten contrato. Dirección, clases, estilos, contenido, tamaño y fuentes invalidan geometría; use `refresh()` para otros cambios.

El playback elegible usa `ScrollTimeline`. `execution: scheduler` fuerza el fallback compartido; se comparan extremos y retorno LTR/RTL. Composición, reemplazo parcial, movimiento reducido y limpieza conservan ownership. No quedan frames en reposo. Flex invertido en el eje elegido y escritura vertical se rechazan antes de adquirir propiedades. No se promete igualdad entre píxeles CSS, DIPs y convenciones RTL nativas.

<Clip name="web-attachment-horizontal-chromium" caption="Chromium en macOS: rueda horizontal real en ambos sentidos, LTR y RTL, con progreso lógico." />

<Clip name="horizontal-scroll-ios" caption="Simulador iOS 26.2: gestos reales del ScrollView horizontal controlan una barra. Referencia nativa del eje x; no valida RTL Web ni rendimiento físico." />
