# Escala de tiempo y movimiento reducido {#time-scale-and-reduced-motion}

`configure()` cambia la configuración global. Cada uno aplica a animaciones que inician después de la llamada; lo que ya se está reproduciendo mantiene su ritmo. Los valores no válidos se lanzan antes de que algo cambie.

<Clip name="tuning" caption="El patio de recreo a una quinta parte de la velocidad." />

```ts
import { configure } from '@rafaelaugusto/jolt'

configure({ timeScale: 0.2 }) // everything five times slower
configure({ reducedMotion: 'always' }) // transforms jump, opacity still fades
```

## Escala de tiempo {#time-scale}

Afinar un resorte a toda velocidad es una conjetura. En su lugar, ralentice todo:

```ts
configure({ timeScale: 0.2 })
configure({ timeScale: 1 }) // back to normal
```

La escala de tiempo debe ser un número finito positivo. Amplía toda la línea de tiempo de cada animación del motor: duraciones, retrasos, escalonamiento, repeticiones, tiempo de asentamiento del resorte, decaimiento y posiciones de secuencia. `animate()`, `decay()`, `sequence()`, `press()`, `scrollLinked()` y `animateText()` lo siguen, tanto en iOS como en Android, porque Jolt calcula la curva en JavaScript y le entrega a la plataforma su duración.

```ts
configure({ timeScale: 0.5 })
const animation = animate(card, { x: 100 }, { duration: 300, delay: 100 })
animation.duration // 800: the delay and the motion both doubled
```

La trayectoria sigue siendo la misma, solo que más lenta. Los fotogramas clave se muestrean por segundo de reproducción, por lo que un resorte ralentizado mantiene el detalle cerca de su exceso. Una animación que interrumpe una ralentizada aún comienza desde el valor en pantalla, a la velocidad en pantalla. `progress` sigue funcionando de 0 a 1; `duration` informa los milisegundos extendidos.

Las animaciones vinculadas al desplazamiento establecen el progreso a partir del desplazamiento del desplazamiento, por lo que su apariencia no cambia. Los puntos hápticos son fracciones de la línea de tiempo y se mueven con ella.

Los bucles nativos mantienen su propia sincronización: [brillar](./shimmer), [cargadores](./loaders), [imágenes líquidas](./liquid), [partículas](./particles), [Efectos SF Symbol](./symbol-effects) y [revelaciones circulares](./reveal). Las animaciones de la plataforma fuera de Jolt tampoco se modifican.

La configuración de animaciones lentas del simulador iOS solo ralentiza el Core Animation, y el Android no tiene equivalente por aplicación. La escala de tiempo es la misma en ambas plataformas y funciona en dispositivos, lo que la hace útil para compararlos.

## Movimiento reducido {#reduced-motion}

iOS tiene Reducir movimiento y Android tiene Eliminar animaciones. Jolt los sigue por defecto:

```ts
configure({ reducedMotion: 'user' }) // the default: follow the platform setting
configure({ reducedMotion: 'always' }) // reduce regardless, to check the result
configure({ reducedMotion: 'never' }) // play everything
```

Con movimiento reducido, traslación, escala, rotación, [rutas de movimiento](./paths), [esquinas, bordes y sombras](./decorations) y [decadencia](./decay) saltan a sus valores finales en lugar de animarse. Opacity y [colores](./colors) aún se animan, de la misma manera que lo maneja Framer Motion, por lo que el contenido sigue apareciendo y desapareciendo. No hay cambios en la API: `finished` se resuelve con `true`, una secuencia pasa al siguiente paso de inmediato, `press()` se rompe y un grupo escalonado aterriza junto.

```ts
await animate(card, 'fadeInUp') // the card is in place, the fade still plays
```

Repeticiones infinitas y los ajustes preestablecidos de atención permanecen en reposo en lugar de repetirse. La preferencia se lee cuando comienza cada animación, por lo que se aplica un cambio a partir de la siguiente. Los efectos que verifican la plataforma por sí solos siguen la misma preferencia, incluidos `always` y `never`: [texto](./text), [brillar](./shimmer), [cargadores](./loaders), [imágenes líquidas](./liquid), [partículas](./particles), [Efectos SF Symbol](./symbol-effects) y [revelaciones circulares](./reveal).

En iOS la configuración proviene de `UIAccessibilityIsReduceMotionEnabled()`. En Android, Eliminar animaciones establece la escala de duración del animador en cero, que Jolt lee hasta `ValueAnimator.areAnimatorsEnabled()` en Android 8 y versiones posteriores, y desde la configuración global anterior.

## Leyendo la preferencia {#reading-the-preference}

Una pantalla puede hacer más que omitir el movimiento: mostrar una ilustración fija o dejar caer un chapoteo por completo. Lea la misma preferencia que utiliza Jolt:

```ts
import { onReducedMotion, reducedMotion } from '@rafaelaugusto/jolt'

reducedMotion() // true or false, right now
const off = onReducedMotion((reduced) => {
  // called with the new value when it changes
})
off()
```

`reducedMotion()` informa lo que aplica Jolt: la configuración de plataforma con `user`, `true` con `always`, `false` con `never`. `onReducedMotion()` vuelve a llamar solo cuando ese valor cambia, desde `configure()` o desde la plataforma. En iOS, el cambio llega de inmediato, a través de la notificación de Reducir movimiento, incluidos los cambios desde el Centro de control. El observador general Android vuelve a comprobar cuando la aplicación vuelve al primer plano. [Partículas](./particles#platforms-and-timing) también observa la escala del animador de forma nativa: cambiarla a cero cancela los efectos activos inmediatamente, incluso cuando la preferencia de Jolt es `never`.

En Vue, [`useReducedMotion()`](./vue#reduced-motion) proporciona una referencia que se mantiene actualizada hasta que se desmonta el componente.

Para jugar todo y aun así decidir tú mismo, elige `never` y lee la configuración de la plataforma en la aplicación.
