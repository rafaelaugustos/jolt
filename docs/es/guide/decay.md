# Desaceleración y ajuste {#decay}

Dale velocidad a una vista y déjala disminuir, como una carta después de un lanzamiento:

<Clip name="decay" caption="Una decadencia libre, luego una que se rompe." />

```ts
import { decay } from '@rafaelaugusto/jolt'

decay(card, { x: 600 })
decay(card, { x: -400, y: 200 }, { friction: 0.995 })
```

`x` y `y` son velocidades de traslación en **DIPs por segundo**, comenzando desde la posición actual. Los ejes omitidos siguen haciendo lo que estaban haciendo. Un objetivo puede ser una vista, una referencia de plantilla, un `ElementRef` o una matriz de estos.

`friction` es el multiplicador de velocidad por milisegundo. El valor predeterminado es `0.998`; los valores más pequeños se ralentizan antes, los valores más cercanos a `1` viajan más lejos. Debe ser finito y estrictamente entre `0` y `1`. El movimiento sigue el tiempo transcurrido, por lo que cambiar la frecuencia de actualización de la pantalla no cambia el aterrizaje.

La curva completa se calcula una vez y se reproduce con Core Animation en iOS o `ObjectAnimator` en Android, sin JavaScript por cuadro. Esto utiliza los controladores existentes; La validación nativa para esta adición se realizó en iOS.

## Puntos de ajuste {#snap-points}

```ts
decay(card, { x: 600 }, { snap: [0, 320] })

decay(
  card,
  { x: 600, y: -400 },
  {
    snap: { x: [0, 320], y: [-200, 0] },
  },
)
```

Con `snap`, Jolt proyecta dónde se detendría la decadencia, elige la posición más cercana y salta allí **directamente**, preservando la velocidad suministrada. Utiliza el resorte predeterminado. No espera a que termine la descomposición antes de romperse.

Una matriz aplica las mismas paradas a cada eje suministrado. Un objeto establece paradas de forma independiente; un eje sin topes decae libremente. Las paradas pueden no estar ordenadas, deben ser finitas y cada lista debe contener al menos una posición. Los empates utilizan la primera parada de la lista. Las posiciones son traducciones absolutas en DIPs, en lugar de desplazamientos desde la posición inicial.

## Interrumpir y detener {#interrupting-and-stopping}

```ts
const motion = decay(card, { x: 600 })
motion.stop() // leave the card where it is

stop(card, ['x']) // also stops a decay on this axis

await sequence([
  () => decay(card, { x: 600 }, { snap: [0, 320] }),
  () => animate(card, { opacity: 0 }),
])
```

`decay()` devuelve el mismo identificador `Animation` que `animate()`: `await` o lee `finished`. Se resuelve con `true` al finalizar y `false` si se detiene o reemplaza. Un resorte roto puede avanzar una secuencia cuando llega visualmente, como otros resortes.

`decay()` y `animate()` comparten la propiedad. Cada uno comienza desde la posición actual del otro; un resorte iniciado por `animate()` hereda la velocidad actual de desintegración. Un nuevo `decay()` utiliza la velocidad que se le pasa. Las llamadas realizadas antes de cargar esperan la vista y luego leen su posición; detenerse antes de la carga cancela la reproducción.

Las velocidades deben ser finitas. Las entradas cuya proyección se desborde o cuya duración exceda el rango del temporizador de la plataforma se rechazan antes de asumir una animación. Las desintegraciones libres muy largas limitan el recuento de fotogramas clave nativos a 6001.

Esto proporciona el movimiento después de la liberación. El seguimiento de gestos, los límites y el manejo de colisiones están separados.
