# JavaScript ocupado en Android {#busy-javascript-on-android}

Jolt calcula sus fotogramas clave una vez y los reproduce de forma nativa. Eso elimina el trabajo de JavaScript de cada cuadro de animación, pero `ObjectAnimator` de Android aún actualiza las propiedades de vista en el subproceso de la interfaz de usuario. En una aplicación NativeScript normal, el tiempo de ejecución principal JavaScript comparte ese hilo. Una tarea sincrónica larga puede detener las transformaciones, la opacidad y la reproducción del color hasta que la tarea regrese.

<Clip name="android-performance" caption="Reproducción normal, un bloque JavaScript de 300 ms y el mismo trabajo en un trabajador en un emulador Android 16. Un diagnóstico visual, no una garantía de rendimiento del dispositivo." />

`ViewPropertyAnimator.withLayer()` no mueve este trabajo a RenderThread. Almacena en caché el dibujo de la vista en una capa de hardware, luego restaura la capa anterior y aún usa un `ValueAnimator` para actualizar las propiedades. La caché de capa de opacidad existente de Jolt reduce el trabajo de dibujo; no puede hacer que un hilo de UI bloqueado responda. Consulte la fuente Android para [`withLayer()` and property updates](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/core/java/android/view/ViewPropertyAnimator.java).

## Pruébalo {#try-it}

El parque infantil Android incluye **Ocupado JavaScript**, con tres controles:

- Un preajuste Jolt `spin`.
- La misma rotación a través del nativo `ViewPropertyAnimator.withLayer()`.
- Una revelación circular nativa como un efecto separado para comparar.

**Reproducir** se ejecuta sin trabajo adicional. **Bloquear JS** ejecuta un bucle de CPU sincrónico de 300 ms después de que hayan comenzado las animaciones. **Trabajador** ejecuta el bucle idéntico en otro hilo. El trabajador está listo antes de que comience la reproducción, por lo que esta comparación excluye el inicio del trabajador.

La revelación nativa es un control de diagnóstico, no una implementación Android de la API `reveal()` de Jolt. Los efectos compatibles con RenderThread son efectos de plataforma específicos; no proporcionan un backend general para fotogramas clave o resortes Jolt arbitrarios.

El [punto de referencia repetible](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/android-busy.md) registra muestras de propiedades nativas, ID de subprocesos de trabajo y espacios entre marcos `gfxinfo`. Distingue los registros del marco de la ventana de la interfaz de usuario de la presentación en pantalla real. El resultado registrado del emulador es un diagnóstico, no una garantía de rendimiento del dispositivo físico.

## Mantenga el trabajo de la CPU fuera del subproceso de la interfaz de usuario {#keep-cpu-work-off-the-ui-thread}

Utilice un [NativeScript Trabajador](https://docs.nativescript.org/guide/multithreading) para la preparación de datos, análisis u otro trabajo de CPU que pueda devolver un pequeño resultado serializable. Las vistas y las actualizaciones de la interfaz de usuario permanecen en el hilo principal:

```ts
// In the app, not in Jolt.
const worker = new Worker('./prepare.worker.ts')
worker.onmessage = ({ data }) => {
  applyResult(data)
  worker.terminate()
}
worker.postMessage(input)
```

```ts
// prepare.worker.ts
import '@nativescript/core/globals'

self.onmessage = ({ data }) => {
  self.postMessage(prepareData(data))
}
```

Maneja los errores de los trabajadores y finaliza el trabajo pendiente cuando se elimina su pantalla; la demostración hace ambas cosas. Los trabajadores no pueden manipular las vistas NativeScript directamente. Mover el cálculo fuera del hilo tampoco hace que la conciliación o el diseño de una lista grande pase gratis: aplique los resultados en lotes pequeños y evite cambios de vista costosos durante el movimiento.

Si el trabajo no puede pasar a un trabajador, divídalo en tareas limitadas que cedan al bucle de eventos nativo o complételo antes de iniciar la animación. `Promise.resolve()` sólo cede ante microtareas; ajustar una tarea larga en `setTimeout()` simplemente retrasa el mismo bloque de subproceso de interfaz de usuario.

En iOS, las pistas Core Animation enviadas por Jolt pueden seguir reproduciéndose en el servidor de renderizado durante un bloque JavaScript, pero la entrada, la nueva configuración de animación y las devoluciones de llamada de finalización de JavaScript aún esperan el hilo principal.
