# Partículas y confeti {#particles-and-confetti}

## Confeti {#confetti}

<Clip name="particles" caption="La demostración de confeti original iOS, emitido desde un punto." />

```ts
import { confetti } from '@rafaelaugusto/jolt'

const stopConfetti = confetti(button, {
  count: 80,
  colors: ['#facc15', '#ef4444', '#3b82f6'],
})
```

El confeti explota hacia arriba desde el centro del objetivo y luego cae bajo la gravedad. Se representa en la ventana del destino, por lo que las esquinas redondeadas del botón y el recorte principal no lo cortan. No agrega ninguna vista interactiva y deja sin cambios la apariencia del objetivo, las máscaras y las pruebas de impacto.

El origen se captura cuando comienza la ráfaga, en coordenadas de ventana. Mover o desplazar el botón después no mueve las partículas que ya están volando. Una nueva ráfaga captura la nueva posición, incluido el desplazamiento y las transformaciones. `count` es un recuento de emisiones aproximado, no una promesa de un número exacto de partículas visibles: el recorte, la programación nativa y la vida útil afectan la visibilidad. El valor predeterminado es `80`, con una paleta de cinco colores. Las trayectorias aleatorias pueden diferir entre plataformas.

La emisión dura 200 ms y las partículas viven 2200 ms. La capa se elimina automáticamente una vez caducadas. Llame a `stopConfetti()` para eliminarlo de inmediato.

## Emisores continuos {#continuous-emitters}

`particles()` adjunta un emisor sobre el contenido del objetivo: una capa en iOS, un dibujable en su `ViewOverlay` en Android. Sigue las transformaciones del objetivo y la posición de desplazamiento, y cambia el tamaño de la fuente para nuevos nacimientos sin reiniciar las partículas existentes. Android recorta el dibujable a los límites del objetivo y lo uniforma `borderRadius`; iOS sigue el recorte de la capa host. Utilice un diseño como objetivo cuando las partículas deban cubrir una escena en lugar de un solo control.

Confetti utiliza la capa/superposición de nivel superior de la ventana, por lo que puede cruzar el botón y sus diseños principales. Permanece delimitado por esa ventana, debajo de ventanas de sistema separadas. Ninguno de los backends agrega un objetivo táctil o un elemento de accesibilidad; Los controles debajo del efecto siguen siendo utilizables.

```ts
import { particles } from '@rafaelaugusto/jolt'

const stopSnow = particles(scene, {
  source: 'top',
  angle: 90,
  rate: 30,
  velocity: 45,
  velocityRange: 15,
  spread: 30,
  size: 5,
  lifetime: 5000,
})

// Remove the emitter and its particles:
stopSnow()
```

Las chispas se emiten en todas direcciones desde el centro:

```ts
particles(scene, {
  colors: ['#facc15', '#fb923c'],
  velocity: 120,
  velocityRange: 50,
  spread: 360,
  rate: 70,
  size: 3,
  lifetime: 1000,
})
```

Burbujas suben desde el fondo:

```ts
particles(scene, {
  shape: 'ring',
  source: 'bottom',
  colors: ['#67e8f9', '#a5f3fc'],
  velocity: 40,
  spread: 20,
  rate: 14,
  size: 18,
  lifetime: 5000,
})
```

Agregue `duration` para detener la emisión después de un número finito de milisegundos. Las partículas existentes terminan su vida útil antes de que se eliminen los recursos nativos:

```ts
particles(scene, {
  shape: 'rectangle',
  colors: ['#facc15', '#fb923c'],
  rate: 90,
  duration: 700,
  lifetime: 1400,
  velocity: 100,
  gravity: 130,
  spinRange: 240,
})
```

El corte es nativo en ambas plataformas. iOS usa Core Animation y un temporizador de limpieza final de JS. Android utiliza un reloj nativo monótono y limpieza nativa; bloquear su hilo de interfaz de usuario retrasa el dibujo y la entrega de devolución de llamada, pero no extiende la emisión ni la vida útil. Al regresar, omite los nacimientos ya vencidos y elimina los efectos completos. Los efectos cancelados por la puesta en segundo plano nunca acumulan un trabajo pendiente.

<Clip name="particles-android" caption="Emulador Android 16 / API 36: toques reales a través de nieve, anillos y confeti de ventanas; chispas, rectángulos finitos, cambio de tamaño y movimiento reducido. Dibujo de subprocesos de interfaz de usuario nativos en tiempo real, que puede detenerse cuando ese subproceso está ocupado." />

| Opción                       | Predeterminado | Significado                                                                                              |
| ---------------------------- | -------------- | -------------------------------------------------------------------------------------------------------- |
| `colors`                     | `['#ffffff']`  | Cadenas de colores NativeScript, compartidas equitativamente por tasa de emisión.                        |
| `shape`                      | `'circle'`     | `'circle'`, `'rectangle'` o `'ring'`.                                                                    |
| `source`                     | `'center'`     | Un punto central o una línea que cruza el `'top'` o `'bottom'`.                                          |
| `rate`                       | `20`           | Partículas totales por segundo, en todos los colores.                                                    |
| `lifetime`                   | `3000`         | Milisegundos de vida cada partícula.                                                                     |
| `size`                       | `6`            | Lado más largo en DIPs.                                                                                  |
| `velocity` / `velocityRange` | `60` / `0`     | Velocidad inicial y variación aleatoria nativa, en DIPs por segundo.                                     |
| `angle` / `spread`           | `-90` / `30`   | Dirección y cono de emisión en grados. A la derecha está `0`, abajo está `90`, arriba está `-90`.        |
| `gravity`                    | `0`            | Aceleración hacia abajo en DIPs por segundo al cuadrado; los valores negativos se aceleran hacia arriba. |
| `spin` / `spinRange`         | `0` / `0`      | Rotación y variación aleatoria nativa, en grados por segundo.                                            |
| `fadeOut`                    | `true`         | Las partículas se desvanecen a lo largo de su vida.                                                      |
| `duration`                   | Omitido        | Milisegundos de emisión; omitido significa continuo.                                                     |

Los valores deben ser finitos. Los límites son 1 a 32 colores, 1 a 128 tamaños de DIP, 1 a 60 000 ms de vida útil, 0 a 10 000 partículas por segundo y una población viva estimada (`rate × lifetime / 1000`) de como máximo 10 000. La velocidad y su variación son 0 a 10 000, la gravedad es −10 000 a 10 000, el ángulo es −360 a 360, la dispersión es 0–360, el giro es −3600–3600 y su variación es 0–3600. Una duración finita debe ser positiva y dejar espacio para toda la vida más 50 ms dentro de un temporizador de 32 bits. Confetti acepta un conteo de números enteros de 0 a 10000. El conteo o tasa cero elimina el efecto de coincidencia anterior sin iniciar otro.

## Limpieza y compatibilidad {#cleanup-and-compatibility}

Ambas funciones aceptan una vista o una referencia que contiene una y devuelven una función de limpieza idempotente. En una vista pueden coexistir una explosión de confeti y un emisor de partículas. Iniciando otro del mismo tipo sustituye al anterior; una función de limpieza antigua no puede eliminar su reemplazo. `stop(view)` controla las orugas `animate()`; use la función devuelta para partículas.

Las llamadas realizadas antes de la carga esperan una ventana y un diseño distinto de cero; su reloj de emisión comienza sólo cuando está conectado. Descargar, cambiar vistas/ventanas nativas, desconectar un objetivo Android nativo o cambiar el tamaño de un objetivo activo a cero elimina el efecto. El fondo de la aplicación cancela explícitamente ambos efectos. No se reproducen automáticamente al recargar o al ponerse en primer plano. Mantenga la función de limpieza y llámela cuando se deseche su componente.

Utilice un alcance de movimiento existente para poseer la limpieza:

```ts
const scope = motionScope() // useMotionScope() in Vue
const remove = scope.use(() => particles(scene, { source: 'top', angle: 90 }))
// remove() or scope.dispose() removes the emitter immediately.
```

`scope.use()` es una fábrica de suscripción: la suspensión elimina su efecto y un resumen de alcance explícito invoca a la fábrica para crear una nueva. No retoma las partículas viejas. En Vue, créelo después de montar la referencia y deje que `useMotionScope()` lo elimine al desmontarlo.

## Plataformas y cronometraje {#platforms-and-timing}

| Capacidad                                                                    | iOS                                | Android                                        |
| ---------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------- |
| Círculos, rectángulos, anillos; fuentes centrales/superiores/inferiores      | Nativo `CAEmitterLayer`            | Simulación nativa de Java y dibujable `Canvas` |
| Emisión continua, finita y confeti                                           | Compatible                         | Compatible                                     |
| Colores/alfa, tamaño, velocidad/rango, gravedad, giro/rango, desvanecimiento | Compatible                         | Compatible                                     |
| Confeti de ventana y paso táctil.                                            | Compatible                         | Compatible                                     |
| Simulación JS o devolución de llamada de pintura por cuadro                  | Ninguno                            | Ninguno                                        |
| Limpieza de fondo/descarga, cambios de movimiento reducido en vivo           | Cancela; sin repetición automática | Cancela; sin repetición automática             |

El backend Android se incluye con Jolt, utiliza API de plataforma y no agrega ningún complemento opcional, dependencia o permiso de terceros. Reconstruya la aplicación Android después de la actualización; una actualización solo de JS no puede instalar las clases de Java ni sus metadatos de puente. Los requisitos actuales de NativeScript no se modifican.

Reducir los efectos de saltos de movimiento; habilitarlo a través de `configure()` mientras se ejecuta un efecto lo elimina. Android también observa la escala del animador de la plataforma de forma nativa: **escala 0 cancela/salta efectos incluso con `reducedMotion: 'never'`**. Escalas positivas como **0,5 y 2 mantienen las duraciones de las partículas y las unidades físicas en el tiempo de pared**, como `timeScale`, que no reprograman este efecto. Un cambio de configuración no puede dejar un emisor finito sin fin. Restaurar el movimiento requiere una nueva llamada.

Android preasigna como máximo 10,000 ranuras de partículas por emisor, reutilizando matrices y recursos de pintura/trayectoria. Los emisores continuos asignan ranuras `ceil(rate × lifetime / 1000)`; los emisores finitos sólo necesitan la ventana más pequeña de emisión/vida útil. Una ranura utiliza 36 bytes de estado primitivo, aproximadamente 352 KiB como límite, además de pequeños objetos nativos fijos y buffers de diagnóstico. El bucle de animación no crea una devolución de llamada JS ni un objeto Java para cada partícula/cuadro. La limpieza libera las matrices, el elemento dibujable, las devoluciones de llamada de marco/fecha límite y el observador de configuración.

Este es el dibujo nativo **hilo de interfaz de usuario**. En el ASUS API 26 físico, las nevadas normales (30 nacimientos/s, pico 121 durante los cuatro segundos medidos) tuvieron un intervalo de devolución de llamada p95 de 16,73 ms; el caso de tensión de 10.000 partículas alcanzó 167,05 ms. El emulador API 36 midió 16,67 ms y 33,33 ms respectivamente. Estos son intervalos de Choreographer observados, no garantías de GPU/presentación ni clasificaciones de dispositivos. Mantenga poblaciones modestas para escenas interactivas; el almacenamiento de límites máximos de 10,000. Los entornos exactos, los costos de consumo de CPU, las tolerancias y los resultados sin procesar se encuentran en [el informe de validación](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/particles.md).

<Clip name="particles-android-device" caption="Física ASUS_Z017DC, Android 8 / API 26: toques reales a través de efectos activos, emisión continua y finita, cambio de tamaño y movimiento reducido. Reproducción nativa de subprocesos de interfaz de usuario en tiempo real; Las mediciones de tensión son independientes de esta demostración ordinaria." />

<Clip name="particles-ios" caption="Simulador iPhone 17, iOS 26: API de partículas sin cambios, todas las formas/modos de fuente, paso táctil, cambio de tamaño y movimiento reducido en vivo, ejercitado con toques XCTest. Las imágenes existentes de iOS se conservan arriba." />
