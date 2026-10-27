# Pausa y progreso {#pause-play-and-scrub}

## Observando la reproducción {#observing-playback}

`playbackProgress(animation)` expone el reloj de una animación finita existente como un [valor derivado](./motion-values) de solo lectura. Es compatible con `get()`, `to()` y `subscribe()` y puede controlar objetivos `bind()` nativos. No se necesita ningún temporizador de aplicación ni una segunda animación:

```ts
const drive = animate(car, { path: route }, { duration: 8000, ease: 'linear' })
const progress = playbackProgress(drive)
const releaseBar = bind(bar, { scaleX: progress })
const releaseNumber = progress.subscribe((p) => {
  remainingMeters.value = Math.ceil(routeMeters * (1 - p))
})
drive.pause() // holds the car, binding and observed value
drive.play()
// At destruction: releaseBar(); releaseNumber(); drive.stop()
```

Esta fórmula de distancia supone una trayectoria de velocidad constante, como en la demostración. El progreso de la reproducción es el tiempo transcurrido en la línea de tiempo, no la posición facilitada ni la distancia geográfica. Con la relajación, las pausas a lo largo de una ruta o coordenadas geográficas, mapee el progreso a través de la función de longitud/parámetro real de la ruta.

<Clip name="controlled-playback-ios" caption="La distancia observable y la barra siguen a un automóvil, mientras que una línea de tiempo detiene el automóvil, pulsa, ondula y retrasa el punto de control. Simulador iOS, reproducción en tiempo real." />
<Clip name="controlled-playback-android" caption="Los mismos controles de progreso y reproducción conjunta en un emulador Android. Reproducción nativa real con toques reales." />

El valor sigue el mismo reloj nativo, incluidos retrasos, escalonamiento, repetición/retroceso, cámara lenta y escala de duración del animador Android. Una búsqueda lo actualiza sin cambiar si la reproducción está en pausa. Antes de cargar, lee cero o un progreso pendiente solicitado explícitamente. La finalización lee uno; La cancelación conserva la posición de parada. Una animación completa de duración cero lee uno. Infinitas animaciones y líneas de tiempo cuya duración aún se desconoce rechazan el progreso normalizado.

Los enlaces nativos compilan pistas sin marcos de observación JavaScript. Los suscriptores optan por la fuente de notificación compartida JavaScript a partir de valores de movimiento; las devoluciones de llamada se ejecutan solo cuando JavaScript puede ejecutarse, fusionar cambios y entregar el valor actual después de una parada. El valor actual se puede leer antes de que se resuelva `finished`, pero puede llegar una notificación de suscripción final en el siguiente cuadro después de esa promesa. Darse de baja cuando haya terminado; Los ámbitos pueden poseer suscripciones. Una fuente pausada o asentada no tiene trabajo de observación continua.

`animate(motionValue, ...)` ahora también devuelve `PlaybackAnimation`. Los controles afectan solo a ese canal: al pausar la base no se detiene una capa aditiva independiente. Utilice [`timeline()`](./sequences#joint-playback) para controlarlos juntos. Detener una capa activa aún elimina su contribución; hacer una pausa lo preserva.

## Controles individuales {#individual-controls}

`animate()` y `decay()` devuelven un `PlaybackAnimation`. Pauselo, establezca su progreso y luego continúe:

<Clip name="playback" caption="Reproduce y pausa en una línea de tiempo en ejecución." />

```ts
const animation = animate(card, 'flipInY')
animation.pause()
animation.progress = 0.4
animation.play()
```

`pause()` congela solo las propiedades que posee esta animación. Se siguen ejecutando otra animación en la misma vista, un efecto en un elemento hijo y animaciones de widgets nativos. `play()` se reanuda desde la posición actual. Ambos métodos son idempotentes.

## Progreso {#progress}

`progress` es un número de 0 a 1 sobre **línea de tiempo finita completa**, incluido el retraso inicial, los retrasos por propiedad, las repeticiones, las repeticiones inversas y el escalonamiento. `duration` es la duración de esa línea de tiempo en milisegundos; `paused` informa si se retiene.

```ts
const animation = animate(
  cards,
  { x: [0, 100], opacity: [0, 1] },
  { duration: 1000, stagger: 200 },
)
animation.pause()
animation.progress = 0.5
```

Con dos tarjetas, esta línea de tiempo dura 1200 ms. Al 50%, la primera tarjeta tiene un 60% de su movimiento y la segunda un 40% de su movimiento. Diferentes duraciones de propiedades utilizan el mismo rango de tiempo.

La configuración del progreso conserva el estado de pausa/reproducción. Una animación pausada puede llegar a 1 y retroceder sin detenerse. Una animación de reproducción continúa desde la nueva posición y se completa normalmente. Los valores fuera de 0–1, `NaN` e infinitos se descartan antes de cambiar la reproducción.

Un bucle infinito puede pausar y reproducir, pero no tiene `progress` finito: leerlo o configurarlo arroja. Antes de que se cargue una vista, una duración finita se informa como 0; un progreso solicitado se recuerda y se aplica cuando sus pistas están listas. Un grupo espera a que todos los objetivos estén listos antes de aplicar el progreso solicitado.

## Gestos y controles deslizantes {#gestures-and-sliders}

Crea y pausa la animación una vez. Establecer el progreso en respuesta a la entrada del usuario:

```ts
const animation = animate(card, { rotateY: [0, 180] }, { duration: 1000 })
animation.pause()

slider.on('valueChange', ({ value }) => {
  animation.progress = value / 100 // slider range: 0–100
})

// Continue from the selected frame.
animation.play()
```

Jolt no ejecuta un bucle de cuadros JS para detener o continuar la reproducción. La limpieza se ejecuta sólo cuando estableces el progreso. El patio de juegos tiene Reproducir, Pausa, Parar y un control deslizante, con un pulso independiente para mostrar que otras animaciones siguen en movimiento.

## Interrupción y ciclo de vida {#interruption-and-lifecycle}

La pausa deja `finished` pendiente. `stop()` congela la posición actual y resuelve con `false`; la descarga también se detiene y libera recursos nativos. Una animación que se hace cargo lee la posición controlada. Una pista en pausa tiene velocidad heredada cero; una pista reanudada hereda la velocidad de su curva original en esa posición.

Las propiedades más cortas y las vistas escalonadas se pueden rebobinar mientras la animación que las contiene aún está activa. Una propiedad asumida por otra animación, o modificada después de su finalización, no se recupera mediante una limpieza. Las animaciones completadas y detenidas permanecen terminales: los controles no las reinician. Crea otra animación para reproducir.

Los objetos de secuencia mantienen el ciclo de vida base `Animation`. Controle un paso específico conservando el `PlaybackAnimation` devuelto por `animate()` o `decay()`. Detener un paso antes de su llegada detiene el siguiente paso; una llegada que ya ocurrió no se puede deshacer. Efectos como `animateText()`, `reveal()` y `symbolEffect()` conservan sus propios controles documentados y no exponen el progreso genérico.

Los hápticos esperan durante una pausa y reanudan con la línea de tiempo restante. La búsqueda silenciosa salta los puntos que cruza; buscar hacia atrás nunca reproduce la retroalimentación consumida.

## Temporización nativa {#native-timing}

En iOS, cada `CAAnimation` tiene su propia velocidad y compensación de tiempo. Jolt deja intacta la sincronización de la capa, incluidas las capas que Core usa para colores y sombras. Reemplazar una copia de CA durante un comando de control no puede cumplir la promesa original mediante una devolución de llamada de finalización obsoleta.

En Android, la pausa/reanudación nativa controla los animadores existentes. Una búsqueda reposiciona sus fotogramas clave, incluidas las fases de retraso y repetición. Las animaciones activas comparten un marcador nativo de tiempo transcurrido para respetar la escala de duración del animador del sistema. Jolt elimina ese marcador cuando cada propietario hace una pausa y comienza uno nuevo en el reanudación, evitando la corrección del reloj en pausa de Android; se libera después de que se asienta el último propietario. Ninguno de estos marcadores llama a JavaScript por cuadro. La limitación de subprocesos de interfaz de usuario de Android sigue siendo [aplica](./android-performance).

Cuando la aplicación se detiene explícitamente antes de entrar en segundo plano, las vistas retienen esa pausa a través de la descarga raíz temporal de iOS de NativeScript. La reanudación sigue siendo explícita. Una descarga de navegación en primer plano aún cancela la reproducción.
