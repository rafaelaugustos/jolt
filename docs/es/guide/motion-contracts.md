# Continuidad del movimiento y relaciones entre gestos

**Disponible en 0.1.0-rc.16 (Beta).** Este lote cubre [#497](https://github.com/rafaelaugustos/jolt/issues/497), [#502](https://github.com/rafaelaugustos/jolt/issues/502), [#503](https://github.com/rafaelaugustos/jolt/issues/503), [#504](https://github.com/rafaelaugustos/jolt/issues/504), [#505](https://github.com/rafaelaugustos/jolt/issues/505) y [#508](https://github.com/rafaelaugustos/jolt/issues/508). Instale core/plugin nativo en la misma versión y recompile la aplicación nativa tras actualizar. SwiftUI sigue en Beta para iOS 17+ y macOS 14+.

## Relaciones entre controladores {#gesture-relationships}

Crea `gestureRelations()` después de montar controladores inactivos y antes del contacto. Con `waitFor`, `gesture` espera el fallo de `other`; `simultaneous` permite ambos; `block` permite que el objetivo empiece mientras el bloqueador aún es posible y lo cancela cuando este reconoce. Un contacto bloqueado no reinicia. Así, el carrusel puede cancelar el feedback de press al empezar a moverse.

`gestures`, `drag`, `zoomable`, `bottomSheet`, `reorder` y la función devuelta por `press` exponen endpoints. El tipo predeterminado es `pan`, excepto `reorder` (`longPress`) y `press` (`tap`). `kind`/`otherKind` seleccionan un `pan`, `pinch`, `rotate`, `tap` o `longPress` habilitado. El sheet coordina su pan interno; zoomable, pan/pinch/tap. Con `dismiss:false`, una foto en escala mínima hace fallar su pan para que se mueva el sheet que espera.

```ts
import { gestureRelations } from '@rafaelaugusto/jolt/web'
// NativeScript: import from '@rafaelaugusto/jolt'.
const links = gestureRelations([
  { gesture: sheet, other: photo, relation: 'waitFor', otherKind: 'pan' },
  { gesture: photo, kind: 'pinch', other: sheet, relation: 'block' },
])
// Before destroying or remounting the participating controllers:
links.dispose()
```

La configuración acepta 1–128 enlaces y rechaza ciclos entre grupos, autorrelaciones, runtimes incompatibles, canales deshabilitados, contactos activos y contradicciones entre simultaneidad y orden antes de instalarlos. Descartar el grupo cancela la entrada participante y elimina sus enlaces. Descartar cualquiera de los controladores también elimina sus relaciones; recrea el grupo tras unload/remontaje nativo. Las relaciones toman prestados los controladores sin poseer sus valores ni vistas.

UIKit utiliza requisitos de fallo removibles en el delegate y una política de reconocimiento simultáneo, preservando el delegate anterior. Android decide en la distribución nativa de toques, sin decisiones JavaScript por frame. Web coordina Pointer Events de Jolt, fija `touch-action` antes del contacto y comparte pointer capture entre superficies anidadas. El descarte restaura la política anterior. Se admiten ancestros trasladados; escala, rotación y perspectiva en ancestros quedan fuera del contrato. Los tiempos de eventos y umbrales nativos pueden variar.

`nativeGestureRecognizer(native, kind)` es una entrada opcional de NativeScript para un reconocedor UIKit del app o `org.rafaelaugusto.jolt.GesturePeer` de Android. Descartar el handle elimina enlaces sin destruir el reconocedor del app. No envuelve detectores Android arbitrarios. En navegación interactiva, coordina el zoom/drag de origen; edge-back del sistema y predictive-back no son endpoints de `sharedNavigationEntry()`.

## Continuidad y dibujo retenido en SwiftUI {#swiftui-contracts}

`JoltTimelineTrack.velocity` acepta una sustitución finita en unidades del valor/segundo. La primera pista en tiempo cero con `from` implícito hereda la velocidad muestreada **al construir la timeline**. Las fuentes pausadas/suspendidas aportan cero; `from` explícito, pistas retrasadas y etapas posteriores parten de cero salvo sustitución. `sequence` usa la misma velocidad resuelta para calcular duraciones. `autoplay:false` conserva la muestra de construcción. Seek sigue siendo determinista; cancelar libera la propiedad y pausa/suspensión son independientes.

`connectEdgeScroll` da a los grips personalizados de reorder el reloj de borde existente. Conserva su `JoltObservation`; el callback recibe -1/+1 y devuelve si puede seguir desplazándose. Proporciona medidas reales de filas, coordenadas del puntero/viewport y offset actual mediante los métodos existentes. Cambiar/desconectar el viewport cancela el contacto; descartar una conexión antigua no desconecta la nueva. Suspensión, eliminación del elemento y descarte del modelo detienen el trabajo de borde. Las acciones de fila pueden quedar fuera del grip.

`JoltParticles.emit(duration:nil)` emite hasta cancelación/descarte o hasta que Reduced Motion finaliza el efecto. El valor predeterminado sigue siendo finito: 2000 ms. La tasa es partículas/segundo (0,1000], lifetime usa milisegundos y `ceil(rate × lifetime / 1000)` debe caber en capacidad (1–2000). El almacenamiento permanece acotado; frames tardíos omiten nacimientos caducados sin acumular trabajo. Las identidades de nacimiento siguen estables después de 60 segundos. Pausa/suspensión congelan el tiempo independientemente; `cancel()` vacía el campo y el descarte libera el reloj. Geometría en puntos locales, velocidad en puntos/segundo, gravedad en puntos/segundo² y giro en grados/segundo.

`JoltSVGPath` acepta M/L/H/V/C/S/Q/T/A/Z absolutos/relativos, coordenadas repetidas y exponentes. Normaliza a M/L/C/Q/Z, convierte arcos en cúbicas y conserva subpaths/cierre. Límites: 20.000 bytes UTF-8, 256 comandos normalizados y coordenadas en ±1.000.000. Fixtures compartidas TypeScript/Swift verifican la normalización. `JoltPath` sigue siendo la API separada de trayectoria medida.

```swift
let replacement = try JoltTimeline(tracks: [
  .init(x, to: 120),                     // inherit current velocity
  .init(y, to: 40, velocity: -80)        // explicit units/second
])
let edge = try model.connectEdgeScroll { direction in
  scrollOneRow(direction)              // return false at the viewport boundary
}
// Retain edge alongside the custom viewport; call edge.dispose() on teardown.
try particles.emit(rate: 12, duration: nil, seed: 1)
let path = try JoltSVGPath("M10 10H90V90H10Z M35 35H65V65H35Z")
let drawing = try JoltDrawing([
  .init(.svg(path), fill: .init(argb: 0xffdbff7a),
        stroke: .init(argb: 0xff7766ff), lineWidth: 3,
        strokeStart: 0.1, strokeEnd: 0.9,
        lineCap: .square, lineJoin: .bevel, fillRule: .evenodd)
])
// JoltDrawingView(drawing, viewBox: try JoltViewBox(0, 0, 100, 100), accessibilityLabel: "Window")
try drawing.morphPath(at: 0, to: anotherCompatiblePath)
```

`JoltDrawingView` dibuja geometría retenida en un Canvas. Fill rule: nonzero/evenodd; caps: butt/round/square; joins: miter/round/bevel. `strokeStart`/`strokeEnd` por forma y los valores opcionales de la vista usan 0…1 y se intersectan; un intervalo vacío oculta el trazo, preservando el relleno. El ancho usa unidades del dibujo, 0…1000. Un `viewBox` explícito, finito y positivo escala x/y independientemente al viewport; no mantiene la proporción automáticamente. Sin él, las coordenadas son puntos locales.

Hay un morph por dibujo. Las rutas requieren los mismos comandos/subpaths normalizados; una entrada incompatible falla antes de cancelar el trabajo actual. La sustitución muestrea la ruta visible al ejecutar el comando y conserva el estilo. `pause`/`play`, `suspend`/`resume`, cancelación, escena inactiva, Reduced Motion y descarte usan el ciclo del reloj existente. Cancelar conserva la geometría muestreada; descartar la borra. El inicializador anterior `strokeProgress` sigue siendo válido. No se promete hit testing, conversión de topología arbitraria ni píxeles idénticos entre nativo y navegador.

## Velocidad del resorte pausado {#paused-velocity}

En Web, `springValue.getVelocity()` y los grafos derivados ahora devuelven cero inmediatamente durante pausa o cuando el runtime está oculto, siguiendo el contrato nativo. Reanudar conserva el impulso; `stop()` lo borra. La posición permanece congelada durante la pausa. La corrección invalida los valores dependientes sin crear otro bucle. Las grabaciones nativas comprueban el comportamiento ya existente en iOS/Android.

## Evidencias por plataforma {#evidence}

Web ya ofrece velocidad de timeline, emisión continua, estilo/morph SVG y autoscroll de reorder por clave. El lote reutiliza esas APIs; consulta [orquestación Web](./web-orchestration), [efectos Web](./web-effects) y [gestos Web](./web-gestures). Las novedades Web son reconocimiento entre controladores y propagación de la derivada pausada. Los tests cubren espera anidada en ambas direcciones, press/carrusel, swipe/reorder y foto/sheet en iOS, Android y Chromium; política con ratón y pausa también se ejecutan en Firefox/WebKit. La inyección multitáctil confiable es exclusiva de Chromium. Los vídeos conservan la velocidad original y no comparan rendimiento del hardware.

<Clip name="gesture-relations-ios" caption="iPhone 17 Pro, simulador iOS 27: entrada real de XCTest muestra espera anidada en ambos sentidos, press/carrusel, swipe/reorder y foto/sheet. Interfaz en inglés." />

<Clip name="gesture-relations-android" caption="Pixel 7, emulador Android API 36: entrada real del sistema muestra los mismos casos. Indicadores táctiles activados; interfaz en inglés." />

<Clip name="gesture-relations-web" caption="Chromium en macOS: ratón y toque/pinch confiables; escenarios separados unidos a velocidad original. Interfaz en inglés." />

<Clip name="spring-velocity-ios" caption="Simulador iOS 27: posición congelada y velocidad directa/derivada cero; reanudar conserva el impulso. Interfaz en inglés." />

<Clip name="spring-velocity-android" caption="Emulador Android API 36: pausa/reanudación reales con velocidad y derivada cero durante la pausa. Interfaz en inglés." />

<Clip name="spring-velocity-web" caption="Chromium en macOS: pausa, reanudación y stop reales con velocidad derivada. Interfaz en inglés." />

<Clip name="swiftui-motion-contracts-ios" caption="iPhone 17 Pro, simulador iOS 27: sustitución con velocidad, morph/trim SVG, partículas más allá de 60 segundos y autoscroll con grip propio y acciones de fila. XCTest real; velocidad original; interfaz en inglés." />

<Clip name="swiftui-motion-contracts-macos" caption="App nativo macOS: clics y drag reales muestran los mismos contratos SwiftUI, incluidos más de 60 segundos de partículas continuas. Velocidad original; interfaz en inglés." />
