# Dimensiones reales {#real-dimensions}

`animateSize()` cambia los `width` y `height` reales de una vista, incluidas las transiciones hacia y desde `auto`. El texto se redistribuye, los íconos conservan sus proporciones y los hermanos se mueven a través del diseño normal de NativeScript. Úselo para ampliar tarjetas y acordeones.

Disponible desde **0.1.0-beta.15** en el paquete principal. No se necesita ningún complemento opcional de propiedad nativa.

<Clip name="size-ios" caption="Ancho/alto real, cambios de contenido intrínsecos, pausa, inversión y una fila siguiente táctil en el simulador iPhone 17, iOS 26.0. Los controles seleccionan explícitamente 0,25× de velocidad para el segmento de interrupción; La sincronización del vídeo no cambia." />
<Clip name="size-android" caption="La demostración nativa del emulador Android 16: reflujo de ancho y alto, tamaño automático basado en contenido, pausa/reanudación, interrupción y GridLayout. La cámara lenta se selecciona en la aplicación; estos son toques reales de ADB." />

```ts
import { animateSize } from '@rafaelaugusto/jolt'

await animateSize(card, { height: 'auto' }, 'snappy')
await animateSize(card, { height: 80 }, { duration: 300 })
await animateSize(card, { width: 240, height: 'auto' }, 'smooth')

// Capture the current bounds BEFORE changing content.
await animateSize(
  card,
  { height: 'auto' },
  () => {
    description.text = longerDescription
  },
  { duration: 350 },
)
```

Esto es independiente de [`animateLayout()`](./layout). FLIP mide un diseño final una vez y luego anima las transformaciones; su modo de tamaño escala el contenido. `animateSize()` realiza mediciones y diseños reales durante la reproducción. Ninguna API es una transición de navegación de elementos compartidos. Los fotogramas clave `animate()` continúan excluyendo el ancho/alto.

## Destinos y contenedores {#destinations-and-containers}

Pase una o ambas dimensiones. Los destinos son números DIP finitos y no negativos o `'auto'`; Las matrices, cadenas de porcentaje, objetos unitarios y propiedades desconocidas se rechazan antes de reemplazar una animación de tamaño existente. Las declaraciones numéricas, DIP/px y `auto` existentes de NativeScript pueden ser puntos de partida; se rechaza una declaración de porcentaje en un eje animado. Los porcentajes de ancestros pueden resolverse normalmente en el árbol de diseño.

`auto` sigue el **alineación existente y restricciones principales** de la vista. Es tamaño intrínseco cuando los padres lo permiten; un eje transversal estirado puede llenar la ranura disponible. Configure `horizontalAlignment="left"` o `verticalAlignment="top"` cuando desee un tamaño intrínseco en un eje restringido. Jolt no cambia la alineación, el relleno, los márgenes ni el recorte. Coloque `clipToBounds="true"` en un acordeón si los elementos hijos desbordados deben ocultarse mientras se cierra.

| Contenedor o asignación                                                                         | Contrato                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hijo directo de StackLayout vertical/horizontal                                                 | Compatible; Los siguientes hermanos participan en cada diseño.                                                                                                                                              |
| Hijo directo de GridLayout                                                                      | Compatible; Las filas/columnas `auto` crecen con el contenido. Las pistas fijas o `*` mantienen su propia asignación, por lo que cambiar el tamaño de una vista interna no anima la definición de la pista. |
| Pila/Cuadrícula anidada dentro de ScrollView                                                    | Compatible; Los límites de contenido real actualizan el desplazamiento. No anime el desplazamiento de contenido del ScrollView con esta API.                                                                |
| Tanto el ancho como el alto                                                                     | Medidos juntos en el ancho de destino; el texto se ajusta en cada ancho intermedio. Pase `height: 'auto'` también para animar el sobre de altura cambiante.                                                 |
| FlexboxLayout, WrapLayout, AbsoluteLayout, padre directo personalizado                          | Rechazado. La política de diseño necesita una validación separada.                                                                                                                                          |
| Celdas ListView/CollectionView recicladas, descendientes virtualizadas o medidas personalizadas | No compatible; sin contrato de medición o propiedad de celdas recicladas.                                                                                                                                   |

La asignación de padres sigue siendo autoritaria. Los valores y el exceso del resorte están sujetos a restricciones cero y mín./máx.; max gana si min excede max. Un destino numérico fuera de mín/máx se establece en el número fijado. Un destino `auto` restaura **auto semántico**, lo que permite que los cambios de contenido posteriores cambien de tamaño normalmente.

## Contenido, interrupción y controles {#content-interruption-and-controls}

La devolución de llamada de cambio opcional se ejecuta sincrónicamente después de que se capturan los límites antiguos. Las actualizaciones de la vista en cola de Vue se pueden ejecutar antes de la primera medición. Obtener datos antes de la llamada; Se rechazan las devoluciones de llamada asíncronas. Los cambios de texto, imagen, fuente y restricciones principales durante la reproducción se vuelven a medir en fotogramas de animación posteriores. Un punto final modificado comienza desde los límites reales actuales, llevando la velocidad de la curva actual y eliminando el retraso original. Por lo tanto, el contenido en constante cambio puede ampliar la finalización. Una vez finalizado, Jolt deja de observar; llame nuevamente para animar un cambio posterior.

Una operación posee los ejes solicitados de una vista. Un segundo `animateSize()` en esa vista reemplaza toda la operación anterior, la resuelve `false` y comienza en los límites actuales; cualquier eje de propiedad anterior omitido por la nueva solicitud vuelve a su declaración original. Otras pistas de transformación/opacidad siguen siendo independientes.

```ts
const animation = animateSize(card, { height: 'auto' })
animation.pause() // hold actual bounds, no pending frame callback
animation.play() // remeasure on resume
animation.stop() // keep current size as local numeric declarations
// Alternatively: animation.stop({ restore: true })
// releases the temporary overrides, revealing the original local/CSS declarations.
const completed = await animation.finished
```

La finalización resuelve `true`; resolución de reemplazo, parada, descarga y suspensión en segundo plano `false`. Una vista descargada/contraída, o un árbol sin su asignación de diseño inicial, aplica el destino sin retener la reproducción y resuelve `false`. Descargue/restaure en segundo plano las declaraciones originales para que las vistas recicladas o recargadas no queden varadas en tamaños intermedios. Errores de medición inesperados rechazan `finished` después de la limpieza.

Las escrituras locales o CSS explícitas en una dimensión propia cancelan la operación y toman posesión, incluidas las escrituras ocultas debajo de su anulación temporal. Las dimensiones sin dueño se dejan en paz. Jolt se niega a reemplazar una animación de fotograma clave CSS existente de una dimensión propia. Una mutación de contenido nunca se deshace mediante una cancelación.

Utilice `motionScope().animateSize()` o `useMotionScope().animateSize()` de Vue. Se detiene la suspensión del alcance; el reanudación continúa; El reinicio/eliminación se detiene y mantiene el tamaño numérico actual. El movimiento reducido se establece en el destino, incluido un cambio de preferencia mientras está en pausa. Se aplica `timeScale` global; La reproducción Android utiliza el reloj del animador del sistema. Se admiten interpolaciones/resortes, relajación y retraso. La búsqueda y los tiempos de fotogramas clave arbitrarios y repetidos no se admiten deliberadamente porque los puntos finales intrínsecos pueden cambiar; Este es un `SizeAnimation`, no un `PlaybackAnimation`.

## Ejecución y costo {#execution-and-cost}

**Esta API ejecuta el diseño JavaScript y NativeScript en el subproceso de la interfaz de usuario en cada cuadro de animación.** Una devolución de llamada de CADisplayLink/Choreographer propiedad de la biblioteca muestra la curva, prueba el destino en el árbol existente, restaura las dimensiones actuales y diseña el árbol antes de dibujar. No crea vistas duplicadas/accesibilidad y nunca dibuja el punto final especulativo. Ambos ejes comparten un paso de medición; no hay temporizador de aplicación. Las animaciones de transformación predeterminadas conservan su ruta de reproducción nativa existente.

La implementación inicial sondea el destino en cada cuadro para detectar cambios intrínsecos. Espere dos llamadas de medición de raíz y un diseño explícito por operación/cuadro activo, además de pases de marco. Múltiples vistas animadas y árboles profundos añaden costos; esto no es independencia de subproceso de renderizado. El JS del hilo principal detiene esta animación. Prefiera `animateLayout()` basado en transformación cuando el reflujo no sea necesario.

Abra **Dimensiones reales** en el patio de juegos, o inicie `--size-lab` en iOS / `--es size-lab true` en Android. El [informe de validación nativo](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/size-layout.md) registra la cobertura del contenedor, las versiones en tiempo de ejecución, las pruebas de límites/aciertos reales y los costos de diseño medidos. Los resultados del simulador/emulador no son una garantía de rendimiento del dispositivo.
