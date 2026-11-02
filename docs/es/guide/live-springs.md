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

Vincula el resultado a `x`, `y`, `scale`, `scaleX`, `scaleY`, `rotate`, `rotateX`, `rotateY` o `opacity`. La base estable excluye pintura y adaptadores compuestos; la [extensión RC.6](#live-paint) añade fondo y radio uniforme. El valor del resorte es de solo lectura: actualice su fuente en lugar de pasar el seguidor a `animate()` o `set()`.

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

## RC.6: color y esquinas en vivo {#live-paint}

Desde **0.1.0-rc.6**, el nativo ofrece bindings de `backgroundColor` y `borderRadius` uniforme. Recompila la aplicación para incluir el código nativo.

```ts
const target = motionValue(0)
const follower = springValue(target, { stiffness: 140, damping: 14 })
const release = bind(card, {
  backgroundColor: follower.to([0, 1], ['#8CB5FF', '#EFA26F']),
  borderRadius: follower.to([0, 1], [8, 70]),
})
set(target, 1)
```

El grafo nativo retenido interpola colores en OKLab con alfa premultiplicado, recorta al gamut sRGB y limita el progreso del color a sus extremos. Los mapeos numéricos pueden preceder al mapeo final de color. El radio no es negativo; el renderizador limita las esquinas al espacio disponible. Cambiar el objetivo escalar conserva el nodo y sus bindings, sin observador JavaScript ni reconstrucción de tracks por frame.

La base RC.6 tenía estos límites; la [extensión siguiente](#extended-live-paint) los amplía. Usa fondos sólidos sin imágenes ni gradientes. El radio exige esquinas circulares uniformes y bordes uniformes compatibles, sin clip path, corner shape ni box shadow CSS; usa otra superficie para la sombra. Color de texto, color/ancho del borde y otras decoraciones siguen fuera de esta superficie. Un destino incompatible se rechaza antes de reemplazar su binding.

Una escritura directa de estilo toma ese canal y libera su binding. Cambiar la imagen de fondo, el clipping o la estructura del borde libera los bindings afectados. Los demás canales continúan. La liberación normal conserva la pintura actual; un cleanup antiguo nunca sobrescribe un estilo o animación más reciente. Pausa, suspensión, segundo plano, unload/reload y reducción de movimiento usan el ciclo de vida existente. Libera los bindings y elimina el follower al desmontar el componente.

<Clip name="live-paint-ios" caption="Simulador iOS, interfaz en inglés: toques reales cambian color y radio, interrumpen el resorte y pausan/reanudan. Playback nativo; sin medición de rendimiento en dispositivo físico." />
<Clip name="live-paint-android" caption="Emulador Android, interfaz en inglés: toques reales con ADB cambian y pausan el resorte de color/radio. Velocidad original." />

[Validación nativa y reproducción](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/native-capabilities.md).

## Pintura retenida ampliada (RC.9) {#extended-live-paint}

**0.1.0-rc.9** amplía la base RC.6 anterior. Recompila la aplicación: estos bindings necesitan clases nativas actualizadas.

| Canal                                                                                              | Resorte nativo continuo                                                            | Binding Web                     |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------- |
| `backgroundColor`, `borderColor`                                                                   | Fondo sólido; color inicial uniforme del borde                                     | Compatible                      |
| `color`                                                                                            | Label/Button sin texto formateado en iOS; TextBase sin texto formateado en Android | Color de texto CSS              |
| `borderWidth`, `borderRadius`                                                                      | Valores uniformes en DIPs                                                          | Longitudes CSS                  |
| `borderTopWidth`, `borderRightWidth`, `borderBottomWidth`, `borderLeftWidth`                       | Anchos independientes no negativos en DIPs                                         | Longitudes CSS independientes   |
| `borderTopLeftRadius`, `borderTopRightRadius`, `borderBottomRightRadius`, `borderBottomLeftRadius` | Radios circulares independientes en DIPs                                           | Radios CSS circulares/elípticos |

```ts
const progress = motionValue(0)
const follower = springValue(progress, { stiffness: 180, damping: 24 })
const release = bind(card, {
  backgroundColor: follower.to([0, 1], ['#8CB5FF', '#EFA26F']),
  borderColor: follower.to([0, 1], ['#17332B', '#993C56']),
  color: follower.to([0, 1], ['#17332B', '#6B203F']),
  borderTopLeftRadius: follower.to([0, 1], [8, 64]),
  borderBottomRightRadius: follower.to([0, 1], [8, 64]),
  borderTopWidth: follower.to([0, 1], [3, 12]),
  scale: follower.to([0, 1], [1, 1.1]),
})
set(progress, 1)
// Component teardown: release(); follower.dispose()
```

Los canales nativos individuales aceptan mapeos de `springValue()`; esta extensión no añade lados/esquinas individuales al `animate()` nativo finito. Los anchos cambian la pintura sin animar el espacio interior del contenido. La pintura usa el hilo nativo de UI sin un bucle JavaScript por frame; no promete independencia de un hilo de UI ocupado.

Usa fondos sólidos y esquinas circulares. Se rechazan imágenes/gradientes, clip paths, esquinas squircle y texto formateado; la geometría continua necesita otra superficie para la sombra CSS. Se mantienen las diferencias de destino entre iOS y Android. Un lote inválido se rechaza antes de sustituir propietarios válidos.

Elige la propiedad uniforme o sus lados/esquinas individuales en cada llamada `bind()`. Una propiedad uniforme posterior toma toda su familia; un canal individual posterior libera el binding uniforme existente y conserva los otros lados en sus valores actuales. Los bindings individuales conviven. Las escrituras directas de estilo toman su canal. Otros cambios de borde vuelven a aplicar la pintura retenida cuando Core sustituye el drawable/layer, conservando fondo, radio y escala. Un cleanup antiguo no sobrescribe un binding nuevo. Pausa, suspensión, unload/reload y movimiento reducido conservan el ciclo de vida existente.

<Clip name="live-paint-extended-ios" caption="Simulador iPhone 17 Pro, iOS 26.2, interfaz en inglés: toques reales de XCTest cambian colores de fondo, texto y borde, esquinas/anchos independientes y escala; interrumpen y pausan/reanudan el resorte. Velocidad original, sin medición de dispositivo físico." />
<Clip name="live-paint-extended-android" caption="Emulador Android 16, interfaz en inglés: toques reales de ADB realizan los mismos cambios de pintura, interrupción y pausa/reanudación. Reproducción nativa a velocidad original; no es un dispositivo físico." />

[Validación y reproducción](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/live-paint-346.md).
