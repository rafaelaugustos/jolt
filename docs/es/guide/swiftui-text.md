# SwiftUI: entrada de texto y números rodantes

Pendiente de merge y publicación en el [PR #488](https://github.com/rafaelaugustos/jolt/pull/488); no está en 0.1.0-rc.13. Para iOS 17+ y macOS 14+, sin NativeScript ni JavaScript. Consulte [instalación](./swiftui), [ciclo de vida](./swiftui-motion) e [interacción/geometría](./swiftui-geometry) para los límites. Siguen a [`animateText` y `rollTo`](./web-effects#text) de la Web y comparten la división, el escalonado y la alineación a través del núcleo portable.

<Clip name="swiftui-text-ios" caption="Simulador de iOS, SwiftUI nativo: una frase que entra por palabra y por letra con repetición, una línea en hebreo de derecha a izquierda, valores de moneda y porcentaje que ruedan hacia arriba y hacia abajo con interrupción, Reducir movimiento y Dynamic Type más grande. No es una grabación en un dispositivo físico." />

<Clip name="swiftui-text-macos" caption="SwiftUI nativo en macOS, guiado por clics reales de ratón de XCTest: entradas por palabra y por letra con repetición, moneda y porcentaje que ruedan con interrupción, y Reducir movimiento. macOS no tiene Dynamic Type." />

## Entrada de texto

`JoltTextEntrance` es dueño de una cadena y de su reproducción. `JoltAnimatedText` la dibuja como un único `Text` de SwiftUI, con el estilo de los modificadores `font`, `foregroundStyle`, `multilineTextAlignment` y `lineLimit` que la rodean. Cada pieza visible pasa de opacidad 0 a 1 y sube `y` puntos hasta su lugar, en una interpolación ease-out. Los valores por defecto son los de la Web: letras, 400 ms por pieza, 35 ms de escalonado, sin retardo, 12 puntos.

```swift
@StateObject private var title = try! JoltTextEntrance(
    "Motion should feel like it belongs to the words it carries.",
    options: .init(by: .word, duration: 400, stagger: 70, y: 12))

JoltAnimatedText(title).font(.title2.bold())
Button("Repetir") { title.replay() }
// try title.replay("Un titular nuevo")   // valida y repite
```

`by: .letter` divide en clústeres de grafemas extendidos, así que una letra acentuada, una bandera o una familia de emojis unida es una sola pieza. `by: .word` usa los segmentos de palabra Unicode que el tokenizador del sistema informa para la configuración regional actual; los espacios y la puntuación son piezas propias. Los espacios no dibujan nada, pero conservan su lugar en el orden: la pieza en la posición _k_ empieza en `delay + k × stagger` milisegundos, espacios incluidos, exactamente como en la Web. La entrada dura hasta que llega la última pieza visible. Una duración cero muestra el texto entero de una vez, sea cual sea el retardo.

Duración, escalonado y retardo son milisegundos finitos, de 0 a 60.000. `y` va en puntos, finito, dentro de ±10.000; los valores negativos entran desde arriba. El texto tiene como máximo 256 grafemas, y la última pieza debe llegar en 60.000 ms como mucho. Una entrada no válida lanza `JoltError.invalidMotion` antes de cambiar nada: `replay(_:)` con una cadena no válida deja la entrada actual en reproducción.

La entrada es un `JoltResource` movido por `JoltClock`. Se reproduce desde su creación, salvo con `autoplay: false`, que la deja oculta en su primer fotograma hasta `play()` o `replay()`. `pause()` la congela; `cancel()` muestra el texto entero y la deja repetible; `dispose()` muestra el texto entero de forma definitiva. `state`, `elapsed` y `progress` informan de la reproducción. Un `JoltScope` puede retenerla. `JoltAnimatedText` la suspende mientras la vista está fuera de pantalla, mientras la escena de iOS está inactiva o mientras la ventana de macOS está oculta, minimizada o tapada; una pausa manual sobrevive a la reanudación. No corre ningún reloj antes de reproducir, en pausa ni después de terminar.

**Accesibilidad.** La vista es un único elemento de accesibilidad cuya etiqueta es la cadena entera, desde el primer fotograma, dibujen lo que dibujen las piezas. Las piezas no añaden elementos.

**Reducir movimiento.** El ajuste del sistema, `joltReduceMotion(true)` en un ancestro y `reducedMotion: true` muestran el texto final de inmediato y completan la entrada. Activarlo durante una entrada la completa.

**Maquetación, Dynamic Type y derecha a izquierda.** En iOS 18 y macOS 15 o posteriores, cada pieza es un tramo de un único `Text` ya maquetado, dibujado por un `TextRenderer`. Los saltos de línea, Dynamic Type, el orden bidireccional y la unión del árabe son del propio SwiftUI; la vista tiene el mismo tamaño que un `Text` normal. Un cambio de Dynamic Type durante la entrada vuelve a maquetar el texto y la reproducción sigue en su tiempo actual. En texto de derecha a izquierda, las piezas entran en orden de lectura, así que la primera palabra en hebreo o árabe, a la derecha, entra primero. Mientras las letras se mueven, una ligadura que abarca dos piezas se dibuja como letras separadas; en reposo la vista es un `Text` normal. Los glifos en movimiento dibujan hasta `y` puntos fuera del marco. En iOS 17 y macOS 14, donde no existe `TextRenderer`, la vista muestra el texto final y la entrada termina en cuanto empieza. macOS no tiene Dynamic Type.

**Diferencias entre plataformas.** Las letras coinciden con la Web grafema a grafema. Los límites de palabra vienen del motor de texto de cada plataforma: `Intl.Segmenter` en la Web, el tokenizador del sistema en Apple. Coinciden allí donde deciden las reglas de palabra de Unicode, lo que los fixtures compartidos comprueban para inglés, puntuación, emojis, marcas combinantes, coreano, árabe, hebreo y números. Las palabras en chino y japonés salen de diccionarios distintos: `你好世界` es `你好 | 世界` en la Web y `你 | 好 | 世界` en Apple. El `animateText` de NativeScript difiere de ambos: allí los espacios no añaden pasos de letra y la puntuación se une a su palabra.

## Números rodantes

`JoltRollingNumber` guarda un valor y el texto que un formateador de la aplicación hace de él. `roll(to:)` fija `value`, `text` y el valor de accesibilidad de una vez; solo se mueve el dibujo. `JoltRollingText` lo dibuja: en cada posición que cambia, el glifo en pantalla sale deslizándose mientras el nuevo entra, sobre un muelle. Los glifos que no cambian no se mueven.

```swift
@StateObject private var balance = try! JoltRollingNumber(
    1249.9,
    format: { $0.formatted(.currency(code: "EUR")) },
    options: .init(duration: 600, bounce: 0.2, stagger: 0))

HStack {
    Text("Saldo")
    Spacer()
    JoltRollingText(balance)  // tabular: true, alignment: .trailing
        .font(.largeTitle.bold())
        .accessibilityLabel("Saldo")
}
Button("Ingresar") { try? balance.roll(to: 12980.6) }
```

`format` es un `@MainActor (Double) -> String` y debe devolver como máximo 256 grafemas; el valor por defecto, `JoltRollingNumber.plain`, escribe los números enteros sin fracción y los demás valores como el decimal más corto de Swift. Los valores deben ser finitos. `duration` (mayor que 0, como máximo 60.000 ms) y `bounce` (−1 a 1) describen el muelle como SwiftUI y la Web: `JoltTransition.spring(milliseconds:bounce:)` devuelve la misma rigidez y la misma amortiguación que la Web, con el rebote limitado a ±0,99. `stagger` y `delay` son milisegundos de 0 a 60.000. Una entrada no válida lanza un error antes de que cambien el texto o una animación en curso.

Las dos cadenas se dividen en grafemas y se alinean por el último, así que el dígito de las unidades se queda en su sitio cuando el número crece: `99` pasa a `100` rodando dos nueves a ceros y haciendo entrar un `1` a la izquierda. Los grafemas se comparan por sus escalares Unicode exactos, como en la Web, así que `é` y `e` seguida de un acento combinante ruedan. El escalonado cuenta las posiciones cambiadas desde la derecha y después los grafemas antiguos que salen sin sustituto. `direction: .auto` rueda hacia arriba hacia un valor mayor y hacia abajo hacia uno menor; rodar hacia arriba significa que el glifo antiguo sale por arriba mientras el nuevo entra por abajo. `roll(to:direction:)` puede cambiar la dirección una vez. `set(_:)` salta sin rodar.

**Interrupción.** Un nuevo destino durante una animación se aplica de inmediato en `text` y en el valor de accesibilidad. Los glifos iguales en ambos destinos siguen moviéndose como iban. Todos los demás salen desde el desplazamiento y la opacidad con que están dibujados, así que nada salta. Se conservan como máximo ocho generaciones de glifos salientes; las más antiguas desaparecen. En la Web, un nuevo destino aplana lo dibujado y hace entrar todo el texto nuevo.

**Dibujo y maquetación.** Los glifos en movimiento se recortan a su línea, como un cuentakilómetros. La vista toma el tamaño del texto nuevo, maquetado como un `Text` nativo con Dynamic Type. Los glifos salientes se maquetan en una línea, con su ancho natural, y se colocan en `alignment` dentro de la vista: el valor por defecto `.trailing` mantiene las columnas alineadas por el final, lo que conviene a números en una fila alineada al final. Use la alineación que el contenedor mantiene fija cuando cambia el ancho; un ancho fijo o `tabular: true` (dígitos monoespaciados, el valor por defecto) dan las columnas más estables. En una maquetación de derecha a izquierda, `.trailing` es el borde izquierdo; fije la alineación explícitamente cuando un número esté en texto de derecha a izquierda. En iOS 17 y macOS 14 el texto final aparece de inmediato.

**Accesibilidad y Reducir movimiento.** La vista es un único elemento cuyo valor de accesibilidad es el destino formateado desde el primer fotograma del cambio; dele una etiqueta con `.accessibilityLabel`. Reducir movimiento, `joltReduceMotion(true)` y `reducedMotion: true` muestran el texto final de inmediato. La animación es un `JoltResource` con las mismas reglas de pausa, suspensión, ámbito y liberación que la entrada.

## Fixtures compartidos

`npm run swiftui:check` vuelve a generar `Fixtures/text.json` a partir del núcleo portable y falla cuando está desactualizado. Contiene las piezas por letra y por palabra de cadenas con ASCII, puntuación, secuencias de emoji con ZWJ, marcas combinantes, CJK, árabe, hebreo y números mezclados; los inicios y el progreso suavizado de las entradas para tres combinaciones de duración/escalonado/retardo; diffs de animación con su escalonado; y muelles a partir de duración y rebote. `JoltCoreTests` los reproduce todos y compara los límites de palabra en chino y japonés solo fuera de los tramos de diccionario.
