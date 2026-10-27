# Movimiento sobre una trayectoria {#motion-along-a-path}

```ts
animate(
  plane,
  { path: 'M0 0 C80 -120 200 -120 280 0', orient: true },
  { duration: 1200, ease: 'linear' },
)
```

<Clip name="paths" caption="Una curva y una órbita con orientación tangente." />

`path` proporciona coordenadas de traducción en **DIPs**, relativas a la posición de diseño no transformada de la vista. La X positiva apunta hacia la derecha; Y positiva apunta hacia abajo. El ejemplo se arquea hacia arriba y termina 280 DIPs a la derecha. No cambia el tamaño ni redistribuye la vista, ni anima la posición nativa propiedad del diseño.

## Timing y orientación {#timing-and-orientation}

Jolt mide la distancia a lo largo de la curva. La flexibilización lineal se mueve a una distancia aproximadamente constante por unidad de tiempo; otra flexibilización cambia el progreso a lo largo de toda la ruta, en lugar de reiniciar en cada muestra geométrica. El valor predeterminado es una interpolación de liberación gradual de 300 ms. Utilice `path` en las opciones para cronometrar la ruta por separado de otras propiedades:

```ts
animate(
  plane,
  { path: route, orient: true, opacity: [0, 1] },
  {
    duration: 300,
    path: { duration: 1200, ease: 'easeInOut' },
  },
)
```

`orient: true` alinea la ilustración orientada hacia **+X** con la tangente delantera, en grados. Los ángulos se desenvuelven a lo largo de ±180°, por lo que un círculo gira continuamente. Con la orientación omitida o `false`, la rotación actual se deja sola; También se permite una animación `rotate` separada.

Los resortes impulsan el mismo progreso de ruta compartido 0–1:

```ts
animate(plane, { path: route, orient: true }, 'bouncy')
```

El progreso fuera de 0–1 está fijado a los puntos finales de la ruta, por lo que un resorte que se sobrepasa puede mantenerse allí brevemente antes de retroceder por el camino. Los caminos tienen una postura inicial explícita y no infieren una velocidad de progreso de la animación que reemplazan. El `velocity` explícito de un resorte utiliza unidades de progreso por segundo. Las animaciones ordinarias que toman el relevo de una trayectoria en ejecución heredan su velocidad coordinada.

Las repeticiones, repeticiones inversas, retrasos, escalones y hápticos utilizan la línea de tiempo de animación existente. Al invertir se rebobina la orientación muestreada así como las coordenadas; no agrega un giro de 180° para que la obra de arte mire hacia atrás. Las esquinas y cúspides agudas pueden girar abruptamente, con interpolación entre muestras nativas adyacentes.

## Rutas relativas {#relative-paths}

```ts
animate(
  plane,
  { path: 'M0 0 Q80 -120 160 0', orient: true },
  {
    duration: 1000,
    relative: true,
  },
)
```

`relative: true` agrega la traslación inicial de la vista a la ruta y su rotación inicial a una ruta orientada. La base se captura una vez cuando se carga el objetivo, utilizando el valor presentado si otra animación lo posee. Las coordenadas no se rotan según ese ángulo base: una rotación inicial actúa como un desplazamiento del encabezado de la obra de arte. Sin modo relativo, el primer `M` selecciona explícitamente la traducción inicial.

## Reproducción, secuencias y parada {#playback-sequences-and-stopping}

El valor de retorno es el habitual [`PlaybackAnimation`](./playback). Pausarlo, fregarlo, continuarlo o detenerlo. Las rutas también funcionan en [`sequence()`](./sequences), [ajustes preestablecidos personalizados](./presets#custom-presets), [`scrollLinked()`](./scroll-linked) y `press()`.

```ts
const flight = animate(plane, { path: route, orient: true }, { duration: 2000 })
flight.pause()
flight.progress = 0.5
flight.play()

stop(plane, ['x', 'y', 'rotate']) // freeze the generated tracks
```

Un camino posee `x` y `y`, y posee `rotate` cuando está orientado. Proporcionar fotogramas clave competitivos o sincronización por propiedad para esas coordenadas en los mismos lanzamientos de llamadas; utilice la transición compartida `path` en su lugar. Otras propiedades siguen siendo independientes. Detener o reemplazar solo una coordenada deja a las demás siguiendo sus trayectorias originales, por lo que ya no describen toda la ruta juntas. No hay ninguna propiedad `path` virtual para pasar a `stop()`.

## Datos y límites SVG {#svg-data-and-limits}

El analizador acepta una subruta continua con un único `M`/`m`, líneas (`L H V`), Béziers cúbicos y cuadráticos (`C S Q T`), arcos elípticos (`A`) y de cierre (`Z`), en forma absoluta o relativa. Se admiten grupos de argumentos repetidos, números compactos, exponentes y banderas de arco empaquetadas. La conversión de arco sigue el modelo [Notas de implementación de SVG](https://www.w3.org/TR/SVG/implnote.html#ArcConversionEndpointToCenter). Pase datos de ruta, no un documento SVG, transformación o URL.

Una ruta de solo movimiento o de longitud cero mantiene su punto y utiliza un rumbo cero. Múltiples comandos `M`, datos con formato incorrecto, coordenadas en conflicto y valores no admitidos se lanzan antes de tomar el control de una vista. La duración y el retraso deben ser finitos; las repeticiones pueden ser infinitas.

La entrada está limitada a 100.000 caracteres y 1.024 segmentos. Las magnitudes numéricas y las coordenadas geométricas deben permanecer dentro de ±1.000.000. La geometría utiliza subdivisión adaptativa con un objetivo de planitud DIP de 0,025 y trabajo acotado (8192 vértices/18 subdivisiones); La geometría que no puede cumplir con ese límite se rechaza. La sincronización nativa utiliza hasta 6001 fotogramas clave por coordenada, elegidos entre la longitud y la duración de la ruta. La distancia, el rumbo y la interpolación nativa son aproximaciones, especialmente en rutas muy largas, bucles pequeños y curvas cerradas.

## Reproducción nativa {#native-playback}

JavaScript analiza y mide la ruta una vez por llamada `animate()`. Las muestras de tiempo y coordenadas se crean una vez que su primer objetivo está listo, compartidas por las pistas generadas y los objetivos escalonados. Los fotogramas clave nativos de traducción y rotación se reproducen tanto en iOS como en Android; ninguna devolución de llamada de marco JS mueve la vista. Los comandos de reproducción y la interrupción leen la misma ruta. El [Limitación de subprocesos de UI](./android-performance) de Android todavía se aplica.

El patio de juegos incluye un vuelo curvo, una órbita basada en arco, controles de orientación, pausa/reanudación y parada.
