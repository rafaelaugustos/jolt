# Drop, cues y profundidad

Disponible en `0.1.0-rc.12`. Las seis capacidades tienen contratos nativos y Web explícitos. Destruye el scope al desmontar. Las entradas Web opcionales son seguras para SSR; crea el runtime y resuelve destinos después de montar.

El Android antiguo sirve para compatibilidad. A petición del mantenedor, la validación física de rendimiento queda pendiente de un teléfono más reciente; estos vídeos y datos exploratorios no demuestran ventajas de CPU/PSS.

## Zonas de destino

`dropZones(view, options)` nativo y `runtime.dropZones(element, options)` Web coordinan destinos dentro de la aplicación; ambos scopes ofrecen `dropZones`. Define `targets` con id, target, prioridad y aceptación síncrona. `onDrop` puede devolver un recurso con stop/dispose o limpieza; `drag: { snap: [0] }` conserva el retorno al rechazar.

El centro del origen debe entrar en el rectángulo del destino; `hitTest: 'overlap'` exige intersección positiva. Gana la prioridad mayor y después el orden declarado. Un rechazo no busca otro destino. La geometría se comprueba al soltar. `request(id)` permite botón/teclado sin intersección, respetando disponibilidad y aceptación; no modifica datos ni cambia contenedores.

El efecto se cancela al volver a arrastrar, pausar, eliminar el destino o destruir. `refresh()` actualiza cambios de layout. Nativo usa DIPs en una ventana y Web píxeles CSS en un documento. Son rectángulos, no oclusión/píxeles ni importación de archivos. Rigen los límites del drag con padres transformados. El ScrollView del ejemplo deja libre el gesto. La aplicación mantiene foco, anuncios y alternativa accesible.

<Clip :autoplay="false" name="interaction-drop-ios" caption="Simulador iOS 26.2: reproducción nativa con interacción XCTest real. Rechazo, aceptación, botón alternativo y remontaje." />
<Clip :autoplay="false" name="interaction-drop-android" caption="ASUS ZenFone 3 físico, Android 8: toques reales mediante ADB. Rechazo, aceptación, botón alternativo y remontaje." />
<Clip :autoplay="false" name="interaction-drop-web" caption="Chromium: interacción real; el inspector utiliza WebGL por software. Rechazo, aceptación, botón alternativo y remontaje." />

### Inserción ordenada {#ordered-insertion}

Un tablero que reordena tarjetas dentro de columnas necesita algo más que soltar sobre una columna: un asa que inicie el arrastre, la posición de la tarjeta mientras se mueve, columnas fáciles de alcanzar aunque sean cortas y una tarjeta que siga bajo el puntero mientras el tablero abre un hueco. La Web y NativeScript comparten el mismo contrato:

```ts
const drop = scope.dropZones(card, {
  targets: [
    { id: 'todo', target: todo, padding: { bottom: 60 } },
    { id: 'done', target: done, padding: { bottom: 60 } },
  ],
  drag: { handle: grip, snap: [0] },
  // Coloca el hueco antes de la primera tarjeta cuyo punto medio quede bajo el centro de la tarjeta.
  onMove: ({ id, bounds }) => showGap(id, bounds.y + bounds.height / 2),
  onLeave: () => hideGap(),
  onDrop: ({ id }) => moveCard(id),
})
```

**Asa.** `drag.handle`, que también acepta `drag()`, toma la entrada de un elemento dentro del origen en la Web (puede ser un `<button>`, que conserva su propio manejo de teclado) o de una vista descendiente en NativeScript. Solo el asa inicia el arrastre, y el origen se mueve. En la Web solo el asa recibe `touch-action` y la captura del puntero, así que el resto del origen conserva sus clics, controles y desplazamiento táctil; los elementos interactivos dentro del asa siguen sin iniciar arrastres, y un clic en el asa justo después de arrastrar se suprime. En NativeScript solo el asa recibe el reconocedor de pan, así que el resto del origen conserva sus toques y un ScrollView alrededor puede recibir el gesto. Un asa fuera del origen, o el propio origen, lanza `TypeError` antes de cambiar la entrada. Un asa que sale del origen, se desactiva o queda inerte cancela el contacto.

**Posición durante el movimiento.** `onMove({ id, source, bounds, method: 'drag' })` se llama en cada movimiento del arrastre, después de la prueba de acierto: `id` es el destino bajo el origen o `undefined`, y `bounds` es una copia de los límites visuales del origen en las coordenadas de los destinos. La aplicación coloca el punto de inserción sin listeners de puntero propios. `request()`, `refresh()` y la suelta no informan movimientos, y no se informa nada después de cancelar, pausar, suspender o destruir. NativeScript también informa la primera muestra del pan. Un error lanzado en `onMove` cancela el arrastre, como en los demás callbacks.

**Margen de acierto.** El `padding` de un destino amplía su área de acierto con un número o por borde (`{ top, right, bottom, left }`): píxeles CSS en la Web, DIPs en NativeScript. Cada borde debe ser finito y de 0 a 1.000; otros valores lanzan `RangeError` al crear las zonas. `center` y `overlap` usan el rectángulo ampliado, y un destino con límites vacíos sigue sin acierto. El margen es invisible; dibújalo cuando el usuario necesite verlo. El `dropHits(source, target, policy, padding)` exportado aplica la misma regla.

**Cruzar contenedores.** El origen tiene que seguir visible mientras se mueve, y los layouts de NativeScript recortan a sus hijos por defecto. En iOS, define `clipToBounds = false` en los contenedores que cruza el origen, o desaparece de la vista. En Android `clipToBounds` no tiene efecto: llama a `setClipChildren(false)` en esos `ViewGroup` y en sus padres, porque Android trata como oculto un origen recortado por un ancestro y Jolt cancela entonces el arrastre. Las vistas dibujadas después cubren el origen, así que dibuja al final el contenedor que lo contiene, como hace el tablero del demo. En la Web, eleva el origen con `z-index` cuando un contenido posterior lo cubriría.

**Reanclaje.** Durante el arrastre, cada movimiento y cada `refresh()` comparan el centro de layout del origen (su centro visual sin la traslación del arrastre) con el del inicio y compensan la traslación con la diferencia. Un hueco insertado encima de la tarjeta la deja bajo el puntero. La Web se actualiza sola tras inserciones y eliminaciones en el DOM y los cambios de atributos que Jolt observa; NativeScript, tras el `layoutChanged` del origen, que se emite cuando su frame cambia dentro del padre. Los cambios hechos solo con estilos en la Web y los desplazamientos de un ancestro en NativeScript se compensan en el siguiente movimiento; llama a `refresh()` justo después para evitar un salto de un frame. Solo se compensan los ejes arrastrados, los `bounds` del arrastre siguen limitando la traslación, y escalar el origen alrededor de un punto que no es el centro durante el arrastre cuenta como cambio de layout. Las muestras de velocidad se desplazan con la traslación, así que un reanclaje no se convierte en un lanzamiento.

**Suelta, cancelación y movimiento reducido.** En ambas plataformas el drop se decide con la entrada final antes de que empiece el movimiento de retorno. La cancelación (`cancel()`, pausa, documento oculto, pérdida de foco de la ventana o desplazamiento en la Web, suspensión de la aplicación en NativeScript) congela el origen donde está, detiene los informes de movimiento y llama a `onLeave` para el destino bajo el origen, para que la aplicación quite el hueco; el layout que cambie después no se compensa. El movimiento reducido mantiene el seguimiento directo; una suelta rechazada o fuera de destinos vuelve sin animación. Mantén los movimientos por teclado en controles de la aplicación, como hace el asa del ejemplo con las flechas y `request()`.

<Clip :autoplay="false" name="interaction-depth-drop-web" caption="Chromium: ratón y teclado reales. El cuerpo de la tarjeta conserva su botón y desplazamiento, el asa (un botón) arrastra, se abre un hueco encima de la tarjeta mientras sigue bajo el puntero, soltar bajo la columna Done corta acierta su margen de 60 px, el destino bloqueado rechaza y una flecha devuelve la tarjeta." />
<Clip :autoplay="false" name="interaction-depth-drop-ios" caption="Simulador iOS: toques XCTest reales en el tablero nativo. Solo el asa de 36 DIP arrastra, el hueco encima de la tarjeta la reancla, la columna Done con margen acepta, el destino bloqueado rechaza y el movimiento reducido vuelve al instante. No es una grabación en un dispositivo físico." />
<Clip :autoplay="false" name="interaction-depth-drop-android" caption="Emulador Android: toques ADB reales en el mismo tablero nativo: arrastre solo por el asa, reanclaje con el hueco, aceptación con margen, rechazo y movimiento reducido. No es una grabación en un dispositivo físico." />

## Audio opcional y cues

`audioCue` se importa de `@rafaelaugusto/jolt/audio` o `@rafaelaugusto/jolt/web/audio`. Nativo: `scope.resource(() => audioCue('~/assets/cue.wav'))`; Web: `scope.add(audioCue(document, '/cue.wav'))`. Archivos locales en nativo; misma procedencia HTTP(S) o blob local en Web. Espera `ready` e inicia desde una acción del usuario. Fallos devuelven false y notifican onError sin impedir la animación visual.

Una cue posee una voz. `sound.play()` reemplaza; `voice.play()` retoma sin repetir una voz terminada. Pause conserva tiempo, stop cancela y rebobina, mute cambia volumen sin detener el reloj. Background/visibilidad suspenden; una pausa manual permanece al volver. Dispose libera player/listeners. Los backends AVAudioPlayer, MediaPlayer y HTMLAudioElement poseen el reloj sin un loop de audio por frame de Jolt.

Web: `scope.withTimelineCues(motion, [{ name: 'impact', at: 300, effect: () => sound.play() }])`; nativo: `scope.add(withTimelineCues(motion, cues))`. Seek cancela efectos sin disparar en el destino; cruces futuros pueden disparar de nuevo. **Velocidad de audio fija 1, sin seek/progress**. Time scale visual modifica futuros disparos, no estira sonidos activos. Reduce Motion suprime cues de timeline; audio directo sigue siendo explícito. No hay sincronismo exacto por muestra.

iOS ambient respeta la política de silencio y mezcla. Una sesión no ambient requiere `iosSession: 'application'`; solo se restaura una configuración aún poseída. Interrupciones iOS paran la voz. Android usa atributos de sonificación y suspensión de aplicación, sin solicitar audio focus ni coordinar interrupciones globales. Autoplay Web puede fallar. Streaming, grabación, loops y mixer quedan fuera. **Los vídeos no contienen audio; la finalización nativa se verifica aparte. No se ha validado el interruptor de silencio de un iPhone físico.**

<Clip :autoplay="false" name="interaction-audio-ios" caption="Simulador iOS 26.2: reproducción nativa con interacción XCTest real. Pause, seek silencioso, mute y replay. Captura sin audio; finalización verificada aparte." />
<Clip :autoplay="false" name="interaction-audio-android" caption="ASUS ZenFone 3 físico, Android 8: toques reales mediante ADB. Pause, seek silencioso, mute y replay. Captura sin audio; finalización verificada aparte." />
<Clip :autoplay="false" name="interaction-audio-web" caption="Chromium: interacción real; el inspector utiliza WebGL por software. Pause, seek silencioso, mute y replay. Captura sin audio; finalización verificada aparte." />

## Inspector y replay semántico

El inspector nativo incorpora `adapters`; Web usa `@rafaelaugusto/jolt/web/inspector`, con `development: true`. `adapters.watch(property, id)`, `activity(activity, id)` y `label(playback, label)` conectan propiedades, propietarios y renderización. `read()` inspecciona bajo demanda sin timer ni render adicional.

Web ofrece watch(element,id), track(playback,id), control(id,comando,progress), tune(settings,apply) y springCode. La aplicación conserva sus handles y decide el reemplazo en apply; no aparece un propietario oculto. Puede prestar diagnostics existente sin transferir su destrucción. Máximo 128 recursos, historial de 8–2.000 eventos e IDs sin datos personales. Destinos desconectados/destruidos desaparecen al leer.

Eventos incluyen inicio, reemplazo, binding, pausa, reproducción, seek, cancelación, finalización y destrucción. Valores vienen del adapter, no necesariamente de presentación. Los tiempos cubren **preparación/lectura/escritura JS**, no muestreo nativo, GPU ni bytes totales asignados. updateMs no representa todo el bridge ni el renderer asíncrono. Android demuestra tres propiedades de dibujo sin shader; iOS añade tres uniforms SceneKit; Web usa WebGL por software.

`@rafaelaugusto/jolt/web/testing` comparte formato v1 y recordInteraction/parseTrace/serializeTrace/replayInteraction. La aplicación aporta adapter, reloj advanceTo, entradas, lectura y dispose; debe rechazar operaciones no soportadas. No hay interceptación global, inyección automática de gestos del SO ni determinismo GPU. La prueba repite drag horizontal de un puntero y seek público de resorte con salto temporal, iguales resultados y cero recursos. Límites: 5.000 eventos, 300 segundos y 2 MB.

Retén el inspector nativo con `scope.resource(() => inspector)`. Web scope.add destruye herramientas no reproducibles al suspender el scope; usa scope.use para recrearlas al volver y conservar la referencia actual. Lo mismo se aplica al audio al suspender explícitamente el scope Web; el control de visibilidad de la cue es separado.

<Clip :autoplay="false" name="interaction-inspector-ios" caption="Simulador iOS 26.2: reproducción nativa con interacción XCTest real. Reemplazo de propietario, inspección bajo demanda y remontaje; no mide GPU." />
<Clip :autoplay="false" name="interaction-inspector-android" caption="ASUS ZenFone 3 físico, Android 8: toques reales mediante ADB. Reemplazo de propietario, inspección bajo demanda y remontaje; no mide GPU." />
<Clip :autoplay="false" name="interaction-inspector-web" caption="Chromium: interacción real; el inspector utiliza WebGL por software. Reemplazo de propietario, inspección bajo demanda y remontaje; no mide GPU." />

<Clip :autoplay="false" name="interaction-tools-web" caption="Chromium: clics reales pausan y buscan la animación de la aplicación, editan el resorte y muestran código copiable. Una traza numérica explícita de cambio de destino se reproduce dos veces, verificando el destino y cero recursos restantes; no captura entradas del sistema operativo." />
<Clip :autoplay="false" name="motion-inspector-ios" caption="Simulador iOS, inspector nativo existente: toques reales de XCTest inspeccionan interrupción, ajustan un resorte, pausan la reproducción y copian TypeScript. Grabación reutilizada de la contraparte nativa; no mide rendimiento en un dispositivo físico." />
<Clip :autoplay="false" name="interaction-replay-ios" caption="Simulador iOS, replay nativo existente: toques y arrastre reales de XCTest graban y reproducen resorte/arrastre y detectan un checkpoint deliberadamente incorrecto. Contraparte nativa reutilizada; el replay usa tiempo lógico." />

## Paths y orientación tangente

`scope.animate(card, { path: 'M0 0 C40 -150 160 90 190 -80', orient: true }, { duration: 2600, ease: 'linear' })` comparte geometría y progreso entre nativo/Web. Unidades: DIPs/píxeles CSS y grados. Pause, seek, repeat, reverse, esperas, Reduce Motion y reemplazo conservan el contrato habitual; secuencias y escenas Web también aceptan paths.

Un m inicial relativo suma la pose actual; M absoluto selecciona el origen declarado. No combines path con x/y explícitos ni orientación con rotate. Un resorte normal puede heredar posición/velocidad; un path discontinuo declarado no garantiza continuidad de tangente o velocidad.

<Clip :autoplay="false" name="interaction-path-ios" caption="Simulador iOS 26.2: reproducción nativa con interacción XCTest real. Path cúbico, orientación tangente, pause, seek y reemplazo." />
<Clip :autoplay="false" name="interaction-path-android" caption="ASUS ZenFone 3 físico, Android 8: toques reales mediante ADB. Path cúbico, orientación tangente, pause, seek y reemplazo." />
<Clip :autoplay="false" name="interaction-path-web" caption="Chromium: interacción real; el inspector utiliza WebGL por software. Path cúbico, orientación tangente, pause, seek y reemplazo." />

## Rotación en tres ejes

Web acepta rotateX/Y en grados. Orden: baseline 2D, traslación, rotateZ, rotateY, rotateX, escala. Usa `container.style.perspective = '700px'` en el padre si necesitas proyección; anima el hijo. No se acepta baseline proyectivo del destino ni layout/FLIP 3D. Nativo mantiene su contrato; los píxeles proyectados pueden diferir. Pause, seek y reemplazo conservan canales independientes.

<Clip :autoplay="false" name="interaction-depth-ios" caption="Simulador iOS 26.2: reproducción nativa con interacción XCTest real. Rotación, seek y reemplazo; Web usa perspectiva explícita del padre." />
<Clip :autoplay="false" name="interaction-depth-android" caption="ASUS ZenFone 3 físico, Android 8: toques reales mediante ADB. Rotación, seek y reemplazo; Web usa perspectiva explícita del padre." />
<Clip :autoplay="false" name="interaction-depth-web" caption="Chromium: interacción real; el inspector utiliza WebGL por software. Rotación, seek y reemplazo; Web usa perspectiva explícita del padre." />

## Sombras y profundidad

Web soporta shadowOpacity, shadowRadius, offsets X/Y con signo y shadowColor exclusivo de Web. Una sola box-shadow externa sin spread; inset, listas y spread no cero fallan antes de reemplazar. Empieza con none o sombra compatible. Alpha del color multiplica opacidad.

shadowRadius es la mitad del blur CSS, siguiendo la convención numérica iOS. Web usa píxeles CSS y nativo DIPs. Radio no negativo y opacidad limitada a 0–1 en Web; validación nativa de valores explícitos inválidos sin cambios. Reemplazo parcial conserva hermanos. Release restaura estilo inicial salvo escritura externa; libera antes de asumir estilos para evitar conflictos de propiedad.

Android elevation/translationZ siguen siendo nativos, no aliases de sombras CSS o translateZ. iOS mantiene sus canales. Los ejemplos muestran los límites concretos; no demuestran menor CPU/PSS ni píxeles idénticos.

<Clip :autoplay="false" name="interaction-shadow-ios" caption="Simulador iOS 26.2: reproducción nativa con interacción XCTest real. Sombra iOS/Web; elevation/translationZ nativos en Android." />
<Clip :autoplay="false" name="interaction-shadow-android" caption="ASUS ZenFone 3 físico, Android 8: toques reales mediante ADB. Sombra iOS/Web; elevation/translationZ nativos en Android." />
<Clip :autoplay="false" name="interaction-shadow-web" caption="Chromium: interacción real; el inspector utiliza WebGL por software. Sombra iOS/Web; elevation/translationZ nativos en Android." />

<Clip :autoplay="false" name="interaction-audio-lifecycle-ios" caption="Simulador iOS 26.2: pausa manual preservada en background/foreground y cancelación al remontar. Interacción XCTest real; captura sin audio." />
<Clip :autoplay="false" name="interaction-inspector-lifecycle-ios" caption="Simulador iOS 26.2: pausa manual preservada en background/foreground y cancelación al remontar. Interacción XCTest real; captura sin audio." />
