# API {#api}

- [**createMotionInspector**](./motion-inspector): inspección de desarrollo opcional, lotes nativos, propiedad, gráficos vinculantes y ajuste de resorte reproducible.

## Animando {#animating}

- [**recordInteraction / replayInteraction**](./interaction-replay): seguimientos de desarrollo opcionales, reproducción de reloj controlado y sondas de regresión nativas. Disponible desde beta.18.
- [**sharedLayout(container, options)**](./shared-layout): identidades compartidas opcionales en la misma página, instantáneas nativas, fundidos cruzados e interrupciones. Disponible desde beta.18.
- [**sharedNavigationEntry(frame, options)**](./shared-gestures): devolución de tarjeta/imagen nativa interactiva en páginas estables iOS y Android 14+. Disponible desde rc.1.
- [**resolveListTarget(context, options)**](./return-targets): resolución de celda actual limitada por clave estable para retorno compartido después de reciclar, desplazarse o reordenar. Disponible desde rc.1.
- [**entry.returnToSource(options?)**](./gallery): devuelve una pose de fotografía retenida a través de la resolución de la celda actual, llevando la velocidad de traducción y el recorte de la ventana gráfica al vuelo nativo.
- [**sharedNavigation(frame, options)**](./shared-navigation): movimiento nativo opcional de imagen/tarjeta a través de rutas programáticas, etiquetas con alcance y respaldo limitado. Disponible desde rc.1.
- [**interactiveNavigation(frame, options)**](./interactive-navigation): transiciones nativas de página con desplazamiento de borde iOS con cancelación, finalización de resorte con reconocimiento de velocidad e historial de núcleo/enrutador. Disponible desde rc.1.
- [**predictiveBack(view, values, options)**](./predictive-back) — Progreso de retroceso del sistema nativo Android 14+, cancelación de resorte y un compromiso protegido. Disponible desde rc.1.
- `animate(target, keyframes | preset, transition?)` — [caminos](./paths), [colores](./colors), [esquinas, bordes y sombras](./decorations)
- [`interactionSurface(target)`](./interaction-surface): opte por la geometría táctil nativa para un subárbol animado.
- [`animateLayout(container, change?, options?)`](./layout) — anima el siguiente diseño de los hijos directos de un contenedor.
- [`animateSize(view, dimensions, change?, options?)`](./size) — anima el ancho/alto/automático real con reflujo de texto, pausa/reanudación y propiedad del alcance; realiza el diseño JS por cuadro.
- [`motionScope()`](./motion-controllers): identificadores de animación propios, suscripciones y ciclo de vida de componentes.
- [`motionStates(targets, definitions, options?)`](./motion-controllers#named-visual-states) — estados visuales con nombre coordinados e interrumpibles; [`attach()` y `ref()`](./motion-controllers#views-that-come-back) los mantiene en las vistas que se recrean y se puede realizar una transición [diferenciar objetivos](./motion-controllers#a-transition-per-target).
- [`motionValue(initial)`, `bind(target, bindings)`](./motion-values) — un valor que impulsa varias propiedades y vistas; `animate()`, `set()` y `stop()` también toman un valor. [`scrollValue(scrollView, { axis? })`](./motion-values#scroll-offsets) es un desplazamiento de desplazamiento como valor.
- [`springValue(source, options?)`](./live-springs): seguidores nativos retenidos con continuidad de posición/velocidad, cadenas nativas, asignaciones numéricas y capas de transformación/opacidad. Disponer de la suscripción con su ámbito de propiedad.
- [`gestures(surface, options?)`](./gestures) y `GestureSurface`: panorámica/pellizco/rotación nativa, relaciones de derivación y transferencia central ScrollView, desde el punto de entrada opcional `@rafaelaugusto/jolt/gestures`.
- [`bottomSheet(panel, options)`](./bottom-sheet): hoja en página opcional con transferencia de desplazamiento nativo, instantáneas dinámicas, seguimiento del teclado y acciones accesibles.
- [`reorder(list, options)`](./reorder): reordenamiento opcional de Core ListView plano con teclas estables, alturas variables, desplazamiento de borde nativo y movimientos de teclado/accesibilidad.
- [`value.subscribe(listener, { immediate? })`](./motion-values#observing-outside-views) — observar números, colores derivados y valores de desplazamiento en JavaScript; devuelve darse de baja.
- [`animate(value, target, { layer })`, `stop(value, { layer })`](./motion-values#layers-on-a-value) — capas escalares aditivas antes de las asignaciones.
- [`animate(target, { y }, { type: 'gravity' })`](./gravity) — caída balística y rebote hasta un aterrizaje fijo.
- [`decay(target, velocity, options?)`](./decay)
- [`gradient(target, options)`](./gradients) — gradientes nativos lineales, radiales y cónicos con componentes mixtos de valor estático/de movimiento (`GradientBindings`); devuelve un `Gradient` con `bind()`, `animate()`, `set()`, `stop()`, `suspend()`, `resume()`, `suspended` y `remove()`. [`motionScope().gradient()` and `v-gradient`](./gradients#scopes-and-vue) lo posee para un alcance o una plantilla.
- `stop(target, properties?)`
- [`set(target, values)`](./interrupting#setting-values-without-animating) — aplica valores a la vez y detiene lo que los anima.
- [`playbackProgress(animation)`](./playback): progreso observable y de solo lectura en el reloj de una animación existente.
- [`timeline(steps)`](./sequences): pausa y reanuda los pasos activos y pendientes juntos.
- [`@rafaelaugusto/jolt/native`](./native-properties) — registro de propiedad opcional, mapas nativos y cámaras SceneKit, [luces y materiales](./scene-lighting) y [cámara FOV](./scene-camera).
- [`sequence(steps)`](./sequences) — pasos superpuestos y posiciones fijas.
- `press(target, pressed?, transition?)`
- [`drag(target, options?)`](./drag) — con `value`, el gesto controla un [valor de movimiento](./motion-values#dragging) en lugar de la vista.
- [`physicsWorld(container, bodies, options)`](./circle-physics) — colisiones de círculos nativos, arrastrar/liberar y propiedad del ciclo de vida.
- [`shape()`](./shapes): dibujo de trazo SVG nativo y transformación de ruta coincidente.
- [`blur()`](./blur): anima una cantidad de desenfoque nativa propia.
- [`GlassContainer` / `GlassView`](./glass) — fusión nativa iOS 26 Liquid Glass utilizando la reproducción de transformación existente.
- [`world.attach()` / `world.snapTo()`](./physics-attachments) — resortes de anclaje nativos y puntos de liberación.
- [`sensor(kind, options)`](./device-sensors): fuentes nativas opcionales de rotación/gravedad para valores de movimiento, fijaciones y resortes.
- [`scrollHeader(list, options)`](./scroll-header) — Composición nativa de Core ListView: héroe medido, paralaje, transferencia de título, sección fijada y anclajes de elementos estables.
- [`scrollLinked(scrollView, target, keyframes, { range, axis? })`](./scroll-linked) — devuelve una función de limpieza.
- [`animateItems(list, keyframes | preset, options?)`](./lists) — filas tal como aparecen, con `once`; devuelve una función de limpieza.
- [`followKeyboard(target, options?)`](./keyboard) — mueve una vista con el teclado en iOS y Android 7+; devuelve una función de limpieza.
- [`onKeyboard(callback)`](./keyboard#keyboard-state) — qué parte de la ventana cubre el teclado, con su sincronización; devuelve una función de limpieza.
- [`symbolEffect(image, effect, options?)`](./symbol-effects) — iOS SF Symbols.
- [`shimmer(target, options?)`](./shimmer) — iOS cargando marcadores de posición; devuelve una función de limpieza.
- [`liquid(image, options?)`](./liquid) — iOS deformación de textura; devuelve un `LiquidEffect` con `pause()`, `resume()` y `stop()`.
- [`imageEffect(image, name, options?)`](./image-effects) — ondulación nativa, distorsión táctil y disolución determinista; controles de reproducción y respaldo de compatibilidad explícito.
- [`zoomable(image, options?)`](./photo-zoom): pellizco de foto nativo, zoom con doble toque, panorámica limitada e intentos de descarte opcionales.
- [`loader(target, options?)`](./loaders) — iOS indicadores de puntos, barras y anillos; devuelve una función de limpieza.
- [`reveal(target, options?)`, `conceal(target, options?)`](./reveal) — iOS transiciones de visibilidad circular; devolver un `Animation`.
- [`animateText(label, options?)`](./text) — entradas letra por letra o palabra por palabra en iOS y Android; devuelve un `Animation`.
- [`animateText(label, options?)`](./text) — iOS entradas letra por letra o palabra por palabra; devuelve un `Animation`.
- [`rollTo(label, value, options?)`](./rolling) — dígitos continuos en iOS y Android; devuelve un `Animation`.
- [`confetti(target, options?)`, `particles(target, options?)`](./particles) — efectos de partículas nativas iOS/Android; funciones de limpieza de retorno. Sin simulación JS ni devolución de llamada de pintura por cuadro; El dibujo Android comparte el hilo de la interfaz de usuario.

`target` es una vista o cualquier cosa que contenga una (una referencia de plantilla en un elemento o en un componente, un `ElementRef`). `animate()`, `decay()`, `stop()`, `set()` y los pasos de secuencia también aceptan matrices de objetivos.

Las opciones `animate()` también aceptan [`haptic`](./haptics): `light`, `medium`, `heavy`, `{ style, times }` o `false`. Los comentarios son compatibles con iOS y Android, respetando la configuración del dispositivo.

## Animaciones {#animations}

Lo que devuelve `animate()`, `decay()`, `sequence()` y los pasos de una secuencia: `await` it, lee `finished`, o llama a `stop()`. Se resuelve con `true` cuando se reproduce hasta el final y `false` cuando se detiene o toma el control, y la cancelación nunca rechaza. Los errores de configuración de secuencia/devolución de llamada pueden rechazar `finished` después de cancelar su otro trabajo.

`animate()` y `decay()` devuelven [`PlaybackAnimation`](./playback): el ciclo de vida base más `pause()`, `play()`, `progress` grabable y `paused`/`duration` de solo lectura. Los controladores de secuencia y efecto mantienen el contrato base `Animation`.

## Transiciones {#transitions}

- **Resortes**: `'smooth' | 'snappy' | 'bouncy'`, `{ bounce, duration, velocity }` o `{ stiffness, damping, mass, velocity }`.
- **Preadolescentes**: `{ duration, ease, times, easeTrack }`.
- **Sincronización**: `delay`, `repeat`, `repeatType: 'loop' | 'reverse'`, `repeatDelay`, `stagger: number | { each, from }`.
- **Capas**: [`layer: 'name'`](./layers) se reproduce encima de otras animaciones de la propiedad; `stop(target, properties, { layer })` detiene una capa.
- **Por propiedad**: cualquier nombre de propiedad asignado a su propia transición.
- **Fotogramas clave relativos**: `{ relative: true }` agrega desplazamientos de traslación/rotación y multiplica escala/opacidad por sus valores iniciales.

## Ayudantes {#helpers}

`definePreset(name, preset)`, `presets`, `springs`, [`origamiSpring({ friction, tension })`](./react-native#springs), `cubicBezier`, `toView(target)`. `toView()` devuelve la vista NativeScript detrás de cualquier objetivo aceptado, para ayudantes que reciben los mismos objetivos que `animate()`. Consulte [ajustes preestablecidos personalizados](./presets#custom-presets) para obtener información sobre el registro y los nombres escritos.

## Vue {#vue}

`@rafaelaugusto/jolt/vue` es un punto de entrada independiente para NativeScript-Vue 3: `vAnimate` (`v-animate`), `vPress` (`v-press`), `JoltTransition`, `transitionHooks(props)`, `useMotionScope()`, `useReducedMotion()`, `useKeyboard()`, `useMotionValue()`, `useBinding()`, `useScrollValue()` y `install(app)`, también la exportación predeterminada para `app.use()`. Tipos: `AnimateValue`, `PressValue`, `TransitionProps`. Ver el [Guía Vue](./vue).

## Tipos {#types}

`Step`, `SequenceOptions`, `SequencePosition`, `JoltConfig`, `KeyframeProperty`, `ScrollLinkedOptions`, `KeyboardOptions`, `ItemsOptions`, `ColorValue`, `ColorKeyframes`, `Keyframes`, `Transition`, `Spring`, `Tween`, `Preset`, `Presets`, `PresetName`, `SpringName`, `Easing`, `Animation`, `Target`, `DecayVelocity`, `DecayOptions`, `SymbolEffect`, `SymbolEffectName`, `SymbolEffectOptions`, `ShimmerOptions`, `LiquidOptions`, `LiquidEffect`, `LoaderOptions`, `LoaderStyle`, `TextOptions`, `RollOptions`, `RevealOptions`, `ConcealOptions`, `Haptic`, `HapticOptions`, `HapticStyle`, `ConfettiOptions`, `ParticleOptions` y el resto exportados del paquete.
[`configure({ timeScale })`](./configure) establece la velocidad de reproducción global para las animaciones iniciadas posteriormente.
[`configure({ timeScale, reducedMotion })`](./configure) establece la velocidad de reproducción global y la preferencia de movimiento reducido (`'user'`, `'always'` o `'never'`) para las animaciones iniciadas posteriormente. [`reducedMotion()` and `onReducedMotion(callback)`](./configure#reading-the-preference) lee y observa esa preferencia.

## Tipos {#types-1}

- [SceneKit entorno y entradas de sombreado](./scene-shaders) — iluminación nativa y uniformes escalares/vectoriales tipificados.
