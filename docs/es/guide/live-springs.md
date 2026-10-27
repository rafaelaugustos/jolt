# Resortes con destino dinámico {#springs-that-follow-a-moving-target}

Disponible desde **0.1.0-beta.16**, en el paquete principal. Reconstruya la aplicación nativa después de la actualización. No se necesita ningún complemento opcional de propiedad nativa.

`springValue()` conserva la posición y la velocidad de un resorte nativo mientras su objetivo cambia. El retargeting actualiza el nodo existente; no reconstruye una animación de fotograma clave. Un seguidor puede impulsar a otro seguidor sin una suscripción JavaScript entre ellos.

```ts
import { bind, motionScope, motionValue, set, springValue } from '@rafaelaugusto/jolt'

const scope = motionScope()
const pointer = motionValue(0)
const first = scope.add(springValue(pointer, { stiffness: 260, damping: 24 }))
const second = scope.add(springValue(first, { stiffness: 260, damping: 24 }))
scope.use(() => bind(cursor, { x: first }))
scope.use(() => bind(trailingCursor, { x: second }))

set(pointer, 180)
set(pointer, -40) // preserves each follower's position and velocity
// On page/component disposal:
scope.dispose()
```

<Clip name="live-springs-ios" caption="Tres seguidores nativos en un simulador iOS: inversiones de objetivos, arrastres de toque real, una sacudida aditiva y movimiento reducido. Reproducción en tiempo real; Esta grabación no demuestra el rendimiento de 120 Hz del dispositivo físico." />

<Clip name="live-springs-android" caption="La misma cadena de seguidores en un emulador Android, impulsada por toques y deslizamientos reales. El último seguidor también recibe una capa de batido; El movimiento reducido mueve la cadena directamente a su objetivo." />

## Fuentes y enlaces {#sources-and-bindings}

La fuente puede ser un valor de movimiento, un mapeo numérico u otro valor de resorte. `animate(pointer, ...)` envía una pista fuente muestreada en los límites de reproducción, para que el seguidor también pueda seguir una línea de tiempo nativa. Las asignaciones numéricas `to()`, incluidos rangos descendentes, paradas repetidas y extrapolación, se ejecutan de forma nativa para cadenas de seguidores y enlaces.

Vincula el resultado a `x`, `y`, `scale`, `scaleX`, `scaleY`, `rotate`, `rotateX`, `rotateY` o `opacity`. Esta ruta en vivo aún no admite colores, decoraciones y adaptadores nativos compuestos. El valor del resorte es de solo lectura: actualice su fuente en lugar de pasar el seguidor a `animate()` o `set()`.

Las capas de transformación y opacidad con nombre aún se componen con la base enlazada:

```ts
bind(card, { x: first })
animate(card, { x: [0, -12, 12, 0] }, { layer: 'feedback', duration: 500 })
```

El mezclador nativo agrega capas de traducción/rotación y multiplica capas de escala/opacidad. Pausar o detener una capa deja al seguidor en ejecución. Reemplazar un enlace en vivo con una animación normal lo separa y confirma su posición base actual; el seguidor sigue impulsando sus otras ataduras.

## Configuración y vida útil {#configuration-and-lifetime}

Las opciones aceptan `stiffness`, `damping`, `mass` o la parametrización de resorte `duration`/`bounce` existente. `initial` selecciona una posición inicial; de lo contrario, el seguidor comienza en el valor actual de su fuente. `duration: 0` sigue inmediatamente. La escala de tiempo global se captura cuando se crea el seguidor.

`restDelta` tiene como valor predeterminado **0.001 unidades de origen** y `restSpeed` es **0,01 unidades fuente por segundo**. Ambos deben ser positivos. Un resorte en reposo mantiene su objetivo exactamente y deja de solicitar fotogramas cuando ningún otro seguidor o capa nativo los necesita. Se despierta con el siguiente cambio de objetivo. El resto no es disposición: la suscripción sigue siendo propiedad de su alcance hasta `dispose()`.

`get()` y `getVelocity()` leen el estado nativo. `moving` informa el movimiento del resorte, independientemente de cualquier capa. `subscribe()` opta explícitamente por la observación JavaScript; Los enlaces simples y las cadenas de seguidores no requieren devoluciones de llamada JS por cuadro. Al descargar una vista vinculada se elimina su enlace nativo y al cargarla nuevamente se utiliza el estado actual del seguidor.

`pause()` mantiene posición y velocidad; `play()` se reanuda hacia el objetivo actual. Un alcance de movimiento detiene los resortes retenidos durante la suspensión y los reanuda sin crear nuevos nodos. Un resorte pausado manualmente permanece en pausa en el fondo o en el reanudación de la aplicación. En Vue, use `useMotionScope().add(springValue(source, options))` con `useBinding()` para poseer el seguidor mediante la activación del componente en caché y el desmontaje real.

El movimiento reducido actualiza la cadena directamente a su objetivo actual. La suspensión de la aplicación mantiene el estado de resorte; El reanudación sigue la fuente actual nuevamente. El programador en vivo utiliza subpasos acotados de como máximo 1/240 segundos e integra como máximo 64 ms después de un cuadro retrasado, evitando un gran salto de recuperación. Las llamadas `animate()` de destino fijo conservan sus rutas de reproducción Core Animation/Android existentes.

Los eventos táctiles de la demostración actualmente actualizan la fuente de JavaScript. Para la entrada de gestos nativos y la transferencia de desplazamiento, utilice el [API de gestos](./gestures) opcional; `springValue()` no convierte el reconocedor de gestos en nativo. Los kernels de resorte de C y Java tienen pruebas de trayectoria coincidentes, incluida la partición en pasos de tiempo de 60/120 Hz y fotogramas retrasados. Esas pruebas no reemplazan las mediciones de rendimiento en dispositivos físicos.
