# Gestos nativos {#native-gestures-and-scroll-handoff}

Disponible desde **0.1.0-beta.16**, en el paquete principal. Reconstruya la aplicación nativa después de la actualización. No se necesita ningún complemento opcional de propiedad nativa.

`gestures()` compone panorámica, pellizco y rotación en un `GestureSurface`, un NativeScript `GridLayout` con un límite de entrada nativo. Sus salidas de solo lectura funcionan con `bind()`, asignaciones numéricas `to()` y `springValue()`. El reconocimiento, el seguimiento del puntero y las actualizaciones de salida vinculada no requieren devoluciones de llamada JavaScript para cada movimiento.

Importe esta API opcional desde `@rafaelaugusto/jolt/gestures` y reconstruya la aplicación nativa después de la actualización.

```ts
import { bind, motionScope, springValue } from '@rafaelaugusto/jolt'
import { GestureSurface, gestures } from '@rafaelaugusto/jolt/gestures'

const scope = motionScope()
const surface = new GestureSurface()
surface.addChild(card)
container.addChild(surface)
const input = scope.add(
  gestures(surface, {
    pan: { bounds: { left: -120, right: 120, top: -160, bottom: 160 } },
    pinch: { min: 0.5, max: 3 },
    rotate: true,
  }),
)
scope.use(() =>
  bind(card, {
    x: input.x,
    y: input.y,
    scale: input.scale,
    rotate: input.rotate,
  }),
)
const follower = scope.add(springValue(input.x))
scope.use(() => bind(trailingCard, { x: follower }))

// On page/component disposal:
scope.dispose()
```

<Clip name="gesture-composition-ios" caption="Entrada táctil real del sistema operativo en un simulador iOS: movimiento, pellizco y rotación simultáneos, agregar/quitar un dedo, gestos separados, toque simple/doble y un oyente de toque NativeScript existente. El arnés de grabación utiliza XCTest; no es una medida del rendimiento de un dispositivo físico." />

<Clip name="gesture-composition-android" caption="Entrada multitáctil del sistema operativo real en un emulador Android, seguida de toques simples/dobles y cancelación del puntero. El oyente de tap NativeScript permanece conectado. Las posiciones de los gestos son DIP; la escala no tiene unidades y la rotación es grados." />

## Políticas de reconocimiento {#recognition-policies}

Se ha habilitado el reconocimiento de giro, pellizco y rotación simultáneamente. Agregar o quitar un dedo reajusta el centroide panorámico y las medidas de escala/rotación sin agregar ese cambio de centroide a la salida. Las salidas de transformación son independientes; utilice [ampliable](./photo-zoom) cuando necesite zoom focal, límites de contenido y descarte específicos de una imagen.

`pan` acepta `axis: 'x' | 'y' | 'both'` (predeterminado `'both'`), `threshold` (predeterminado **8 INMERSIONES**), `failOffset` (predeterminado **12 INMERSIONES**) y traducción `bounds`. Una panorámica de un eje falla antes de la activación cuando el movimiento perpendicular excede `failOffset`, lo que permite que gane el desplazamiento principal. Los límites son límites estrictos durante el contacto. La superficie debe asentarse en una cadena ancestral sin escalas ni rotada; mueva su contenido vinculado por separado cuando sea posible.

`pinch: true` utiliza límites de escala **0.25–4**; pase `{ min, max }` para cambiarlos. `rotate: true` permite la rotación en grados. `initial` acepta `{ x, y, scale, rotate }`, por defecto es `{ x: 0, y: 0, scale: 1, rotate: 0 }`; los valores iniciales deben ajustarse a sus límites configurados.

`onTap` y `onDoubleTap` están separados. Cuando ambos existen, el toque único espera a que falle el doble toque. Sin una devolución de llamada de doble toque, el toque único no espera esa relación. `onStart`, `onEnd` y `onCancel` reportan `{ x, y, scale, rotate, velocityX, velocityY }`; las velocidades de traslación son DIP/segundo y los ejes deshabilitados informan cero. Una interacción activa cancelada emite una cancelación y una devolución de llamada sin finalización. No hay una aventura automática; elija una acción de liberación en `onEnd`.

Estas son las relaciones integradas de una superficie, no un gráfico arbitrario de reconocedores externos. Los oyentes existentes de NativeScript siguen siendo independientes. Un oyente que escribe la misma transformación aún puede competir con un enlace Jolt.

## Una interacción horizontal en una lista vertical {#a-horizontal-interaction-in-a-vertical-list}

Coloque un `GestureSurface` en el contenido de la lista, configure una panorámica del eje x y vincule la posición x de la tarjeta. El movimiento horizontal activa la sartén; El movimiento vertical permite que el desplazamiento nativo circundante tome el control. La lista circundante no es la opción `scrollView` a continuación.

<Clip name="gesture-carousel-ios" caption="Una interacción horizontal dentro de un NativeScript vertical ScrollView en un simulador iOS. Un arrastre vertical comienza en la misma tarjeta y desplaza al padre." />

<Clip name="gesture-carousel-android" caption="La competencia del mismo eje en un emulador Android. El movimiento horizontal permanece con la tarjeta; el movimiento vertical desplaza a su padre." />

## Transferencia entre un panel y su contenido {#transfer-between-a-panel-and-its-content}

Para un panel vertical que contiene un **NativeScript ScrollView**, pase ese descendiente como `scrollView` y proporcione ambos límites verticales:

```ts
const input = scope.add(
  gestures(panelSurface, {
    initial: { y: 180 },
    pan: { axis: 'y', bounds: { top: 0, bottom: 320 } },
    scrollView: results,
    onEnd: ({ y, velocityY }) => {
      input.settleTo({ y: y + velocityY * 0.15 < 160 ? 0 : 320 })
    },
  }),
)
scope.use(() => bind(panelSurface, { y: input.y }))
```

Arrastrar hacia arriba consume el recorrido restante del panel antes de desplazarse por su contenido. Arrastrar hacia abajo consume la distancia del contenido hasta la parte superior antes de mover el panel. El mismo contacto continúa al otro lado de la frontera. Android utiliza consumo de desplazamiento previo y posterior anidado; iOS coordina una panorámica simultánea con la vista de desplazamiento nativa y reenvía su delegado existente. El desplazamiento nativo conserva su liberación cuando el contenido ampliado puede consumirlo.

<Clip name="gesture-handoff-ios" caption="Un deslizamiento continuo expande el panel y luego desplaza su contenido; el deslizamiento inverso llega a la parte superior del contenido y mueve el panel hacia abajo. Simulador iOS, panel de pruebas en página." />

<Clip name="gesture-handoff-android" caption="La misma transferencia en página en un emulador Android usando la implementación NestedScrollView de NativeScript. No es necesario levantar el dedo en el límite del panel/contenido." />

Esta integración se probó con el núcleo NativeScript, **9.1.3**, el tiempo de ejecución iOS, **9.1.0** y el tiempo de ejecución Android, **9.1.1**. Soporta el núcleo vertical ScrollView; no promete transferencia para ListView, complementos de RecyclerView, implementaciones de listas de terceros o desplazamiento interno horizontal. Android comprueba que el desplazamiento nativo implemente el protocolo de desplazamiento anidado requerido. Una lista diferente necesita su propio adaptador y pruebas nativas.

## Movimiento y propiedad {#movement-and-ownership}

`position` lee los cuatro valores actuales. Después de las cargas superficiales, `jumpTo(partialPosition)` se mueve inmediatamente y `settleTo(partialPosition)` utiliza un resorte nativo. Una estabilización solicitada desde `onEnd` conlleva velocidad de liberación; Reorientar un asentamiento existente preserva su velocidad actual. `spring` acepta `stiffness`, `damping` y `mass`. El movimiento reducido hace que el asentamiento sea inmediato mientras que el seguimiento directo de los dedos permanece disponible.

`updateBounds(partialBounds)` actualiza los límites sin restablecer la posición o la velocidad. No selecciona un nuevo destino: llame a `settleTo()` con el punto de ajuste recién resuelto cuando cambie el diseño/contenido.

`cancel()` congela el contacto o se establece en la posición actual. `pause()` cancela y deja de aceptar entradas; `play()` acepta un nuevo contacto. La suspensión del alcance utiliza estos métodos. La descarga y la suspensión de la aplicación cancelan la entrada; recargar/reanudar lo restaura a menos que se pausa manualmente. `dispose()` elimina los reconocedores propios/el envío nativo, restaura la delegación de desplazamiento y libera los cuatro valores. Colocar o levantar un dedo no pone fin a la vida útil del controlador.

En Vue, registre `GestureSurface` con `registerElement('GestureSurface', () => GestureSurface)` antes de montar la aplicación y adopte el controlador con `useMotionScope().add(...)`. Agregue enlaces con `useBinding()` o el asistente `use()` del osciloscopio. La demostración está disponible en **Gestos nativos** en el patio de juegos o con `--gesture-lab` en iOS / `--es gesture-lab true` en Android.

La entrada nativa y los resortes activos aún se ejecutan en el subproceso de la interfaz de usuario. Ocupado JavaScript en ese hilo puede retrasarlos. Las devoluciones de llamada explícitas, los oyentes principales existentes y `subscribe()` conservan sus costos de JavaScript. Los inyectores multitáctiles se encuentran únicamente en el arnés de grabación; no se envían como código de aplicación.

`onContactStart` y `onContactEnd` informan el primer y último contacto, incluido un toque que nunca se convierte en una panorámica. Son opcionales y requieren una reconstrucción nativa. El [receta de sábana bajera](./bottom-sheet) los utiliza para asentar un resorte interrumpido por contacto sin interceptar golpes en campos de texto.
