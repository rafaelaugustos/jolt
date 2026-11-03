# Recetas nativas completas

Estas pantallas ejecutables de Core NativeScript incluyen creación de vistas y limpieza. Usan APIs públicas sin depender de un framework; el preview Vue solo monta el Frame. El código se incluye directamente desde los archivos compilados.

Ejecute el demo con --recipe=gallery, --recipe=sheet o --recipe=lists. Android usa el extra recipe correspondiente. Se admite Core ListView; otros routers y listas necesitan su propio resolvedor. Las capturas validan el simulador, no el rendimiento físico.

## Galería

Use claves estables y resuelva la celda actual al volver. Cargue imágenes mediante src para que cada vista conserve su propio wrapper; compartir un ImageSource mutable entre celdas recicladas puede borrar los píxeles de otra vista. El callback de Frame aplica las opciones de Jolt antes de volver. El visor mantiene la posición hasta aceptar o cancelar la navegación.

<Clip name="recipe-gallery-ios" caption="Simulador iPhone 17 · iOS 26.2. Toques y arrastres reales de XCTest; interfaz en inglés, velocidad original. Zoom, desplazamiento, cierre cancelado, reordenación del elemento seleccionado, retorno por clave y cierre por arrastre." />

<<< @/../demo/src/recipes/gallery.ts

## Sheet

Un controlador posee el panel, handle, ScrollView anidado, seguimiento del teclado y retorno del foco. Se libera al descargar la raíz.

<Clip name="recipe-sheet-ios" caption="Simulador iPhone 17 · iOS 26.2. Toques y arrastres reales de XCTest; interfaz en inglés, velocidad original. Abrir, redimensionar, añadir contenido, escribir con el teclado real, cerrar/reabrir y desplazar." />

La Activity Android usa `android:windowSoftInputMode="adjustResize"` para redimensionar el host sin desplazar toda la ventana. Aplica esta opción en el manifiesto de tu app.

<Clip name="recipe-sheet-android" caption="Emulador Pixel 7 Android API 36 · interfaz en inglés, velocidad original. Toques, escritura y gesto reales: contenido dinámico, teclado con adjustResize, cerrar/reabrir y scroll interno. No es un dispositivo físico." />

<<< @/../demo/src/recipes/sheet.ts

## Lista

Un vínculo animateItems por lista cargada, liberado al descargarla. itemLoading actualiza las etiquetas recicladas con los datos actuales; sustituir elementos no crea otro vínculo.

<Clip name="recipe-list-ios" caption="Simulador iPhone 17 · iOS 26.2. Toques y arrastres reales de XCTest; interfaz en inglés, velocidad original. Desplazar una Core ListView virtualizada y sustituir sus datos dos veces." />

Con Core 9.1.3 en iOS, esta receta desactiva la precarga de celdas de UIKit: una celda precargada podía perder su contenido antes de mostrarse. Las alturas fijas y sus estimaciones mantienen el diseño predecible. Este ajuste se limita a la receta.

<<< @/../demo/src/recipes/lists.ts

## UI compartida

<<< @/../demo/src/recipes/ui.ts
