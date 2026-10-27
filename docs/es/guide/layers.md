# Movimiento por capas {#layered-motion}

Una propiedad normalmente tiene una animación a la vez: una nueva la reemplaza. En su lugar, se reproduce una capa junto a ella. Una sacudida se suma a un arrastre, un pulso respiratorio continúa mientras la tarjeta se mueve y una presión escala una tarjeta que aún está entrando:

```ts
animate(card, { x: 120 }, 'snappy') // the base
animate(card, 'shake', { layer: 'feedback' }) // on top of it
```

<Clip name="layers-ios" caption="Una capa de respiración continúa mientras la tarjeta se mueve y se sacude, luego la tarjeta es arrastrada, en el simulador iOS. Reproducción en tiempo real." />

## Cómo se combinan las capas {#how-layers-combine}

Una capa recibe el nombre de la opción `layer`. Sus fotogramas clave son los que añade: traslaciones y rotaciones **agregar** a la base y a otras capas, escala y opacidad **multiplicar**. Una sacudida es `x: [0, -10, 10, 0]` alrededor de donde esté la tarjeta, y un pulso es `scale: [1, 1.08, 1]` de cualquier escala que tenga. Los ajustes preestablecidos relativos, como `shake`, `pulse` y `heartbeat`, funcionan como capas sin cambios.

```ts
animate(card, { y: -8 }, { duration: 200, layer: 'hover' }) // stays lifted
animate(
  card,
  { scale: [1, 1.08] },
  {
    duration: 700,
    repeat: Infinity,
    repeatType: 'reverse',
    layer: 'breathe',
  },
)
```

Las capas se aplican a `x`, `y`, `scale`, `scaleX`, `scaleY`, `rotate`, `rotateX`, `rotateY` y `opacity`. Los colores, las esquinas, los bordes, las sombras y los caminos mantienen un solo dueño. Una capa toma cada transición que hace `animate()` y devuelve la misma animación, con `pause()`, `play()` y `progress`. También funciona en secuencias, alcances y estados de movimiento.

## Reemplazo y parada {#replacing-and-stopping}

Cada capa funciona como una propiedad propia. Una nueva animación en la misma capa la reemplaza, a partir de lo que la capa agrega en ese momento y con su velocidad. Una nueva animación sin capa reemplaza la base y deja las capas en ejecución. Con [movimiento reducido](./configure#reduced-motion), las capas de transformación llegan a su final y las capas de opacidad siguen reproduciéndose.

```ts
stop(card, ['x'], { layer: 'feedback' }) // that layer stops, and what it adds goes away
stop(card, undefined, { layer: 'hover' }) // also after it finished
stop(card) // everything stops; what is on screen becomes the new value
```

Para eliminar una capa, anímala de nuevo a nada: `animate(card, { scale: 1 }, { duration: 250, layer: 'breathe' })`.

Un arrastre mantiene sus capas: mientras arrastras, se produce una sacudida o un pulso en la misma vista.

<Clip name="layers-android" caption="La tarjeta se agita mientras se arrastra y su capa de respiración se enciende y apaga, en el emulador Android. Reproducción en tiempo real." />

## Cómo se juega {#how-it-plays}

Si bien una propiedad tiene capas, Jolt reproduce su base y sus capas como una pista nativa compuesta. Muestra la composición cuando algo cambia: una animación comienza, termina, se detiene, busca o se detiene, o un arrastre mueve la base. No se ejecuta nada en JavaScript entre esos momentos. Las capas infinitas se convierten en un bucle nativo sobre el mínimo común múltiplo de sus períodos, hasta 30 segundos; más allá de eso, la composición se vuelve a muestrear cada pocos segundos. Cuando la última capa desaparece y no agrega nada, la propiedad vuelve a una animación simple.

## Valores de movimiento {#motion-values}

[`animate(value, target, { layer })`](./motion-values#layers-on-a-value) agrega contribuciones escalares antes de todas las asignaciones derivadas. Las capas de valor utilizan cero como neutral, incluso cuando se asignan a escala u opacidad. Consulte la guía de valores de movimiento para detener, arrastrar y composición nativa.
