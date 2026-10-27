# Esquinas, bordes y sombras {#corners-borders-and-shadows}

Los bordes uniformes utilizan la misma API `animate()` en iOS y Android:

<Clip name="decorations" caption="Radio de esquina, borde y sombra transformándose juntos." />

```ts
card.borderRadius = 8
card.borderWidth = 2
card.borderColor = '#b6ee64'

animate(card, { borderRadius: 40, borderWidth: 6 }, { duration: 800 })
```

Todas las dimensiones son numéricas DIPs. Los arreglos, `null`, transiciones por propiedad, resortes, retrasos, repeticiones, escalonamiento, secuencias y detenciones selectivas funcionan como de costumbre. Las propiedades de decoración tienen por defecto una interpolación de 300 ms. Los resortes pueden sobrepasarse; los radios, anchos y elevación renderizados se fijan en cero y la opacidad de las sombras en 0-1. Se rechazan los criterios de valoración explícitos fuera de esos rangos.

```ts
animate(card, { borderRadius: 0, rotate: 12 }, 'bouncy')
stop(card, ['borderRadius']) // rotation keeps playing
```

Un reemplazo comienza desde el valor visible. Al detenerse, se confirma ese valor en el modelo y se resuelve con `false`. Descargar o cambiar externamente la decoración cancela la reproducción nativa. `relative: true` agrega dimensiones y parámetros de sombra a sus valores al principio.

## Geometría y disposición {#geometry-and-layout}

Los anchos iniciales, los radios y los colores de los bordes deben ser uniformes. Se rechazan los trazados de recorte y las esquinas irregulares. No se admiten esquinas individuales, anchos de bordes individuales ni transformación de formas arbitrarias. Estas restricciones se verifican antes de que `animate()` cambie cualquier objetivo.

`borderRadius` anima el contorno del fondo; El recorte de contenido nativo sigue el estilo final de Core. En iOS, el radio tiene un límite en la mitad del lado más corto y la sombra sigue la misma curva muestreada.

`borderWidth` anima el trazo visual. NativeScript diseña el texto y los elementos hijos usando el ancho final inmediatamente; no anima el relleno ni vuelve a medir el contenido por cuadro. Para una ubicación de contenido fija, anime el borde en una vista decorativa separada.

## iOS sombras {#ios-shadows}

Configure un NativeScript `boxShadow` externo, luego anime sus parámetros:

```ts
card.boxShadow = '0 4 8 rgba(0, 0, 0, 0.2)'
animate(
  card,
  {
    borderRadius: 40,
    shadowOpacity: 0.6,
    shadowRadius: 16,
    shadowOffsetX: -8,
    shadowOffsetY: 20,
  },
  { duration: 1000 },
)
```

| Propiedad                        | Significado                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------- |
| `shadowOpacity`                  | Alfa, de 0 a 1                                                                    |
| `shadowRadius`                   | Radio de desenfoque nativo en DIPs; CSS de **la mitad** NativeScript `blurRadius` |
| `shadowOffsetX`, `shadowOffsetY` | Compensaciones firmadas en DIPs                                                   |

Jolt anima la capa de sombra de Core en lugar de la capa raíz recortada de la vista. Cambiar el radio de la esquina también anima el trazado de la sombra y su recorte interior. Un punto final de opacidad cero permanece oculto después de que Core se vuelve a dibujar. El color y la extensión de las sombras permanecen sin cambios. La animación de parámetros de sombra requiere exactamente una sombra exterior existente; Las listas de sombras, las sombras insertadas, la extensión y el color de las sombras no se interpolan.

## Android sombras {#android-shadows}

Android expone sombras basadas en elevación:

```ts
animate(
  card,
  {
    borderRadius: 40,
    elevation: 24,
    translationZ: 8,
  },
  { duration: 1000 },
)
```

`elevation` escribe `androidElevation` de NativeScript. `translationZ` escribe el desplazamiento Z dinámico nativo; Los cambios de estado del widget pueden reemplazarlo después de la reproducción. Ambos usan DIPs. Jolt suspende el animador de estado del widget mientras es propietario de Z, luego lo restaura, de modo que las animaciones de estado de pulsación no luchen contra la animación activa. La apariencia de las sombras depende de la iluminación, el contorno del fondo y el recorte principal de Android.

Utilice sombras de elevación al animar el radio en Android. El núcleo almacena en caché la geometría CSS `boxShadow`, por lo que se rechaza `borderRadius` en una vista con una sombra CSS. Los parámetros de sombra iOS se activan en Android; `elevation` y `translationZ` se combinan con iOS. Bifurcación en la plataforma al elegir propiedades de sombra.

Cuando una animación termina con el radio y el ancho en cero, Jolt mantiene temporalmente un elemento de diseño Core para su reproducción y restaura el fondo plano final.

El radio y el ancho redibujan el fondo existente de Core dibujable desde Java nativo, preservando su imagen, degradado y color. No hay ejecuciones de JavaScript por cuadro, pero el hilo de la interfaz de usuario de Android aún dibuja cada cuadro; [bloqueando JavaScript en ese hilo](./android-performance) puede provocar tartamudeo. El asistente depende de los campos dibujables de Core: las versiones nativas no compatibles omiten la reproducción con `false` y conservan el modelo final. Reconstruya Android después de instalar o actualizar Jolt para incluir el asistente.
