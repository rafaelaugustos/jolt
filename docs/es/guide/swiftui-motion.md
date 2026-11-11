# SwiftUI: valores, interacción y composición

Disponible en **0.1.0-rc.13 (Beta)** para iOS 17+ y macOS 14+, sin NativeScript ni JavaScript. Instale el producto `JoltSwiftUI` desde la etiqueta `v0.1.0-rc.13` del repositorio de paquete [`jolt-swift`](https://github.com/rafaelaugustos/jolt-swift). Consulte [instalación](./swiftui), [ciclo de vida](./swiftui-motion) e [interacción/geometría](./swiftui-geometry) para los límites.

JoltScope retiene sus recursos. .joltScope(scope) vincula un único límite de vista a la suspensión fuera de pantalla o con la escena inactiva. La pausa manual se conserva al reanudar. El modelo destruye mediante dispose(); reset() vacía un scope reutilizable. Cada recurso tiene un propietario. Bindings y seguidores usan valores prestados: destruir el seguidor no destruye su origen. Conserve propietarios en @StateObject, no en body.

```swift
@MainActor final class CardModel: ObservableObject {
    let scope = JoltScope()
    let x: JoltMotionValue
    init() { x = try! scope.value(0) }
    func move() { try! x.animate(to: 100, transition: .spring(.bouncy)) }
}
struct Card: View {
    @StateObject private var model = CardModel()
    var body: some View {
        Button("Move", action: model.move)
            .joltBind(.x, to: model.x)
            .buttonStyle(JoltPressStyle())
            .joltScope(model.scope)
    }
}
```

JoltMotionValue publica valor muestreado, destino, velocidad y estado en el main actor. animate reemplaza desde la posición/velocidad actuales; set salta y cancela. Una entrada inválida conserva el movimiento anterior. pause/play y suspend/resume son independientes; cancel congela y dispose impide reutilizar. joltBind acepta x/y en puntos, scale/scaleX/scaleY, rotate/rotateX/rotateY en grados y opacity 0–1. Un propietario por propiedad, sin otra animación implícita. La preferencia del sistema de movimiento reducido aplica el destino inmediatamente; pase reducedMotion para la política del app. No hay RenderThread independiente ni promesa de inmunidad a bloqueos de JavaScript.

JoltPresence conserva identidad durante la salida, desactiva interacción/accesibilidad y cancela la eliminación pendiente al regresar. active en joltPreset solo elige un extremo. JoltPressStyle mantiene semántica nativa de Button, teclado, desactivación y accesibilidad. joltPointerFollow normaliza coordenadas locales −1…1; úselo en una región sin transformar y anime su hijo. Salida, inactividad y movimiento reducido centran el valor; dispositivos táctiles sin hover permanecen centrados. JoltDragModel limita arrastre y destinos de snap; la primavera de asentamiento puede sobrepasarlos temporalmente. Un nuevo arrastre parte de la posición muestreada. Acciones accesibles ajustan los snaps; pausa, suspensión y destrucción cancelan gestos.

Solo en el código fuente, no en 0.1.0-rc.13: joltPointerFollow también informa la muestra central inactiva para una vista desactivada y para posiciones fuera de sus límites locales, como NativeScript y Web; antes las limitaba al borde y las mantenía activas. El modificador no tiene un flag `available` y no distingue un accesorio desconectado del final de un hover.

JoltTimeline comparte una suscripción de reloj para tracks finitas: máximo 60 s, 10.000 tracks y 1.024 eventos únicos. No admite solapamientos del mismo valor. sequence usa duraciones calculadas; stagger desplaza inicios. Reemplazar una propiedad cancela el conjunto. Los eventos pueden devolver JoltEffect para adaptar audio, haptic o partículas del app, con pausa, reanudación y limpieza al terminar/cancelar. No adquiere hardware implícitamente. Los eventos con más de 50 ms de retraso se omiten por defecto; catchUp es explícito. Movimiento reducido aplica destinos sin efectos; cancelar suprime eventos futuros, incluso con callbacks reentrantes.

joltSharedLayout usa IDs estables en un Namespace; joltLayout(value:) anima la actualización estructural. No conecta ventanas ni árboles independientes. JoltScrollView observa el desplazamiento nativo real; JoltScrollProgress acepta un rango en puntos. joltScrollLinked mapea poses sin interpolación adicional. Compone en el orden compartido (scale, rotateX, rotateY, rotate y al final la traslación), como joltMotion y la Web; hasta 0.1.0-rc.13 trasladaba antes de escalar, así que una pose con ambas cosas se movía traslación × escala. Movimiento reducido mantiene transformaciones decorativas en from y la opacidad sigue el progreso. Al desmontar elimina observaciones nativas.

JoltInspector(development:true, capacity:40) es opcional y solo observa en DEBUG. Retenga las observaciones watch; liberarlas desconecta el diagnóstico. JoltInspectorPanel muestra muestras, destinos, estado, recursos y clientes del reloj, con pause/play/cancel. Historial acotado a 1–4096, sin temporizador de sondeo ni medición GPU. En Release no conecta observadores.

createPreset(name, parameters) se comparte entre NativeScript y Web; JoltPreset.recipe usa definiciones generadas. Valida distance, scale, direction y duration. Una duration explícita convierte canales a tweens finitos; cero es inmediato. Los valores por defecto conservan los resortes originales. Copia definiciones sin modificar el registro global. Los 15 nombres portables, incluidos flipInX y flipInY, están en instalación.

```ts
import { createPreset } from '@rafaelaugusto/jolt/web'
const recipe = createPreset('fadeInUp', { distance: 48, duration: 350 })
// runtime.animate(element, recipe.keyframes, recipe.transition)
// NativeScript: import createPreset from '@rafaelaugusto/jolt'.
```

```swift
let recipe = JoltPreset.fadeInUp.recipe(
    try! JoltPresetParameters(distance: 48, duration: 350)
)
JoltPresence(visible, enter: recipe) { Text("Jolt") }
```

Web ya ofrece motionValue, springValue, map, pointerFollow, drag, scrollLinked, sequence, eventos de timeline, sharedLayout e inspector. Los scopes nuevos poseen esos recursos: React useMotion, Angular JoltMotionDirective, Svelte/Solid motion. Consulte [adaptadores](./web-frameworks). Sin otro motor de navegador; igualdad numérica no garantiza píxeles, hilos o rendimiento idénticos.

Validación: fixtures compartidas de resortes/recetas, propiedad/interrupción/eventos/inspector, interacción XCTest real en iOS/macOS y paquetes con SSR/hidratación en Chromium, Firefox y WebKit. CI ejecuta interacción nativa. Las mediciones de hardware y dispositivos físicos siguen separadas.

<Clip name="swiftui-interaction-ios" caption="Simulador iPhone 17 Pro / iOS 27.0: toques XCTest reales, presencia, press, arrastre y movimiento reducido. Sin hover táctil; interfaz en inglés." />

<Clip name="swiftui-interaction-macos" caption="App macOS en este Mac: mouse, hover, arrastre y presencia interrumpida. Solo la ventana; interfaz en inglés." />

<Clip name="swiftui-composition-ios" caption="Simulador iOS 27.0: valores, secuencias/stagger, eventos/cancelación, layout e inspector con XCTest real. Interfaz en inglés." />

<Clip name="swiftui-composition-macos" caption="App macOS: valores, limpieza de eventos, secuencias, layout e inspector; clics reales, sin benchmark de CPU/GPU." />

<Clip name="swiftui-scroll-linked-ios" caption="Simulador iOS 27.0: scroll real cambia progreso/cabecera; movimiento reducido estabiliza transformaciones. Interfaz en inglés." />

<Clip name="swiftui-scroll-linked-macos" caption="App macOS: rueda real y desplazamiento nativo; movimiento reducido mantiene la cabecera estable. Interfaz en inglés." />

<Clip name="web-expansion-react" caption="Chromium en macOS, React DOM: interacción y recursos reales. El mismo contrato se prueba en cuatro frameworks." />

## Profundidad y sombra {#depth-and-shadow}

Pendiente de merge y publicación en el [PR #488](https://github.com/rafaelaugustos/jolt/pull/488); no está en 0.1.0-rc.13. `JoltPose` acepta `rotateX` y `rotateY` en grados junto a `rotate`, con la misma validación (valores finitos). Toda vista de Jolt compone en el orden de la Web: escala, rotateX, rotateY, rotate y después traslación, alrededor del centro de su marco sin transformar. Animar un eje conserva el ángulo del otro, y un eje interrumpido continúa desde su valor muestreado. `joltBind` acepta `.rotateX` y `.rotateY`; `joltBind([.rotateX: rx, .rotateY: ry])` enlaza varios valores bajo una sola proyección, y `scale` multiplica `scaleX`/`scaleY`. Enlace ambos ejes en esa misma llamada: dos enlaces de profundidad separados proyectan dos veces y el interior queda ortográfico. Los grupos de propiedades, los estados y los keyframes controlan los valores enlazados. `JoltPreset.flipInX` y `flipInY` se generan desde las recetas compartidas, y `createPreset` en la Web y NativeScript los acepta con los mismos parámetros.

`.joltPerspective(600)` declara una distancia en puntos, de 1 a 100.000; `JoltPerspective(distance:)` valida un valor calculado y lanza un error, y un literal fuera del rango se detiene en una precondition. La distancia llega a la vista de Jolt más cercana por debajo que puede girar en X o Y (`joltMotion`, `joltPreset`, `JoltPresence`, `joltScrollLinked`, `joltViewportEnter`, el `joltBind` de varios valores y un enlace simple o mapeado de rotateX/rotateY). Esa vista proyecta con ella y la oculta a su propio contenido, así que un hijo que se inclina es ortográfico salvo que declare la suya. Los demás enlaces, y un `JoltPressStyle` cuyas poses no tienen rotateX/rotateY, dejan pasar la distancia. El punto de fuga es el centro del marco sin transformar de cada vista, como en NativeScript. En la Web es el centro del contenedor con `perspective` CSS, por lo que ambos coinciden cuando la vista está centrada en su contenedor; la traslación mueve la superficie respecto a ese punto fijo, como en la Web. Sin perspectiva declarada, rotateX y rotateY son ortográficos, como en la Web sin `perspective`: rotateY de 60° muestra la vista con la mitad de su ancho. La distancia no se anima; un cambio se aplica en el siguiente fotograma. No se admite una superficie cuyo borde cercano alcanza el ojo: CSS la recorta, `JoltProjection.corners` lanza un error y Jolt no define lo que dibuja SwiftUI.

JoltCore calcula la proyección (`JoltProjection.matrix` y `JoltProjection.corners`) a partir del tamaño medido, y un efecto de geometría de SwiftUI la aplica, sin cambiar el layout. Los fixtures generados con las matrices de transformación y perspectiva de CSS cubren tres superficies, ocho poses, la proyección ortográfica y 300/800/2400 puntos, además de dos superficies que pasan el ojo. Las pruebas de Swift comparan con ellos JoltCore y la transformación que el efecto devuelve realmente, y la prueba de UI del laboratorio de profundidad lee los marcos proyectados en cada distancia.

El hit testing y el marco de accesibilidad siguen la forma proyectada. En la prueba de UI del laboratorio en el simulador de iOS, un toque dentro del marco de layout pero fuera de la tarjeta inclinada no hace nada, y un toque por encima del marco de layout, en el borde cercano de la tarjeta, la pulsa; el marco de accesibilidad es la caja delimitadora proyectada. `joltSharedLayout`, `joltLayout`, `joltDrag`, `joltDropSource` y `joltPointerFollow` miden marcos sin transformar o posiciones globales, así que no se admiten en una vista que gira en X o Y, por debajo de ella ni por debajo de una perspectiva declarada. La Web los rechaza en ese caso; los modificadores de SwiftUI no pueden lanzar errores y Jolt no detecta la situación. Póngalos en un contenedor sin transformar e incline un hijo. Los rigs y `JoltGestureModel` siguen siendo bidimensionales, como los canales de rig compartidos.

`JoltShadow(opacity:radius:x:y:)` es una única sombra exterior: opacidad de 0 a 1, radio ≥ 0 y desplazamientos en puntos, todos finitos y dentro de ±10¹². El radio es el número que la Web y NativeScript en iOS llaman `shadowRadius`; la Web lo dibuja como un blur CSS de 2 × radio. El color es fijo: `joltMotion(to:shadowColor:)`, `joltScrollLinked`, `joltViewportEnter` y `JoltPressStyle` usan negro por defecto, y el alfa del color multiplica la opacidad. `JoltPose.shadow` se anima con la transición de transformación de la pose, así que `y` y la sombra comparten un resorte; una pose sin sombra interpola desde una sombra transparente, sin blur ni desplazamiento. `joltShadow(rest, color:opacity:radius:x:y:)` enlaza cualquiera de los cuatro canales a un `JoltMotionValue`. Un canal enlazado reemplaza el valor de reposo, y quitar el enlace vuelve a mostrar el valor de reposo declarado. Las muestras enlazadas y el sobreimpulso del resorte se limitan como los canales de decoración compartidos: opacidad a 0–1 y radio a ≥ 0. La sombra se dibuja dentro de la transformación de la vista, como un box-shadow de CSS, y SwiftUI la dibuja para cada forma visible del contenido, así que dé a la vista una forma de fondo opaca. Los presets y las recetas de `JoltPresence` no llevan sombra. Elija el color para cada apariencia en la app; el laboratorio comprueba claro y oscuro.

Reducir movimiento lleva rotateX, rotateY y los cuatro canales de sombra a su destino de inmediato, como las demás transformaciones, mientras la opacidad conserva su transición. Coincide con el adaptador nativo, donde las decoraciones saltan al final y solo la opacidad y los colores se animan. Los enlaces muestran sus destinos con `joltReduceMotion`; una escena inactiva lleva `joltMotion` al destino y un scope suspende sus valores. Los píxeles no son idénticos: SwiftUI, Core Animation y los navegadores rasterizan sombras y bordes proyectados de forma distinta.

```swift
let rest = try! JoltShadow(opacity: 0.2, radius: 3, y: 2)
let raised = try! JoltShadow(opacity: 0.42, radius: 18, y: 16)
VStack {
    TiltCard()
        .joltBind([.rotateX: model.rotateX, .rotateY: model.rotateY])
    LiftCard()
        .joltMotion(
            to: lifted ? try! JoltPose(y: -18, shadow: raised) : try! JoltPose(shadow: rest),
            transition: .spring(.bouncy))
}
.joltPerspective(600)
```

Consulte los [canales de profundidad en la Web](./interaction-depth) para el contrato del navegador.

<Clip name="swiftui-depth-ios" caption="Simulador iPhone 17 Pro / iOS 27.0, SwiftUI nativo: una tarjeta se inclina en X e Y a 300 pt, 900 pt y sin perspectiva, un eje se nivela a mitad del movimiento mientras el otro se mantiene, los toques prueban el área de toque proyectada, una segunda tarjeta se eleva con y y sombra en un mismo resorte, se quita el enlace de la sombra y después se activan reducir movimiento y la apariencia clara. Toques reales de XCTest; no es una grabación en un dispositivo físico." />

<Clip name="swiftui-depth-macos" caption="App de macOS, SwiftUI nativo: la misma inclinación, perspectiva, clics de hit testing, elevación, reducir movimiento y apariencia clara con clics reales del ratón. Solo se graba la ventana de la app." />

[Movimiento derivado y gráficos retenidos](./swiftui-advanced)
