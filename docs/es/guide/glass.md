# Liquid Glass {#liquid-glass}

Acerca los controles y deja que iOS fusione sus superficies. `@rafaelaugusto/jolt/glass` incorpora `GlassContainer` y `GlassView`, dos contenedores de NativeScript compatibles con la API `animate()` existente. Disponible desde **0.1.0-rc.1**.

<Clip name="glass-ios" caption="Simulador iOS 26.2: toques reales fusionan y separan tres superficies de vidrio nativo, cambian material, interrumpen el movimiento, pausan/reanudan y aplican Reducir Movimiento. interfaz de usuario en inglés; velocidad original." />
<Clip name="glass-android" caption="Emulador Android API 36: el mismo diseño, movimiento e interacción táctil con tarjetas clásicas de estilo explícito. Android no tiene Liquid Glass ni fusión. Interfaz de usuario en inglés y toques ADB reales; velocidad original." />

<Clip name="glass-legacy-ios" caption="Simulador iOS 18.6: las superficies desenfocadas redondeadas ordinarias preservan el contenido, la entrada y el movimiento, sin fusión Liquid Glass. Interfaz de usuario en inglés y toques reales; velocidad original." />

## Una superficie compartida {#a-shared-surface}

Registre los diseños una vez cuando use NativeScript-Vue:

```ts
import { registerElement } from 'nativescript-vue'
import { GlassContainer, GlassView } from '@rafaelaugusto/jolt/glass'

registerElement('GlassContainer', () => GlassContainer)
registerElement('GlassView', () => GlassView)
```

```vue
<GlassContainer height="160" glassSpacing="26">
  <GlassView id="left" width="72" height="72" translateX="-104"
    glassInteractive="true">
    <Label text="✦" textAlignment="center" verticalAlignment="center" />
  </GlassView>
  <GlassView id="right" width="72" height="72" translateX="104"
    glassInteractive="true">
    <Label text="＋" textAlignment="center" verticalAlignment="center" />
  </GlassView>
</GlassContainer>
```

Después de cargar las vistas, pase el **NativeScript ver instancias** nativo a Jolt:

```ts
import { animate, motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
scope.add(animate(left, { x: -36 }, 'smooth'))
scope.add(animate(right, { x: 36 }, 'smooth'))

// In your application suspend/resume handlers:
// scope.suspend()
// scope.resume()

// At permanent component teardown:
// scope.dispose()
```

En NativeScript Core, crea estas clases y usa `addChild()` como de costumbre. `GlassView` es un `GridLayout`: admite etiquetas, iconos y controles. Coloca los elementos de vidrio directamente en el mismo `GlassContainer`. Los contenedores insertan los elementos hijos en el `contentView` de cada efecto nativo y conservan la gestión de vistas, el diseño y la entrada de NativeScript.

En iOS 26+, el contenedor usa `UIGlassContainerEffect` y cada superficie usa `UIGlassEffect`. Al acercar los elementos se cambia la forma del material compartido. UIKit decide la combinación en función de la geometría y el espaciado; Jolt anima las vistas. Ver [Envase de cristal de Apple](https://developer.apple.com/documentation/uikit/uiglasscontainereffect) y [vistas personalizadas de Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/284/).

## Propiedades {#properties}

| Propiedad                 | Predeterminado | Significado                                                                |
| ------------------------- | -------------- | -------------------------------------------------------------------------- |
| Contenedor `glassSpacing` | `16`           | Distancia en DIPs a la que se mezcla el vidrio cercano, 0–200.             |
| Ver `glassStyle`          | `'regular'`    | `'regular'` o `'clear'`, iOS 26+.                                          |
| Ver `glassRadius`         | `'capsule'`    | Cápsula o radio de esquina en DIPs, 0–1000. Aplica en iOS.                 |
| Ver `glassTint`           | `undefined`    | Jolt `ColorValue`; `null`/`undefined` elimina el tinte. iOS 26+.           |
| Ver `glassInteractive`    | `false`        | Respuesta nativa al tacto, iOS 26+. No instala un controlador de toque.    |
| Ver `glassFallback`       | `'blur'`       | `'blur'` o `'none'` antes de iOS 26. Android siempre no usa ningún efecto. |

Las propiedades numéricas aceptan números y cadenas numéricas en el marcado declarativo. `glassInteractive` también admite `'true'` y `'false'`. Los valores no válidos provocan un error antes de sustituir el material. Los cambios de propiedades configuran el material nativo de inmediato; no son canales de animación independientes. Usa `glassRadius` para las esquinas del vidrio nativo, sin añadir un recorte o una máscara CSS que compita con él.

`supportsLiquidGlass()` verifica el sistema operativo y los metadatos de NativeScript disponibles. Solo lectura `glassBackend` informa la capacidad seleccionada: contenedor `'liquid-glass'`/`'none'`, vista `'liquid-glass'`/`'blur'`/`'none'`. Describe la configuración, no si una vista descargada se está procesando actualmente.

## Plataformas y ciclo de vida {#platforms-and-lifecycle}

Compilación con Xcode y metadatos NativeScript iOS que soportan UIKit 26 para usar Liquid Glass. En un tiempo de ejecución iOS anterior, cada superficie utiliza un `UIBlurEffect` normal, a menos que `glassFallback="none"`; el contenedor no tiene ningún efecto y las superficies no se fusionan. En Android, ambas clases siguen siendo las `GridLayout` normales: el contenido y la interacción permanecen disponibles, sin desenfoques ni fusiones. Establezca un fondo explícito y `borderRadius` para Android, como lo hace la vista previa. El respaldo también se ejecutó en un simulador iOS 18.6.

Mantenga el vidrio y sus ancestros en opacidad 1 y evite recortar el área de fusión del recipiente. Desvanecer una vista de efecto no es una forma admitida de atenuar su material. UIKit maneja la apariencia de accesibilidad del sistema; compruebe el contraste con el fondo real. [Guía de vista de efectos de Apple](https://developer.apple.com/documentation/uikit/uivisualeffectview).

Usa la reproducción de transformaciones existente para interrupciones, resortes, retrasos, repeticiones, pausa, ajuste del progreso y movimiento reducido. Gestiona las animaciones devueltas mediante un ámbito de movimiento y conecta sus métodos de suspensión y reanudación si deben sobrevivir al paso de la aplicación a segundo plano. Los efectos se eliminan al descargar o liberar la vista y se restauran con la configuración más reciente al cargarla; la descarga de animaciones sigue el comportamiento de cancelación habitual de Jolt.

JavaScript configura materiales y prepara curvas de animación. UIKit renderiza el vidrio; La reproducción de transformación nativa existente avanza el movimiento. No hay ningún nuevo bucle por fotograma JavaScript, ayuda nativa o dependencia. No se trata de una transformación arbitraria de rutas SVG, una API de animación con radio de desenfoque o una medición del rendimiento de un dispositivo físico. Para esas diferentes operaciones, consulte [formas](./shapes), [desenfoque animado](./blur) y [deformación de la imagen líquida](./liquid).

La vista previa de **Mejor como uno / Aún así** en cuatro idiomas es el ejemplo 73. [Cheques nativos y reproducción](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/glass.md).
