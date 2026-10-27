# Arrastrar, lanzar y ajustar {#drag-fling-and-snap}

`drag()` sigue un solo dedo, restringe la traducción y lleva la velocidad de liberación a una animación nativa. Agregado en beta.8.

<Clip name="drag-ios" caption="Arrastre real con liberación limitada, banda elástica y tres puntos de ajuste del panel en el simulador iOS." />

```ts
import { drag } from '@rafaelaugusto/jolt'

const panel = drag(sheet, {
  axis: 'y',
  bounds: { top: 0, bottom: 600 },
  snap: [0, 300, 600],
  rubberband: true,
})

panel.dispose()
```

## Coordenadas y liberación {#coordinates-and-release}

`axis` es `'x'`, `'y'` o `'both'` (predeterminado). Los límites y puntos de ajuste son **coordenadas de traslación absolutas en DIPs**, en relación con la posición de diseño de la vista. No son coordenadas de pantalla ni el rectángulo de un contenedor. Configure usted mismo `right` según la distancia de viaje disponible; `drag()` no mide el tamaño de la tarjeta y lo resta. Los bordes omitidos son ilimitados. Los límites deben ser finitos y ordenados; Los bordes iguales bloquean un eje.

Snap acepta una matriz para cada eje habilitado, o `{ x: [...], y: [...] }`. Los puntos deben ser finitos, no vacíos y estar dentro de los límites de ese eje. Gana el punto más cercano al aterrizaje de desintegración proyectado; Los lazos eligen el primero en la lista. Por tanto, la velocidad afecta la selección. Sin ajuste, la vista desacelera con `friction` (`0.998` predeterminado, estrictamente entre 0 y 1, retenido cada milisegundo).

Los límites estrictos son los predeterminados: el seguimiento y la liberación permanecen dentro de los límites. Con `rubberband: true`, arrastrarse más allá de un borde encuentra una resistencia cada vez mayor. Una liberación fuera de los límites vuelve. Un lanzamiento que alcanza un límite transmite su velocidad restante a un resorte de borde. Un chasquido utiliza un resorte críticamente amortiguado que transmite la velocidad de liberación; La banda elástica le permite exceder brevemente los límites. Un eje de ajuste omitido mantiene la descomposición libre.

Una traducción existente se conserva cuando comienza el seguimiento. Un nuevo gesto interrumpe los ejes seleccionados en su presentación actual; otras propiedades siguen animando. Tocar durante una liberación detiene esa liberación inmediatamente. Si el tacto nunca se convierte en una panorámica, la vista permanece en esa posición. Configurar límites/ajuste antes de la creación; Se copian las opciones. Deséchelos y vuelva a crearlos para cambiarlos después de los cambios de diseño.

## Conducir un valor de movimiento {#driving-a-motion-value}

Con `value`, el gesto mueve un [valor de movimiento](./motion-values#dragging) en lugar de la vista, por lo que una hoja puede mover la página detrás de ella, un fondo y cualquier otra cosa vinculada a ese valor. El eje es `'x'` o `'y'` y los límites y puntos de ajuste están en las unidades del valor:

```ts
const y = motionValue(380)
bind(sheet, { y })
bind(backdrop, { opacity: y.to([0, 380], [0.5, 0]) })
drag(sheet, { axis: 'y', value: y, bounds: { top: 0, bottom: 380 }, snap: [0, 190, 380] })
```

## Eventos {#events}

```ts
drag(card, {
  axis: 'x',
  bounds: { left: -160, right: 160 },
  snap: [-160, 0, 160],
  onStart: ({ x, y }) => highlightCard(),
  onMove: ({ x, y, velocityX, velocityY }) => updateReadout(x, y),
  onRelease: ({ target, animation }) => {
    void animation.finished.then((completed) => {
      if (completed) savePosition(target)
    })
  },
  onCancel: () => clearHighlight(),
  onSettle: ({ x, y }) => clearHighlight(),
})
```

Las posiciones y velocidades utilizan DIPs y DIPs/segundo. Los ejes deshabilitados tienen velocidad cero. Más allá de un borde, la velocidad informada incluye la resistencia de la banda elástica. `onRelease` recibe el proyectado `target` en reposo y el `PlaybackAnimation` que juega hacia él. `onSettle` se activa solo después de completarse exitosamente. Los identificadores de versión reemplazados o cancelados resuelven `false`; efectos de finalización de guardia en consecuencia. Las devoluciones de llamada podrán cancelar o disponer de su propio controlador. Mantenga las devoluciones de llamada de movimiento ligeras.

## Propiedad y ciclo de vida {#ownership-and-lifecycle}

```ts
const motion = motionScope() // or useMotionScope() in Vue setup
const controller = motion.drag(card, { axis: 'x' })

controller.position // current motion position; x and y
controller.dragging
controller.settling
controller.cancel() // freeze current input/release, remain subscribed
controller.pause() // cancel and detach input
controller.play() // accept a fresh gesture
motion.dispose() // remove listeners and cancel owned release
```

`pause()` cancela, en lugar de mantener un gesto o soltar para reproducirlo más tarde. Lo llama suspensión de alcance; El reanudación de alcance acepta nuevos gestos. Un controlador pausado manualmente permanece en pausa durante la suspensión del alcance. La descarga nativa y la suspensión de la aplicación cancelan la entrada/liberación y desconectan los oyentes de gestos. Vuelva a cargar/reanudar la conexión mientras el controlador esté activo y no en pausa manualmente. El `dispose()` explícito es terminal e idempotente. Un segundo `drag()` en la misma vista dispone del primero; Las opciones no válidas dejan la primera intacta. La eliminación solo detiene su propio controlador de liberación, preservando las animaciones más nuevas iniciadas por otros propietarios.

La cancelación congela la posición actual, incluso si está fuera de los límites. No produce una devolución de llamada de aventura, liberación o acuerdo. La cancelación multitáctil y de gestos nativos cancela el gesto. `isEnabled = false` impide el seguimiento. El movimiento reducido mantiene el seguimiento directo de los dedos y aplica inmediatamente el objetivo en reposo después del lanzamiento.

## Comportamiento y alcance de la plataforma {#platform-behavior-and-scope}

El seguimiento utiliza las devoluciones de llamada panorámicas sincrónicas del subproceso principal de NativeScript y las escrituras de propiedades de JavaScript. iOS utiliza la traslación/velocidad de `UIPanGestureRecognizer` en las coordenadas principales. Android estima la velocidad a partir de una ventana reciente de marcas de tiempo y posiciones de eventos de movimiento sin procesar, evitando la retroalimentación a medida que el objetivo se mueve. Las curvas de liberación se muestrean una vez y se reproducen con los controladores de fotogramas clave nativos existentes; no hay ningún bucle por fotograma JavaScript después del lanzamiento. Un hilo JavaScript ocupado aún puede retrasar el seguimiento de los dedos y las devoluciones de llamadas de aplicaciones. Android tiempo de ejecución principal JavaScript comparte el hilo de la interfaz de usuario con Ver animaciones: [la reproducción de la versión nativa también puede detenerse bajo un trabajo intenso en el hilo principal](./android-performance).

Utilice una cadena de padres/ancestros sin transformar para hacer coincidir las coordenadas de traducción Android/iOS. Esta API no coordina gestos competitivos ni desplazamiento anidado, no realiza pruebas de reordenamiento ni proporciona una hoja inferior de producción. El arbitraje de gestos NativeScript/OS aún se aplica: un desplazamiento principal puede tomar el control y cancelar un arrastre, y los reconocedores iOS pueden ejecutarse simultáneamente. La demostración coloca el panel vertical en una pantalla dedicada sin desplazamiento. Utilice [gestos nativos](./gestures) para reconocimiento y transferencia simultáneos entre un panel y su ScrollView.

Abra **Arrastra, arroja y ajusta** en el patio de juegos, o inicie con `--drag-lab` en iOS / `--es drag-lab true` en Android. La demostración incluye decadencia de tarjeta limitada, un panel con tres paradas, pausar/reanudar, desmontar/remontar y movimiento reducido.

Para contenido que debe permanecer interactivo durante el lanzamiento nativo, registre un [superficie de interacción](./interaction-surface) en su contenedor antes de iniciar la reproducción. Esto está habilitado en la demostración de arrastre.
