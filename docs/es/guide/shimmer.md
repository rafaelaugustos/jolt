# Brillo deslizante {#shimmer}

Barra una banda de luz a lo largo de un marcador de posición de carga:

<Clip name="shimmer" caption="Un brillo sobre la carga de marcadores de posición." />

```ts
import { shimmer } from '@rafaelaugusto/jolt'

const stopShimmer = shimmer(placeholder)
// Once the content is ready:
stopShimmer()
```

Pasar una vista o un árbitro que tenga una. Aplíquelo a un recipiente para barrer todas sus formas de esqueleto juntas. La máscara cambia su opacidad, por lo que sus colores y el fondo determinan el contraste; las formas claras sobre un fondo oscuro crean un barrido brillante.

## Sincronización {#timing}

```ts
const stopShimmer = shimmer(placeholder, { duration: 2000 })
```

`duration` son milisegundos por barrido, incluida la banda que entra y sale de la vista. El valor predeterminado es `1500`. Debe ser un número finito positivo.

En iOS, una máscara `CAGradientLayer` anima su `locations` en Core Animation. La reproducción se repite de forma nativa, sin devolución de llamada JavaScript por cuadro. Los cambios de diseño cambian el tamaño de la máscara sin reiniciar el barrido.

## Limpieza {#cleanup}

La función devuelta elimina el brillo y sus oyentes. Llamarlo de nuevo es inofensivo. Iniciar otro shimmer en la misma vista reemplaza al anterior; su antigua función de limpieza no puede detener el nuevo efecto.

Las llamadas realizadas antes de cargar esperan la vista y un diseño distinto de cero. Al descargar la vista se elimina la máscara nativa y el observador de accesibilidad; cargarlo nuevamente inicia un nuevo barrido. Esto también maneja el fondo y el regreso a la aplicación. Llame a la función devuelta para finalizar el brillo de forma permanente, incluso mientras la vista está descargada.

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'nativescript-vue'
import { shimmer } from '@rafaelaugusto/jolt'

const placeholder = ref()
let stop: (() => void) | undefined

onMounted(() => {
  stop = shimmer(placeholder.value)
})
onUnmounted(() => stop?.())
</script>

<template>
  <StackLayout ref="placeholder" />
</template>
```

Las máscaras existentes, incluidas las rutas de clip NativeScript, permanecen en su lugar. La limpieza elimina solo el gradiente de Jolt. Shimmer no cambia las propiedades de opacidad, transformación, interacción o accesibilidad de la vista. Utilice `stopShimmer()` para detenerlo; `stop(view)` controla las orugas `animate()`.

## Compatibilidad {#compatibility}

Esta primera implementación es **Solo iOS**. En Android, el marcador de posición permanece sin cambios y la función de limpieza no hace nada.

Con Reducir movimiento habilitado, el marcador de posición permanece estático en su opacidad normal. Cambiar esa preferencia mientras el brillo está activo elimina o reanuda el barrido automáticamente.
