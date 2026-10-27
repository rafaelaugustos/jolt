# Efectos de SF Symbols {#sf-symbol-effects}

`symbolEffect()` reproduce los efectos de símbolos nativos de Apple en un `Image`. Utilice una fuente SF Symbol como `sys://bell.fill`.

<Clip name="symbols" caption="Rebota, pulsa y reemplaza en SF Symbols." />

```ts
import { symbolEffect } from '@rafaelaugusto/jolt'

symbolEffect(bell, 'bounce')
symbolEffect(heart, 'pulse')
symbolEffect(wifi, 'variableColor')
symbolEffect(favorite, { replace: 'sys://heart.fill' })
```

El objetivo es un NativeScript `Image`, o un árbitro que tiene uno. La reproducción se ejecuta en UIKit, sin trabajo JavaScript por cuadro. Esta API es independiente de los ajustes preestablecidos de transformación en `animate()`.

## Efectos y opciones {#effects-and-options}

| Efecto                      | Comportamiento                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `bounce`                    | Rebota el símbolo una vez.                                                                 |
| `pulse`                     | Pulsa su opacidad una vez.                                                                 |
| `variableColor`             | Anima las capas del símbolo, como las barras en `wifi`. La apariencia depende del símbolo. |
| `scale`                     | Escala el símbolo y lo mantiene hasta que se detiene.                                      |
| `{ replace: 'sys://name' }` | Transiciones a otro símbolo y actualiza `src` y `imageSource` de la imagen.                |

`speed` es un multiplicador positivo del tiempo de Apple, no una duración en milisegundos. Rebote, pulso y color variable aceptan `repeat: true` para seguir jugando. La escala y el reemplazo no se repiten.

```ts
const loading = symbolEffect(wifi, 'variableColor', { repeat: true, speed: 0.8 })
loading.stop()

const selected = symbolEffect(star, 'scale')
selected.stop() // removes the held scale
```

## Finalización y limpieza {#completion-and-cleanup}

El resultado tiene `finished`, `stop()` y `then()`, al igual que otras animaciones de Jolt:

```ts
const completed = await symbolEffect(bell, 'bounce')

await sequence([
  () => symbolEffect(favorite, { replace: 'sys://heart.fill' }),
  () => animate(card, 'popIn'),
])
```

Los efectos finitos se resuelven con `true` cuando UIKit informa que se completó. Los efectos detenidos, reemplazados u omitidos se resuelven con `false`. Los efectos de escala y repetición permanecen pendientes hasta que se detengan. Al detener un reemplazo se mantiene el icono de destino.

Un nuevo `symbolEffect()` sobre la misma Imagen anula el anterior. Descargar la vista o cambiar su fuente también la cancela. Las llamadas realizadas antes de que se cargue la vista o su imagen la esperan. Utilice el identificador devuelto para detener el efecto de un símbolo; `stop(view)` controla las propiedades reproducidas por `animate()`.

El reemplazo carga el nuevo símbolo de forma sincrónica, preservando `loadMode`, el tinte y la configuración del símbolo. Si `src` está vinculado al estado de la aplicación, mantenga ese estado sincronizado también para que una renderización posterior no restaure el icono anterior. Evite controlar la misma imagen con `iosSymbolEffect` mientras Jolt posee un efecto.

## Compatibilidad {#compatibility}

Los efectos requieren **iOS 17+**. En versiones anteriores de iOS, los efectos decorativos se omiten y el reemplazo actualiza el ícono inmediatamente. Un símbolo no disponible deja el ícono actual sin cambios y se resuelve con `false`.

Con Reducir movimiento habilitado cuando comienza la reproducción, los efectos decorativos se omiten y el reemplazo es inmediato. En Android, cada llamada es no operativa y se resuelve con `false`, incluido el reemplazo. Un mapa de bits no puede reproducir un efecto de símbolo; reemplazarlo con un símbolo es inmediato.

Para conocer las definiciones de efectos de Apple, consulte [Marco de símbolos](https://developer.apple.com/documentation/symbols?language=objc).
