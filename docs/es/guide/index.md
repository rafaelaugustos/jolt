# Qué es Jolt {#what-jolt-is}

Jolt anima las vistas [NativeScript](https://nativescript.org): ajustes preestablecidos, resortes, fotogramas clave y escalonamiento, una llamada cada uno.

```ts
import { animate } from '@rafaelaugusto/jolt'

animate(card, 'fadeInUp')
animate(button, { scale: 1.1 }, 'bouncy')
animate(rows, 'fadeInUp', { stagger: 40 })
```

## ¿Por qué no? `view.animate()` {#why-not-view-animate}

`view.animate()` de NativeScript cubre lo básico y se detiene allí: una curva para cada propiedad, una curva `spring` sin configuraciones, sin fotogramas clave y una promesa que se rechaza cuando se cancela la animación. Cualquier cosa más rica termina como código de plataforma.

Jolt calcula el movimiento una vez, en JavaScript, al iniciar la animación, y lo entrega a la plataforma como fotogramas clave: Core Animation en iOS y `ObjectAnimator` en Android. Las pistas habituales de las vistas se reproducen sin JavaScript por fotograma. El diseño con dimensiones reales, las suscripciones opcionales y la entrada por gestos tienen sus propios [límites de ejecución](./how-it-works). Los resortes siguen leyes físicas, y una animación que interrumpe otra continúa desde la posición y la velocidad actuales de la vista.

## Qué cubre {#what-it-covers}

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

1. [Instalarlo](./install).
2. Lea [Animando](./animating): qué es un objetivo, qué propiedades se mueven y cómo se escriben los fotogramas clave.
3. Elija un [transición](./transitions) o un [preestablecido](./presets).

Es una versión candidata (RC), publicada con la etiqueta `next`. Es independiente del framework: recibe una vista o un elemento que la contiene.
