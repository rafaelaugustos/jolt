# Inspector de movimiento {#inspect-motion-on-a-running-device}

Seleccione una vista, vea qué animación posee sus propiedades y compare la curva esperada con las observaciones nativas. El experimento **59 — Inspector de movimiento** también afina un resorte, lo reproduce y copia el TypeScript necesario para reproducirlo.

::: warning Solo desarrollo
Disponible desde **0.1.0-beta.18** en el paquete principal. Reconstruya la aplicación nativa para la sonda. Mantenga la importación del inspector dentro de una entrada de desarrollo que excluya su compilación de producción.
:::

<Clip name="motion-inspector-ios" caption="Simulador de iOS con toques XCTest reales: inspecciona una interrupción, sintoniza y reproduce un resorte, mantén su reproducción, inspecciona el movimiento retardado/en capas/vinculado y copia TypeScript. La cal es el modelo de motor; El rosa es la presentación CALayer de muestra. Tiempo de captura original, no una medición del rendimiento de la pantalla física." />

<Clip name="motion-inspector-android" caption="Emulador Android con toques ADB reales: el mismo inspector lee las propiedades nativas de la Vista en un búfer delimitado. Estas son observaciones de subprocesos de la interfaz de usuario, no marcas de tiempo de presentación de la GPU o FPS del dispositivo físico. Velocidad de reproducción original." />

## Iniciar solo en desarrollo {#start-only-in-development}

```ts
// dev/motion-tools.ts — exclude this entry from the production build
import { createMotionInspector } from '@rafaelaugusto/jolt/inspector'

const inspector = createMotionInspector({
  development: true,
  capacity: 240,
  hertz: 60,
})
const unwatch = inspector.watch(card, 'card')
inspector.select('card', 'x')

const animation = animate(card, { x: 220 }, 'bouncy')
inspector.label(animation, 'Entrance')

// One batch, normally read by a development panel every 200–250 ms.
const state = inspector.read()
// state.properties: owner, label, layer, target, value, velocity, delay, elapsed, duration
// state.bindings: motion-value root, mapping ranges, live-follower input
// state.events: starts, replacements, stops, completion, pause/play/seek
// state.samples: time, expected, observed, source

unwatch()
inspector.dispose()
```

La lectura y la selección no buscan, reinician, suscriben a un valor de movimiento ni toman posesión de las propiedades de la animación. Etiquete el mango original `animate(view, ...)`; un identificador de grupo no es el propietario de cada propiedad secundaria. Las capas con nombre aparecen como propietarios separados incluso cuando el conductor reproduce una pista compuesta. Los eventos de controlador para ese compuesto tienen su propia identidad.

Observe y seleccione antes de reproducir un error para capturar sus límites. Seleccionar una animación existente proporciona su estado actual pero no puede recuperar eventos pasados. Los enlaces exponen su cadena de mapeo numérico y raíz existente; Las entradas de los seguidores de Live Spring se amplían hasta ocho niveles. Los mapas de color internos y las dependencias externas arbitrarias no se reconstruyen.

## Sintonizar, copiar y mantener {#tune-copy-and-hold}

```ts
import { inspectorSpring, springCode } from '@rafaelaugusto/jolt/inspector'

const spring = { duration: 650, bounce: 0.35 }
const options = inspectorSpring(spring)
// Physics is also accepted: { stiffness: 180, damping: 22, mass: 1 }
const code = springCode({ target: 'card', to: 220, spring })
```

La demostración cambia la duración/rebote solo cuando se presiona **Reproducir**. **Copiar TypeScript** copia un resorte explícito `[0, target]` con velocidad inicial cero, por lo que una vista nueva reproduce el mismo movimiento después de un reinicio. La vista previa guarda esas perillas al copiar. Un retorno interrumpido es una acción separada y preserva intencionalmente la velocidad entrante.

`inspector.control(animation, 'seek', 0.25)` hace una pausa explícita y busca un controlador de reproducción finito. Utilice `'play'` para continuar o `'pause'` para mantener su punto actual. Este es un comando de edición, independiente de la inspección. Las animaciones infinitas no se pueden eliminar; la API `timeline()` actual no expone una búsqueda arbitraria de línea de tiempo completa. Las secuencias retrasadas se pueden inspeccionar mientras se activan sus participantes reales.

## Saber lo que se midió {#know-what-was-measured}

- **iOS:** la sonda nativa lee la capa de presentación. Si está ausente, `observed` es `null`; la capa del modelo nunca se sustituye.
- **Android:** la sonda lee las propiedades de vista nativas en el hilo de la interfaz de usuario. Estos valores no son prueba de escaneo de GPU y el orden de devolución de llamada puede colocar una lectura un cuadro detrás de un animador.
- El muestreo nativo admite `x`, `y`, `scaleX`, `scaleY`, `rotate`, `rotateX`, `rotateY` y `opacity`. Otras propiedades conservan los diagnósticos del motor sin disponibilidad explícita de muestreo nativo. La traslación utiliza DIP, grados de rotación, valores sin unidades de escala/opacidad.
- `expected` es la curva entregada al conductor nativo, anclada a su reloj reportado. Es un modelo, no una segunda medida de pantalla. Los seguidores nativos vivos y los compuestos que comenzaron antes de la selección pueden carecer de una curva reconstruible; sus muestras esperadas son `null`. Las escrituras directas de aplicaciones y los animadores de terceros están fuera de la cobertura del registrador de eventos.
- Los historiales nativo y JavaScript están limitados: capacidad de 8 a 600, valor predeterminado 240, como máximo 32 vistas registradas y una sesión de inspector. La colección es nativa; JavaScript drena lotes. Los hercios solicitados son un límite superior, no una garantía de frecuencia de actualización. Se cuentan las muestras viejas caídas. Los huecos en la trama siguen siendo huecos.

Al descargar la vista o el fondo seleccionados se detiene la recopilación nativa. Seleccione la vista nuevamente para reanudarla después de regresar. Dejar de mirar libera a sus oyentes; La eliminación restaura el controlador anterior y detiene la sonda sin detener las animaciones de la aplicación. Utilice la eliminación cuando finalice una página de desarrollo o una sesión de recarga en caliente.

La entrada del núcleo de producción no importa ni los ganchos del inspector ni su interfaz de usuario; una verificación de paquete verifica que se hayan eliminado. Las clases de sonda nativas se envían con el binario principal, pero están inactivas hasta que se inician explícitamente. `development: true` es una opción de suscripción explícita, no una detección automática de una versión de lanzamiento.

`state.overhead` informa el costo acumulado de lectura/gancho de JavaScript, el costo de muestreo/serialización nativo, el recuento de muestras y las caídas de búfer. El costo del drenaje nativo se informa un lote más tarde. Las mediciones excluyen el renderizado de los paneles y son observaciones locales; El punto de referencia también compara la preparación con y sin inspección. Ver [validación y reproducción](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/motion-inspector.md).
