# Vue {#vue}

```ts
import Jolt from '@rafaelaugusto/jolt/vue'

createApp(App).use(Jolt).start()
```

<Clip name="vue" caption="JoltTransition elimina y restaura una fila, v-animate cambia su entrada." />

El núcleo toma una vista o un elemento que la contiene, por lo que `animate(card.value, 'popIn')` ya funciona a partir de una plantilla ref, en un elemento o en un componente cuya raíz es una vista. `@rafaelaugusto/jolt/vue` agrega el lado de la plantilla: `v-animate`, `v-press`, `v-gradient` y un componente `<JoltTransition>` para vistas que van y vienen. Necesita NativeScript-Vue 3 y solo lo cargan aplicaciones que lo importan.

## Movimiento del componente con alcance {#scoped-component-motion}

Utilice [`useMotionScope()`](./motion-controllers#vue-lifecycle) dentro de la configuración para poseer animaciones y suscripciones hasta desmontarlas, con suspensión/reanudación de KeepAlive.

## Movimiento reducido {#reduced-motion}

`useReducedMotion()` devuelve una referencia de solo lectura que sigue a [la preferencia de movimiento reducido](./configure#reading-the-preference) hasta que el componente se desmonta:

```vue
<script setup lang="ts">
import { useReducedMotion } from '@rafaelaugusto/jolt/vue'

const reduced = useReducedMotion()
</script>

<template>
  <Image v-if="reduced" src="~/assets/still.png" />
  <Splash v-else />
</template>
```

## Teclado {#keyboard}

`useKeyboard()` devuelve una referencia de solo lectura con [el estado del teclado](./keyboard#keyboard-state), que se mantiene actualizada hasta que se desmonta el componente:

```vue
<script setup lang="ts">
import { useKeyboard } from '@rafaelaugusto/jolt/vue'

const keyboard = useKeyboard()
</script>

<template>
  <ScrollView>
    <StackLayout :paddingBottom="keyboard.height">...</StackLayout>
  </ScrollView>
</template>
```

## Valores de movimiento {#motion-values}

`useMotionValue()` crea un [valor de movimiento](./motion-values) que se detiene cuando el componente se desmonta, `useScrollValue()` sigue a un ScrollView a través de su `ref` y `useBinding()` devuelve una referencia de plantilla que vincula un valor a un elemento:

```vue
<script setup lang="ts">
const progress = useMotionValue(0)
const sheet = useBinding({ y: progress.to([0, 1], [200, 0]) })
</script>

<template>
  <GridLayout :ref="sheet" />
</template>
```

## Registrando {#registering}

`app.use(Jolt)` registra las tres directivas y el componente para cada plantilla. Un componente también puede importar sólo lo que utiliza. En `<script setup>`, importar `vAnimate`, `vPress` y `vGradient` con esos nombres hace que `v-animate`, `v-press` y `v-gradient` estén disponibles en esa plantilla:

```vue
<script setup lang="ts">
import { JoltTransition, vAnimate, vGradient, vPress } from '@rafaelaugusto/jolt/vue'
</script>
```

## v-animar {#v-animate}

```vue
<Label v-animate="'fadeInUp'" />
<Label v-animate="{ opacity: [0, 1], y: [24, 0] }" />
<Label v-animate="['popIn', { delay: 200 }]" />
<Label v-animate="[entrance, 'bouncy']" />
```

El valor es lo que toma [`animate()`](./animating): un nombre preestablecido o fotogramas clave, solos o combinados con una transición o un nombre de resorte. La animación se reproduce cuando el elemento se monta. El montaje ocurre antes de que la vista esté en la pantalla, por lo que la vista toma su primer fotograma clave de inmediato y se reproduce una vez que se carga; nada parpadea.

Cuando el valor cambia, el elemento se anima nuevamente, recogiendo el valor y la velocidad en la pantalla como cualquier [interrupción](./interrupting). Los valores se comparan por contenido, por lo que un objeto escrito en la plantilla no reinicia la animación en cada renderizado. El desmontaje detiene la animación.

## v-presionar {#v-press}

```vue
<GridLayout v-press />
<GridLayout v-press="{ scale: 0.95, opacity: 0.8 }" />
<GridLayout v-press="[{ scale: 0.9, rotate: -4 }, 'bouncy']" />
```

Lo mismo que [`press()`](./press): la vista se anima a los valores presionados mientras un dedo está sobre ella, y regresa una vez que se levanta o un desplazamiento toma el control. Sin un valor, escala a 0,96. Un valor modificado reemplaza el efecto; al desmontarlo se elimina.

## v-gradiente {#v-gradient}

```vue
<GridLayout
  v-gradient="{ type: 'radial', colors: ['#A78BFA', '#0F172A'], radius: 0.8 }"
/>
<GridLayout
  v-gradient="[{ type: 'linear', colors: mood.colors, angle: mood.angle }, 'smooth']"
/>
```

Lo mismo que [`gradient()`](./gradients#scopes-and-vue): un degradado nativo detrás de los hijos del elemento, pintado al montar, animado a nuevos valores cuando cambian y eliminado al desmontar.

## Transición de sacudida {#jolttransition}

```vue
<JoltTransition enter="popIn" leave="fadeOut">
  <Label v-if="saved" text="Saved" />
</JoltTransition>

<JoltTransition :enter="['fadeInUp', { delay: 100 }]" leave="fadeOutDown" mode="out-in">
  <component :is="screen" />
</JoltTransition>
```

`JoltTransition` envuelve el `BaseTransition` de Vue, por lo que sigue las reglas de `<Transition>`: un hijo, alternado con `v-if` o `v-show`, o reemplazado a través de un `key` o componente cambiante. `enter` se reproduce cuando se inserta al elemento hijo y `leave` se reproduce antes de que se retire. Vue mantiene el elemento hasta que se estabiliza la animación de salida, que es lo que hace posibles las animaciones de salida: sin el componente, `v-if` elimina la vista antes de que se pueda reproducir algo.

| Accesorio | Significado                                                                                     |
| --------- | ----------------------------------------------------------------------------------------------- |
| `enter`   | Preestablecido, fotogramas clave o un par con una transición. Omitir insertar instantáneamente. |
| `leave`   | Las mismas formas. Omitir eliminar al instante.                                                 |
| `appear`  | También reproduce `enter` en el primer render.                                                  |
| `mode`    | `out-in` espera la salida antes de insertar, `in-out` al revés.                                 |

Las interrupciones siguen al motor. Mostrar a un elemento hijo mientras su permiso aún está activo cancela el permiso y la entrada comienza desde donde está la vista. Una entrada cancelada aún libera Vue, por lo que nada permanece atascado medio visible. Al abandonar una página se cancela todo lo que se esté ejecutando en ella.

## Transiciones de página {#page-transitions}

El enrutamiento entre páginas es un trabajo diferente: el marco es dueño de esa navegación. [vue-enrutador-ns](https://github.com/rafaelaugustos/vue-router-ns) se empareja con Jolt para eso, y `JoltTransition` cubre las vistas dentro de una página.
