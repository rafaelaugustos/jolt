# Áreas táctiles animadas {#touch-targets-during-animation}

`interactionSurface(target)` mantiene la geometría táctil nativa alineada con las transformaciones animadas y la opacidad de Jolt en un subárbol de vista. Agregado en beta.8. **Reconstruir la aplicación iOS** después de instalar el nuevo asistente nativo.

<Clip name="interaction-surface-ios" caption="Un toque de coordenadas en la tarjeta azul en movimiento la expande durante un reordenamiento lento. Simulador iOS; La reproducción del diseño opta por la geometría interactiva." />

```ts
import { animate, drag, interactionSurface } from '@rafaelaugusto/jolt'

const surface = interactionSurface(container)
const animation = animate(button, { x: 180 }, { duration: 1200 })
const cardDrag = drag(card, { axis: 'x', bounds: { left: 0, right: 180 } })

// When this screen is disposed:
cardDrag.dispose()
animation.stop()
surface.dispose()
```

Registra la superficie **antes de iniciar animaciones**. El objetivo puede ser una vista NativeScript o una referencia de plantilla compatible. Incluye el objetivo y sus descendientes NativeScript. Incluya todos los ancestros que anime: activar solo el botón no puede corregir una transformación Core Animation separada en un padre fuera de la superficie. La demostración de arrastre registra su contenedor para que la liberación de una tarjeta siga siendo interactiva.

## ¿Por qué inscribirse? {#why-opt-in}

De forma predeterminada, Jolt escribe el destino en el modelo NativeScript y reproduce una presentación Core Animation en iOS. Luego, UIKit puede probar el destino mientras el botón está visiblemente en otro lugar. La sonda del dispositivo para el número 56 reprodujo esto con un botón real pausado a mitad de una traducción.

Dentro de una superficie, iOS reproduce los fotogramas clave numéricos precalculados con un `CADisplayLink` nativo compartido, actualizando la transformación y la opacidad nativas reales. Las pruebas de acceso ordinarias, la entrega de gestos, el recorte, el orden de hermanos y la geometría de accesibilidad de UIKit utilizan esa misma geometría. No se reemplaza ningún método UIView, no se inserta ningún control de proxy transparente y no se ejecuta ninguna devolución de llamada JavaScript por cuadro. Los colores y decoraciones continúan utilizando sus controladores existentes.

Las animaciones de propiedades nativas de Android ya actualizan la geometría táctil. La misma API es segura de usar allí y mantiene el controlador existente.

Este es un costo de subproceso de interfaz de usuario en iOS: use una superficie para mover contenido interactivo, en lugar de optar por una escena decorativa completa de forma predeterminada. El hilo principal pesado JavaScript puede retrasar esta reproducción y manejo táctil. No hay ninguna promesa de reproducción del servidor de renderizado mientras el hilo principal de la aplicación esté bloqueado. Los valores de propiedad JS de NativeScript aún siguen la contabilidad de destino del motor; no son valores de movimiento reactivos por cuadro.

## Propiedad y reproducción {#ownership-and-playback}

El identificador devuelto tiene `disposed: boolean` y un `dispose()` idempotente. Los registros independientes en la misma vista se cuentan por referencia. Desechar uno no elimina otro.

La eliminación desactiva la superficie para las animaciones **futuro**. No detiene ni cambia el controlador de las animaciones que ya se están ejecutando. El registro de una superficie tampoco migra una pista Core Animation existente. Detenga o reemplace esa animación después de registrarse si necesita geometría interactiva.

Pausar, reanudar, borrar, retrasar, revertir/repetir y la interrupción selectiva conservan su semántica de control de animación. Las pistas pausadas mantienen su pose nativa sin un enlace de visualización activo. Descargar cancela las animaciones de la vista. En iOS, la suspensión de la aplicación cancela las pistas interactivas en su posición actual y las resuelve con `false`; iniciar una nueva reproducción después de reanudarla cuando sea necesario. Esto evita retener un bucle de fotograma interactivo en segundo plano.

Un osciloscopio puede poseer tanto el registro como la reproducción:

```ts
const scope = motionScope() // or useMotionScope() in Vue setup
scope.use(() => interactionSurface(container))
const animation = scope.animate(button, { x: 180 })
// scope.dispose() stops owned animations and disposes the registration.
```

## Las reglas de interacción nativas aún se aplican {#native-interaction-rules-still-apply}

Una vista deshabilitada o no interactiva permanece deshabilitada. Una parte recortada no puede recibir toques y los límites nativos de un antepasado todavía limitan las pruebas de impacto. Esta API no amplía los límites táctiles de los padres, no arbitra reconocedores competitivos ni cambia las limitaciones de las coordenadas de arrastre documentadas en [arrastrar](./drag). NativeScript posee la etiqueta, el rol y la semántica de accesibilidad del estado habilitado del control; la superficie conserva esos controles en lugar de crear duplicados.

El [informe de validación](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/interaction-lifecycle.md) cubre toques inyectados en el sistema operativo, ancestros animados, recortes, controles superpuestos, `press()`, marcos de accesibilidad nativos y comprobaciones del ciclo de vida en iOS y Android. No pretende realizar una auditoría de navegación manual de VoiceOver o TalkBack.
