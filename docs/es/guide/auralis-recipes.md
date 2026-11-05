# Recetas de movimiento de Auralis

Dos patrones de [Auralis](https://github.com/rafaelaugustos/auralis), revisados en el commit `e533eae13cbf5a78d59dcadc4e61f45f28de88f2` con NativeScript-Vue 3 y Jolt **0.1.0-rc.11**. Cada receta incluye el archivo completo y un prompt de adaptación. El vídeo muestra la app iOS real del creador; dispositivo de captura no especificado.

<Clip name="auralis-native-ios" :width="320" caption="Auralis en iOS: grabación del creador con apertura animada, tarjetas de cristal flotantes, tres escenas de onboarding y controles de página. Velocidad original, sin audio; se omiten los primeros 4,25 segundos de la pantalla de inicio y transición del sistema. Dispositivo no especificado; no mide rendimiento. Cuentas y servicios ilustrativos." />

## Hacia la luz. {#cards}

[Explora esta receta](/es/recipes/auralis-cards) · [GitHub](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/src/scene/choreography.ts)

Las tarjetas salientes convergen tras el horizonte inferior y desaparecen antes de que emerjan las siguientes. La entrada tiene un pequeño overshoot y stagger de 42 ms; la salida invierte el orden con 26 ms. Los helpers solo calculan movimiento. AuroraView controla máscaras, visibilidad, partículas, timeline y limpieza.

NativeScript-Vue 3 y Jolt RC.11. Las funciones devuelven keyframes y opciones; AuroraView las programa en una timeline con scope. Proporciona CardLayout, el límite inferior de ambas escenas (mayor coordenada y) e índice/cantidad de tarjetas. La geometría usa un canvas de 402 puntos con centro x=201: adáptalo o escálalo. Separa transiciones en card.view y movimiento continuo en card.art. Conserva los fades de movimiento reducido, las protecciones de ciclo de vida y la limpieza de scopes. Los helpers no dibujan cristal, texto ni partículas; consulta aurora-view.ts y artwork.ts. La plataforma grabada es iOS.

## Un reloj. Cada escena. {#clock}

[Explora esta receta](/es/recipes/auralis-clock) · [GitHub](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/src/composables/useCarouselClock.ts)

Un motion value pasa de 0 a 1 en 4000 ms. Llena el indicador activo y llama a advance al terminar. useOnboarding lo detiene antes de cambiar de escena y lo reinicia cuando la siguiente se estabiliza. toggle suspende o reanuda el scope; la protección por generación rechaza callbacks de timers reemplazados.

Llama a useCarouselClock durante setup de NativeScript-Vue con un callback advance asíncrono. Vincula progress al scaleX del indicador con originX=0, como en PageIndicator.vue. Llama a hold antes de navegar y start cuando la escena se estabilice; conecta playing/toggle a un control etiquetado. Comienza pausado si hay movimiento reducido o lector de pantalla al iniciar setup. Conserva la protección por generación, el motion scope y la limpieza en unmount. Pausar conserva el timer; navegar manualmente reinicia el intervalo de lectura. El hook no aporta vistas, swipe ni un listener de cambios de preferencias. Consulta useOnboarding.ts.

La grabación demuestra apertura, transiciones, progreso del indicador y navegación. Segundo plano/reanudación y modos de accesibilidad se describen según el código revisado; este vídeo no los demuestra. Las APIs nativas y la geometría no constituyen una implementación Web.

## Código e integración

- [aurora-view.ts](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/src/scene/aurora-view.ts)
- [artwork.ts](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/src/scene/artwork.ts)
- [useOnboarding.ts](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/src/composables/useOnboarding.ts)
- [PageIndicator.vue](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/src/components/PageIndicator.vue)
- [onboarding.ts](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/src/onboarding.ts)
- [README.md](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/README.md)

## El sitio en movimiento

<Clip name="auralis-site-chromium" :width="960" caption="Chromium en macOS arm64: recorrido por Auralis en la página principal, showcase, vídeo nativo y dos recetas, incluida la copia de código y prompt. Velocidad original. Vídeo iOS del creador, dispositivo no especificado. La lista de la comunidad, sin cambios, usa una respuesta vacía en la revisión local." />
