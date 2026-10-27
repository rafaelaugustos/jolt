# Secuencias {#sequences-and-timelines}

## Reproducción conjunta {#joint-playback}

`timeline(steps)` acepta las mismas tuplas de vista y posiciones que `sequence()`, además de tuplas de valores de movimiento y fábricas reproducibles:

```ts
const scene = timeline([
  [car, { path: route, orient: true }, { duration: 8000, ease: 'linear' }],
  [pulse, 1, { duration: 1000, repeat: 7, repeatType: 'reverse', at: '<' }],
  { at: 0, run: () => imageEffect(image, 'ripple', { duration: 8000 }) },
  [checkpoint, 'fadeIn', { at: 4000 }],
])
scene.pause()
scene.play()
await scene.finished
```

<Clip name="controlled-playback-ios" caption="Un control de pausa congela el movimiento activo, una onda y un punto de control futuro, luego reanuda el tiempo restante. Simulador iOS, en tiempo real." />
<Clip name="controlled-playback-android" caption="Pausa y reanudación de la línea de tiempo conjunta con entrada real en un emulador Android, en tiempo real." />

La pausa retiene a los participantes en ejecución y los lanzamientos futuros, incluidos los espacios y las superposiciones. La reproducción se reanuda desde esa posición sin reiniciar los efectos ni contar el intervalo del reloj de pared en pausa. Ambos comandos son idempotentes. Detener cancela el trabajo activo y pendiente, resuelve `finished` con falso y permanece terminal. Un ámbito puede crear `scope.timeline(steps)` o poseer el identificador devuelto.

Los participantes deben exponer `pause()`, `play()` y `paused`, así como el ciclo de vida de la animación. Ver animaciones, animaciones de valores de movimiento, líneas de tiempo anidadas, efectos de imagen y [animaciones de propiedades nativas](./native-properties) lo admiten. Las funciones de limpieza como `shimmer()` y las animaciones solo de base como `animateText()` no lo hacen. Los resultados de devolución de llamada no admitidos rechazan `finished` y limpian el trabajo ya iniciado y pendiente. Las fábricas funcionan en el momento de la activación, por lo que sus capacidades no se pueden inspeccionar antes de que regresen. Sus efectos secundarios no relacionados son responsabilidad del autor de la fábrica.

| Participante                             | Pausa/reanudación conjunta                    | Duración                                                   |
| ---------------------------------------- | --------------------------------------------- | ---------------------------------------------------------- |
| Vista/ruta `animate()` y `decay()`       | Sí                                            | Finito o infinito                                          |
| `animate(motionValue)` y capas escalares | Sí                                            | Finito o infinito                                          |
| `imageEffect()`                          | Sí                                            | Finito; la distorsión es infinita                          |
| Adaptador nativo `.animate()`            | Sí                                            | Finito o infinito                                          |
| Línea de tiempo anidada                  | Sí                                            | Puede permanecer desconocido hasta que se active cada paso |
| Fábrica personalizada                    | Debe implementar el contrato de reproducción. | Opcional; el progreso agregado lo requiere                 |
| `animateText()` y funciones de limpieza  | No; utilizar `sequence()`                     | No aplicable                                               |

La línea de tiempo no ofrece un definidor de búsqueda genérico: las devoluciones de llamada, la háptica y los efectos táctiles no se pueden rebobinar de forma segura como grupo. `duration` es `undefined` hasta que cada paso esté activo, listo y declare una duración, luego el final máximo programado (o Infinity para trabajo interminable). `playbackProgress(scene)` estará disponible una vez que esta duración sea finita. Observe una pista principal finita conocida cuando la composición también contiene efectos interminables o aún no planificados. Utilice mangos nuevos en las fábricas; La adopción de controladores que ya están en ejecución no rebobina ni realinea su reproducción anterior.

Un padre reanuda solo los hijos que pausó. Un elemento hijo detenido de forma independiente permanece en pausa, y los controles detenidos/terminados permanecen terminales. La búsqueda independiente de elementos hijos o los retrasos manuales pueden invalidar el final calculado de la línea de tiempo; controlar la escena a través de su padre cuando se utiliza el progreso agregado. La interrupción infantil preserva las reglas existentes de llegada/propiedad de la secuencia y hace que la finalización final sea falsa.

Las pistas nativas conservan la reproducción nativa. JavaScript se ejecuta en los límites de activación y control, por lo que el JavaScript bloqueado puede retrasar el lanzamiento de una nueva fábrica. Esta API no afirma la ejecución nativa de devoluciones de llamada arbitrarias. Los propietarios de aplicaciones pueden pausar en segundo plano y reanudarlas explícitamente, como lo hace la demostración.

## Reproducción secuencial {#sequential-playback}

Sin una posición, cada paso comienza una vez que el anterior parece terminado:

<Clip name="timeline" caption="Pasos superpuestos y pasos en orden." />

```ts
await sequence([
  [logo, 'popIn'],
  [[title, subtitle], 'fadeInUp', { stagger: 80 }],
  () => animate(button, 'fadeIn'),
])
```

Cada tupla toma los mismos argumentos que `animate()`, más `at` en sus opciones. Una devolución de llamada puede iniciar y devolver una animación. Los resortes cuentan como llegados cuando permanecen cerca de su objetivo, antes de asentarse por completo.

## Superposición y posiciones fijas {#overlap-and-fixed-positions}

```ts
sequence([
  [logo, 'popIn'],
  [title, 'fadeInUp', { at: '-150' }],
  [buttons, 'fadeIn', { at: '<', stagger: 50 }],
  [footer, 'fadeIn', { at: 900 }],
])
```

| `at`     | Inicia el paso                            |
| -------- | ----------------------------------------- |
| omitido  | A la llegada del paso anterior            |
| `'-150'` | 150 ms antes de esa llegada               |
| `'+100'` | 100 ms después de esa llegada             |
| `'<'`    | Junto con la activación del paso anterior |
| `900`    | A 900 ms del origen de la secuencia       |

Todas las posiciones utilizan milisegundos de tiempo de animación. Una posición numérica es absoluta y no negativa; un desplazamiento relativo es una cadena decimal con signo. Las posiciones absolutas son independientes de los pasos anteriores y pueden aparecer fuera de orden cronológico. Cada paso no posicionado sigue al **paso anterior listado**, no a la animación que termine en último lugar.

`'<'` se refiere a la activación antes del propio `delay` de un paso. Ese retraso y sus retrasos por propiedad aún se aplican. Por ejemplo, dos pasos que comparten un inicio con retrasos de 200 y 50 ms comienzan a separarse 150 ms.

El primer paso utiliza el origen de la secuencia como referencia: `'<'`, `'-150'` y `0` comienzan inmediatamente; `'+100'` espera 100 ms. Una compensación negativa que precedería a la activación de su predecesor se fija en esa activación. El programador no rebobina una animación para recuperar un inicio perdido.

Para combinar un resorte con nombre con una posición, use su forma de objeto:

```ts
import { sequence, springs } from '@rafaelaugusto/jolt'

sequence([
  [card, 'popIn'],
  [title, 'fadeInUp', { ...springs.bouncy, at: '-100' }],
])
```

## Llegadas y carga {#arrivals-and-loading}

Las compensaciones negativas utilizan el pronóstico de llegada de las pistas reales, incluido el retraso inicial, el tiempo por propiedad, las repeticiones y la última vista escalonada. Un objetivo descargado espera hasta que existan sus huellas antes de proporcionar un pronóstico. Los tiempos de activación absolutos siguen siendo independientes; sus objetivos aún esperan a cargarse antes de que pueda comenzar la reproducción nativa.

Una devolución de llamada que devuelve `animate()` o `decay()` también proporciona un pronóstico. Pausar, jugar o buscar ese identificador reprograma a un seguidor negativo pendiente. Una vez que un seguidor ha comenzado, los cambios posteriores no lo deshacen ni lo reproducen.

Un efecto arbitrario, una animación personalizada o una secuencia anidada no exponen un pronóstico. Puede preceder a un paso no posicionado, un desplazamiento positivo o `'<'`; un desplazamiento negativo después de rechazar `finished` con un error de configuración y cancelar el otro trabajo de la secuencia. Una animación interminable no tiene previsión finita; sus relativos seguidores esperan hasta que sea interrumpido. Las posiciones absolutas aún pueden iniciar otros pasos.

Las compensaciones positivas siguen al **llegada real**. Si el paso anterior se interrumpe antes de su pronóstico, la espera adicional comienza en esa interrupción. Un seguidor negativo pendiente también avanza cuando su predecesor es interrumpido en lugar de mantener un plazo obsoleto.

## Valores iniciales y propiedad {#starting-values-and-ownership}

Las vistas posteriores toman su primer fotograma clave absoluto cuando se crea la secuencia, por lo que permanecen ocultas hasta su turno. La preparación mantiene el orden de la lista: el primer paso de la lista que afecta a una propiedad proporciona su estado inicial, incluso en posiciones absolutas fuera de orden cronológico. Los fotogramas clave relativos y `null` leen el valor actual cuando se activa su paso.

Los pasos superpuestos en la misma propiedad utilizan [reglas de interrupción](./interrupting) normal: la activación posterior toma el control del valor y la velocidad en pantalla. Los primeros fotogramas clave explícitos todavía establecen un comienzo explícito. Las diferentes propiedades y vistas siguen siendo independientes.

## Finalización y limpieza {#completion-and-cleanup}

La secuencia llega una vez iniciado y llegado el paso **cada**. Su promesa `finished` espera a que todas las animaciones iniciadas terminen de establecerse, incluidos los pasos superpuestos más largos. Se resuelve con `false` si algún paso fue interrumpido o detenido. Esto incluye la superposición deliberada de la misma propiedad.

`stop()` cancela futuros lanzamientos y detiene todos los pasos activos o de establecimiento. Llámelo cuando el propietario de una línea de tiempo abandone la pantalla:

```ts
const animation = sequence(steps)
onUnmounted(() => animation.stop())
```

El identificador devuelto conserva el ciclo de vida básico `Animation`; La pausa y la limpieza de toda la línea de tiempo no están expuestas. Se lanzan posiciones no válidas antes de iniciar o aplicar fotogramas clave. Los errores al crear una devolución de llamada o un paso retrasado rechazan `finished` después de cancelar el otro trabajo; la cancelación de reproducción se resuelve con `false`.

## Temporización nativa {#native-timing}

En Android, los temporizadores de posición y el reloj de línea de tiempo absoluto siguen el **Escala de duración del animador** del sistema. Con las animaciones deshabilitadas, los pasos posicionados avanzan sin esperar la duración solicitada. iOS utiliza su reloj de animación.

JavaScript se ejecuta cuando se activa un paso, no una vez por cuadro de animación. Un hilo JS bloqueado puede retrasar el lanzamiento; esta API no puede iniciar nuevos pasos creados por JS mientras JavaScript no esté disponible. Una vez que comienza un paso, se aplican sus límites de plataforma y reproducción nativa normal.

El patio de juegos compara superposiciones, llegadas secuenciales y horarios fijos utilizando la misma entrada.
