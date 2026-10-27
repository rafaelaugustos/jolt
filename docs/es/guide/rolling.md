# Números animados {#rolling-numbers}

Cambie un número y deje que los dígitos que difieren encajen en su lugar:

<div class="clips">
<Clip name="rolling-ios" caption="Dígitos rodando en iOS." />
<Clip name="rolling-android" caption="Dígitos rodando en Android." />
</div>

```ts
import { rollTo } from '@rafaelaugusto/jolt'

await rollTo(balance, 1249.9, { format: (value) => value.toFixed(2) })
await rollTo(timer, '00:42')
```

El objetivo debe ser un NativeScript `Label`, o una plantilla ref/`ElementRef` que contenga uno. La etiqueta recibe su texto final de inmediato, por lo que el diseño, los enlaces y la accesibilidad mantienen el nuevo valor desde el primer fotograma. Sólo se mueve el dibujo: en cada cambio de posición, el antiguo glifo se desliza hacia afuera mientras el nuevo se desliza hacia adentro detrás de él, sobre un resorte Jolt, enganchado a la etiqueta. Los dígitos que permanecen iguales no se mueven.

Un número pasa primero por `format`, por defecto `String`. Una cadena se muestra tal como es.

## Opciones {#options}

| Opción      | Predeterminado | Significado                                                                           |
| ----------- | -------------- | ------------------------------------------------------------------------------------- |
| `format`    | `String`       | Convierte un número en el texto a mostrar.                                            |
| `duration`  | `600`          | Cuánto dura el resorte, en milisegundos.                                              |
| `bounce`    | `0.2`          | Rebote de resorte, de -1 a 1, como en [resortes](./transitions).                      |
| `stagger`   | `0`            | Milisegundos entre posiciones cambiadas, comenzando desde la más a la derecha.        |
| `delay`     | `0`            | Milisegundos antes de que se mueva la primera posición.                               |
| `direction` | `'auto'`       | `'auto'`, `'up'` o `'down'`.                                                          |
| `tabular`   | `true`         | Figuras tabulares en la etiqueta nativa, por lo que cada dígito tiene el mismo ancho. |

Con `'auto'`, un número mayor aumenta y uno menor disminuye. La comparación utiliza el número del `rollTo()` anterior en esa etiqueta, o el texto anterior cuando se analiza como un número; las cuerdas se enrollan. Enrollar significa que el antiguo glifo sale por la parte superior mientras que el nuevo entra por abajo.

## Cómo coinciden las posiciones {#how-positions-match}

Ambos textos están divididos en grafemas, por lo que una letra acentuada o un emoji unido cuenta como una posición, y están alineados en su último carácter. El dígito de las unidades permanece fijo cuando el número crece: `99` se convierte en `100` al convertir dos nueves en ceros y un `1` hacia la izquierda, y `100` se convierte en `99` al sacar el `1` solo. Los separadores y sufijos que no cambian permanecen quietos.

Los conteos escalonados cambiaron de posición desde la derecha: el dígito de las unidades se mueve primero, luego cada posición hacia su izquierda y finalmente los dígitos que salen sin entrar nada.

## Plataformas {#platforms}

En iOS, TextKit dispone el texto antiguo y nuevo en los límites actuales de la etiqueta y Jolt separa sus glifos en capas de imágenes temporales, como lo hace [entradas de texto](./text). Core Animation juega con el resorte y los desvanecimientos sin JavaScript por cuadro mientras el texto de la etiqueta se dibuja transparente. Se aplican los límites de la guía de texto: las etiquetas truncadas, los archivos adjuntos incrustados y la reducción automática de fuentes muestran el texto final y se resuelven con `false`.

En Android, un lapso por posición cambiada dibuja los glifos antiguos y nuevos y un animador nativo los mueve, siguiendo la escala de duración del animador del sistema. El `TextView` mantiene el texto real en todo momento. Reconstruya la aplicación Android después de la actualización para que se incluya la clase nativa; sin él la etiqueta muestra el texto final y la llamada se resuelve con `false`.

Con `tabular` activado, Jolt solicita la etiqueta nativa para figuras tabulares: la función de fuente de espaciado numérico en iOS y la configuración de `tnum` en Android. Las fuentes proporcionales dejan de desplazar el resto de la línea cuando un `1` se convierte en un `8`. NativeScript puede volver a configurar la fuente en su próximo cambio de estilo; la siguiente tirada aplica la característica nuevamente.

El rollo utiliza los límites de la etiqueta en el momento de su inicio. Cuando cambia el recuento de dígitos, el ancho de la etiqueta cambia en la siguiente pasada de diseño, lo que desplaza el texto centrado y alineado a la derecha. Una etiqueta alineada a la izquierda con figuras tabulares o un ancho fijo proporciona el resultado más limpio.

## Altura automática dentro de un StackLayout {#auto-height-inside-a-stacklayout}

Declare `rows="auto"` en el `GridLayout` circundante cuando la fila deba ajustarse a su texto. Una cuadrícula sin definiciones de filas puede extender su fila implícita a la altura disponible, y un `StackLayout` horizontal puede pasar esa altura a su etiqueta. `rollTo()` no agrega diseños secundarios: sus superposiciones de dibujo nativas no determinan la altura medida de la etiqueta.

```vue
<StackLayout>
  <GridLayout rows="auto" columns="auto,auto,*,auto">
    <StackLayout orientation="horizontal">
      <Label ref="range" text="312" fontSize="40" minWidth="180" />
    </StackLayout>
    <Label col="1" text="mi" verticalAlignment="middle" />
    <Label col="3" text="78%" verticalAlignment="middle" />
  </GridLayout>
</StackLayout>
```

El ancho aquí reserva espacio para cambiar el recuento de dígitos; la altura sigue siendo automática. La demostración emparejada compara etiquetas animadas y simples con tamaños de fuente 40 y 64 DIP, incluidos números crecientes/reducibles y cancelación. La verificación iOS también verifica que la superposición móvil exista durante la reproducción y se elimine después.

El [investigación del modelo](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/model-motion-values.md) reprodujo una etiqueta de 554 pt **antes** llamada `rollTo()`. Agregar `rows="auto"` lo redujo a 48,7 pt antes y después de la llamada, con la misma fuente Inter Display y sin altura fija. Una etiqueta estrecha aún puede volver al texto final cuando se truncan glifos nuevos o antiguos; reserve suficiente ancho cuando se requiera el efecto de rodadura.

<Clip name="rolling-layout-ios" caption="El texto animado y sin formato conserva alturas automáticas coincidentes mediante cambios y cancelación de dígitos, en el simulador iOS. El ancho está reservado; sin altura fija. Reproducción en tiempo real." />

<Clip name="rolling-layout-android" caption="El texto animado y sin formato conserva las alturas automáticas coincidentes mediante cambios y cancelaciones de dígitos, en el emulador Android. El ancho está reservado; sin altura fija. Reproducción en tiempo real." />

## Paradas y cambios {#stopping-and-changes}

```ts
const roll = rollTo(balance, 2000, { format })
roll.stop()

await sequence([() => rollTo(score, 10), () => animate(badge, 'popIn')])
```

Devuelve un `Animation`: `await`, lee `finished` o llama a `stop()`. La finalización nativa se resuelve con `true`. Al detenerlo, se deja el texto final en su lugar y se resuelve con `false`. Cuando el texto no cambia, la llamada se resuelve con `true` de inmediato. Iniciar otro `rollTo()` en la misma etiqueta cancela el anterior y se deshace del texto en el que se había asentado.

Descargar, una vista nativa diferente, y los cambios que la aplicación hace en el texto o estilo cancelan el rollo y mantienen lo que la aplicación establece. Un `formattedText` se reemplaza por el texto sin formato enrollado. Reduce Motion en iOS y los animadores deshabilitados en Android muestran el texto final inmediatamente y lo resuelven con `true`. Más de 256 posiciones cambiadas muestran el texto final y se resuelven con `false`.
