# Texto {#text}

Revelar un título letra por letra, o palabra por palabra:

<div class="clips">
<Clip name="text-ios" caption="Entradas de letras y palabras en iOS." />
<Clip name="text-android" caption="Las mismas entradas en Android." />
</div>

```ts
import { animateText } from '@rafaelaugusto/jolt'

await animateText(title)
await animateText(title, { by: 'word', stagger: 100 })
```

El objetivo debe ser un NativeScript `Label`, o una plantilla ref/`ElementRef` que contenga uno. Los espacios, los saltos de línea, la alineación y los estilos formateados permanecen en su lugar. Los caracteres compuestos, como las letras acentuadas y los emoji unidos, permanecen juntos.

Cada pieza se desvanece y se mueve a su línea base original. La etiqueta original mantiene su diseño y elemento de accesibilidad, con el texto accesible completo disponible en todas partes y no se ejecuta nada en JavaScript por cuadro.

- **iOS:** TextKit presenta el texto completo antes de que Jolt separe sus glifos con forma en capas de imágenes temporales, que Core Animation reproduce. Las letras que comparten una ligadura se animan juntas. Las capas temporales no añaden elementos de accesibilidad.
- **Android:** abarca que solo afecta el desvanecimiento del dibujo y levanta cada pieza bajo un animador nativo. TextView mantiene su texto, saltos de línea, truncamiento y espacios de texto formateado; No se vuelve a medir nada.

## Opciones {#options}

| Opción     | Predeterminado | Significado                                                                         |
| ---------- | -------------- | ----------------------------------------------------------------------------------- |
| `by`       | `'letter'`     | `'letter'` o `'word'`; la puntuación sigue a su palabra en modo palabra.            |
| `duration` | `400`          | Milisegundos por pieza.                                                             |
| `stagger`  | `35`           | Milisegundos entre piezas, en orden de texto.                                       |
| `delay`    | `0`            | Milisegundos antes de la primera pieza.                                             |
| `y`        | `12`           | Desplazamiento vertical inicial en DIPs; los valores negativos entran desde arriba. |

La reproducción total es `delay + duration + (pieces - 1) * stagger`. Los espacios no agregan pasos en modo letra. La duración cero revela el texto completo inmediatamente, incluso cuando se solicitó un retraso.

## Paradas y cambios {#stopping-and-changes}

```ts
const entrance = animateText(title, { by: 'word', y: 18 })
entrance.stop()

await sequence([() => animateText(title), () => animate(button, 'fadeIn')])
```

Devuelve un `Animation`: `await`, lee `finished` o llama a `stop()`. La finalización nativa se resuelve con `true`. Al detenerlo se restaura el texto completo y se resuelve con `false`. Iniciar otro `animateText()` en la misma etiqueta cancela la entrada anterior y comienza de nuevo.

Descargar, una vista nativa diferente o cambios en el texto/estilo, cancelar la reproducción y restaurar el texto completo; en iOS, los límites redimensionados también lo hacen. Se conservan los cambios de la aplicación en el texto y las etiquetas de accesibilidad. Reducir movimiento en iOS y Eliminar animaciones en Android (animadores deshabilitados) omiten la entrada; Al habilitar Reducir movimiento durante la reproducción, se restaura el texto completo inmediatamente y se resuelve con `true`.

## Alcance {#scope}

Este efecto está destinado a títulos y pasajes cortos. Por encima de 256 piezas la etiqueta mantiene su texto original y se resuelve con `false`. El texto vacío se completa inmediatamente.

En iOS, las etiquetas truncadas, los archivos adjuntos incrustados y las etiquetas que utilizan reducción automática de fuentes conservan su texto original y se resuelven con `false`. Lo mismo se aplica cuando las instantáneas superan los cuatro millones de píxeles (aproximadamente 16 MB de datos RGBA). Los cambios de tipo dinámico que afectan el diseño cancelan la entrada; la etiqueta normal utiliza el diseño actualizado.

En Android, reconstruya la aplicación después de actualizar para que se incluya la clase nativa; sin él, la llamada se resuelve con `false` y conserva el texto. El texto truncado se reproduce como se dibuja y las letras a ambos lados del límite de una pieza pierden su ligadura mientras se reproduce la entrada.
