---
layout: home
hero:
  text: Haz que NativeScript cobre vida.
  tagline: Efectos predefinidos, resortes, fotogramas clave y animaciones escalonadas para vistas de NativeScript, con una sola llamada. Reproducción nativa para animar vistas y cambios reales de diseño cuando el contenido necesita redistribuirse.
  image:
    light: /logo.png
    dark: /logo-dark.png
    alt: Jolt
  actions:
    - theme: brand
      text: Empezar
      link: /es/guide/install
    - theme: alt
      text: Qué es Jolt
      link: /es/guide/
    - theme: alt
      text: Efectos predefinidos
      link: /es/guide/presets
homeVideos:
  title: 'Mira Jolt en movimiento.'
  description: 'Conoce el proyecto en un minuto y descubre una app nativa en acción.'
  items:
    - name: jolt-nativescript-film
      label: 'El vídeo'
      title: 'This is NativeScript.'
      duration: '1:00'
      width: 1920
      height: 1080
      caption: 'Un minuto de Jolt y Motion Studio con capturas reales del simulador iOS, montaje publicitario y música. Las escenas con SceneKit son exclusivas de iOS.'
    - name: jolt-tesla-demo-ios
      label: 'El ejemplo'
      title: 'Inspirado en Tesla.'
      duration: '2:04'
      width: 720
      height: 1566
      caption: 'Simulador iOS: ejemplo inspirado en Tesla con coche 3D, controles de climatización y un recorrido de recogida. Velocidad original; interfaz de demostración, sin conexión a un vehículo real.'

features:
  - title: Una llamada
    details: "animate(card, 'fadeInUp'), animate(button, { scale: 1.1 }, 'bouncy'), animate(rows, 'fadeInUp', { stagger: 40 }). Eso es todo lo que necesitas en la mayoría de las pantallas."
  - title: Resortes con física real
    details: Defínelos por su sensación, rebote y duración, o mediante rigidez, amortiguación y masa. Al interrumpir un resorte, conserva su velocidad.
  - title: Fotogramas clave e interpolación por tramo
    details: Listas de valores con tiempos precisos, curvas por tramo, curvas Bézier cúbicas o funciones propias. Las funciones de interpolación se ejecutan una vez, sin repetirse en cada fotograma.
  - title: Reproducción nativa de las vistas
    details: Las pistas habituales usan Core Animation en iOS y ObjectAnimator en Android sin JavaScript por fotograma. Las API de diseño e interacción documentan sus propios costes de ejecución.
  - title: Secuencias, escalonado y pulsación
    details: Pasos que comienzan cuando el anterior parece haber terminado, entradas escalonadas desde el inicio, el final o el centro, y efectos de pulsación que ceden al desplazamiento.
  - title: Interrupciones sin saltos
    details: Una nueva animación sobre una propiedad en movimiento parte del valor que se ve en pantalla y conserva su velocidad.
  - title: Resortes con destino dinámico
    details: Los seguidores nativos conservan posición y velocidad al cambiar el destino, con mapeos, capas y limpieza por ámbito.
    link: /es/guide/live-springs
  - title: Gestos nativos
    details: Combina desplazamiento, pellizco y rotación. Coordina los ejes con una lista y transfiere el arrastre entre un panel y su ScrollView.
    link: /es/guide/gestures
  - title: Dimensiones reales
    details: Anima width, height y auto. El texto se redistribuye y los controles vecinos acompañan los nuevos límites. Usa cálculo de diseño en JavaScript en cada fotograma.
    link: /es/guide/size
  - title: Zoom de cámara SceneKit
    details: Anima el campo de visión en perspectiva junto al color, la iluminación y la posición de la cámara en iOS, con el complemento nativo opcional.
    link: /es/guide/scene-camera
---

## 0.1.0-rc.1: la primera versión candidata {#_0-1-0-rc-1-the-first-release-candidate}

El alcance de la característica 0.1.0 está congelado. Este candidato trae [navegación compartida](/es/guide/shared-navigation) y un [galería de fotos conectada](/es/guide/gallery), [iOS gestos hacia atrás](/es/guide/interactive-navigation) y [Android respaldo predictivo](/es/guide/predictive-back) nativos, [composición de desplazamiento](/es/guide/scroll-header), [sensores del dispositivo](/es/guide/device-sensors), [gravedad](/es/guide/gravity) y [física circular con archivos adjuntos](/es/guide/physics-attachments).

[Dibujo vectorial y transformación](/es/guide/shapes), [desenfoque animado](/es/guide/blur) y [Liquid Glass en iOS 26](/es/guide/glass) se unen a un [vista previa](/es/guide/demo) con **73 ejemplos en inglés, portugués, español y chino simplificado**. Reconstruya la aplicación nativa después de la actualización. [Instalar RC.1](/es/guide/install), lea [notas de la versión](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.1) o verifique [trabajo de aceptación restante antes del establo](/es/guide/not-there-yet). La fase RC se centra en correcciones, compatibilidad y validación en dispositivos físicos.

<div class="clips">
<Clip name="gallery-ios" caption="Simulador iOS, inglés: pinch/pan real, zoom interrumpido, descarte cancelado y regreso a la miniatura actual después de reordenar. Velocidad original." />
<Clip name="physics-attachments-android" caption="Emulador Android, inglés: arrastre/liberación real con ataduras, resortes, colisiones y puntos de ajuste nativos. Sincronización original; no es una medida del rendimiento del dispositivo físico." />
<Clip name="shapes-android" caption="Emulador Android, inglés: toques reales dibujan un trazo vectorial, transforman rutas compatibles, interrumpen y pausan la reproducción. Velocidad original." />
<Clip name="glass-ios" caption="Simulador iOS 26.2, inglés: superficies de vidrio nativo se fusionan y dividen, con cambios de material, interrupción, pausa/reanudación y reducción de movimiento. Grifos reales; velocidad original." />
</div>

## Anteriormente en beta.18 {#earlier-in-beta-18}

[Diseños compartidos](/es/guide/shared-layout) mueve elementos estables entre diseños dentro de una página. [Repetición de la interacción](/es/guide/interaction-replay) convierte resortes interrumpidos, arrastres cancelados y transferencias de desplazamiento a hoja en rastros de regresión. [Muestreo adaptativo](/es/guide/transitions) coloca fotogramas clave nativos donde la curva los necesita, mientras que [inspector de movimiento](/es/guide/motion-inspector) muestra propiedad y observaciones nativas, ajusta un resorte y copia TypeScript. Ese lanzamiento amplió la vista previa a 59 ejemplos en inglés y portugués. [Instalar la versión](/es/guide/install) o lea el [notas de la versión](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-beta.18).

<div class="clips">
<Clip name="shared-layout-ios" caption="Indicador de pestaña compartida, portada del álbum en expansión y reversión rápida. Entrada real del sistema operativo en un simulador iOS, en el momento original." />
<Clip name="scroll-handoff-replay-android" caption="Graba un traspaso de desplazamiento a hoja, reprodúcelo y detecta un punto de control intencionalmente incorrecto. Interacción real ADB en un emulador Android; La repetición del contacto retenido no es una prueba del reconocedor del sistema operativo." />
<Clip name="curve-sampling-ios" caption="Curvas adaptativas y de tasa fija mediante reproducción nativa en un simulador iOS. El rápido resorte es deliberadamente cuatro veces más lento; los números describen el error de la curva, no FPS." />
<Clip name="motion-inspector-android" caption="Inspeccione la propiedad, afine y sostenga un resorte, luego copie su TypeScript. Entrada real del emulador Android; Las observaciones de la vista nativa no miden la presentación de la GPU ni el dispositivo físico FPS." />
</div>

## Hoja inferior, listas y SceneKit {#bottom-sheet-lists-and-scenekit}

[Sábana bajera](/es/guide/bottom-sheet) coordina el arrastre, el desplazamiento y el teclado; [reordenamiento de lista](/es/guide/reorder) mueve elementos a través de celdas recicladas con desplazamiento de borde nativo. En iOS, [entorno y sombreadores](/es/guide/scene-shaders) recibe intensidad y uniformes escritos a través de reproducción nativa. La vista previa también admite apariencia clara/oscura/del sistema.

<div class="clips">
<Clip name="bottom-sheet-ios" caption="Arrastre, transferencia de desplazamiento, crecimiento de contenido y seguimiento del teclado. Entrada real de XCTest en un simulador iOS 26." />
<Clip name="reorder-android" caption="Reordene 200 elementos con desplazamiento de borde nativo y celdas recicladas. Real OS toca un emulador Android, a velocidad original." />
<Clip name="scene-shaders-ios" caption="Iluminación ambiental y entradas de sombreado escalar/vectorial a través de la reproducción nativa SceneKit. Grifos reales en un simulador iOS; no es una medida del rendimiento del dispositivo físico." />
<Clip name="showcase-appearance-ios" caption="Vista previa de Jolt con temas claros/oscuros y una transición circular. Grabación real del simulador iOS." />
</div>

## Manantiales vivos y gestos autóctonos {#live-springs-and-native-gestures}

<div class="clips">
<Clip name="live-springs-ios" caption="Seguidores nativos con reversiones y una capa independiente. Interacción real en un simulador iOS; Los eventos táctiles de esta demostración ingresan a JavaScript." />
<Clip name="live-springs-android" caption="La misma cadena de resorte con inversiones y movimiento reducido en un emulador Android. Esta no es una medición del rendimiento del dispositivo físico." />
<Clip name="gesture-composition-ios" caption="Panorámica, pellizco y rotación simultáneos seguidos de toques simples y dobles. Entrada real del sistema operativo en un simulador iOS." />
<Clip name="gesture-handoff-android" caption="Un arrastre expande el panel y desplaza su contenido; el arrastre inverso vuelve al panel sin levantar el dedo. Emulador Android, Core vertical ScrollView." />
</div>

## Dimensiones y cámara {#dimensions-and-camera}

<div class="clips">
<Clip name="size-ios" caption="Ancho/alto real y tamaño automático, con reflujo de texto, interrupción y objetivos táctiles de trabajo. Simulador iPhone 17, iOS 26; la aplicación selecciona una velocidad de 0,25× para el segmento de interrupción." />
<Clip name="scene-camera-ios" caption="SceneKit Zoom en perspectiva coordinado con pintura e iluminación, incluyendo pausa e inversión. Grabación en tiempo real del simulador iPhone 17, iOS 26." />
</div>

## Más movimiento {#more-motion}

<div class="clips">
<Clip name="assistant-flow" caption="El asistente de demostración en iOS. Cada movimiento es una llamada Jolt." />
<Clip name="presets" caption="Presets, resortes y escalonamiento en el patio de recreo." />
</div>
