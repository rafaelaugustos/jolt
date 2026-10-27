# Filas de listas {#list-rows}

Reproduzca una entrada en cada fila de un `ListView` a medida que se desplaza a la vista:

<Clip name="lists-android" caption="Filas que aparecen gradualmente a medida que se desplaza la lista, en Android." />

```ts
import { animateItems } from '@rafaelaugusto/jolt'

const unlink = animateItems(listView, 'fadeInUp')
```

Cada fila que entrega la lista reproduce la animación, con los mismos fotogramas clave, ajustes preestablecidos y transiciones que [`animate()`](./animating). Una fila que aún no está en la pantalla toma su primer fotograma clave de inmediato y se reproduce una vez que la lista lo presenta, por lo que nada parpadea primero con la opacidad total.

```ts
animateItems(listView, { opacity: [0, 1], x: [-16, 0] }, { duration: 250 })
animateItems(listView, 'popIn', 'bouncy')
```

Cada fila se anima sola cuando aparece, por lo que `stagger` no tiene nada que espaciar y se rechaza.

## Filas recicladas {#recycled-rows}

Las listas reutilizan un puñado de vistas de filas mientras te desplazas. Cuando se reutiliza una fila para otro elemento, Jolt detiene lo que aún se estaba reproduciendo y comienza la entrada nuevamente desde el primer fotograma clave. El resto de las animaciones de la fila, iniciadas con su propio código, se dejan solas.

Con `once`, cada elemento de datos se anima solo la primera vez que aparece. En su lugar, una fila reutilizada para un elemento que ya se mostró se asienta en los valores finales:

```ts
animateItems(listView, 'fadeInUp', { once: true })
```

Los elementos se rastrean por identidad: un objeto cuenta como el mismo elemento mientras se mantiene la misma referencia, y un elemento primitivo se recuerda por su índice. Reemplazar los elementos con nuevos objetos los anima nuevamente.

## ¿Qué listas {#which-lists}

El objetivo es el núcleo `ListView`, o cualquier cosa que notifique a `itemLoading` con las filas `index` y `view` y enumere sus filas realizadas a través de `eachChildView`, que también es el contrato de la comunidad CollectionView. Las listas seccionadas informan la sección con el índice. Los objetivos ajustados, como una referencia de plantilla NativeScript-Vue, funcionan de la misma manera que con `animate()`.

## Limpieza {#cleanup}

El valor de retorno es una función de limpieza idempotente:

```ts
unlink() // stop listening and settle every row at its end values
```

Descargar la lista también elimina el efecto, por lo que una página almacenada en caché necesita una nueva llamada cuando regresa. Las filas se detienen en los valores que muestran y luego se mueven a los valores finales que la animación habría alcanzado, de modo que ninguna fila quede medio desvanecida. Los valores finales que dependen de la vista, como los fotogramas clave `null`, las animaciones relativas y las rutas de movimiento, se dejan donde se detuvieron.
