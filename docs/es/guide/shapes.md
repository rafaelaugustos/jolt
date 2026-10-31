# Formas: trazado y transformación {#shapes-draw-and-morph}

Dibuja una marca de verificación, revela un anillo o convierte un símbolo de reproducción en barras de pausa. La entrada opcional `@rafaelaugusto/jolt/shapes` pinta una superficie vectorial propia sobre una vista NativeScript. Su identificador `shape()` sigue el mismo patrón de creación/animación que los degradados. Disponible desde **0.1.0-rc.1**; reconstruya Android para incluir el renderizador nativo.

<Clip name="shapes-ios" caption="Simulador iOS: toques reales dibujan una marca de verificación, un anillo y un subrayado, interrumpen una transformación de reproducción/pausa, pausan/reanudan el dibujo y cambian de forma en Reducir movimiento. interfaz de usuario en inglés; sincronización de reproducción original." />
<Clip name="shapes-android" caption="Emulador Android: el mismo dibujo vectorial y transformación a través de toques reales ADB, incluyendo interrupción, pausa/reanudación y reducción de movimiento. interfaz de usuario en inglés; tiempo de reproducción original, no una medición del rendimiento del dispositivo físico." />

## Dibujar un camino {#draw-a-path}

Utilice una vista vacía dedicada. La forma puede crearse antes de que la vista se cargue, por ejemplo en un `onMounted` de Vue: se adjunta cuando la vista se carga, con los `strokeStart`/`strokeEnd` actuales, y una animación solicitada antes comienza al adjuntarse. La vista proporciona tamaño, accesibilidad y entrada; el renderizador no instala un controlador de gestos ni cambia la geometría de visita de la vista.

<Clip name="shapes-mount-ios" caption="Simulador iOS: el laboratorio crea sus cuatro formas en onMounted, antes del diseño, por lo que ya aparecen dibujadas cuando surge la pantalla tras el lanzamiento; dos toques reales en Draw again animan los trazos. Interfaz en inglés; tiempo original, lanzamiento incluido." />
<Clip name="shapes-mount-android" caption="Emulador Android: las mismas formas creadas al montar aparecen con la pantalla después de la splash de lanzamiento; dos toques reales ADB en Draw again vuelven a dibujar los trazos. Interfaz en inglés; tiempo original, no una medición de rendimiento en dispositivo físico." />

```ts
import { shape } from '@rafaelaugusto/jolt/shapes'
import { motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
const check = scope.add(
  shape(checkView, {
    d: 'M22 51 L43 71 L79 28',
    viewBox: [0, 0, 100, 100],
    stroke: '#C8E4CF',
    strokeWidth: 5,
    lineCap: 'round',
    strokeEnd: 0,
  }),
)

const drawing = check.animate({ strokeEnd: 1 }, { duration: 900, ease: 'easeInOut' })
drawing.pause()
drawing.progress = 0.5
drawing.play()
// At permanent teardown:
scope.dispose()
```

`viewBox` es `[minX, minY, width, height]`, con dimensiones positivas. El camino encaja proporcionalmente y está centrado dentro de la vista; El ancho del trazo utiliza unidades viewBox y escala con la geometría. El dibujo se recorta según los límites del anfitrión. Resize actualiza este mapeo sin reconstruir la animación de la ruta en ejecución.

Las opciones estáticas son `stroke` (predeterminado `#202630`), `fill` (transparente), `strokeWidth` (0–1000, predeterminado 2), `lineCap` (`butt`, `round`, `square`; predeterminado `round`), `lineJoin` (`miter`, `round`, `bevel`; predeterminado `round`) y `fillRule` (`nonzero` o `evenodd`; predeterminado `nonzero`). Disponer/recrear para cambiar de estilo o viewBox. La superficie deja el fondo original, se transforma y se manipula intacto y se dibuja sobre el contenido existente.

`strokeStart` y `strokeEnd` seleccionan fracciones en 0–1. Si el inicio es mayor o igual que el final, el trazo está vacío; El relleno siempre está completo. El dibujo de trazo parcial requiere un subtrazo continuo. Los trazados compuestos admiten relleno, trazo completo y transformación; utilice vistas de formas separadas cuando cada contorno necesite su propio progreso de dibujo.

## Geometría de coincidencia de formas {#morph-matching-geometry}

```ts
const icon = shape(iconView, {
  d: 'M20 25 L80 50 L20 75 Z',
  viewBox: [0, 0, 100, 100],
  fill: '#F4B992',
  strokeWidth: 0,
})
icon.animate({ d: 'M20 25 L80 25 L50 80 Z' }, 'snappy')
// Retargeting starts from the native presentation, even during an unfinished morph.
icon.animate({ d: 'M20 25 L80 50 L20 75 Z' }, 'snappy')
```

SVG `M/L/H/V/C/S/Q/T/A/Z`, se admiten formas relativas, repeticiones implícitas y múltiples subrutas. La configuración normaliza las coordenadas taquigráficas y relativas; Los arcos elípticos se convierten en segmentos Bézier cúbicos de como máximo 90 grados. La transformación requiere los mismos comandos normalizados, subrutas y recuento de puntos de control. No hay coincidencia automática de topología. Diferentes barridos de arco pueden normalizarse para diferentes números de cúbicas y, por lo tanto, ser incompatibles.

Se lanza un destino incompatible antes de interrumpir el trabajo existente. Utilice `set({ d: newPath, strokeStart: 0, strokeEnd: 1 })` para un cambio de topología inmediato. La entrada está limitada a 20.000 caracteres, 256 comandos normalizados y coordenadas dentro de ±1.000.000. Una animación de muestra tiene un presupuesto de 262.144 componentes; Las combinaciones de ruta/curva demasiado complejas se rechazan antes de reemplazar la animación actual.

## Reproducción y propiedad {#playback-and-ownership}

`animate({ d?, strokeStart?, strokeEnd? }, transition?)` acepta un destino y los nombres de interpolación/resorte existentes, controles de aceleración, retardo y repetición. Utilice `set()` seguido de `animate()` para el dibujo inicial/final explícito. Una forma posee una animación combinada de geometría/recorte; las propiedades omitidas en un retarget mantienen su presentación actual. Las capas aditivas con nombre y las matrices de fotogramas clave de formas no forman parte de esta API.

El identificador devuelto expone `finished`, `pause()`, `play()`, `stop()` y `progress` finito. Los resortes proyectan la velocidad del vector interrumpido hacia su nuevo destino. El recorte se mantiene entre 0 y 1, mientras que la geometría puede sobrepasarse. `shape.stop()` mantiene la presentación actual; `set()` lo detiene y lo reemplaza inmediatamente. `snapshot()` lee la ruta/recorte actual y los límites nativos/conteos de animación bajo demanda; no instala un observador.

La puesta en segundo plano detiene el trabajo activo. Si NativeScript descarga la vista mientras está en segundo plano, la superficie nativa se libera y el programa en pausa se reanuda cuando se carga en primer plano. Una descarga regular o un reemplazo de la vista nativa cancela la reproducción, libera la superficie anterior y restaura su geometría retenida durante la carga. El trabajo pausado explícitamente permanece en pausa. `dispose()` elimina la forma y sus oyentes de forma permanente y es idempotente. Una vista sólo puede poseer una forma a la vez.

Reducir movimiento aplica nuevos destinos inmediatamente. Al habilitarlo durante la reproducción, se detiene ese identificador (`finished` resuelve `false`) y aplica su destino solicitado sin más animación. Un osciloscopio puede poseer la forma para la limpieza o poseer controles de reproducción individuales para la suspensión; no comparta una forma entre propietarios independientes.

## Representación nativa {#native-rendering}

iOS utiliza fotogramas clave `CAShapeLayer` explícitos para la ruta y el recorte, con un marcador de presentación nativo para la interrupción. Apple requiere una estructura de punto de control/segmento de ruta compatible para la interpolación de ruta. [Documentación de ruta de CAShapeLayer](https://developer.apple.com/documentation/quartzcore/cashapelayer/path).

Android utiliza un dibujable compilado, `Path`/`PathMeasure` y `ValueAnimator`. Se reutilizan caminos y zonas de influencia; Transformar coordenadas y recortar actualización en código nativo. El dibujo parcial utiliza `PathMeasure.getSegment()`. [Documentación de Android PathMeasure](https://developer.android.com/reference/android/graphics/PathMeasure).

JavaScript analiza la geometría y prepara curvas en la configuración/comandos, luego maneja el ciclo de vida y los límites de finalización. No dibuja ni actualiza la ruta en cada cuadro. El dibujo Android y NativeScript JavaScript aún comparten el hilo de la interfaz de usuario. Estas API no implican un subproceso de renderizado independiente ni garantías de rendimiento del dispositivo físico.

La vista previa del **Hecho de movimiento / Linework** en cuatro idiomas es el ejemplo número 71. Ver [validación y reproducción](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/shapes.md).
