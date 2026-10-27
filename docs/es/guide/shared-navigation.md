# Navegación compartida {#shared-navigation}

`sharedNavigation(frame)` conecta **una imagen estática o tarjeta simple** en dos páginas en el mismo NativeScript Frame. Una única superposición nativa indica su posición, tamaño y clip redondeado; las imágenes también interpolan el rectángulo de contenido mostrado, incluido `aspectFill` → `aspectFit`. El contenido de la tarjeta se fusiona sin estirar el texto.

Disponible desde **0.1.0-rc.1**. Reconstruya la aplicación nativa después de instalar esta versión. Esta es la primera entrega de [#24](https://github.com/rafaelaugustos/jolt/issues/24): navegación programática hacia adelante/atrás. Para devolución de imagen/tarjeta interactiva nativa en iOS y Android 14+, utilice [gestos compartidos](./shared-gestures). Para celdas de lista recicladas/fuera de pantalla, agregue un [solucionador de destino de retorno](./return-targets).

<Clip name="shared-navigation-ios" caption="Simulador iOS 26.2: XCTest real abre una foto y una tarjeta de pase de un día, luego regresa a través de vue-router-ns. Reproducción nativa Jolt; velocidad original. No evidencia de rendimiento del dispositivo físico." />
<Clip name="shared-navigation-pt-ios" caption="Simulador iOS 26.2: la misma navegación con foto/tarjeta en portugués, utilizando toques XCTest reales y velocidad original." />
<Clip name="shared-navigation-android" caption="Emulador Android: toques ADB reales se abren y regresan de la foto y la tarjeta a través de vue-router-ns. Reproducción nativa Jolt; velocidad original. Respaldo programático, no una vista previa interactiva o predictiva." />

## Un propietario por Frame {#one-owner-per-frame}

```ts
import { sharedNavigation } from '@rafaelaugusto/jolt/shared-navigation'

// Keep this owner for the lifetime of the Frame, not the source page component.
const motion = sharedNavigation(frame, {
  transition: 'smooth', // 'snappy', 'bouncy', or a finite Jolt spring/tween
  navigationTimeout: 3000,
  layoutTimeout: 500,
  maxSnapshotPixels: 8_000_000,
})
```

Da el origen y el destino el mismo **Núcleo `sharedTransitionTag`**. Las etiquetas tienen como ámbito la página actual en este Frame; Se excluyen los marcos anidados. Una etiqueta faltante o duplicada omite la animación compartida y mantiene la ruta funcionando. `sharedTransitionIgnore` excluye una vista.

```vue
<!-- Source page -->
<Image
  src="~/images/cove.png"
  sharedTransitionTag="place:42"
  stretch="aspectFill"
  width="170"
  height="210"
  borderRadius="24"
/>
<!-- Destination page: the same decoded local image, with different geometry. -->
<Image
  src="~/images/cove.png"
  sharedTransitionTag="place:42"
  stretch="aspectFit"
  width="320"
  height="440"
  borderRadius="10"
/>
```

Cargar imágenes antes de navegar. El modo de imagen requiere NativeScript `Image`, el mismo `src` o `ImageSource` en ambos extremos, sin tinte, y `aspectFill`/`aspectFit`. Las imágenes animadas, la distorsión de relleno, las imágenes remotas que aún se cargan y las vistas respaldadas por GPU retroceden. Los contenedores de vista simple utilizan instantáneas nativas delimitadas. Los antepasados ​​pueden desplazarse o escalar uniformemente; La geometría rotada, translúcida, recortada/fuera de pantalla y entre ventanas no está disponible.

## Núcleo Frame y vue-router-ns {#core-frame-and-vue-router-ns}

La devolución de llamada se invoca **exactamente una vez**, después de la captura del origen. Pase su opción `animated: false` a través de: el enrutador Frame posee compromiso de ruta, enlaces e historial; Jolt posee la superposición compartida. No combine esta operación con una transición de segunda página, zoom Core `SharedTransition.custom()` o UIKit en la misma ruta.

```ts
const opening = motion.navigate({
  tag: 'place:42',
  navigate: (options) => frame.navigate({ create: createDetailPage, ...options }),
})
const result = await opening.finished

// Return resolves the current source page's tag after layout; no cached view/rect.
await motion.navigate({
  tag: 'place:42',
  navigate: () => frame.goBack(), // entry was created without a page animation
}).finished
```

La vista previa declara y ejercita **vue-enrutador-ns 0.1.0-rc.2**:

```ts
await motion.navigate({
  tag: 'place:42',
  navigate: (options) => router.push('/places/42', options),
}).finished

await motion.navigate({
  tag: 'place:42',
  navigate: (options) => router.back(options),
}).finished
```

Utilice una única ventana/Frame, push/back normal y contenido ya disponible en esta entrega. Las rutas anidadas/modales, las pestañas, el reemplazo entre marcos y la realización automática de elementos de lista están fuera de este contrato. Deshabilite el deslizamiento interactivo hacia atrás de la página cuando muestre este backend programático; La navegación del sistema fuera del controlador mantiene el comportamiento normal del enrutador y cancela cualquier superposición activa.

## Propiedad e interrupción {#ownership-and-interruption}

`state` es `idle`, `preparing`, `running` o `disposed`. Mientras está activo, otro `navigate()` devuelve `unavailable` / `busy` **sin invocar su devolución de llamada**. Deshabilite los controles de navegación repetidos o maneje ese resultado; Las solicitudes no están en cola. Esta etapa no proporciona una reorientación continua de retroceso.

`finished` siempre se conforma con una operación invocada: `completed`, `unavailable`, `cancelled` o `failed`, más `navigated`, un `reason` opcional y un `error` lanzado opcional. Un guardia de ruta rechazada informa `failed`; una guardia resuelta que deja la página sin cambios informa `unavailable`. Los objetivos faltantes, el diseño y los plazos no válidos restauran las vistas reales. `cancel()` cancela solo la superposición. Nunca revierte una ruta comprometida ni aborta la protección del enrutador; un guardia aún puede completar más tarde.

La rotación, el movimiento/descarga del destino, otra navegación, la suspensión de la aplicación, la activación del movimiento reducido y `dispose()` finalizan la superposición de forma segura. El movimiento reducido salta la captura y realiza la misma ruta. Las superposiciones nativas están excluidas de la accesibilidad y la orientación táctil; El enfoque de accesibilidad permanece en las páginas enrutadas reales. La biblioteca no instala ni reemplaza los delegados del controlador de navegación ni los reconocedores del sistema operativo.

La preparación puede llamar a JavaScript. La reproducción utiliza pistas Jolt muestreadas en `CADisplayLink` / Android `Choreographer` nativos, sin devolución de llamada de JavaScript ni copia de mapa de bits por fotograma. Esto utiliza las etiquetas de Core y el límite de navegación Frame en lugar del asistente de sincronización `SharedTransition` de Core, cuyo comportamiento de resorte/recorte específico de la plataforma no puede expresar este contrato de manera consistente. Es **no** un adaptador para el zoom iOS 18 UIKit, y no afirma que los parámetros del resorte opaco UIKit sean iguales a la física del Jolt.

El presupuesto de captura combinado predeterminado es de 8 millones de píxeles (aproximadamente 32 MB RGBA), con un límite de 32 millones. Cada espera está limitada; La reproducción nativa tiene un límite de 30 segundos. Disponer del propietario al abandonar el Frame; La descarga Frame lo elimina automáticamente. Utilice [API de diseño compartido](./shared-layout) para realizar cambios dentro de una página.

Para movimiento de imagen/tarjeta vinculado a gestos nativos hacia atrás en páginas estables, use [gestos compartidos](./shared-gestures).
