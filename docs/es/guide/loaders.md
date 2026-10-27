# Indicadores de carga {#loaders}

Agregar un indicador de carga a una vista vacía:

<Clip name="loaders" caption="Puntos, barras y un anillo." />

```ts
import { loader } from '@rafaelaugusto/jolt'

const stopLoading = loader(slot, {
  style: 'dots',
  color: '#71717a',
  size: 48,
  duration: 1200,
})

stopLoading() // when the content is ready
```

El indicador permanece centrado en el objetivo. Utiliza un `CAReplicatorLayer` con una capa fuente animada: tres puntos pulsantes, cinco barras de ecualizador o doce puntos que se desvanecen alrededor de un anillo. Core Animation reproduce el bucle sin devoluciones de llamada JavaScript por fotograma ni vistas NativeScript adicionales.

## Opciones {#options}

| Opción     | Predeterminado | Significado                                                                        |
| ---------- | -------------- | ---------------------------------------------------------------------------------- |
| `style`    | `'dots'`       | `'dots'`, `'bars'` o `'ring'`.                                                     |
| `color`    | `'#71717a'`    | Una cadena de colores NativeScript.                                                |
| `size`     | `48`           | Ancho y alto máximos en DIPs. Se encoge para adaptarse a los límites del objetivo. |
| `duration` | `1200`         | Milisegundos por ciclo.                                                            |

El tamaño y la duración deben ser números finitos positivos. Se muestran opciones no válidas antes de reemplazar un cargador existente. El indicador sigue los cambios de diseño sin reiniciar su animación.

El objetivo necesita un ancho y alto distintos de cero; el cargador no le da un tamaño intrínseco. Agrega una capa sin cambiar el contenido existente, enmascarar, transformar o realizar pruebas de impacto. Un `GridLayout` vacío es una ranura adecuada. El recorte existente aún se aplica.

```vue
<GridLayout ref="slot" width="80" height="64" accessibilityLabel="Loading results" />
```

Establece una etiqueta accesible o proporciona un estado de carga cercano en la aplicación. Las capas decorativas no crean elementos de accesibilidad y Jolt deja la configuración de accesibilidad del objetivo sin cambios.

## Limpieza y ciclo de vida {#cleanup-and-lifecycle}

`loader()` acepta una vista o una referencia que contiene una y devuelve una función de limpieza idempotente. Iniciar otro cargador en el mismo objetivo reemplaza al anterior. Una función de limpieza anterior no puede eliminar su reemplazo. Utilice la función devuelta para detener el cargador; `stop(view)` controla las orugas `animate()`.

Las llamadas realizadas antes de la carga esperan una ventana y un diseño distinto de cero. La descarga, incluso cuando la aplicación pasa a segundo plano, elimina las capas nativas y el observador de Reducción de movimiento. La carga recrea el indicador. Un objetivo de tamaño cero lo elimina temporalmente hasta que vuelva a tener un diseño utilizable.

La limpieza explícita también elimina los oyentes y evita cualquier reinicio. Mantenga la función y llámela cuando se elimine el componente propietario.

## Reducir movimiento y plataformas {#reduce-motion-and-platforms}

Con Reducir movimiento habilitado, los puntos, barras o anillos permanecen visibles sin animación. El cargador responde a los cambios de preferencias mientras está cargado y reanuda el movimiento si la configuración está desactivada.

Esta implementación es **Solo iOS**. Android devuelve una función de limpieza no operativa y no dibuja un indicador.
