# Reproducción de interacciones {#record-and-replay-an-interaction}

Mantenga las entradas que reprodujeron un error, congele su movimiento esperado y reprodúzcalas en la siguiente compilación. La entrada opcional **@rafaelaugusto/jolt/pruebas** proporciona un seguimiento numérico versionado, un registrador opcional y un corredor basado en adaptador. **@rafaelaugusto/jolt/testing/nativo** agrega un controlador Jolt controlado, captura de panorámica central y lecturas de presentación nativas.

::: warning Herramientas de desarrollo
Disponible desde **0.1.0-beta.18** en el paquete principal. Reconstruya la aplicación nativa para los asistentes de reproducción nativos. Utilice estas entradas en un dispositivo de desarrollo aislado. No son telemetría de producción y no instalan observadores simplemente por ser importados.
:::

<Clip name="interaction-replay-ios" caption="Simulador de iOS, toques y arrastres reales de XCTest: acepta una toma de resorte, reprodúcela, detecta un punto de control deliberadamente incorrecto, luego cancela y repite un arrastre. La reproducción utiliza el tiempo lógico grabado; la duración del reloj de pared no es una medida de rendimiento." />

<Clip name="interaction-replay-android" caption="Emulador de Android con toques y deslizamientos reales de ADB. La aplicación cancela el arrastre mientras continúa el contacto. El seguimiento guardado se verifica primero en el motor y luego en comparación con las posiciones de vista nativas. Velocidad de grabación original." />

## Graba solo las entradas que elijas {#record-only-the-inputs-you-choose}

```ts
import { recordInteraction } from '@rafaelaugusto/jolt/testing'
import {
  observeTraceInputs,
  traceMetadata,
  traceNow,
  traceSettings,
} from '@rafaelaugusto/jolt/testing/native'

const take = recordInteraction({
  now: traceNow,
  seed: 63,
  metadata: traceMetadata(),
  settings: traceSettings(),
  motions: [
    {
      id: 'card',
      kind: 'spring',
      axis: 'x',
      initial: 0,
      stiffness: 170,
      damping: 26,
      mass: 1,
      min: 0,
      max: 240,
      snap: [],
    },
  ],
})

take.input({ type: 'target', id: 'card', value: 180 })
// Apply the same target to your graph. Sample at its controlled clock boundary:
take.checkpoint('card', { position: 0, velocity: 0, settled: false })

// Optional environment capture. These events need an application replay adapter.
const detach = observeTraceInputs(cardView, 'card', take, {
  layout: true,
  keyboard: true,
  lifecycle: true,
})
detach()
const trace = take.stop()
saveFixture(JSON.stringify(trace))
```

La persona que llama posee la persistencia y el reloj monótono. Las marcas de tiempo iguales conservan el orden de inserción. Las entradas incluyen cambios de destino, posición panorámica/velocidad/ranuras de contacto, rectángulos de diseño, desplazamientos de desplazamiento, inserciones de teclado y cambios en el ciclo de vida. Las coordenadas son DIP, la velocidad es DIP/s y las marcas de tiempo son milisegundos desde el inicio de la grabación. Las ranuras de contactos describen el recuento de contactos activos; no son identidades de puntero nativas y no reconstruyen el reconocimiento multitáctil.

El esquema rechaza campos desconocidos, ID de vistas desconocidas, valores no finitos, marcas de tiempo invertidas y versiones no compatibles. Los seguimientos no contienen texto de campo, bytes de imagen, objetos de vista ni identificadores nativos. Elija ID estables no personales y etiquetas de modelo/sistema operativo. La versión 1 limita las grabaciones a 5.000 entradas, cinco minutos y 32 mociones; La entrada JSON está limitada a 2 MB. Una grabadora que llega a un límite arroja, por lo que su propietario debe separar a los observadores y dejar de grabar.

**Los puntos de control deben utilizar el mismo reloj lógico que la reproducción.** Un animador nativo puede comenzar después de la devolución de llamada de entrada y presentar un cuadro posterior a la muestra del motor. La vista previa conserva esa captura de presentación sin procesar por separado, luego **Finalizar toma** congela una línea base de motor controlado una vez. Las repeticiones posteriores utilizan la línea base guardada sin regenerarla. Revise y confirme ese JSON como oráculo de regresión. Los dispositivos Canonical CI utilizan puntos de control congelados e independientes en lugar de aceptar la implementación actual en cada ejecución.

## Ejecute el motor, luego la sonda nativa. {#run-the-engine-then-the-native-probe}

```ts
import { parseTrace } from '@rafaelaugusto/jolt/testing'
import { motionTraceGraph, replayWithDriver } from '@rafaelaugusto/jolt/testing/native'

const trace = parseTrace(savedJSON)
for (const native of [false, true]) {
  const report = await replayWithDriver(
    trace,
    (trace) => motionTraceGraph(trace.motions, (id) => views.get(id)!, { native }),
    { native },
  )
  if (!report.passed) {
    saveArtifact('trace.json', JSON.stringify(report.trace))
    saveArtifact('expected-observed.svg', report.plot)
    throw new Error(report.errors.join('\n'))
  }
}
```

El dispositivo nativo ya debe tener vistas cargadas. Configure su escala de tiempo y resuelva el movimiento reducido para que coincida primero con el seguimiento. El corredor reemplaza temporalmente el controlador global de Jolt y lo restaura en **finalmente**. Ejecute una repetición aislada a la vez, sin animaciones no relacionadas. No controla los relojes de resorte en vivo retenidos ni las sesiones de gestos nativos.

**Reloj de reproducción** avanza una vez por cada marca de tiempo registrada distinta. Un intervalo de 288 ms equivale a un fotograma largo. Las pistas nativas se mantienen y buscan en el tiempo lógico correspondiente; la sonda espera dos cuadros de presentación, con un plazo acotado. iOS lee la capa de presentación sin un respaldo de capa de modelo; Android lee la traducción nativa en DIP. La velocidad y el estado estable provienen del motor, no de una medida de velocidad nativa de diferencia finita.

Cada punto de control compara la posición y la velocidad con tolerancias explícitas (predeterminadas: 3 DIP y 30 DIP/s), además del estado establecido exacto. El ejecutor desecha el adaptador en caso de éxito, falta de coincidencia, cancelación o error, luego requiere que el recuento de recursos de su propiedad sea cero. Los informes contienen observaciones, errores, recursos restantes, el seguimiento y un gráfico de posición esperada/observada.

## Adaptadores de aplicación y cobertura {#application-adapters-and-coverage}

El gráfico de referencia utiliza **animar**, **motionValue**, **enlazar**, **arrastrar** y **motionScope** reales. Cubre los casos iniciales en el n.° 63: un resorte interrumpido, continuidad en el traspaso exacto del objetivo, un arrastre de un solo puntero cancelado, movimiento posterior a la cancelación ignorado, suspensión y eliminación del ciclo de vida. Un punto de control nativo deliberadamente incorrecto debe fallar. La suite de regresión también detecta y repara la caída del motor en la velocidad del resorte entrante en el instante exacto de la transferencia.

Los eventos de diseño, teclado, desplazamiento y carga/descarga se conservan, pero requieren enrutamiento de la aplicación. El gráfico de referencia rechaza eventos no respaldados; nunca los ignora silenciosamente. Utilice su devolución de llamada **entorno** o proporcione un **Adaptador de reproducción** con **entrada**, **leer**, **disponer** y **recursos**. El corredor **replayInteraction** puro acepta su reloj **advanceTo** y pasa una función aleatoria local a la fábrica del adaptador. Nunca reemplaza al **Matemáticas.aleatorias** global.

El siguiente adaptador de desplazamiento a hoja cubre la propiedad del contacto en la sesión de gestos nativa utilizada por **bottomSheet**. Las pruebas actuales del sistema operativo [gesto](./gestures) y [sábana bajera](./bottom-sheet) conservan la cobertura del reconocedor y de la receta. La reproducción de gráficos sintéticos pasa por alto el reconocedor y no prueba pruebas de acierto, sincronización de animación del teclado ni recorte.

El experimento **57 — Repetición de la interacción** está traducido al inglés y al portugués. El [guía de validación](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/interaction-replay.md) enumera comandos, artefactos y limitaciones.

<Clip name="interaction-replay-pt-ios" caption="La vista previa integrada en portugués brasileño en un simulador iOS: una grabación de resorte real y repetición nativa, utilizando toques reales de XCTest a la velocidad de grabación original." />

## Desplazamiento → entrega de hoja {#scroll-→-sheet-handoff}

En el experimento 57, elija **Desplazamiento → hoja**. Registre un tirón dentro de las notas e inviértalo: el desplazamiento llega a su parte superior antes de que la hoja baje; al invertirla, la hoja se expande antes de que el contenido se desplace. Acepte la toma, reprodúzcala o rompa deliberadamente un punto de control de desplazamiento.

<Clip name="scroll-handoff-replay-ios" caption="Simulador iOS: XCTest real arrastra el contacto desde el contenido a la hoja y viceversa, luego el seguimiento numérico guardado se reproduce a través de la sesión nativa. Se detecta un punto de control de desplazamiento incorrecto. Velocidad de captura original; la repetición utiliza el tiempo lógico." />

<Clip name="scroll-handoff-replay-android" caption="Emulador Android: drags reales de ADB, repetición grabada y control negativo de propiedad nativa. Se verifican tanto la traducción de la hoja como el desplazamiento del desplazamiento nativo. No hay reclamo de rendimiento del dispositivo físico." />

```ts
import { parseTrace, scrollHandoffTraceGraph } from '@rafaelaugusto/jolt/testing'
import {
  nativeScrollHandoffTraceGraph,
  replayWithDriver,
} from '@rafaelaugusto/jolt/testing/native'

const trace = parseTrace(savedJSON)
for (const native of [false, true]) {
  const report = await replayWithDriver(
    trace,
    (trace) =>
      native
        ? nativeScrollHandoffTraceGraph(trace.motions, gestureSurface, scrollView)
        : scrollHandoffTraceGraph(trace.motions),
    { native },
  )
  if (!report.passed) saveFailure(report)
}
```

El adaptador sin cabeza es un contrato de propiedad independiente. El adaptador nativo invoca el mismo código de consumo utilizado por la sesión de gestos de producción: el enrutamiento delta de desplazamiento de iOS y la secuencia de desplazamiento previo/secundario/post-desplazamiento de Android. No implementa una segunda aproximación nativa. La entrada sin formato del sistema operativo permanece cubierta por las afirmaciones separadas XCTest/ADB en los clips.

Configure dos movimientos **arrastrar** con **eje: 'y'**, arreglos **chasquido** vacíos y ID estables **hoja** y **desplazarse**. El mínimo de desplazamiento es cero; su máximo debe coincidir con el rango de desplazamiento cargado dentro de 1 DIP. Ambos adaptadores aceptan una asignación de ID **{ hoja, desplazamiento }** opcional. Se deben cargar las vistas nativas, el desplazamiento debe ser un descendiente vertical de un **GestureSurface** sin propietario y se deben reconstruir las clases nativas. Las sesiones nativas de solo reproducción desactivan la entrada del sistema operativo y rechazan una superficie que ya es de su propiedad.

Las entradas utilizan posiciones de contacto acumulativas relativas a la ventana; contacto cambios de membresía rebase sin mover la hoja. Los eventos de desplazamiento establecen el desplazamiento externo. Cancelación, suspensión y descarga dar por terminado el antiguo contacto; reanudar/cargar requiere un nuevo comienzo. Objetivos no compatibles, teclado y diseño de enrutamiento. Este adaptador se mantiene en la posición liberada: el lanzamiento, la selección automática de resorte y los resortes retenidos de funcionamiento libre pertenecen a pruebas separadas de la receta.

**observeScrollHandoffInputs(scrollView, grabador, traceNow)** opcionalmente captura contactos táctiles Core sin procesar y el desplazamiento inicial del desplazamiento; deseche su función devuelta antes de la reproducción. La captura es numérica y no contiene texto de lista ni identificadores nativos. Registra contactos sin procesar, no decisiones del reconocedor. La vista previa congela los estados esperados del contrato independiente durante la captura; las repeticiones mantienen esos puntos de control sin cambios. Los accesorios canónicos también cubren la inversión del mismo contacto, un fotograma largo, cancelación, cambio de base del puntero, límites y pequeños pasos fraccionarios. Android transporta píxeles fraccionarios entre muestras en lugar de acumular errores de redondeo.

El informe nativo lee la presentación de la hoja real y el desplazamiento de desplazamiento nativo. La velocidad de la hoja es la velocidad de entrada mantenida nativa cuando esa muestra mueve la hoja, cero en caso contrario; La velocidad de desplazamiento no se mide con este adaptador. Estado establecido significa que el contacto finalizó y el nodo nativo está en reposo. Un punto de control de desplazamiento deliberadamente incorrecto debe fallar y la eliminación debe devolver el recuento de nodos nativos a su línea base. Ver [reproducción y límites](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/scroll-handoff.md).
