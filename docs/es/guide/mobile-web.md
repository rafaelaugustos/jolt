# Validación Web móvil

El mantenedor eligió simuladores/emuladores para esta entrega. Las interacciones usan Safari y Chrome reales con sus teclados de software; no se inyectaron eventos de sensores. Las correcciones del teclado descritas aquí están publicadas en **0.1.0-rc.11**.

<Clip name="web-mobile-ios" caption="Safari 26.2 · simulador iPhone 17, iOS 26.2. Escritura real, rotación, permiso, pausa/reanudación y liberación. Se concede permiso de movimiento, pero no llegan lecturas: ambas fuentes quedan no disponibles. Haptics no disponibles. Interfaz en inglés, velocidad original." />

<Clip name="web-mobile-android" caption="Chrome 133 · emulador Android API 36. Teclado real, rotación, pausa/reanudación y liberación. Las lecturas de rotación/gravedad proceden del emulador; una solicitud de vibración no demuestra vibración física. Interfaz en inglés, velocidad original." />

## Contrato del teclado

Un objeto VirtualKeyboard con rectángulo vacío no demuestra un backend de geometría activo. Sin overlaysContent habilitado por la aplicación o un rectángulo no vacío, Jolt usa VisualViewport. No modifica overlaysContent.

Si el navegador redimensiona ambas viewports, la visibilidad se estima desde la altura de reposo y la cobertura sigue en cero para evitar un desplazamiento doble. El desplazamiento del navegador cambia la cobertura inferior sin ocultar el teclado lógico. La rotación invalida la referencia de altura. Una ventana redimensionada con un campo enfocado puede afectar la estimación.

## Reproducción y evidencia

[Protocol and raw reports](https://github.com/rafaelaugustos/jolt/tree/main/benchmarks/web-mobile).

```sh
node benchmarks/web-mobile/server.mjs
python3 benchmarks/web-mobile/android.py YOUR_EMULATOR /tmp/jolt-mobile-android
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR /tmp/jolt-mobile-ios testMobileBrowser
```

[Keyboard API](keyboard.md) · [Parity inventory](web-parity.md)
