# Revelado circular {#circular-reveal}

Revelar contenido desde un punto, u ocultarlo con el efecto inverso:

<Clip name="reveal" caption="Una revelación y ocultación circular." />

```ts
import { reveal, conceal } from '@rafaelaugusto/jolt'

await reveal(details, { from: { x: 40, y: 40 }, duration: 500 })
await conceal(details, { to: { x: 40, y: 40 }, duration: 500 })
```

Ambas funciones aceptan una vista o una referencia que la contenga. En iOS, una máscara temporal `CAShapeLayer` anima su trayectoria circular en Core Animation, sin trabajo JavaScript por fotograma. El círculo crece lo suficiente como para cubrir cada rincón, incluso los orígenes fuera de la vista.

## Opciones {#options}

| Opción               | Predeterminado | Significado                                                                                         |
| -------------------- | -------------- | --------------------------------------------------------------------------------------------------- |
| `from` en `reveal()` | Centro         | Origen del círculo, con `x` y `y` finitos en DIPs desde la esquina superior izquierda del objetivo. |
| `to` en `conceal()`  | Centro         | Apunta los contratos del círculo hacia, en las mismas coordenadas.                                  |
| `duration`           | `400`          | Milisegundos finitos no negativos. Zero cambia la visibilidad inmediatamente.                       |

La curva es fácil de entrar y salir. Al interrumpir una revelación u ocultación activa, omitir el punto mantiene el centro del círculo actual. Estas funciones actualmente admiten máscaras circulares; toallitas y otras formas no están incluidas.

## Visibilidad y diseño {#visibility-and-layout}

`reveal()` hace que el objetivo sea visible detrás de la máscara en expansión. `conceal()` termina con `view.visibility = 'hidden'`, por lo que mantiene su espacio de diseño y ya no recibe toques. Ocultar un objetivo ya oculto o colapsado deja su visibilidad sin cambios.

La máscara no cambia el tamaño ni reposiciona la vista. Las máscaras existentes, incluidas las rutas de recorte de Core y los bordes redondeados no uniformes, se mantienen dentro de la máscara temporal y se restauran posteriormente. Se conservan la opacidad y las transformaciones.

Una vista descargada espera a que se cargue, una ventana y límites distintos de cero. Al revelar primero un objetivo colapsado, éste se cambia a `hidden` para que pueda medirse. Prefiere un objetivo inicialmente oculto cuando su espacio ya debería estar reservado.

Si el estado de la aplicación también controla `visibility`, manténgalo sincronizado con el efecto. Durante la reproducción, la máscara solo reproduce clips; El área táctil rectangular de la vista no cambia hasta que finaliza la ocultación. Las sombras dibujadas fuera de la propia capa de la vista no se incluyen en la máscara circular.

## Interrupción y limpieza {#interruption-and-cleanup}

El resultado tiene `finished`, `stop()` y `then()`, como `animate()`:

```ts
const opening = reveal(details, { duration: 800 })
// A later action can reverse from the circle currently on screen.
const closing = conceal(details)

await opening // false: superseded
await closing // true if it reached the hidden state
```

La finalización nativa se resuelve con `true`. La detención, sustitución, descarga o cancelación nativa se resuelve con `false`. Se lanzan opciones no válidas antes de reemplazar un efecto en ejecución. Utilice el identificador devuelto; `stop(view)` controla las orugas `animate()`.

`animation.stop()` elimina la máscara temporal y restaura la visibilidad anterior a la cadena de revelación/ocultación interrumpida. No deja una máscara parcial congelada. Un cambio de visibilidad externa cancela la animación manteniendo el nuevo valor de la aplicación.

Cambiar límites, vistas nativas, fondos o estilos de clip cancela el efecto y restaura la visibilidad anterior. Inicie un nuevo efecto después de que haya finalizado el cambio de diseño/estilo. La descarga se cancela sin repetición al recargar. La finalización y cancelación eliminan la animación nativa, la máscara, los oyentes y el observador de reducción de movimiento. Mantenga la manija y deténgala cuando deseche el componente propietario.

Utilice vistas envolventes independientes cuando combine este efecto con otro efecto que administre activamente máscaras, como `shimmer()`.

## Reducir movimiento y plataformas {#reduce-motion-and-platforms}

Con Reducir movimiento habilitado, la visibilidad final se aplica inmediatamente y el resultado es `true`. Habilitarlo durante la reproducción también finaliza el efecto inmediatamente, sin repetición si se deshabilita más tarde.

Esta implementación es **Solo iOS**. Las llamadas Android se resuelven con `false` sin cambiar la vista.
