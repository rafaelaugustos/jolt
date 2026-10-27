# Degradados {#gradients}

El CSS de NativeScript solo tiene un `linear-gradient` estático. `gradient()` pinta un degradado nativo lineal, radial o cónico detrás de los elementos secundarios de un diseño y anima sus colores, paradas, ángulo, centro y radio:

```ts
import { gradient } from '@rafaelaugusto/jolt'

const glow = gradient(card, {
  type: 'radial',
  colors: ['#A78BFA', '#0F172A'],
  center: { x: 0.3, y: 0.3 },
  radius: 0.45,
})

glow.animate({ center: { x: 0.7, y: 0.7 }, radius: 0.9 }, { duration: 1400 })
```

<Clip name="gradients-ios" caption="Un ángulo lineal, una luz radial en movimiento, un barrido cónico giratorio y una banda lineal en una vista amplia, luego los colores lineales se intercambiaron, en el simulador iOS. Reproducción en tiempo real." />

## Tipos y valores {#types-and-values}

| Valor    | Significado                                                                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `colors` | de dos a ocho colores, como cadenas o `Color`                                                                                                                                                          |
| `stops`  | donde se ubica cada color, de 0 a 1, sin retroceder; espaciados uniformemente por defecto                                                                                                              |
| `angle`  | grados, como CSS. `linear` apunta de esta manera: 180 corre de arriba a abajo, 90 de izquierda a derecha. `conic` comienza aquí: 0 está arriba y los colores van en el sentido de las agujas del reloj |
| `center` | `radial` y `conic`: fracciones del ancho y alto de la vista; `{ x: 0.5, y: 0.5 }` por defecto                                                                                                          |
| `radius` | `radial`: una fracción del lado más corto de la vista; 0,5 por defecto llega a los bordes más cercanos                                                                                                 |

Un degradado lineal recorre el centro y es lo suficientemente largo como para que las esquinas obtengan el primer y el último color, como en CSS. Sus bandas permanecen cuadradas con respecto al ángulo en vistas de cualquier forma, en ambas plataformas. Los valores que un tipo no utiliza se mantienen. El `type` de la API directa es inmutable: elimínelo y cree otro degradado para cambiar de tipo. `v-gradient` se encarga del reemplazo por usted.

## Animando {#animating}

`animate(values, transition)` comienza desde el gradiente en la pantalla y devuelve un [`Animation`](./api#animations). Toma las mismas transiciones que `animate()`: interpolaciones, resortes, `repeat`, `repeatType`, `repeatDelay` y `delay`, y sigue el [escala de tiempo](./configure#time-scale).

```ts
const sweep = gradient(loader, {
  type: 'conic',
  colors: ['#22D3EE', '#A855F7', '#22D3EE'],
})
sweep.animate({ angle: 360 }, { duration: 2000, ease: 'linear', repeat: Infinity })
```

Los colores se mezclan en OKLab, como [animaciones en color](./colors), y mantienen su conteo mientras se anima; `set()` lo cambia. En un resorte, el ángulo, el centro y el radio siguen el exceso mientras que los colores y los topes permanecen entre sus extremos. Un degradado reproduce una animación a la vez: un nuevo `animate()` reemplaza al anterior. `stop()` mantiene el fotograma actual y `set(values)` aplica los valores a la vez. Con [movimiento reducido](./configure#reduced-motion), el ángulo, el centro y el radio saltan hasta su final mientras que los colores y las paradas aún se desvanecen.

`remove()` elimina el degradado de la vista. Al descargar la vista se detiene la animación en curso.

## Alcances y Vue {#scopes-and-vue}

`motionScope().gradient(target, options)` devuelve el mismo `Gradient` y lo elimina cuando se elimina el alcance. Suspender el alcance detiene una animación en progreso donde está y mantiene el gradiente. En Vue, `useMotionScope()` lo vincula al componente:

```ts
const scope = useMotionScope()
onMounted(() => scope.gradient(card.value, { type: 'linear', colors: warm, angle: 135 }))
```

La directiva `v-gradient` hace lo mismo desde una plantilla. Pinta el degradado cuando el elemento se monta, anima los nuevos valores cuando cambian y lo elimina al desmontarlo. Empareje las opciones con una transición o un nombre de resorte para cronometrar los cambios:

```vue
<GridLayout v-gradient="{ type: 'linear', colors: ['#18181B', '#3F3F46'], angle: 135 }" />
<GridLayout
  v-gradient="[
    { type: 'linear', colors: mood.colors, angle: mood.angle },
    { duration: 700 },
  ]"
/>
```

<Clip name="gradient-directive-ios" caption="Un banner con gradiente en v que anima sus colores y ángulos a medida que cambia su valor, en el simulador iOS. Reproducción en tiempo real." />

Se aplica un cambio en el número de colores a la vez, ya que un degradado mantiene su recuento de colores mientras se anima. Un cambio de `type` reemplaza el gradiente. Los valores se comparan por contenido, por lo que un objeto escrito en la plantilla no reinicia la animación en cada renderizado.

<Clip name="gradient-directive-android" caption="El mismo banner en el emulador Android. Reproducción en tiempo real." />

## Plataformas {#platforms}

En iOS el degradado es un `CAGradientLayer` en la parte posterior de la capa de la vista, con fotogramas clave Core Animation para sus colores, ubicaciones y puntos. En Android es un elemento de diseño apilado sobre el propio fondo de la vista y un animador nativo interpola los fotogramas muestreados. No hay devolución de llamada de pintura JavaScript por cuadro. Reconstruya la aplicación Android después de la actualización para que se incluyan la clase nativa y sus metadatos puente.

El degradado cubre el color de fondo de la vista y sigue un `borderRadius` uniforme. Se encuentra detrás de los hijos de un diseño. En una vista que dibuja su propio contenido, como `Label`, cubre ese contenido: coloque el degradado en un diseño a su alrededor.

<Clip name="gradients-android" caption="Los mismos degradados y el intercambio de colores en el emulador Android. Reproducción en tiempo real." />

## Siguiendo valores de movimiento {#following-motion-values}

Pasa movimiento numérico/valores derivados a `angle`, ya sea componente `center`, `radius` o `stops` individual, y colores derivados a `colors` individual. Los componentes estáticos y enlazados pueden coexistir. `GradientBindings` se exporta para configuración escrita. Una fuente también puede controlar las propiedades de vista, asignaciones descendentes, extrapolación y [capas escalares](./motion-values):

```ts
import { animate, bind, gradient, motionValue } from '@rafaelaugusto/jolt'

const offset = motionValue(0)
const progress = offset.to([0, 220], [0, 1], { clamp: false })
const releaseView = bind(thumb, { x: offset, opacity: progress.to([0, 1], [0.5, 1]) })
const glow = gradient(card, {
  type: 'radial',
  colors: [progress.to([0, 1], ['#ed4b82', '#45c8f5']), 'rgba(16,23,43,0)'],
  center: {
    x: progress.to([0, 1], [0.15, 0.85]),
    y: progress.to([1, 0], [0.2, 0.8]),
  },
  radius: progress.to([0, 1], [0.35, 0.9]),
  stops: [0, progress.to([0, 1], [0.45, 1])],
})

const travel = animate(offset, 220, { duration: 3000 })
// travel.pause(), travel.play(), and travel.progress = 0.7 also control the gradient.
animate(offset, [0, 35, 0], { duration: 900, layer: 'pulse' })
// At teardown: glow.remove(); releaseView(); stop(offset).
```

El mismo contrato acepta asignaciones de `playbackProgress(animation)`: por ejemplo, `angle: playbackProgress(travel).to([0, 1], [0, 360])` para un gradiente cónico. No se necesita ningún temporizador ni `subscribe()`. Reemplace `value.subscribe(v => glow.set(...))` con la fuente o su asignación `.to()` directamente y elimine la suscripción anterior.

<Clip name="gradient-values-ios" caption="Simulador iPhone 17, iOS 26: interacción real de arrastre y botón, seguida de reproducción autónoma, pulso en capas, pausa/búsqueda, retención del alcance, reemplazo de tipo y cambio de tamaño. Tiempo real; Los eventos de gestos y las reconstrucciones vinculantes aún ingresan a JavaScript." />

### Propiedad y ciclo de vida {#ownership-and-lifecycle}

| Operación                                       | Resultado                                                                                                                                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `glow.bind({ center: { x: value } })`           | Reemplaza solo el centro x; devuelve una función de limpieza.                                                                                                                                                |
| Limpieza de enlaces                             | Mantiene los valores actuales de los componentes que aún posee. No restaura enlaces antiguos ni elimina propietarios más nuevos.                                                                             |
| `glow.set(...)` / `glow.animate(...)`           | Desmonta las fijaciones sólo de los componentes suministrados. Otras vinculaciones continúan. Una nueva animación concreta reemplaza la animación concreta anterior. `set()` cancela esa animación concreta. |
| `glow.bind(...)` durante una animación concreta | Se hace cargo de los componentes suministrados; Los componentes intactos de esa animación continúan.                                                                                                         |
| `glow.stop()`                                   | Mantiene el fotograma actual, detiene la reproducción concreta y separa todos los enlaces de degradado. La fuente y otros consumidores continúan.                                                            |
| `glow.suspend()` / `glow.resume()`              | Retiene temporalmente y cancela la suscripción, luego se pone al día con la fuente. Lea `glow.suspended` para obtener una retención explícita. No pausa una fuente de propiedad independiente.               |
| `glow.remove()`                                 | Separa suscripciones, temporizadores, animaciones nativas, capa/diseño y escuchas de vista/aplicación. Es seguro volver a llamar.                                                                            |

`motionScope().gradient()` y `useMotionScope().gradient()` poseen el mismo controlador. La suspensión del alcance sostiene fijaciones; El reanudación sigue la fuente nuevamente sin suscripciones duplicadas. Un gradiente suspendido manualmente permanece retenido a lo largo de una suspensión/reanudación del alcance. Si la animación de origen también pertenece a ese ámbito, se aplican sus reglas de pausa/reanudación de ámbito normal. Las animaciones de gradiente concreto se detienen al suspenderse; no se reinician.

La descarga elimina la capa nativa y las suscripciones mientras conserva las definiciones de enlace. La recarga se conecta una vez en la posición actual de la fuente. El fondo de la aplicación también retiene o cancela la suscripción; el primer plano se pone al día. Eliminación del alcance y desmontaje del Vue, elimina todo.

El recuento de colores es estructural: `bind()`/`set()` puede reemplazar toda la gama de colores inmediatamente, eliminando enlaces de color/stop incompatibles y manteniendo enlaces de geometría. El suministro de `colors` sin `stops` restablece las paradas a un espacio uniforme, como en el API concreto. `animate()` requiere el mismo recuento. Se requieren de dos a ocho colores y una parada por color.

### Enlaces Vue {#vue-bindings}

Crea fuentes una vez en la configuración. La directiva compara los valores de movimiento por identidad, valida un reemplazo antes de eliminar el gradiente de trabajo y libera enlaces omitidos en sus valores mantenidos. Un tipo diferente reemplaza la capa nativa. Una tupla de transición controla opciones concretas; Los componentes enlazados siguen su propia sincronización de origen.

```vue
<script setup lang="ts">
import { motionValue } from '@rafaelaugusto/jolt'

const progress = motionValue(0)
const angle = progress.to([0, 1], [0, 360])
const tint = progress.to([0, 1], ['#ed4b82', '#45c8f5'])
</script>

<template>
  <GridLayout v-gradient="{ type: 'conic', colors: [tint, '#20233c', tint], angle }" />
</template>
```

### Rangos válidos y ejecución nativa {#valid-ranges-and-native-execution}

Los ángulos utilizan las unidades/dirección anteriores y pueden exceder los 360°. Los centros pueden extrapolar fuera de la vista. Radios estáticos negativos, números no finitos, colores no válidos y paradas estáticas desordenadas/fuera de rango se lanzan antes de reemplazar las fijaciones en funcionamiento. El exceso del radio limitado se fija en cero. Las paradas limitadas se fijan en `[0, 1]`, luego cada parada se eleva al menos hasta la parada anterior; Los colores nunca se clasifican ni intercambian. El exceso puede fusionar paradas. Una asignación que luego produce un resultado no finito contiene el último fotograma compilado válido, separa los enlaces de ese gradiente y escribe un error de seguimiento NativeScript; otros consumidores siguen apegados. Vuelva a vincular con valores válidos para recuperar.

Los colores derivados utilizan la interpolación OKLab de Jolt y conservan el alfa. Las muestras nativas utilizan canales de color de 8 bits; entre muestras la plataforma interpola esos colores. Con movimiento reducido, la geometría enlazada utiliza el destino de origen mientras los colores y las paradas continúan interpolando.

Todos los componentes se preparan como un marco coherente a partir de una instantánea por fuente. Los enlaces móviles utilizan ventanas de como máximo **4 segundos**, con **como máximo 241 muestras**, espaciadas no más de **16,7 ms** en el tiempo de reproducción de origen. La reproducción nativa está alineada con el reloj fuente existente; Los enlaces no crean un segundo reloj de reproducción. Los puntos/colores nativos en iOS y los canales numéricos en Android se interpolan entre estas muestras. Esta es una aproximación muestral: no existe un error visual universal ligado a un mapeo arbitrariamente nítido o una discontinuidad repetida. Un cambio abrupto puede mezclarse en un intervalo de muestra; mantener las transiciones importantes más amplias que ese intervalo. Para un canal numérico interpolado linealmente cuya velocidad está limitada por L unidades/ms, la interpolación contribuye como máximo al error L × Δ / 2 (Δ ≤ 16,7 ms), antes del redondeo de punto flotante nativo y la programación de visualización. Las asignaciones discontinuas no satisfacen ese límite.

JavaScript se ejecuta en preparación, comandos de origen, eventos de gestos y límites de ventana larga. La reproducción autónoma dentro de una ventana solicita **cero cuadros de observador JS** y no tiene `set()`/bucle de pintura por cuadro. Las fuentes infinitas/de larga duración necesitan una reconstrucción cada cuatro segundos; Si JS no se puede ejecutar, el gradiente retiene su último fotograma preparado hasta que pueda volver a unirse a la fuente. En iOS, los fotogramas Core Animation enviados pueden seguir reproduciéndose durante la contienda JS. El animador y el dibujo de Android aún dependen de su hilo de interfaz de usuario, por lo que bloquearlo detiene el procesamiento. Las actualizaciones de arrastre frecuentes aún reconstruyen enlaces a través de JS; esta API no mueve el manejo de gestos a un worklet.

<Clip name="gradient-values-android" caption="Emulador Android 16 / API 36: arrastre y toques reales con los mismos tres gradientes y controles. Tiempo real; Reproducción de animador nativo, con JavaScript utilizado para eventos de gestos y preparación." />
