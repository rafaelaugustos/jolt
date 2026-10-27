# Desenfoque animado {#animated-blur}

Deja que el fondo se suavice mientras un modal, título o botón se mantiene nítido. `@rafaelaugusto/jolt/blur` controla un efecto nativo propio con los mismos conceptos de transición y reproducción que el resto de Jolt. Disponible desde **0.1.0-rc.1**; Reconstruya ambas aplicaciones nativas para incluir sus ayudantes compilados.

<Clip name="blur-ios" caption="Simulador iOS: los toques reales se mueven entre material claro, suave y completo, interrumpen una animación, pausan/reanudan un viaje de ida y vuelta y aplican Reducir movimiento. interfaz de usuario en inglés; sincronización de reproducción original." />
<Clip name="blur-android" caption="Emulador Android 12+: los mismos controles animan un contenido borroso mientras que los controles hermanos se mantienen nítidos. Interfaz de usuario en inglés y toques ADB reales; tiempo de reproducción original, no una medición del rendimiento del dispositivo físico." />

## Mantenga el primer plano nítido {#keep-the-foreground-sharp}

Crea desenfoque en una vista de fondo/contenido dedicada después del diseño nativo. Coloque el contenido modal y los controles en un hermano encima, en lugar de dentro de la vista borrosa.

```ts
import { blur } from '@rafaelaugusto/jolt/blur'
import { motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
const backdrop = scope.add(
  blur(backgroundView, { amount: 0, radius: 24, style: 'light' }),
)

const reveal = backdrop.animate(1, { duration: 700, ease: 'easeInOut' })
reveal.pause()
reveal.progress = 0.5
reveal.play()

// A new command starts at the currently displayed amount.
backdrop.animate(0, 'smooth')

// At permanent teardown:
scope.dispose()
```

| Opción   | Significado                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `amount` | Intensidad inicial en 0–1, valor predeterminado 0. Cero está claro.                                                                  |
| `radius` | Android radio de desenfoque máximo en DIPs, 1–64, predeterminado 24. El radio aplicado es `amount × radius`. iOS ignora esta opción. |
| `style`  | Material iOS: `system` (predeterminado), `light` o `dark`. Android ignora esta opción.                                               |

Las opciones permanecen fijas durante la vida útil del identificador; disponer/recrear para cambiarlos. Un identificador es dueño de cada objetivo. Se lanzan cantidades/opciones/transiciones no válidas antes de reemplazar la reproducción existente.

## Diferentes materiales nativos {#different-native-materials}

iOS agrega un `UIVisualEffectView` no interactivo sobre el contenido del objetivo. Un `UIViewPropertyAnimator` en pausa define la transición de claro a material; un enlace de visualización nativo compilado borra su `fractionComplete`. El efecto sigue los límites del objetivo y el radio de la esquina. No se utilizan API privadas de radio de desenfoque. El tinte del material, la configuración de accesibilidad a la transparencia y el estilo del sistema operativo pueden afectar la apariencia; una cantidad de 0,5 es la mitad de la transición material, no un radio gaussiano específico. [Vista de efectos visuales de Apple](https://developer.apple.com/documentation/uikit/uivisualeffectview) y [progreso del animador](https://developer.apple.com/documentation/uikit/uiviewanimating/fractioncomplete).

Android 12 / API 31 y posteriores utilizan un `ValueAnimator` compilado para reemplazar `RenderEffect.createBlurEffect()` en el nodo de renderizado de la vista. Esto desdibuja esa visión y sus descendientes; **no** muestra vistas arbitrarias detrás de una superposición transparente. Utilice la vista de contenido que debería volverse suave. Los píxeles de borde utilizan `CLAMP`. [Android Efecto de renderizado](https://developer.android.com/reference/android/graphics/RenderEffect).

En versiones anteriores de Android, o sin aceleración de hardware, el respaldo deja el contenido sin cambios. `snapshot().backend` es `none`, `appliedAmount` es 0 y los controles de animación finalizan inmediatamente. El respaldo no cambia la opacidad ni bloquea la entrada.

El identificador Android posee exclusivamente la ranura `RenderEffect` del objetivo y la libera para su eliminación. No lo combine con un efecto existente/personalizado en esa misma vista: Android no expone el efecto anterior para su restauración. Utilice un contenedor dedicado. Los efectos en vistas separadas pueden coexistir. No se promete que las superficies de video/cámara específicas de la plataforma participen en el desenfoque de una vista.

El desenfoque es un efecto visual. No oculta elementos de accesibilidad ni desactiva la interacción con el contenido subyacente. La aplicación todavía posee enfoque y entrada al presentar un modal. Mantenga la vista del efecto iOS y sus antecesores en plena opacidad para una captura de fondo correcta; anime la cantidad de material en lugar de desvanecer la vista del efecto.

## Reproducción y ciclo de vida {#playback-and-lifecycle}

`animate(amount, transition?)` acepta un destino y transiciones de interpolación/resorte, controles de retardo y repetición existentes. El `PlaybackAnimation` devuelto admite `finished`, `pause()`, `play()`, `stop()` y `progress` finito. Los bucles infinitos admiten pausa/reanudación pero rechazan el progreso. Los resortes heredan la velocidad interrumpida y la salida se limita a 0-1. Hay una animación por identificador; No se aceptan matrices ni capas aditivas con nombre.

`set(amount)` aplica un valor inmediatamente. `stop()` contiene el valor mostrado. Ambos cancelan el identificador anterior (`finished` resuelve `false`). `dispose()` elimina el efecto de propiedad, la reproducción nativa y los oyentes del ciclo de vida; la eliminación repetida es segura. La opacidad, las transformaciones y los controladores de entrada de la vista de fondo permanecen sin cambios.

La puesta en segundo plano detiene el trabajo activo. Si NativeScript descarga la vista mientras está en segundo plano, la superficie se libera y el programa en pausa se reanuda después de la carga en primer plano. La descarga ordinaria/reemplazo nativo cancela la reproducción y vuelve a adjuntar la cantidad retenida al cargar. La reproducción pausada explícitamente permanece en pausa. Un osciloscopio de movimiento puede poseer el efecto para eliminarlo o el controlador de reproducción para suspenderlo.

Reducir movimiento aplica nuevos destinos inmediatamente. Habilitarlo durante una animación detiene ese controlador y aplica su destino solicitado. Los controladores de respaldo no admitidos también se resuelven inmediatamente, incluidas las solicitudes de repetición para siempre.

`snapshot()` lee `amount`, `appliedAmount`, `backend`, `attached`, `nativeAnimations`, `frames`, `width` y `height` bajo demanda. No instala ningún observador. Los recuentos incluyen relojes nativos pausados ​​retenidos; Los efectos separados informan de cero cantidad aplicada y cero objetos de reproducción.

JavaScript prepara una curva de muestra y maneja comandos, ciclo de vida y límites de finalización. El código nativo actualiza el efecto en cada fotograma. Ambos ayudantes nativos utilizan el hilo de la interfaz de usuario; Esto no es una promesa de un hilo separado, asignación cero o reproducción ininterrumpida mientras el hilo de la interfaz de usuario esté bloqueado. El costo del desenfoque depende del tamaño de la vista, el radio y el dispositivo. Limita el efecto a la zona que lo necesita.

La vista previa del **Enfoque suave / Lento** en cuatro idiomas es el ejemplo número 72. Ver [validación y reproducción nativa](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/blur.md).
