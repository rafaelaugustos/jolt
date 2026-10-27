# Gestos compartidos {#shared-gestures}

`sharedNavigationEntry(frame, options)` mantiene una imagen o tarjeta conectada mientras abre una ruta y la arrastra hacia atrás. Cancela el gesto para quedarte en detalle; complételo para volver a la fuente. El enrutador posee el historial, mientras que los controladores nativos del Jolt poseen la presentación compartida.

Disponible desde **0.1.0-rc.1**. Reconstruya la aplicación nativa. Verificado con NativeScript Core 9.1.3 y `vue-router-ns` 0.1.0-rc.2 en un simulador iOS 26.2 y un emulador Android 16/API 36. Android requiere API 34+, AndroidX Activity 1.8+, navegación por gestos y `<application android:enableOnBackInvokedCallback="true" ...>`.

<Clip name="shared-entry-ios" caption="Simulador iOS 26.2, inglés: toques reales y deslizamientos de borde abren una imagen, cancelan una devolución parcial, completan una devolución, luego abren y cancelan una tarjeta antes de usar su botón Atrás. Velocidad de reproducción nativa original." />
<Clip name="shared-entry-pt-ios" caption="Simulador iOS 26.2, portugués: el mismo viaje imagen/tarjeta, cancelación nativa y retorno comprometido con entrada real del SO. Esta no es una prueba de rendimiento del dispositivo físico." />
<Clip name="shared-entry-android" caption="Emulador Android 16, inglés: la cancelación del borde izquierdo del sistema real y la finalización del borde derecho mantienen la foto conectada; la tarjeta también cancela y regresa con su botón accesible. Velocidad original." />
<Clip name="shared-entry-pt-android" caption="Emulador Android 16, portugués: gestos y toques reales del sistema operativo demuestran las transiciones, cancelación y finalización de imagen/tarjeta. Los indicadores táctiles identifican la entrada real; sin fotogramas de animación simulados." />

## Una entrada, un propietario {#one-entry-one-owner}

Asigne al origen y al destino el mismo `sharedTransitionTag` único. Ambas páginas deben conservar sus árboles de vista. Las imágenes deben ser imágenes centrales estáticas decodificadas con la misma fuente; Se admiten cambios de cultivo `aspectFill`/`aspectFit`. Las tarjetas de diseño sencillo funden sus instantáneas. Siga las reglas de contenido admitido en [navegación compartida](./shared-navigation).

```ts
import { sharedNavigationEntry } from '@rafaelaugusto/jolt/shared-navigation'

// The source Frame and page are already loaded.
const entry = sharedNavigationEntry(frame, {
  tag: 'place-cover',
  spring: { duration: 480, bounce: 0 },
  // vue-router-ns resolves undefined for success and a failure object for rejection.
  back: async (options) => (await router.back(options)) === undefined,
  onState(event) {
    if (event.outcome === 'cancelled') console.log('Still in detail')
  },
})

const result = await entry.open((options) => router.push('/place/cove', options))
// Wire the destination's accessible back button to the same owner.
backButton.on('tap', () => entry.back())
// Dispose when this owned entry is removed, not merely when its source is covered.
```

Para Core, pase las opciones proporcionadas a `frame.navigate({ create: createDetail, ...options })` y use una devolución de llamada `back` que verifique `frame.canGoBack()` antes que `frame.goBack()`. Devuelva `false` si no es posible la devolución. Se admite un retorno de vacío `navigate` síncrono. No agregue otra transición a la misma entrada.

`open()` es de un solo uso y se resuelve después de que la presentación de entrada se liquida con el `SharedNavigationResult` existente (`completed`, `unavailable`, `cancelled` o `failed`, más `navigated` y `reason` opcional). Un par faltante o no compatible utiliza la navegación normal. Por lo tanto, `unavailable` puede tener `navigated: true`. Las aperturas repetidas no invocan otra ruta. Las solicitudes de devolución durante la apertura se fusionan en una sola devolución una vez finalizada la entrada.

## Propiedad de gestos nativos {#native-gesture-ownership}

| Plataforma  | Presentación e historial compartidos.                                                                                                                                                                                                                                                                                                                                                                     |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iOS         | Los enlaces de transición personalizados de Core mantienen su delegado de navegación y el historial de UIKit. Un reconocedor de bordes nativo impulsa el fundido cruzado de la página y la imagen/tarjeta compartida desde el mismo progreso. El par se resuelve después de que UIKit presenta la transición.                                                                                             |
| Android 14+ | El despachador de respaldo del sistema existente impulsa el progreso nativo y el resorte nativa. Antes de la entrada se captura una instantánea delimitada de la página de origen estática y su ancla. La página de detalles reales permanece debajo de la declaración compartida. La devolución de llamada `back` de la aplicación se ejecuta una vez después de completarse, con `{ animated: false }`. |

No se ejecuta ninguna devolución de llamada JavaScript por muestra de gesto o cuadro de visualización. JavaScript resuelve etiquetas, valida la fuente estática en los límites de los gestos, entrega notificaciones del ciclo de vida y realiza la navegación de la aplicación. Esto no hace que el hilo principal síncrono JavaScript funcione sin bloqueo.

En iOS, UIKit envía un pop interactivo a través de Core; La devolución de llamada de la aplicación `back` suministrada se utiliza mediante el botón accesible. Respete `Page.enableSwipeBackNavigation` y la política de protección del enrutador: una salida de protección puede desactivar el deslizamiento nativo. En Android, una protección asíncrona rechazada regresa y conserva la misma entrada para volver a intentarlo. El sistema operativo decide si un gesto se confirma; no existe un umbral intermedio de entrada compartida.

## Limpieza y respaldo {#cleanup-and-fallback}

- `back()` utiliza la ruta de retorno nativa; Las solicitudes repetidas mientras hay una devolución pendiente se ignoran. Mantenga un respaldo de enrutador normal para un botón cuya manija ya esté desechada.
- `cancel()` restaura un gesto retenido. Llamarlo durante la apertura dispone de la presentación; no puede cancelar la operación pendiente del enrutador. Continúa una versión Android ya confirmada por el sistema operativo.
- Descarga de `dispose()`, Frame, eliminación de rutas o suspensión de aplicaciones, entrada de liberación, superposiciones e instantáneas retenidas. Después de la suspensión, use la espalda normal o cree una nueva entrada en el siguiente empujón.
- El movimiento reducido preserva la navegación sin el vuelo compartido. Etiquetas faltantes/duplicadas, imágenes incompatibles, fuente estática Android modificada, contenido no compatible o presupuesto de instantánea insuficiente retroceden sin dejar una vista oculta.
- `maxSnapshotPixels` tiene como valor predeterminado **8,000,000** y acepta números enteros positivos hasta **32,000,000**. Android representa la escena de regreso retenida junto con su vuelo; iOS limita cada vuelo. Esto limita los píxeles contados de la imagen, no la memoria total del proceso.
- `navigationTimeout` tiene como valor predeterminado **5000ms**, con un máximo de **10000ms**. Las esperas de apertura y retorno alternativo liberan la propiedad cuando se agota el tiempo de espera. La confirmación protegida de Android restaura su vista previa cuando se agota el tiempo de espera. Ninguno de estos puede cancelar una promesa de aplicación o deshacer la navegación externa tardía; mantener a los comprobaciones acotados.

El resorte acepta `smooth`, `snappy`, `bouncy`, duración/rebote o rigidez/amortiguación/masa. La sedimentación nativa está limitada por los controladores existentes (3 segundos en iOS, 1,5 segundos en Android). La geometría compartida visible está sujeta a sus puntos finales.

El ciclo de vida de `state` es `ready`, `opening`, `idle`, `tracking`, `finishing`, `cancelling`, `committing` o `disposed`. Los eventos pueden incluir `shared: { status: 'ready' | 'unavailable', reason? }`, terminal `outcome` y `release: { progress, velocity }` de muestra. Son diagnósticos del ciclo de vida, no un flujo de progreso reactivo.

Esta etapa admite **páginas retenidas estables, una imagen estática o tarjeta simple**. El fondo de retorno de Android es una instantánea: mantenga esa fuente estática mientras esté cubierta; la detección de cambios retrocede en lugar de resolver un nuevo destino. Para celdas recicladas/fuera de pantalla y resolución de destino de desplazamiento, use el [solucionador de destino de retorno](./return-targets) opcional, que selecciona una política de devolución Android diferente. Para coordinar el zoom de fotografías y arrastrar para descartar, consulte [galería completa](./gallery). El contenido de video en vivo/GL/WebView, el descarte modal arbitrario y las transiciones de zoom nativo iOS permanecen fuera de esta etapa. La rotación, el RTL y el rendimiento del dispositivo físico no se validaron exhaustivamente. Ver [reproducción nativa y evidencia de auditoría](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/shared-entry.md).
