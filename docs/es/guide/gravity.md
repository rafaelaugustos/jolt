# Gravedad y rebote {#gravity-and-bounce}

Dale a una carta una posición de aterrizaje fija y déjala caer y rebotar. `{ type: 'gravity' }` está disponible desde **0.1.0-rc.1** a través de la API `animate()` existente.

<Clip name="gravity-ios" caption="Simulador iOS: la vista previa nativa real, con toques reales para soltar, lanzar, pausar/reanudar, regresar, cambiar la restitución y reducir el movimiento. interfaz de usuario en inglés; velocidad original." />
<Clip name="gravity-android" caption="Emulador Android: el mismo movimiento balístico y controles, renderizados por vistas nativas y ejercitados con toques ADB. interfaz de usuario en inglés; velocidad original. Estas grabaciones no son mediciones de rendimiento de dispositivos físicos." />

```ts
import { animate } from '@rafaelaugusto/jolt'

const falling = animate(
  card,
  { y: 280 },
  {
    type: 'gravity',
    acceleration: 1800,
    restitution: 0.55,
  },
)

falling.pause()
falling.play()
// Interrupt the fall and preserve its current position and velocity:
animate(card, { y: 0 }, 'smooth')
```

El punto final es un límite en las coordenadas de traducción de la propiedad, no un piso detectado u otra vista. Si la parte superior sin transformar de la tarjeta es 20 DIPs y su altura es 100, un piso en 400 necesita `y: 280`. Mide tu propio diseño. La trayectoria fija no responde a obstáculos ni a un suelo en movimiento; reorientar después de cambios de diseño.

## Parámetros físicos {#physical-parameters}

| Opción         | Predeterminado | Significado                                                                                                                                                                         |
| -------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `acceleration` | `1800`         | Magnitud positiva finita en unidades/segundo², dirigida desde el valor inicial hacia el punto final. Para ver traducciones, las unidades son DIPs.                                  |
| `restitution`  | `0.55`         | Fracción de la velocidad de impacto retenida, desde `0` inclusive hasta `1` exclusivo. `0` aterriza sin rebotar; La altura de cada rebote aumenta según la restitución al cuadrado. |
| `velocity`     | heredado       | Unidades con signo/segundo a lo largo del eje de propiedades. Un valor explícito anula la velocidad de la animación interrumpida; una vista en reposo comienza en cero.             |

Solo `x`, `y` y los valores de movimiento numéricos admiten esta curva. Proporcione un inicio actual/explícito y un punto final, no una lista de fotogramas clave de múltiples segmentos. Los puntos finales negativos funcionan: la aceleración apunta hacia el punto final mientras que la velocidad conserva el signo del eje. Cuando el punto inicial y final coinciden, el límite mira hacia el eje positivo; una velocidad negativa se aleja de él. La velocidad positiva entrante en ese límite se refleja inmediatamente.

La duración sigue la física. No combine la gravedad con los parámetros `duration`, relajación o resorte. `delay`, escalonamiento, repeticiones, reproducción inversa, capas con nombre, alcances, pausa/reanudación y búsqueda de progreso utilizan los contratos de animación existentes. La reproducción inversa invierte la trayectoria grabada; No es una nueva simulación física. `finished` espera hasta el rebote final, por lo que las secuencias no avanzan en el primer contacto.

## Una fuente, varias vistas {#one-source-several-views}

```ts
import { animate, bind, motionScope, motionValue } from '@rafaelaugusto/jolt'

const scope = motionScope()
const height = motionValue(0)
scope.use(() => bind(ball, { y: height }))
scope.use(() =>
  bind(shadow, {
    scaleX: height.to([0, 280], [0.35, 1]),
    opacity: height.to([0, 280], [0.08, 0.4]),
  }),
)
scope.animate(height, 280, { type: 'gravity', restitution: 0.7 })
// Suspend on temporary inactivity; dispose when the screen is released.
```

Los valores de movimiento conservan sus unidades originales de aceleración y velocidad. La vista previa de **Un aterrizaje más suave** utiliza un valor para el orbe y la sombra, con controles en inglés, portugués, español y chino simplificado. También muestra un lanzamiento y una interrupción de resorte.

## Ejecución y límites {#execution-and-limits}

Jolt resuelve analíticamente vuelos de aceleración constante durante la configuración. Los tiempos de contacto y vértice exactos se mantienen durante el muestreo, y los jugadores nativos interpolan las muestras. No hay ningún bucle de física JavaScript ni devolución de llamada de aplicación por cuadro. Esto reutiliza Core Animation en iOS y el controlador de animación Android existente. NativeScript JavaScript comparte el hilo de la interfaz de usuario; La ejecución nativa no garantiza que cada plataforma o ruta de enlace continúe a través de un subproceso de UI bloqueado.

Las pistas se asientan en el límite cuando el siguiente rebote está dentro de las tolerancias de posición y velocidad. El muestreo de valores de movimiento/traslación utiliza una tolerancia de interpolación de 0,25 unidades; el muestreador compartido informa cuando los casos extremos necesitan su respaldo de trabajo limitado. La configuración rechaza trayectorias que superan los 60 segundos o 512 vuelos y entradas no finitas/desbordantes. El rebote sin fin perfectamente elástico está fuera del contrato de esta curva finita.

Reducir movimiento va directamente al punto final en reposo a través de la configuración existente. La vista previa detiene la caída en ejecución inmediatamente cuando se selecciona su control Reducir movimiento. La descarga/eliminación libera enlaces y animaciones propias; el fondo temporal suspende el alcance de la vista previa.

La gravedad finita, las [colisiones entre círculos](./circle-physics) y los [anclajes elásticos y puntos de encaje](./physics-attachments) son las tres partes entregadas de [#39](https://github.com/rafaelaugustos/jolt/issues/39), disponibles desde **0.1.0-rc.1**. El mundo de círculos opcional también admite impulsos puntuales mediante `world.impulse()`. La compilación de desarrollo añade el [arrastre con resorte en el puntero](./physics-attachments) de [#238](https://github.com/rafaelaugustos/jolt/issues/238); el arrastre directo sigue siendo el predeterminado. Los [puntos de encaje de decay](./decay) y los [resortes continuos](./live-springs) conservan sus propios contratos. Consulte la [validación](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/gravity.md) y la [auditoría de las entregas](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/physics-completion.md).
