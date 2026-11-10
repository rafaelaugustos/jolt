# Qué es Jolt {#what-jolt-is}

Jolt lleva movimiento a aplicaciones [NativeScript](https://nativescript.org) y a la Web: presets, resortes, fotogramas clave, animaciones escalonadas y gestos, con APIs para vistas nativas y elementos HTML.

## NativeScript

Anima vistas nativas en iOS y Android desde la entrada principal del paquete:

```ts
import { animate } from '@rafaelaugusto/jolt'

animate(card, 'fadeInUp')
animate(button, { scale: 1.1 }, 'bouncy')
animate(rows, 'fadeInUp', { stagger: 40 })
```

## Web

Usa `@rafaelaugusto/jolt/web` para elementos HTML. Comparte el compilador de movimiento de Jolt y utiliza Web Animations API (WAAPI), sin requerir NativeScript ni un framework de interfaz.

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'

const motion = createWebRuntime(document)
const card = document.querySelector<HTMLElement>('.card')

if (card) {
  motion.animate(card, 'fadeInUp')
}
```

Crea el runtime después del montaje en el navegador y llama a `motion.dispose()` al desmontar su aplicación o componente. El [adaptador opcional `/web/vue`](./web-vue) gestiona los recursos mediante el ciclo de vida de Vue. La entrada principal y `/vue` corresponden a NativeScript; no cambian automáticamente al DOM.

Las APIs Web son **experimentales**. Empieza por el [runtime Web](./web-runtime) y explora [movimiento continuo](./web-dynamic), [gestos y desplazamiento](./web-gestures) y [gradientes, carga y texto](./web-effects). Cada guía describe los elementos compatibles y sus límites.

## SwiftUI (Beta)

Disponible en **0.1.0-rc.13 (Beta)** para iOS 17+ y macOS 14+, sin NativeScript ni JavaScript. Instale el producto `JoltSwiftUI` desde la etiqueta `v0.1.0-rc.13` del repositorio. Consulte [instalación](./swiftui), [ciclo de vida](./swiftui-motion) e [interacción/geometría](./swiftui-geometry) para los límites.

## ¿Por qué no? `view.animate()` {#why-not-view-animate}

`view.animate()` de NativeScript cubre lo básico y se detiene allí: una curva para cada propiedad, una curva `spring` sin configuraciones, sin fotogramas clave y una promesa que se rechaza cuando se cancela la animación. Cualquier cosa más rica termina como código de plataforma.

Jolt calcula el movimiento una vez, en JavaScript, al iniciar la animación, y lo entrega a la plataforma como fotogramas clave: Core Animation en iOS y `ObjectAnimator` en Android. Las pistas habituales de las vistas se reproducen sin JavaScript por fotograma. El diseño con dimensiones reales, las suscripciones opcionales y la entrada por gestos tienen sus propios [límites de ejecución](./how-it-works). Los resortes siguen leyes físicas, y una animación que interrumpe otra continúa desde la posición y la velocidad actuales de la vista.

## Qué cubre {#what-it-covers}

Las siguientes guías cubren las vistas de NativeScript. Para elementos HTML, consulta las guías Web anteriores.

- [25 preajustes](./presets) para entrar, salir y llamar la atención: `fadeInUp`, `popIn`, `shake`, `heartbeat`...
- [Resortes](./transitions#springs) descrito por tacto (`bouncy`), por `bounce` y `duration`, o por rigidez, amortiguación y masa.
- [Fotogramas clave y interpolaciones](./transitions#tweens) con flexibilización por segmento y tiempos de fotogramas clave exactos.
- [Tambalear](./stagger) en varias vistas, desde la primera, la última o el centro.
- [Secuencias](./sequences) que inician cada paso una vez que el anterior parece terminado.
- [Efectos de pulsación](./press) que siguen el dedo y se liberan cuando el desplazamiento toma el control.
- [Directivas Vue y un componente de transición](./vue) de la entrada opcional `@rafaelaugusto/jolt/vue`.
- [Entradas de texto](./text) por letra o palabra en iOS y Android, manteniendo una Etiqueta accesible.
- [Interrupciones](./interrupting) que recogen el valor y la velocidad en pantalla, sin salto.
- [Reproducción nativa](./how-it-works): Core Animation en iOS y `ObjectAnimator` en Android para pistas de visualización predeterminadas; Los costos de ejecución están documentados por API.

- [Dimensiones reales](./size): anima el ancho, alto y automático mientras el texto se redistribuye y los hermanos se mueven.
- [Campo de visión de la cámara SceneKit](./scene-camera): zoom de perspectiva coordinada con valores de movimiento en iOS.

## Por dónde empezar {#where-to-start}

1. [Instala Jolt](./install) y elige la entrada para tu plataforma.
2. **NativeScript:** consulta [Animando](./animating) y elige una [transición](./transitions) o un [preset](./presets).
3. **Web:** empieza por el [runtime Web](./web-runtime) o el [adaptador Vue para DOM](./web-vue).

Jolt es una versión candidata; consulta [instalación](./install) para conocer la versión publicada. Ambos runtimes se pueden usar directamente, con integraciones opcionales para frameworks.

## Cómo leer el menú {#reading-the-menu}

El menú lateral destaca capacidades con tres etiquetas:

- **Nuevo:** introducido en la edición documentada.
- **Actualizado:** un cambio relevante en una capacidad existente.
- **Beta:** una API o un adaptador experimental cuyo contrato puede cambiar.

Nuevo y Actualizado caducan cuando cambia la versión documentada. Beta permanece hasta estabilizar la API. La descripción de la etiqueta distingue una capacidad publicada de un candidato en código; la guía indica cualquier integración o publicación pendiente. La etiqueta por sí sola no significa que la función se haya publicado.

<Clip name="docs-navigation-desktop" caption="Chromium en macOS, viewport de escritorio: Etiquetas de la edición actual en el menú, navegación por teclado y temas claro/oscuro. Muestra la navegación de la documentación, no una app nativa." />

<Clip name="docs-navigation-mobile" caption="Chromium en macOS, viewport móvil emulado: abrir el menú y seguir entradas etiquetadas. Emulación del navegador, no grabación en un teléfono físico." />
