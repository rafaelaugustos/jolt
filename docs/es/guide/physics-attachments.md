# Anclajes y puntos de ajuste {#attachments-and-snap-points}

Dale a un círculo un lugar al que regresar, o deja que una liberación elija su próximo punto de descanso. Los archivos adjuntos y las instantáneas amplían la entrada nativa [`physicsWorld()`](./circle-physics) en **0.1.0-rc.1**. Reconstruya la aplicación nativa.

<Clip name="physics-attachments-ios" caption="Simulador iOS: el arrastre real estira la correa de cobre; Los lanzamientos lentos y rápidos mueven el círculo lila entre los muelles. Dibujo de líneas nativo, reorientación de anclaje, pausa/reanudación y reducción de movimiento. Interfaz de usuario en inglés, sincronización de fuente grabada." />
<Clip name="physics-attachments-android" caption="Emulador Android: las mismas interacciones con gestos reales de ADB, pasos nativos de resorte/colisión y dibujo de correa nativo. Interfaz de usuario en inglés, sincronización de la fuente grabada; no es una medida del rendimiento del dispositivo físico." />

Crea el mundo después del diseño. Los límites de contenedor dedicado, vistas de círculo cuadrado, propiedad, densidad y cuerpo de [física del círculo](./circle-physics) aún se aplican.

```ts
import { physicsWorld } from '@rafaelaugusto/jolt/physics'

// board is 320 × 360; copper is 56 × 56 and lilac is 52 × 52.
const world = physicsWorld(board, [
  {
    id: 'copper',
    view: copper,
    radius: 28,
    x: 160,
    y: 130,
    attachment: {
      anchor: { x: 160, y: 50 },
      length: 72,
      stiffness: 180,
      damping: 14,
      line: { color: '#DBB994', width: 1.5 },
    },
  },
  {
    id: 'lilac',
    view: lilac,
    radius: 26,
    x: 160,
    y: 280,
    snap: {
      points: [
        { x: 64, y: 280 },
        { x: 160, y: 280 },
        { x: 256, y: 280 },
      ],
      stiffness: 220,
      damping: 25,
      projection: 0.12,
    },
  },
])
world.snapTo('lilac', 1) // Optional initial dock; release selection is automatic.
// Later, retarget without resetting the current velocity:
world.attach('copper', { anchor: { x: 100, y: 50 }, length: 72 })
world.snapTo('lilac', 2)
// Remove the anchor spring and any selected snap:
world.attach('copper', null)
// On permanent teardown (or use an owning motionScope):
world.dispose()
```

## Muelle de anclaje {#anchor-spring}

Un `attachment` conecta un centro de carrocería a un punto fijo en el contenedor. `anchor` usa DIPs local y debe comenzar dentro de la placa. `length` es la longitud de reposo del resorte, 0–10000 DIPs (0 predeterminado). Es una distancia elástica, no un límite de cuerda dura. El equilibrio de un cuerpo colgante incluye estiramiento gravitacional: en una configuración vertical, la distancia adicional es `mass * gravity / stiffness`.

`stiffness` es fuerza por DIP, 1–1000 (predeterminado 180). `damping` es una amortiguación viscosa, 0–120 (predeterminado 24), distinta de la amortiguación de velocidad exponencial del mundo. La masa corporal existente afecta la respuesta. El integrador nativo de paso fijo aplica la fuerza del resorte y la amortiguación viscosa implícita junto con las colisiones y el límite de velocidad existente.

El `line` opcional dibuja la conexión desde el anclaje hasta el borde del círculo. Su color es `#RRGGBB`; el ancho es 0,5–6 DIPs (predeterminado 1,5). iOS utiliza una capa de forma y Android un dibujable. La marca del mundo nativo existente actualiza la línea; no hay reloj de pantalla adicional ni observador JavaScript. La reorientación reemplaza toda la configuración de los archivos adjuntos, incluido el estilo de línea. Omitir `line` elimina la línea anterior.

## Liberar ajuste {#release-snapping}

`snap.points` contiene de 1 a 8 centros de círculo válidos y distintos. El círculo comienza sin un muelle seleccionado; use `snapTo(id, index)` si debe comenzar adjunto a uno. En la versión nativa, Jolt limita la velocidad del puntero entrante, proyecta la posición de liberación del cuerpo mediante `velocity * projection` y luego selecciona el punto más cercano. `projection` es de 0 a 0,3 segundos (valor predeterminado: 0,12); cero elige por posición actual. Los lazos de igual distancia eligen el primer punto configurado.

El resorte elástico conserva la velocidad de liberación y se asienta hacia el centro seleccionado. La gravedad se suprime para el movimiento seleccionado de ese cuerpo para que no se asiente debajo del muelle. La resolución de colisiones todavía se aplica: un muelle ocupado puede impedir la llegada. `snapshot().bodies[i].snap` informa el índice/punto elegido y si el círculo está dentro de 0,25 DIP a baja velocidad; No promete reserva exclusiva. El diagnóstico nativo `release` registra la posición y la velocidad limitada antes de la selección/integración rápida.

La rigidez/amortiguación rápida utilizan los mismos rangos/valores predeterminados que los resortes de fijación. Un cuerpo puede configurar ambos comportamientos: el complemento seleccionado tiene prioridad; un nuevo arrastre suspende las fuerzas del resorte, y su liberación vuelve a elegir. La línea opcional apunta entonces al objetivo de resorte efectivo.

## Comandos, cancelación y diseño {#commands-cancellation-and-layout}

- `attach(id, options | null)` reemplaza/elimina el anclaje, borra el ajuste seleccionado y conserva la velocidad. Acepta cambios mientras está en pausa, pero los límites no válidos deben ajustarse a los círculos antes de realizar la reorientación.
- `snapTo(id, index)` selecciona un objetivo configurado, incluso mientras está en pausa. Ignora un cuerpo que está siendo arrastrado actualmente. Proporcione botones accesibles para este comando junto con la manipulación directa.
- El arrastre nativo es cinemático. Cancelación, pausa, descarga, fondo y Reducción de movimiento liberan el cuerpo retenido con velocidad cero y restauran su ajuste seleccionado anterior; no eligen un nuevo muelle a partir de un gesto cancelado.
- `reset()` restaura posiciones/velocidades iniciales, borra muelles seleccionados y libera diagnósticos, y mantiene las configuraciones actuales de puntos/accesorios. Llame nuevamente a `snapTo()` para seleccionar una base inicial.
- Los anclajes y puntos se escalan con los límites del contenedor utilizando coordenadas normalizadas almacenadas; los puntos se sujetan a centros de círculo válidos sin acumular cambios de tamaño. El radio del círculo y la longitud del soporte del accesorio permanecen fijos en DIPs. Cambiar tamaño cancela un cuerpo retenido y borra las velocidades como antes.

Pausa/Reducir movimiento detiene el reloj nativo existente. Una resorte tranquila duerme; un impulso, un retarget o un nuevo gesto lo despierta. La eliminación elimina las guías nativas junto con los recursos de entrada/ciclo de vida existentes en el mundo. Los cambios de entrada y los límites del ciclo de vida cruzan JavaScript; Las fuerzas, la selección de objetivos, los contactos, los dibujos y las actualizaciones de vistas por fotograma siguen siendo nativas. El hilo de la interfaz de usuario todavía se comparte con NativeScript JavaScript.

La vista previa **Un lugar para regresar / Equilibrium**, en cuatro idiomas, demuestra ambos comportamientos. Los resortes con anclajes fijos y los puntos de encaje al soltar son la tercera parte entregada de [#39](https://github.com/rafaelaugustos/jolt/issues/39), disponible en **0.1.0-rc.1**. El arrastre directo predeterminado suspende las fuerzas de los resortes. La compilación de desarrollo añade el modo de resorte en el puntero de [#238](https://github.com/rafaelaugustos/jolt/issues/238), descrito abajo. Las uniones entre cuerpos, las restricciones rígidas, las formas arbitrarias y un motor de dinámica general quedan fuera de este contrato. Consulte la [validación y reproducción](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/physics-attachments.md) y la [auditoría de las entregas](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/physics-completion.md).

## Arrastre con resorte en el puntero (compilación de desarrollo)

Esta función está en la compilación de desarrollo posterior a RC.1; reconstruye la app nativa. Usa `CircleBody.drag: { type: 'spring' }` para mover un ancla temporal mediante entrada nativa. El círculo conserva su masa dinámica, gravedad y colisiones. Sin `drag`, o con `'direct'`, se mantiene el arrastre cinemático existente.

<Clip name="pointer-spring-ios" caption="Simulador iOS: gestos reales de XCTest mueven el ancla del resorte, con retraso visible, colisiones, retorno y snap al soltar, pausa y Reduce Motion. Interfaz en inglés, tiempo original; no mide rendimiento en hardware físico." />
<Clip name="pointer-spring-android" caption="Emulador Android: gestos reales de ADB muestran el ancla móvil, colisiones y retorno al resorte fijo o al punto de reposo. Pausa y Reduce Motion; interfaz en inglés y tiempo original, sin mediciones de hardware físico." />

```ts
const world = physicsWorld(board, [
  {
    id: 'orb',
    view: orb,
    radius: 28,
    x: 160,
    y: 130,
    drag: {
      type: 'spring',
      length: 45,
      stiffness: 140,
      damping: 12,
      line: { color: '#FFE1A6', width: 2 },
    },
    attachment: { anchor: { x: 160, y: 50 }, length: 72 },
  },
])
```

`length` es la longitud elástica de reposo en DIPs (0–10000, predeterminado 0); `stiffness` acepta 1–1000 (180) y `damping`, 0–120 (24). La línea opcional usa `#RRGGBB` y un ancho de 0,5–6 DIPs (1,5). Las opciones se copian al crear el mundo. La línea temporal solo aparece durante el gesto; después vuelve la línea del ancla fija.

El contacto empieza dentro del círculo visible. Un puntero controla un cuerpo por mundo. El objetivo suma a la posición del puntero el desplazamiento inicial entre contacto y centro, y se limita a los bordes locales del contenedor. No es una articulación en la superficie; los círculos no rotan. No se admiten multitáctil simultáneo ni ancestros transformados.

Soltar elimina el ancla temporal y conserva la **velocidad simulada del cuerpo**, sin reemplazarla por la velocidad del dedo. Los puntos de snap se eligen con esa posición/velocidad; sin ellos vuelve el resorte fijo o el cuerpo queda libre. Cancelar libera el puntero, anula la velocidad y restaura el punto anterior sin registrar una liberación. Pausa, Reduce Motion, unload, segundo plano, resize, reset y dispose cancelan el gesto. `attach()` cambia el resorte de reposo, no el resorte del puntero activo. `snapTo()` e `impulse()` siguen ignorando un cuerpo sujeto.

En el snapshot, `held` indica posesión del gesto, `pointer` describe el ancla temporal activa o es `null`, y `attachment` conserva el ancla de reposo. La entrada, integración y línea usan el reloj nativo existente, sin callbacks JavaScript por movimiento o frame. El hilo de UI sigue siendo compartido. Consulta [validación y límites](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/pointer-spring.md).
