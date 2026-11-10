# Inspección portátil y replay de sensores

Adiciones candidatas a las entradas opcionales Web inspector/testing: gráficos acotados de valores esperados/observados y replay canónico de sensores. Los equivalentes nativos ya existen. Las APIs Web nuevas no están publicadas en RC.12.1.

```ts
import { createMotionInspector } from '@rafaelaugusto/jolt/web/inspector'
const inspector = createMotionInspector(document, runtime, {
  development: true,
  capacity: 128,
})
const unwatch = inspector.watch(card, 'card')
inspector.sample('card', 'x', 80, 'replace')
const svg = inspector.plot('card', 'x')
// Application teardown:
unwatch()
inspector.dispose()
```

El muestreo es explícito: x/y son traslaciones CSS en píxeles y opacidad no tiene unidad. El llamador aporta el valor esperado y el evento semántico opcional. Las observaciones proceden del estilo computado, no de la GPU ni de sensores físicos. Elementos desconectados y transformaciones proyectivas o incompatibles producen huecos null. La capacidad limita el historial compartido (256 por defecto); un gráfico admite hasta 4096 muestras ordenadas. Eventos: start, replace, pause, play, stop, complete y seek.

Observe elementos montados con IDs únicos sin datos personales. Libere la observación antes de reutilizar un ID; una nueva observación inicia otro historial. Destruir el inspector limpia observaciones y diagnósticos propios, conservando elementos y animaciones de la aplicación. Los diagnósticos prestados siguen siendo responsabilidad del llamador. No hay polling automático, captura de contenido personal ni promesa de rendimiento.

```ts
import { replaySensor } from '@rafaelaugusto/jolt/web/testing'
const source = runtime.sensor('gravity', { reducedMotion: 'continue' })
const unsubscribe = source.x.subscribe((value) => console.log(value))
const replay = replaySensor(
  source,
  [
    { time: 0, values: [0, -9.81, 0], orientation: 0 },
    { time: 100, values: [1, -9.76, 0], orientation: 0 },
  ],
  { manual: true },
)
replay.advanceTo(0)
replay.advanceTo(100)
await replay.finished
unsubscribe()
source.dispose()
```

Las muestras son sintéticas: 2–10000 entradas copiadas con tiempos relativos estrictamente crecientes de 0 a 60000 ms. Los vectores usan xyz del dispositivo y unidades m/s², rad/s o µT; rotación usa quaternion normalizado xyzw. La orientación opcional es 0/90/180/270 grados. Se reutilizan el mapeo de interfaz y recentrado existentes; no se inventan lecturas intermedias.

Replay desconecta solo su sensor de los eventos de dispositivo. Se pausa sin consumidores, por pausa de fuente, segundo plano/visibilidad o Reducir movimiento. El modo manual usa advanceTo dentro de la duración. El handle ofrece pause/play/stop/dispose y finished: true al completar, false al cancelar. Entradas inválidas conservan el replay anterior. Destruir la fuente lo cancela. Finalizar o parar reanuda adquisición normal según permiso y demanda.

snapshot().sampleSource distingue replay, device-event y none incluso para valores retenidos. Replay nunca concede permisos; available permanece false con entrada sintética. API presente, emulador y replay no demuestran datos físicos; #385 sigue abierta. El test debe poseer y destruir sus suscripciones, valores derivados, bindings y fuente mediante scope o limpieza explícita.

<Clip name="web-tools" caption="Chromium en macOS: muestras sintéticas mueven un elemento DOM real; pausa/reanudación, observaciones CSS y marcadores de sustitución. Sin medición física ni de GPU." />

<Clip name="interaction-inspector-ios" caption="Inspector nativo existente en simulador iOS: interacción real con controles y observaciones. Las fuentes de observación nativa y Web son distintas." />

<Clip name="composition-sensors-ios" caption="Demo nativo existente de sensores en simulador iOS. Evidencia de ciclo de vida y mapeo, no de lecturas físicas ni de un nuevo benchmark." />
