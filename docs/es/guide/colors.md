# Colores {#colors}

Los colores de fondo, borde y texto usan `animate()` en iOS y Android:

<Clip name="colors" caption="Colores de fondo y texto interpolados en OKLab." />

```ts
animate(
  card,
  {
    backgroundColor: '#263b27',
    borderColor: '#b6ee64',
    color: '#d5ff91',
  },
  { duration: 800 },
)
```

Utilice una cadena de color NativeScript o un objeto `Color`. Las matrices definen fotogramas clave; `null` significa el color visible cuando comienza la animación:

```ts
animate(
  card,
  {
    backgroundColor: [null, '#38273f', '#21394a'],
  },
  { duration: 1800, times: [0, 0.3, 1] },
)
```

Los colores tienen una interpolación predeterminada de 300 ms. Puede establecer transiciones, resortes, retrasos, repeticiones y escalones por propiedad como de costumbre. El progreso del resorte se limita al primer y último color; Los colores empaquetados no heredan una velocidad escalar. Los valores de color permanecen absolutos con `relative: true`.

## Interpolación {#interpolation}

Jolt calcula colores intermedios en OKLab con alfa premultiplicado, recorta el resultado en sRGB y entrega las muestras al animador nativo. Esto evita el punto medio RGB oscuro entre colores saturados y evita que un punto final transparente agregue su tono invisible a la transición. No se ejecuta JavaScript para cada cuadro.

Las transformaciones y los colores pueden ejecutarse juntos. Una nueva animación reemplaza el color en la pantalla. Detén un solo color mientras el resto sigue reproduciéndose:

```ts
stop(card, ['backgroundColor'])
```

Al detenerse, se confirma el color visible en el modelo NativeScript y se resuelve la animación con `false`. La finalización deja el color final en el modelo. Cambiar un color externamente o descargar la vista cancela la reproducción nativa de esa propiedad.

## Bordes y fondos {#borders-and-backgrounds}

`borderColor` requiere el mismo color inicial en los cuatro bordes. Se admiten diferentes anchos y radios de esquina. Se conservan los degradados, las imágenes, los trazados de clip y las sombras; sus propios parámetros no se interpolan. Un color de fondo debajo de un degradado opaco permanece cubierto por él. En iOS, Core rasteriza los fondos de las imágenes junto con su color: la reproducción del color de fondo en estas vistas se omite con `false`, manteniendo la imagen y el color del modelo final.

iOS anima el fondo existente o la capa de borde. Android utiliza un pequeño objetivo Java `ObjectAnimator` que actualiza el diseño de Core sin reemplazar su geometría o imagen. Este objetivo se adapta a Core reemplazando el elemento dibujable durante la reproducción. Su compatibilidad depende de los campos dibujables nativos de Core; si esos campos no están disponibles, se omite la reproducción y se mantiene el color final del modelo. Reconstruya la aplicación Android después de instalar o actualizar Jolt para que se incluya el destino nativo.

## Texto {#text}

En iOS, `color` admite etiquetas y botones. Jolt dibuja una máscara alfa de UILabel una vez y anima una capa sólida a través de ella, preservando el ajuste nativo, las fuentes y las posiciones de los glifos. Los intervalos y las cadenas formateadas con su propio color explícito conservan ese color. El texto y la accesibilidad permanecen en la etiqueta nativa original. Editar texto, cambiar su diseño o rediseñarlo cancela la reproducción y restaura el texto del modelo actual. Al iniciar `animateText()` también se libera una máscara de color de texto activa.

Los emoji de color y algunos rangos de símbolos, archivos adjuntos, sombras de texto y máscaras de más de cuatro millones de píxeles se omiten en iOS: se aplica el color del modelo final y `finished` se resuelve con `false`. La animación en color TextField y TextView no es compatible con iOS. No hay ningún respaldo que anime una captura de pantalla completa del control.

En Android, `color` admite controles TextBase y utiliza el configurador de color de texto nativo. Los colores explícitos del formato formateado de Android permanecen intactos.
