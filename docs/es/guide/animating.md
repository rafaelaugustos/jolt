# Animar {#animating}

`animate(target, keyframes, transition?)` toma una vista y dónde tomarla:

<Clip name="loops" caption="Una ruleta y un latido del corazón en repetición." />

```ts
animate(card, { opacity: 0.5, y: -20 })
```

## Propiedades {#properties}

| Propiedad            | Unidad                                     |
| -------------------- | ------------------------------------------ |
| `opacity`            |                                            |
| `x`, `y`             | DIPs, igual que `translateX`, `translateY` |
| `scale`              | establece `scaleX` y `scaleY` juntos       |
| `scaleX`, `scaleY`   |                                            |
| `rotate`             | grados                                     |
| `rotateX`, `rotateY` | grados, con perspectiva                    |

También se admiten colores de fondo, borde y texto. Ver [Colores](./colors). Consulte [esquinas, bordes y sombras](./decorations) para conocer las propiedades de decoración numérica. Utilice [`animateSize()`](./size) para transiciones de ancho/alto/automáticas reales con reflujo de texto, o [`animateLayout()`](./layout) para transiciones de diseño FLIP.

Utilice [`path` y `orient`](./paths) para seguir una curva SVG con traducción nativa y rotación tangente opcional.

## Android se desvanece {#android-fades}

Para animaciones de opacidad, Jolt almacena en caché temporalmente los contenedores con elementos secundarios en una capa de hardware cuando la aceleración de hardware está activa. Comienza al final de cualquier retraso, mantiene el caché a lo largo de las repeticiones y restaura la capa original al finalizar, detener, reemplazar o descargar. Esto puede reducir el trabajo de dibujo de contenido estático, como tarjetas con imágenes.

Las capas de hardware o software configuradas por la aplicación no se modifican. Se omiten los contenedores vacíos, las vistas sin límites medidos y los contenedores más anchos o más altos que la pantalla. El límite de tamaño evita el almacenamiento en caché de árboles de contenido enteros de gran tamaño. Los contenedores con `setClipChildren(false)` también se omiten: la capa tiene el tamaño de la vista, por lo que los elementos hijos dibujados fuera de ella se cortarían durante el desvanecimiento. Las texturas de hardware utilizan memoria gráfica; El contenido en constante cambio aún invalida su caché. Ver el [Android punto de referencia de desvanecimiento](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/android-fade.md).

Android también dibuja una vista translúcida en un búfer de su propio tamaño, que corta a los elementos hijos dibujados fuera de él incluso cuando el contenedor no los recorta. Ninguna configuración hace que ese búfer sea más grande: mientras una vista se desvanece, el renderizador de Android la convierte en una capa exactamente tan grande como la vista. Para contenedores con `setClipChildren(false)`, Jolt desactiva ese búfer con `forceHasOverlappingRendering(false)` en Android 7 y versiones posteriores, de modo que un brillo o una sombra que se desborde mantiene su forma mientras se desvanece. Luego, los elementos hijos se desvanecen uno por uno: donde dos de ellos se superponen, el de abajo se ve.

Para desvanecer contenido que se superpone y se dibuja fuera de su contenedor como una imagen, desvanezca un contenedor que lo contenga todo. Haga que la vista descolorida sea tan grande como el brillo, con el contenido centrado en el interior, para que nada lo desborde:

```xml
<!-- The glow fits inside the view that fades, so the dot never shows it through. -->
<GridLayout ref="badge" width="168" height="168">
  <Label class="glow" width="168" height="168" borderRadius="84" />
  <Label class="dot" width="64" height="64" borderRadius="32" />
</GridLayout>
```

Al animar `badge`, el brillo y el punto se desvanecen juntos, tanto en Android como en iOS.

<Clip name="fade-overflow-android" caption="Un halo más grande que su contenedor mantiene su forma mientras el contenedor desaparece y vuelve a aparecer, en el emulador Android." />

## Investigando la opacidad de iOS con rotación {#investigating-ios-opacity-with-rotation}

[Número 134](https://github.com/rafaelaugustos/jolt/issues/134) rastrea un informe de copias de una imagen vecina cuando un contenedor se desvanece y gira mientras su hijo dibuja fuera de sus límites. La demostración incluye una escena de reproducción SVG con interruptores para atenuar el contenedor o al elemento hijo, vistas simples, cámara lenta y reproducción de salpicaduras repetidas.

<Clip name="opacity-rotation-ios" caption="Escena de investigación en el simulador iPhone 17, iOS 26.0, a velocidad normal: elementos hijos SVG desbordan cuatro contenedores que se desvanecen y giran. El hermano azul se queda quieto. Las copias fantasma reportadas no se reprodujeron en esta grabación; Esto no es evidencia de una corrección o validación del dispositivo físico." />

Ver el [pasos de reproducción y evidencia](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/ios-opacity-rotation.md). Los escenarios registrados no reproducían el informe; la investigación se concluye como no reproducible dentro de esa cobertura. Un caso fallido debería reabrirlo. El controlador iOS de Jolt no se ha modificado para forzar la rasterización o deshabilitar la opacidad del grupo para este informe.

## Perspectiva 3D {#_3d-perspective}

`rotateX`, `rotateY`, `flipInX` y `flipInY` utilizan el `perspective` de la vista en ambas plataformas. NativeScript por defecto es 1000 DIPs; una distancia positiva más pequeña da una perspectiva más fuerte:

```ts
card.perspective = 600
animate(card, { rotateY: [-60, 0] })
```

Android convierte esta distancia usando la densidad de visualización antes de iniciar el animador nativo. La perspectiva permanece en su lugar cuando finaliza una rotación o se detiene en un ángulo.

## Fotogramas clave {#keyframes}

Un valor único se anima desde cualquier lugar donde se encuentre la vista. Una matriz es una lista de fotogramas clave y `null` representa el valor actual:

```ts
animate(card, { x: [0, 100] }) // from 0, whatever x is now
animate(card, { x: [null, 20, -20, null] }) // out and back to where it was
```

## Fotogramas clave relativos {#relative-keyframes}

Configure `relative: true` para usar los valores actuales como base:

```ts
animate(card, { x: [0, -10, 10, 0] }, { relative: true })
animate(card, { scale: [1, 1.06, 1] }, { relative: true })
animate(card, { y: 20 }, { relative: true }) // move 20 DIPs from its current y
```

Los valores de traslación y rotación son desplazamientos. Los valores de escala y opacidad son factores: una escala de `1.06` aumenta cada eje en un 6 %, preservando cualquier diferencia entre `scaleX` y `scaleY`. Un valor de `0` significa la posición inicial de un desplazamiento, mientras que `1` significa el valor inicial de un factor. `null` siempre mantiene el valor actual.

Jolt captura la base una vez cuando se crean las pistas de la vista cargada, antes de cualquier retraso o tambaleo. Las repeticiones reutilizan los fotogramas clave resueltos. Si otra animación posee la propiedad, la base proviene de su posición actual en la pantalla. Un paso de secuencia relativa se resuelve cuando comienza el paso; no cambia ni detiene el objetivo mientras se reproduce un paso anterior.

Los fotogramas clave relativos también funcionan en ajustes preestablecidos personalizados: coloque `relative: true` en el `transition` del ajuste preestablecido. Una llamada puede anularlo con `relative: false`.

## Objetivos {#targets}

El objetivo puede ser una vista, o cualquier cosa que contenga una: una referencia de plantilla NativeScript-Vue, un Angular `ElementRef`.

```vue
<script setup lang="ts">
const card = ref()
const open = () => animate(card.value, 'popIn')
</script>

<template>
  <GridLayout ref="card" @tap="open" />
</template>
```

Una vista que aún no está cargada toma su primer fotograma clave absoluto de inmediato y se reproduce una vez que está en la pantalla. Llamar a `animate(title, 'fadeInUp')` en `onMounted` no muestra el título antes de que aparezca. Las animaciones relativas dejan los valores de la vista solos hasta que se carga, luego resuelven sus fotogramas clave a partir de esos valores.

## Lo que obtienes a cambio {#what-you-get-back}

`animate()` devuelve una animación que puedes `await`. Se resuelve con `true` cuando se reprodujo hasta el final y `false` cuando se detuvo o se hizo cargo. Nunca rechaza. Ver [Interrumpir y detener](./interrupting).
